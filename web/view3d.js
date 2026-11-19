// Haqiqiy 3D ko'rinish (Three.js). Majmuadagi 1–3 ta uyni parametrlar va kataklardan yig'adi.
// CDN'dan Three.js yuklanmasa yoki WebGL bo'lmasa, konstruktor eski SVG izometriyaga qaytadi.
(function () {
  "use strict";

  const hasGL = (() => {
    try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); }
    catch { return false; }
  })();
  if (typeof THREE === "undefined" || !hasGL) {
    window.View3D = { ready: () => false, update() {}, updateSite() {}, rise() {}, onPick: null };
    return;
  }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const T = 0.35;                 // devor qalinligi, m
  const TILE = 1.2;               // naqsh (g'isht, koshin) takrorlanish o'lchami, m
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = k => 1 - Math.pow(1 - k, 3);

  let host, renderer, scene, camera, canvas, group, sun, hemi, bar;
  let mounted = false, failed = false, visible = true;
  let theta = -0.65, phi = 1.12, zoom = 1, tTheta = theta, tPhi = phi;
  let auto = false, baseDist = 40, riseStart = 0, raf = 0, last = 0, buildTimer = 0, lastArgs = null, builtSig = "";
  let plates = [], labels = [], bGroups = [], activeIdx = 0, accentCss = "rgb(43,74,203)";
  let lastLayout = [], vrGround = null;     // uylar joylashuvi (VR to'qnashuvi uchun) va VR dagi keng yer sathi
  const center = new THREE.Vector3();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const disposables = [];
  const track = o => { disposables.push(o); return o; };
  // Ichki pardoz teksturalari (bir marta yasaladi, hamma sahnada qayta ishlatiladi): parket pol va suvoq devor.
  // Anizotropik filtr — qiya qaralganda ham pol tiniq ko'rinadi.
  let texCache = null, lampBudget = 0;
  function interiorTex() {
    if (texCache || !renderer) return texCache;
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const rnd = (s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646)(7);
    const mkTex = (size, draw, rep) => {
      const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = aniso; return t;
    };
    texCache = {
      parquet: mkTex(1024, (x, n) => {                                // 2 × 2 m: 10 qator taxta, har biri o'z tusi va tolalari bilan
        const rows = 10, h = n / rows;
        for (let r = 0; r < rows; r++) {
          let off = -rnd() * n * 0.5;
          while (off < n) {
            const L = n * (0.35 + rnd() * 0.3), tone = 150 + rnd() * 40;
            x.fillStyle = `rgb(${tone + 40 | 0},${tone + 8 | 0},${tone - 35 | 0})`; x.fillRect(off, r * h, L, h);
            x.strokeStyle = "rgba(60,35,15,.13)"; x.lineWidth = 1.2;
            for (let g = 0; g < 7; g++) { const y = r * h + 3 + rnd() * (h - 6); x.beginPath(); x.moveTo(off, y); x.bezierCurveTo(off + L * 0.3, y + rnd() * 6 - 3, off + L * 0.6, y + rnd() * 6 - 3, off + L, y); x.stroke(); }
            x.fillStyle = "rgba(40,22,8,.5)"; x.fillRect(off, r * h, 2, h);
            off += L;
          }
          x.fillStyle = "rgba(40,22,8,.42)"; x.fillRect(0, r * h, n, 2);
        }
      }, 0.5),
      plaster: mkTex(512, (x, n) => {                                  // yengil donador suvoq
        const im = x.createImageData(n, n), d = im.data;
        for (let i = 0; i < d.length; i += 4) { const v = 238 + rnd() * 17; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        x.putImageData(im, 0, 0);
      }, 1),
    };
    return texCache;
  }
  // Ichki pardoz turlari (3D ichki dizayn): pol qoplamalari va mebel yuzalari. Kerak bo'lganda bir marta chiziladi.
  // ShapeGeometry UV'lari metrda: rep = 1 / naqsh qoplaydigan o'lcham (m)
  function canvasTex(size, draw, rep) {
    const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
    t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1; return t;
  }
  const FLOOR_LOOK = { parket: 0.55, laminat: 0.45, koshin: 0.22, marmar: 0.1, beton: 0.8, gilam: 1 };
  function floorTex(kind) {
    const T0 = interiorTex(); if (!T0) return null;
    if (kind === "parket" || !FLOOR_LOOK[kind]) return T0.parquet;
    if (T0[kind]) return T0[kind];
    const rnd = seeded(kind.length * 977 + 13);
    const draw = {
      laminat: (x, n) => {                                             // 2 m: uzun och taxtalar
        const rows = 8, h = n / rows;
        for (let r = 0; r < rows; r++) {
          let off = -rnd() * n * 0.6;
          while (off < n) {
            const L = n * (0.55 + rnd() * 0.25), tone = 196 + rnd() * 26;
            x.fillStyle = `rgb(${tone | 0},${tone - 22 | 0},${tone - 52 | 0})`; x.fillRect(off, r * h, L, h);
            x.strokeStyle = "rgba(90,60,30,.10)"; x.lineWidth = 1;
            for (let g = 0; g < 5; g++) { const y = r * h + 2 + rnd() * (h - 4); x.beginPath(); x.moveTo(off, y); x.lineTo(off + L, y + rnd() * 4 - 2); x.stroke(); }
            x.fillStyle = "rgba(60,40,20,.35)"; x.fillRect(off, r * h, 1.5, h); off += L;
          }
          x.fillStyle = "rgba(60,40,20,.3)"; x.fillRect(0, r * h, n, 1.5);
        }
      },
      koshin: (x, n) => {                                              // 1,2 m: 60×60 sm koshin, oq chok
        x.fillStyle = "#cfcac0"; x.fillRect(0, 0, n, n);
        const c = n / 2;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
          const tone = 214 + rnd() * 14; x.fillStyle = `rgb(${tone | 0},${tone - 6 | 0},${tone - 14 | 0})`; x.fillRect(i * c + 3, j * c + 3, c - 6, c - 6);
          for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(${rnd() > 0.5 ? "255,255,255" : "120,110,95"},.08)`; x.fillRect(i * c + 3 + rnd() * (c - 6), j * c + 3 + rnd() * (c - 6), 2, 2); }
        }
      },
      marmar: (x, n) => {                                              // 1,2 m: oq marmar tomirlari bilan, 60 sm plitalar
        x.fillStyle = "#eeebe6"; x.fillRect(0, 0, n, n);
        for (let v = 0; v < 14; v++) {
          let px = rnd() * n, py = rnd() * n; x.strokeStyle = `rgba(110,105,100,${0.08 + rnd() * 0.2})`; x.lineWidth = 0.6 + rnd() * 1.6;
          x.beginPath(); x.moveTo(px, py);
          for (let k = 0; k < 9; k++) { px += (rnd() - 0.3) * n * 0.12; py += (rnd() - 0.5) * n * 0.1; x.lineTo(px, py); }
          x.stroke();
        }
        x.fillStyle = "rgba(150,145,138,.5)"; x.fillRect(0, n / 2 - 1, n, 2); x.fillRect(n / 2 - 1, 0, 2, n); x.fillRect(0, 0, n, 1); x.fillRect(0, 0, 1, n);
      },
      beton: (x, n) => {                                               // 2 m: silliqlangan beton
        x.fillStyle = "#a9a7a2"; x.fillRect(0, 0, n, n);
        for (let k = 0; k < 6000; k++) { const v = 120 + rnd() * 90 | 0; x.fillStyle = `rgba(${v},${v},${v - 4},.12)`; const r = 1 + rnd() * 6; x.fillRect(rnd() * n, rnd() * n, r, r); }
      },
      gilam: (x, n) => {                                               // 0,5 m: yumshoq tukli gilam
        x.fillStyle = "#b9a58c"; x.fillRect(0, 0, n, n);
        for (let k = 0; k < 9000; k++) { const v = rnd(); x.fillStyle = v > 0.5 ? "rgba(255,245,225,.12)" : "rgba(80,60,40,.12)"; x.fillRect(rnd() * n, rnd() * n, 1.5, 1.5); }
      },
    }[kind];
    const cover = { laminat: 2, koshin: 1.2, marmar: 1.2, beton: 2, gilam: 0.5 }[kind];
    return (T0[kind] = canvasTex(kind === "gilam" ? 256 : 512, draw, 1 / cover));
  }
  // Mebel yuzalari (faqat Realistik rejimda): bitta yog'och tolasi va bitta mato teksturasi, rang bilan bo'yaladi
  let grainTex = null, fabricTex = null;
  function surfTex(kind) {
    if (kind === "wood") return grainTex || (grainTex = canvasTex(256, (x, n) => {
      const rnd = seeded(5); x.fillStyle = "#d6d2cc"; x.fillRect(0, 0, n, n);
      for (let k = 0; k < 70; k++) { const y = rnd() * n, a = 0.05 + rnd() * 0.12; x.strokeStyle = `rgba(70,45,25,${a})`; x.lineWidth = 0.5 + rnd() * 2; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(n * 0.3, y + rnd() * 8 - 4, n * 0.7, y + rnd() * 8 - 4, n, y); x.stroke(); }
    }, 1));
    return fabricTex || (fabricTex = canvasTex(128, (x, n) => {
      const rnd = seeded(9); x.fillStyle = "#d8d8d8"; x.fillRect(0, 0, n, n);
      for (let i = 0; i < n; i += 2) { x.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.04})`; x.fillRect(i, 0, 1, n); x.fillRect(0, i, n, 1); }
    }, 4));
  }

  // ---------- Shakllar ----------
  const rectAt = (xa, xb, za, zb) => {
    const s = new THREE.Shape();
    s.moveTo(xa, za); s.lineTo(xb, za); s.lineTo(xb, zb); s.lineTo(xa, zb); s.lineTo(xa, za);
    return s;
  };
  function dims(o, cw, ch, arched) {
    const x1 = cw * o[0], x2 = cw * o[1], z1 = ch * o[2], z2 = ch * o[3], r = (x2 - x1) / 2;
    return { x1, x2, z1, z2, r, cx: (x1 + x2) / 2, spring: Math.max(z1, z2 - r), arched };
  }
  function holePath(d) {
    const p = new THREE.Path();
    p.moveTo(d.x1, d.z1); p.lineTo(d.x2, d.z1);
    if (d.arched) { p.lineTo(d.x2, d.spring); p.absarc(d.cx, d.spring, d.r, 0, Math.PI, false); }
    else { p.lineTo(d.x2, d.z2); p.lineTo(d.x1, d.z2); }
    p.lineTo(d.x1, d.z1);
    return p;
  }
  // Teshik yerga tegib turganda (eshik, vitrina, arkada) teshik emas, o'yiq bilan yopiq kontur kerak
  function notched(d, cw, ch) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(d.x1, 0);
    if (d.arched) { s.lineTo(d.x1, d.spring); s.absarc(d.cx, d.spring, d.r, Math.PI, 0, true); }
    else { s.lineTo(d.x1, d.z2); s.lineTo(d.x2, d.z2); }
    s.lineTo(d.x2, 0); s.lineTo(cw, 0); s.lineTo(cw, ch); s.lineTo(0, ch); s.lineTo(0, 0);
    return s;
  }
  function panes(type, d) {
    const gap = 0.05, w = d.x2 - d.x1, h = d.z2 - d.z1;
    switch (type) {
      case "win": return [rectAt(d.x1, d.cx - gap, d.z1, d.z2), rectAt(d.cx + gap, d.x2, d.z1, d.z2)];
      case "wide": { const pw = (w - 2 * gap) / 3; return [0, 1, 2].map(i => rectAt(d.x1 + i * (pw + gap), d.x1 + i * (pw + gap) + pw, d.z1, d.z2)); }
      case "arch": {
        const s = new THREE.Shape();
        s.moveTo(d.x1, d.z1); s.lineTo(d.x2, d.z1); s.lineTo(d.x2, d.spring); s.absarc(d.cx, d.spring, d.r, 0, Math.PI, false); s.lineTo(d.x1, d.z1);
        return [s];
      }
      case "balc": return [rectAt(d.x1, d.x2, d.z1, d.z2)];
      case "shop": return [rectAt(d.x1, d.cx - gap, d.z1 + 0.15, d.z2), rectAt(d.cx + gap, d.x2, d.z1 + 0.15, d.z2)];
      case "door": return [rectAt(d.x1 + 0.12 * w, d.x2 - 0.12 * w, d.z1 + h * 0.5, d.z2 - h * 0.1)];
      case "slit": case "lattice": case "square": case "glassdoor": return [rectAt(d.x1, d.x2, d.z1, d.z2)];
      case "tall": return [rectAt(d.x1, d.x2, d.z1, d.z1 + h * 0.68), rectAt(d.x1, d.x2, d.z1 + h * 0.7 + gap, d.z2)];
      case "triple": { const pw = (w - 2 * gap) / 3; return [0, 1, 2].map(i => rectAt(d.x1 + i * (pw + gap), d.x1 + i * (pw + gap) + pw, d.z1, d.z2)); }
      case "door2": return [rectAt(d.x1 + 0.08 * w, d.cx - 0.06 * w, d.z1 + h * 0.55, d.z2 - h * 0.1), rectAt(d.cx + 0.06 * w, d.x2 - 0.08 * w, d.z1 + h * 0.55, d.z2 - h * 0.1)];
      case "archdoor": { const s = new THREE.Shape(), r = d.r * 0.75; s.absarc(d.cx, d.spring, r, 0, Math.PI, false); s.lineTo(d.cx + r, d.spring); return [s]; }
      default: return [];
    }
  }

  // ---------- Material va naqshlar ----------
  function makeTex(kind, base) {
    if (!kind) return null;
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "rgba(0,0,0,.28)"; x.lineWidth = 3;
    const line = (a, b, cc, dd) => { x.beginPath(); x.moveTo(a, b); x.lineTo(cc, dd); x.stroke(); };
    if (kind === "brick") {
      for (let r = 0; r < 4; r++) { const y = r * 64, off = (r % 2) * 64; line(0, y, 256, y); for (let i = 0; i < 3; i++) line(off + i * 128, y, off + i * 128, y + 64); }
    } else if (kind === "panel") {
      x.strokeRect(1.5, 1.5, 253, 253); x.fillStyle = "rgba(0,0,0,.25)";
      [[24, 24], [232, 24], [24, 232], [232, 232]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 4, 0, 6.3); x.fill(); });
    } else if (kind === "stone") {
      for (let r = 0; r < 3; r++) { const y = r * 85, xx = r % 2 ? 60 : 170; line(0, y, 256, y); line(xx, y, xx, y + 85); }
    } else if (kind === "tile") {
      x.strokeStyle = "rgba(255,255,255,.42)";
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const cx = 64 + i * 128, cy = 64 + j * 128;
        x.beginPath(); x.moveTo(cx, cy - 52); x.lineTo(cx + 52, cy); x.lineTo(cx, cy + 52); x.lineTo(cx - 52, cy); x.closePath(); x.stroke();
      }
    } else if (kind === "wood") {                // vertikal taxtalar
      for (let i = 0; i <= 8; i++) line(i * 32, 0, i * 32, 256);
      x.strokeStyle = "rgba(0,0,0,.12)"; x.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const yy = (i * 53) % 200; line(i * 32 + 12, yy, i * 32 + 12, yy + 44); }
    } else if (kind === "seam") {                // metall panel choklari
      x.lineWidth = 4; for (let i = 0; i < 4; i++) line(i * 64 + 2, 0, i * 64 + 2, 256);
      x.strokeStyle = "rgba(255,255,255,.22)"; x.lineWidth = 2; for (let i = 0; i < 4; i++) line(i * 64 + 8, 0, i * 64 + 8, 256);
    } else if (kind === "glass") {               // vitraj: ochiq rama to'ri
      x.fillStyle = "#9cc0dc"; x.fillRect(0, 0, 256, 256); x.strokeStyle = "rgba(235,242,247,.95)"; x.lineWidth = 6;
      line(0, 3, 256, 3); line(3, 0, 3, 256); line(0, 128, 256, 128); x.lineWidth = 3; line(128, 0, 128, 256);
    } else if (kind === "rubble") {              // notekis tabiiy tosh
      const P = [[0, 90, 128, 77, 230, 115, 256, 102], [0, 200, 154, 210, 256, 192]];
      P.forEach(pl => { x.beginPath(); x.moveTo(pl[0], pl[1]); for (let i = 2; i < pl.length; i += 2) x.lineTo(pl[i], pl[i + 1]); x.stroke(); });
      [[77, 0, 70, 84], [192, 0, 205, 97], [158, 115, 148, 205], [51, 200, 61, 256], [225, 194, 230, 256]].forEach(([a, b, cc, dd]) => line(a, b, cc, dd));
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function cssColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    try { return new THREE.Color(v || fallback); } catch { return new THREE.Color(fallback); }
  }

  const mk = (geo, m, x, y, z, shadow = true) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.castShadow = shadow; mesh.receiveShadow = true;
    return mesh;
  };
  const box = (w, h, d, m, x, y, z, shadow = true) => mk(track(new THREE.BoxGeometry(w, h, d)), m, x, y, z, shadow);

  // ---------- Realistik ko'rinish ----------
  // Haqiqiy o'lchamdagi teksturalar (g'isht 250×65 mm, chok 10 mm va h.k.) rang + bo'rtiq (bump) xaritasi bilan,
  // osmon gumbazi, osmondan atrof yorug'ligi (PMREM: oynalarda osmon aksi), ACES tonlash, maysa, otmostka, uzoqdagi daraxtlar.
  // "Maket" rejimi (oq plinta va to'r) bitta tugma bilan qaytadi; tanlov brauzerda eslab qolinadi.
  let real = (() => { try { return localStorage.getItem("ustun-3d-real") === "1"; } catch { return false; } })();   // standart: oddiy maket (engil), Realistik va Aylanish tugma bilan yoqiladi
  const realTex = {}, REAL_TILE = 1.2;
  let skyDome = null, envDome = null, envScene = null, envRT = null, pmrem = null, envTimer = 0, skyState = null;
  const seeded = s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const shade = (hex, k, j = 0) => { const c = new THREE.Color(hex); c.r = clamp(c.r * k + j, 0, 1); c.g = clamp(c.g * k + j * 0.9, 0, 1); c.b = clamp(c.b * k + j * 0.8, 0, 1); return "#" + c.getHexString(); };
  // rang va bo'rtiq kanvaslari bir xil tasodifiy ketma-ketlik bilan chiziladi: chok joylari ikkalasida mos tushadi
  function texPair(key, size, draw, rep = REAL_TILE) {
    if (realTex[key]) return realTex[key];
    const aniso = renderer.capabilities.getMaxAnisotropy(), mkT = bump => {
      const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
      draw(x, size, bump, seeded(97));
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.repeat.set(1 / rep, 1 / rep);
      if (!bump) t.encoding = THREE.sRGBEncoding;
      return t;
    };
    return (realTex[key] = { map: mkT(false), bump: mkT(true) });
  }
  function noise(x, n, rnd, amt, count, light) {                    // mayda dog'lar (g'ovaklik, chang)
    for (let i = 0; i < count; i++) { const a = rnd() * amt; x.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; const s = 1 + rnd() * 2.5; x.fillRect(rnd() * n, rnd() * n, s, s); }
  }
  const DRAW = {
    brick: base => (x, n, B, rnd) => {                            // 1,2 m: 16 qator (75 mm), qatorda 5 g'isht (240 mm), choklar 10 mm
      const rows = 16, cols = 5, rh = n / rows, cw = n / cols, j = n * 0.0083;
      x.fillStyle = B ? "#3a3a3a" : shade(base, 0.62, 0.3); x.fillRect(0, 0, n, n);
      for (let r = 0; r < rows; r++) for (let c = -1; c <= cols; c++) {
        const off = (r % 2) * cw / 2, k = 0.8 + rnd() * 0.32;
        x.fillStyle = B ? `rgb(${200 + rnd() * 40 | 0},${200 | 0},200)` : shade(base, k, (rnd() - 0.5) * 0.04);
        x.fillRect(c * cw + off + j / 2, r * rh + j / 2, cw - j, rh - j);
        if (!B && rnd() < 0.18) { x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(c * cw + off + j / 2, r * rh + rh * 0.55, cw - j, rh * 0.45 - j / 2); }
      }
      noise(x, n, rnd, B ? 0.35 : 0.22, 9000);
    },
    stone: base => (x, n, B, rnd) => {                            // travertin plitalar: 3 qator, har xil uzunlik, gorizontal tomirlar
      const rows = 3, rh = n / rows, j = 3;
      x.fillStyle = B ? "#404040" : shade(base, 0.75); x.fillRect(0, 0, n, n);
      for (let r = 0; r < rows; r++) { let xx = -rnd() * n * 0.3; while (xx < n) { const w = n * (0.3 + rnd() * 0.3), k = 0.9 + rnd() * 0.14;
        x.fillStyle = B ? "#c8c8c8" : shade(base, k); x.fillRect(xx + j, r * rh + j, w - 2 * j, rh - 2 * j);
        if (!B) { x.strokeStyle = "rgba(120,95,60,.18)"; for (let v = 0; v < 6; v++) { const y = r * rh + rnd() * rh; x.lineWidth = 1 + rnd() * 2; x.beginPath(); x.moveTo(xx, y); x.bezierCurveTo(xx + w / 3, y + rnd() * 6 - 3, xx + w * 2 / 3, y + rnd() * 6 - 3, xx + w, y); x.stroke(); } }
        xx += w; } }
      noise(x, n, rnd, 0.25, 7000); if (!B) noise(x, n, rnd, 0.12, 3000, true);
    },
    panel: base => (x, n, B, rnd) => {                            // monolit beton: dog'lar, qolip izlari, chok va bolt teshiklari
      x.fillStyle = B ? "#b4b4b4" : base; x.fillRect(0, 0, n, n);
      for (let i = 0; i < 40; i++) { const cx = rnd() * n, cy = rnd() * n, r = n * (0.04 + rnd() * 0.14), g = x.createRadialGradient(cx, cy, 0, cx, cy, r); const a = rnd() * 0.1; g.addColorStop(0, rnd() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
      noise(x, n, rnd, 0.3, 14000); noise(x, n, rnd, 0.15, 5000, true);
      x.fillStyle = B ? "#202020" : "rgba(0,0,0,.45)"; x.fillRect(0, 0, n, 4); x.fillRect(0, 0, 4, n);
      [[0.17, 0.17], [0.83, 0.17], [0.17, 0.83], [0.83, 0.83], [0.5, 0.17], [0.5, 0.83]].forEach(([a, b]) => { x.beginPath(); x.arc(a * n, b * n, n * 0.012, 0, 6.3); x.fillStyle = B ? "#151515" : "rgba(0,0,0,.4)"; x.fill(); });
    },
    tile: base => (x, n, B, rnd) => {                             // koshin: 150 mm sirli plitkalar, oq choklar
      const k = 8, s = n / k, j = 3;
      x.fillStyle = B ? "#505050" : "#e9e6de"; x.fillRect(0, 0, n, n);
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
        x.fillStyle = B ? "#d0d0d0" : shade(base, 0.86 + rnd() * 0.22); x.fillRect(a * s + j, b * s + j, s - 2 * j, s - 2 * j);
        if (!B) { const g = x.createLinearGradient(a * s, b * s, a * s + s, b * s + s); g.addColorStop(0, "rgba(255,255,255,.22)"); g.addColorStop(0.5, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(a * s + j, b * s + j, s - 2 * j, s - 2 * j); }
      }
    },
    wood: base => (x, n, B, rnd) => {                             // vertikal taxtalar 150 mm, tolalar va tugunlar
      const k = 8, s = n / k;
      for (let i = 0; i < k; i++) {
        x.fillStyle = B ? "#bdbdbd" : shade(base, 0.82 + rnd() * 0.3); x.fillRect(i * s, 0, s, n);
        x.strokeStyle = B ? "rgba(0,0,0,.25)" : "rgba(50,28,10,.22)";
        for (let g = 0; g < 14; g++) { const xx = i * s + rnd() * s; x.lineWidth = 0.6 + rnd() * 1.6; x.beginPath(); x.moveTo(xx, 0); x.bezierCurveTo(xx + rnd() * 8 - 4, n / 3, xx + rnd() * 8 - 4, n * 2 / 3, xx + rnd() * 6 - 3, n); x.stroke(); }
        if (rnd() < 0.5) { x.fillStyle = B ? "#555" : "rgba(60,30,10,.45)"; x.beginPath(); x.ellipse(i * s + s / 2, rnd() * n, 4 + rnd() * 5, 7 + rnd() * 8, 0, 0, 6.3); x.fill(); }
        x.fillStyle = B ? "#111" : "rgba(25,12,4,.6)"; x.fillRect(i * s, 0, 3, n);
      }
    },
    seam: base => (x, n, B, rnd) => {                             // metall panel: tik choklar (falts) va yengil to'lqin
      x.fillStyle = B ? "#888" : base; x.fillRect(0, 0, n, n);
      for (let i = 0; i < 4; i++) { const xx = i * n / 4; const g = x.createLinearGradient(xx, 0, xx + n / 4, 0); g.addColorStop(0, B ? "#999" : "rgba(255,255,255,.1)"); g.addColorStop(1, B ? "#777" : "rgba(0,0,0,.1)"); x.fillStyle = g; x.fillRect(xx, 0, n / 4, n);
        x.fillStyle = B ? "#fff" : "rgba(255,255,255,.35)"; x.fillRect(xx + 2, 0, 5, n); x.fillStyle = B ? "#000" : "rgba(0,0,0,.35)"; x.fillRect(xx + 7, 0, 3, n); }
      noise(x, n, rnd, 0.08, 4000);
    },
    rubble: base => (x, n, B, rnd) => {                           // tabiiy tosh: notekis qatorlar, yumaloq toshlar, chuqur choklar
      x.fillStyle = B ? "#202020" : shade(base, 0.45); x.fillRect(0, 0, n, n);
      let y = 0; while (y < n) { const h = n * (0.1 + rnd() * 0.1); let xx = -rnd() * 40; while (xx < n) { const w = h * (1 + rnd() * 1.4), k = 0.75 + rnd() * 0.4;
        x.fillStyle = B ? `rgb(${190 + rnd() * 50 | 0},190,190)` : shade(base, k, (rnd() - 0.5) * 0.06); x.beginPath();
        const r = Math.min(w, h) * 0.3; x.moveTo(xx + r + 3, y + 3); x.arcTo(xx + w - 3, y + 3, xx + w - 3, y + h - 3, r); x.arcTo(xx + w - 3, y + h - 3, xx + 3, y + h - 3, r); x.arcTo(xx + 3, y + h - 3, xx + 3, y + 3, r); x.arcTo(xx + 3, y + 3, xx + w - 3, y + 3, r); x.fill();
        xx += w; } y += h; }
      noise(x, n, rnd, 0.3, 9000);
    },
    plaster: base => (x, n, B, rnd) => { x.fillStyle = B ? "#b0b0b0" : base; x.fillRect(0, 0, n, n); noise(x, n, rnd, B ? 0.4 : 0.07, 16000); noise(x, n, rnd, B ? 0.4 : 0.06, 8000, true); },
    roof: base => (x, n, B, rnd) => {                             // cherepitsa: 4 qator (300 mm), har birida 5 dona; qator pastki cheti soyali
      const k = 4, s = n / k, t = n / 5;
      for (let c = 0; c < k; c++) for (let r = -1; r < 6; r++) {
        const off = (c % 2) * t / 2, g = x.createLinearGradient(c * s, 0, c * s + s, 0), col = shade(base, 0.8 + rnd() * 0.3);
        g.addColorStop(0, B ? "#eee" : col); g.addColorStop(0.85, B ? "#999" : shade(col, 0.82)); g.addColorStop(1, B ? "#111" : shade(col, 0.45));
        x.fillStyle = g; x.fillRect(c * s, r * t + off, s, t);
        x.fillStyle = B ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.35)"; x.fillRect(c * s, r * t + off, s * 0.85, 2.5);
      }
      noise(x, n, rnd, 0.2, 6000);
    },
    grass: () => (x, n, B, rnd) => {                              // maysa: 4 m maydon, yashil tuslar va o't tolalari
      x.fillStyle = B ? "#888" : "#5d7f3e"; x.fillRect(0, 0, n, n);
      for (let i = 0; i < 70; i++) { const cx = rnd() * n, cy = rnd() * n, r = n * (0.04 + rnd() * 0.12), g = x.createRadialGradient(cx, cy, 0, cx, cy, r), a = 0.2 + rnd() * 0.25; g.addColorStop(0, B ? `rgba(255,255,255,${a})` : (rnd() < 0.5 ? `rgba(120,150,60,${a})` : `rgba(55,80,35,${a})`)); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
      for (let i = 0; i < 26000; i++) { const xx = rnd() * n, yy = rnd() * n, l = 2 + rnd() * 5; x.strokeStyle = B ? `rgba(255,255,255,${rnd() * 0.5})` : `hsla(${78 + rnd() * 30},${35 + rnd() * 25}%,${22 + rnd() * 22}%,.85)`; x.lineWidth = 1; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + rnd() * 2 - 1, yy - l); x.stroke(); }
    },
    paving: () => (x, n, B, rnd) => {                             // beton bruschatka 200×100 mm
      const rows = 12, cols = 6, rh = n / rows, cw = n / cols;
      x.fillStyle = B ? "#2a2a2a" : "#7a7670"; x.fillRect(0, 0, n, n);
      for (let r = 0; r < rows; r++) for (let c = -1; c <= cols; c++) { const off = (r % 2) * cw / 2; x.fillStyle = B ? "#cfcfcf" : shade("#a8a39a", 0.85 + rnd() * 0.25); x.fillRect(c * cw + off + 2, r * rh + 2, cw - 4, rh - 4); }
      noise(x, n, rnd, 0.25, 9000);
    },
  };
  const PROPS = { brick: [0.9, 0, 0.022], stone: [0.62, 0, 0.012], panel: [0.86, 0, 0.012], tile: [0.28, 0, 0.012], wood: [0.72, 0, 0.018], seam: [0.36, 0.55, 0.01],
                  rubble: [0.92, 0, 0.035], plaster: [0.94, 0, 0.006], roof: [0.78, 0, 0.03], grass: [1, 0, 0.02], paving: [0.85, 0, 0.015] };
  // kind — DRAW dagi tur; rep — tekstura qoplaydigan o'lcham (m); wuv — quti (Box) UV'lari metrga o'tkaziladi
  function realMat(kind, base, opts = {}) {
    const k = DRAW[kind] ? kind : "plaster", rep = opts.rep || (kind === "grass" ? 4 : REAL_TILE), size = kind === "grass" ? 1024 : 1024;
    const P = texPair(`${k}|${base}|${rep}`, size, DRAW[k](base || "#cccccc"), rep), pr = PROPS[k];
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: P.map, bumpMap: P.bump, bumpScale: pr[2], roughness: pr[0], metalness: pr[1] });
    m.userData.wuv = opts.wuv !== false; m.userData.real = 1;
    return m;
  }
  // Box geometriya UV'lari 0..1 dan metrga: tekstura har qanday o'lchamdagi qutida bir xil zichlikda turadi
  function worldUV(geo) {
    if (geo.userData.wuv || !geo.parameters || geo.type !== "BoxGeometry") return;
    const { width: w, height: h, depth: d } = geo.parameters, uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
    uv.needsUpdate = true; geo.userData.wuv = true;
  }
  // Rang boshqaruvi: sRGB chiqishda material ranglari chiziqli bo'lishi kerak (bir marta o'tkaziladi)
  function realPost(root) {
    if (!real || !root) return;
    root.traverse(o => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => {
        if (m.userData.wuv && o.geometry) worldUV(o.geometry);
        if (m.userData.lin) return; m.userData.lin = 1;
        if (m.isShaderMaterial) return;
        if (m.color && !m.userData.real) m.color.convertSRGBToLinear();
        if (m.emissive) m.emissive.convertSRGBToLinear();
        if (m.map && m.map.encoding !== THREE.sRGBEncoding) { m.map.encoding = THREE.sRGBEncoding; m.map.needsUpdate = true; }
        if (o.isSprite) m.toneMapped = false;
        m.needsUpdate = true;
      });
    });
  }
  function applyRenderer() {
    renderer.outputEncoding = real ? THREE.sRGBEncoding : THREE.LinearEncoding;
    renderer.toneMapping = real ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    sun.shadow.mapSize.set(real ? 4096 : 2048, real ? 4096 : 2048);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  // ---- Osmon: gradient gumbaz (+ quyosh gardishi); xuddi shu gumbazdan atrof yorug'ligi xaritasi ----
  const SKY_V = "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
  // Rang chiziqli fazoga o'tkaziladi va linearToOutputTexel bilan joriy nishon kodlashiga yoziladi:
  // ekranda — sRGB, PMREM nishonida — RGBE. Kodlashsiz xom vec4(c, 1.0) RGBE'da alfa=1 → 2^127 deb o'qilib,
  // atrof xaritasi Infinity/NaN bilan to'lardi va barcha PBR materiallar qora chiqardi.
  const SKY_F = `uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vD;
    void main(){ vec3 d = normalize(vD); float h = d.y;
      vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h, 0.0, 1.0), 0.5)) : mix(hor, bot, clamp(-h * 6.0, 0.0, 1.0));
      float s = max(dot(d, normalize(sunDir)), 0.0); c += sunCol * (pow(s, 900.0) * 3.0 + pow(s, 14.0) * 0.22 + pow(s, 3.0) * 0.06);
      c = pow(max(c, vec3(0.0)), vec3(2.2));
      gl_FragColor = linearToOutputTexel(vec4(c, 1.0)); }`;
  const skyMat = () => new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() } } });
  function ensureSky() {
    if (skyDome) return;
    skyDome = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), skyMat()); skyDome.renderOrder = -10; skyDome.frustumCulled = false;
    skyDome.raycast = () => {};
    envScene = new THREE.Scene(); envDome = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), skyMat()); envScene.add(envDome);
    pmrem = new THREE.PMREMGenerator(renderer);
  }
  const mixHex = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(k, 0, 1));
  function updateSky() {
    if (!real || !skyDome) return;
    const dir = sun.position.clone().sub(sun.target.position).normalize(), el = Math.asin(clamp(dir.y, -1, 1)), day = clamp(el / 0.35, 0, 1), dusk = 1 - clamp((el - 0.04) / 0.3, 0, 1);
    const top = mixHex("#0f1d33", mixHex("#2f6cb5", "#3b78c4", day).getHex(), clamp(el / 0.08 + 0.15, 0, 1));
    const hor = mixHex(mixHex("#cfe0ee", "#f2c49b", dusk).getHex(), "#33405a", el < 0 ? 1 : 0);
    const bot = mixHex("#4f5a46", "#7e8a6c", day), sc = mixHex("#ffb070", "#fff3dd", day);
    [skyDome, envDome].forEach(m => { const u = m.material.uniforms; u.top.value.copy(top); u.hor.value.copy(hor); u.bot.value.copy(bot); u.sunDir.value.copy(dir); u.sunCol.value.copy(sc); });
    sun.color.copy(sc); sun.intensity = el > 0 ? 0.6 + 2.6 * Math.sin(Math.min(el, 1.2)) : 0.08;
    hemi.color.copy(top.clone().lerp(new THREE.Color(1, 1, 1), 0.6)); hemi.groundColor.copy(bot); hemi.intensity = 0.25 + 0.2 * day;
    const fogC = hor.clone().convertSRGBToLinear();
    scene.fog = new THREE.Fog(fogC, Math.max(120, baseDist * 2.5), 1300);
    clearTimeout(envTimer);
    envTimer = setTimeout(() => {                                    // atrof yorug'ligi xaritasi (slayder tez surilganda bir marta)
      if (!real || !pmrem) return;
      const rt = pmrem.fromScene(envScene, 0, 0.1, 200);
      if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture; request();
    }, 60);
  }
  // ---- Atrof: maysa, otmostka, uzoqdagi daraxtlar ----
  let aoTex = null;
  function aoMat() {
    if (!aoTex) {
      const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
      x.filter = "blur(9px)"; x.fillStyle = "#000"; x.fillRect(22, 22, 84, 84);
      aoTex = new THREE.CanvasTexture(c);
    }
    return track(new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: aoTex, transparent: true, opacity: 0.55, depthWrite: false }));
  }
  function realSurroundings(layout, mx, mz, span) {
    if (!real) return;
    const env = new THREE.Group(); group.add(env);
    const gm = track(realMat("grass", null, { rep: 4, wuv: false })); gm.map = gm.map.clone(); gm.bumpMap = gm.bumpMap.clone();
    [gm.map, gm.bumpMap].forEach(t => { t.repeat.set(900 / 4, 900 / 4); t.needsUpdate = true; track(t); });
    vrGround.material = gm; vrGround.position.y = -0.01; vrGround.visible = true;
    const pav = track(realMat("paving", null, { rep: 1.2 }));
    layout.forEach(l => {                                            // otmostka: uy atrofida 1 m beton yo'lak
      const a = new THREE.Mesh(track(new THREE.BoxGeometry(l.W + 2, 0.04, l.D + 2)), pav);
      a.position.set(l.cx, 0.0, l.cz); a.rotation.y = (l.rot * Math.PI) / 180; a.receiveShadow = true; env.add(a);
      // kontakt soya (arzon "ambient occlusion"): devor tagida yumshoq qorayish — uy yerga "o'tirgandek" ko'rinadi
      const ao = new THREE.Mesh(track(new THREE.PlaneGeometry(l.W + 2.4, l.D + 2.4)), aoMat());
      ao.rotation.x = -Math.PI / 2; ao.rotation.z = (l.rot * Math.PI) / 180; ao.position.set(l.cx, 0.025, l.cz); ao.renderOrder = 1; ao.raycast = () => {}; env.add(ao);
    });
    // uzoqdagi daraxtlar halqasi (uy va hovliga tegmaydi)
    const rnd = seeded(31), trunkG = track(new THREE.CylinderGeometry(0.14, 0.24, 1, 7)), crownG = track(new THREE.IcosahedronGeometry(1, 1));
    const bark = track(new THREE.MeshStandardMaterial({ color: new THREE.Color("#5b4331").convertSRGBToLinear(), roughness: 1 }));
    const leaves = ["#3f6b2c", "#4f7d33", "#5b8a3c", "#46703a", "#6a8f3f"].map(c => track(new THREE.MeshStandardMaterial({ color: new THREE.Color(c).convertSRGBToLinear(), roughness: 0.95, flatShading: true })));
    const R0 = span / 2 + 22;
    for (let i = 0; i < 46; i++) {
      const ang = rnd() * Math.PI * 2, r = R0 + rnd() * 70, x = mx + Math.cos(ang) * r, z = mz + Math.sin(ang) * r;
      if (yardR && x > yardR.x0 - 4 && x < yardR.x1 + 4 && z > yardR.z0 - 4 && z < yardR.z1 + 10) continue;
      const h = 4 + rnd() * 6, t = new THREE.Group(); t.position.set(x, 0, z);
      const tr = new THREE.Mesh(trunkG, bark); tr.scale.set(1, h * 0.45, 1); tr.position.y = h * 0.225; tr.castShadow = true; t.add(tr);
      const m = leaves[Math.floor(rnd() * leaves.length)];
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(crownG, m), s = h * (0.22 + rnd() * 0.14); c.scale.set(s, s * (0.85 + rnd() * 0.3), s); c.position.set((rnd() - 0.5) * h * 0.25, h * (0.55 + k * 0.12), (rnd() - 0.5) * h * 0.25); c.castShadow = true; c.receiveShadow = true; t.add(c); }
      t.traverse(o => { o.raycast = () => {}; });
      env.add(t);
    }
    if (skyDome.parent !== scene) scene.add(skyDome);
    skyDome.position.set(mx, 0, mz);
  }
  function setReal(on) {
    real = on;
    try { localStorage.setItem("ustun-3d-real", on ? "1" : "0"); } catch {}
    const b = bar && bar.querySelector('[data-v="real"]'); if (b) b.setAttribute("aria-pressed", String(on));
    applyRenderer();
    if (!on) { if (skyDome && skyDome.parent) skyDome.parent.remove(skyDome); scene.environment = null; scene.fog = null; }
    if (lastArgs) { builtSig = ""; schedule(); }
  }

  // ---------- Bitta uyni yig'ish (markazi koordinata boshida, asosi y=0 da) ----------
  function makeBuilding(p, cells, sh, interior) {
    const out = new THREE.Group();
    const g = geometry(p), mat = matOf(p);
    const { W, D, Hb } = g;
    const { glassMat, ironMat } = sh;
    let roofMat = sh.roofMat;
    const RM = p.roof_mat && p.roof_mat !== "standart" && ROOF_MATS[p.roof_mat];     // tanlangan tom qoplamasi (shu uy uchun)
    if (RM) roofMat = track(real ? realMat(RM.kind, RM.real, { rep: RM.kind === "grass" ? 4 : 1.2 })
                                 : new THREE.MeshStandardMaterial({ color: RM.fill, roughness: RM.kind === "seam" ? 0.45 : 0.85, metalness: RM.kind === "seam" ? 0.4 : 0 }));
    const BS = BASES[p.base] && BASES[p.base].fill ? BASES[p.base] : null;           // poydevor (sokol)
    const baseMat = BS ? track(real ? realMat(BS.kind, BS.fill) : new THREE.MeshStandardMaterial({ color: BS.fill, roughness: 0.9 })) : null;
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const baseTex = track(makeTex(mat.pattern, mat.fill) || { dispose() {} });
    const hasTex = !!mat.pattern;

    const glassy = p.material === "shisha";                       // butunlay oynali bino: devor — shaffof vitraj
    const wallMat = (cw, ch) => {
      if (real && !glassy) return track(realMat(mat.pattern || "plaster", mat.fill));      // haqiqiy o'lchamdagi naqsh, metrlarda
      const m = new THREE.MeshStandardMaterial(glassy ? { color: 0xdbe9f3, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.5 }
                                                      : { color: hasTex ? 0xffffff : mat.fill, roughness: 0.92, metalness: 0 });
      if (hasTex) {
        const t = baseTex.clone(); t.needsUpdate = true; t.anisotropy = maxAniso;
        t.repeat.set(Math.max(1, Math.round(cw / TILE)) / cw, Math.max(1, Math.round(ch / TILE)) / ch);   // har katak naqshi chok joyida uzilmasin
        m.map = t; track(t);
      }
      return track(m);
    };
    const ledgeMat = track(real ? realMat("plaster", shade(mat.fill, 0.82)) : new THREE.MeshStandardMaterial({ color: new THREE.Color(mat.fill).multiplyScalar(0.82), roughness: 0.9 }));
    const woodMat = track(real ? realMat("wood", "#6b4a2e", { rep: 1.2 }) : new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.7 }));
    const plainMat = track(real ? realMat("plaster", glassy ? "#d9dde0" : mat.fill) : new THREE.MeshStandardMaterial({ color: mat.fill, roughness: 0.9 }));

    function cellTemplate(type, cw, ch, wm) {
      const grp = new THREE.Group(), o = OPENING[type];
      if (type === "round") {                                     // dumaloq deraza: aylana teshik va shisha
        const cx = cw * (o[0] + o[1]) / 2, cy = ch * (o[2] + o[3]) / 2, r = Math.min((o[1] - o[0]) * cw, (o[3] - o[2]) * ch) / 2;
        const sh2 = rectAt(0, cw, 0, ch), hole = new THREE.Path(); hole.absarc(cx, cy, r, 0, Math.PI * 2, false); sh2.holes.push(hole);
        grp.add(mk(track(new THREE.ExtrudeGeometry(sh2, { depth: T, bevelEnabled: false, curveSegments: 24 })), wm, 0, 0, 0));
        const pane = new THREE.Shape(); pane.absarc(cx, cy, r, 0, Math.PI * 2, false);
        const gm = new THREE.Mesh(track(new THREE.ShapeGeometry(pane, 24)), glassMat); gm.position.z = T * 0.55; grp.add(gm);
        grp.add(box(2 * r, 0.05, 0.05, ironMat, cx, cy, T * 0.6, false), box(0.05, 2 * r, 0.05, ironMat, cx, cy, T * 0.6, false));
        return grp;
      }
      let shape = rectAt(0, cw, 0, ch), d = null;
      if (o) {
        d = dims(o, cw, ch, type === "arch" || type === "arcade" || type === "archdoor");
        if (o[2] === 0) shape = notched(d, cw, ch); else shape.holes.push(holePath(d));
      }
      grp.add(mk(track(new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 14 })), wm, 0, 0, 0));
      if (!d) return grp;

      const list = panes(type, d);
      if (list.length) {
        const gm = new THREE.Mesh(track(new THREE.ShapeGeometry(list, 8)), glassMat);
        gm.position.z = T * 0.55; grp.add(gm);
      }
      if (type === "lattice") {                                   // panjara: 3 ta vertikal va 3 ta gorizontal tayoq
        for (let i = 1; i < 4; i++) {
          grp.add(box(0.04, d.z2 - d.z1, 0.05, ironMat, d.x1 + (d.x2 - d.x1) * i / 4, (d.z1 + d.z2) / 2, T * 0.62, false));
          grp.add(box(d.x2 - d.x1, 0.04, 0.05, ironMat, d.cx, d.z1 + (d.z2 - d.z1) * i / 4, T * 0.62, false));
        }
      }
      if (type === "door2" || type === "archdoor" || type === "garage") {   // eshik tavaqalari / garaj darvozasi
        const top = type === "archdoor" ? d.spring : d.z2, leafM = type === "garage" ? ironMat : woodMat;
        const dm = new THREE.Mesh(track(new THREE.ShapeGeometry(rectAt(d.x1, d.x2, 0, top))), leafM); dm.position.z = T * 0.4; grp.add(dm);
        if (type === "garage") for (let i = 1; i < 5; i++) grp.add(box(d.x2 - d.x1, 0.04, 0.04, plainMat, d.cx, top * i / 5, T * 0.45, false));
        else grp.add(box(0.03, top, 0.04, ironMat, d.cx, top / 2, T * 0.45, false));
      }
      if (type === "door") {
        const dm = new THREE.Mesh(track(new THREE.ShapeGeometry(rectAt(d.x1, d.x2, 0, d.z2))), ironMat);
        dm.position.z = T * 0.4; grp.add(dm);
        const cn = box(d.x2 - d.x1 + 0.4, 0.1, 0.6, ironMat, d.cx, d.z2 + 0.06, T + 0.25); cn.userData.part = "canopy"; grp.add(cn);     // soyabon (alohida detal)
      }
      if (type === "balc") {
        const bw = cw * 0.8, bz = T + 0.55, bg = new THREE.Group(); bg.userData.part = "balc"; grp.add(bg);   // balkon — alohida olinadigan detal
        bg.add(box(bw, 0.18, 1.3, plainMat, cw / 2, 0.09, bz));                                 // plita
        bg.add(box(bw, 1.0, 0.04, glassMat, cw / 2, 0.68, T + 1.18, false));                    // old panjara
        bg.add(box(0.04, 1.0, 1.25, glassMat, cw / 2 - bw / 2, 0.68, bz, false));
        bg.add(box(0.04, 1.0, 1.25, glassMat, cw / 2 + bw / 2, 0.68, bz, false));
        bg.add(box(bw, 0.05, 0.06, ironMat, cw / 2, 1.19, T + 1.18));                           // tutqich
      }
      if (type === "shop") {
        const aw = box(cw * 0.9, 0.08, 0.9, ironMat, cw / 2, d.z2 + 0.12, T + 0.4);
        aw.rotation.x = 0.35; aw.userData.part = "canopy"; grp.add(aw);
      }
      return grp;
    }

    function makeWall(cols, cw, typeAt) {
      const wm = wallMat(cw, p.floor_h), tpl = {}, wall = new THREE.Group(); wall.userData.part = "wall";
      for (let f = 0; f < p.floors; f++) for (let c = 0; c < cols; c++) {
        const type = typeAt(f, c);
        const t = tpl[type] || (tpl[type] = cellTemplate(type, cw, p.floor_h, wm));
        const m = t.clone();                          // geometriya va material umumiy, faqat joyi alohida
        m.position.set(c * cw, f * p.floor_h, 0); m.userData.fl = f;
        wall.add(m);
      }
      return wall;
    }

    const upper = upperType(p);
    const sideCols = Math.max(1, Math.round(D / p.bay_w)), sideW = D / sideCols;
    const floorGs = [], ceilG = new THREE.Group();                 // ichki reja qavatlari va shift (kesimda boshqariladi)
    const PSI = shapeOf(p) !== "rect" ? planShape(p).rings.map(r => offsetRing(r, -T)) : null;   // shakldor plan: devorlarning ichki konturi
    if (shapeOf(p) !== "rect") return shaped();                    // L, П, T, ichki hovli, aylana va boshqa planlar

    // ---------- Shakldor plan: devorlar kontur qirralari bo'ylab, tom — qanotlar bo'yicha yoki qavariq shaklda piramida ----------
    function shaped() {
      const ps = planShape(p), E = planEdges(ps), X = x => x - W / 2, Z = z => z - D / 2;
      if (ps.shape === "sphere") return sphereBuilding();
      const walls = [], frontWalls = new THREE.Group();
      let frontG = null;
      E.forEach(e => {
        let cols, cw, typeAt;
        if (e.full) { cols = p.bays; cw = p.bay_w; typeAt = (f, b) => cellType(p, cells, f, b); }   // old fasad: konstruktor kataklari
        else {
          cols = Math.max(1, Math.round(e.L / p.bay_w)); cw = e.L / cols;
          const plain = e.L < 1.2;
          typeAt = (f, c) => {
            if (plain) return "wall";
            if (e.front) {                                         // ko'chaga qaragan qiya qirra: shu x dagi fasad katagi
              const x = e.x1 + e.dx * (c + 0.5) * cw, b = Math.min(p.bays - 1, Math.max(0, Math.floor(x / p.bay_w)));
              return cellType(p, cells, f, b);
            }
            return Math.abs(e.dx) >= Math.abs(e.dz) ? backType(p) : sideType(p);   // orqa (x bo'ylab) va yon qirralar
          };
        }
        const w = makeWall(cols, cw, typeAt);
        w.rotation.y = Math.atan2(-e.dz, e.dx);
        w.position.set(X(e.x1) - e.nx * T, 0, Z(e.z1) - e.nz * T);   // tashqi yuzasi kontur chizig'ida
        if (e.full) { w.userData.front = { bw: p.bay_w, fh: p.floor_h, floors: p.floors, bays: p.bays }; frontG = w; out.add(w); }
        else if (e.front) frontWalls.add(w); else out.add(w);
        walls.push(w);
      });
      out.add(frontWalls); if (!frontG) frontG = frontWalls;

      // Kontur (teshiklari bilan) bo'yicha yuqoriga cho'zilgan jism
      const prism = (rings, depth, y, m, shadow = true) => {
        const sh2 = new THREE.Shape(rings[0].map(([x, z]) => new THREE.Vector2(X(x), -Z(z))));
        rings.slice(1).forEach(r => sh2.holes.push(new THREE.Path(r.map(([x, z]) => new THREE.Vector2(X(x), -Z(z))))));
        const mesh = mk(track(new THREE.ExtrudeGeometry(sh2, { depth, bevelEnabled: false, curveSegments: 4 })), m, 0, y, 0, shadow);
        mesh.rotation.x = -Math.PI / 2; return mesh;
      };
      const grow = d => ps.rings.map(r => offsetRing(r, d));

      // Ichki reja bo'lsa — xonalar, mebel va zina; bo'lmasa — qorong'i hajm (deraza ortida bo'shliq ko'rinmasin)
      out.add(ceilG);
      const coll = interior ? addInterior(interior) : null;
      const dark = interior ? null : prism(grow(-T + 0.01), Hb, 0, track(new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 1 })), false);
      if (dark) out.add(dark);
      // Qavat belbog'lari: faqat tashqi devor bo'ylab tasma (ichi bo'sh — kesimda xonalar tepadan ko'rinadi)
      const bands = ps.rings.map((r, i) => (i ? [offsetRing(r, -0.02), offsetRing(r, 0.08)] : [offsetRing(r, 0.08), offsetRing(r, -0.02)]));
      if (baseMat) ps.rings.forEach((r, i) => out.add(prism(i ? [offsetRing(r, -0.02), offsetRing(r, 0.1)] : [offsetRing(r, 0.1), offsetRing(r, -0.02)], BASE_H, 0, baseMat)));   // poydevor
      for (let f = 1; f < p.floors; f++) bands.forEach(b => out.add(prism(b, 0.12, f * p.floor_h - 0.06, ledgeMat)));

      const roofMark = out.children.length;
      out.add(prism(grow(0.25), 0.22, Hb - 0.11, ledgeMat));          // karniz
      const parapet = h => E.forEach(e => {
        const m = box(e.L + 0.3, h, 0.3, plainMat, X((e.x1 + e.x2) / 2) - e.nx * 0.15, Hb + 0.3 + h / 2, Z((e.z1 + e.z2) / 2) - e.nz * 0.15);
        m.rotation.y = Math.atan2(-e.dz, e.dx); out.add(m);
      });
      const flat = h => { out.add(prism(grow(0.15), 0.3, Hb, plainMat)); parapet(h); };
      // Gumbaz va pavilon joyi: eng katta qanot markazi yoki qavariq shakl markazi
      const centre = ps.outer.reduce((s2, [x, z]) => [s2[0] + x / ps.outer.length, s2[1] + z / ps.outer.length], [0, 0]);
      const spot = (() => {
        if (ps.wings) {
          const w = ps.wings.slice().sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0];
          return { x: X((w.x0 + w.x1) / 2), z: Z((w.z0 + w.z1) / 2), w: w.x1 - w.x0, d: w.z1 - w.z0 };
        }
        return { x: X(centre[0]), z: Z(centre[1]), w: W * 0.6, d: D * 0.6 };
      })();

      // Bitta to'g'ri to'rtburchak qanot ustidagi nishab tom (tizma lokal z bo'ylab)
      function rectRoof(type, w, d) {
        const grp = new THREE.Group(), oh = 0.55;
        const R = type === "nishab" ? Math.min(w * 0.4, 7) : type === "bir" ? Math.min(w * 0.25, 4.5) : Math.min(Math.min(w, d) * 0.32, 6.5);
        if (type === "nishab") {
          const yE = -R * oh / (w / 2), len = Math.hypot(w / 2 + oh, R - yE), ang = Math.atan2(R - yE, w / 2 + oh), mid = -(w / 2 + oh) / 2, midY = (yE + R) / 2;
          const sl = box(len, 0.25, d + 2 * oh, roofMat, mid, midY + 0.12, 0); sl.rotation.z = ang;
          const sr = box(len, 0.25, d + 2 * oh, roofMat, -mid, midY + 0.12, 0); sr.rotation.z = -ang;
          const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, R); tri.lineTo(-w / 2, 0);
          const triGeo = track(new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false })), triMat = wallMat(w, R);
          const gb = mk(triGeo, triMat, 0, 0, -(d / 2 - T)); gb.rotation.y = Math.PI;
          grp.add(sl, sr, mk(triGeo, triMat, 0, 0, d / 2 - T), gb);
        } else if (type === "bir") {
          const k = R / w, len = Math.hypot(w + 2 * oh, R + 2 * k * oh), ang = Math.atan2(R, w);
          const sl = box(len, 0.3, d + 2 * oh, roofMat, 0, R / 2 + 0.15, 0); sl.rotation.z = ang; grp.add(sl);
          const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(w / 2, R); tri.lineTo(-w / 2, 0);
          const triGeo = track(new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false })), triMat = wallMat(w, R);
          grp.add(mk(triGeo, triMat, 0, 0, d / 2 - T), mk(triGeo, triMat, 0, 0, -d / 2), box(T, R, d, wallMat(d, R), w / 2 - T / 2, R / 2, 0));
        } else {
          const a = w / 2 + oh, b = d / 2 + oh, A = [-a, 0, b], B = [a, 0, b], C = [a, 0, -b], E2 = [-a, 0, -b], Pk = [0, R, 0];
          const geo = track(new THREE.BufferGeometry());
          geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...A, ...B, ...Pk, ...B, ...C, ...Pk, ...C, ...E2, ...Pk, ...E2, ...A, ...Pk]), 3));
          geo.computeVertexNormals(); grp.add(mk(geo, roofMat, 0, 0, 0));
        }
        return grp;
      }

      if (p.roof === "tekis") flat(0.9);
      else if (p.roof === "terrasa") {
        flat(0.5);
        const pw = Math.max(2, spot.w * 0.5), pd = Math.max(2, spot.d * 0.6), ph = p.floor_h, y0 = Hb + 0.3;
        const pav = box(pw, ph, pd, glassMat, spot.x, y0 + ph / 2, spot.z, false); out.add(pav);
        const ed = new THREE.LineSegments(track(new THREE.EdgesGeometry(pav.geometry)), track(new THREE.LineBasicMaterial({ color: 0x2a2f33 })));
        ed.position.copy(pav.position); out.add(ed, box(pw + 1.2, 0.3, pd + 1.2, ironMat, spot.x, y0 + ph + 0.15, spot.z));
      } else if (p.roof === "gumbaz") {
        flat(0.9);
        const r = g.domeR, dh = r * 0.45, y0 = Hb + 0.3;
        out.add(mk(track(new THREE.CylinderGeometry(r, r, dh, 48)), plainMat, spot.x, y0 + dh / 2, spot.z));
        const dome = mk(track(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2)),
          track(new THREE.MeshStandardMaterial({ color: 0x2a9896, roughness: 0.35, metalness: 0.3 })), spot.x, y0 + dh, spot.z);
        dome.scale.y = 1.15; out.add(dome);
        out.add(mk(track(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8)), ironMat, spot.x, y0 + dh + r * 1.15 + 0.55, spot.z));
      } else if (ps.wings) {                                           // nishab, bir nishab, piramida: har qanotga alohida
        ps.wings.forEach(wg => {
          const w = wg.x1 - wg.x0, d = wg.z1 - wg.z0, turn = w > d;     // tizma qanotning uzun tomoni bo'ylab
          const rg = rectRoof(p.roof, turn ? d : w, turn ? w : d);
          rg.position.set(X((wg.x0 + wg.x1) / 2), Hb, Z((wg.z0 + wg.z1) / 2)); if (turn) rg.rotation.y = Math.PI / 2;
          out.add(rg);
        });
      } else {                                                        // qavariq shakl: chetlaridan markazdagi cho'qqiga
        const ring = offsetRing(ps.outer, 0.55), top = [X(centre[0]), Hb + g.R, Z(centre[1])], pos = [];
        ring.forEach(([x, z], i) => { const [x2, z2] = ring[(i + 1) % ring.length]; pos.push(X(x2), Hb, Z(z2), X(x), Hb, Z(z), ...top); });
        const geo = track(new THREE.BufferGeometry()); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.computeVertexNormals();
        const rm = new THREE.Mesh(geo, track(roofMat.clone())); rm.material.side = THREE.DoubleSide; rm.castShadow = true; rm.receiveShadow = true; out.add(rm);
      }
      const roofG = new THREE.Group();
      out.children.slice(roofMark).forEach(c => roofG.add(c));
      out.add(roofG);
      return { group: out, g, roofG, ceilG, floorGs, wallGroups: walls, frontG, dark, coll };
    }

    // ---------- Shar: qavatlar silindri shar qobig'i ichida, har qavatda oyna halqasi, oldida eshik ----------
    function sphereBuilding() {
      const S = g.sphere, R = S.R, cy = S.cy, th = y => Math.acos(Math.max(-1, Math.min(1, (y - cy) / R)));   // balandlik -> qutb burchagi
      const shell = new THREE.Group(), bands = new THREE.Group();
      const shellM = glassy ? wallMat(2 * Math.PI * R, 2 * R) : (() => { const m = wallMat(2 * Math.PI * R / 6, R); if (m.map && !m.userData.real) m.map.repeat.set(6 / (2 * Math.PI * R / 6), 3 / R); return m; })();
      shell.add(mk(track(new THREE.SphereGeometry(R, 56, 36, 0, Math.PI * 2, 0, th(0))), shellM, 0, cy, 0));
      const winT = upperType(p);
      if (winT !== "wall" && !glassy) for (let f = 0; f < p.floors; f++) {   // har qavatda oyna halqasi (ramalar bilan)
        const y1 = f * p.floor_h + p.floor_h * 0.3, y2 = f * p.floor_h + p.floor_h * 0.78, a = th(y2), b = th(y1);
        const band = mk(track(new THREE.SphereGeometry(R + 0.03, 56, 2, 0, Math.PI * 2, a, b - a)), glassMat, 0, cy, 0, false); band.userData.fl = f; bands.add(band);
        const n = Math.max(8, Math.round(2 * Math.PI * Math.sqrt(Math.max(0, R * R - ((y1 + y2) / 2 - cy) ** 2)) / p.bay_w));
        for (let i = 0; i < n; i++) {                              // vertikal ramalar
          const t = i / n * Math.PI * 2, rr = Math.sqrt(Math.max(0, R * R - ((y1 + y2) / 2 - cy) ** 2)) + 0.05;
          const fr = box(0.08, y2 - y1, 0.08, ironMat, Math.sin(t) * rr, (y1 + y2) / 2, Math.cos(t) * rr, false); fr.userData.fl = f; bands.add(fr);
        }
      }
      const zf = Math.sqrt(Math.max(0, R * R - (1.2 - cy) ** 2));  // old tomonda eshik va soyabon
      shell.add(box(1.8, 2.5, 0.6, woodMat, 0, 1.25, zf - 0.15), box(2.6, 0.12, 1.2, ironMat, 0, 2.6, zf + 0.2));
      out.add(shell, bands, ceilG);
      const coll = interior ? addInterior(interior) : null;
      const dark = interior ? null : mk(track(new THREE.SphereGeometry(R - 0.25, 40, 24, 0, Math.PI * 2, 0, th(0))), track(new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 1 })), 0, cy, 0, false);
      if (dark && !glassy) out.add(dark);
      const roofG = new THREE.Group(); out.add(roofG);
      return { group: out, g, roofG, ceilG, floorGs, wallGroups: [bands], frontG: shell, dark: glassy ? null : dark, coll };
    }

    const front = makeWall(p.bays, p.bay_w, (f, b) => cellType(p, cells, f, b));
    front.position.set(-W / 2, 0, D / 2 - T); out.add(front);
    front.userData.front = { bw: p.bay_w, fh: p.floor_h, floors: p.floors, bays: p.bays };   // VR'da qaralgan katakni topish uchun

    const back = makeWall(p.bays, p.bay_w, () => backType(p));
    back.rotation.y = Math.PI; back.position.set(W / 2, 0, -(D / 2 - T)); out.add(back);

    const right = makeWall(sideCols, sideW, () => sideType(p));
    right.rotation.y = Math.PI / 2; right.position.set(W / 2 - T, 0, D / 2); out.add(right);

    const left = makeWall(sideCols, sideW, () => sideType(p));
    left.rotation.y = -Math.PI / 2; left.position.set(-(W / 2 - T), 0, -D / 2); out.add(left);
    if (baseMat) {                                                  // poydevor: 10 sm chiqib turgan belbog', old tomonda eshik va darvozalar ostida uziladi
      const bh = BASE_H, bt = 0.1;
      out.add(box(W + 2 * bt, bh, bt, baseMat, 0, bh / 2, -D / 2 - bt / 2), box(bt, bh, D, baseMat, W / 2 + bt / 2, bh / 2, 0), box(bt, bh, D, baseMat, -W / 2 - bt / 2, bh / 2, 0));
      for (let b = 0; b < p.bays; b++) {
        if (BASE_GAP.has(cellType(p, cells, 0, b))) continue;
        const xa = b === 0 ? -W / 2 - bt : -W / 2 + b * p.bay_w, xb = b === p.bays - 1 ? W / 2 + bt : -W / 2 + (b + 1) * p.bay_w;
        out.add(box(xb - xa, bh, bt, baseMat, (xa + xb) / 2, bh / 2, D / 2 + bt / 2));
      }
    }


    // ---------- Ichki makon (Interior): qavat plitalari, xona devorlari, mebel va zina ----------
    // Natija: VR'da yurishdagi to'siqlar (coll) — uyning markazidagi koordinatalarda
    function addInterior(raw) {
      const I = Interior.norm(p, raw), ig = I.g, fh = p.floor_h, N = p.floors, SL = 0.22;
      const tex = interiorTex();
      // Qavat pardozi: devor bo'yog'i va pol qoplamasi (3D ichki dizaynda tanlanadi), bir xil rang/tur — bitta material
      const wallMs = {}, floorMs = {};
      const wallMOf = c => wallMs[c] || (wallMs[c] = track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, map: tex ? tex.plaster : null, bumpMap: real && tex ? tex.plaster : null, bumpScale: 0.003 })));
      const floorMOf = k => {
        if (floorMs[k]) return floorMs[k];
        const t = floorTex(k);
        return (floorMs[k] = track(new THREE.MeshStandardMaterial({ color: t ? 0xffffff : 0xb99a73, roughness: FLOOR_LOOK[k] || 0.55, map: t, bumpMap: real ? t : null, bumpScale: 0.002 })));
      };
      let wallM = wallMOf("#f1ede3"), floorM = floorMOf("parket");
      const slabM = track(new THREE.MeshStandardMaterial({ color: 0xe4e0d6, roughness: 0.95 }));
      const stairM = track(new THREE.MeshStandardMaterial({ color: 0xa78662, roughness: 0.8 }));
      const mc = {}, itemM = c => mc[c] || (mc[c] = track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })));
      // Realistik rejimda mebel yuzasi turi bo'yicha: yog'och tolali, mato, sirlangan (keramika, lak), maishiy texnika
      const WOODY = /^(table|desk|dining|ctable|xontaxta|chair|wardrobe|dresser|nightstand|shelf|cradle|bed|kidsbed)$/, SOFT = /^(sofa|armchair|korpacha|carpet|curtain)$/;
      const GLOSS = { piano: [0.18, 0], bath: [0.12, 0], toilet: [0.12, 0], sink: [0.12, 0], fridge: [0.3, 0.2], stove: [0.3, 0.2], washer: [0.3, 0.1], dishwasher: [0.3, 0.2], tv: [0.25, 0.3], ac: [0.4, 0], boiler: [0.4, 0], radiator: [0.35, 0.3] };
      function surfM(type, col) {
        if (!real) return itemM(col);
        const kind = WOODY.test(type) ? "wood" : SOFT.test(type) ? "fabric" : GLOSS[type] ? type : "";
        if (!kind) return itemM(col);
        const key = kind + col; if (mc[key]) return mc[key];
        const m = kind === "wood" || kind === "fabric"
          ? new THREE.MeshStandardMaterial({ color: col, map: surfTex(kind), roughness: kind === "wood" ? 0.55 : 1 })
          : new THREE.MeshStandardMaterial({ color: col, roughness: GLOSS[kind][0], metalness: GLOSS[kind][1] });
        if (m.map) m.userData.wuv = true;                            // quti UV'lari metrga: tola har o'lchamda bir xil
        return (mc[key] = track(m));
      }
      const X = x => x - W / 2, Z = z => z - D / 2;
      const rects = [], rectsF = Array.from({ length: N }, () => []), grow = (r, m) => ({ x0: X(r.x0) - m, x1: X(r.x1) + m, z0: Z(r.z0) - m, z1: Z(r.z1) + m });   // rectsF — har qavat to'siqlari (VR'da qavatlarda yurish)
      const st = N > 1 && I.stair ? Interior.stairInfo(p, I.stair, ig) : null;
      const upperHalf = (r, rot) => rot === 0 ? { ...r, z0: (r.z0 + r.z1) / 2 } : rot === 2 ? { ...r, z1: (r.z0 + r.z1) / 2 } : rot === 1 ? { ...r, x0: (r.x0 + r.x1) / 2 } : { ...r, x1: (r.x0 + r.x1) / 2 };

      // Gorizontal plita (ixtiyoriy teshik bilan): shakl (x, -z) tekisligida, so'ng yotqiziladi
      function slabShape(hole) {
        const x0 = -W / 2 + T, x1 = W / 2 - T, z0 = -D / 2 + T, z1 = D / 2 - T;
        let s = new THREE.Shape();
        if (PSI) {                                                  // shakldor plan: plita devorlarning ichki konturi bo'yicha (ichki hovli — teshik)
          s = new THREE.Shape(PSI[0].map(([x, z]) => new THREE.Vector2(X(x), -Z(z))));
          PSI.slice(1).forEach(r => s.holes.push(new THREE.Path(r.map(([x, z]) => new THREE.Vector2(X(x), -Z(z))))));
        } else { s.moveTo(x0, -z0); s.lineTo(x1, -z0); s.lineTo(x1, -z1); s.lineTo(x0, -z1); s.closePath(); }
        if (hole) {
          const h = new THREE.Path(), a = X(hole.x0), b = X(hole.x1), c = -Z(hole.z0), d = -Z(hole.z1);
          h.moveTo(a, c); h.lineTo(b, c); h.lineTo(b, d); h.lineTo(a, d); h.closePath(); s.holes.push(h);
        }
        return s;
      }
      function slab(y, hole) {
        const m = mk(track(new THREE.ExtrudeGeometry(slabShape(hole), { depth: SL, bevelEnabled: false })), slabM, 0, y, 0, false);
        m.rotation.x = -Math.PI / 2; return m;
      }
      function floorFinish(y, hole) {
        const m = new THREE.Mesh(track(new THREE.ShapeGeometry(slabShape(hole))), floorM);
        m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; return m;
      }

      // Mebel: oddiy bo'laklardan (old tomon +z ga qaraydi)
      function furniture(type, col) {
        const d = Interior.ITEMS[type], g2 = new THREE.Group(), m = surfM(type, col), dark = itemM("#2a2f33"), { w, d: dp, h } = d;
        const add = (bw, bh, bd, x, y, z, mm) => g2.add(box(bw, bh, bd, mm || m, x, y, z, false));
        if (type === "bed") {
          add(w, 0.3, dp, 0, 0.15, 0); add(w * 0.96, 0.18, dp * 0.92, 0, 0.39, 0.02, itemM("#efece4")); add(w, h + 0.4, 0.08, 0, (h + 0.4) / 2, -dp / 2 + 0.04);
          add(0.5, 0.12, 0.34, -w * 0.22, 0.54, -dp / 2 + 0.3, itemM("#ffffff")); add(0.5, 0.12, 0.34, w * 0.22, 0.54, -dp / 2 + 0.3, itemM("#ffffff"));
        } else if (type === "sofa") {
          add(w, 0.42, dp, 0, 0.21, 0); add(w, 0.5, 0.22, 0, 0.6, -dp / 2 + 0.11); add(0.2, 0.3, dp, -(w / 2 - 0.1), 0.55, 0); add(0.2, 0.3, dp, w / 2 - 0.1, 0.55, 0);
        } else if (type === "table" || type === "desk") {
          add(w, 0.05, dp, 0, h - 0.025, 0);
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, c]) => add(0.06, h - 0.05, 0.06, a * (w / 2 - 0.06), (h - 0.05) / 2, c * (dp / 2 - 0.06)));
        } else if (type === "chair") {
          add(w, 0.05, dp, 0, 0.45, 0); add(w, 0.42, 0.05, 0, 0.7, -dp / 2 + 0.025);
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, c]) => add(0.04, 0.43, 0.04, a * (w / 2 - 0.04), 0.215, c * (dp / 2 - 0.04)));
        } else if (type === "plant") {
          g2.add(mk(track(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 10)), itemM("#8a5a35"), 0, 0.2, 0, false));
          g2.add(mk(track(new THREE.SphereGeometry(0.34, 10, 8)), itemM("#4f8a4f"), 0, 0.85, 0, false));
        } else if (type === "tv") {
          add(w * 0.7, 0.4, dp, 0, 0.2, 0); add(w, 0.62, 0.06, 0, 0.72, 0, dark);
        } else if (type === "kitchen") {
          add(w, 0.9, dp, 0, 0.45, 0); add(w, 0.04, dp + 0.02, 0, 0.92, 0, itemM("#4a4a4a"));
        } else if (type === "toilet") {
          add(w, 0.4, dp * 0.62, 0, 0.2, dp * 0.19); add(w, 0.5, 0.2, 0, 0.5, -dp / 2 + 0.1);
        } else if (type === "kidsbed" || type === "cradle") {             // bolalar karavoti / beshik: ikki uchida baland suyanchiq
          add(w, 0.25, dp, 0, 0.3, 0); add(w * 0.94, 0.12, dp * 0.9, 0, 0.48, 0, itemM("#f5f0e6"));
          [-1, 1].forEach(s => add(w, h, 0.06, 0, h / 2, s * (dp / 2 - 0.03)));
          if (type === "cradle") add(0.05, 0.05, dp, 0, h + 0.05, 0);
        } else if (type === "armchair") {
          add(w, 0.4, dp, 0, 0.2, 0); add(w, 0.45, 0.18, 0, 0.6, -dp / 2 + 0.09); add(0.16, 0.25, dp, -(w / 2 - 0.08), 0.52, 0); add(0.16, 0.25, dp, w / 2 - 0.08, 0.52, 0);
        } else if (type === "dining" || type === "ctable" || type === "xontaxta") {
          add(w, 0.05, dp, 0, h - 0.025, 0);
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, c]) => add(0.06, h - 0.05, 0.06, a * (w / 2 - 0.08), (h - 0.05) / 2, c * (dp / 2 - 0.08)));
        } else if (type === "korpacha") {
          add(w, h, dp, 0, h / 2, 0); add(w * 0.8, 0.012, dp * 0.9, 0, h + 0.006, 0, itemM("#e9c46a"));
        } else if (type === "shelf") {
          add(w, h, 0.03, 0, h / 2, -dp / 2 + 0.015); [-1, 1].forEach(s => add(0.03, h, dp, s * (w / 2 - 0.015), h / 2, 0));
          for (let i = 0; i < 5; i++) add(w, 0.03, dp, 0, 0.02 + i * (h - 0.05) / 4, 0);
          [0.3, 0.75, 1.2, 1.65].forEach((y, i) => add(w * 0.7, 0.28, dp * 0.7, (i % 2 ? 0.08 : -0.08), y + 0.16, 0, itemM(["#a4544a", "#3d6f9c", "#d9b24c", "#5c8a3e"][i])));
        } else if (type === "dresser" || type === "nightstand" || type === "wardrobe") {
          add(w, h, dp, 0, h / 2, 0);
          const n = type === "wardrobe" ? 0 : type === "dresser" ? 3 : 2;
          for (let i = 0; i < n; i++) add(w * 0.9, 0.012, 0.01, 0, (i + 1) * h / (n + 1), dp / 2 + 0.005, dark);
          if (type === "wardrobe") add(0.012, h * 0.9, 0.01, 0, h / 2, dp / 2 + 0.005, dark);
        } else if (type === "stove") {                                    // gaz plitasi: korpus, 4 ta konforka, duxovka oynasi
          add(w, h, dp, 0, h / 2, 0); add(w, 0.02, dp, 0, h + 0.01, 0, dark);
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, c]) => g2.add(mk(track(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12)), itemM("#5a5f63"), a * w / 4, h + 0.03, c * dp / 4, false)));
          add(w * 0.75, h * 0.4, 0.01, 0, h * 0.4, dp / 2 + 0.005, dark);
        } else if (type === "washer" || type === "dishwasher") {
          add(w, h, dp, 0, h / 2, 0);
          if (type === "washer") { const door = mk(track(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 20)), dark, 0, h * 0.45, dp / 2 + 0.01, false); door.rotation.x = Math.PI / 2; g2.add(door); }
          else add(w * 0.85, 0.06, 0.02, 0, h - 0.1, dp / 2 + 0.01, dark);
        } else if (type === "fridge") {
          add(w, h, dp, 0, h / 2, 0); add(w, 0.01, 0.01, 0, h * 0.62, dp / 2 + 0.005, dark); add(0.03, 0.4, 0.03, w / 2 - 0.08, h * 0.8, dp / 2 + 0.02, dark);
        } else if (type === "ac" || type === "boiler" || type === "radiator") {
          add(w, h, dp, 0, h / 2, 0);
          if (type === "ac") add(w * 0.85, 0.02, 0.02, 0, 0.06, dp / 2 + 0.005, itemM("#9aa3a8"));
          if (type === "radiator") for (let i = 0; i < 8; i++) add(0.02, h, 0.02, -w / 2 + 0.06 + i * (w - 0.12) / 7, h / 2, dp / 2 + 0.01, itemM("#d6d8d6"));
          if (type === "boiler") add(0.1, 0.1, 0.01, 0, h * 0.3, dp / 2 + 0.005, dark);
        } else if (type === "shower") {                                   // dush: poddon, shisha devorlar, ustidagi dush
          add(w, 0.1, dp, 0, 0.05, 0, itemM("#f1f1ee"));
          const gl = itemM("#bcd6e6"); gl.transparent = true; gl.opacity = 0.35;
          add(w, h, 0.02, 0, h / 2, dp / 2 - 0.01, gl); add(0.02, h, dp, w / 2 - 0.01, h / 2, 0, gl);
          add(0.04, 0.04, 0.3, -w / 2 + 0.15, h - 0.1, -dp / 2 + 0.15, dark);
        } else if (type === "sink") {
          add(w, 0.12, dp, 0, h - 0.06, 0); add(0.12, h - 0.12, 0.12, 0, (h - 0.12) / 2, -dp / 4);
        } else if (type === "mirror" || type === "painting") {
          add(w, h, dp, 0, h / 2, 0, itemM(type === "mirror" ? "#7a6a58" : "#5b3f22"));
          add(w - 0.08, h - 0.08, 0.01, 0, h / 2, dp / 2 + 0.005, itemM(type === "mirror" ? "#dceaf2" : col));
        } else if (type === "lamp") {                                     // torsher: asos, ustun, abajur
          add(0.3, 0.03, 0.3, 0, 0.015, 0, dark); add(0.03, h - 0.3, 0.03, 0, (h - 0.3) / 2, 0, dark);
          g2.add(mk(track(new THREE.CylinderGeometry(0.14, 0.2, 0.3, 14)), itemM(col), 0, h - 0.15, 0, false));
        } else if (type === "chandelier") {                               // qandil: shiftdan zanjir, gardish va lampochkalar
          add(0.02, 0.2, 0.02, 0, h - 0.1, 0, dark);
          const ring = mk(track(new THREE.TorusGeometry(w / 2 - 0.05, 0.02, 6, 24)), itemM(col), 0, h - 0.25, 0, false); ring.rotation.x = Math.PI / 2; g2.add(ring);
          for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g2.add(mk(track(new THREE.SphereGeometry(0.06, 8, 6)), itemM("#fff6d6"), Math.cos(a) * (w / 2 - 0.05), h - 0.18, Math.sin(a) * (w / 2 - 0.05), false)); }
        } else if (type === "curtain") {                                  // parda: karniz va burmalar
          add(w, 0.04, 0.04, 0, h - 0.02, 0, dark);
          for (let i = 0; i < 8; i++) add(w / 8 * 0.9, h - 0.1, dp * (i % 2 ? 0.5 : 1), -w / 2 + (i + 0.5) * w / 8, (h - 0.1) / 2, 0);
        } else if (type === "fireplace") {
          add(w, h, dp, 0, h / 2, 0); add(w * 0.55, h * 0.5, 0.02, 0, h * 0.3, dp / 2 + 0.01, dark);
          add(w * 0.35, 0.12, 0.02, 0, 0.18, dp / 2 + 0.02, itemM("#e3732e")); add(w + 0.1, 0.06, dp + 0.08, 0, h + 0.03, 0);
        } else if (type === "piano") {
          add(w, h, dp * 0.6, 0, h / 2, -dp * 0.2); add(w, 0.06, dp * 0.4, 0, 0.72, dp * 0.3); add(w * 0.95, 0.02, dp * 0.3, 0, 0.76, dp * 0.32, itemM("#f6f6f2"));
        } else if (type === "aquarium") {                                 // akvarium: tumba va suvli shisha
          add(w, 0.7, dp, 0, 0.35, 0, itemM("#2a2f33"));
          const gl = itemM("#5aa8d8"); gl.transparent = true; gl.opacity = 0.55; add(w, h - 0.7, dp, 0, 0.7 + (h - 0.7) / 2, 0, gl);
        } else add(w, h, dp, 0, h / 2, 0);
        return g2;
      }

      for (let f = 0; f < N; f++) {
        const G = new THREE.Group(); G.userData.fl = f; out.add(G); floorGs.push(G);
        const base = f * fh + (f === 0 ? 0.06 : 0), top = (f + 1) * fh - SL, fd = I.floors[f];
        wallM = wallMOf(fd.wall || "#f1ede3"); floorM = floorMOf(fd.floor || "parket");
        if (f === 0) {
          if (PSI) { const fm = mk(track(new THREE.ExtrudeGeometry(slabShape(null), { depth: 0.06, bevelEnabled: false })), floorM, 0, 0, 0, false); fm.rotation.x = -Math.PI / 2; G.add(fm); }
          else G.add(box(W - 2 * T, 0.06, D - 2 * T, slabM, 0, 0.03, 0, false));
          G.add(floorFinish(0.062, null));                         // parket qatlami (tekstura metrda: plita shakli bo'yicha)
        }
        else {
          const hole = st ? (r => ({ x0: r.x0 - 0.02, x1: r.x1 + 0.02, z0: r.z0 - 0.02, z1: r.z1 + 0.02 }))(upperHalf(st.rect, st.rot)) : null;
          G.add(slab(f * fh - SL, hole)); G.add(floorFinish(f * fh + 0.004, hole));
        }
        for (const [key, state] of Object.entries(fd.e)) {
          const seg = Interior.edgeSeg(ig, key); if (!seg) continue;
          const wp = Interior.wallPieces(seg, state);
          wp.walls.forEach(r => {
            G.add(box(r.x1 - r.x0, top - base, r.z1 - r.z0, wallM, X((r.x0 + r.x1) / 2), (base + top) / 2, Z((r.z0 + r.z1) / 2), false));
            if (f === 0) rects.push(grow(r, 0.22));
            rectsF[f].push(grow(r, 0.22));
          });
          if (wp.lintel) {
            const r = wp.lintel, hh = top - base - 2.1;
            if (hh > 0.02) G.add(box(r.x1 - r.x0, hh, r.z1 - r.z0, wallM, X((r.x0 + r.x1) / 2), base + 2.1 + hh / 2, Z((r.z0 + r.z1) / 2), false));
          }
        }
        fd.items.forEach((it, n) => {
          const d = Interior.ITEMS[it[0]], fg = furniture(it[0], d.c);
          const lift = d.top ? Math.max(0, top - base - d.h - 0.02) : (d.y || 0);   // osma buyumlar: devorda yoki shiftda
          fg.position.set(X(it[1]), base + lift, Z(it[2])); fg.rotation.y = ((it[3] | 0) % 4) * Math.PI / 2;
          fg.userData.it = { f, idx: n, flat: d.h < 0.1 };   // gilam, ko'rpacha — ustiga jihoz qo'yiladi                             // VR'da qaralgan jihozni topish uchun
          G.add(fg);
          if ((d.top || it[0] === "lamp") && lampBudget > 0) {        // qandil va torsher xonani haqiqatan yoritadi (sahnada 8 tagacha)
            lampBudget--;
            const L = new THREE.PointLight(0xffd8a8, 0.55, 7, 2);
            L.position.set(X(it[1]), base + lift + d.h * (d.top ? 0.3 : 0.85), Z(it[2])); G.add(L);
          }
          if (it[0] !== "carpet" && !d.m && d.h >= 0.1) { const r = grow(Interior.itemRect(it), 0.12); rectsF[f].push(r); if (f === 0) rects.push(r); }
        });
        if (st && f < N - 1) {                                       // zina: pog'onalar (yo'nalish — ko'tarilish tomoni)
          const n = st.n, rise = (fh - (f === 0 ? 0.06 : 0)) / n, alongZ = !!st.dir[1];
          for (let i = 0; i < n; i++) {
            const s = -st.L / 2 + (i + 0.5) * (st.L / n), h = (i + 1) * rise;
            G.add(box(alongZ ? Interior.STAIR_W : st.L / n, h, alongZ ? st.L / n : Interior.STAIR_W, stairM,
              X(st.center.x + st.dir[0] * s), base + h / 2, Z(st.center.z + st.dir[1] * s), false));
          }
          if (f === 0) rects.push(grow(st.rect, 0.1));
        }
      }
      ceilG.add(slab(N * fh - SL));                                 // eng yuqori qavat shifti (tom ostidan ko'rinadi)
      // VR: old fasaddagi eshik va arkadalar — ichkariga kirish joyi
      const doors = [];
      for (let b = 0; b < p.bays; b++) { const t = cellType(p, cells, 0, b); if (t === "door" || t === "arcade") doors.push(-W / 2 + (b + 0.5) * p.bay_w); }
      // Zina (VR): markazi, ko'tarilish yo'nalishi, uzunligi va yuqori qavatdagi chiqish joyi — uyning markazidagi koordinatalarda
      const stair = st && N > 1 ? { cx: X(st.center.x), cz: Z(st.center.z), dx: st.dir[0], dz: st.dir[1], L: st.L, W: Interior.STAIR_W, ex: X(st.exit.x), ez: Z(st.exit.z) } : null;
      return { rects, rectsF, doors, stair, fh, N };
    }

    // Ichki hajm: ichki reja yo'q bo'lsa — qorong'i hajm (deraza ortida bo'shliq ko'rinmasin), bo'lsa — real xonalar
    let dark = null, coll = null;
    out.add(ceilG);
    if (interior) coll = addInterior(interior);
    else { dark = box(W - 2 * T + 0.02, Hb, D - 2 * T + 0.02, track(new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 1 })), 0, Hb / 2, 0, false); out.add(dark); }

    // Qavat belbog'lari
    for (let f = 1; f < p.floors; f++) {                           // tasma: to'rt tomonda 10 sm, ichi bo'sh (kesimda xonalar tepadan ko'rinadi)
      const y = f * p.floor_h;
      out.add(box(W + 0.16, 0.12, 0.1, ledgeMat, 0, y, D / 2 + 0.03), box(W + 0.16, 0.12, 0.1, ledgeMat, 0, y, -D / 2 - 0.03),
              box(0.1, 0.12, D, ledgeMat, W / 2 + 0.03, y, 0), box(0.1, 0.12, D, ledgeMat, -W / 2 - 0.03, y, 0));
    }

    const roofMark = out.children.length;                         // shundan keyingi hamma narsa tom (kesimda yashiriladi)
    // ---- Tom ----
    const slab = (extra) => box(W + extra, 0.3, D + extra, plainMat, 0, Hb + 0.15, 0);
    const parapet = (h) => {
      const y = Hb + 0.3 + h / 2;
      out.add(box(W + 0.3, h, 0.3, plainMat, 0, y, D / 2 - 0.15), box(W + 0.3, h, 0.3, plainMat, 0, y, -D / 2 + 0.15),
              box(0.3, h, D - 0.3, plainMat, W / 2 - 0.15, y, 0), box(0.3, h, D - 0.3, plainMat, -W / 2 + 0.15, y, 0));
    };
    out.add(box(W + 0.5, 0.22, D + 0.5, ledgeMat, 0, Hb, 0));       // karniz

    if (p.roof === "tekis") { out.add(slab(0.3)); parapet(0.9); }

    if (p.roof === "nishab") {
      const oh = 0.55, R = g.R, yE = Hb - R * oh / (W / 2), len = Math.hypot(W / 2 + oh, Hb + R - yE), ang = Math.atan2(Hb + R - yE, W / 2 + oh);
      const mid = (-(W / 2 + oh) + 0) / 2, midY = (yE + Hb + R) / 2;
      const sl = box(len, 0.25, D + 2 * oh, roofMat, mid, midY + 0.12, 0); sl.rotation.z = ang;
      const sr = box(len, 0.25, D + 2 * oh, roofMat, -mid, midY + 0.12, 0); sr.rotation.z = -ang;
      out.add(sl, sr);
      const tri = new THREE.Shape(); tri.moveTo(-W / 2, 0); tri.lineTo(W / 2, 0); tri.lineTo(0, R); tri.lineTo(-W / 2, 0);
      const triGeo = track(new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false }));
      const triMat = wallMat(W, R);
      out.add(mk(triGeo, triMat, 0, Hb, D / 2 - T));
      const gb = mk(triGeo, triMat, 0, Hb, -(D / 2 - T)); gb.rotation.y = Math.PI; out.add(gb);
    }

    if (p.roof === "bir") {                                       // bir nishabli tom: qiya plita + old/orqa devor uchburchagi
      const oh = 0.55, R = g.R, k = R / W, len = Math.hypot(W + 2 * oh, R + 2 * k * oh), ang = Math.atan2(R, W);
      const sl = box(len, 0.3, D + 2 * oh, roofMat, 0, Hb + R / 2 + 0.15, 0); sl.rotation.z = ang; out.add(sl);
      const tri = new THREE.Shape(); tri.moveTo(-W / 2, 0); tri.lineTo(W / 2, 0); tri.lineTo(W / 2, R); tri.lineTo(-W / 2, 0);
      const triGeo = track(new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false })), triMat = wallMat(W, R);
      out.add(mk(triGeo, triMat, 0, Hb, D / 2 - T), mk(triGeo, triMat, 0, Hb, -D / 2));
      out.add(box(T, R, D, wallMat(D, R), W / 2 - T / 2, Hb + R / 2, 0));             // baland tomondagi yon devor
    }
    if (p.roof === "piramida") {                                  // to'rt nishabli tom: cho'qqisi markazda
      const oh = 0.55, a = W / 2 + oh, b = D / 2 + oh, top = Hb + g.R;
      const A = [-a, Hb, b], B = [a, Hb, b], C = [a, Hb, -b], E = [-a, Hb, -b], P = [0, top, 0];
      const geo = track(new THREE.BufferGeometry());
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...A, ...B, ...P, ...B, ...C, ...P, ...C, ...E, ...P, ...E, ...A, ...P]), 3));
      geo.computeVertexNormals();
      out.add(mk(geo, roofMat, 0, 0, 0));
    }

    if (p.roof === "gumbaz") {
      out.add(slab(0.3)); parapet(0.9);
      const r = g.domeR, dh = r * 0.45, y0 = Hb + 0.3;
      out.add(mk(track(new THREE.CylinderGeometry(r, r, dh, 48)), plainMat, 0, y0 + dh / 2, 0));
      const n = Math.max(6, Math.round(r * 2));
      for (let i = 0; i < n; i++) {                                    // baraban derazachalari
        const a = (i / n) * Math.PI * 2;
        const w = box(0.5, dh * 0.55, 0.12, glassMat, Math.sin(a) * (r + 0.01), y0 + dh * 0.5, Math.cos(a) * (r + 0.01), false);
        w.rotation.y = a; out.add(w);
      }
      const dome = mk(track(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2)),
        track(new THREE.MeshStandardMaterial({ color: 0x2a9896, roughness: 0.35, metalness: 0.3 })), 0, y0 + dh, 0);
      dome.scale.y = 1.15; out.add(dome);
      out.add(mk(track(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8)), ironMat, 0, y0 + dh + r * 1.15 + 0.55, 0));
    }

    if (p.roof === "terrasa") {
      out.add(slab(0.3)); parapet(0.5);
      const pw = W * 0.5, pd = D * 0.6, ph = p.floor_h, y0 = Hb + 0.3;
      const pav = box(pw, ph, pd, glassMat, 0, y0 + ph / 2, 0, false);
      out.add(pav);
      const edges = new THREE.LineSegments(track(new THREE.EdgesGeometry(pav.geometry)), track(new THREE.LineBasicMaterial({ color: 0x2a2f33 })));
      edges.position.copy(pav.position); out.add(edges);
      out.add(box(pw + 1.2, 0.3, pd + 1.2, ironMat, 0, y0 + ph + 0.15, 0));
    }
    const roofG = new THREE.Group();
    out.children.slice(roofMark).forEach(c => roofG.add(c));
    out.add(roofG);
    return { group: out, g, roofG, ceilG, floorGs, wallGroups: [front, back, right, left], frontG: front, dark, coll };
  }

  // ---------- Geometrik yordamchi chiziqlar (o'lchamlar, o'qlar, diagonallar, chegara qutisi) ----------
  const f1m = v => (Math.round(v * 10) / 10).toLocaleString("ru-RU");
  function textSprite(text, unit) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "rgba(20,24,28,.85)"; x.beginPath(); x.roundRect ? x.roundRect(2, 8, 252, 48, 10) : x.rect(2, 8, 252, 48); x.fill();
    x.fillStyle = "#ffffff"; x.font = "600 30px 'JetBrains Mono', Consolas, monospace"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, 128, 33);
    const tex = track(new THREE.CanvasTexture(c));
    const sp = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
    sp.scale.set(unit * 4, unit, 1); sp.renderOrder = 30;
    return sp;
  }
  function addGeo(layout, f, accent, extent, gap) {
    const unit = clamp(extent * 0.042, 0.9, 3.1), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const dashed = new THREE.LineDashedMaterial({ color: accent, dashSize: unit * 0.6, gapSize: unit * 0.35, depthTest: false, transparent: true, opacity: 0.9 });
    const solid = new THREE.LineBasicMaterial({ color: accent, depthTest: false, transparent: true, opacity: 0.95 });
    track(dashed); track(solid);
    const seg = (pts, mat) => {
      const geo = track(new THREE.BufferGeometry().setFromPoints(pts));
      const ln = new THREE.LineSegments(geo, mat); ln.computeLineDistances(); ln.renderOrder = 25; geoGroup.add(ln); return ln;
    };
    // O'lcham chizig'i: asosiy chiziq + ikki chekkada tish + yozuv
    const dim = (a, b, label, tick) => {
      const t = tick || V(0, unit * 0.35, 0);
      seg([a, b, a.clone().sub(t), a.clone().add(t), b.clone().sub(t), b.clone().add(t)], solid);
      const sp = textSprite(label, unit); sp.position.copy(a.clone().add(b).multiplyScalar(0.5)).add(V(0, unit * 0.9, 0)); geoGroup.add(sp);
    };
    layout.forEach(b => {
      const { cx, cz, w: W, d: D, H } = b;               // plandagi (burilishni hisobga olgan) eni va chuqurligi
      if (f.axes) {
        dim(V(cx - W / 2, 0.08, cz + D / 2 + unit * 1.8), V(cx + W / 2, 0.08, cz + D / 2 + unit * 1.8), `${f1m(W)} m`, V(0, 0, unit * 0.35));   // eni
        dim(V(cx + W / 2 + unit * 1.8, 0.08, cz - D / 2), V(cx + W / 2 + unit * 1.8, 0.08, cz + D / 2), `${f1m(D)} m`, V(unit * 0.35, 0, 0));   // chuqurlik
        dim(V(cx - W / 2 - unit * 1.8, 0, cz + D / 2), V(cx - W / 2 - unit * 1.8, H, cz + D / 2), `${f1m(H)} m`, V(unit * 0.35, 0, 0));          // balandlik
        seg([V(cx, 0.08, cz), V(cx, H + unit * 2.5, cz)], dashed);                                                                                // markaziy o'q
      }
      if (f.diag) {
        const y = 0.1;
        seg([V(cx - W / 2, y, cz - D / 2), V(cx + W / 2, y, cz + D / 2), V(cx + W / 2, y, cz - D / 2), V(cx - W / 2, y, cz + D / 2)], dashed);   // plan diagonallari
        const sp = textSprite(`d = ${f1m(Math.hypot(W, D))} m`, unit); sp.position.set(cx, H + unit * 1.5, cz); geoGroup.add(sp);   // plan diagonali yozuvi tom ustida: eni yozuvi bilan ustma-ust tushmasin
        const box = new THREE.LineSegments(track(new THREE.EdgesGeometry(track(new THREE.BoxGeometry(W, H, D)))), dashed);   // chegara qutisi
        box.position.set(cx, H / 2, cz); box.computeLineDistances(); box.renderOrder = 25; geoGroup.add(box);
      }
    });
    if (f.axes && layout.length > 1) {                              // uylar orasidagi eng qisqa masofa (har juftlik)
      for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
        const gp = footGap(layout[i], layout[j]); if (gp <= 0) continue;
        const [x1, z1, x2, z2] = footNearest(layout[i], layout[j]), along = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
        dim(V(x1, 0.08, z1), V(x2, 0.08, z2), `${f1m(gp)} m`, along ? V(0, 0, unit * 0.35) : V(unit * 0.35, 0, 0));
      }
    }
  }
  // ---------- Majmuani yig'ish ----------
  function drawLabel(entry, i, active) {
    const x = entry.canvas.getContext("2d");
    x.clearRect(0, 0, 128, 128);
    x.beginPath(); x.arc(64, 64, 52, 0, Math.PI * 2);
    x.fillStyle = active ? accentCss : "rgba(20,24,28,.8)"; x.fill();
    x.lineWidth = 6; x.strokeStyle = "#ffffff"; x.stroke();
    x.fillStyle = "#ffffff"; x.font = "700 64px Archivo, Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(String(i + 1), 64, 68);
    entry.tex.needsUpdate = true;
  }
  // Faol uy ostidagi plita va raqam belgilari qayta yig'ishsiz yangilanadi
  function refreshMarks() {
    const many = bGroups.length > 1;
    const canMove = many || yardItems.length > 0;            // bitta uyda ham hovli elementlarini surish mumkin
    if (bar) { bar.querySelector('[data-v="move"]').hidden = !canMove; bar.querySelector('[data-v="rot"]').hidden = !many; }
    if (!canMove && moveMode) setMoveMode(false);
    plates.forEach((pl, i) => { pl.visible = many && i === activeIdx; });
    labels.forEach((lb, i) => { lb.sprite.visible = many; drawLabel(lb, i, i === activeIdx); });
  }


  function build(site) {
    disposables.splice(0).forEach(o => o.dispose && o.dispose());
    if (group) scene.remove(group);
    group = new THREE.Group();
    scene.add(group);
    plates = []; labels = []; bGroups = []; lampBudget = 8;
    if (vrSel) scene.remove(vrSel);
    activeIdx = clamp(site.active || 0, 0, site.list.length - 1);

    const accent = cssColor("--accent", "#2b4acb");
    accentCss = accent.getStyle();
    const shared = {
      glassMat: track(real ? new THREE.MeshStandardMaterial({ color: 0x1e2c38, roughness: 0.03, metalness: 0.92, envMapIntensity: 1.35, transparent: true, opacity: 0.9, side: THREE.DoubleSide })   // osmonni aks ettiradi
                           : new THREE.MeshStandardMaterial({ color: 0x4d7396, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.72, side: THREE.DoubleSide })),
      ironMat: track(new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: real ? 0.45 : 0.6, metalness: real ? 0.6 : 0 })),
      roofMat: track(real ? realMat("roof", "#7e4632") : new THREE.MeshStandardMaterial({ color: 0x6a5047, roughness: 0.8 })),
    };

    const items = site.list.map(b => makeBuilding(b.params, b.cells, shared, b.interior));
    const n = items.length, gap = n > 1 ? site.gap : 0;
    // Har bir uy o'z joyida (Site: x, z, burilish); joylashuv berilmagan bo'lsa — ko'cha bo'ylab bir qatorda
    const layout = siteLayout(site.list, site.gap), bb = bboxOf(layout);
    const totalW = bb.x1 - bb.x0, Dmax = bb.z1 - bb.z0, Hmax = Math.max(...items.map(it => it.g.H));
    const mx = (bb.x0 + bb.x1) / 2, mz = (bb.z0 + bb.z1) / 2;


    items.forEach((it, i) => {
      const { cx, cz, W, D, H } = layout[i];
      it.group.position.set(cx, 0, cz); it.group.rotation.y = (layout[i].rot * Math.PI) / 180;
      it.group.userData.bIndex = i;
      it.roofG.add(it.ceilG);                                        // shift tom bilan birga olinadi (ichkari tepadan ochiq ko'rinadi)
      it.roofG.userData.part = "roof"; it.roofG.userData.anchor = "roof";
      it.wallGroups.forEach((w, k) => { w.userData.anchor = "w" + k; });
      it.group.userData.parts = { roofG: it.roofG, ceilG: it.ceilG, floorGs: it.floorGs, wallGroups: it.wallGroups, frontG: it.frontG, dark: it.dark, n: site.list[i].params.floors,
                                  W: it.g.W, D: it.g.D, hasInt: !!site.list[i].interior };
      layout[i].coll = it.coll;
      group.add(it.group); bGroups.push(it.group);

      const plate = new THREE.Mesh(track(new THREE.BoxGeometry(W + 1.2, 0.1, D + 1.2)), track(new THREE.MeshBasicMaterial({ color: accent })));
      plate.position.set(cx, 0.05, cz); plate.rotation.y = it.group.rotation.y; group.add(plate); plates.push(plate);

      const c = document.createElement("canvas"); c.width = c.height = 128;
      const tex = track(new THREE.CanvasTexture(c));
      const sprite = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
      const sz = clamp(Hmax * 0.16, 2.6, 8);
      sprite.scale.set(sz, sz, 1); sprite.position.set(cx, H + sz * 0.8, cz); sprite.renderOrder = 20;
      group.add(sprite); labels.push({ sprite, canvas: c, tex });
    });
    refreshMarks();
    lastLayout = layout;
    geoGroup = new THREE.Group(); group.add(geoGroup);
    if (site.geo && (site.geo.axes || site.geo.diag)) addGeo(layout, site.geo, accent, Math.max(totalW, Dmax, Hmax), gap);

    // ---- Maydon: plinta, soya va to'r ----
    const surface = cssColor("--surface", "#e9ebea"), line = cssColor("--fg", "#222222");
    plinth = mk(track(new THREE.BoxGeometry(1, 0.2, 1)), track(new THREE.MeshStandardMaterial({ color: surface, roughness: 1 })), mx, -0.1, mz, false);
    plinth.scale.set(totalW + 6, 1, Dmax + 6); group.add(plinth);
    const shadowPlane = new THREE.Mesh(track(new THREE.PlaneGeometry(600, 600)), track(new THREE.ShadowMaterial({ opacity: 0.22 })));
    shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = -0.19; shadowPlane.receiveShadow = true;
    group.add(shadowPlane);
    const grid = new THREE.GridHelper(240, 60, line, line);
    grid.position.y = -0.2; grid.material.transparent = true; grid.material.opacity = 0.09; track(grid.geometry); track(grid.material);
    group.add(grid);
    // VR uchun keng yer sathi (oddiy rejimda yashirin)
    vrGround = new THREE.Mesh(track(new THREE.PlaneGeometry(900, 900)), track(new THREE.MeshStandardMaterial({ color: 0x6b7a63, roughness: 1 })));
    vrGround.rotation.x = -Math.PI / 2; vrGround.position.y = -0.215; vrGround.receiveShadow = true;
    vrGround.visible = vr.on || !!vr.xr;
    group.add(vrGround);
    if (vr.xr) group.position.copy(vr.xrOffset);
    if (vr.on || vr.xr) { labels.forEach(l => { l.sprite.visible = false; }); plates.forEach(p => { p.visible = false; }); }
    // VR'da qaralayotgan katak belgisi (yarim shaffof to'ldirish + oq chegara); nur uni "ko'rmaydi"
    vrMark = new THREE.Group();
    const markFill = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1)), track(new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.35, depthTest: false, side: THREE.DoubleSide })));
    const markEdge = new THREE.LineSegments(track(new THREE.EdgesGeometry(track(new THREE.PlaneGeometry(1, 1)))), track(new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false })));
    markFill.renderOrder = 40; markEdge.renderOrder = 41; markFill.raycast = markEdge.raycast = () => {};
    vrMark.add(markFill, markEdge); vrMark.visible = false;
    vr.aim = null;
    // VR ichki dizayn: qo'yiladigan jihozning shaffof "arvohi" (yashil — sig'adi, qizil — yo'q) va qaralgan jihoz ramkasi
    vrGhost = new THREE.Group();
    const ghostM = track(new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.32, depthWrite: false }));
    const ghostBox = new THREE.Mesh(track(new THREE.BoxGeometry(1, 1, 1)), ghostM);
    const ghostEdge = new THREE.LineSegments(track(new THREE.EdgesGeometry(track(new THREE.BoxGeometry(1, 1, 1)))), track(new THREE.LineBasicMaterial({ color: 0xffffff })));
    ghostBox.raycast = ghostEdge.raycast = () => {}; vrGhost.add(ghostBox, ghostEdge); vrGhost.visible = false; vrGhost.userData.mat = ghostM;
    vrSel = new THREE.BoxHelper(undefined, 0xffd166); track(vrSel.geometry); track(vrSel.material); vrSel.raycast = () => {}; vrSel.visible = false; scene.add(vrSel);
    vr.faim = null;

    // ---- Kamera va yorug'lik ----
    const R = 0.5 * Math.sqrt(totalW * totalW + Dmax * Dmax + Hmax * Hmax);
    center.set(mx, Hmax * 0.45 - R * 0.16, mz);     // majmua kadrda biroz yuqoriroq turadi: pastda tugmalar uchun joy qoladi
    baseDist = (R / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.08;
    const s = Math.max(totalW, Dmax, Hmax) * 0.85 + 6;
    sun.position.set(mx + totalW * 0.7 + 8, Hmax * 1.3 + 14, mz + Dmax * 0.9 + 12);
    sun.target.position.set(mx, Hmax * 0.3, mz);
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: s * 6 + 200 });
    sun.shadow.camera.updateProjectionMatrix();
    sunBox = { cx: mx, cz: mz, dist: s * 3 + 40 };
    applySun();
    buildYard(site);
    if (real) {                                                      // realistik: maket plintasi va to'r o'rniga maysa, osmon, daraxtlar
      ensureSky(); plinth.visible = false; grid.visible = false; shadowPlane.visible = false;
      realSurroundings(layout, mx, mz, Math.max(totalW, Dmax));
    }
    updateSky(); realPost(group);
    selBox = new THREE.BoxHelper(undefined, 0xffd166); track(selBox.geometry); track(selBox.material); selBox.raycast = () => {}; selBox.visible = false; selBox.material.depthTest = false; selBox.renderOrder = 30; group.add(selBox);
    restoreParts();
    applyCut();
    if (vr.on) { let n = 0; while (vrBlocked(vr.x, vr.z) && n++ < 400) vr.z += 0.5; }   // uy kattalashsa, odam fasad oldiga suriladi
  }

  // ---------- Kamera, boshqaruv, chizish ----------
  function placeCamera() {
    const d = baseDist * zoom, sp = Math.sin(phi);
    camera.position.set(center.x + d * sp * Math.sin(theta), center.y + d * Math.cos(phi), center.z + d * sp * Math.cos(theta));
    camera.lookAt(center);
  }
  function render() {
    if (!renderer || !host.clientWidth || !host.clientHeight) return;
    if (vr.on) { vrRender(); return; }
    placeCamera();
    renderer.render(scene, camera);
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(pixelRatioFor(w, h));
    renderer.setSize(w, h, false);
    const res = vr.ui && vr.ui.querySelector('[data-vo="res"]');
    if (res) res.textContent = `${renderer.domElement.width}×${renderer.domElement.height}`;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    request();
  }
  function request() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (vr.on) { vrStep(dt); render(); request(); return; }   // VR: har kadrda harakat va chizish
    let again = false;
    if (auto) { theta += dt * 0.2; tTheta = theta; again = true; }
    else {
      const k = 1 - Math.pow(0.0006, dt), dT = tTheta - theta, dP = tPhi - phi;
      if (Math.abs(dT) > 1e-3 || Math.abs(dP) > 1e-3) { theta += dT * k; phi += dP * k; again = true; }
    }
    if (tweens.length) { stepTweens(now); refreshSel(); again = true; }
    if (riseStart) {
      const k = clamp((now - riseStart) / 950, 0, 1);
      if (group) group.scale.y = 0.02 + 0.98 * ease(k);
      if (k >= 1) { riseStart = 0; if (group) group.scale.y = 1; } else again = true;
    }
    render();
    if (again) request(); else last = 0;
  }

  function stopAuto() {
    if (!auto) return;
    auto = false; tTheta = theta; tPhi = phi;
    const b = bar && bar.querySelector('[data-v="auto"]'); if (b) b.setAttribute("aria-pressed", "false");
  }
  function goTo(t, ph) {
    stopAuto();
    let d = (t - theta) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    tTheta = theta + d; tPhi = ph; request();
  }

  // ---------- Ko'chirish rejimi: uyni 3D'da yer ustida sudrash ----------
  let moveMode = false, mv = null, plinth = null, geoGroup = null;
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), gpt = new THREE.Vector3();
  function groundAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(groundPlane, gpt);
  }
  // Kursor ostidagi uy yoki hovli elementi: { kind: "b" | "y", i }
  function hitAny(e) {
    if (!groundAt(e)) return null;
    const hit = ray.intersectObjects([...bGroups, ...yardItems], true)[0];
    let o = hit && hit.object;
    while (o && o.userData.bIndex === undefined && o.userData.yi === undefined) o = o.parent;
    return o ? (o.userData.bIndex !== undefined ? { kind: "b", i: o.userData.bIndex } : { kind: "y", i: o.userData.yi }) : null;
  }
  function setMoveMode(on) {
    moveMode = on; mv = null;
    if (on && partsMode) setPartsMode(false);
    const b = bar.querySelector('[data-v="move"]'); if (b) b.setAttribute("aria-pressed", String(on));
    host.classList.toggle("moving", on);
    host.querySelector(".v3-hint").textContent = on ? "Uy yoki hovli elementini sudrang — ko'chirish · ↻ — faol uyni burish" : "Sudrang: aylantirish";
    if (on) stopAuto();
  }
  // Faqat joylashuv o'zgarganda: uylar qayta yig'ilmaydi, joyi va burilishi yangilanadi (sudrash silliq bo'lsin)
  function applyPositions(site) {
    const L = siteLayout(site.list, site.gap), bb = bboxOf(L);
    L.forEach((l, i) => {
      const g = bGroups[i]; if (!g) return;
      g.position.set(l.cx, 0, l.cz); g.rotation.y = (l.rot * Math.PI) / 180;
      plates[i].position.set(l.cx, 0.05, l.cz); plates[i].rotation.y = g.rotation.y;
      labels[i].sprite.position.x = l.cx; labels[i].sprite.position.z = l.cz;
    });
    if (plinth) { plinth.position.set((bb.x0 + bb.x1) / 2, -0.1, (bb.z0 + bb.z1) / 2); plinth.scale.set(bb.x1 - bb.x0 + 6, 1, bb.z1 - bb.z0 + 6); }
    if (geoGroup) geoGroup.visible = false;          // o'lcham chiziqlari to'liq yig'ishda yangidan chiziladi
    L.forEach((l, i) => { l.coll = lastLayout[i] && lastLayout[i].coll; });     // VR to'siqlari uy bilan birga ko'chadi
    lastLayout = L;
  }
  const bboxOf = L => ({ x0: Math.min(...L.map(l => l.cx - l.w / 2)), x1: Math.max(...L.map(l => l.cx + l.w / 2)),
                         z0: Math.min(...L.map(l => l.cz - l.d / 2)), z1: Math.max(...L.map(l => l.cz + l.d / 2)) });

  // ---------- Kesim: tom va old devor olinadi, tanlangan qavatdan yuqorisi yashiriladi (ichkarini ko'rish uchun) ----------
  let cutLvl = -1;
  function applyCut() {
    const lvl = vr.on || vr.xr ? -1 : cutLvl, cut = lvl >= 0;
    bGroups.forEach(g => {
      const P = g.userData.parts; if (!P) return;
      P.roofG.visible = !cut; P.ceilG.visible = !cut; P.frontG.visible = !cut; if (P.dark) P.dark.visible = !cut;
      P.floorGs.forEach((G, f) => { G.visible = !cut || f <= lvl; });
      P.wallGroups.forEach(w => w.children.forEach(c => { c.visible = !cut || c.userData.fl <= lvl; }));
    });
    const b = bar && bar.querySelector('[data-v="cut"]');
    if (b) { b.setAttribute("aria-pressed", String(cutLvl >= 0)); b.textContent = cutLvl >= 0 ? `Kesim · ${cutLvl + 1}-q` : "Kesim"; }
    refreshSel(); updateIntUI();
    request();
  }
  function cycleCut() {
    const maxN = Math.max(1, ...bGroups.map(g => (g.userData.parts ? g.userData.parts.n : 1)));
    cutLvl = cutLvl < 0 ? maxN - 1 : cutLvl - 1;
    applyCut();
  }

  // ---------- Detallar: tom, devor, balkon va soyabonni olib, boshqa joyga qo'yish; tom olinganda ichki dizayn ----------
  // Detal joyi faqat shu ko'rinishda (loyiha ma'lumotiga yozilmaydi); uy qayta yig'ilganda ham saqlanadi.
  // Kalit: `${uy}|${langar}|${langardan yo'l}` — langar: "roof" yoki "w<devor raqami>" (ichki reja qo'shilsa ham o'zgarmaydi)
  let partsMode = false, pd = null, fsel = null, selBox = null, intUI = null;
  const detached = new Map(), tweens = [];
  const PART_NAMES = { roof: "Tom", balc: "Balkon", wall: "Devor", canopy: "Soyabon" };
  const WALL_COLORS = ["#f1ede3", "#ffffff", "#e8dcc8", "#d9e3e8", "#dfe8d6", "#f0d9cf", "#c9c3b8", "#5c6670"];
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), dpt = new THREE.Vector3(), box3 = new THREE.Box3();
  const partsHint = () => "Tom, devor, balkon yoki mebelni sudrang · joyiga yaqin qo'yilsa qaytadi";
  let sayT = 0;
  function say(t) {
    const h = host.querySelector(".v3-hint"); h.textContent = t;
    clearTimeout(sayT); sayT = setTimeout(() => { h.textContent = partsMode ? partsHint() : moveMode ? h.textContent : "Sudrang: aylantirish"; }, 2400);
  }

  function rayAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  // Raycaster yashirin obyektlarni ham ko'radi: kesimda yashiringan qavatlar tanlanmasin
  function visibleHit(hits) {
    for (const h of hits) { let o = h.object, ok = true; while (o) { if (!o.visible) { ok = false; break; } o = o.parent; } if (ok) return h; }
    return null;
  }
  function anchorKey(o) {
    const path = [];
    while (o && o.userData.anchor === undefined) { if (!o.parent) return null; path.unshift(o.parent.children.indexOf(o)); o = o.parent; }
    return o ? o.userData.anchor + "|" + path.join(".") : null;
  }
  function byKey(P, key) {
    const [a, path] = key.split("|");
    let o = a === "roof" ? P.roofG : P.wallGroups[Number(a.slice(1))];
    if (path) for (const k of path.split(".")) o = o && o.children[Number(k)];
    return o;
  }
  const roofOff = i => { const g = bGroups[i]; return !!(g && g.userData.parts && g.userData.parts.roofG.userData.off); };
  const canEdit = i => { const g = bGroups[i]; return !!(g && g.userData.parts && g.userData.parts.hasInt && (roofOff(i) || cutLvl >= 0)); };
  const editFloor = i => { const n = bGroups[i].userData.parts.n; return cutLvl >= 0 ? Math.min(cutLvl, n - 1) : n - 1; };

  function partHit(e) {
    rayAt(e);
    const h = visibleHit(ray.intersectObjects(bGroups, true)); if (!h) return null;
    let o = h.object, item = null, part = null;
    while (o && o.userData.bIndex === undefined) { if (!item && !part && o.userData.it) item = o; if (!part && o.userData.part) part = o; o = o.parent; }
    return o ? { i: o.userData.bIndex, g: o, item, part, point: h.point } : null;
  }
  function tweenTo(obj, to) { tweens.push({ obj, from: obj.position.clone(), to, t0: performance.now() }); request(); }
  function stepTweens(now) {
    for (let k = tweens.length - 1; k >= 0; k--) {
      const t = tweens[k], q = clamp((now - t.t0) / 320, 0, 1);
      t.obj.position.lerpVectors(t.from, t.to, ease(q));
      if (q >= 1) tweens.splice(k, 1);
    }
  }
  // Detalni yerga qo'yish: pastki qirrasi yer sathida (uy guruhlari faqat y o'qi atrofida buriladi)
  function groundPos(obj) {
    obj.updateMatrixWorld(true); box3.setFromObject(obj);
    return obj.position.clone().setY(obj.position.y - (box3.min.y - (group ? group.position.y : 0)));
  }
  function partDrop(obj, i, key) {
    const home = new THREE.Vector3().fromArray(obj.userData.home);
    if (Math.hypot(obj.position.x - home.x, obj.position.z - home.z) < 1.2) {        // joyiga yaqin qo'yildi — o'rniga qaytadi
      obj.userData.off = false; detached.delete(key); tweenTo(obj, home);
      say(`${PART_NAMES[obj.userData.part] || "Detal"} joyiga qaytdi`);
    } else {
      const to = groundPos(obj);
      obj.userData.off = true; detached.set(key, { kind: obj.userData.part, pos: to.toArray() });
      tweenTo(obj, to);
      if (obj.userData.part === "roof") say(bGroups[i].userData.parts.hasInt ? "Tom olindi — endi ichki dizayn qilish mumkin" : "Tom olindi — ichki reja yaratib, xonalarni bezang");
    }
    updateIntUI();
  }
  // Tomni bir tugma bilan uy yoniga olib qo'yish / qaytarish
  function toggleRoof(i) {
    const g = bGroups[i]; if (!g || !g.userData.parts) return;
    const P = g.userData.parts, R = P.roofG, key = `${i}|roof|`;
    if (!R.children.length) { say("Bu binoning olinadigan tomi yo'q"); return; }
    if (!R.userData.home) R.userData.home = R.position.toArray();
    if (R.userData.off) { R.userData.off = false; detached.delete(key); tweenTo(R, new THREE.Vector3().fromArray(R.userData.home)); updateIntUI(); return; }
    if (cutLvl >= 0) { cutLvl = -1; applyCut(); }
    const save = R.position.clone();
    R.position.x += P.W + 3;                                          // uyning yoniga, yerga
    const to = groundPos(R); R.position.copy(save);
    R.userData.off = true; detached.set(key, { kind: "roof", pos: to.toArray() });
    tweenTo(R, to); updateIntUI();
    say(P.hasInt ? "Tom olindi — mebelni sudrang, devor va pol pardozini tanlang" : "Tom olindi — ichki reja yarating");
  }
  function resetParts() {
    bGroups.forEach(g => {
      const P = g.userData.parts; if (!P) return;
      [P.roofG, ...P.wallGroups].forEach(a => a.traverse(o => {
        if (o.userData.off) { o.userData.off = false; tweenTo(o, new THREE.Vector3().fromArray(o.userData.home)); }
      }));
    });
    detached.clear(); updateIntUI();
  }
  // Uy qayta yig'ilganda olingan detallar yangi sahnada ham o'sha joyda turadi
  function restoreParts() {
    tweens.length = 0;
    detached.forEach((v, key) => {
      const k = key.indexOf("|"), g = bGroups[Number(key.slice(0, k))], o = g && g.userData.parts && byKey(g.userData.parts, key.slice(k + 1));
      if (!o || o.userData.part !== v.kind) { detached.delete(key); return; }
      o.userData.home = o.position.toArray(); o.position.fromArray(v.pos); o.userData.off = true;
    });
  }

  // ---- Mebel tanlash va sudrash ----
  function findItem(s) {
    const g = s && bGroups[s.i], G = g && g.userData.parts && g.userData.parts.floorGs[s.f];
    return G && G.visible ? G.children.find(c => c.userData.it && c.userData.it.idx === s.idx) || null : null;
  }
  function refreshSel(color) {
    if (!selBox) return;
    const o = partsMode ? findItem(fsel) : null;
    if (!o) { selBox.visible = false; if (!pd) fsel = null; return; }
    selBox.setFromObject(o); selBox.visible = true; selBox.material.color.set(color || 0xffd166);
  }
  const itemsOf = (i, f) => { const b = lastArgs.site.list[i]; return Interior.norm(b.params, b.interior || {}).floors[f].items; };
  const furnEdit = (op, a) => (window.View3D.onVrEdit ? window.View3D.onVrEdit(a.i, op, a) : false);

  function partsDown(e) {
    const h = partHit(e); if (!h) return false;
    const V = window.View3D;
    if (h.item && canEdit(h.i)) {                                      // mebel: o'z qavati tekisligida sudraladi
      const u = h.item.userData.it; fsel = { i: h.i, f: u.f, idx: u.idx };
      if (h.i !== activeIdx && V.onPick) V.onPick(h.i);
      const b = lastArgs.site.list[h.i];
      pd = { kind: "furn", obj: h.item, id: e.pointerId, i: h.i, start: h.point.clone(), pos0: h.item.position.clone(), moved: false,
             p: b.params, I: Interior.norm(b.params, b.interior || {}), P: h.g.userData.parts };
      refreshSel(); updateIntUI();
    } else if (h.part) {
      const o = h.part; if (!o.userData.home) o.userData.home = o.position.toArray();
      if (h.i !== activeIdx && V.onPick) V.onPick(h.i);
      pd = { kind: "part", obj: o, id: e.pointerId, i: h.i, start: h.point.clone(), pos0: o.position.clone(), moved: false, key: `${h.i}|${anchorKey(o)}` };
      say(`${PART_NAMES[o.userData.part] || "Detal"}: sudrab, kerakli joyga qo'ying`);
    } else return false;
    dragPlane.constant = -h.point.y;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    host.classList.add("drag");
    return true;
  }
  function partsMove(e) {
    if (e.pointerId !== pd.id) return;
    rayAt(e); if (!ray.ray.intersectPlane(dragPlane, dpt)) return;
    const par = pd.obj.parent, a = par.worldToLocal(pd.start.clone()), b = par.worldToLocal(dpt.clone());
    const pos = pd.pos0.clone().add(b.sub(a)); pos.y = pd.pos0.y;
    if (pos.distanceTo(pd.pos0) > 0.05) pd.moved = true;
    if (pd.kind === "furn") {                                         // uyning ichki tizimi: x 0..W, z 0..D; 5 sm qadam
      const W = pd.P.W, D = pd.P.D, x = Math.round((pos.x + W / 2) * 20) / 20, z = Math.round((pos.z + D / 2) * 20) / 20;
      const it = pd.I.floors[fsel.f].items[fsel.idx];
      pd.ok = !!it && Interior.fits(pd.p, pd.I, fsel.f, [it[0], x, z, it[3]], fsel.idx); pd.x = x; pd.z = z;
      pd.obj.position.set(x - W / 2, pd.pos0.y, z - D / 2);
      refreshSel(pd.ok ? 0x2ecc71 : 0xe74c3c);
    } else pd.obj.position.copy(pos);
    request();
  }
  function partsUp(e, cancel) {
    if (e && e.pointerId !== pd.id) return;
    const d = pd; pd = null; host.classList.remove("drag");
    if (d.kind === "furn") {
      if (d.moved && !cancel && d.ok) { if (furnEdit("furnMove", { i: d.i, f: fsel.f, idx: fsel.idx, x: d.x, z: d.z }) === false) d.obj.position.copy(d.pos0); }
      else if (d.moved) { d.obj.position.copy(d.pos0); if (!cancel) say("Bu yerga sig'maydi — devor yoki boshqa jihozga tegadi"); }
      refreshSel(); request(); return;
    }
    if (cancel || !d.moved) { d.obj.position.copy(d.pos0); request(); return; }
    partDrop(d.obj, d.i, d.key);
  }
  function setPartsMode(on) {
    partsMode = on; if (on && moveMode) setMoveMode(false);
    const b = bar.querySelector('[data-v="parts"]'); if (b) b.setAttribute("aria-pressed", String(on));
    host.classList.toggle("parts", on);
    host.querySelector(".v3-hint").textContent = on ? partsHint() : "Sudrang: aylantirish";
    if (on) stopAuto(); else fsel = null;
    refreshSel(); updateIntUI(); request();
  }

  // ---- Ichki dizayn paneli (Detallar rejimida; tom olinganda yoki kesimda ochiladi) ----
  const esc3 = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function updateIntUI() {
    if (!intUI) return;
    const i = clamp(activeIdx, 0, Math.max(0, bGroups.length - 1)), g = bGroups[i];
    if (!partsMode || !g || !g.userData.parts || vr.on || !lastArgs) { intUI.hidden = true; return; }
    const P = g.userData.parts, off = roofOff(i), open = off || cutLvl >= 0;
    let h = `<div class="v3i-row"><button type="button" data-p="roof" aria-pressed="${off}">${off ? "Tomni qaytarish" : "Tomni olish"}</button><button type="button" data-p="reset" title="Barcha olingan detallarni joyiga qaytarish">Hammasini joyiga</button></div>`;
    if (open && !P.hasInt) h += `<p class="v3i-note">Bu uyda ichki reja yo'q.</p><div class="v3i-row"><button type="button" data-p="auto">Ichki reja yaratish</button></div>`;
    else if (open) {
      const b = lastArgs.site.list[i], f = editFloor(i), fd = Interior.norm(b.params, b.interior || {}).floors[f];
      const it = fsel && fsel.i === i && fsel.f === f ? fd.items[fsel.idx] : null;
      const opts = Object.entries(Interior.GROUPS).map(([gk, gn]) => `<optgroup label="${esc3(gn)}">` +
        Object.entries(Interior.ITEMS).filter(([, d]) => d.g === gk).map(([k, d]) => `<option value="${k}">${esc3(d.n)}</option>`).join("") + "</optgroup>").join("");
      h += `<p class="v3i-h"><span>Ichki dizayn</span> · <span>${f + 1}-qavat</span></p>` +
        `<div class="v3i-row"><select data-p="type" aria-label="Jihoz turi">${opts}</select><button type="button" data-p="add">Qo'shish</button></div>` +
        `<div class="v3i-row"><span class="v3i-sel">${it ? esc3(Interior.ITEMS[it[0]].n) : "Jihozni bosib tanlang"}</span>` +
        `<button type="button" data-p="rot" ${it ? "" : "disabled"} title="Burish (R)">↻</button><button type="button" data-p="del" ${it ? "" : "disabled"} title="O'chirish (Delete)">✕</button>` +
        `<button type="button" data-p="undo" title="Orqaga">↶</button><button type="button" data-p="redo" title="Qayta">↷</button></div>` +
        `<p class="v3i-h">Devor bo'yog'i</p><div class="v3i-row">` +
        WALL_COLORS.map(c => `<button type="button" class="v3i-sw" data-wall="${c}" style="background:${c}" aria-pressed="${(fd.wall || "#f1ede3") === c}" title="${c}"></button>`).join("") + "</div>" +
        `<p class="v3i-h">Pol</p><div class="v3i-row">` +
        Object.entries(Interior.FLOORS).map(([k, n]) => `<button type="button" data-floor="${k}" aria-pressed="${(fd.floor || "parket") === k}">${esc3(n)}</button>`).join("") + "</div>";
    } else h += `<p class="v3i-note">Tomni oling yoki "Kesim"ni bosing — uy ichi ochiladi va xonalarni bezash mumkin.</p>`;
    const old = intUI.querySelector('[data-p="type"]'), kv = old ? old.value : null;
    intUI.innerHTML = h; intUI.hidden = false;
    const sel = intUI.querySelector('[data-p="type"]'); if (sel && kv) sel.value = kv;
  }
  function intClick(e) {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    const d = b.dataset, i = clamp(activeIdx, 0, Math.max(0, bGroups.length - 1)), edit = window.View3D.onVrEdit;
    if (d.p === "roof") { toggleRoof(i); return; }
    if (d.p === "reset") { resetParts(); return; }
    if (!edit || !bGroups[i]) return;
    const f = editFloor(i);
    if (d.p === "auto") { if (edit(i, "furnAuto", {}) === false) say("Ichki reja yaratilmadi"); }
    else if (d.p === "add") {
      const type = intUI.querySelector('[data-p="type"]').value;
      if (edit(i, "furnAdd", { f, type }) === false) { say(`${Interior.ITEMS[type].n} uchun bo'sh joy topilmadi`); return; }
      fsel = { i, f, idx: itemsOf(i, f).length - 1 }; say(`${Interior.ITEMS[type].n} qo'yildi — sudrab joyini tanlang`);
    } else if (d.p === "rot" && fsel) { if (furnEdit("furnRot", { i, f: fsel.f, idx: fsel.idx }) === false) say("Burilganda sig'maydi"); }
    else if (d.p === "del" && fsel) { furnEdit("furnDel", { i, f: fsel.f, idx: fsel.idx }); fsel = null; }
    else if (d.p === "undo" || d.p === "redo") { edit(i, d.p === "undo" ? "furnUndo" : "furnRedo", {}); fsel = null; }
    else if (d.wall) edit(i, "furnStyle", { f, wall: d.wall });
    else if (d.floor) edit(i, "furnStyle", { f, floor: d.floor });
    updateIntUI();
  }

  // ---------- Hovli: maysa, yo'lak, to'siq, darvoza va obodonlashtirish elementlari ----------
  let yardGroup = null, yardItems = [], yardR = null, yardFence = "yoq";
  const yardDisp = [], ytrack = o => { yardDisp.push(o); return o; };
  const ymat = (color, extra) => ytrack(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }));
  function ybox(w, h, d, m, x, y, z, parent, shadow = true) {
    const b = new THREE.Mesh(ytrack(new THREE.BoxGeometry(w, h, d)), m);
    b.position.set(x, y, z); b.castShadow = shadow; b.receiveShadow = true; parent.add(b); return b;
  }
  function ymesh(geo, m, x, y, z, parent, shadow = true) {
    const b = new THREE.Mesh(geo, m); b.position.set(x, y, z); b.castShadow = shadow; b.receiveShadow = true; parent.add(b); return b;
  }
  function makeItem(it, k, M) {
    const g = new THREE.Group();
    if (it.t === "tree") {                                        // daraxt: tana va ikki qavat shox-barg
      const s = 0.85 + ((k * 37) % 31) / 100;
      ymesh(M.trunkGeo, M.bark, 0, 1.1 * s, 0, g).scale.setScalar(s);
      ymesh(M.crownGeo, M.leaf, 0, 3.3 * s, 0, g).scale.set(s, s * 1.1, s);
      ymesh(M.crownGeo, M.leaf2, 0.55 * s, 2.7 * s, 0.35 * s, g).scale.setScalar(0.6 * s);
    } else if (it.t === "bed") {                                  // gulzor: tuproq va gullar
      ybox(3, 0.3, 1.6, M.soil, 0, 0.15, 0, g);
      for (let i = 0; i < 8; i++) ymesh(M.flowerGeo, M.flowers[i % 3], -1.1 + (i % 4) * 0.73, 0.4, i < 4 ? -0.35 : 0.35, g, false);
    } else if (it.t === "pool") {                                 // hovuz: tosh hoshiya va suv
      ybox(6.6, 0.24, 4.1, M.stone, 0, 0.12, 0, g);
      const w = new THREE.Mesh(ytrack(new THREE.PlaneGeometry(6, 3.5)), M.water); w.rotation.x = -Math.PI / 2; w.position.y = 0.25; g.add(w);
    } else if (it.t === "garage") {                               // garaj: devorlar, tekis tom va seksiyali darvoza (ko'cha tomonda)
      const wall = ymat(0xd9d2c3), dark = ymat(0x7d868c, { metalness: 0.4, roughness: 0.5 });
      ybox(4.2, 2.9, 6.6, wall, 0, 1.45, 0, g); ybox(4.5, 0.2, 6.9, ymat(0x5b6266), 0, 3.0, 0, g);
      ybox(3.2, 2.3, 0.06, dark, 0, 1.15, 3.31, g, false);
      for (let i = 1; i < 5; i++) ybox(3.2, 0.03, 0.08, ymat(0x5b6266), 0, i * 0.46, 3.34, g, false);
    } else if (it.t === "swim") {                                 // suzish basseyni: plitka hoshiya, ko'k suv, zinapoya tutqichi
      ybox(8.4, 0.2, 4.6, ymat(0xece6da), 0, 0.1, 0, g);
      const w = new THREE.Mesh(ytrack(new THREE.PlaneGeometry(7.6, 3.8)), ymat(0x2f9fd6, { roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.88 })); w.rotation.x = -Math.PI / 2; w.position.y = 0.21; g.add(w);
      [-0.35, 0.35].forEach(z => { const r = ymesh(ytrack(new THREE.TorusGeometry(0.35, 0.03, 6, 12, Math.PI)), ymat(0xc9ced1, { metalness: 0.7 }), 3.6, 0.2, z, g, false); r.rotation.y = Math.PI / 2; });
    } else if (it.t === "pine") {                                 // archa: konussimon qatlamlar
      const s = 0.9 + ((k * 29) % 23) / 100;
      ymesh(M.trunkGeo, M.bark, 0, 0.6 * s, 0, g).scale.set(0.7 * s, 0.6 * s, 0.7 * s);
      [[1.25, 1.6, 1.4], [0.95, 1.5, 2.5], [0.6, 1.3, 3.5]].forEach(([r, h, y]) => ymesh(ytrack(new THREE.ConeGeometry(r * s, h * s, 9)), ymat(0x2f5f35), 0, y * s, 0, g));
    } else if (it.t === "fruit") {                                // mevali daraxt: kichikroq toj va mevalar
      ymesh(M.trunkGeo, M.bark, 0, 0.9, 0, g).scale.setScalar(0.8);
      ymesh(M.crownGeo, M.leaf, 0, 2.7, 0, g).scale.set(0.85, 0.8, 0.85);
      const fm = ymat(k % 2 ? 0xd9472b : 0xf0a12a);
      for (let i = 0; i < 9; i++) { const t = i * 2.4; ymesh(ytrack(new THREE.SphereGeometry(0.13, 8, 6)), fm, Math.cos(t) * 1.25, 2.3 + (i % 3) * 0.35, Math.sin(t) * 1.25, g, false); }
    } else if (it.t === "bush") {                                 // buta
      ymesh(ytrack(new THREE.SphereGeometry(0.7, 12, 9)), M.leaf2, 0, 0.5, 0, g).scale.set(1, 0.75, 1);
    } else if (it.t === "fountain") {                             // favvora: dumaloq hovuz, ustun va kosa
      const st = M.stone;
      ymesh(ytrack(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 28)), st, 0, 0.25, 0, g);
      ymesh(ytrack(new THREE.CylinderGeometry(1.4, 1.4, 0.04, 28)), M.water, 0, 0.5, 0, g, false);
      ymesh(ytrack(new THREE.CylinderGeometry(0.18, 0.25, 1.2, 12)), st, 0, 1.0, 0, g);
      ymesh(ytrack(new THREE.CylinderGeometry(0.7, 0.3, 0.25, 20)), st, 0, 1.6, 0, g);
      ymesh(ytrack(new THREE.SphereGeometry(0.25, 10, 8)), M.water, 0, 1.85, 0, g, false);
    } else if (it.t === "gazebo") {                               // shiypon: olti ustun, supa va olti qirrali tom
      ybox(3.6, 0.3, 3.6, M.wood, 0, 0.15, 0, g);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ybox(0.14, 2.6, 0.14, M.wood, Math.cos(a) * 1.85, 1.6, Math.sin(a) * 1.85, g); }
      const roof = ymesh(ytrack(new THREE.ConeGeometry(2.6, 1.3, 6)), ymat(0x6a4a3a), 0, 3.55, 0, g); roof.rotation.y = Math.PI / 6;
    } else if (it.t === "tandir") {                               // tandir: loy gumbaz va og'zi
      const clay = ymat(0xc58a5a);
      ymesh(ytrack(new THREE.CylinderGeometry(0.75, 0.8, 0.5, 18)), ymat(0x9b7b5c), 0, 0.25, 0, g);
      ymesh(ytrack(new THREE.SphereGeometry(0.7, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2)), clay, 0, 0.5, 0, g).scale.y = 1.25;
      ymesh(ytrack(new THREE.TorusGeometry(0.22, 0.06, 8, 16)), clay, 0, 1.38, 0, g).rotation.x = Math.PI / 2;
    } else if (it.t === "bench") {                                // o'rindiq: o'tirgich, suyanchiq va oyoqlar
      ybox(1.8, 0.08, 0.5, M.wood, 0, 0.45, 0, g); ybox(1.8, 0.4, 0.06, M.wood, 0, 0.75, -0.25, g);
      [-0.8, 0.8].forEach(x => ybox(0.08, 0.45, 0.5, ymat(0x2a2f33), x, 0.22, 0, g));
    } else if (it.t === "play") {                                 // bolalar maydonchasi: yumshoq qoplama, tepalik, arg'imchoq
      const pad = new THREE.Mesh(ytrack(new THREE.PlaneGeometry(5.2, 4.2)), ymat(0xd65f45)); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; pad.receiveShadow = true; g.add(pad);
      ybox(1.2, 1.6, 1.2, ymat(0x3d7fc4), -1.6, 0.8, -0.9, g);
      const sl = ybox(0.8, 0.08, 2.6, ymat(0xf2c33a), -1.6, 0.85, 0.6, g); sl.rotation.x = -0.55;
      [[1.2, -1.4], [1.2, 1.4]].forEach(([x, z]) => ybox(0.1, 2.3, 0.1, ymat(0x2a2f33), x, 1.15, z, g));
      ybox(0.1, 0.1, 2.9, ymat(0x2a2f33), 1.2, 2.3, 0, g); ybox(0.5, 0.05, 0.3, ymat(0xf2c33a), 1.2, 0.5, 0, g);
    } else if (it.t === "lamp") {                                 // chiroq ustuni
      ybox(0.12, 3.2, 0.12, ymat(0x2a2f33), 0, 1.6, 0, g);
      ymesh(ytrack(new THREE.SphereGeometry(0.25, 12, 8)), ymat(0xfff2c2, { emissive: 0xffd77a, emissiveIntensity: 0.8 }), 0, 3.35, 0, g, false);
    } else if (it.t === "greenhouse") {                           // issiqxona: yarim silindr shaffof qobiq
      const sh = ymesh(ytrack(new THREE.CylinderGeometry(1.6, 1.6, 6.2, 18, 1, true, -Math.PI / 2, Math.PI)), ymat(0xcfe6e8, { transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 0.1 }), 0, 0, 0, g, false);
      sh.rotation.x = Math.PI / 2; sh.rotation.z = Math.PI / 2;
      for (let i = 0; i < 4; i++) ybox(0.9, 0.3, 5.6, M.soil, -0.8 + (i % 2) * 1.6, 0.15, 0, g);
    } else if (it.t === "bbq") {                                  // mangal: metall quti, oyoqlar, cho'g'
      ybox(1.2, 0.3, 0.45, ymat(0x2a2f33), 0, 0.85, 0, g);
      [[-0.55, -0.18], [0.55, -0.18], [-0.55, 0.18], [0.55, 0.18]].forEach(([x, z]) => ybox(0.05, 0.7, 0.05, ymat(0x2a2f33), x, 0.35, z, g));
      ybox(1.1, 0.03, 0.38, ymat(0xe3732e, { emissive: 0xb3401a, emissiveIntensity: 0.6 }), 0, 1.0, 0, g, false);
    } else if (it.t === "lounger") {                              // shezlong: ramka, to'shak, ko'tarilgan suyanchiq
      ybox(0.7, 0.3, 1.3, M.white, 0, 0.15, 0.3, g); ybox(0.62, 0.08, 1.2, ymat(0x3d7fc4), 0, 0.34, 0.3, g);
      const back = ybox(0.62, 0.08, 0.7, ymat(0x3d7fc4), 0, 0.55, -0.55, g); back.rotation.x = 0.7;
    } else if (it.t === "umbrella") {                             // soyabon: ustun va konus soyabon
      ybox(0.06, 2.4, 0.06, ymat(0x2a2f33), 0, 1.2, 0, g);
      const top = ymesh(ytrack(new THREE.ConeGeometry(1.3, 0.5, 8, 1, true)), ymat(0xe9c46a, { side: THREE.DoubleSide }), 0, 2.45, 0, g); top.castShadow = true;
      ybox(0.4, 0.06, 0.4, ymat(0x2a2f33), 0, 0.03, 0, g);
    } else if (it.t === "pot") {                                  // gul tuvak
      ymesh(ytrack(new THREE.CylinderGeometry(0.32, 0.24, 0.55, 14)), ymat(0xb5683f), 0, 0.275, 0, g);
      ymesh(ytrack(new THREE.SphereGeometry(0.34, 12, 8)), M.leaf, 0, 0.75, 0, g);
      [[0.15, 0.1], [-0.12, 0.18], [0, -0.2]].forEach(([x, z]) => ymesh(ytrack(new THREE.SphereGeometry(0.07, 8, 6)), ymat(0xd6476b), x, 0.95, z, g, false));
    } else if (it.t === "swing") {                                // arg'imchoq: ramka, arqonlar va o'tirgich
      [-1.1, 1.1].forEach(x => { [-0.6, 0.6].forEach(z => { const leg = ybox(0.08, 2.3, 0.08, M.wood, x, 1.1, z * 0.6, g); leg.rotation.x = z > 0 ? -0.25 : 0.25; }); });
      ybox(2.3, 0.08, 0.08, M.wood, 0, 2.2, 0, g);
      [-0.3, 0.3].forEach(x => ybox(0.02, 1.6, 0.02, ymat(0x2a2f33), x, 1.4, 0, g, false)); ybox(0.7, 0.05, 0.35, M.wood, 0, 0.6, 0, g);
    } else if (it.t === "doghouse") {                             // it uychasi: quti, nishab tom, eshikcha
      ybox(0.9, 0.7, 1.1, M.wood, 0, 0.35, 0, g);
      [-1, 1].forEach(s => { const r = ybox(0.62, 0.05, 1.2, ymat(0x6a5047), s * 0.24, 0.85, 0, g); r.rotation.z = -s * 0.6; });
      ybox(0.35, 0.45, 0.02, ymat(0x2a2f33), 0, 0.25, 0.56, g, false);
    } else if (it.t === "ishkom") {                               // ishkom: ustunlar, tok to'ri va uzum bargi
      [[-1.5, -2.1], [1.5, -2.1], [-1.5, 2.1], [1.5, 2.1], [-1.5, 0], [1.5, 0]].forEach(([x, z]) => ybox(0.12, 2.6, 0.12, M.wood, x, 1.3, z, g));
      for (let i = 0; i < 5; i++) ybox(3.2, 0.06, 0.06, M.wood, 0, 2.62, -2.2 + i * 1.1, g, false);
      ybox(3.3, 0.12, 4.5, M.vine, 0, 2.72, 0, g);
      [[-0.8, -1.2], [0.6, 0.4], [-0.3, 1.5]].forEach(([x, z]) => ymesh(ytrack(new THREE.SphereGeometry(0.12, 8, 6)), ymat(0x6b3a7a), x, 2.5, z, g, false));
    } else if (it.t === "suri") {                                 // so'ri: supa, gilam, ustunlar va tok bilan qoplangan tepa
      ybox(3, 0.45, 3, M.wood, 0, 0.225, 0, g);
      ybox(2.4, 0.03, 2.4, M.carpet, 0, 0.465, 0, g, false);
      [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([x, z]) => ybox(0.12, 2.5, 0.12, M.wood, x, 1.7, z, g));
      ybox(3.4, 0.14, 3.4, M.vine, 0, 3.0, 0, g);
    } else if (it.t === "hedge") {                                // jonli to'siq: qirqilgan buta devori
      ybox(4, 1.2, 0.8, M.leaf2, 0, 0.6, 0, g);
      ybox(3.9, 0.1, 0.7, M.leaf, 0, 1.22, 0, g, false);
    } else if (it.t === "veg") {                                  // poliz: tuproq pushtalari va ko'katlar
      ybox(4, 0.18, 2.4, M.soil, 0, 0.09, 0, g);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) ymesh(ytrack(new THREE.SphereGeometry(0.16, 7, 5)), r === 1 ? ymat(0x7aa63f) : M.leaf2, -1.65 + i * 0.55, 0.26, -0.75 + r * 0.75, g, false).scale.set(1, 0.7, 1);
    } else if (it.t === "rose") {                                 // atirgulzor: buta va qizil gullar
      ybox(2.4, 0.22, 1.2, M.soil, 0, 0.11, 0, g);
      const rm = ymat(0xc8243c);
      for (let i = 0; i < 6; i++) {
        const x = -0.9 + (i % 3) * 0.9, z = i < 3 ? -0.28 : 0.28;
        ymesh(ytrack(new THREE.SphereGeometry(0.28, 9, 7)), M.leaf, x, 0.45, z, g);
        for (let j = 0; j < 3; j++) ymesh(ytrack(new THREE.SphereGeometry(0.07, 6, 5)), rm, x + Math.cos(j * 2.1) * 0.2, 0.62, z + Math.sin(j * 2.1) * 0.2, g, false);
      }
    } else if (it.t === "lawn") {                                 // maysazor: tekis yashil maydon, chekkasi bordyur
      const pad = new THREE.Mesh(ytrack(new THREE.PlaneGeometry(6, 4)), ymat(0x5f9446, { roughness: 1 })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.025; pad.receiveShadow = true; g.add(pad);
      ybox(6.1, 0.06, 0.08, M.stone, 0, 0.03, 2.0, g, false); ybox(6.1, 0.06, 0.08, M.stone, 0, 0.03, -2.0, g, false);
      ybox(0.08, 0.06, 4, M.stone, 3.0, 0.03, 0, g, false); ybox(0.08, 0.06, 4, M.stone, -3.0, 0.03, 0, g, false);
    } else if (it.t === "path") {                                 // tosh yo'lak: alohida plitalar
      for (let i = 0; i < 6; i++) ybox(1.1, 0.06, 0.7, M.stone, ((i * 7) % 3 - 1) * 0.03, 0.03, -2.1 + i * 0.84, g, false);
    } else if (it.t === "jacuzzi") {                              // jakuzi: dumaloq vanna, suv va zinapoya
      ymesh(ytrack(new THREE.CylinderGeometry(1.15, 1.15, 0.8, 28)), ymat(0xece6da), 0, 0.4, 0, g);
      ymesh(ytrack(new THREE.CylinderGeometry(0.98, 0.98, 0.04, 28)), ymat(0x58c2e8, { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.9 }), 0, 0.78, 0, g, false);
      ybox(0.8, 0.3, 0.35, M.wood, 0, 0.15, 1.3, g);
    } else if (it.t === "ayvon") {                                // ayvon: yog'och pol, o'ymakor ustunlar va soyabon tom
      ybox(5, 0.25, 3.6, M.wood, 0, 0.125, 0, g);
      [[-2.3, -1.6], [2.3, -1.6], [-2.3, 1.6], [2.3, 1.6], [0, 1.6], [0, -1.6]].forEach(([x, z]) => {
        ybox(0.18, 2.6, 0.18, M.wood, x, 1.55, z, g);
        ybox(0.3, 0.12, 0.3, M.wood, x, 2.8, z, g, false);
      });
      ybox(5.4, 0.16, 4, ymat(0x6a5047), 0, 2.94, 0, g);
    } else if (it.t === "firepit") {                              // gulxan joyi: tosh halqa, cho'g' va atrofida o'rindiqlar
      ymesh(ytrack(new THREE.CylinderGeometry(0.55, 0.6, 0.35, 16)), M.stone, 0, 0.175, 0, g);
      ymesh(ytrack(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 16)), ymat(0xe3732e, { emissive: 0x7a2a08 }), 0, 0.36, 0, g, false);
      [0, 1, 2].forEach(i => { const a = i * 2.1, b = ybox(1.0, 0.4, 0.35, M.wood, Math.cos(a) * 1.05, 0.2, Math.sin(a) * 1.05, g); b.rotation.y = -a + Math.PI / 2; });
    } else if (it.t === "well") {                                 // quduq: tosh halqa, ustunlar va tomcha
      ymesh(ytrack(new THREE.CylinderGeometry(0.6, 0.65, 0.8, 16)), M.stone, 0, 0.4, 0, g);
      [-0.55, 0.55].forEach(x => ybox(0.1, 1.5, 0.1, M.wood, x, 1.15, 0, g));
      const rf = ybox(1.4, 0.06, 0.9, ymat(0x6a5047), 0, 1.95, 0, g); rf.rotation.x = 0.05;
    } else if (it.t === "shed") {                                 // xo'jalik ombori: yog'och quti, nishab tom va eshik
      ybox(3, 2.2, 2.4, M.wood, 0, 1.1, 0, g);
      const r1 = ybox(3.3, 0.08, 1.45, ymat(0x6a5047), 0, 2.5, -0.6, g); r1.rotation.x = -0.4;
      const r2 = ybox(3.3, 0.08, 1.45, ymat(0x6a5047), 0, 2.5, 0.6, g); r2.rotation.x = 0.4;
      ybox(0.9, 1.8, 0.04, ymat(0x5b4331), 0, 0.9, 1.22, g, false);
    } else {                                                      // mashina joyi: chiziqli maydoncha va mashina
      const pad = new THREE.Mesh(ytrack(new THREE.PlaneGeometry(2.7, 5.3)), M.pad); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; pad.receiveShadow = true; g.add(pad);
      [-1.31, 1.31].forEach(x => ybox(0.08, 0.02, 5.3, M.white, x, 0.03, 0, g, false));
      ybox(1.8, 0.7, 4.2, M.car[k % 3], 0, 0.55, 0, g);
      ybox(1.55, 0.55, 2.1, M.glass, 0, 1.17, -0.2, g);
    }
    g.position.set(it.x, 0, it.z); g.rotation.y = (it.rot * Math.PI) / 180; g.userData.yi = k;
    return g;
  }
  // Hovli alohida guruhda: element surilganda faqat u qayta yig'iladi (uylar emas)
  function buildYard(site) {
    yardDisp.splice(0).forEach(o => o.dispose && o.dispose());
    if (yardGroup && yardGroup.parent) yardGroup.parent.remove(yardGroup);
    yardGroup = null; yardItems = []; yardR = null; yardFence = "yoq";
    const y = site.yard;
    if (group && y && y.on) {
      const L = siteLayout(site.list, site.gap), R = yardRect(L, y), w = R.x1 - R.x0, d = R.z1 - R.z0, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
      yardR = R; yardFence = y.fence;
      yardGroup = new THREE.Group(); group.add(yardGroup);
      if (plinth) { plinth.position.set(cx, -0.1, cz + 1.5); plinth.scale.set(w + 4, 1, d + 7); }   // plinta hovli va ko'cha bo'yini qoplaydi
      const lawnM = real ? (() => { const m = ytrack(realMat("grass", null, { rep: 4, wuv: false })); m.map = ytrack(m.map.clone()); m.bumpMap = ytrack(m.bumpMap.clone()); [m.map, m.bumpMap].forEach(t => { t.repeat.set(w / 4, d / 4); t.needsUpdate = true; }); return m; })() : ymat(0x6f9a52, { roughness: 1 });
      const lawn = new THREE.Mesh(ytrack(new THREE.PlaneGeometry(w, d)), lawnM);
      lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, 0.012, cz); lawn.receiveShadow = true; yardGroup.add(lawn);
      const P = yardPath(L, R);
      if (P) ybox(P.w, 0.03, P.z1 - P.z0, real ? ytrack(realMat("paving", null)) : ymat(0xcdbfa6), P.x, 0.02, (P.z0 + P.z1) / 2, yardGroup, false);
      const F = y.fence;
      if (F !== "yoq") {
        const H = F === "devor" ? 2.0 : F === "panjara" ? 1.7 : 1.5, T2 = F === "devor" ? 0.3 : 0.1;
        const wallM = F === "devor" ? ymat(0xc98a5e) : F === "yogoch" ? ymat(0x8a5a35)
          : ytrack(new THREE.MeshStandardMaterial({ color: 0x2a2f33, transparent: true, opacity: 0.35, roughness: 0.6, side: THREE.DoubleSide }));
        const postM = ymat(F === "devor" ? 0xa86f4c : F === "yogoch" ? 0x6e4527 : 0x23272a);
        const g0 = R.gx - R.gw / 2, g1 = R.gx + R.gw / 2;
        [[R.x0, R.z0, R.x1, R.z0], [R.x0, R.z0, R.x0, R.z1], [R.x1, R.z0, R.x1, R.z1], [R.x0, R.z1, g0, R.z1], [g1, R.z1, R.x1, R.z1]].forEach(([ax, az, bx, bz]) => {
          const len = Math.hypot(bx - ax, bz - az); if (len < 0.05) return;
          const along = az === bz, mx = (ax + bx) / 2, mz = (az + bz) / 2, sz = (a, b) => (along ? [a, b] : [b, a]);
          const [pw, pd] = sz(len, T2);
          ybox(pw, H, pd, wallM, mx, H / 2, mz, yardGroup, F !== "panjara");
          if (F === "devor") { const [cw, cd] = sz(len + 0.1, T2 + 0.1); ybox(cw, 0.1, cd, postM, mx, H + 0.05, mz, yardGroup); }
          else {
            if (F === "panjara") [0.15, H].forEach(yy => { const [rw, rd] = sz(len, 0.06); ybox(rw, 0.06, rd, postM, mx, yy, mz, yardGroup, false); });
            const n = Math.max(1, Math.ceil(len / 2.5));
            for (let i = 0; i <= n; i++) ybox(0.14, H + 0.15, 0.14, postM, ax + ((bx - ax) * i) / n, (H + 0.15) / 2, az + ((bz - az) * i) / n, yardGroup);
          }
        });
        [g0, g1].forEach(x => ybox(0.5, H + 0.5, 0.5, postM, x, (H + 0.5) / 2, R.z1, yardGroup));     // darvoza ustunlari
      }
      const M = {
        bark: ymat(0x6b4a2e), leaf: ymat(0x4f7f3a), leaf2: ymat(0x5f9446), soil: ymat(0x5d4330, { roughness: 1 }), stone: ymat(0xd9d2c3),
        wood: ymat(0x9a6a3e), carpet: ymat(0xa8323e), vine: ymat(0x5c8a3e), white: ymat(0xf2f2f2), pad: ymat(0x8d9093),
        glass: ytrack(new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.2, metalness: 0.3 })),
        water: ytrack(new THREE.MeshStandardMaterial({ color: 0x3fa7c9, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.9 })),
        flowers: [0xe0578f, 0xf2c94c, 0xd64541].map(c => ymat(c)),
        car: [0xb03a2e, 0x2f5d8a, 0xe8e8e8].map(c => ymat(c, { roughness: 0.4, metalness: 0.3 })),
        crownGeo: ytrack(new THREE.SphereGeometry(1.9, 14, 10)), flowerGeo: ytrack(new THREE.SphereGeometry(0.26, 8, 6)),
        trunkGeo: ytrack(new THREE.CylinderGeometry(0.16, 0.24, 2.2, 8)),
      };
      y.items.forEach((it, k) => { const g = makeItem(it, k, M); yardGroup.add(g); yardItems.push(g); });
    }
    if (bar) bar.querySelector('[data-v="move"]').hidden = !(bGroups.length > 1 || yardItems.length);
    if (moveMode && !(bGroups.length > 1 || yardItems.length)) setMoveMode(false);
  }

  // 3D ko'rinishda bosilgan uyni aniqlaydi (sudrash emas, oddiy bosish)
  function pick(e) {
    if (bGroups.length < 2 || !window.View3D.onPick) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(bGroups, true)[0];
    if (!hit) return;
    let o = hit.object;
    while (o && o.userData.bIndex === undefined) o = o.parent;
    if (o) window.View3D.onPick(o.userData.bIndex);
  }

  // ---------- Quyosh holati (Toshkent, 41° sh.k., tengkunlik) va 3D rasm ----------
  let sunHour = null, sunBox = null;
  const hhmm = h => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
  function applySun() {
    if (!sunBox || sunHour === null) return;
    const lat = (41 * Math.PI) / 180, ha = ((sunHour - 12) * 15 * Math.PI) / 180;        // og'ish 0° (tengkunlik)
    const sinEl = Math.cos(lat) * Math.cos(ha), el = Math.asin(sinEl);
    let az = Math.acos(clamp((-sinEl * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat) || 1e-6), -1, 1));   // shimoldan soat yo'nalishida
    if (ha > 0) az = 2 * Math.PI - az;
    const east = Math.sin(az) * Math.cos(el), north = Math.cos(az) * Math.cos(el), up = Math.max(0.03, sinEl);
    sun.position.set(sunBox.cx + east * sunBox.dist, up * sunBox.dist, sunBox.cz - north * sunBox.dist);  // shimol = −z, old fasad janubga qaraydi
    sun.intensity = el > 0 ? 0.25 + 0.85 * Math.sin(el) : 0.05;
    hemi.intensity = el > 0 ? 0.6 + 0.35 * Math.sin(el) : 0.35;
    updateSky();
  }
  function snapshot() {
    render();                                                     // chizilgan zahoti olinadi: bufer hali tozalanmagan
    canvas.toBlob(blob => { if (blob && window.saveFile) window.saveFile("3d-korinish.png", blob); }, "image/png");
  }

  // ---------- VR rejimi: ko'z balandligidan, haqiqiy o'lchamda ----------
  // Shlem (WebXR) bo'lsa — immersiv VR; bo'lmasa — telefon + karton ko'zoynak uchun ikki ko'zli (stereo) ko'rinish.
  const vr = { on: false, stereo: true, x: 0, z: 0, yaw: 0, pitch: 0, dragYaw: 0, lookYaw: 0, eye: 1.65, walk: 0,
               keys: new Set(), gyro: false, devQ: null, yawOffset: null, xr: null, xrOffset: new THREE.Vector3(), ui: null,
               build: true, tool: "win", aim: null, aimNdc: new THREE.Vector2(), aimKey: "", flash: 0,
               room: false, ftype: "sofa", frot: 0, faim: null, fl: 0, fy: 0, st: null, hq: true, msg: "", msgT: 0 };
  const FURN = typeof Interior !== "undefined" ? Object.keys(Interior.ITEMS) : [];
  const furnName = t => (typeof Interior !== "undefined" && Interior.ITEMS[t] ? Interior.ITEMS[t].n : t);
  let vrGhost = null, vrSel = null;
  const VR_TOOLS = ["win", "wide", "arch", "balc", "door", "shop", "arcade", "slit", "round", "lattice", "tall", "square", "triple", "door2", "glassdoor", "archdoor", "garage", "wall", "auto"];
  const ROOF_L = { tekis: "Tekis", nishab: "Nishab", bir: "Bir nishab", piramida: "Piramida", gumbaz: "Gumbaz", terrasa: "Terrasa" };
  const toolName = t => (typeof CELL_LABELS !== "undefined" && CELL_LABELS[t]) || t;
  let vrMark = null;
  const stereoCam = new THREE.StereoCamera(); stereoCam.eyeSep = 0.064;       // ko'zlar orasi ~64 mm
  const SKY = 0xbfd5e8;
  let xrSupported = false;
  if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported("immersive-vr").then(s => { xrSupported = !!s; }).catch(() => {});

  // Boshlang'ich nuqta: faol uyning ro'parasida, butun fasad ko'rinadigan masofada
  function vrStartPos() {
    const L = lastLayout.length ? lastLayout : [{ cx: 0, cz: 0, W: 10, D: 10, H: 10 }];
    const b = L[Math.min(activeIdx, L.length - 1)];
    const Hmax = Math.max(...L.map(l => l.H)), front = Math.max(...L.map(l => l.cz + (l.d || l.D) / 2)), d = Math.max(10, Hmax * 0.95);
    vr.x = b.cx; vr.z = front + d; vr.yaw = 0; vr.dragYaw = 0; vr.pitch = Math.atan2(Hmax * 0.35 - vr.eye, d);
    if (yardR && yardFence !== "yoq") vr.x = yardR.gx;           // hovli bo'lsa — darvoza ro'parasida turiladi
  }
  // Uylar ichidan o'tib bo'lmaydi: har bir uy atrofida 0,6 m chegara
  // Hovli to'sig'idan faqat darvoza orqali o'tiladi (to'siq — 0,35 m qalinlikdagi chiziq)
  const fenceAt = (x, z) => {
    const R = yardR, e = 0.35;
    if (!R || yardFence === "yoq") return false;
    const inX = x > R.x0 - e && x < R.x1 + e, inZ = z > R.z0 - e && z < R.z1 + e;
    return (inX && (Math.abs(z - R.z0) < e || (Math.abs(z - R.z1) < e && Math.abs(x - R.gx) > R.gw / 2 - e))) ||
           (inZ && (Math.abs(x - R.x0) < e || Math.abs(x - R.x1) < e));
  };
  // Ichki rejasi bor uyga faqat old fasaddagi eshik (yoki arkada) orqali kiriladi; ichkarida devorlar, mebel va zina yo'l bermaydi
  function collBlocked(l, x, z) {
    const dx = x - l.cx, dz = z - l.cz, th = (l.rot * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
    const xl = dx * cs - dz * sn, zl = dx * sn + dz * cs, hw = l.W / 2, hd = l.D / 2;
    if (Math.abs(xl) > hw + 0.45 || Math.abs(zl) > hd + 0.45) return false;
    const inner = Math.abs(xl) < hw - T - 0.25 && Math.abs(zl) < hd - T - 0.25;
    if (!inner) {                                                  // devor chizig'i: faqat eshik oldidan o'tiladi
      const lateral = Math.abs(xl) < hw - T - 0.25;
      return !(lateral && zl > 0 && l.coll.doors.some(d => Math.abs(xl - d) < 0.55));
    }
    return l.coll.rects.some(r => xl > r.x0 && xl < r.x1 && zl > r.z0 && zl < r.z1);
  }
  const vrBlocked = (x, z) => fenceAt(x, z) || lastLayout.some(l => l.coll ? collBlocked(l, x, z) : Math.abs(x - l.cx) < l.w / 2 + 0.6 && Math.abs(z - l.cz) < l.d / 2 + 0.6);

  // ---- Qavatlarda yurish: ichki rejali uyda zinadan ko'tarilish/tushish, har qavatning o'z devor va mebel to'siqlari ----
  // Holat: vr.fl — turgan qavat, vr.st — zinada bo'lsa uning pastki qavati (aks holda null), vr.fy — oyoq balandligi
  const toLocal = (l, x, z) => { const th = (l.rot * Math.PI) / 180, dx = x - l.cx, dz = z - l.cz; return [dx * Math.cos(th) - dz * Math.sin(th), dx * Math.sin(th) + dz * Math.cos(th)]; };
  const toWorld = (l, xl, zl) => { const th = (l.rot * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th); return [l.cx + xl * cs + zl * sn, l.cz - xl * sn + zl * cs]; };
  function houseIn(x, z) {
    for (const l of lastLayout) {
      if (!l.coll || !l.coll.rectsF) continue;
      const [xl, zl] = toLocal(l, x, z);
      if (Math.abs(xl) < l.W / 2 - T - 0.25 && Math.abs(zl) < l.D / 2 - T - 0.25) return { l, xl, zl };
    }
    return null;
  }
  const freeOn = (C, f, xl, zl) => !(C.rectsF[f] || []).some(r => xl > r.x0 && xl < r.x1 && zl > r.z0 && zl < r.z1);
  // Zina bo'ylab o'rin: t — 0 (pastki uchi) … 1 (yuqori uchi), ichida — zina eni ichida
  function stairPos(S, xl, zl) {
    const ax = (xl - S.cx) * S.dx + (zl - S.cz) * S.dz, lat = (xl - S.cx) * S.dz - (zl - S.cz) * S.dx;
    return { inSt: Math.abs(ax) <= S.L / 2 && Math.abs(lat) <= S.W / 2, t: ax / S.L + 0.5 };
  }
  // (x, z) ga qadam qo'yilsa yangi holat; o'tib bo'lmasa — null
  function vrWalk(x, z) {
    const h = houseIn(x, z);
    if (!h) return vr.fl > 0 || vr.st !== null || vrBlocked(x, z) ? null : { fl: 0, st: null, fy: 0 };   // tashqariga faqat 1-qavatdan
    const C = h.l.coll, fh = C.fh, N = C.N, S = C.stair, f = vr.fl;
    const sp = S ? stairPos(S, h.xl, h.zl) : { inSt: false, t: 0 }, t = sp.t;
    if (vr.st !== null) {                                            // zinada: balandlik qadamga mos, yon tomondan tushib bo'lmaydi
      const s = vr.st;
      if (sp.inSt) return { fl: s, st: s, fy: (s + clamp(t, 0, 1)) * fh };
      if (t >= 0.85) return freeOn(C, s + 1, h.xl, h.zl) ? { fl: s + 1, st: null, fy: (s + 1) * fh } : null;
      if (t <= 0.15) return freeOn(C, s, h.xl, h.zl) ? { fl: s, st: null, fy: s * fh } : null;
      return null;
    }
    if (sp.inSt) {
      if (f < N - 1 && t < 0.2) return { fl: f, st: f, fy: (f + Math.max(0, t)) * fh };          // pastki uchidan zinaga chiqish
      if (f >= 1 && t > 0.8) return { fl: f - 1, st: f - 1, fy: (f - 1 + Math.min(1, t)) * fh };  // yuqori qavatdan zinaga tushish
      if (!(f === N - 1 && t < 0.5)) return null;                     // zina yoni va teshik — panjara
    }
    return freeOn(C, f, h.xl, h.zl) ? { fl: f, st: null, fy: f * fh } : null;
  }
  function vrSetLevel(s) {
    const changed = s.fl !== vr.fl;
    vr.fl = s.fl; vr.st = s.st; vr.fy = s.fy;
    if (vr.xr) { vr.xrOffset.y = -vr.fy; if (group) group.position.copy(vr.xrOffset); }
    if (changed) { vrFloorLabel(); vr.aimKey = ""; }
  }
  function vrFloorLabel() { if (vr.ui) vr.ui.querySelectorAll('[data-vo="fl"]').forEach(el => { el.textContent = vr.fl + 1; }); }

  function setVrScene(on) {
    if (real) { if (vrGround) vrGround.visible = true; scene.background = null; updateSky(); }    // realistik: osmon gumbazi va tuman doim bor
    else {
      scene.background = on ? new THREE.Color(SKY) : null;
      scene.fog = on ? new THREE.Fog(SKY, 70, 420) : null;
      if (vrGround) vrGround.visible = on;
    }
    applyCut();
    if (on) { labels.forEach(l => { l.sprite.visible = false; }); plates.forEach(p => { p.visible = false; }); }
    else refreshMarks();
  }

  // Telefon datchigi: qurilma burilishini kameraga o'tkazish (deviceorientation -> kvaternion)
  const zee = new THREE.Vector3(0, 0, 1), devEuler = new THREE.Euler(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  function onDev(e) {
    if (e.alpha == null) return;
    const d2r = THREE.MathUtils.degToRad, orient = d2r((screen.orientation && screen.orientation.angle) || window.orientation || 0);
    const q = vr.devQ || (vr.devQ = new THREE.Quaternion());
    devEuler.set(d2r(e.beta), d2r(e.alpha), -d2r(e.gamma), "YXZ");
    q.setFromEuler(devEuler); q.multiply(q1); q.multiply(q0.setFromAxisAngle(zee, -orient));
    if (!vr.gyro) { vr.gyro = true; updateVrUI(); }
  }
  async function startGyro() {
    vr.gyro = false; vr.devQ = null; vr.yawOffset = null;
    if (typeof DeviceOrientationEvent === "undefined" || !window.isSecureContext) return;      // datchik faqat HTTPS (yoki localhost) da ishlaydi
    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function" && (await DeviceOrientationEvent.requestPermission()) !== "granted") return;   // iOS ruxsati
    } catch { return; }
    window.addEventListener("deviceorientation", onDev);
  }

  // ---------- VR ichida qurish: nishon (ko'z markazi yoki bosilgan nuqta) qaragan old fasad katagi ----------
  const ctr = new THREE.Vector2(), xrPos = new THREE.Vector3(), xrDir = new THREE.Vector3();
  // Ichki dizayn: nishon qaragan pol nuqtasi (u yerga jihoz qo'yiladi) yoki mavjud jihoz (burish / o'chirish)
  const wpN = new THREE.Vector3();
  function vrAimRoom(xrCam) {
    let fa = null;
    if (bGroups.length) {
      if (xrCam) { xrCam.getWorldPosition(xrPos); xrCam.getWorldDirection(xrDir); ray.set(xrPos, xrDir); }
      else ray.setFromCamera(vr.stereo ? ctr : vr.aimNdc, camera);
      const hit = ray.intersectObjects(bGroups, true)[0];
      if (hit && hit.distance < 14) {
        let o = hit.object, itm = null, fl = null, bi;
        while (o) { if (!itm && o.userData.it) itm = o; if (fl === null && o.userData.fl !== undefined && o.type === "Group") fl = o.userData.fl; if (o.userData.bIndex !== undefined) { bi = o.userData.bIndex; break; } o = o.parent; }
        const b = bi !== undefined && lastArgs && lastArgs.site.list[bi];
        const under = itm && itm.userData.it.flat ? itm.userData.it.idx : -1;   // tekis buyum (gilam) — pol kabi: ustiga qo'yiladi, X uni o'chiradi
        if (b && itm && under < 0) fa = { kind: "item", i: bi, f: itm.userData.it.f, idx: itm.userData.it.idx, obj: itm };
        else if (b && fl !== null && hit.face) {
          wpN.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
          if (wpN.y > 0.7) {                                           // faqat pol (yuqoriga qaragan sirt)
            const p = b.params, Wb = p.bays * p.bay_w, Db = p.depth, L = bGroups[bi].worldToLocal(hit.point.clone());
            const x = Math.round((L.x + Wb / 2) / 0.25) * 0.25, z = Math.round((L.z + Db / 2) / 0.25) * 0.25;
            const ck = [bi, fl, x, z, vr.frot, vr.ftype].join();       // sig'ish faqat joy yoki jihoz o'zgarganda qayta hisoblanadi
            if (ck !== vr.fitCk || vr.fitArgs !== lastArgs) {
              vr.fitCk = ck; vr.fitArgs = lastArgs;
              vr.fitOk = fl < p.floors && Interior.fits(p, Interior.norm(p, b.interior || {}), fl, [vr.ftype, x, z, vr.frot], -1);
            }
            fa = { kind: "floor", i: bi, f: fl, x, z, ok: vr.fitOk, p, Wb, Db, under };
          }
        }
      }
    }
    vr.faim = fa;
    if (vrGhost) {                                                     // arvoh: haqiqiy o'lcham, burilish va balandlikda
      vrGhost.visible = !!(fa && fa.kind === "floor");
      if (vrGhost.visible) {
        const d = Interior.ITEMS[vr.ftype], odd = vr.frot % 2 === 1, p = fa.p, fh = p.floor_h;
        const base = fa.f * fh + (fa.f === 0 ? 0.06 : 0), top = (fa.f + 1) * fh - 0.22, lift = d.top ? Math.max(0, top - base - d.h - 0.02) : (d.y || 0);
        if (vrGhost.parent !== bGroups[fa.i]) bGroups[fa.i].add(vrGhost);
        vrGhost.position.set(fa.x - fa.Wb / 2, base + lift + Math.max(d.h, 0.04) / 2, fa.z - fa.Db / 2);
        vrGhost.scale.set(odd ? d.d : d.w, Math.max(d.h, 0.04), odd ? d.w : d.d);
        vrGhost.userData.mat.color.setHex(fa.ok ? 0x2ecc71 : 0xe74c3c);
      }
    }
    if (vrSel) { vrSel.visible = !!(fa && fa.kind === "item"); if (vrSel.visible) vrSel.setFromObject(fa.obj); }
    const key = fa ? (fa.kind === "item" ? `i${fa.i}:${fa.f}:${fa.idx}` : `f${fa.ok}:${vr.ftype}`) : "-";
    if (vr.ui && (key + vr.msg) !== vr.aimKey) {
      vr.aimKey = key + vr.msg;
      vr.ui.classList.toggle("aim-on", !!fa && (fa.kind === "item" || fa.ok));
      const items = lastArgs && fa ? Interior.norm(lastArgs.site.list[fa.i].params, lastArgs.site.list[fa.i].interior || {}).floors[fa.f] : null;
      const nm = fa && fa.kind === "item" && items && items.items[fa.idx] ? furnName(items.items[fa.idx][0]) : "";
      vr.ui.querySelector(".vr-aim2").textContent = vr.msg || (!fa ? "Polga qarang: jihoz o'sha joyga qo'yiladi"
        : fa.kind === "item" ? `${nm} — R: burish · X: o'chirish`
        : fa.ok ? `${furnName(vr.ftype)} → shu yerga (E)` : `${furnName(vr.ftype)} bu yerga sig'maydi`);
    }
  }
  function vrSay(t) { vr.msg = t; clearTimeout(vr.msgT); vr.msgT = setTimeout(() => { vr.msg = ""; vr.aimKey = ""; }, 1600); vr.aimKey = ""; }
  function vrRoomPlace() {
    const fa = vr.faim, edit = window.View3D.onVrEdit; if (!fa || !edit) return false;
    if (fa.kind === "item") return vrRoomRot();
    if (!fa.ok) { vrSay(`${furnName(vr.ftype)} bu yerga sig'maydi`); return true; }
    edit(fa.i, "furn", { f: fa.f, type: vr.ftype, x: fa.x, z: fa.z, rot: vr.frot });
    vrSay(`${furnName(vr.ftype)} qo'yildi`);
    return true;
  }
  function vrRoomRot() {
    const fa = vr.faim, edit = window.View3D.onVrEdit;
    if (fa && fa.kind === "item" && edit) { if (edit(fa.i, "furnRot", { f: fa.f, idx: fa.idx }) === false) vrSay("Burilganda sig'maydi"); return true; }
    vr.frot = (vr.frot + 1) % 4; vr.aimKey = ""; return true;      // polga qaralsa — qo'yiladigan jihoz buriladi
  }
  function vrRoomDel() {
    const fa = vr.faim, edit = window.View3D.onVrEdit;
    if (!fa || !edit) return false;
    const idx = fa.kind === "item" ? fa.idx : fa.under; if (idx === undefined || idx < 0) return false;
    edit(fa.i, "furnDel", { f: fa.f, idx }); vrSay("O'chirildi"); return true;
  }
  function vrSetFurn(t) {
    vr.ftype = t; vr.aimKey = "";
    if (vr.ui) vr.ui.querySelectorAll("[data-vf]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.vf === t)));
  }
  // Qavat almashtirish: ko'z balandligi o'sha qavat poliga ko'tariladi (shlemda — sahna pastga suriladi)
  // Tugma bilan qavat almashtirish: odam o'sha qavatdagi bo'sh joyga (avval zina chiqishiga, keyin shu nuqtaga, so'ng eng yaqiniga) o'tadi.
  // Uy tashqarisida bosilsa — avval faol uyning ichiga kiriladi.
  function vrFloor(d) {
    if (!lastArgs) return;
    if (vr.xr) {                                                     // shlemda turgan joy: sahna siljishi + bosh holati
      const hc = renderer.xr.getCamera(camera).position;
      vr.x = hc.x - vr.xrOffset.x; vr.z = hc.z - vr.xrOffset.z;
    }
    let h = houseIn(vr.x, vr.z);
    if (!h) {
      if (!d || d < 0) return;
      vrGoInside(); h = houseIn(vr.x, vr.z);
      if (!h) return;
    }
    const C = h.l.coll, f = clamp(vr.fl + d, 0, C.N - 1);
    if (f === vr.fl && vr.st === null) { vrSay(d > 0 ? "Bu eng yuqori qavat" : "Bu birinchi qavat"); return; }
    const ok = (xl, zl) => freeOn(C, f, xl, zl) && Math.abs(xl) < h.l.W / 2 - T - 0.4 && Math.abs(zl) < h.l.D / 2 - T - 0.4 &&
                           !(C.stair && stairPos(C.stair, xl, zl).inSt);
    const cand = [];
    if (C.stair) cand.push([C.stair.ex, C.stair.ez]);
    cand.push([h.xl, h.zl]);
    for (let r = 0.5; r < Math.max(h.l.W, h.l.D); r += 0.5) for (let a = 0; a < 16; a++) cand.push([h.xl + Math.cos(a * Math.PI / 8) * r, h.zl + Math.sin(a * Math.PI / 8) * r]);
    const pt = cand.find(([xl, zl]) => ok(xl, zl));
    if (!pt) { vrSay(`${f + 1}-qavatda bo'sh joy topilmadi`); return; }
    [vr.x, vr.z] = toWorld(h.l, pt[0], pt[1]);
    vrSetLevel({ fl: f, st: null, fy: f * C.fh });
    if (vr.xr) { vr.xrOffset.set(-vr.x, -vr.fy, -vr.z); if (group) group.position.copy(vr.xrOffset); }
    vrSay(`${f + 1}-qavat`);
  }
  // Odam biror uyning ichidami (uy burilgan bo'lsa ham)
  function vrInside() {
    return lastLayout.some(l => {
      const th = (l.rot * Math.PI) / 180, dx = vr.x - l.cx, dz = vr.z - l.cz;
      const xl = dx * Math.cos(th) - dz * Math.sin(th), zl = dx * Math.sin(th) + dz * Math.cos(th);
      return Math.abs(xl) < l.W / 2 - T && Math.abs(zl) < l.D / 2 - T;
    });
  }
  // Uy ichiga o'tish: faol uyning ichidagi birinchi bo'sh joyga (old eshik tomondan), uyning ichiga qarab
  function vrGoInside() {
    const l = lastLayout[clamp(activeIdx, 0, lastLayout.length - 1)]; if (!l) return;
    const th = (l.rot * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
    for (let zl = l.D / 2 - 1.2; zl > -l.D / 2 + 0.8; zl -= 0.5) for (const xl of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
      if (Math.abs(xl) > l.W / 2 - 0.8) continue;
      const x = l.cx + xl * cs + zl * sn, z = l.cz - xl * sn + zl * cs;
      if (!vrBlocked(x, z)) {
        vr.x = x; vr.z = z; vrSetLevel({ fl: 0, st: null, fy: 0 }); vr.yaw = th; vr.pitch = -0.35; vr.dragYaw = 0; vr.yawOffset = null;
        if (vr.xr) { vr.xrOffset.set(-x, -vr.fy, -z); if (group) group.position.copy(vr.xrOffset); }
        vr.aimKey = ""; return;
      }
    }
    vrSay("Ichkarida bo'sh joy topilmadi");
  }
  // Tiniqlik: yuqori sifatda piksel zichligi 1,5 barobar (supersampling) va soya xaritasi 4096; shlemda framebuffer 1,5×
  // Piksel zichligi: VR'da FHD yoqilgan bo'lsa kadr ekran o'lchamidan qat'i nazar kamida 1920×1080 chiziladi
  // (kichik oyna yoki telefonda — supersampling), katta ekranda esa 1,5× zichlik; GPU chegarasidan oshmaydi
  function pixelRatioFor(w, h) {
    const dpr = window.devicePixelRatio || 1;
    if (!(vr.on && vr.hq)) return Math.min(dpr, 2);
    const fhd = Math.max(1920 / Math.max(w, h), 1080 / Math.min(w, h));
    const gpu = (renderer.capabilities.maxTextureSize || 4096) / Math.max(w, h);
    return Math.min(Math.max(dpr * 1.5, fhd), 4, gpu);
  }
  function applyQuality(on) {
    const ms = on ? 4096 : 2048;
    if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    resize();
  }

  function vrAim(xrCam) {
    if (vr.room) { if (vrMark) vrMark.visible = false; vrAimRoom(xrCam); return; }
    if (vrGhost) vrGhost.visible = false; if (vrSel) vrSel.visible = false;
    let aim = null;
    if (vr.build && bGroups.length) {
      if (xrCam) { xrCam.getWorldPosition(xrPos); xrCam.getWorldDirection(xrDir); ray.set(xrPos, xrDir); }
      else ray.setFromCamera(vr.stereo ? ctr : vr.aimNdc, camera);
      const hit = ray.intersectObjects(bGroups, true)[0];      // birinchi to'siq: orqa yoki yon devor orqali old fasadni bo'yab bo'lmaydi
      let o = hit && hit.object, fr = null, bi;
      while (o) { if (o.userData.front) fr = o; if (o.userData.bIndex !== undefined) { bi = o.userData.bIndex; break; } o = o.parent; }
      if (fr && hit.distance < 90) {
        const L = fr.worldToLocal(hit.point.clone()), u = fr.userData.front;
        const b = Math.floor(L.x / u.bw), f = Math.floor(L.y / u.fh);
        if (b >= 0 && b < u.bays && f >= 0 && f < u.floors) aim = { i: bi, f, b, k: `${f},${b}`, fr, u };
      }
    }
    vr.aim = aim;
    if (vrMark) {
      vrMark.visible = !!aim;
      if (aim) {
        if (vrMark.parent !== aim.fr) aim.fr.add(vrMark);
        const pulse = vr.flash > performance.now() ? 1.04 : 0.94;    // qo'yilganda belgi bir lahza kattalashadi
        vrMark.position.set((aim.b + 0.5) * aim.u.bw, (aim.f + 0.5) * aim.u.fh, T + 0.1);
        vrMark.scale.set(aim.u.bw * pulse, aim.u.fh * pulse, 1);
      }
    }
    const key = aim ? `${aim.i}:${aim.k}:${vr.tool}` : (vr.build ? "-" : "off");
    if (key !== vr.aimKey && vr.ui) {
      vr.aimKey = key;
      vr.ui.classList.toggle("aim-on", !!aim);
      vr.ui.querySelector(".vr-aim").textContent = aim
        ? `${bGroups.length > 1 ? aim.i + 1 + "-uy · " : ""}${aim.f + 1}-qavat, ${aim.b + 1}-oraliq → ${toolName(vr.tool)}`
        : "Nishonni old fasaddagi katakka qarating";
    }
  }
  function vrPlace() {
    if (vr.room) return vrRoomPlace();
    if (!vr.aim || !window.View3D.onVrEdit) return false;
    window.View3D.onVrEdit(vr.aim.i, "paint", { k: vr.aim.k, tool: vr.tool });
    vr.flash = performance.now() + 180;
    return true;
  }
  function vrSetTool(t) {
    vr.tool = t;
    if (vr.ui) vr.ui.querySelectorAll("[data-vt]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.vt === t)));
    vr.aimKey = "";
  }
  // Panel: faol uyning qavat, oraliq, tom va materiali (har updateSite'dan keyin yangilanadi)
  function updateBuildUI() {
    if (!vr.ui || !lastArgs) return;
    const L = lastArgs.site.list, i = clamp(activeIdx, 0, L.length - 1), p = L[i].params;
    const set = (k, v) => { const el = vr.ui.querySelector(`[data-vo="${k}"]`); if (el) el.textContent = v; };
    set("who", L.length > 1 ? `${i + 1}-uy` : "Bino");
    set("floors", p.floors); set("bays", p.bays);
    set("roof", ROOF_L[p.roof] || p.roof);
    set("material", (typeof MATERIALS !== "undefined" && MATERIALS[p.material] && MATERIALS[p.material].label) || p.material);
  }

  function updateVrUI() {
    if (!vr.ui) return;
    vr.ui.querySelector('[data-vr="mode"]').textContent = vr.stereo ? "Bitta ekran" : "Ikki ko'z (VR)";
    vr.ui.querySelector('[data-vr="build"]').setAttribute("aria-pressed", String(vr.build));
    vr.ui.querySelector('[data-vr="room"]').setAttribute("aria-pressed", String(vr.room));
    vr.ui.querySelector('[data-vr="hq"]').setAttribute("aria-pressed", String(vr.hq));
    host.classList.toggle("vr-make", vr.build);
    host.classList.toggle("vr-room", vr.room);
    vr.aimKey = "";
    vr.ui.querySelector(".vr-hint").textContent = vr.gyro
      ? "Boshingizni (telefonni) burang — atrofga qarang · Ekranni bosib turing — oldinga yuring"
      : "Sudrang — atrofga qarang · Bosib turing yoki W/S — yuring · Shift — tezroq" + (window.isSecureContext ? "" : " · Telefon datchigi uchun HTTPS kerak");
    if (vr.room) vr.ui.querySelector(".vr-hint").textContent += " · Polga qarab bosing (E) — jihoz qo'yish · R — burish · X — o'chirish · Q — keyingi jihoz";
    else if (vr.build) vr.ui.querySelector(".vr-hint").textContent += vr.stereo
      ? " · Nishonni katakka qarating va bosing (E) — qo'yish · Q — keyingi asbob"
      : " · Katakni bosing (E — markazdagi katak) — qo'yish · Q — keyingi asbob";
  }

  function enterVR() {
    if (vr.on || vr.xr) return;
    if (xrSupported) { enterXR(); return; }
    vrStartPos();
    vr.on = true; vr.stereo = true; vr.walk = 0; vr.keys.clear(); vr.aimNdc.set(0, 0); vr.aimKey = "";
    updateBuildUI();
    stopAuto();
    host.classList.add("vr-on", "stereo"); document.documentElement.classList.add("vr-lock");
    camera.fov = 80; camera.near = 0.05; camera.updateProjectionMatrix();
    vr.fl = 0; vr.fy = 0; vr.st = null; vrFloorLabel(); applyQuality(vr.hq);
    setVrScene(true);
    startGyro();
    try { if (host.requestFullscreen) host.requestFullscreen().catch(() => {}); } catch {}
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {}); } catch {}
    updateVrUI(); resize(); request();
  }
  function exitVR() {
    if (!vr.on) return;
    vr.on = false; vr.walk = 0; vr.keys.clear();
    window.removeEventListener("deviceorientation", onDev);
    host.classList.remove("vr-on", "stereo"); document.documentElement.classList.remove("vr-lock");
    camera.fov = 35; camera.near = 0.5; camera.updateProjectionMatrix();
    renderer.setScissorTest(false);
    vr.aim = null; vr.faim = null; if (vrMark) vrMark.visible = false; if (vrGhost) vrGhost.visible = false; if (vrSel) vrSel.visible = false;
    vr.fl = 0; vr.fy = 0; vr.st = null; applyQuality(false);
    setVrScene(false);
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch {}
    resize(); request();
  }

  // Haqiqiy VR shlem: sahna ko'chiriladi, odam fasad ro'parasida turadi; kontroller tugmasi — qaragan tomonga 3 m
  // Shlem kontrolleri: dastak (thumbstick) yuqoriga — yuqori qavat, pastga — pastki qavat (qo'yib yuborilguncha bir marta)
  let xrStickLatch = false;
  function xrSticks(session) {
    let y = 0;
    for (const src of session.inputSources || []) {
      const ax = src.gamepad && src.gamepad.axes; if (!ax || !ax.length) continue;
      const v = ax.length >= 4 ? ax[3] : ax[1]; if (Math.abs(v) > Math.abs(y)) y = v;
    }
    if (Math.abs(y) < 0.3) { xrStickLatch = false; return; }
    if (xrStickLatch || Math.abs(y) < 0.8) return;
    xrStickLatch = true; vrFloor(y < 0 ? 1 : -1);
  }
  async function enterXR() {
    try {
      const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
      vrStartPos();
      vr.xr = session; vr.fl = 0; vr.fy = 0; vr.st = null;
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local-floor");
      if (renderer.xr.setFramebufferScaleFactor) renderer.xr.setFramebufferScaleFactor(vr.hq ? 1.5 : 1);   // shlemda tiniqroq tasvir
      if (renderer.xr.setFoveation) renderer.xr.setFoveation(vr.hq ? 0 : 1);
      await renderer.xr.setSession(session);
      vr.xrOffset.set(-vr.x, 0, -vr.z);
      if (group) group.position.copy(vr.xrOffset);
      setVrScene(true);
      session.addEventListener("squeeze", () => {                  // ichki dizaynda: jihozga qaralsa — o'chirish, aks holda keyingi jihoz
        if (vr.room) { if (!vrRoomDel()) vrSetFurn(FURN[(FURN.indexOf(vr.ftype) + 1) % FURN.length]); return; }
        vrSetTool(VR_TOOLS[(VR_TOOLS.indexOf(vr.tool) + 1) % VR_TOOLS.length]);
      });
      session.addEventListener("select", () => {
        if (vrPlace()) return;
        const dir = new THREE.Vector3();
        renderer.xr.getCamera(camera).getWorldDirection(dir);
        dir.y = 0; if (dir.lengthSq() < 1e-6) return;
        vr.xrOffset.sub(dir.normalize().multiplyScalar(4.5));
        if (group) group.position.copy(vr.xrOffset);
      });
      session.addEventListener("end", () => {
        renderer.setAnimationLoop(null); renderer.xr.enabled = false;
        vr.xr = null; vr.xrOffset.set(0, 0, 0); if (group) group.position.set(0, 0, 0);
        vr.aim = null; vr.faim = null; vr.fl = 0; vr.fy = 0; vr.st = null; if (vrMark) vrMark.visible = false; if (vrGhost) vrGhost.visible = false; if (vrSel) vrSel.visible = false;
        setVrScene(false); resize(); request();
      });
      renderer.setAnimationLoop(() => { xrSticks(session); vrAim(renderer.xr.getCamera(camera)); renderer.render(scene, camera); });
    } catch (err) {
      console.warn("WebXR ochilmadi, ekran rejimiga o'tildi:", err);
      xrSupported = false; vr.xr = null; renderer.xr.enabled = false; enterVR();
    }
  }

  const yAxis = new THREE.Vector3(0, 1, 0), yawQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  function vrPlaceCamera() {
    camera.position.set(vr.x, vr.eye + vr.fy, vr.z);
    if (vr.gyro && vr.devQ) {
      if (vr.yawOffset === null) { tmpE.setFromQuaternion(vr.devQ, "YXZ"); vr.yawOffset = vr.yaw - tmpE.y; }   // birinchi o'qishda binoga qaratiladi
      yawQ.setFromAxisAngle(yAxis, vr.yawOffset + vr.dragYaw);
      camera.quaternion.copy(yawQ).multiply(vr.devQ);
      tmpE.setFromQuaternion(camera.quaternion, "YXZ"); vr.lookYaw = tmpE.y;
    } else {
      camera.rotation.set(vr.pitch, vr.yaw, 0, "YXZ"); vr.lookYaw = vr.yaw;
    }
  }
  function vrRender() {
    vrPlaceCamera();
    const w = host.clientWidth, h = host.clientHeight;
    if (!vr.stereo) {
      renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      vrAim();
      renderer.render(scene, camera);
      return;
    }
    camera.aspect = w / 2 / h; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    vrAim();
    stereoCam.update(camera);                                              // chap va o'ng ko'z kameralari
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, w / 2, h); renderer.setViewport(0, 0, w / 2, h); renderer.render(scene, stereoCam.cameraL);
    renderer.setScissor(w / 2, 0, w / 2, h); renderer.setViewport(w / 2, 0, w / 2, h); renderer.render(scene, stereoCam.cameraR);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
  }
  function vrStep(dt) {
    const k = vr.keys;
    let f = vr.walk, s = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) f += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) f -= 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) s -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) s += 1;
    if (!f && !s) return;
    const sp = (k.has("ShiftLeft") || k.has("ShiftRight") ? 6.3 : 2.4) * dt, yw = vr.lookYaw;   // m/s: yurish va tez yurish (Shift)
    const dx = (-Math.sin(yw) * f + Math.cos(yw) * s) * sp, dz = (-Math.cos(yw) * f - Math.sin(yw) * s) * sp;
    const a = vrWalk(vr.x + dx, vr.z); if (a) { vr.x += dx; vrSetLevel(a); }      // x va z alohida: devor bo'ylab sirpanib yuriladi
    const b = vrWalk(vr.x, vr.z + dz); if (b) { vr.z += dz; vrSetLevel(b); }
  }

  // Sensorli ekran va sichqoncha: sudrash — qarash, bosib turish — yurish
  let vrPtr = null, vrHold = 0;
  function vrDown(e) {
    try { canvas.setPointerCapture(e.pointerId); } catch {}             // ba'zi qurilmalarda ushlab qolish rad etiladi: qarash baribir ishlasin
    vrPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, t: performance.now() };
    clearTimeout(vrHold);
    vrHold = setTimeout(() => { if (vrPtr && (vr.gyro || vrPtr.moved < 8)) vr.walk = 1; }, 300);   // qisqa bosish qurish uchun bo'shatildi
  }
  function vrNdcFrom(e) {                       // bitta ekran rejimi: nishon bosilgan/kursor turgan nuqtada
    const r = canvas.getBoundingClientRect();
    vr.aimNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  function vrHover(e) { if (!vrPtr && !vr.stereo && e.pointerType === "mouse") vrNdcFrom(e); }
  function vrMove(e) {
    if (!vrPtr || e.pointerId !== vrPtr.id) return;
    const dx = e.clientX - vrPtr.x, dy = e.clientY - vrPtr.y;
    vrPtr.x = e.clientX; vrPtr.y = e.clientY; vrPtr.moved += Math.abs(dx) + Math.abs(dy);
    if (vrPtr.moved < 8 || vr.walk) return;
    if (vr.gyro) vr.dragYaw -= dx * 0.005;
    else { vr.yaw -= dx * 0.005; vr.pitch = clamp(vr.pitch - dy * 0.005, -1.3, 1.3); }
  }
  function vrUp(e) {
    clearTimeout(vrHold);
    const tap = vrPtr && e && e.type === "pointerup" && !vr.walk && vrPtr.moved < 8 && performance.now() - vrPtr.t < 300;
    vr.walk = 0; vrPtr = null;
    if (tap && vr.build) {
      if (!vr.stereo) vrNdcFrom(e);
      vrPlaceCamera(); camera.updateMatrixWorld(); vrAim(); vrPlace();
    }
  }

  function mount(el) {
    host = el; host.innerHTML = ""; host.classList.add("v3");
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas = renderer.domElement; host.appendChild(canvas);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.5, 3000);
    hemi = new THREE.HemisphereLight(0xffffff, 0x8d9296, 0.95); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff1dc, 0.9);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    applyRenderer();

    bar = document.createElement("div"); bar.className = "v3-bar";
    bar.innerHTML = '<button type="button" data-v="corner">Burchak</button><button type="button" data-v="front">Old</button><button type="button" data-v="back" title="Orqa fasad">Orqa</button>' +
      '<button type="button" data-v="side">Yon</button><button type="button" data-v="top">Tepa</button>' +
      '<label class="v3-sun" title="Quyosh holati: tengkunlik, Toshkent">Quyosh <input type="range" min="5" max="19" step="0.5" value="15" aria-label="Quyosh soati"><output>15:00</output></label>' +
      '<button type="button" data-v="move" aria-pressed="false" title="Uylarni sichqoncha yoki barmoq bilan sudrab ko\'chirish">Ko\'chirish</button><button type="button" data-v="rot" title="Faol uyni 90° burish">↻ 90°</button>' +
      '<button type="button" data-v="parts" aria-pressed="false" title="Detallar: tom, devor, balkon va mebelni sudrab olib qo\'yish; tom olinganda ichki dizayn">Detallar</button>' +
      '<button type="button" data-v="cut" aria-pressed="false" title="Kesim: tomni olib, ichki xonalarni ko\'rish. Qayta bosilsa pastki qavatga o\'tadi">Kesim</button>' +
      '<button type="button" data-v="real" aria-pressed="' + real + '" title="Realistik: haqiqiy materiallar, osmon, maysa va daraxtlar. O\'chirilsa — oq maket">Realistik</button>' +
      '<span class="sp"></span><button type="button" data-v="vr" class="v3-vrbtn" title="VR rejimi: shlem yoki telefon va karton kozoynak">VR</button><button type="button" data-v="png" title="3D rasmni saqlash">PNG</button><button type="button" data-v="out" aria-label="Uzoqlashtirish">−</button><button type="button" data-v="in" aria-label="Yaqinlashtirish">+</button>' +
      '<button type="button" data-v="auto" aria-pressed="' + auto + '">Aylanish</button>';
    host.appendChild(bar);
    const hint = document.createElement("div"); hint.className = "v3-hint"; hint.textContent = "Sudrang: aylantirish";
    host.appendChild(hint);
    intUI = document.createElement("div"); intUI.className = "v3-int"; intUI.hidden = true; host.appendChild(intUI);
    intUI.addEventListener("click", intClick);
    intUI.addEventListener("pointerdown", e => e.stopPropagation());
    window.addEventListener("keydown", e => {                          // Detallar: tanlangan jihozni burish / o'chirish
      if (!partsMode || !fsel || vr.on || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || "") || !host.offsetParent) return;
      if (e.code === "KeyR") { e.preventDefault(); if (furnEdit("furnRot", { i: fsel.i, f: fsel.f, idx: fsel.idx }) === false) say("Burilganda sig'maydi"); updateIntUI(); }
      else if (e.key === "Delete") { e.preventDefault(); furnEdit("furnDel", { i: fsel.i, f: fsel.f, idx: fsel.idx }); fsel = null; refreshSel(); updateIntUI(); }
      else if (e.key === "Escape") { fsel = null; refreshSel(); updateIntUI(); request(); }
    });

    // VR rejimi paneli va klaviatura
    vr.ui = document.createElement("div"); vr.ui.className = "v3-vr";
    const icon = t => typeof drawCell === "function" && t !== "auto"
      ? `<svg viewBox="0 0 40 40" aria-hidden="true">${drawCell(t, 0, 0, 40, 40)}</svg>` : `<svg viewBox="0 0 40 40" aria-hidden="true"><text x="20" y="26" text-anchor="middle" font-size="14" fill="#fff">A</text></svg>`;
    vr.ui.innerHTML = '<div class="vr-top"><b>VR rejimi</b><span class="sp"></span>' +
      '<span class="vr-step vr-flr" title="Qavatga chiqish/tushish (PageUp / PageDown). Ichkarida zinadan yurib ham chiqiladi">Qavat <button type="button" data-vfl="-1" aria-label="Pastki qavatga tushish">▼</button><b data-vo="fl">1</b><button type="button" data-vfl="1" aria-label="Yuqori qavatga chiqish">▲</button></span>' +
      '<button type="button" data-vr="build" aria-pressed="true">Qurish</button>' +
      '<button type="button" data-vr="room" aria-pressed="false" title="Uy ichida turib jihozlarni joylash">Ichki dizayn</button>' +
      '<button type="button" data-vr="hq" aria-pressed="true" title="Full HD: kadr kamida 1920×1080 chiziladi, kuchliroq qurilma talab qiladi">FHD <small data-vo="res"></small></button>' +
      '<button type="button" data-vr="mode">Bitta ekran</button><button type="button" data-vr="exit">Chiqish ✕</button></div>' +
      '<i class="vr-ret l" aria-hidden="true"></i><i class="vr-ret r" aria-hidden="true"></i>' +
      '<div class="vr-bottom"><div class="vr-build"><p class="vr-aim" aria-live="polite"></p>' +
      '<div class="vr-tools">' + VR_TOOLS.map((t, n) => `<button type="button" data-vt="${t}" aria-pressed="${t === vr.tool}" title="${toolName(t)}${n < 10 ? " (" + ((n + 1) % 10) + ")" : ""}">${icon(t)}<span>${toolName(t)}</span></button>`).join("") + '</div>' +
      '<div class="vr-params"><b data-vo="who"></b>' +
      '<span class="vr-step">Qavat <button type="button" data-vs="floors" data-d="-1" aria-label="Qavatni kamaytirish">−</button><b data-vo="floors"></b><button type="button" data-vs="floors" data-d="1" aria-label="Qavat qo\'shish">+</button></span>' +
      '<span class="vr-step">Oraliq <button type="button" data-vs="bays" data-d="-1" aria-label="Oraliqni kamaytirish">−</button><b data-vo="bays"></b><button type="button" data-vs="bays" data-d="1" aria-label="Oraliq qo\'shish">+</button></span>' +
      '<button type="button" data-vc="roof">Tom: <b data-vo="roof"></b> ↻</button><button type="button" data-vc="material">Material: <b data-vo="material"></b> ↻</button>' +
      '<button type="button" data-vu="undo" title="Orqaga (Ctrl+Z)">↶</button><button type="button" data-vu="redo" title="Qayta (Ctrl+Y)">↷</button></div></div>' +
      '<div class="vr-build vr-roomui"><p class="vr-aim2 vr-aim" aria-live="polite"></p>' +
      '<div class="vr-tools vr-furn">' + FURN.map(t => `<button type="button" data-vf="${t}" aria-pressed="${t === vr.ftype}" title="${furnName(t)}"><i style="background:${Interior.ITEMS[t].c}"></i><span>${furnName(t)}</span></button>`).join("") + '</div>' +
      '<div class="vr-params"><button type="button" data-vx="inside">Ichkariga kirish</button>' +
      '<span class="vr-step">Qavat <button type="button" data-vfl="-1" aria-label="Pastki qavat">−</button><b data-vo="fl">1</b><button type="button" data-vfl="1" aria-label="Yuqori qavat">+</button></span>' +
      '<button type="button" data-vx="rot" title="R">↻ Burish</button><button type="button" data-vx="del" title="X">O\'chirish</button>' +
      '<button type="button" data-vx="undo" title="Orqaga">↶</button><button type="button" data-vx="redo" title="Qayta">↷</button></div></div>' +
      '<p class="vr-hint"></p></div>';
    host.appendChild(vr.ui);
    vr.ui.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      b.blur();                                   // Space/Enter keyingi bosishda tugmani qayta bosmasin
      const d = b.dataset, edit = window.View3D.onVrEdit, i = clamp(activeIdx, 0, Math.max(0, bGroups.length - 1));
      if (d.vr === "exit") exitVR();
      else if (d.vr === "mode") { vr.stereo = !vr.stereo; vr.aimNdc.set(0, 0); host.classList.toggle("stereo", vr.stereo); updateVrUI(); }
      else if (d.vr === "build") { vr.build = !vr.build; if (vr.build) vr.room = false; updateVrUI(); }
      else if (d.vr === "room") {
        vr.room = !vr.room; if (vr.room) vr.build = true;
        if (vr.room && !vrInside()) vrGoInside();                     // tashqarida bo'lsa — ichkariga
        updateVrUI();
      }
      else if (d.vr === "hq") { vr.hq = !vr.hq; applyQuality(vr.hq); updateVrUI(); }
      else if (d.vf) vrSetFurn(d.vf);
      else if (d.vfl) vrFloor(Number(d.vfl));
      else if (d.vx === "inside") vrGoInside();
      else if (d.vx === "rot") vrRoomRot();
      else if (d.vx === "del") { if (!vrRoomDel()) vrSay("Avval jihozga qarang"); }
      else if (d.vx && edit) edit(i, d.vx === "undo" ? "furnUndo" : "furnRedo", {});
      else if (d.vt) vrSetTool(d.vt);
      else if (!edit) return;
      else if (d.vs) edit(i, "step", { name: d.vs, d: Number(d.d) });
      else if (d.vc) edit(i, "cycle", { name: d.vc });
      else if (d.vu) edit(i, d.vu, {});
    });
    window.addEventListener("keydown", e => {
      if (!vr.on) return;
      if (e.key === "Escape") { exitVR(); return; }
      if (e.code === "PageUp" || e.code === "PageDown") { e.preventDefault(); if (!e.repeat) vrFloor(e.code === "PageUp" ? 1 : -1); return; }   // qavat almashtirish (har rejimda)
      if (vr.room && !e.ctrlKey && !e.metaKey && !e.altKey) {         // ichki dizayn tugmalari
        if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") { e.preventDefault(); if (!e.repeat) { vrAim(); vrRoomPlace(); } return; }
        if (e.code === "KeyR") { e.preventDefault(); if (!e.repeat) { vrAim(); vrRoomRot(); } return; }
        if (e.code === "KeyX" || e.code === "Delete" || e.code === "Backspace") { e.preventDefault(); vrAim(); vrRoomDel(); return; }
        if (e.code === "KeyQ") { vrSetFurn(FURN[(FURN.indexOf(vr.ftype) + (e.shiftKey ? FURN.length - 1 : 1)) % FURN.length]); return; }

      }
      if (vr.build && !vr.room && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") { e.preventDefault(); if (!e.repeat) { vrAim(); vrPlace(); } return; }
        if (e.code === "KeyQ") { vrSetTool(VR_TOOLS[(VR_TOOLS.indexOf(vr.tool) + (e.shiftKey ? VR_TOOLS.length - 1 : 1)) % VR_TOOLS.length]); return; }
        const dg = /^Digit(\d)$/.exec(e.code);
        if (dg) { vrSetTool(VR_TOOLS[(Number(dg[1]) + 9) % 10]); return; }
      }
      if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(e.code)) { vr.keys.add(e.code); e.preventDefault(); }
    });
    window.addEventListener("keyup", e => { vr.keys.delete(e.code); });
    window.addEventListener("blur", () => { vr.keys.clear(); vr.walk = 0; });
    document.addEventListener("fullscreenchange", () => { if (vr.on) resize(); });

    bar.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      const v = b.dataset.v;
      if (v === "corner") goTo(-0.65, 1.12);
      else if (v === "front") goTo(0, 1.4);
      else if (v === "back") goTo(Math.PI, 1.4);
      else if (v === "side") goTo(Math.PI / 2, 1.4);
      else if (v === "top") goTo(0, 0.12);
      else if (v === "in") { zoom = clamp(zoom * 0.8, 0.35, 2.4); request(); }
      else if (v === "out") { zoom = clamp(zoom * 1.25, 0.35, 2.4); request(); }
      else if (v === "auto") { auto = !auto; tTheta = theta; tPhi = phi; b.setAttribute("aria-pressed", String(auto)); request(); }
      else if (v === "png") snapshot();
      else if (v === "vr") enterVR();
      else if (v === "move") setMoveMode(!moveMode);
      else if (v === "parts") setPartsMode(!partsMode);
      else if (v === "cut") cycleCut();
      else if (v === "real") setReal(!real);
      else if (v === "rot" && window.View3D.onRotate && !window.View3D.onRotate(activeIdx)) {
        const h = host.querySelector(".v3-hint"), t = h.textContent; h.textContent = "Burishga joy yetmaydi — uyni bo'shroq joyga suring"; setTimeout(() => { h.textContent = t; }, 1800);
      }
    });
    const sunIn = bar.querySelector(".v3-sun input"), sunOut = bar.querySelector(".v3-sun output");
    sunIn.addEventListener("input", () => { sunHour = Number(sunIn.value); sunOut.textContent = hhmm(sunHour); applySun(); request(); });

    const pts = new Map(); let pinch0 = 0, down = null;
    const pinchDist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    canvas.addEventListener("pointerdown", e => {
      if (vr.on) { vrDown(e); return; }
      if (partsMode && !pts.size && e.button === 0 && partsDown(e)) return;
      if (moveMode && !pts.size) {                                 // ko'chirish: uy ustida bosilsa — sudrash boshlanadi
        const h = hitAny(e);
        if (h) {
          try { canvas.setPointerCapture(e.pointerId); } catch {}
          const gx = gpt.x, gz = gpt.z, V = window.View3D;
          let c;
          if (h.kind === "b") { if (h.i !== activeIdx && V.onPick) V.onPick(h.i); c = { x: lastLayout[h.i].cx, z: lastLayout[h.i].cz }; }
          else { if (V.onPickItem) V.onPickItem(h.i); const it = lastArgs.site.yard.items[h.i]; c = { x: it.x, z: it.z }; }
          mv = { kind: h.kind, i: h.i, id: e.pointerId, ox: gx - c.x, oz: gz - c.z };
          host.classList.add("drag");
          return;
        }
      }
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      down = pts.size === 1 ? { x: e.clientX, y: e.clientY } : null;
      stopAuto(); host.classList.add("drag");
      if (pts.size === 2) pinch0 = pinchDist();
    });
    canvas.addEventListener("pointermove", e => {
      if (vr.on) { vrHover(e); vrMove(e); return; }
      if (pd) { partsMove(e); return; }
      if (mv) {
        const V = window.View3D, fn = mv.kind === "y" ? V.onMoveItem : V.onMove;
        if (e.pointerId === mv.id && groundAt(e) && fn) fn(mv.i, gpt.x - mv.ox, gpt.z - mv.oz);
        return;
      }
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) { theta -= dx * 0.0065; phi = clamp(phi - dy * 0.0065, 0.08, 1.5); tTheta = theta; tPhi = phi; }
      else if (pts.size === 2) { const d = pinchDist(); if (pinch0) zoom = clamp(zoom * pinch0 / d, 0.35, 2.4); pinch0 = d; }
      request();
    });
    canvas.addEventListener("pointerup", e => {
      if (vr.on) { vrUp(e); return; }
      if (pd) { partsUp(e); return; }
      if (mv) { if (e.pointerId === mv.id) { mv = null; host.classList.remove("drag"); } return; }
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) pick(e);
      down = null; pts.delete(e.pointerId); pinch0 = 0; if (!pts.size) host.classList.remove("drag");
    });
    canvas.addEventListener("pointercancel", e => { if (vr.on) { vrUp(e); return; } if (pd) { partsUp(e, true); return; } if (mv) { mv = null; host.classList.remove("drag"); return; } down = null; pts.delete(e.pointerId); pinch0 = 0; if (!pts.size) host.classList.remove("drag"); });
    // Sahifa surilishini bloklamaslik uchun g'ildirak faqat Ctrl bosilganda (yoki touchpad chimchilashda) yaqinlashtiradi
    canvas.addEventListener("wheel", e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoom = clamp(zoom * Math.exp(e.deltaY * 0.0015), 0.35, 2.4); request();
    }, { passive: false });

    new ResizeObserver(resize).observe(host);
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) request(); }).observe(host);
    // Mavzu almashsa, plinta va to'r rangi yangilansin
    const rebuild = () => { if (lastArgs) { builtSig = ""; schedule(); } };
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rebuild);
    new MutationObserver(rebuild).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    mounted = true;
  }

  const sigOf = site => JSON.stringify([site.list.map(b => [b.params, b.cells, b.interior || null]), site.geo]);
  const posOf = site => JSON.stringify(siteLayout(site.list, site.gap).map(l => [l.cx, l.cz, l.rot]));
  let builtPos = "", posTimer = 0, builtYard = "";

  function schedule() {
    clearTimeout(buildTimer);
    buildTimer = setTimeout(run, 30);          // slayder sudralganda har harakatda qayta yig'ilmasin
  }
  function run() {
    buildTimer = 0;
    if (!lastArgs) return;
    const site = lastArgs.site;
    try { build(site); builtSig = sigOf(site); builtPos = posOf(site); builtYard = JSON.stringify(site.yard) + builtPos; resize(); request(); }
    catch (err) {
      console.error("3D ko'rinish yig'ilmadi, SVGga qaytildi:", err);
      failed = true; mounted = false;
      const b = site.list[Math.min(site.active, site.list.length - 1)];
      host.classList.remove("v3"); host.innerHTML = renderIso(b.params, b.cells);
    }
  }

  window.View3D = {
    ready: () => !failed,
    onPick: null,
    onVrEdit: null,
    onMoveItem: null, onPickItem: null,   // hovli elementini 3D'da surish va tanlash         // (uyIndeksi, "paint" | "step" | "cycle" | "undo" | "redo", ma'lumot) — holatni konstruktor o'zgartiradi
    // list: [{ params, cells }, ...] (1–3 ta), gap: uylar orasi (m), active: faol uy indeksi
    updateSite(list, gap, active, geo, yard) {
      const site = { list: list.map(b => ({ params: b.params, cells: b.cells, pos: b.pos, interior: b.interior })), gap: Number(gap) || 10, active: active || 0, geo: geo ? { axes: !!geo.axes, diag: !!geo.diag } : null,
                     yard: yard && yard.on ? JSON.parse(JSON.stringify(yard)) : null };
      lastArgs = { site };
      const el = document.getElementById("iso");
      if (!mounted) {
        try { mount(el); } catch (err) { console.error(err); failed = true; const b = site.list[0]; el.innerHTML = renderIso(b.params, b.cells); return; }
        run(); return;
      }
      if (!buildTimer && sigOf(site) === builtSig) {       // uylar o'zi o'zgarmadi: qayta yig'ish shart emas
        activeIdx = clamp(site.active, 0, bGroups.length - 1);
        const ps = posOf(site);
        if (ps !== builtPos) {                             // faqat joylashuv: uylar suriladi, chiziqlar biroz keyin qayta chiziladi
          applyPositions(site); builtPos = ps;
          clearTimeout(posTimer); posTimer = setTimeout(() => { if (!mv && lastArgs) { builtSig = ""; schedule(); } }, 450);
        }
        const ys = JSON.stringify(site.yard) + ps;
        if (ys !== builtYard) { buildYard(site); builtYard = ys; realPost(yardGroup); }   // hovli o'zgardi: faqat hovli qayta yig'iladi
        refreshMarks(); refreshSel(); updateIntUI(); request();
      } else {
        activeIdx = clamp(site.active, 0, site.list.length - 1);
        schedule();
      }
      if (vr.on) updateBuildUI();
    },
    update(p, cells) { this.updateSite([{ params: p, cells }], 10, 0); },
    rise() { if (!mounted || reduce) return; riseStart = performance.now(); request(); },
    _render: render,
    enterVR: () => enterVR(), exitVR: () => exitVR(), _vr: vr,
    _step: dt => { vrStep(dt); render(); },
    _vrTap: (x, y) => { vr.aimNdc.set(x, y); vrPlaceCamera(); camera.updateMatrixWorld(); vrAim(); return vrPlace(); },   // sinov uchun              // sinov uchun: bitta VR kadri (harakat + chizish)
  };
})();
