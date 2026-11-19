'use strict';
/* Vice City Cover Studio — offline GTA-style cover art maker.
   Everything runs locally: photos are read with FileReader and never
   uploaded. Rendering is plain Canvas 2D; export is canvas.toBlob. */

const $ = (id) => document.getElementById(id);

const GAP = 0.014; // panel gap, fraction of canvas size

const LAYOUTS = {
  hero: [
    { x: 0, y: 0, w: 1, h: 0.58 },
    { x: 0, y: 0.58, w: 0.5, h: 0.42 },
    { x: 0.5, y: 0.58, w: 0.5, h: 0.42 },
  ],
  strips: [
    { x: 0, y: 0, w: 1 / 3, h: 1 },
    { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
    { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
  ],
  grid: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  single: [{ x: 0, y: 0, w: 1, h: 1 }],
};

const GRADES = ['sunset', 'neon', 'vice', 'noir'];

const state = {
  layout: 'hero',
  grade: 'sunset',
  lettering: 'block',
  caption: 'NEON SUNSET',
  tagline: 'A SUNSET STORY IN NEON',
  captionScale: 1,
  exportSize: '1920x1080',
  photos: [], // { id, name, img }
  panels: [0, 1, 2, 3].map(() => ({ photoId: null, zoom: 1, ox: 0, oy: 0 })),
  selected: 0,
};

let photoSeq = 0;

/* ------------------------------------------------------------------ */
/* Procedural sample photos: a sunset cityscape + silhouette, drawn   */
/* on a canvas. No real-person photo, no copied artwork.              */
/* ------------------------------------------------------------------ */

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawSkyline(ctx, w, h, rand, palette) {
  // Buildings with lit windows, silhouetted against the sky.
  let x = -10;
  while (x < w + 10) {
    const bw = 40 + rand() * 90;
    const bh = h * (0.22 + rand() * 0.38);
    const by = h - bh;
    ctx.fillStyle = palette.building;
    ctx.fillRect(x, by, bw, bh);
    // rooftop antenna on some towers
    if (rand() < 0.3) {
      ctx.fillRect(x + bw / 2 - 2, by - 26 - rand() * 20, 4, 30);
      ctx.fillStyle = palette.beacon;
      ctx.beginPath();
      ctx.arc(x + bw / 2, by - 28 - rand() * 20, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // lit windows
    ctx.fillStyle = palette.window;
    const cols = Math.max(1, Math.floor(bw / 16));
    const rows = Math.max(1, Math.floor(bh / 22));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() < 0.42) {
          ctx.globalAlpha = 0.35 + rand() * 0.65;
          ctx.fillRect(x + 5 + c * 16, by + 8 + r * 22, 7, 10);
        }
      }
    }
    ctx.globalAlpha = 1;
    x += bw + 4 + rand() * 14;
  }
}

function drawPalm(ctx, x, baseY, scale, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5 * scale;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + 12 * scale, baseY - 60 * scale, x + 4 * scale, baseY - 95 * scale);
  ctx.stroke();
  const topX = x + 4 * scale;
  const topY = baseY - 95 * scale;
  ctx.lineWidth = 3 * scale;
  for (let i = 0; i < 6; i++) {
    const a = (-Math.PI * 0.15) - (i * Math.PI) / 7.2;
    const len = 42 * scale;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.5 - 8 * scale,
      topX + Math.cos(a) * len, topY + Math.sin(a) * len + 16 * scale,
    );
    ctx.stroke();
  }
}

