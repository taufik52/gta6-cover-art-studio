/*
 * Vice City Cover Studio — all of the editor logic.
 * One plain classic script, no modules, no network requests.
 * Everything runs locally: photos are read on this machine and
 * never leave the page.
 */
(function () {
  "use strict";

  /* ---------- tiny helpers ---------- */

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }

  // Seeded random generator (linear congruential) so the procedural
  // artwork is the same every time for the same seed.
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ---------- layouts, grades, palettes ---------- */

  // Gap between panels: 1.4 percent of the canvas size.
  var GAP_FRAC = 0.014;

  // Panel rectangles as fractions of the canvas: [x, y, width, height].
  var LAYOUTS = {
    hero: [
      [0, 0, 1, 0.58],
      [0, 0.58, 0.5, 0.42],
      [0.5, 0.58, 0.5, 0.42],
    ],
    strips: [
      [0, 0, 1 / 3, 1],
      [1 / 3, 0, 1 / 3, 1],
      [2 / 3, 0, 1 / 3, 1],
    ],
    grid: [
      [0, 0, 0.5, 0.5],
      [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
    ],
    single: [[0, 0, 1, 1]],
  };

  var GRADES = ["sunset", "neon", "vice", "noir"];

  // Palettes for the procedural sunset-city scenes.
  var PALETTES = {
    sunset: {
      sky: ["#3b0f5e", "#7b1e6e", "#c33a7a", "#ff6b4a", "#ffb347"],
      sun: "#ffe9a8",
      building: "#241031",
      window: "#ffd166",
      beacon: "#ff2e88",
      ground: "#160a24",
      streak: "rgba(255, 120, 90, 0.35)",
    },
    neon: {
      sky: ["#040b33", "#141052", "#57208a", "#c22a8a", "#19d3ff"],
      sun: "#b8fff4",
      building: "#070614",
      window: "#2ee6ff",
      beacon: "#ff2e88",
      ground: "#05030f",
      streak: "rgba(46, 230, 255, 0.35)",
    },
    vice: {
      sky: ["#2a0a4a", "#6d1a6e", "#c22a72", "#ff7a3d", "#ffd166"],
      sun: "#fff3c4",
      building: "#1c0a2e",
      window: "#ff9a3d",
      beacon: "#ff5e78",
      ground: "#12061f",
      streak: "rgba(255, 154, 61, 0.35)",
    },
  };

  /* ---------- state ---------- */

  function freshPanel() {
    return { photo: null, zoom: 1, ox: 0, oy: 0 };
  }

  var state = {
    layout: "hero",
    grade: "sunset",
    lettering: "block",
    caption: "NEON SUNSET",
    tagline: "A SUNSET STORY IN NEON",
    captionScale: 1,
    exportSize: "1920x1080",
    photos: [],
    nextPhotoId: 1,
    panels: [freshPanel(), freshPanel(), freshPanel(), freshPanel()],
    selected: 0,
  };

  var canvas = $("previewCanvas");
  var ctx = canvas.getContext("2d");

  function panelCount() {
    return LAYOUTS[state.layout].length;
  }

  function photoById(id) {
    for (var i = 0; i < state.photos.length; i++) {
      if (state.photos[i].id === id) return state.photos[i];
    }
    return null;
  }

  function panelRects(w, h) {
    var gap = GAP_FRAC * w;
    var half = gap / 2;
    return LAYOUTS[state.layout].map(function (f) {
      return {
        x: f[0] * w + half,
        y: f[1] * h + half,
        w: f[2] * w - gap,
        h: f[3] * h - gap,
      };
    });
  }

  /* ---------- procedural sunset-city painter ---------- */

  // Paints a retro sunset cityscape inside the given rectangle.
  function paintScene(c, x, y, w, h, paletteName, seed) {
    var pal = PALETTES[paletteName] || PALETTES.sunset;
    var rng = makeRng(seed);
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.translate(x, y);

    // Sky: five-stop vertical gradient.
    var sky = c.createLinearGradient(0, 0, 0, h);
    for (var i = 0; i < pal.sky.length; i++) {
      sky.addColorStop(i / (pal.sky.length - 1), pal.sky[i]);
    }
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    // Retro sun, low over the horizon, striped across its lower half.
    var cx = w * 0.5;
    var cy = h * 0.6;
    var r = Math.min(w, h) * 0.24;
    var glow = c.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.4);
    glow.addColorStop(0, pal.sun);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.globalAlpha = 0.45;
    c.fillStyle = glow;
    c.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);
    c.globalAlpha = 1;
    c.save();
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.clip();
    var band = r * 0.16;
    var row = 0;
    for (var sy = cy - r; sy < cy + r; sy += band, row++) {
      // Skip every other band below the middle: the stripes.
      if (sy > cy && row % 2 === 1) continue;
      c.fillStyle = pal.sun;
      c.fillRect(cx - r, sy, r * 2, band * 0.92);
    }
    c.restore();

    // Skyline of dark buildings with lit windows.
    var horizon = h * 0.78;
    var bx = 0;
    while (bx < w) {
      var bw = w * (0.05 + rng() * 0.08);
      var bh = h * (0.14 + rng() * 0.26);
      var top = horizon - bh;
      c.fillStyle = pal.building;
      c.fillRect(bx, top, bw, bh);
      // Lit windows in a loose grid.
      c.fillStyle = pal.window;
      var cols = Math.max(1, Math.floor(bw / (w * 0.022)));
      var rows = Math.max(1, Math.floor(bh / (h * 0.05)));
      for (var wx = 0; wx < cols; wx++) {
        for (var wy = 0; wy < rows; wy++) {
          if (rng() < 0.45) {
            c.globalAlpha = 0.5 + rng() * 0.5;
            c.fillRect(
              bx + w * 0.008 + wx * (bw / cols),
              top + h * 0.02 + wy * (bh / rows),
              Math.max(2, w * 0.008),
              Math.max(2, h * 0.014)
            );
          }
        }
      }
      c.globalAlpha = 1;
      // A few rooftops carry an antenna with a glowing beacon dot.
      if (rng() < 0.35) {
        var ax = bx + bw / 2;
        c.strokeStyle = pal.building;
        c.lineWidth = Math.max(1, w * 0.003);
        c.beginPath();
        c.moveTo(ax, top);
        c.lineTo(ax, top - h * 0.06);
        c.stroke();
        c.fillStyle = pal.beacon;
        c.beginPath();
        c.arc(ax, top - h * 0.065, Math.max(2, w * 0.005), 0, Math.PI * 2);
        c.fill();
      }
      bx += bw + w * 0.006;
    }

    // Dark foreground band with translucent light streaks.
    c.fillStyle = pal.ground;
    c.fillRect(0, horizon, w, h - horizon);
    c.fillStyle = pal.streak;
    for (var s = 0; s < 5; s++) {
      var sy2 = horizon + rng() * (h - horizon) * 0.85;
      c.globalAlpha = 0.12 + rng() * 0.2;
      c.fillRect(0, sy2, w, Math.max(1, h * 0.008));
    }
    c.globalAlpha = 1;

    // Palm silhouettes at the edges: a curved trunk, six arching fronds.
    drawPalm(c, w * 0.045, h, -1, h, pal.building, rng);
    drawPalm(c, w * 0.955, h, 1, h, pal.building, rng);

    c.restore();
  }

  function drawPalm(c, baseX, baseY, lean, h, color, rng) {
    var topX = baseX + lean * h * 0.05;
    var topY = h * 0.52;
    c.strokeStyle = color;
    c.lineWidth = Math.max(2, h * 0.012);
    c.lineCap = "round";
    // Curved trunk.
    c.beginPath();
    c.moveTo(baseX, baseY);
    c.quadraticCurveTo(baseX + lean * h * 0.02, h * 0.75, topX, topY);
    c.stroke();
    // Six arching fronds.
    c.lineWidth = Math.max(1.5, h * 0.008);
    for (var f = 0; f < 6; f++) {
      var ang = Math.PI * (0.08 + (f / 5) * 0.84);
      var dir = lean > 0 ? 1 : -1;
      var spread = (f - 2.5) / 2.5;
      var tipX = topX + dir * Math.cos(ang) * h * 0.16 + spread * h * 0.05;
      var tipY = topY - Math.sin(ang) * h * 0.1 + Math.abs(spread) * h * 0.05;
      var midX = topX + dir * Math.cos(ang) * h * 0.09;
      var midY = topY - Math.sin(ang) * h * 0.09;
      c.beginPath();
      c.moveTo(topX, topY);
      c.quadraticCurveTo(midX, midY, tipX, tipY);
      c.stroke();
    }
    void rng;
  }

  /* ---------- sample photos ---------- */

  var SAMPLE_DEFS = [
    { name: "Sunset Boulevard", palette: "sunset", seed: 7 },
    { name: "Neon Strip", palette: "neon", seed: 21 },
    { name: "Vice Nights", palette: "vice", seed: 42 },
  ];

  function makeThumb(img, iw, ih) {
    var tw = 168;
    var th = Math.max(60, Math.round((168 * ih) / iw));
    var t = document.createElement("canvas");
    t.width = tw;
    t.height = th;
    t.getContext("2d").drawImage(img, 0, 0, tw, th);
    return t.toDataURL("image/jpeg", 0.85);
  }

  function addPhoto(img, name, isSample) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var photo = {
      id: state.nextPhotoId++,
      name: name,
      img: img,
      thumb: makeThumb(img, iw, ih),
      sample: !!isSample,
    };
    state.photos.push(photo);
    // A new photo fills the first empty panel it can.
    for (var i = 0; i < panelCount(); i++) {
      if (!state.panels[i].photo) {
        state.panels[i].photo = photo.id;
        state.panels[i].zoom = 1;
        state.panels[i].ox = 0;
        state.panels[i].oy = 0;
        break;
      }
    }
    return photo;
  }

  function loadSamples() {
    // Drop any earlier samples, then paint three fresh scenes.
    state.photos = state.photos.filter(function (p) {
      return !p.sample;
    });
    state.panels.forEach(function (panel) {
      if (panel.photo) {
        var p = photoById(panel.photo);
        if (p && p.sample) panel.photo = null;
      }
    });
    var made = SAMPLE_DEFS.map(function (def) {
      var scene = document.createElement("canvas");
      scene.width = 1200;
      scene.height = 800;
      paintScene(scene.getContext("2d"), 0, 0, 1200, 800, def.palette, def.seed);
      return addPhoto(scene, def.name, true);
    });
    // Fill every panel with the samples in rotation, crop reset.
    for (var i = 0; i < panelCount(); i++) {
      state.panels[i].photo = made[i % made.length].id;
      state.panels[i].zoom = 1;
      state.panels[i].ox = 0;
      state.panels[i].oy = 0;
    }
    rebuildTray();
    renderPreview();
  }

  /* ---------- rendering ---------- */

  function drawPhotoCover(c, panel, img, rect) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var scale = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = rect.x + (rect.w - dw) / 2 + panel.ox * rect.w;
    var dy = rect.y + (rect.h - dh) / 2 + panel.oy * rect.h;
    c.drawImage(img, dx, dy, dw, dh);
    // Slight warm wash, the sunset-postcard feel.
    c.fillStyle = "rgba(255, 140, 60, 0.08)";
    c.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  function renderScene(c, w, h) {
    c.fillStyle = "#0d0714";
    c.fillRect(0, 0, w, h);

    var rects = panelRects(w, h);
    var paletteCycle = ["sunset", "neon", "vice"];

    rects.forEach(function (rect, i) {
      var panel = state.panels[i];
      c.save();
      c.beginPath();
      c.rect(rect.x, rect.y, rect.w, rect.h);
      c.clip();
      var photo = panel.photo ? photoById(panel.photo) : null;
      if (photo) {
        drawPhotoCover(c, panel, photo.img, rect);
      } else {
        // Empty panel: a procedural placeholder scene under a veil.
        paintScene(
          c,
          rect.x,
          rect.y,
          rect.w,
          rect.h,
          paletteCycle[i % paletteCycle.length],
          100 + i
        );
        c.fillStyle = "rgba(10, 6, 20, 0.45)";
        c.fillRect(rect.x, rect.y, rect.w, rect.h);
        c.fillStyle = "rgba(255, 255, 255, 0.9)";
        c.font =
          "700 " +
          Math.max(13, Math.round(rect.h * 0.07)) +
          'px "Segoe UI", Arial, sans-serif';
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("Drop a photo here", rect.x + rect.w / 2, rect.y + rect.h / 2);
      }
      c.restore();

      // Light frame; the selected panel gets a pink stroke.
      c.lineWidth = Math.max(2, w * 0.002);
      c.strokeStyle =
        i === state.selected ? "#ff2e88" : "rgba(255, 255, 255, 0.28)";
      if (i === state.selected) c.lineWidth = Math.max(3, w * 0.004);
      c.strokeRect(rect.x, rect.y, rect.w, rect.h);
    });

    // Colour grade over the whole cover.
    if (state.grade === "noir") {
      c.save();
      c.globalCompositeOperation = "saturation";
      c.fillStyle = "#808080";
      c.fillRect(0, 0, w, h);
      c.restore();
      var shade = c.createLinearGradient(0, 0, 0, h);
      shade.addColorStop(0, "rgba(0, 0, 0, 0.18)");
      shade.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      c.fillStyle = shade;
      c.fillRect(0, 0, w, h);
    } else {
      var tint = c.createLinearGradient(0, 0, w, h);
      if (state.grade === "sunset") {
        tint.addColorStop(0, "rgba(255, 120, 40, 0.26)");
        tint.addColorStop(1, "rgba(255, 60, 140, 0.26)");
      } else if (state.grade === "neon") {
        tint.addColorStop(0, "rgba(255, 46, 136, 0.24)");
        tint.addColorStop(0.5, "rgba(128, 40, 200, 0.2)");
        tint.addColorStop(1, "rgba(46, 230, 255, 0.24)");
      } else {
        tint.addColorStop(0, "rgba(255, 46, 120, 0.24)");
        tint.addColorStop(1, "rgba(46, 230, 255, 0.22)");
      }
      c.save();
      c.globalCompositeOperation = "overlay";
      c.fillStyle = tint;
      c.fillRect(0, 0, w, h);
      c.restore();
    }

    // Radial vignette darkening the corners.
    var vig = c.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.45,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75
    );
    vig.addColorStop(0, "rgba(0, 0, 0, 0)");
    vig.addColorStop(1, "rgba(0, 0, 0, 0.42)");
    c.fillStyle = vig;
    c.fillRect(0, 0, w, h);

    renderCaption(c, w, h);
  }

  function renderCaption(c, w, h) {
    var noir = state.grade === "noir";
    var bandTop = h * 0.8;
    var band = c.createLinearGradient(0, bandTop, 0, h);
    band.addColorStop(0, "rgba(8, 4, 18, 0)");
    band.addColorStop(1, "rgba(8, 4, 18, 0.92)");
    c.fillStyle = band;
    c.fillRect(0, bandTop, w, h - bandTop);

    // Neon divider lines at the top of the band.
    c.fillStyle = noir ? "#cfcfcf" : "#ff2e88";
    c.fillRect(0, bandTop, w, Math.max(2, h * 0.006));
    c.fillStyle = noir ? "#8a8a8a" : "#2ee6ff";
    c.fillRect(0, bandTop + h * 0.012, w, Math.max(1, h * 0.0025));

    // Faint black skyline silhouette strip behind the text.
    var rng = makeRng(99);
    c.fillStyle = "rgba(0, 0, 0, 0.35)";
    var sx = 0;
    while (sx < w) {
      var bw = w * (0.04 + rng() * 0.07);
      var bh = h * (0.02 + rng() * 0.05);
      c.fillRect(sx, bandTop + h * 0.2 - bh, bw, bh);
      sx += bw + w * 0.01;
    }

    // Title in a heavy black sans face.
    var size = h * 0.115 * state.captionScale;
    c.save();
    c.font = '900 ' + Math.round(size) + 'px "Arial Black", Impact, sans-serif';
    try {
      c.letterSpacing = Math.round(size * 0.06) + "px";
    } catch (e) {}
    c.textAlign = "center";
    c.textBaseline = "middle";
    var title = (state.caption || "NEON SUNSET").toUpperCase();
    var titleY = h * 0.885;

    if (state.lettering === "block") {
      var grad = c.createLinearGradient(0, titleY - size / 2, 0, titleY + size / 2);
      grad.addColorStop(0, "#ffe259");
      grad.addColorStop(0.5, "#ff7e29");
      grad.addColorStop(1, "#ff2e88");
      c.shadowColor = "#ff2e88";
      c.shadowBlur = size * 0.25;
      c.strokeStyle = "#1a0b1e";
      c.lineWidth = size * 0.09;
      c.lineJoin = "round";
      c.strokeText(title, w / 2, titleY);
      c.fillStyle = grad;
      c.fillText(title, w / 2, titleY);
    } else if (state.lettering === "outline") {
      c.shadowColor = "#2ee6ff";
      c.shadowBlur = size * 0.3;
      c.strokeStyle = "#ffffff";
      c.lineWidth = size * 0.045;
      c.lineJoin = "round";
      c.strokeText(title, w / 2, titleY);
    } else if (state.lettering === "neon") {
      c.shadowColor = "#2ee6ff";
      c.shadowBlur = size * 0.3;
      c.strokeStyle = "#37e6ff";
      c.lineWidth = size * 0.03;
      c.lineJoin = "round";
      c.strokeText(title, w / 2, titleY);
      c.shadowColor = "#ff2e88";
      c.shadowBlur = size * 0.35;
      c.fillStyle = "#ffffff";
      c.fillText(title, w / 2, titleY);
    } else {
      // chrome
      var chrome = c.createLinearGradient(0, titleY - size / 2, 0, titleY + size / 2);
      chrome.addColorStop(0, "#dfe3ea");
      chrome.addColorStop(0.45, "#ffffff");
      chrome.addColorStop(0.55, "#9aa2b0");
      chrome.addColorStop(1, "#f4f6f8");
      c.strokeStyle = "#14101c";
      c.lineWidth = size * 0.05;
      c.lineJoin = "round";
      c.strokeText(title, w / 2, titleY);
      c.fillStyle = chrome;
      c.fillText(title, w / 2, titleY);
    }
    c.restore();

    // Tagline in small bold widely-spaced capitals near the bottom.
    c.save();
    c.font =
      "700 " + Math.round(h * 0.028) + 'px "Segoe UI", Arial, sans-serif';
    try {
      c.letterSpacing = Math.round(h * 0.012) + "px";
    } catch (e) {}
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = noir ? "#d8d8d8" : "#ffd166";
    c.fillText(
      (state.tagline || "").toUpperCase(),
      w / 2,
      h * 0.958
    );
    c.restore();
  }

  function renderPreview() {
    var parts = state.exportSize.split("x");
    var ew = parseInt(parts[0], 10);
    var eh = parseInt(parts[1], 10);
    canvas.width = 960;
    canvas.height = Math.round((960 * eh) / ew);
    renderScene(ctx, canvas.width, canvas.height);
    syncPanelUI();
  }

  function syncPanelUI() {
    var panel = state.panels[state.selected];
    var photo = panel.photo ? photoById(panel.photo) : null;
    $("panelStatus").textContent =
      "Panel " +
      (state.selected + 1) +
      " of " +
      panelCount() +
      " — " +
      (photo ? photo.name : "no photo yet") +
      ".";
    var zoomPct = Math.round(panel.zoom * 100);
    $("zoomSlider").value = String(zoomPct);
    $("zoomVal").textContent = zoomPct + "%";
  }

  /* ---------- export ---------- */

  function exportDataURL() {
    return new Promise(function (resolve) {
      var parts = state.exportSize.split("x");
      var ew = parseInt(parts[0], 10);
      var eh = parseInt(parts[1], 10);
      var off = document.createElement("canvas");
      off.width = ew;
      off.height = eh;
      renderScene(off.getContext("2d"), ew, eh);
      resolve(off.toDataURL("image/png"));
    });
  }

  function exportPNG() {
    var parts = state.exportSize.split("x");
    var ew = parseInt(parts[0], 10);
    var eh = parseInt(parts[1], 10);
    var off = document.createElement("canvas");
    off.width = ew;
    off.height = eh;
    renderScene(off.getContext("2d"), ew, eh);
    off.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "cover-" + state.exportSize + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 4000);
    }, "image/png");
  }

  /* ---------- tray ---------- */

  function rebuildTray() {
    var tray = $("tray");
    tray.innerHTML = "";
    state.photos.forEach(function (photo) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "thumb";
      btn.title = photo.name;
      var used = state.panels.some(function (p) {
        return p.photo === photo.id;
      });
      if (used) btn.classList.add("used");
      var img = document.createElement("img");
      img.src = photo.thumb;
      img.alt = photo.name;
      btn.appendChild(img);
      btn.addEventListener("click", function () {
        var panel = state.panels[state.selected];
        panel.photo = photo.id;
        panel.zoom = 1;
        panel.ox = 0;
        panel.oy = 0;
        rebuildTray();
        renderPreview();
      });
      tray.appendChild(btn);
    });
    $("emptyTray").style.display = state.photos.length ? "none" : "";
  }

  /* ---------- file input ---------- */

  $("fileInput").addEventListener("change", function (event) {
    var files = Array.prototype.slice.call(event.target.files || []);
    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          addPhoto(img, file.name || "Photo");
          rebuildTray();
          renderPreview();
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  });

  /* ---------- buttons ---------- */

  $("loadSamplesBtn").addEventListener("click", loadSamples);

  $("fillAllBtn").addEventListener("click", function () {
    if (!state.photos.length) return;
    for (var i = 0; i < panelCount(); i++) {
      state.panels[i].photo = state.photos[i % state.photos.length].id;
      state.panels[i].zoom = 1;
      state.panels[i].ox = 0;
      state.panels[i].oy = 0;
    }
    rebuildTray();
    renderPreview();
  });

  $("resetCropBtn").addEventListener("click", function () {
    var panel = state.panels[state.selected];
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
    renderPreview();
  });

  $("removePhotoBtn").addEventListener("click", function () {
    state.panels[state.selected].photo = null;
    rebuildTray();
    renderPreview();
  });

  $("exportBtn").addEventListener("click", exportPNG);

  /* ---------- segmented controls ---------- */

  function wireSeg(id, attr, onPick) {
    var seg = $(id);
    seg.addEventListener("click", function (event) {
      var btn = event.target.closest("button");
      if (!btn) return;
      var value = btn.getAttribute(attr);
      if (!value) return;
      Array.prototype.forEach.call(seg.querySelectorAll("button"), function (b) {
        b.classList.toggle("active", b === btn);
      });
      onPick(value);
    });
  }

  wireSeg("layoutSeg", "data-layout", function (value) {
    state.layout = value;
    state.selected = 0;
    renderPreview();
  });

  wireSeg("letteringSeg", "data-lettering", function (value) {
    state.lettering = value;
    renderPreview();
  });

  wireSeg("gradeSeg", "data-grade", function (value) {
    setGrade(value);
  });

  function setGrade(name) {
    if (GRADES.indexOf(name) === -1) return;
    state.grade = name;
    Array.prototype.forEach.call(
      $("gradeSeg").querySelectorAll("button"),
      function (b) {
        b.classList.toggle("active", b.getAttribute("data-grade") === name);
      }
    );
    renderPreview();
  }

  /* ---------- text and slider inputs ---------- */

  $("titleInput").addEventListener("input", function (event) {
    state.caption = event.target.value;
    renderPreview();
  });

  $("taglineInput").addEventListener("input", function (event) {
    state.tagline = event.target.value;
    renderPreview();
  });

  $("titleSize").addEventListener("input", function (event) {
    state.captionScale = parseInt(event.target.value, 10) / 100;
    $("titleSizeVal").textContent = event.target.value + "%";
    renderPreview();
  });

  $("zoomSlider").addEventListener("input", function (event) {
    state.panels[state.selected].zoom = parseInt(event.target.value, 10) / 100;
    $("zoomVal").textContent = event.target.value + "%";
    renderPreview();
  });

  $("sizeSelect").addEventListener("change", function (event) {
    state.exportSize = event.target.value;
    renderPreview();
  });

  /* ---------- keyboard ---------- */

  document.addEventListener("keydown", function (event) {
    var tag = (event.target && event.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
      event.preventDefault();
      exportPNG();
      return;
    }
    var gradeIndex = ["1", "2", "3", "4"].indexOf(event.key);
    if (gradeIndex !== -1) setGrade(GRADES[gradeIndex]);
  });

  /* ---------- pointer: select, drag to pan, wheel to zoom ---------- */

  var dragging = false;
  var lastX = 0;
  var lastY = 0;

  function canvasPoint(event) {
    var box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * canvas.width,
      y: ((event.clientY - box.top) / box.height) * canvas.height,
    };
  }

  canvas.addEventListener("pointerdown", function (event) {
    var pt = canvasPoint(event);
    var rects = panelRects(canvas.width, canvas.height);
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
        state.selected = i;
        break;
      }
    }
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
    renderPreview();
  });

  canvas.addEventListener("pointermove", function (event) {
    if (!dragging) return;
    var box = canvas.getBoundingClientRect();
    var rects = panelRects(canvas.width, canvas.height);
    var rect = rects[state.selected];
    if (!rect) return;
    var panel = state.panels[state.selected];
    if (!panel.photo) return;
    var dx = ((event.clientX - lastX) / box.width) * canvas.width;
    var dy = ((event.clientY - lastY) / box.height) * canvas.height;
    panel.ox = clamp(panel.ox + dx / rect.w, -0.6, 0.6);
    panel.oy = clamp(panel.oy + dy / rect.h, -0.6, 0.6);
    lastX = event.clientX;
    lastY = event.clientY;
    renderPreview();
  });

  function endDrag() {
    dragging = false;
    canvas.style.cursor = "";
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener(
    "wheel",
    function (event) {
      event.preventDefault();
      // Zoom the panel under the cursor (and select it), not just the
      // one selected earlier, so scrolling over any panel just works.
      var pt = canvasPoint(event);
      var rects = panelRects(canvas.width, canvas.height);
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
          state.selected = i;
          break;
        }
      }
      var panel = state.panels[state.selected];
      if (!panel.photo) return;
      panel.zoom = clamp(
        panel.zoom * Math.exp(-event.deltaY * 0.0012),
        1,
        3
      );
      renderPreview();
    },
    { passive: false }
  );

  /* ---------- test hook for the screenshot script ---------- */

  window.__coverStudio = {
    state: state,
    render: renderPreview,
    exportPNG: exportDataURL,
    loadSamples: loadSamples,
    setGrade: setGrade,
  };

  renderPreview();
})();
