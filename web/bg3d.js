// 3D jonli orqa fon: tanlangan arxitektura fonining chiziqli (chizma uslubidagi) 3D modeli.
// Kamera sekin aylanadi, sichqoncha va skrolga qarab og'adi, fon almashganda bino "qurilib" chiqadi, havoda zarrachalar suzadi.
// Three.js sahifada bo'lmasa — cdnjs dan kech yuklanadi. WebGL ishlamasa yoki 3D o'chirilgan bo'lsa — 2D fon (bgpicker) qoladi.
(function () {
  if (!window.UstunFon) return;
  const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  const html = document.documentElement;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || html.classList.contains("reduce-motion");
  let R = null, loading = false, failed = false;

  function ensureThree(cb) {
    if (window.THREE) return cb();
    if (failed) return;
    if (loading) { window.addEventListener("ustun-three", cb, { once: true }); return; }
    loading = true;
    const s = document.createElement("script");
    s.src = THREE_URL; s.async = true;
    s.onload = () => { loading = false; window.dispatchEvent(new Event("ustun-three")); cb(); };
    s.onerror = () => { loading = false; failed = true; };                       // internet yo'q: 2D fon qoladi
    document.head.appendChild(s);
  }

  // ---------- Modellar (markaz 0,0,0; yer y=0; o'lchami ~30 birlik) ----------
  const rnd = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  function kit(group, mats, track) {
    const T = window.THREE;
    const add = (geo, x = 0, y = 0, z = 0, o = {}) => {
      const e = new T.LineSegments(track(new T.EdgesGeometry(geo, o.th || 18)), o.accent ? mats.accent : mats.line);
      geo.dispose();
      e.position.set(x, y, z); if (o.ry) e.rotation.y = o.ry; if (o.rx) e.rotation.x = o.rx;
      if (o.s) e.scale.set(...o.s);
      group.add(e); return e;
    };
    const line = (pts, accent, loop) => {
      const g = track(new T.BufferGeometry().setFromPoints(pts.map(p => new T.Vector3(...p))));
      const l = new (loop ? T.LineLoop : T.Line)(g, accent ? mats.accent : mats.line); group.add(l); return l;
    };
    const ring = (r, y, n = 32, accent, sx = 1) => line(Array.from({ length: n }, (_, i) => [Math.cos(i / n * Math.PI * 2) * r * sx, y, Math.sin(i / n * Math.PI * 2) * r]), accent, true);
    const box = (w, h, d, x, y, z, o) => add(new T.BoxGeometry(w, h, d), x, y + h / 2, z, o);
    const cyl = (rt, rb, h, seg, x, y, z, o) => add(new T.CylinderGeometry(rt, rb, h, seg, 1), x, y + h / 2, z, o);
    const cone = (r, h, seg, x, y, z, o) => add(new T.ConeGeometry(r, h, seg), x, y + h / 2, z, o);
    const dome = (r, x, y, z, ws = 14, sy = 1, o) => add(new T.SphereGeometry(r, ws, 7, 0, Math.PI * 2, 0, Math.PI / 2), x, y, z, { s: [1, sy, 1], ...o });
    // Teshikli devor (arklar): shakl x: -w/2..w/2, y: 0..h, qalinligi d
    const archPath = (p, cx, y0, w, h, pointed) => {
      const l = cx - w / 2, r = cx + w / 2, s = y0 + h - w / 2;
      p.moveTo(l, y0); p.lineTo(l, s);
      if (pointed) { p.quadraticCurveTo(l, s + w * 0.55, cx, s + w * 0.85); p.quadraticCurveTo(r, s + w * 0.55, r, s); }
      else p.absarc(cx, s, w / 2, Math.PI, 0, true);
      p.lineTo(r, y0); p.lineTo(l, y0);
    };
    const wall = (w, h, d, holes, x, y, z, o = {}) => {
      const sh = new T.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h); sh.lineTo(-w / 2, h); sh.lineTo(-w / 2, 0);
      holes.forEach(([cx, y0, hw, hh, pointed]) => { const p = new T.Path(); archPath(p, cx, y0, hw, hh, pointed); sh.holes.push(p); });
      const g = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, -d / 2);
      return add(g, x, y, z, o);
    };
    const prism = (w, h, d, x, y, z, o) => {                       // uchburchak (frontonli) tom
      const sh = new T.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.lineTo(-w / 2, 0);
      const g = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2);
      return add(g, x, y, z, o);
    };
    const arcs = n => Array.from({ length: n }, (_, i) => i);
    return { add, line, ring, box, cyl, cone, dome, wall, prism, arcs };
  }

  const SCENES = {
    peshtoq(k) {
      k.wall(14, 17, 3, [[0, 0, 7.5, 12, true]], 0, 0, 4);                           // peshtoq
      k.box(13.6, 0.6, 3.4, 0, 17, 4, { accent: true });
      k.wall(9, 8, 1, [[-3, 0, 2.2, 5], [0, 0, 2.2, 5], [3, 0, 2.2, 5]], -11.5, 0, 3);  // qanotlar: ikki qavat arkada
      k.wall(9, 8, 1, [[-3, 0, 2.2, 5], [0, 0, 2.2, 5], [3, 0, 2.2, 5]], 11.5, 0, 3);
      k.wall(9, 5, 1, [[-3, 0.6, 2, 3.6], [0, 0.6, 2, 3.6], [3, 0.6, 2, 3.6]], -11.5, 8, 3);
      k.wall(9, 5, 1, [[-3, 0.6, 2, 3.6], [0, 0.6, 2, 3.6], [3, 0.6, 2, 3.6]], 11.5, 8, 3);
      [-17.5, 17.5].forEach(x => { k.cyl(1.1, 1.5, 22, 12, x, 0, 3); [6, 11, 16].forEach(y => k.ring(1.35, y, 24)); k.cyl(1.7, 1.7, 1.2, 12, x, 22, 3, { accent: true }); k.cone(1.4, 2.4, 12, x, 23.2, 3); });
      k.cyl(5, 5, 4, 16, 0, 12, -6); k.dome(5, 0, 16, -6, 16, 1.25, { accent: true });  // ortidagi gumbaz
      k.box(26, 12, 14, 0, 0, -6);
    },
    minora(k) {
      k.cyl(1.7, 2.8, 26, 16, 0, 0, 0);
      for (let y = 2; y < 26; y += 2.6) k.ring(2.8 - (1.1 * y) / 26, y, 32, y % 5.2 < 2.6);
      k.cyl(2.2, 2.2, 3.2, 16, 0, 26, 0); k.ring(2.5, 29.2, 32, true); k.dome(1.9, 0, 29.4, 0, 12, 0.9);
      k.box(14, 7, 10, -12, 0, 2); k.dome(4, -12, 7, 2, 14, 1, { accent: true });
      k.wall(10, 9, 2, [[0, 0, 4.5, 7, true]], 12, 0, 4); k.box(10, 5, 8, 12, 0, -1);
    },
    gotika(k) {
      [-7, 7].forEach(x => { k.box(5, 20, 5, x, 0, 3); k.cone(3.9, 10, 4, x, 20, 3, { ry: Math.PI / 4, accent: true });
        k.wall(5, 6, 0.2, [[0, 1, 1.6, 4.5, true]], x, 12, 5.6); });
      k.wall(9, 14, 2, [[0, 0, 4, 8, true]], 0, 0, 4.5);
      k.prism(9, 5, 2, 0, 14, 4.5);
      const rose = k.ring(1.8, 0, 24, true); rose.position.set(0, 11, 5.6); rose.rotation.x = Math.PI / 2;   // gul deraza
      k.box(9, 12, 20, 0, 0, -7); k.prism(9, 5, 20, 0, 12, -7);
      [-1, 1].forEach(s => [-2, -8, -14].forEach(z => k.line([[s * 4.5, 10, z], [s * 8, 6, z], [s * 8, 0, z]], false)));
    },
    antik(k) {
      [0, 0.6, 1.2].forEach((y, i) => k.box(26 - i * 1.2, 0.6, 14 - i * 1.2, 0, y, 0));
      for (let i = 0; i < 8; i++) [5.5, -5.5].forEach(z => k.cyl(0.55, 0.65, 9, 10, -10.5 + i * 3, 1.8, z));
      for (let z = -2.5; z <= 2.5; z += 5) [-10.5, 10.5].forEach(x => k.cyl(0.55, 0.65, 9, 10, x, 1.8, z));
      k.box(24, 1.6, 13, 0, 10.8, 0); k.box(24, 0.8, 13, 0, 12.4, 0, { accent: true });
      k.prism(24, 3.8, 13, 0, 13.2, 0);
    },
    osmonopar(k) {
      const r = rnd(7);
      for (let i = 0; i < 26; i++) {
        const x = (i % 6 - 2.5) * 6.5 + (r() - 0.5) * 2, z = (Math.floor(i / 6) - 2) * 6.5 + (r() - 0.5) * 2;
        const w = 2.6 + r() * 2.4, d = 2.6 + r() * 2.4, h = 6 + Math.pow(r(), 2) * 26;
        k.box(w, h, d, x, 0, z, { accent: h > 26 });
        for (let y = 3; y < h - 1; y += 3) k.line([[x - w / 2, y, z + d / 2], [x + w / 2, y, z + d / 2], [x + w / 2, y, z - d / 2]]);
        if (h > 24) { k.cone(Math.min(w, d) / 2, 5, 4, x, h, z, { ry: Math.PI / 4 }); k.line([[x, h + 5, z], [x, h + 9, z]], true); }
      }
    },
    maqbara(k) {
      k.cyl(8, 8, 9, 8, 0, 0, 0, { ry: Math.PI / 8 });
      k.wall(7, 11, 1.4, [[0, 0, 3.6, 8, true]], 0, 0, 7.6);
      k.cyl(5.4, 5.4, 4, 24, 0, 9, 0); k.ring(5.6, 11, 32, true);
      k.dome(5.8, 0, 13, 0, 18, 1.45, { accent: true }); k.line([[0, 21.4, 0], [0, 24, 0]], true);
      [-13, 13].forEach(x => { k.cyl(0.9, 1.2, 18, 10, x, 0, 4); k.cone(1.2, 2, 10, x, 18, 4); [5, 10, 15].forEach(y => k.ring(1.1, y, 20)); });
    },
    kolizey(k) {
      const T = window.THREE, A = 16, B = 12, N = 36;
      [0, 5, 9.5, 13.5, 15].forEach((y, i) => k.ring(1, y, 72, i === 4, 1).scale.set(A, 1, B));
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2, a2 = ((i + 1) / N) * Math.PI * 2;
        const p = new T.Vector3(Math.cos(a) * A, 0, Math.sin(a) * B), q = new T.Vector3(Math.cos(a2) * A, 0, Math.sin(a2) * B);
        k.line([[p.x, 0, p.z], [p.x, 15, p.z]]);
        [[0, 5, 3.2], [5, 9.5, 3], [9.5, 13.5, 2.8]].forEach(([y0, y1, ah]) => {
          const c = p.clone().add(q).multiplyScalar(0.5), t = q.clone().sub(p), hw = t.length() * 0.36; t.normalize();
          const pts = []; for (let j = 0; j <= 10; j++) { const th = Math.PI * j / 10; pts.push([c.x - t.x * hw * Math.cos(th), y0 + ah * 0.55 + hw * Math.sin(th), c.z - t.z * hw * Math.cos(th)]); }
          pts.unshift([pts[0][0], y0, pts[0][2]]); pts.push([pts[pts.length - 1][0], y0, pts[pts.length - 1][2]]);
          k.line(pts, false); void y1;
        });
      }
    },
    koprik(k) {
      k.box(44, 1.2, 5, 0, 8, 0, { accent: true });
      k.wall(44, 8, 4, [[-14, 0, 11, 7.4], [0, 0, 11, 7.4], [14, 0, 11, 7.4]], 0, 0, 0);
      for (let x = -21; x <= 21; x += 2) k.line([[x, 9.2, 2.4], [x, 10.4, 2.4]]);
      k.line([[-22, 10.4, 2.4], [22, 10.4, 2.4]]);
      k.waves = [];
      for (let z = -10; z <= 10; z += 2.5) { const pts = []; for (let x = -30; x <= 30; x += 1.5) pts.push([x, 0.2, z]); k.waves.push(k.line(pts, false)); }
    },
    uy(k) {
      k.box(16, 7, 10, 0, 0, 0); k.prism(17, 5, 11, 0, 7, 0, { accent: true }); k.box(1.2, 4, 1.2, 4, 9, -1.5);
      [[-5, 1.6], [-1.5, 1.6], [3.5, 1.6], [-5, 4.4], [-1.5, 4.4], [3.5, 4.4]].forEach(([x, y]) => k.line([[x - 1, y, 5.02], [x + 1, y, 5.02], [x + 1, y + 1.8, 5.02], [x - 1, y + 1.8, 5.02]], false, true));
      k.line([[0.6, 0, 5.02], [0.6, 3, 5.02], [2.2, 3, 5.02], [2.2, 0, 5.02]]);
      k.line([[-8, 0, 7], [8, 0, 7]], true); [-8, 8].forEach(x => k.line([[x, 0, 6.4], [x, 0, 7.6]], true));
      k.box(6, 3, 6, -14, 0, 3); k.prism(6.6, 2, 6.6, -14, 3, 3);
    },
  };

  // ---------- Sahna ----------
  function css(name, fb) { const v = getComputedStyle(html).getPropertyValue(name).trim(); return v || fb; }
  function init() {
    const T = window.THREE;
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch { failed = true; return false; }
    const canvas = renderer.domElement;
    canvas.className = "bg3d"; canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(40, 1, 0.5, 400);
    const mats = {
      line: new T.LineBasicMaterial({ transparent: true, depthWrite: false, fog: true }),
      accent: new T.LineBasicMaterial({ transparent: true, depthWrite: false, fog: true }),
      grid: new T.LineBasicMaterial({ transparent: true, depthWrite: false, fog: true }),
      dust: new T.PointsMaterial({ size: 2, sizeAttenuation: false, transparent: true, depthWrite: false, fog: true }),
    };
    scene.fog = new T.Fog(0x000000, 40, 120);
    // yer to'ri
    const gp = []; for (let i = -60; i <= 60; i += 4) { gp.push(i, 0, -60, i, 0, 60, -60, 0, i, 60, 0, i); }
    const gg = new T.BufferGeometry(); gg.setAttribute("position", new T.Float32BufferAttribute(gp, 3));
    scene.add(new T.LineSegments(gg, mats.grid));
    // chang zarrachalari
    const n = 220, dp = new Float32Array(n * 3), r = rnd(11);
    for (let i = 0; i < n; i++) { dp[i * 3] = (r() - 0.5) * 90; dp[i * 3 + 1] = r() * 40; dp[i * 3 + 2] = (r() - 0.5) * 90; }
    const dg = new T.BufferGeometry(); dg.setAttribute("position", new T.BufferAttribute(dp, 3));
    const dust = new T.Points(dg, mats.dust); scene.add(dust);
    R = { T, renderer, canvas, scene, camera, mats, dust, group: null, disp: [], waves: null, id: null, born: 0, angle: 0.6, last: 0, acc: 0,
          mx: 0, my: 0, tmx: 0, tmy: 0, lift: 0, running: false, raf: 0, fade: 1 };
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", e => { R.tmx = e.clientX / innerWidth - 0.5; R.tmy = e.clientY / innerHeight - 0.5; }, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) loop(); });
    new MutationObserver(colors).observe(html, { attributes: true, attributeFilter: ["data-theme", "class"] });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", colors);
    resize();
    return true;
  }
  function colors() {
    if (!R) return;
    const st = UstunFon.get(), base = Math.min(0.85, Math.max(0.12, (st.op || 4) / 100 * 2.8)), T = R.T;
    const fg = new T.Color(css("--fg", "#e8eae9")), ac = new T.Color(css("--accent", "#8da2ff")), bg = new T.Color(css("--bg", "#121516"));
    R.mats.line.color = fg; R.mats.line.opacity = base * R.fade;
    R.mats.accent.color = ac; R.mats.accent.opacity = Math.min(1, base * 1.25) * R.fade;
    R.mats.grid.color = fg; R.mats.grid.opacity = base * 0.35;
    R.mats.dust.color = ac; R.mats.dust.opacity = Math.min(0.8, base * 1.4);
    R.scene.fog.color = bg;                                        // uzoqdagi chiziqlar sahifa rangiga singib ketadi
    if (R.running) { R.renderer.render(R.scene, R.camera); loop(); }   // mavzu almashsa yoki VR'dan chiqilsa qayta chiziladi
  }
  function resize() { if (!R) return; R.renderer.setSize(innerWidth, innerHeight, false); R.camera.aspect = innerWidth / innerHeight; R.camera.updateProjectionMatrix(); R.renderer.render(R.scene, R.camera); }
  function setScene(id) {
    if (!R || R.id === id) return;
    R.disp.splice(0).forEach(o => o.dispose());
    if (R.group) R.scene.remove(R.group);
    const g = new R.T.Group(), k = kit(g, R.mats, o => { R.disp.push(o); return o; });
    k.group = g;
    (SCENES[id] || SCENES.peshtoq)(k);
    R.waves = k.waves || null; R.group = g; R.id = id; R.scene.add(g);
    R.born = performance.now(); g.scale.y = reduced() ? 1 : 0.02;
    colors(); loop();
  }

  // ---------- Animatsiya (~30 kadr/s, yashirin varaqda va VR'da to'xtaydi) ----------
  function frame(now) {
    R.raf = 0;
    if (!R.running || document.hidden) return;
    const dt = R.last ? Math.min(0.1, (now - R.last) / 1000) : 0.016; R.last = now;
    R.acc += dt; if (R.acc < 1 / 30) { R.raf = requestAnimationFrame(frame); return; }
    const step = R.acc; R.acc = 0;
    const still = reduced() || html.classList.contains("vr-lock");
    if (!still) {
      R.angle += step * 0.05;
      R.mx += (R.tmx - R.mx) * Math.min(1, step * 2); R.my += (R.tmy - R.my) * Math.min(1, step * 2);
      const pos = R.dust.geometry.attributes.position;
      for (let i = 1; i < pos.array.length; i += 3) { pos.array[i] += step * 0.6; if (pos.array[i] > 40) pos.array[i] = 0; }
      pos.needsUpdate = true;
      if (R.waves) R.waves.forEach((w, j) => { const a = w.geometry.attributes.position; for (let i = 0; i < a.count; i++) a.setY(i, 0.2 + Math.sin(a.getX(i) * 0.35 + now / 700 + j) * 0.25); a.needsUpdate = true; });
    }
    if (R.group && R.group.scale.y < 1) {                          // qurilish: pastdan yuqoriga o'sish
      const k = Math.min(1, (now - R.born) / 1600), e = 1 - Math.pow(1 - k, 3);
      R.group.scale.y = 0.02 + 0.98 * e;
    }
    const lift = Math.min(1, scrollY / 2500);
    R.lift += (lift - R.lift) * Math.min(1, step * 3);
    const rad = 52, h = 12 + R.lift * 16 - R.my * 6;
    R.camera.position.set(Math.sin(R.angle + R.mx * 0.5) * rad, h, Math.cos(R.angle + R.mx * 0.5) * rad);
    R.camera.lookAt(0, 9 + R.lift * 4, 0);
    R.renderer.render(R.scene, R.camera);
    if (!still || (R.group && R.group.scale.y < 1)) R.raf = requestAnimationFrame(frame);
  }
  function loop() { if (R && R.running && !R.raf) { R.last = 0; R.raf = requestAnimationFrame(frame); } }

  // ---------- Yoqish / o'chirish ----------
  function update() {
    const st = UstunFon.get();
    if (st.d3 === false || failed) { html.classList.remove("bg3d-on"); if (R) { R.running = false; R.canvas.hidden = true; } return; }
    ensureThree(() => {
      if (!R && !init()) return;
      R.canvas.hidden = false; R.running = true;
      html.classList.add("bg3d-on");
      setScene(st.id); colors(); loop();
    });
  }
  window.addEventListener("ustun-fon", update);
  const go = () => update();
  if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 300);   // sahifa avval chizilsin, keyin 3D
  window.UstunFon3D = { get active() { return !!(R && R.running); }, get scene() { return R && R.id; } };   // sinov uchun
})();
