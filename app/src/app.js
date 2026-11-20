(function () {
  'use strict';

  // ---------- tiny helpers ----------
  function $(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // Seeded random: linear congruential generator, same seed -> same scene.
  function seeded(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---------- palettes ----------
  var PALETTES = {
    sunset: {
      sky: ['#2b1055', '#7b1e6e', '#c62b6e', '#ff7e29', '#ffd166'],
      sun: '#ffcf5c', building: '#1a0b2e', window: '#ffd166',
      beacon: '#ff2e88', ground: '#12061f', streak: 'rgba(255, 126, 41, 0.35)'
    },
    neon: {
      sky: ['#050b2e', '#12206b', '#3b1d8f', '#b01e8f', '#2ee6ff'],
      sun: '#2ee6ff', building: '#070a24', window: '#2ee6ff',
      beacon: '#ff2e88', ground: '#05081a', streak: 'rgba(46, 230, 255, 0.35)'
    },
    vice: {
      sky: ['#2a0a4a', '#6d1168', '#d63384', '#ff7e29', '#ffe066'],
      sun: '#ffe066', building: '#160829', window: '#ffe066',
      beacon: '#2ee6ff', ground: '#0f051f', streak: 'rgba(255, 46, 136, 0.35)'
    }
  };
  var PALETTE_NAMES = ['sunset', 'neon', 'vice'];
  var GRADES = ['sunset', 'neon', 'vice', 'noir'];

  // ---------- procedural sunset-city painter ----------
  function paintScene(ctx, rx, ry, rw, rh, paletteName, seed) {
    var pal = PALETTES[paletteName] || PALETTES.sunset;
    var rnd = seeded(seed);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();

    // Sky: five-stop vertical gradient.
    var sky = ctx.createLinearGradient(0, ry, 0, ry + rh);
    for (var i = 0; i < pal.sky.length; i++) {
      sky.addColorStop(i / (pal.sky.length - 1), pal.sky[i]);
    }
    ctx.fillStyle = sky;
    ctx.fillRect(rx, ry, rw, rh);

    // Low sun with glow and stripes across its lower half.
    var small = Math.min(rw, rh);
    var sunR = small * 0.24;
    var sunX = rx + rw / 2;
    var sunY = ry + rh * 0.60;
    var glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.1);
    glow.addColorStop(0, pal.sun);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - sunR * 2.2, sunY - sunR * 2.2, sunR * 4.4, sunR * 4.4);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = pal.sun;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
    ctx.fillStyle = pal.sky[0];
    var band = 0;
    for (var by = sunY; by < sunY + sunR; by += sunR / 7) {
      if (band % 2 === 1) {
        ctx.fillRect(sunX - sunR, by, sunR * 2, sunR / 14);
      }
      band++;
    }
    ctx.restore();

    // Skyline along the horizon at 78% height.
    var horizon = ry + rh * 0.78;
    ctx.fillStyle = pal.building;
    var bx = rx;
    while (bx < rx + rw) {
      var bw = rw * (0.06 + rnd() * 0.10);
      var bh = rh * (0.10 + rnd() * 0.20);
      ctx.fillRect(bx, horizon - bh, bw, bh + (ry + rh - horizon));
      // Randomly lit windows.
      ctx.fillStyle = pal.window;
      var cols = Math.max(1, Math.floor(bw / (rw * 0.03)));
      var rows = Math.max(1, Math.floor(bh / (rh * 0.05)));
      for (var wx = 0; wx < cols; wx++) {
        for (var wy = 0; wy < rows; wy++) {
          if (rnd() < 0.32) {
            ctx.globalAlpha = 0.5 + rnd() * 0.5;
            ctx.fillRect(bx + 3 + wx * (bw / cols), horizon - bh + 4 + wy * (bh / rows), 3, 4);
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.building;
      // Some rooftops carry an antenna with a glowing beacon.
      if (rnd() < 0.35) {
        var ax = bx + bw / 2;
        ctx.fillRect(ax - 1, horizon - bh - rh * 0.06, 2, rh * 0.06);
        ctx.fillStyle = pal.beacon;
        ctx.beginPath();
        ctx.arc(ax, horizon - bh - rh * 0.065, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.building;
      }
      bx += bw + 1;
    }

    // Dark foreground band with translucent light streaks.
    ctx.fillStyle = pal.ground;
    ctx.fillRect(rx, horizon, rw, ry + rh - horizon);
    ctx.fillStyle = pal.streak;
    for (var s = 0; s < 4; s++) {
      var sy = horizon + (ry + rh - horizon) * (0.2 + rnd() * 0.7);
      ctx.fillRect(rx + rnd() * rw * 0.5, sy, rw * (0.2 + rnd() * 0.4), 2);
    }

    // Palm silhouettes at both bottom edges.
    drawPalm(ctx, rx + rw * 0.06, ry + rh, rh * 0.30, 1, pal.building);
    drawPalm(ctx, rx + rw * 0.94, ry + rh, rh * 0.26, -1, pal.building);

    ctx.restore();
  }

  function drawPalm(ctx, baseX, baseY, height, lean, colour) {
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = Math.max(3, height * 0.03);
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(baseX + lean * height * 0.25, baseY - height * 0.6, baseX + lean * height * 0.32, baseY - height);
    ctx.stroke();
    var topX = baseX + lean * height * 0.32;
    var topY = baseY - height;
    for (var f = 0; f < 6; f++) {
      var ang = -Math.PI * (0.15 + f * 0.14) * lean;
      var len = height * 0.42;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(
        topX + Math.cos(ang) * len * 0.6, topY + Math.sin(ang) * len * 0.4 - len * 0.25,
        topX + Math.cos(ang) * len, topY + Math.sin(ang) * len + len * 0.28
      );
      ctx.lineWidth = Math.max(2, height * 0.018);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- layouts (fractions of canvas, gap 1.4% of width) ----------
  function panelRects(layout, w, h) {
    var g = 0.014;
    if (layout === 'strips') {
      var sw = (1 - 2 * g) / 3;
      return [
        { x: 0, y: 0, w: sw, h: 1 },
        { x: sw + g, y: 0, w: sw, h: 1 },
        { x: 2 * (sw + g), y: 0, w: sw, h: 1 }
      ];
    }
    if (layout === 'grid') {
      var qw = (1 - g) / 2, qh = (1 - g) / 2;
      return [
        { x: 0, y: 0, w: qw, h: qh },
        { x: qw + g, y: 0, w: qw, h: qh },
        { x: 0, y: qh + g, w: qw, h: qh },
        { x: qw + g, y: qh + g, w: qw, h: qh }
      ];
    }
    if (layout === 'single') {
      return [{ x: 0, y: 0, w: 1, h: 1 }];
    }
    // hero (default)
    var bw = (1 - g) / 2;
    return [
      { x: 0, y: 0, w: 1, h: 0.58 },
      { x: 0, y: 0.58 + g, w: bw, h: 1 - 0.58 - g },
      { x: bw + g, y: 0.58 + g, w: bw, h: 1 - 0.58 - g }
    ];
  }

  // ---------- state ----------
  var state = {
    layout: 'hero',
    grade: 'sunset',
    lettering: 'block',
    title: 'NEON SUNSET',
    tagline: 'A SUNSET STORY IN NEON',
    captionScale: 1,
    exportSize: '1920x1080',
    photos: [],
    panels: [
      { photo: null, zoom: 1, ox: 0, oy: 0 },
      { photo: null, zoom: 1, ox: 0, oy: 0 },
      { photo: null, zoom: 1, ox: 0, oy: 0 },
      { photo: null, zoom: 1, ox: 0, oy: 0 }
    ],
    selected: 0
  };
  var nextPhotoId = 1;

  var canvas = $('previewCanvas');
  var ctx = canvas.getContext('2d');

  function photoById(id) {
    for (var i = 0; i < state.photos.length; i++) {
      if (state.photos[i].id === id) return state.photos[i];
    }
    return null;
  }

  function exportDims() {
    var parts = state.exportSize.split('x');
    return { w: parseInt(parts[0], 10), h: parseInt(parts[1], 10) };
  }

  // ---------- rendering ----------
  function drawCover(c, w, h) {
    c.fillStyle = '#0d0714';
    c.fillRect(0, 0, w, h);
    var rects = panelRects(state.layout, w, h);
    var count = rects.length;

    for (var i = 0; i < count; i++) {
      var r = rects[i];
      var px = r.x * w, py = r.y * h, pw = r.w * w, ph = r.h * h;
      var panel = state.panels[i];
      c.save();
      c.beginPath();
      c.rect(px, py, pw, ph);
      c.clip();
      if (panel && panel.photo) {
        var photo = photoById(panel.photo);
        if (photo) {
          var iw = photo.img.naturalWidth || photo.img.width;
          var ih = photo.img.naturalHeight || photo.img.height;
          var scale = Math.max(pw / iw, ph / ih) * panel.zoom;
          var dw = iw * scale, dh = ih * scale;
          var dx = px + (pw - dw) / 2 + panel.ox * pw;
          var dy = py + (ph - dh) / 2 + panel.oy * ph;
          c.drawImage(photo.img, dx, dy, dw, dh);
          // Slight warm wash over photos.
          c.fillStyle = 'rgba(255, 126, 41, 0.08)';
          c.fillRect(px, py, pw, ph);
        } else {
          paintScene(c, px, py, pw, ph, PALETTE_NAMES[i % 3], 100 + i);
        }
      } else {
        paintScene(c, px, py, pw, ph, PALETTE_NAMES[i % 3], 100 + i);
        c.fillStyle = 'rgba(10, 5, 20, 0.45)';
        c.fillRect(px, py, pw, ph);
        c.fillStyle = 'rgba(245, 240, 255, 0.9)';
        c.font = '600 ' + Math.round(ph * 0.055) + 'px "Segoe UI", system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('Drop a photo here', px + pw / 2, py + ph / 2);
      }
      c.restore();
      // Frame; selected panel gets a thicker pink stroke.
      c.lineWidth = (i === state.selected) ? Math.max(3, w * 0.004) : 1.5;
      c.strokeStyle = (i === state.selected) ? '#ff2e88' : 'rgba(245, 240, 255, 0.55)';
      c.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    }

    // Colour grade over the whole cover.
    if (state.grade === 'noir') {
      c.save();
      c.globalCompositeOperation = 'saturation';
      c.fillStyle = '#808080';
      c.fillRect(0, 0, w, h);
      c.restore();
      var dark = c.createLinearGradient(0, 0, 0, h);
      dark.addColorStop(0, 'rgba(0,0,0,0.05)');
      dark.addColorStop(1, 'rgba(0,0,0,0.45)');
      c.fillStyle = dark;
      c.fillRect(0, 0, w, h);
    } else {
      var tint = c.createLinearGradient(0, 0, w, h);
      if (state.grade === 'sunset') {
        tint.addColorStop(0, 'rgba(255, 126, 41, 0.28)');
        tint.addColorStop(1, 'rgba(255, 46, 136, 0.28)');
      } else if (state.grade === 'neon') {
        tint.addColorStop(0, 'rgba(255, 46, 136, 0.25)');
        tint.addColorStop(0.5, 'rgba(120, 40, 200, 0.22)');
        tint.addColorStop(1, 'rgba(46, 230, 255, 0.25)');
      } else { // vice
        tint.addColorStop(0, 'rgba(255, 46, 136, 0.28)');
        tint.addColorStop(1, 'rgba(46, 230, 255, 0.25)');
      }
      c.save();
      c.globalCompositeOperation = 'overlay';
      c.fillStyle = tint;
      c.fillRect(0, 0, w, h);
      c.restore();
    }

    // Radial vignette.
    var vig = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = vig;
    c.fillRect(0, 0, w, h);

    drawCaption(c, w, h);
  }

  function drawCaption(c, w, h) {
    // Caption band fading in from 80% height.
    var band = c.createLinearGradient(0, h * 0.80, 0, h);
    band.addColorStop(0, 'rgba(10, 5, 20, 0)');
    band.addColorStop(1, 'rgba(10, 5, 20, 0.92)');
    c.fillStyle = band;
    c.fillRect(0, h * 0.80, w, h * 0.20);

    // Two neon divider lines at the band top.
    var lineY = h * 0.80;
    c.fillStyle = state.grade === 'noir' ? '#9a9aa8' : '#ff2e88';
    c.fillRect(0, lineY, w, 3);
    c.fillStyle = state.grade === 'noir' ? '#6a6a78' : '#2ee6ff';
    c.fillRect(0, lineY + 4, w, 2);

    // Faint black skyline silhouette strip behind the text.
    var rnd = seeded(99);
    c.fillStyle = 'rgba(0, 0, 0, 0.30)';
    var sx = 0;
    while (sx < w) {
      var bw2 = w * (0.03 + rnd() * 0.05);
      var bh2 = h * (0.02 + rnd() * 0.05);
      c.fillRect(sx, h * 0.86 - bh2, bw2, bh2);
      sx += bw2 + 2;
    }

    // Title.
    var size = h * 0.115 * state.captionScale;
    c.font = '900 ' + Math.round(size) + 'px "Arial Black", "Segoe UI", sans-serif';
    try { c.letterSpacing = Math.round(size * 0.06) + 'px'; } catch (e) { /* older canvas */ }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    var title = (state.title || '').toUpperCase();
    var ty = h * 0.885;
    if (state.lettering === 'outline') {
      c.lineWidth = Math.max(2, size * 0.045);
      c.strokeStyle = '#ffffff';
      c.shadowColor = '#2ee6ff';
      c.shadowBlur = size * 0.25;
      c.strokeText(title, w / 2, ty);
    } else if (state.lettering === 'neon') {
      c.lineWidth = Math.max(2, size * 0.04);
      c.strokeStyle = '#2ee6ff';
      c.shadowColor = '#2ee6ff';
      c.shadowBlur = size * 0.30;
      c.strokeText(title, w / 2, ty);
      c.shadowColor = '#ff2e88';
      c.shadowBlur = size * 0.20;
      c.fillStyle = '#ffffff';
      c.fillText(title, w / 2, ty);
    } else if (state.lettering === 'chrome') {
      var chrome = c.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
      chrome.addColorStop(0, '#ffffff');
      chrome.addColorStop(0.5, '#c9c9d6');
      chrome.addColorStop(1, '#f5f5ff');
      c.fillStyle = chrome;
      c.lineWidth = Math.max(2, size * 0.04);
      c.strokeStyle = 'rgba(20, 10, 30, 0.9)';
      c.shadowColor = 'rgba(0,0,0,0.5)';
      c.shadowBlur = size * 0.10;
      c.strokeText(title, w / 2, ty);
      c.fillText(title, w / 2, ty);
    } else { // block
      var block = c.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
      block.addColorStop(0, '#ffd166');
      block.addColorStop(0.55, '#ff7e29');
      block.addColorStop(1, '#ff2e88');
      c.fillStyle = block;
      c.lineWidth = Math.max(2, size * 0.045);
      c.strokeStyle = 'rgba(20, 5, 25, 0.9)';
      c.shadowColor = '#ff2e88';
      c.shadowBlur = size * 0.22;
      c.strokeText(title, w / 2, ty);
      c.fillText(title, w / 2, ty);
    }
    c.shadowBlur = 0;
    try { c.letterSpacing = '0px'; } catch (e) { /* ignore */ }

    // Tagline.
    var tagSize = Math.max(10, h * 0.022);
    c.font = '700 ' + Math.round(tagSize) + 'px "Segoe UI", system-ui, sans-serif';
    try { c.letterSpacing = Math.round(tagSize * 0.35) + 'px'; } catch (e) { /* ignore */ }
    c.fillStyle = state.grade === 'noir' ? '#d8d8e0' : '#ffd166';
    c.fillText((state.tagline || '').toUpperCase(), w / 2, h * 0.958);
    try { c.letterSpacing = '0px'; } catch (e) { /* ignore */ }
  }

  function render() {
    var dims = exportDims();
    canvas.width = 960;
    canvas.height = Math.round(960 * dims.h / dims.w);
    drawCover(ctx, canvas.width, canvas.height);
    syncPanelUI();
  }

  function syncPanelUI() {
    var panel = state.panels[state.selected] || { photo: null, zoom: 1 };
    var name = panel.photo ? (photoById(panel.photo) || {}).name || 'photo' : 'empty';
    $('panelStatus').textContent = 'Panel ' + (state.selected + 1) + ' — ' + name;
    var zoom = $('zoomRange');
    zoom.value = String(Math.round(panel.zoom * 100));
    $('zoomOut').textContent = Math.round(panel.zoom * 100) + '%';
  }

  // ---------- export ----------
  function exportPNG() {
    return new Promise(function (resolve) {
      var dims = exportDims();
      var off = document.createElement('canvas');
      off.width = dims.w;
      off.height = dims.h;
      drawCover(off.getContext('2d'), dims.w, dims.h);
      resolve(off.toDataURL('image/png'));
    });
  }

  function downloadExport() {
    exportPNG().then(function (url) {
      var a = document.createElement('a');
      a.href = url;
      a.download = 'cover-' + state.exportSize + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  // ---------- tray ----------
  function thumbFor(img) {
    var tw = 168;
    var th = Math.round(tw * (img.naturalHeight || img.height) / (img.naturalWidth || img.width));
    var c = document.createElement('canvas');
    c.width = tw;
    c.height = th || 112;
    c.getContext('2d').drawImage(img, 0, 0, tw, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }

  function rebuildTray() {
    var tray = $('tray');
    tray.innerHTML = '';
    var used = {};
    state.panels.forEach(function (p) { if (p.photo) used[p.photo] = true; });
    state.photos.forEach(function (photo) {
      var b = document.createElement('button');
      b.type = 'button';
      b.title = photo.name;
      if (used[photo.id]) b.className = 'used';
      var im = document.createElement('img');
      im.src = photo.thumb;
      im.alt = photo.name;
      b.appendChild(im);
      b.addEventListener('click', function () {
        assignPhoto(state.selected, photo.id);
      });
      tray.appendChild(b);
    });
    $('emptyTray').style.display = state.photos.length ? 'none' : '';
  }

  function addPhoto(img, name) {
    var photo = { id: nextPhotoId++, name: name, img: img, thumb: thumbFor(img) };
    state.photos.push(photo);
    // Fill the first empty panel.
    for (var i = 0; i < state.panels.length; i++) {
      if (!state.panels[i].photo) {
        state.panels[i].photo = photo.id;
        state.panels[i].zoom = 1;
        state.panels[i].ox = 0;
        state.panels[i].oy = 0;
        break;
      }
    }
    rebuildTray();
    render();
    return photo;
  }

  function assignPhoto(panelIndex, photoId) {
    var p = state.panels[panelIndex];
    if (!p) return;
    p.photo = photoId;
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
    rebuildTray();
    render();
  }

  function fillAllPanels() {
    if (!state.photos.length) return;
    var rects = panelRects(state.layout, 960, 540);
    for (var i = 0; i < rects.length; i++) {
      var photo = state.photos[i % state.photos.length];
      state.panels[i].photo = photo.id;
      state.panels[i].zoom = 1;
      state.panels[i].ox = 0;
      state.panels[i].oy = 0;
    }
    rebuildTray();
    render();
  }

  // ---------- samples ----------
  function makeSample(paletteName, seed) {
    var c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    paintScene(c.getContext('2d'), 0, 0, 1200, 800, paletteName, seed);
    return c;
  }

  function loadSamples() {
    // Drop any earlier samples, keep user photos out of the way by clearing all.
    state.photos = state.photos.filter(function (p) { return !p.sample; });
    var defs = [
      { name: 'Sunset Boulevard', palette: 'sunset', seed: 7 },
      { name: 'Neon Strip', palette: 'neon', seed: 21 },
      { name: 'Vice Nights', palette: 'vice', seed: 42 }
    ];
    defs.forEach(function (d) {
      var img = makeSample(d.palette, d.seed);
      var photo = { id: nextPhotoId++, name: d.name, img: img, thumb: thumbFor(img), sample: true };
      state.photos.push(photo);
    });
    fillAllPanels();
  }

  // ---------- segmented controls ----------
  function bindSeg(attr, onPick) {
    var btns = document.querySelectorAll('[data-' + attr + ']');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        onPick(b.getAttribute('data-' + attr));
      });
    });
  }

  function setGrade(name) {
    if (GRADES.indexOf(name) === -1) return;
    state.grade = name;
    document.querySelectorAll('[data-grade]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-grade') === name);
    });
    render();
  }

  // ---------- pointer + wheel ----------
  function panelAt(clientX, clientY) {
    var box = canvas.getBoundingClientRect();
    var x = (clientX - box.left) / box.width;
    var y = (clientY - box.top) / box.height;
    var rects = panelRects(state.layout, 1, 1);
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  }

  var dragging = false;
  var lastX = 0, lastY = 0;

  canvas.addEventListener('pointerdown', function (e) {
    var idx = panelAt(e.clientX, e.clientY);
    if (idx === -1) return;
    state.selected = idx;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    render();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var panel = state.panels[state.selected];
    if (!panel || !panel.photo) return;
    var box = canvas.getBoundingClientRect();
    var rects = panelRects(state.layout, 1, 1);
    var r = rects[state.selected];
    panel.ox = clamp(panel.ox + (e.clientX - lastX) / (box.width * r.w), -0.6, 0.6);
    panel.oy = clamp(panel.oy + (e.clientY - lastY) / (box.height * r.h), -0.6, 0.6);
    lastX = e.clientX;
    lastY = e.clientY;
    render();
  });

  function endDrag() { dragging = false; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var idx = panelAt(e.clientX, e.clientY);
    if (idx === -1) return;
    state.selected = idx;
    var panel = state.panels[idx];
    if (!panel || !panel.photo) return;
    panel.zoom = clamp(panel.zoom * Math.exp(-e.deltaY * 0.0012), 1, 3);
    render();
  }, { passive: false });

  // ---------- wiring ----------
  bindSeg('layout', function (v) {
    state.layout = v;
    state.selected = 0;
    render();
  });
  bindSeg('lettering', function (v) {
    state.lettering = v;
    render();
  });
  bindSeg('grade', function (v) { setGrade(v); });

  $('titleInput').addEventListener('input', function (e) {
    state.title = e.target.value;
    render();
  });
  $('taglineInput').addEventListener('input', function (e) {
    state.tagline = e.target.value;
    render();
  });
  $('titleSize').addEventListener('input', function (e) {
    state.captionScale = parseInt(e.target.value, 10) / 100;
    $('titleSizeOut').textContent = e.target.value + '%';
    render();
  });
  $('zoomRange').addEventListener('input', function (e) {
    var panel = state.panels[state.selected];
    if (!panel) return;
    panel.zoom = parseInt(e.target.value, 10) / 100;
    $('zoomOut').textContent = e.target.value + '%';
    render();
  });
  $('sizeSelect').addEventListener('change', function (e) {
    state.exportSize = e.target.value;
    render();
  });

  $('loadSamplesBtn').addEventListener('click', loadSamples);
  $('fillAllBtn').addEventListener('click', fillAllPanels);
  $('resetCropBtn').addEventListener('click', function () {
    var panel = state.panels[state.selected];
    if (!panel) return;
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
    render();
  });
  $('removePhotoBtn').addEventListener('click', function () {
    var panel = state.panels[state.selected];
    if (!panel) return;
    panel.photo = null;
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
    rebuildTray();
    render();
  });
  $('exportBtn').addEventListener('click', downloadExport);

  $('fileInput').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () { addPhoto(img, file.name); };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      downloadExport();
      return;
    }
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) setGrade(GRADES[n - 1]);
  });

  // ---------- test hook ----------
  window.__coverStudio = {
    state: state,
    render: render,
    exportPNG: exportPNG,
    loadSamples: loadSamples,
    setGrade: setGrade
  };

  rebuildTray();
  render();
})();
