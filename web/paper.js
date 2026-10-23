// Oq qog'oz: uyni qalam bilan qo'lda chizasiz. Qiyshiq chiziqlar to'g'ri devorlarga aylanadi (RDP soddalashtirish,
// burchaklarni 0/45/90° ga to'g'rilash, 0,5 m to'rga yopishtirish), uchlar bir-biriga ulanadi, kontur yopiladi.
// "3D ga o'tkazish" — qog'oz yotadi, devorlar 3D'da qad ko'taradi. Chizmani Erkin qurishga yangi loyiha yoki qo'shimcha sifatida o'tkazish mumkin.
(function () {
  const app = document.getElementById("ppApp");
  if (!app) return;
  const PW = 40, PD = 30, GRID = 0.5, JOIN = 0.9, KEY = "ustun-qogoz";
  const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  const nf = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("ru-RU");
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const snapG = v => Math.round(v / GRID) * GRID;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const web = !!document.getElementById("qogoz") && typeof showView === "function";

  // ---------- Holat ----------
  let S = { strokes: [], h: 3, auto: true, raw: true, arc: "full", sides: 6 };
  try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); if (d && Array.isArray(d.strokes)) S = { ...S, ...d, strokes: d.strokes.filter(s => s && Array.isArray(s.pts) && s.pts.length >= 2).slice(0, 300) }; } catch {}
  let kind = "out", tool = "free", mode = "paper", live = null, poly = null, msg = "", undo = [], redo = [];   // kind — qalam (devor turi), tool — asbob
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
  const commit = fn => { undo.push(JSON.stringify(S.strokes)); if (undo.length > 80) undo.shift(); redo = []; fn(); save(); changed(); };

  // ---------- Qo'l chizig'ini devorga aylantirish ----------
  function rdp(pts, eps) {                                          // Ramer–Douglas–Peucker: keraksiz nuqtalarni olib tashlash
    if (pts.length < 3) return pts.slice();
    const [a, b] = [pts[0], pts[pts.length - 1]], L = dist(a, b) || 1e-9;
    let idx = 0, md = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L;
      if (d > md) { md = d; idx = i; }
    }
    if (md <= eps) return [a, b];
    return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
  }
  function anchors(skip) {                                          // boshqa devorlarning uchlari va bo'laklari (ulash uchun)
    const v = [], segs = [];
    S.strokes.forEach((s, si) => { if (si === skip) return; s.pts.forEach(p => v.push(p)); const n = s.pts.length, c = s.closed ? n : n - 1; for (let i = 0; i < c; i++) segs.push([s.pts[i], s.pts[(i + 1) % n]]); });
    return { v, segs };
  }
  function attach(p, A) {                                           // eng yaqin uchga, bo'lmasa devor o'rtasiga (T ulanish)
    let best = null, bd = JOIN;
    A.v.forEach(q => { const d = dist(p, q); if (d < bd) { bd = d; best = q.slice(); } });
    if (best) return best;
    bd = JOIN * 0.7;
    A.segs.forEach(([a, b]) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; if (!L2) return;
      const u = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2, 0, 1), q = [a[0] + dx * u, a[1] + dz * u], d = dist(p, q);
      if (d < bd) { bd = d; best = [snapG(q[0]), snapG(q[1])]; if (Math.abs(dx) < 1e-6) best[0] = a[0]; if (Math.abs(dz) < 1e-6) best[1] = a[1]; }
    });
    return best || p;
  }
  function recognize(raw, kind) {
    let p = rdp(raw, 0.38);
    if (p.length < 2 || dist(p[0], p[p.length - 1]) + p.length * 0 < 0.4 && p.length < 3) return null;
    if (S.auto) {                                                   // burchakni 0/45/90° ga to'g'rilash (12° gacha og'ish)
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1], L = dist(a, b), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const s = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        if (Math.abs(ang - s) < (12 * Math.PI) / 180) p[i + 1] = [a[0] + Math.cos(s) * L, a[1] + Math.sin(s) * L];
      }
    }
    p = p.map(q => [clamp(snapG(q[0]), 0, PW), clamp(snapG(q[1]), 0, PD)]);
    const A = anchors(-1);
    let closed = false;
    if (p.length >= 4 && dist(p[0], p[p.length - 1]) < JOIN * 1.6) { p.pop(); closed = true; }   // boshlanish nuqtasiga qaytildi — kontur yopiladi
    p[0] = attach(p[0], A); if (!closed) p[p.length - 1] = attach(p[p.length - 1], A);
    if (closed && S.auto) {                                         // yopiq konturning oxirgi burchagini ham to'g'rilash
      const a = p[p.length - 1], b = p[0];
      if (Math.abs(a[0] - b[0]) < 0.8) p[p.length - 1] = [b[0], a[1]]; else if (Math.abs(a[1] - b[1]) < 0.8) p[p.length - 1] = [a[0], b[1]];
    }
    const out = [];
    p.forEach(q => { if (!out.length || dist(out[out.length - 1], q) >= 0.4) out.push(q); });   // juda kalta bo'laklar olib tashlanadi
    for (let i = out.length - 2; i > 0; i--) {                      // bir chiziqda yotgan nuqtalar birlashtiriladi
      const a = out[i - 1], b = out[i], c = out[i + 1];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 0.05) out.splice(i, 1);
    }
    if (closed && out.length < 3) closed = false;
    if (out.length < 2) return null;
    const rawSmall = raw.filter((_, i) => i % 2 === 0 || i === raw.length - 1).map(q => [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]);
    return { k: kind, pts: out, closed, raw: rawSmall };
  }

  // ---------- O'lchovlar ----------
  const polyArea = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const segLen = s => { let L = 0; const n = s.pts.length, c = s.closed ? n : n - 1; for (let i = 0; i < c; i++) L += dist(s.pts[i], s.pts[(i + 1) % n]); return L; };
  function stats() {
    const out = S.strokes.filter(s => s.k === "out"), inn = S.strokes.filter(s => s.k === "in");
    return { Lout: out.reduce((a, s) => a + segLen(s), 0), Lin: inn.reduce((a, s) => a + segLen(s), 0),
             A: out.filter(s => s.closed).reduce((a, s) => a + polyArea(s.pts), 0), loops: out.filter(s => s.closed).length, open: out.filter(s => !s.closed).length, n: S.strokes.length };
  }

  // ---------- DOM ----------
  app.innerHTML = `
    <div class="pp">
      <div class="pp-bar">
        <div class="pp-tools" role="radiogroup" aria-label="Qalam">
          <button type="button" role="radio" data-ppk="out"><i class="pen thick"></i>Qalin qalam<small>tashqi devor</small></button>
          <button type="button" role="radio" data-ppk="in"><i class="pen"></i>Ingichka qalam<small>ichki devor</small></button>
        </div>
        <label class="pp-chk"><input type="checkbox" data-ppo="auto"> Avto-to'g'rilash</label>
        <label class="pp-chk"><input type="checkbox" data-ppo="raw"> Qalam izini ko'rsatish</label>
        <span class="sp"></span>
        <button type="button" class="btn-ghost" data-ppa="undo">Orqaga</button>
        <button type="button" class="btn-ghost" data-ppa="redo">Qayta</button>
        <button type="button" class="btn-ghost" data-ppa="clear">Qog'ozni tozalash</button>
      </div>
      <div class="pp-rulers" role="toolbar" aria-label="Chizg'ichlar va shablonlar"><button type="button" data-ppr="free"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16c3-6 5 4 8-2s5 4 10-4"/></svg><span>Qo'lda<small>erkin chiziq</small></span></button><button type="button" data-ppr="ruler"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/></svg><span>Chizg'ich<small>tekis chiziq</small></span></button><button type="button" data-ppr="square"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v17h17v-4H8V3z"/></svg><span>Go'niya<small>to'g'ri burchak</small></span></button><button type="button" data-ppr="setsq"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V4l16 16z"/><path d="M8 16v-4l4 4z"/></svg><span>Uchburchak<small>30° 45° 60°</small></span></button><button type="button" data-ppr="proto"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18a9 9 0 0 1 18 0z"/><path d="M12 18l5-6"/></svg><span>Transportir<small>aniq burchak</small></span></button><button type="button" data-ppr="compass"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><path d="M12 6.6 7 21M12 6.6 17 21M9 14h6"/></svg><span>Sirkul<small>aylana, yoy</small></span></button><button type="button" data-ppr="rect"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12"/></svg><span>To'rtburchak<small>shablon</small></span></button><button type="button" data-ppr="poly"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/></svg><span>Ko'pburchak<small>shablon</small></span></button><button type="button" data-ppr="erase"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l8-8 6 6-6 6H8z"/><path d="M11 20h9"/></svg><span>O'chirg'ich<small>devorni bosing</small></span></button>
        <label class="pp-opt" data-for="compass">Sirkul: <select data-ppo="arc"><option value="full">to'liq aylana</option><option value="half">yarim aylana</option></select></label>
        <label class="pp-opt" data-for="poly">Burchaklar soni: <select data-ppo="sides"><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select></label>
      </div>
      <div class="pp-modes">
        <div class="pp-seg" role="tablist" aria-label="Ko'rinish">
          <button type="button" data-ppm="paper">Qog'oz</button><button type="button" data-ppm="side">Yonma-yon</button><button type="button" data-ppm="3d">3D</button>
        </div>
        <button type="button" class="btn pp-go" data-ppa="to3d">3D ga o'tkazish →</button>
        <label class="pp-h">Devor balandligi <input type="range" min="2.4" max="6" step="0.1" data-ppo="h"><output></output></label>
      </div>
      <div class="pp-stage" id="ppStage">
        <div class="pp-paper"><div class="pp-sheet" id="ppSheet"></div></div>
        <div class="pp-3d" id="pp3d"><p class="pp-3dhint">Sudrang — aylantirish</p></div>
      </div>
      <p class="pp-hint" id="ppHint" role="status"></p>
      <div class="pp-foot">
        <dl class="pp-stats" id="ppStats"></dl>
        <div class="pp-send">
          <span class="label">Dizaynni davom ettirish</span>
          <button type="button" class="btn" data-ppa="newErkin">Erkin qurishda yangi loyiha</button>
          <button type="button" class="btn-ghost" data-ppa="mergeErkin" title="Erkin qurishdagi joriy loyihaning 1-qavatiga qo'shiladi">Mavjud loyihaga birlashtirish</button>
        </div>
      </div>
    </div>`;
  const $ = s => app.querySelector(s);

  function wallPoly(a, b, t) {
    const L = dist(a, b) || 1e-9, dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L, nx = -dz * t / 2, nz = dx * t / 2;
    return [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]].map(q => q.join(",")).join(" ");
  }
  // ---------- Chizg'ichlar: tekis va aniq chiziq uchun asboblar ----------
  const DRAG = new Set(["ruler", "proto", "compass", "rect", "poly"]), POLY = new Set(["square", "setsq"]);
  const r2 = v => Math.round(v * 100) / 100;
  const inPaper = q => q[0] >= -1e-6 && q[0] <= PW + 1e-6 && q[1] >= -1e-6 && q[1] <= PD + 1e-6;
  const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
  const visDeg = deg => Math.round(((-deg % 360) + 360) % 360);          // ekranda ko'rinadigan burchak: sharqdan, soat strelkasiga qarshi
  function snapStart(p) { const q = attach(p, anchors(-1)); return q === p ? [snapG(p[0]), snapG(p[1])] : q; }
  // a dan p tomonga: burchak asbob qadamiga (go'niya 90°, uchburchak 15°, transportir 5°, chizg'ich 15°), uzunlik 0,5 m ga yaxlitlanadi
  function constrain(a, p, t) {
    const step = t === "square" ? 90 : t === "setsq" ? 15 : t === "proto" ? 5 : S.auto ? 15 : 0, rad = step * Math.PI / 180;
    let ang = Math.atan2(p[1] - a[1], p[0] - a[0]);
    if (step) ang = Math.round(ang / rad) * rad;
    const L = Math.max(GRID, Math.round(dist(a, p) / GRID) * GRID);
    let q = [r2(a[0] + Math.cos(ang) * L), r2(a[1] + Math.sin(ang) * L)];
    const A = anchors(-1), near = A.v.find(v => dist(v, p) < 0.6 && !same(v, a));   // boshqa devor uchiga yaqin — o'sha nuqtaga (devorlar ulanadi)
    if (near) { const va = Math.atan2(near[1] - a[1], near[0] - a[0]); if (!step || t === "ruler" || t === "proto" || Math.abs(Math.round(va / rad) * rad - va) < 0.02) return near.slice(); }
    // devorga 0,8 m yetmay yoki o'tib ketgan bo'lsa — burchakni buzmasdan aynan devorgacha cho'ziladi/qisqaradi
    const d = [Math.cos(ang), Math.sin(ang)]; let best = null;
    A.segs.forEach(([s0, s1]) => {
      const e = [s1[0] - s0[0], s1[1] - s0[1]], den = d[0] * e[1] - d[1] * e[0]; if (Math.abs(den) < 1e-9) return;
      const w = [s0[0] - a[0], s0[1] - a[1]], tt = (w[0] * e[1] - w[1] * e[0]) / den, u = (w[0] * d[1] - w[1] * d[0]) / den;
      if (u >= -1e-6 && u <= 1 + 1e-6 && tt > 0.3 && Math.abs(tt - L) < 0.8 && (!best || Math.abs(tt - L) < Math.abs(best - L))) best = tt;
    });
    if (best) q = [r2(a[0] + d[0] * best), r2(a[1] + d[1] * best)];
    return q;
  }
  function shapeOf(l) {                                             // sudrash asboblari: { pts, closed, r }
    const { a, b } = l, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (l.tool === "ruler" || l.tool === "proto") return { pts: [a, b], closed: false };
    if (l.tool === "rect") return { pts: [a, [b[0], a[1]], b, [a[0], b[1]]], closed: true };
    const r = Math.max(0.5, Math.round(dist(a, b) / 0.25) * 0.25), pts = [];
    if (l.tool === "compass") {
      const half = S.arc === "half", n = half ? 16 : 32, span = half ? Math.PI : Math.PI * 2;
      for (let i = 0; i < (half ? n + 1 : n); i++) { const t = ang + span * i / n; pts.push([r2(a[0] + Math.cos(t) * r), r2(a[1] + Math.sin(t) * r)]); }
      return { pts, closed: !half, r };
    }
    for (let i = 0; i < S.sides; i++) { const t = ang + Math.PI * 2 * i / S.sides; pts.push([r2(a[0] + Math.cos(t) * r), r2(a[1] + Math.sin(t) * r)]); }
    return { pts, closed: true, r };
  }
  function dragEnd(l, p) {
    if (l.tool === "ruler" || l.tool === "proto") return constrain(l.a, p, l.tool);
    if (l.tool === "rect") { const q = attach(p, anchors(-1)); return q === p ? [snapG(p[0]), snapG(p[1])] : q; }
    return p;                                                       // sirkul va ko'pburchak: radius shapeOf da yaxlitlanadi
  }
  function flash(t) { msg = t; renderUi(); setTimeout(() => { if (msg === t) { msg = ""; renderUi(); } }, 2200); }
  function finishDrag() {
    const l = live; live = null;
    const sh = shapeOf(l);
    if (!sh.pts.every(inPaper)) { flash("Shakl qog'ozga sig'madi — kichikroq qiling yoki markazni suring."); renderPaper(); return; }
    const big = l.tool === "rect" ? Math.abs(l.b[0] - l.a[0]) >= 0.5 && Math.abs(l.b[1] - l.a[1]) >= 0.5 : sh.closed || dist(sh.pts[0], sh.pts[sh.pts.length - 1]) >= 0.4;
    if (!big) { renderPaper(); return; }
    commit(() => { S.strokes.push({ k: l.k, pts: sh.pts, closed: sh.closed, tool: l.tool }); });
  }
  let lastTap = { t: 0, x: 0, y: 0 };
  function polyClick(p, e) {
    const now = performance.now(), dbl = now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 8;
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    if (!poly) { poly = { tool, k: kind, pts: [snapStart(p)], cur: null }; renderPaper(); renderUi(); return; }
    if (dbl) { finishPoly(false); return; }                         // ikki marta bosish — tugatish
    const last = poly.pts[poly.pts.length - 1], q = constrain(last, p, poly.tool);
    if (poly.pts.length >= 3 && (dist(q, poly.pts[0]) < 0.6 || dist(p, poly.pts[0]) < 0.6)) { finishPoly(true); return; }   // boshlang'ich nuqta — kontur yopiladi
    if (!same(q, last)) poly.pts.push(q);
    renderPaper();
  }
  function finishPoly(close) {
    const pl = poly; poly = null;
    if (!pl || pl.pts.length < 2) { renderPaper(); renderUi(); return; }
    commit(() => { S.strokes.push({ k: pl.k, pts: pl.pts, closed: close && pl.pts.length >= 3, tool: pl.tool }); });
  }
  // Asboblarning qog'oz ustidagi ko'rinishi
  function rulerSvg(a, L, deg) {
    const len = Math.max(L, 2) + 1, ticks = [], nums = [];
    for (let x = 0; x <= len - 0.5 + 1e-6; x += 0.25) {
      const major = Math.abs(x - Math.round(x)) < 1e-6, half = Math.abs(x * 2 - Math.round(x * 2)) < 1e-6;
      ticks.push(`M${x} -0.1V${major ? -0.62 : half ? -0.42 : -0.28}`);
      if (major && x > 0) nums.push(`<text x="${x}" y="-0.72" text-anchor="middle">${x}</text>`);
    }
    return `<g class="pinst ruler" transform="translate(${a[0]} ${a[1]}) rotate(${deg})"><rect x="-0.5" y="-1.2" width="${len + 0.5}" height="1.1" rx=".08"/><path d="${ticks.join("")}"/>${nums.join("")}</g>`;
  }
  function protoSvg(a, deg) {
    const R = 2.6, t = [], nums = [], v = visDeg(deg), rv = v * Math.PI / 180;
    for (let d = 0; d < 360; d += 5) {
      const r0 = d % 30 === 0 ? R - 0.55 : d % 10 === 0 ? R - 0.38 : R - 0.22, c = Math.cos(d * Math.PI / 180), s = -Math.sin(d * Math.PI / 180);
      t.push(`M${a[0] + c * r0} ${a[1] + s * r0}L${a[0] + c * R} ${a[1] + s * R}`);
      if (d % 30 === 0) nums.push(`<text x="${a[0] + c * (R - 0.85)}" y="${a[1] + s * (R - 0.85) + 0.1}" text-anchor="middle">${d}</text>`);
    }
    const ex = a[0] + Math.cos(rv) * 1.4, ez = a[1] - Math.sin(rv) * 1.4;
    const wedge = v ? `<path class="pwedge" d="M${a[0]} ${a[1]}L${a[0] + 1.4} ${a[1]}A1.4 1.4 0 ${v > 180 ? 1 : 0} 0 ${ex} ${ez}Z"/>` : "";
    return `<g class="pinst proto"><circle cx="${a[0]}" cy="${a[1]}" r="${R}"/><path d="${t.join("")}M${a[0] - R} ${a[1]}H${a[0] + R}"/>${nums.join("")}${wedge}` +
      `<circle class="pcen" cx="${a[0]}" cy="${a[1]}" r=".12"/><text class="pdeg" x="${a[0] + Math.cos(rv / 2) * 1.95}" y="${a[1] - Math.sin(rv / 2) * 1.95 + 0.2}" text-anchor="middle">${v}°</text></g>`;
  }
  const squareSvg = (v, deg) => `<g class="pinst sq" transform="translate(${v[0]} ${v[1]}) rotate(${deg})"><polygon points="0,0 3.2,0 3.2,-0.55 0.55,-0.55 0.55,-3.2 0,-3.2"/><path d="M0.9 0V-0.9H0" class="pmark"/></g>`;
  const setsqSvg = (v, deg) => `<g class="pinst ss" transform="translate(${v[0]} ${v[1]}) rotate(${deg})"><polygon points="0,0 4,0 0,-2.31"/><polygon class="phole" points="0.55,-0.32 2.6,-0.32 0.55,-1.5"/><text x="3.1" y="-0.12">30°</text><text x="0.12" y="-1.6">60°</text></g>`;
  function overlay() {
    const o = [], lbl = (x, z, t) => `<text class="pinst-t" x="${x}" y="${z}" text-anchor="middle">${t}</text>`;
    const ink = (pts, closed, k) => { let s = ""; const n = pts.length, c = closed ? n : n - 1; for (let j = 0; j < c; j++) s += `<polygon points="${wallPoly(pts[j], pts[(j + 1) % n], k === "out" ? 0.38 : 0.14)}"/>`; return `<g class="pprev">${s}</g>`; };
    if (live && live.tool) {
      const l = live, sh = shapeOf(l), a = l.a, b = l.b, L = dist(a, b), deg = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      if (l.tool === "ruler") o.push(rulerSvg(a, L, deg));
      if (l.tool === "proto") o.push(protoSvg(a, deg));
      if (l.tool === "compass" || l.tool === "poly") o.push(`<circle class="pguide" cx="${a[0]}" cy="${a[1]}" r="${sh.r}"/><path class="pguide" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}"/><circle class="ppivot" cx="${a[0]}" cy="${a[1]}" r=".18"/>` +
        lbl(a[0], a[1] - 0.55, `r = ${nf(sh.r, 2)} m${l.tool === "poly" ? ` · ${S.sides} burchak` : ""}`));
      if (l.tool === "rect") o.push(lbl((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 0.6, `${nf(Math.abs(b[0] - a[0]), 1)} × ${nf(Math.abs(b[1] - a[1]), 1)} m`));
      if (L > 0.01 || l.tool === "rect") o.push(ink(sh.pts, sh.closed, l.k));
      if ((l.tool === "ruler" || l.tool === "proto") && L > 0.01) o.push(lbl(b[0], b[1] - 0.6, `${nf(L, 1)} m`));
    }
    if (poly) {
      const last = poly.pts[poly.pts.length - 1], pts = poly.cur && !same(poly.cur, last) ? [...poly.pts, poly.cur] : poly.pts;
      o.push(ink(pts, false, poly.k));
      poly.pts.forEach((p, i) => { const st = i === 0 && poly.pts.length >= 3; o.push(`<circle class="pnode${st ? " start" : ""}" cx="${p[0]}" cy="${p[1]}" r="${st ? 0.35 : 0.15}"/>`); });
      if (poly.cur && !same(poly.cur, last)) {
        const deg = Math.atan2(poly.cur[1] - last[1], poly.cur[0] - last[0]) * 180 / Math.PI;
        o.push(poly.tool === "square" ? squareSvg(last, deg) : setsqSvg(last, deg));
        o.push(lbl(poly.cur[0], poly.cur[1] - 0.6, `${nf(dist(last, poly.cur), 1)} m · ${visDeg(deg)}°`));
      }
    }
    return o.join("");
  }
  function renderPaper() {
    const o = [];
    let g1 = "", g5 = "";
    for (let x = 0; x <= PW; x++) (x % 5 ? (g1 += `M${x} 0V${PD}`) : (g5 += `M${x} 0V${PD}`));
    for (let z = 0; z <= PD; z++) (z % 5 ? (g1 += `M0 ${z}H${PW}`) : (g5 += `M0 ${z}H${PW}`));
    o.push(`<path class="pg1" d="${g1}"/><path class="pg5" d="${g5}"/><path class="pmargin" d="M2.2 0V${PD}"/>`);
    S.strokes.forEach(s => { if (s.k === "out" && s.closed) o.push(`<polygon class="pfloor" points="${s.pts.map(p => p.join(",")).join(" ")}"/>`); });
    if (S.raw) S.strokes.forEach(s => s.raw && s.raw.length > 1 && o.push(`<polyline class="praw" points="${s.raw.map(p => p.join(",")).join(" ")}"/>`));
    S.strokes.forEach((s, i) => {
      const n = s.pts.length, c = s.closed ? n : n - 1, t = s.k === "out" ? 0.38 : 0.14;
      let segs = "";
      for (let j = 0; j < c; j++) segs += `<polygon points="${wallPoly(s.pts[j], s.pts[(j + 1) % n], t)}"/>`;
      o.push(`<g class="pwall ${s.k}${i === S.strokes.length - 1 && live === "fresh" ? " fresh" : ""}" data-si="${i}">${segs}</g>`);
      if (s.tool === "compass" || s.tool === "poly") {               // aylana va ko'pburchak: har tomoniga emas, bitta umumiy yozuv
        const cx = s.pts.reduce((q, p) => q + p[0], 0) / n, cz = s.pts.reduce((q, p) => q + p[1], 0) / n;
        const half = s.tool === "compass" && !s.closed, ctr = half ? [(s.pts[0][0] + s.pts[n - 1][0]) / 2, (s.pts[0][1] + s.pts[n - 1][1]) / 2] : [cx, cz];
        const r = dist(ctr, s.pts[0]), txt = s.tool === "compass" ? `r = ${nf(r, 2)} m` : `${n} × ${nf(dist(s.pts[0], s.pts[1]), 2)} m`;
        o.push(`<text class="plen" x="${ctr[0]}" y="${ctr[1] + 0.25}" text-anchor="middle">${txt}</text>`);
        return;
      }
      for (let j = 0; j < c; j++) {
        const a = s.pts[j], b = s.pts[(j + 1) % n], L = dist(a, b); if (L < 1.4) continue;
        let ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, ox = -(b[1] - a[1]) / L * 0.8, oz = (b[0] - a[0]) / L * 0.8;   // yozuv devordan biroz chetda
        o.push(`<text class="plen" x="${mx + ox}" y="${mz + oz}" transform="rotate(${ang} ${mx + ox} ${mz + oz})" text-anchor="middle">${nf(L, 1)} m</text>`);
      }
    });
    if (live && live.pts) o.push(`<polyline class="plive ${live.k}" points="${live.pts.map(p => p.join(",")).join(" ")}"/>`);
    o.push(overlay());
    if (!S.strokes.length && !live && !poly) o.push(`<text class="pempty" x="${PW / 2}" y="${PD / 2 - 1}" text-anchor="middle">Qalamni oling va uyingizni chizing</text><text class="pempty s" x="${PW / 2}" y="${PD / 2 + 0.8}" text-anchor="middle">tashqi devorni bir harakatda aylantirib chizing — boshlagan joyingizga qaytsangiz kontur yopiladi</text>`);
    $("#ppSheet").innerHTML = `<svg viewBox="-0.6 -0.6 ${PW + 1.2} ${PD + 1.2}" role="img" aria-label="Oq qog'oz: ${S.strokes.length} ta devor chizig'i">${o.join("")}</svg>`;
  }
  function renderUi() {
    app.querySelectorAll("[data-ppk]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.ppk === kind)));
    app.querySelectorAll("[data-ppr]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.ppr === tool)));
    app.querySelectorAll(".pp-opt").forEach(el => { el.hidden = el.dataset.for !== tool; });
    $('[data-ppo="arc"]').value = S.arc; $('[data-ppo="sides"]').value = String(S.sides);
    app.querySelectorAll("[data-ppm]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.ppm === mode)));
    $('[data-ppo="auto"]').checked = S.auto; $('[data-ppo="raw"]').checked = S.raw;
    $('[data-ppo="h"]').value = S.h; $(".pp-h output").textContent = `${nf(S.h, 1)} m`;
    $('[data-ppa="undo"]').disabled = !undo.length; $('[data-ppa="redo"]').disabled = !redo.length;
    $("#ppStage").className = `pp-stage m-${mode}`;
    const st = stats();
    $("#ppStats").innerHTML = [["Devor chiziqlari", `${st.n} ta`], ["Tashqi devor", `${nf(st.Lout)} m`], ["Ichki devor", `${nf(st.Lin)} m`], ["Yopiq kontur maydoni", `${nf(st.A)} m²`]]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    const HINT = {
      free: kind === "in" ? "Qo'lda, ingichka qalam: xonalarni ajratuvchi devorlarni tashqi devordan tashqi devorgacha chizing." : "Qo'lda: tashqi devorni bitta harakatda aylantirib chizing. Avto-to'g'rilash qiyshiq chiziqni to'g'ri devorga aylantiradi.",
      ruler: "Chizg'ich: boshlanish nuqtasidan sudrang — chiziq tekis chiqadi, burchak 15° qadamda, uzunlik 0,5 m ga yaxlitlanadi.",
      square: poly ? "Go'niya: keyingi nuqtani bosing (faqat 90°). Birinchi nuqtani bossangiz — kontur yopiladi. Enter yoki ikki marta bosish — tugatish, Backspace — oxirgi nuqtani olish." : "Go'niya: nuqtama-nuqta bosing — har bir burchak aniq 90° bo'ladi. To'g'ri to'rtburchak xonalar uchun.",
      setsq: poly ? "Uchburchak: keyingi nuqtani bosing (30°, 45°, 60°, 90°). Birinchi nuqta — yopish, Enter — tugatish." : "Uchburchak chizg'ich: nuqtama-nuqta bosing — burchaklar 15° qadamda: 30°, 45°, 60°, 90°.",
      proto: "Transportir: boshlanish nuqtasidan sudrang — burchak 5° aniqlikda ko'rinadi va shunday qo'yiladi.",
      compass: `Sirkul: markazdan sudrang — ${S.arc === "half" ? "yarim aylana (yoy)" : "aylana"} devor chiziladi, radius 0,25 m qadamda.`,
      rect: "To'rtburchak shablon: bir burchakdan qarama-qarshi burchakkacha sudrang — yopiq xona tayyor.",
      poly: `Ko'pburchak shablon: markazdan sudrang — ${S.sides} burchakli xona (masalan, sakkizburchak maqbara).`,
      erase: "O'chirg'ich: o'chiriladigan devorni bosing.",
    };
    $("#ppHint").textContent = msg || (tool === "free" && st.open && st.loops === 0 ? "Tashqi devor hali yopilmagan: chizishni boshlagan nuqtangizga qaytib tugating — shunda pol va maydon hisoblanadi." : HINT[tool]);
    $("#ppHint").classList.toggle("bad", !!msg);
    const sendOk = st.n > 0; app.querySelectorAll('[data-ppa="newErkin"],[data-ppa="mergeErkin"],[data-ppa="to3d"]').forEach(b => { b.disabled = !sendOk; });
  }
  function changed() { renderPaper(); renderUi(); build3d(); }

  // ---------- Chizish ----------
  const svgPt = (svg, e) => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [clamp(p.x, 0, PW), clamp(p.y, 0, PD)]; };
  app.addEventListener("pointerdown", e => {
    const svg = e.target.closest("#ppSheet svg"); if (!svg) return;
    e.preventDefault();
    if (tool === "erase") {
      const g = e.target.closest("[data-si]");
      if (g) commit(() => { S.strokes.splice(Number(g.dataset.si), 1); });
      return;
    }
    const p = svgPt(svg, e);
    if (POLY.has(tool)) { polyClick(p, e); return; }
    try { svg.setPointerCapture(e.pointerId); } catch {}
    if (DRAG.has(tool)) { const a = snapStart(p); live = { tool, k: kind, id: e.pointerId, a, b: a }; renderPaper(); return; }
    live = { k: kind, id: e.pointerId, pts: [p] };
    renderPaper();
  });
  app.addEventListener("pointermove", e => {
    const sheet = $("#ppSheet svg"); if (!sheet) return;
    if (poly && e.target.closest && e.target.closest("#ppSheet")) { poly.cur = constrain(poly.pts[poly.pts.length - 1], svgPt(sheet, e), poly.tool); renderPaper(); return; }
    if (live && live.tool && e.pointerId === live.id) { live.b = dragEnd(live, svgPt(sheet, e)); renderPaper(); return; }
    if (!live || !live.pts || e.pointerId !== live.id) return;
    const svg = sheet, p = svgPt(svg, e), last = live.pts[live.pts.length - 1];
    if (dist(p, last) > 0.08) { live.pts.push(p); const pl = svg.querySelector(".plive"); if (pl) pl.setAttribute("points", live.pts.map(q => q.join(",")).join(" ")); else renderPaper(); }
  });
  const endStroke = e => {
    if (live && live.tool && (!e || e.pointerId === live.id)) { finishDrag(); return; }
    if (!live || !live.pts || (e && e.pointerId !== live.id)) return;
    const s = live.pts.length > 1 ? recognize(live.pts, live.k) : null;
    live = null;
    if (s) { commit(() => { S.strokes.push(s); }); live = "fresh"; renderPaper(); live = null; }
    else renderPaper();
  };
  app.addEventListener("pointerup", endStroke);
  app.addEventListener("pointercancel", endStroke);

  app.addEventListener("click", e => {
    const b = e.target.closest("[data-ppk],[data-ppr],[data-ppm],[data-ppa]"); if (!b) return;
    if (b.dataset.ppk) { kind = b.dataset.ppk; if (tool === "erase") tool = "free"; if (poly) poly.k = kind; renderUi(); renderPaper(); return; }
    if (b.dataset.ppr) { if (poly) finishPoly(false); tool = b.dataset.ppr; live = null; renderUi(); renderPaper(); return; }
    if (b.dataset.ppm) { setMode(b.dataset.ppm, false); return; }
    const a = b.dataset.ppa;
    if (a === "undo" && undo.length) { redo.push(JSON.stringify(S.strokes)); S.strokes = JSON.parse(undo.pop()); save(); changed(); }
    else if (a === "redo" && redo.length) { undo.push(JSON.stringify(S.strokes)); S.strokes = JSON.parse(redo.pop()); save(); changed(); }
    else if (a === "clear") {
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tasdiqlang"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Qog'ozni tozalash"; } }, 2500); return; }
      b.dataset.armed = ""; b.textContent = "Qog'ozni tozalash"; commit(() => { S.strokes = []; });
    }
    else if (a === "to3d") setMode(mode === "paper" ? "3d" : mode, true);
    else if (a === "newErkin" || a === "mergeErkin") sendToErkin(a === "mergeErkin");
  });
  app.addEventListener("change", e => {
    const t = e.target, k = t.dataset.ppo; if (!k) return;
    if (k === "h") S.h = clamp(Number(t.value) || 3, 2.4, 6);
    else if (k === "arc") S.arc = t.value === "half" ? "half" : "full";
    else if (k === "sides") S.sides = clamp(parseInt(t.value, 10) || 6, 3, 12);
    else S[k] = t.checked;
    save(); changed();
  });
  app.addEventListener("input", e => { if (e.target.dataset.ppo === "h") { S.h = Number(e.target.value); $(".pp-h output").textContent = `${nf(S.h, 1)} m`; build3d(); } });
  document.addEventListener("keydown", e => {
    if (!app.offsetParent || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopImmediatePropagation(); $(`[data-ppa="${e.shiftKey ? "redo" : "undo"}"]`).click(); return; }
    if (poly && e.key === "Enter") { e.preventDefault(); finishPoly(false); }
    else if ((poly || live) && e.key === "Escape") { poly = null; live = null; renderPaper(); renderUi(); }
    else if (poly && e.key === "Backspace") { e.preventDefault(); poly.pts.pop(); if (!poly.pts.length) poly = null; renderPaper(); renderUi(); }
  }, true);

  // ---------- Erkin qurishga o'tkazish ----------
  function sendToErkin(merge) {
    const chains = S.strokes.map(s => ({ k: s.k, closed: s.closed, pts: s.pts.map(p => p.slice()) }));
    let model = null;
    try { model = JSON.parse(localStorage.getItem("ustun-erkin") || "null"); } catch {}
    if (web && window.FreeBuild) model = JSON.parse(JSON.stringify(window.FreeBuild.model));
    if (merge && model && Array.isArray(model.levels) && model.levels.length) {
      model.levels[0].chains = [...(model.levels[0].chains || []), ...chains];      // 1-qavatga qo'shiladi, mavjud devorlar saqlanadi
    } else {
      const base = model && !merge ? model : {};
      model = { ...base, levels: [{ h: S.h, chains, open: [] }] };
      if (merge) model.levels[0].h = S.h;
    }
    model.levels[0].h = model.levels[0].h || S.h;
    if (web && window.FreeBuild) { window.FreeBuild._set(model); try { localStorage.setItem("ustun-erkin", JSON.stringify(window.FreeBuild.model)); } catch {} showView("erkin"); }
    else { try { localStorage.setItem("ustun-erkin", JSON.stringify(model)); } catch {} location.href = "builder.html"; }
  }

  // ---------- 3D ----------
  let R = null, raf = 0;
  function ensureThree(cb) {
    if (window.THREE) return cb();
    const s = document.createElement("script"); s.src = THREE_URL; s.onload = cb; s.onerror = () => { $("#pp3d").innerHTML = `<p class="muted pp-3dhint">3D kutubxona yuklanmadi (internet kerak).</p>`; };
    document.head.appendChild(s);
  }
  function init3d() {
    const T = window.THREE, host = $("#pp3d");
    let renderer; try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch { return false; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(36, 1, 0.3, 500);
    scene.add(new T.HemisphereLight(0xffffff, 0x8d9296, 0.95));
    const sun = new T.DirectionalLight(0xfff1dc, 0.85); sun.position.set(30, 40, 35); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 }); scene.add(sun);
    const paper = new T.Mesh(new T.PlaneGeometry(PW + 2, PD + 2), new T.MeshStandardMaterial({ color: 0xfbfaf6, roughness: 1 }));
    paper.rotation.x = -Math.PI / 2; paper.position.set(PW / 2, -0.01, PD / 2); paper.receiveShadow = true; scene.add(paper);
    const grid = new T.GridHelper(PW, PW, 0x9fb4d8, 0xd5deec); grid.scale.z = PD / PW; grid.position.set(PW / 2, 0.001, PD / 2); scene.add(grid);
    R = { T, renderer, scene, camera, sun, host, group: null, disp: [], theta: -0.65, phi: 0.95, zoom: 1, center: new T.Vector3(PW / 2, 1.5, PD / 2), base: 40, born: 0, auto: true, last: 0 };
    let drag = null;
    renderer.domElement.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY }; R.auto = false; try { renderer.domElement.setPointerCapture(e.pointerId); } catch {} });
    renderer.domElement.addEventListener("pointermove", e => { if (!drag) return; R.theta -= (e.clientX - drag.x) * 0.007; R.phi = clamp(R.phi - (e.clientY - drag.y) * 0.007, 0.15, 1.45); drag = { x: e.clientX, y: e.clientY }; loop(); });
    renderer.domElement.addEventListener("pointerup", () => { drag = null; });
    renderer.domElement.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); R.zoom = clamp(R.zoom * Math.exp(e.deltaY * 0.0015), 0.4, 2.2); loop(); }, { passive: false });
    new ResizeObserver(() => loop()).observe(host);
    return true;
  }
  function build3d() {
    if (!R) return;
    const T = R.T;
    R.disp.splice(0).forEach(o => o.dispose());
    if (R.group) R.scene.remove(R.group);
    const g = new T.Group(); R.group = g; R.scene.add(g);
    const track = o => { R.disp.push(o); return o; };
    const outM = track(new T.MeshStandardMaterial({ color: 0xb5683f, roughness: 0.85 })), inM = track(new T.MeshStandardMaterial({ color: 0xe3ded2, roughness: 0.9 }));
    const floorM = track(new T.MeshStandardMaterial({ color: 0xc9b08a, roughness: 0.9 })), inkM = track(new T.LineBasicMaterial({ color: 0x1f2326 }));
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const ends = []; S.strokes.forEach(s => s.pts.forEach(p => ends.push(p)));
    const shared = p => ends.filter(q => dist(p, q) < 1e-6).length > 1;
    S.strokes.forEach(s => {
      const n = s.pts.length, c = s.closed ? n : n - 1, t = s.k === "out" ? 0.38 : 0.14, h = s.k === "out" ? S.h : S.h - 0.05;
      for (let j = 0; j < c; j++) {
        const a = s.pts[j], b = s.pts[(j + 1) % n], L = dist(a, b); if (L < 1e-6) continue;
        const ext = (s.closed || j > 0 || shared(a) ? t / 2 : 0) + (s.closed || j < c - 1 || shared(b) ? t / 2 : 0);   // burchaklarda tirqish qolmasin
        const off = ((s.closed || j > 0 || shared(a) ? t / 2 : 0) - (s.closed || j < c - 1 || shared(b) ? t / 2 : 0)) / 2;
        const m = new T.Mesh(track(new T.BoxGeometry(L + ext, h, t)), s.k === "out" ? outM : inM);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), ux = Math.cos(ang), uz = Math.sin(ang);
        m.position.set((a[0] + b[0]) / 2 - ux * off, h / 2, (a[1] + b[1]) / 2 - uz * off); m.rotation.y = -ang; m.castShadow = m.receiveShadow = true; g.add(m);
        const edges = new T.LineSegments(track(new T.EdgesGeometry(m.geometry)), inkM); edges.position.copy(m.position); edges.rotation.copy(m.rotation); g.add(edges);
        [a, b].forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); });
      }
      if (s.k === "out" && s.closed && n >= 3) {
        const sh = new T.Shape(); s.pts.forEach((p, i) => (i ? sh.lineTo(p[0], -p[1]) : sh.moveTo(p[0], -p[1]))); sh.closePath();
        const f = new T.Mesh(track(new T.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false })), floorM); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; g.add(f);
      }
    });
    if (x0 === Infinity) { x0 = 0; x1 = PW; z0 = 0; z1 = PD; }
    R.center.set((x0 + x1) / 2, S.h * 0.35, (z0 + z1) / 2);
    R.base = Math.max(x1 - x0, z1 - z0, 8) * 2.1 + 10;
    loop();
  }
  function frame(now) {
    raf = 0; if (!R) return;
    const dt = R.last ? Math.min(0.05, (now - R.last) / 1000) : 0.016; R.last = now;
    const w = R.host.clientWidth, h = R.host.clientHeight; if (!w || !h) return;
    R.renderer.setSize(w, h, false); R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
    let again = false;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");
    if (R.group) {                                                  // devorlar qog'ozdan qad ko'taradi
      const k = reduce ? 1 : Math.min(1, (now - R.born) / 1400), e = 1 - Math.pow(1 - k, 3);
      R.group.scale.y = 0.02 + 0.98 * e; if (k < 1) again = true;
    }
    if (R.auto && !reduce) { R.theta += dt * 0.15; again = true; }
    const d = R.base * R.zoom, sp = Math.sin(R.phi);
    R.camera.position.set(R.center.x + d * sp * Math.sin(R.theta), R.center.y + d * Math.cos(R.phi), R.center.z + d * sp * Math.cos(R.theta));
    R.camera.lookAt(R.center);
    R.renderer.render(R.scene, R.camera);
    if (again && mode !== "paper" && !document.hidden) raf = requestAnimationFrame(frame);
    else R.last = 0;
  }
  function loop() { if (R && !raf && mode !== "paper") raf = requestAnimationFrame(frame); }
  function setMode(m, animate) {
    mode = m; renderUi();
    if (m === "paper") return;
    ensureThree(() => {
      if (!R && !init3d()) { $("#pp3d").innerHTML = `<p class="muted pp-3dhint">Bu qurilmada 3D (WebGL) ishlamaydi.</p>`; return; }
      build3d();
      if (animate || !R.born) { R.born = performance.now(); R.auto = true; }
      loop();
    });
  }

  changed();
  window.Paper = { get state() { return JSON.parse(JSON.stringify(S)); }, recognize, setMode, _strokes(list) { S.strokes = list; save(); changed(); } };   // sinov uchun
})();