function paintScene(ctx, w, h, kind, seed) {
  const rand = seededRandom(seed);
  const palettes = {
    sunset: {
      sky: ['#2b1055', '#7b1e6b', '#e0397a', '#ff7a3c', '#ffc46b'],
      sun: '#ffe9a8', sunGlow: 'rgba(255, 150, 60, 0.55)',
      building: '#160a24', window: '#ffd23c', beacon: '#ff2e88',
      ground: '#12081f', streak: 'rgba(255, 154, 60, 0.5)',
    },
    neon: {
      sky: ['#050b2e', '#1b0f54', '#6d1fae', '#ff2e88', '#29e6ff'],
      sun: '#aef4ff', sunGlow: 'rgba(41, 230, 255, 0.5)',
      building: '#070418', window: '#29e6ff', beacon: '#ff2e88',
      ground: '#060213', streak: 'rgba(41, 230, 255, 0.45)',
    },
    vice: {
      sky: ['#1d0b3a', '#5c1a72', '#c22a86', '#ff5e3a', '#ffcf5e'],
      sun: '#fff3c4', sunGlow: 'rgba(255, 94, 58, 0.55)',
      building: '#14081f', window: '#ff9a3c', beacon: '#29e6ff',
      ground: '#0e0616', streak: 'rgba(255, 94, 58, 0.5)',
    },
  };
  const p = palettes[kind] || palettes.sunset;

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.78);
  p.sky.forEach((c, i) => sky.addColorStop(i / (p.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Retro striped sun, low over the horizon.
  const sunR = h * 0.17;
  const sunX = w * (0.3 + rand() * 0.4);
  const sunY = h * 0.58;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.6);
  glow.addColorStop(0, p.sunGlow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = p.sun;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = p.sky[0];
  let stripeY = sunY + sunR * 0.05;
  let stripeH = 3;
  while (stripeY < sunY + sunR) {
    ctx.fillRect(sunX - sunR, stripeY, sunR * 2, stripeH);
    stripeY += stripeH + 9;
    stripeH += 3;
  }
  ctx.restore();

  drawSkyline(ctx, w, h * 0.82, rand, p);

  // Foreground: dark ground with light streaks (wet street / water).
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  for (let i = 0; i < 26; i++) {
    const sx = rand() * w;
    const sw = 2 + rand() * 5;
    const sh = h * (0.02 + rand() * 0.12);
    ctx.fillStyle = p.streak;
    ctx.globalAlpha = 0.12 + rand() * 0.3;
    ctx.fillRect(sx, h * 0.84 + rand() * h * 0.06, sw, sh);
  }
  ctx.globalAlpha = 1;

  // Palm silhouettes at the edges.
  drawPalm(ctx, w * 0.06, h * 0.99, 1.1, p.building);
  drawPalm(ctx, w * 0.94, h * 0.99, 0.9, p.building);
  drawPalm(ctx, w * 0.86, h * 0.99, 0.6, p.building);
}

function makeSamplePhoto(kind, seed) {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 800;
  paintScene(c.getContext('2d'), c.width, c.height, kind, seed);
  return c;
}

function canvasToImage(canvas) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL('image/png');
  });
}

