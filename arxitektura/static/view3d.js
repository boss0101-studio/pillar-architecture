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
  let auto = !reduce, baseDist = 40, riseStart = 0, raf = 0, last = 0, buildTimer = 0, lastArgs = null, builtSig = "";
  let plates = [], labels = [], bGroups = [], activeIdx = 0, accentCss = "rgb(43,74,203)";
  let lastLayout = [], vrGround = null;     // uylar joylashuvi (VR to'qnashuvi uchun) va VR dagi keng yer sathi
  const center = new THREE.Vector3();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const disposables = [];
  const track = o => { disposables.push(o); return o; };

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
      case "slit": case "lattice": return [rectAt(d.x1, d.x2, d.z1, d.z2)];
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

  // ---------- Bitta uyni yig'ish (markazi koordinata boshida, asosi y=0 da) ----------
  function makeBuilding(p, cells, sh, interior) {
    const out = new THREE.Group();
    const g = geometry(p), mat = MATERIALS[p.material];
    const { W, D, Hb } = g;
    const { glassMat, ironMat, roofMat } = sh;
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const baseTex = track(makeTex(mat.pattern, mat.fill) || { dispose() {} });
    const hasTex = !!mat.pattern;

    const wallMat = (cw, ch) => {
      const m = new THREE.MeshStandardMaterial({ color: hasTex ? 0xffffff : mat.fill, roughness: 0.92, metalness: 0 });
      if (hasTex) {
        const t = baseTex.clone(); t.needsUpdate = true; t.anisotropy = maxAniso;
        t.repeat.set(Math.max(1, Math.round(cw / TILE)) / cw, Math.max(1, Math.round(ch / TILE)) / ch);   // har katak naqshi chok joyida uzilmasin
        m.map = t; track(t);
      }
      return track(m);
    };
    const ledgeMat = track(new THREE.MeshStandardMaterial({ color: new THREE.Color(mat.fill).multiplyScalar(0.82), roughness: 0.9 }));
    const plainMat = track(new THREE.MeshStandardMaterial({ color: mat.fill, roughness: 0.9 }));

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
        d = dims(o, cw, ch, type === "arch" || type === "arcade");
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
      if (type === "door") {
        const dm = new THREE.Mesh(track(new THREE.ShapeGeometry(rectAt(d.x1, d.x2, 0, d.z2))), ironMat);
        dm.position.z = T * 0.4; grp.add(dm);
        grp.add(box(d.x2 - d.x1 + 0.4, 0.1, 0.6, ironMat, d.cx, d.z2 + 0.06, T + 0.25));     // soyabon
      }
      if (type === "balc") {
        const bw = cw * 0.8, bz = T + 0.55;
        grp.add(box(bw, 0.18, 1.3, plainMat, cw / 2, 0.09, bz));                                // plita
        grp.add(box(bw, 1.0, 0.04, glassMat, cw / 2, 0.68, T + 1.18, false));                   // old panjara
        grp.add(box(0.04, 1.0, 1.25, glassMat, cw / 2 - bw / 2, 0.68, bz, false));
        grp.add(box(0.04, 1.0, 1.25, glassMat, cw / 2 + bw / 2, 0.68, bz, false));
        grp.add(box(bw, 0.05, 0.06, ironMat, cw / 2, 1.19, T + 1.18));                          // tutqich
      }
      if (type === "shop") {
        const aw = box(cw * 0.9, 0.08, 0.9, ironMat, cw / 2, d.z2 + 0.12, T + 0.4);
        aw.rotation.x = 0.35; grp.add(aw);
      }
      return grp;
    }

    function makeWall(cols, cw, typeAt) {
      const wm = wallMat(cw, p.floor_h), tpl = {}, wall = new THREE.Group();
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

    const front = makeWall(p.bays, p.bay_w, (f, b) => cellType(p, cells, f, b));
    front.position.set(-W / 2, 0, D / 2 - T); out.add(front);
    front.userData.front = { bw: p.bay_w, fh: p.floor_h, floors: p.floors, bays: p.bays };   // VR'da qaralgan katakni topish uchun

    const back = makeWall(p.bays, p.bay_w, () => upper);
    back.rotation.y = Math.PI; back.position.set(W / 2, 0, -(D / 2 - T)); out.add(back);

    const right = makeWall(sideCols, sideW, () => upper);
    right.rotation.y = Math.PI / 2; right.position.set(W / 2 - T, 0, D / 2); out.add(right);

    const left = makeWall(sideCols, sideW, () => upper);
    left.rotation.y = -Math.PI / 2; left.position.set(-(W / 2 - T), 0, -D / 2); out.add(left);


    // ---------- Ichki makon (Interior): qavat plitalari, xona devorlari, mebel va zina ----------
    // Natija: VR'da yurishdagi to'siqlar (coll) — uyning markazidagi koordinatalarda
    function addInterior(raw) {
      const I = Interior.norm(p, raw), ig = I.g, fh = p.floor_h, N = p.floors, SL = 0.22;
      const wallM = track(new THREE.MeshStandardMaterial({ color: 0xece8dd, roughness: 0.95 }));
      const floorM = track(new THREE.MeshStandardMaterial({ color: 0xb99a73, roughness: 0.75 }));
      const slabM = track(new THREE.MeshStandardMaterial({ color: 0xe4e0d6, roughness: 0.95 }));
      const stairM = track(new THREE.MeshStandardMaterial({ color: 0xa78662, roughness: 0.8 }));
      const mc = {}, itemM = c => mc[c] || (mc[c] = track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })));
      const X = x => x - W / 2, Z = z => z - D / 2;
      const rects = [], grow = (r, m) => ({ x0: X(r.x0) - m, x1: X(r.x1) + m, z0: Z(r.z0) - m, z1: Z(r.z1) + m });
      const st = N > 1 && I.stair ? Interior.stairInfo(p, I.stair, ig) : null;
      const upperHalf = (r, rot) => rot === 0 ? { ...r, z0: (r.z0 + r.z1) / 2 } : rot === 2 ? { ...r, z1: (r.z0 + r.z1) / 2 } : rot === 1 ? { ...r, x0: (r.x0 + r.x1) / 2 } : { ...r, x1: (r.x0 + r.x1) / 2 };

      // Gorizontal plita (ixtiyoriy teshik bilan): shakl (x, -z) tekisligida, so'ng yotqiziladi
      function slabShape(hole) {
        const x0 = -W / 2 + T, x1 = W / 2 - T, z0 = -D / 2 + T, z1 = D / 2 - T, s = new THREE.Shape();
        s.moveTo(x0, -z0); s.lineTo(x1, -z0); s.lineTo(x1, -z1); s.lineTo(x0, -z1); s.closePath();
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
        const d = Interior.ITEMS[type], g2 = new THREE.Group(), m = itemM(col), dark = itemM("#2a2f33"), { w, d: dp, h } = d;
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
        } else add(w, h, dp, 0, h / 2, 0);
        return g2;
      }

      for (let f = 0; f < N; f++) {
        const G = new THREE.Group(); G.userData.fl = f; out.add(G); floorGs.push(G);
        const base = f * fh + (f === 0 ? 0.06 : 0), top = (f + 1) * fh - SL, fd = I.floors[f];
        if (f === 0) G.add(box(W - 2 * T, 0.06, D - 2 * T, floorM, 0, 0.03, 0, false));
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
          });
          if (wp.lintel) {
            const r = wp.lintel, hh = top - base - 2.1;
            if (hh > 0.02) G.add(box(r.x1 - r.x0, hh, r.z1 - r.z0, wallM, X((r.x0 + r.x1) / 2), base + 2.1 + hh / 2, Z((r.z0 + r.z1) / 2), false));
          }
        }
        fd.items.forEach(it => {
          const d = Interior.ITEMS[it[0]], fg = furniture(it[0], d.c);
          fg.position.set(X(it[1]), base, Z(it[2])); fg.rotation.y = ((it[3] | 0) % 4) * Math.PI / 2;
          G.add(fg);
          if (f === 0 && it[0] !== "carpet") rects.push(grow(Interior.itemRect(it), 0.12));
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
      return { rects, doors };
    }

    // Ichki hajm: ichki reja yo'q bo'lsa — qorong'i hajm (deraza ortida bo'shliq ko'rinmasin), bo'lsa — real xonalar
    let dark = null, coll = null;
    const floorGs = [], ceilG = new THREE.Group();
    out.add(ceilG);
    if (interior) coll = addInterior(interior);
    else { dark = box(W - 2 * T + 0.02, Hb, D - 2 * T + 0.02, track(new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 1 })), 0, Hb / 2, 0, false); out.add(dark); }

    // Qavat belbog'lari
    for (let f = 1; f < p.floors; f++) out.add(box(W + 0.16, 0.12, D + 0.16, ledgeMat, 0, f * p.floor_h, 0));

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
    plates = []; labels = []; bGroups = [];
    activeIdx = clamp(site.active || 0, 0, site.list.length - 1);

    const accent = cssColor("--accent", "#2b4acb");
    accentCss = accent.getStyle();
    const shared = {
      glassMat: track(new THREE.MeshStandardMaterial({ color: 0x4d7396, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.72, side: THREE.DoubleSide })),
      ironMat: track(new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.6 })),
      roofMat: track(new THREE.MeshStandardMaterial({ color: 0x6a5047, roughness: 0.8 })),
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
      it.group.userData.parts = { roofG: it.roofG, ceilG: it.ceilG, floorGs: it.floorGs, wallGroups: it.wallGroups, frontG: it.frontG, dark: it.dark, n: site.list[i].params.floors };
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
    renderer.setSize(w, h, false);
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
    request();
  }
  function cycleCut() {
    const maxN = Math.max(1, ...bGroups.map(g => (g.userData.parts ? g.userData.parts.n : 1)));
    cutLvl = cutLvl < 0 ? maxN - 1 : cutLvl - 1;
    applyCut();
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
    } else if (it.t === "suri") {                                 // so'ri: supa, gilam, ustunlar va tok bilan qoplangan tepa
      ybox(3, 0.45, 3, M.wood, 0, 0.225, 0, g);
      ybox(2.4, 0.03, 2.4, M.carpet, 0, 0.465, 0, g, false);
      [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([x, z]) => ybox(0.12, 2.5, 0.12, M.wood, x, 1.7, z, g));
      ybox(3.4, 0.14, 3.4, M.vine, 0, 3.0, 0, g);
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
      const lawn = new THREE.Mesh(ytrack(new THREE.PlaneGeometry(w, d)), ymat(0x6f9a52, { roughness: 1 }));
      lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, 0.012, cz); lawn.receiveShadow = true; yardGroup.add(lawn);
      const P = yardPath(L, R);
      if (P) ybox(P.w, 0.03, P.z1 - P.z0, ymat(0xcdbfa6), P.x, 0.02, (P.z0 + P.z1) / 2, yardGroup, false);
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
  }
  function snapshot() {
    render();                                                     // chizilgan zahoti olinadi: bufer hali tozalanmagan
    canvas.toBlob(blob => { if (blob && window.saveFile) window.saveFile("3d-korinish.png", blob); }, "image/png");
  }

  // ---------- VR rejimi: ko'z balandligidan, haqiqiy o'lchamda ----------
  // Shlem (WebXR) bo'lsa — immersiv VR; bo'lmasa — telefon + karton ko'zoynak uchun ikki ko'zli (stereo) ko'rinish.
  const vr = { on: false, stereo: true, x: 0, z: 0, yaw: 0, pitch: 0, dragYaw: 0, lookYaw: 0, eye: 1.65, walk: 0,
               keys: new Set(), gyro: false, devQ: null, yawOffset: null, xr: null, xrOffset: new THREE.Vector3(), ui: null,
               build: true, tool: "win", aim: null, aimNdc: new THREE.Vector2(), aimKey: "", flash: 0 };
  const VR_TOOLS = ["win", "wide", "arch", "balc", "door", "shop", "arcade", "slit", "round", "lattice", "wall", "auto"];
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

  function setVrScene(on) {
    scene.background = on ? new THREE.Color(SKY) : null;
    scene.fog = on ? new THREE.Fog(SKY, 70, 420) : null;
    if (vrGround) vrGround.visible = on;
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
  function vrAim(xrCam) {
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
    host.classList.toggle("vr-make", vr.build);
    vr.aimKey = "";
    vr.ui.querySelector(".vr-hint").textContent = vr.gyro
      ? "Boshingizni (telefonni) burang — atrofga qarang · Ekranni bosib turing — oldinga yuring"
      : "Sudrang — atrofga qarang · Bosib turing yoki W/S — yuring · Shift — tezroq" + (window.isSecureContext ? "" : " · Telefon datchigi uchun HTTPS kerak");
    if (vr.build) vr.ui.querySelector(".vr-hint").textContent += vr.stereo
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
    vr.aim = null; if (vrMark) vrMark.visible = false;
    setVrScene(false);
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch {}
    resize(); request();
  }

  // Haqiqiy VR shlem: sahna ko'chiriladi, odam fasad ro'parasida turadi; kontroller tugmasi — qaragan tomonga 3 m
  async function enterXR() {
    try {
      const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
      vrStartPos();
      vr.xr = session;
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local-floor");
      await renderer.xr.setSession(session);
      vr.xrOffset.set(-vr.x, 0, -vr.z);
      if (group) group.position.copy(vr.xrOffset);
      setVrScene(true);
      session.addEventListener("squeeze", () => vrSetTool(VR_TOOLS[(VR_TOOLS.indexOf(vr.tool) + 1) % VR_TOOLS.length]));
      session.addEventListener("select", () => {
        if (vrPlace()) return;
        const dir = new THREE.Vector3();
        renderer.xr.getCamera(camera).getWorldDirection(dir);
        dir.y = 0; if (dir.lengthSq() < 1e-6) return;
        vr.xrOffset.sub(dir.normalize().multiplyScalar(3));
        if (group) group.position.copy(vr.xrOffset);
      });
      session.addEventListener("end", () => {
        renderer.setAnimationLoop(null); renderer.xr.enabled = false;
        vr.xr = null; vr.xrOffset.set(0, 0, 0); if (group) group.position.set(0, 0, 0);
        vr.aim = null; if (vrMark) vrMark.visible = false;
        setVrScene(false); resize(); request();
      });
      renderer.setAnimationLoop(() => { vrAim(renderer.xr.getCamera(camera)); renderer.render(scene, camera); });
    } catch (err) {
      console.warn("WebXR ochilmadi, ekran rejimiga o'tildi:", err);
      xrSupported = false; vr.xr = null; renderer.xr.enabled = false; enterVR();
    }
  }

  const yAxis = new THREE.Vector3(0, 1, 0), yawQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  function vrPlaceCamera() {
    camera.position.set(vr.x, vr.eye, vr.z);
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
    const sp = (k.has("ShiftLeft") || k.has("ShiftRight") ? 4.2 : 1.6) * dt, yw = vr.lookYaw;   // m/s: yurish va tez yurish
    const dx = (-Math.sin(yw) * f + Math.cos(yw) * s) * sp, dz = (-Math.cos(yw) * f - Math.sin(yw) * s) * sp;
    if (!vrBlocked(vr.x + dx, vr.z)) vr.x += dx;
    if (!vrBlocked(vr.x, vr.z + dz)) vr.z += dz;
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
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas = renderer.domElement; host.appendChild(canvas);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.5, 3000);
    hemi = new THREE.HemisphereLight(0xffffff, 0x8d9296, 0.95); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff1dc, 0.9);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);

    bar = document.createElement("div"); bar.className = "v3-bar";
    bar.innerHTML = '<button type="button" data-v="corner">Burchak</button><button type="button" data-v="front">Old</button>' +
      '<button type="button" data-v="side">Yon</button><button type="button" data-v="top">Tepa</button>' +
      '<label class="v3-sun" title="Quyosh holati: tengkunlik, Toshkent">Quyosh <input type="range" min="5" max="19" step="0.5" value="15" aria-label="Quyosh soati"><output>15:00</output></label>' +
      '<button type="button" data-v="move" aria-pressed="false" title="Uylarni sichqoncha yoki barmoq bilan sudrab ko\'chirish">Ko\'chirish</button><button type="button" data-v="rot" title="Faol uyni 90° burish">↻ 90°</button>' +
      '<button type="button" data-v="cut" aria-pressed="false" title="Kesim: tomni olib, ichki xonalarni ko\'rish. Qayta bosilsa pastki qavatga o\'tadi">Kesim</button>' +
      '<span class="sp"></span><button type="button" data-v="vr" class="v3-vrbtn" title="VR rejimi: shlem yoki telefon va karton kozoynak">VR</button><button type="button" data-v="png" title="3D rasmni saqlash">PNG</button><button type="button" data-v="out" aria-label="Uzoqlashtirish">−</button><button type="button" data-v="in" aria-label="Yaqinlashtirish">+</button>' +
      '<button type="button" data-v="auto" aria-pressed="' + auto + '">Aylanish</button>';
    host.appendChild(bar);
    const hint = document.createElement("div"); hint.className = "v3-hint"; hint.textContent = "Sudrang: aylantirish";
    host.appendChild(hint);

    // VR rejimi paneli va klaviatura
    vr.ui = document.createElement("div"); vr.ui.className = "v3-vr";
    const icon = t => typeof drawCell === "function" && t !== "auto"
      ? `<svg viewBox="0 0 40 40" aria-hidden="true">${drawCell(t, 0, 0, 40, 40)}</svg>` : `<svg viewBox="0 0 40 40" aria-hidden="true"><text x="20" y="26" text-anchor="middle" font-size="14" fill="#fff">A</text></svg>`;
    vr.ui.innerHTML = '<div class="vr-top"><b>VR rejimi</b><span class="sp"></span><button type="button" data-vr="build" aria-pressed="true">Qurish</button><button type="button" data-vr="mode">Bitta ekran</button><button type="button" data-vr="exit">Chiqish ✕</button></div>' +
      '<i class="vr-ret l" aria-hidden="true"></i><i class="vr-ret r" aria-hidden="true"></i>' +
      '<div class="vr-bottom"><div class="vr-build"><p class="vr-aim" aria-live="polite"></p>' +
      '<div class="vr-tools">' + VR_TOOLS.map((t, n) => `<button type="button" data-vt="${t}" aria-pressed="${t === vr.tool}" title="${toolName(t)}${n < 10 ? " (" + ((n + 1) % 10) + ")" : ""}">${icon(t)}<span>${toolName(t)}</span></button>`).join("") + '</div>' +
      '<div class="vr-params"><b data-vo="who"></b>' +
      '<span class="vr-step">Qavat <button type="button" data-vs="floors" data-d="-1" aria-label="Qavatni kamaytirish">−</button><b data-vo="floors"></b><button type="button" data-vs="floors" data-d="1" aria-label="Qavat qo\'shish">+</button></span>' +
      '<span class="vr-step">Oraliq <button type="button" data-vs="bays" data-d="-1" aria-label="Oraliqni kamaytirish">−</button><b data-vo="bays"></b><button type="button" data-vs="bays" data-d="1" aria-label="Oraliq qo\'shish">+</button></span>' +
      '<button type="button" data-vc="roof">Tom: <b data-vo="roof"></b> ↻</button><button type="button" data-vc="material">Material: <b data-vo="material"></b> ↻</button>' +
      '<button type="button" data-vu="undo" title="Orqaga (Ctrl+Z)">↶</button><button type="button" data-vu="redo" title="Qayta (Ctrl+Y)">↷</button></div></div>' +
      '<p class="vr-hint"></p></div>';
    host.appendChild(vr.ui);
    vr.ui.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      b.blur();                                   // Space/Enter keyingi bosishda tugmani qayta bosmasin
      const d = b.dataset, edit = window.View3D.onVrEdit, i = clamp(activeIdx, 0, Math.max(0, bGroups.length - 1));
      if (d.vr === "exit") exitVR();
      else if (d.vr === "mode") { vr.stereo = !vr.stereo; vr.aimNdc.set(0, 0); host.classList.toggle("stereo", vr.stereo); updateVrUI(); }
      else if (d.vr === "build") { vr.build = !vr.build; updateVrUI(); }
      else if (d.vt) vrSetTool(d.vt);
      else if (!edit) return;
      else if (d.vs) edit(i, "step", { name: d.vs, d: Number(d.d) });
      else if (d.vc) edit(i, "cycle", { name: d.vc });
      else if (d.vu) edit(i, d.vu, {});
    });
    window.addEventListener("keydown", e => {
      if (!vr.on) return;
      if (e.key === "Escape") { exitVR(); return; }
      if (vr.build && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
      else if (v === "side") goTo(Math.PI / 2, 1.4);
      else if (v === "top") goTo(0, 0.12);
      else if (v === "in") { zoom = clamp(zoom * 0.8, 0.35, 2.4); request(); }
      else if (v === "out") { zoom = clamp(zoom * 1.25, 0.35, 2.4); request(); }
      else if (v === "auto") { auto = !auto; tTheta = theta; tPhi = phi; b.setAttribute("aria-pressed", String(auto)); request(); }
      else if (v === "png") snapshot();
      else if (v === "vr") enterVR();
      else if (v === "move") setMoveMode(!moveMode);
      else if (v === "cut") cycleCut();
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
      if (mv) { if (e.pointerId === mv.id) { mv = null; host.classList.remove("drag"); } return; }
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) pick(e);
      down = null; pts.delete(e.pointerId); pinch0 = 0; if (!pts.size) host.classList.remove("drag");
    });
    canvas.addEventListener("pointercancel", e => { if (vr.on) { vrUp(e); return; } if (mv) { mv = null; host.classList.remove("drag"); return; } down = null; pts.delete(e.pointerId); pinch0 = 0; if (!pts.size) host.classList.remove("drag"); });
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
        if (ys !== builtYard) { buildYard(site); builtYard = ys; }   // hovli o'zgardi: faqat hovli qayta yig'iladi
        refreshMarks(); request();
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