async function loadSamplePhotos() {
  const kinds = [['sunset', 11], ['neon', 23], ['vice', 37]];
  for (const [kind, seed] of kinds) {
    const img = await canvasToImage(makeSamplePhoto(kind, seed));
    state.photos.push({ id: ++photoSeq, name: `Sample — ${kind}`, img });
  }
  // First sample fills every panel so the cover looks complete at once.
  state.panels.forEach((p, i) => {
    p.photoId = state.photos[i % state.photos.length].id;
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
  });
  renderTray();
  render();
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const preview = $('preview');
const pctx = preview.getContext('2d');

function panelRects(W, H) {
  const rects = LAYOUTS[state.layout];
  const gx = GAP * W;
  const gy = GAP * H;
  return rects.map((r) => ({
    x: r.x * W + gx / 2,
    y: r.y * H + gy / 2,
    w: r.w * W - gx,
    h: r.h * H - gy,
  }));
}

function photoById(id) {
  return state.photos.find((p) => p.id === id) || null;
}

function drawPhotoCover(ctx, img, rect, zoom, ox, oy) {
  const scale = Math.max(rect.w / img.width, rect.h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = rect.x + (rect.w - dw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + oy * rect.h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawPlaceholder(ctx, rect, index) {
  // A procedural sunset scene so empty panels still look like art.
  const kinds = ['sunset', 'neon', 'vice'];
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 400;
  paintScene(c.getContext('2d'), c.width, c.height, kinds[index % 3], 100 + index * 7);
  drawPhotoCover(ctx, c, rect, 1, 0, 0);
  ctx.fillStyle = 'rgba(10, 4, 18, 0.25)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = 'rgba(255, 246, 236, 0.85)';
  ctx.font = `600 ${Math.max(13, rect.h * 0.055)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Drop a photo here', rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function applyGrade(ctx, W, H) {
  if (state.grade === 'noir') {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(20, 20, 40, 0.10)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else {
    const tints = {
      sunset: [
        [0, 'rgba(255, 122, 60, 0.10)'],
        [1, 'rgba(255, 46, 136, 0.20)'],
      ],
      neon: [
        [0, 'rgba(255, 46, 136, 0.16)'],
        [0.55, 'rgba(120, 40, 255, 0.10)'],
        [1, 'rgba(41, 230, 255, 0.22)'],
      ],
      vice: [
        [0, 'rgba(255, 46, 136, 0.20)'],
        [1, 'rgba(41, 230, 255, 0.18)'],
      ],
    };
    const stops = tints[state.grade] || tints.sunset;
    const g = ctx.createLinearGradient(0, 0, W * 0.25, H);
    stops.forEach(([at, color]) => g.addColorStop(at, color));
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // Vignette.
  const v = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(5, 2, 12, 0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function drawCaptionBand(ctx, W, H) {
  const bandTop = H * 0.80;
  const g = ctx.createLinearGradient(0, bandTop, 0, H);
  g.addColorStop(0, 'rgba(8, 3, 16, 0)');
  g.addColorStop(0.45, 'rgba(8, 3, 16, 0.72)');
  g.addColorStop(1, 'rgba(8, 3, 16, 0.94)');
  ctx.fillStyle = g;
  ctx.fillRect(0, bandTop, W, H - bandTop);

  // Neon divider line.
  ctx.fillStyle = state.grade === 'noir' ? '#e8e8e8' : '#ff2e88';
  ctx.fillRect(0, bandTop, W, Math.max(2, H * 0.004));
  ctx.fillStyle = state.grade === 'noir' ? '#888' : '#29e6ff';
  ctx.fillRect(0, bandTop + Math.max(2, H * 0.004), W, Math.max(1, H * 0.002));

  // Skyline silhouette behind the text.
  ctx.save();
  ctx.globalAlpha = 0.5;
  const sky = document.createElement('canvas');
  sky.width = 900;
  sky.height = 120;
  const sctx = sky.getContext('2d');
  const rand = seededRandom(99);
  sctx.fillStyle = '#000';
  let x = 0;
  while (x < 900) {
    const bw = 30 + rand() * 70;
    const bh = 30 + rand() * 80;
    sctx.fillRect(x, 120 - bh, bw, bh);
    x += bw + 3 + rand() * 10;
  }
  ctx.drawImage(sky, 0, H - 118 * (H / 1080) - H * 0.02, W, 118 * (H / 1080));
  ctx.restore();

  // Title.
  const size = H * 0.115 * state.captionScale;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${Math.max(2, size * 0.04)}px`; } catch (e) { /* older canvas */ }
  ctx.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
  const cx = W / 2;
  const cy = H * 0.865;
  const title = (state.caption || 'UNTITLED').toUpperCase();
  if (state.lettering === 'block') {
    const grad = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    if (state.grade === 'noir') {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#d9d9d9');
      grad.addColorStop(1, '#9a9a9a');
    } else {
      grad.addColorStop(0, '#ffd23c');
      grad.addColorStop(0.45, '#ff7a3c');
      grad.addColorStop(1, '#ff2e88');
    }
    ctx.shadowColor = 'rgba(255, 46, 136, 0.8)';
    ctx.shadowBlur = size * 0.25;
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = '#14081f';
    ctx.strokeText(title, cx, cy);
    ctx.fillStyle = grad;
    ctx.fillText(title, cx, cy);
  } else if (state.lettering === 'outline') {
    ctx.shadowColor = 'rgba(41, 230, 255, 0.9)';
    ctx.shadowBlur = size * 0.18;
    ctx.lineWidth = size * 0.045;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(title, cx, cy);
  } else if (state.lettering === 'neon') {
    ctx.shadowColor = '#29e6ff';
    ctx.shadowBlur = size * 0.45;
    ctx.lineWidth = size * 0.03;
    ctx.strokeStyle = '#aef4ff';
    ctx.strokeText(title, cx, cy);
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = size * 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, cx, cy);
  } else { // chrome
    const grad = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    grad.addColorStop(0, '#8a8f98');
    grad.addColorStop(0.35, '#ffffff');
    grad.addColorStop(0.55, '#c9ccd4');
    grad.addColorStop(0.75, '#ffffff');
    grad.addColorStop(1, '#6f747e');
    ctx.lineWidth = size * 0.07;
    ctx.strokeStyle = '#0c0614';
    ctx.strokeText(title, cx, cy);
    ctx.fillStyle = grad;
    ctx.fillText(title, cx, cy);
  }
  ctx.restore();

  // Tagline.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tagSize = Math.max(11, H * 0.024);
  ctx.font = `700 ${tagSize}px "Segoe UI", Arial, sans-serif`;
  try { ctx.letterSpacing = `${tagSize * 0.35}px`; } catch (e) { /* older canvas */ }
  ctx.fillStyle = state.grade === 'noir' ? '#dddddd' : '#ffd23c';
  ctx.fillText((state.tagline || '').toUpperCase(), W / 2, H * 0.955);
  ctx.restore();
}

function renderTo(ctx, W, H) {
  ctx.fillStyle = '#0a0512';
  ctx.fillRect(0, 0, W, H);
  const rects = panelRects(W, H);
  rects.forEach((rect, i) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    const panel = state.panels[i];
    const photo = panel && panel.photoId ? photoById(panel.photoId) : null;
    if (photo) {
      drawPhotoCover(ctx, photo.img, rect, panel.zoom, panel.ox, panel.oy);
      // Warm the photo a touch so panels feel like one poster.
      ctx.fillStyle = 'rgba(255, 120, 60, 0.06)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    } else {
      drawPlaceholder(ctx, rect, i);
    }
    ctx.restore();
    // Panel frame.
    ctx.strokeStyle = 'rgba(255, 246, 236, 0.9)';
    ctx.lineWidth = Math.max(1.5, W * 0.002);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    // Selected panel marker.
    if (i === state.selected) {
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = Math.max(2.5, W * 0.004);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  });
  applyGrade(ctx, W, H);
  drawCaptionBand(ctx, W, H);
}

function exportDims() {
  const [w, h] = state.exportSize.split('x').map(Number);
  return { w, h };
}

function render() {
  const { w, h } = exportDims();
  const scale = 960 / w;
  preview.width = 960;
  preview.height = Math.round(h * scale);
  renderTo(pctx, preview.width, preview.height);
  updateSelectedLabel();
}

function exportDataURL(size) {
  const [w, h] = (size || state.exportSize).split('x').map(Number);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  renderTo(c.getContext('2d'), w, h);
  return new Promise((resolve) => c.toBlob((b) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(b);
  }, 'image/png'));
}

async function exportPNG() {
  const { w, h } = exportDims();
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  renderTo(c.getContext('2d'), w, h);
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cover-${state.exportSize}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ------------------------------------------------------------------ */
/* UI wiring                                                           */
/* ------------------------------------------------------------------ */

function renderTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  state.photos.forEach((photo) => {
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    img.title = `${photo.name} — click to put it in the selected panel`;
    img.className = state.panels.some((p) => p.photoId === photo.id) ? 'assigned' : '';
    img.addEventListener('click', () => {
      state.panels[state.selected].photoId = photo.id;
      state.panels[state.selected].zoom = 1;
      state.panels[state.selected].ox = 0;
      state.panels[state.selected].oy = 0;
      renderTray();
      render();
    });
    tray.appendChild(img);
  });
  $('tray-empty').style.display = state.photos.length ? 'none' : '';
}

function updateSelectedLabel() {
  const n = LAYOUTS[state.layout].length;
  const panel = state.panels[state.selected];
  const photo = panel && panel.photoId ? photoById(panel.photoId) : null;
  $('selected-label').textContent =
    `Panel ${state.selected + 1} of ${n} — ${photo ? photo.name : 'no photo yet.'}`;
  $('zoom-range').value = Math.round((panel ? panel.zoom : 1) * 100);
  $('zoom-out').textContent = `${Math.round((panel ? panel.zoom : 1) * 100)}%`;
}

function setGrade(grade) {
  if (!GRADES.includes(grade)) return;
  state.grade = grade;
  $('grade-seg').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === grade);
  });
  render();
}

function bindSeg(id, key) {
  $(id).addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-' + key + ']');
    if (!btn) return;
    $(id).querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state[key] = btn.dataset[key];
    if (key === 'layout') {
      state.selected = 0;
    }
    render();
  });
}

bindSeg('layout-seg', 'layout');
bindSeg('lettering-seg', 'lettering');
bindSeg('grade-seg', 'grade');

$('caption-input').addEventListener('input', (e) => {
  state.caption = e.target.value;
  render();
});
$('tagline-input').addEventListener('input', (e) => {
  state.tagline = e.target.value;
  render();
});
$('size-range').addEventListener('input', (e) => {
  state.captionScale = Number(e.target.value) / 100;
  $('size-out').textContent = `${e.target.value}%`;
  render();
});
$('zoom-range').addEventListener('input', (e) => {
  const panel = state.panels[state.selected];
  panel.zoom = Number(e.target.value) / 100;
  $('zoom-out').textContent = `${e.target.value}%`;
  render();
});
$('size-select').addEventListener('change', (e) => {
  state.exportSize = e.target.value;
  render();
});

$('file-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });
    state.photos.push({ id: ++photoSeq, name: file.name, img });
  }
  // New photos fill empty panels first.
  state.panels.forEach((p) => {
    if (!p.photoId && state.photos.length) p.photoId = state.photos[state.photos.length - 1].id;
  });
  e.target.value = '';
  renderTray();
  render();
});

$('samples-btn').addEventListener('click', () => {
  loadSamplePhotos().catch((err) => console.error('sample photos failed', err));
});

$('fill-all-btn').addEventListener('click', () => {
  if (!state.photos.length) return;
  state.panels.forEach((p, i) => {
    p.photoId = state.photos[i % state.photos.length].id;
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
  });
  renderTray();
  render();
});

$('fit-btn').addEventListener('click', () => {
  const p = state.panels[state.selected];
  p.zoom = 1;
  p.ox = 0;
  p.oy = 0;
  render();
});

$('clear-btn').addEventListener('click', () => {
  state.panels[state.selected].photoId = null;
  renderTray();
  render();
});

$('export-btn').addEventListener('click', () => {
  exportPNG().catch((err) => console.error('export failed', err));
});

/* Keyboard shortcuts: Ctrl/Cmd+E exports the current size, keys 1–4
   switch the colour grade. Ignored while typing in a field. */
document.addEventListener('keydown', (e) => {
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    exportPNG().catch((err) => console.error('export failed', err));
    return;
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-4]$/.test(e.key)) {
    setGrade(GRADES[Number(e.key) - 1]);
  }
});

/* Canvas pointer interaction: click selects a panel, drag pans its
   photo, wheel zooms it. */
let drag = null;

function canvasPoint(e) {
  const r = preview.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (preview.width / r.width),
    y: (e.clientY - r.top) * (preview.height / r.height),
  };
}

function panelAt(x, y) {
  const rects = panelRects(preview.width, preview.height);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

preview.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(p.x, p.y);
  if (i < 0) return;
  state.selected = i;
  preview.setPointerCapture(e.pointerId);
  drag = { x: p.x, y: p.y, moved: false };
  render();
});

preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const rects = panelRects(preview.width, preview.height);
  const rect = rects[state.selected];
  const panel = state.panels[state.selected];
  if (rect && panel && panel.photoId) {
    panel.ox += (p.x - drag.x) / rect.w;
    panel.oy += (p.y - drag.y) / rect.h;
    panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox));
    panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy));
    drag.moved = true;
    render();
  }
  drag.x = p.x;
  drag.y = p.y;
});

preview.addEventListener('pointerup', () => { drag = null; });
preview.addEventListener('pointercancel', () => { drag = null; });

preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  if (!panel || !panel.photoId) return;
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * (1 - e.deltaY * 0.001)));
  render();
}, { passive: false });

/* Test hook (used by the screenshot/verification script only). */
window.__studio = { state, render, exportDataURL, loadSamplePhotos, setGrade };

render();
