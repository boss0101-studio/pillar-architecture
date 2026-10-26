// Erkin qurish: tayyor quti yo'q. Odam bo'sh to'rga tashqi va ichki devorlarni o'zi chizadi, eshik va deraza qo'yadi,
// qavat qo'shadi. Fundament, pol, yopma, tom va butun hisob-kitob chizilgan devorlardan avtomatik chiqadi (formulasi bilan).
// Koordinatalar metrda: x — o'ngga, z — pastga (ko'cha tomonga). Devor chizig'i — devor o'qi (qalinlik ikki tomonga teng).
(function () {
  const app = document.getElementById("fbApp");
  if (!app) return;

  const SITE_W = 40, SITE_D = 30, GRID = 0.5, SNAP_PT = 0.45, SLAB = 0.2;
  const STORE = "ustun-erkin";
  const MATS = {
    gisht:    { n: "Pishiq g'isht",        color: 0xb5683f, css: "#b5683f" },
    gazoblok: { n: "Gazoblok",              color: 0xe3ded2, css: "#e3ded2" },
    beton:    { n: "Monolit beton",         color: 0x9aa0a4, css: "#9aa0a4" },
    shisha:   { n: "Shisha (vitraj)",       color: 0x9cc0dc, css: "#9cc0dc", glass: true },   // oynali devor: 3D'da shaffof
  };
  const DEF_OPEN = { door: { w: 0.9, h: 2.1, sill: 0 }, win: { w: 1.2, h: 1.4, sill: 0.9 } };
  const TOOLS = [["select", "Tanlash"], ["out", "Tashqi devor"], ["in", "Ichki devor"], ["shape", "Shakl"], ["door", "Eshik"], ["win", "Deraza"], ["erase", "O'chirish"]];
  // Tayyor kontur shakllari: bosilgan joyga yopiq tashqi devor sifatida qo'yiladi (keyin oddiy devorlardek tahrirlanadi)
  const SHAPE_KINDS = [["rect", "To'rtburchak"], ["L", "L shakl"], ["U", "П shakl"], ["T", "T shakl"], ["circle", "Aylana"], ["semi", "Yarim aylana"],
                       ["octagon", "Sakkizburchak"], ["hexagon", "Oltiburchak"], ["triangle", "Uchburchak"], ["trapezoid", "Trapetsiya"]];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nf = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("ru-RU");
  const n0 = v => Math.round(v).toLocaleString("ru-RU");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r2 = v => Math.round(v * 100) / 100;
  const snapG = v => Math.round(v / GRID) * GRID;
  const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;

  // ---------- Model ----------
  // Sozlamalardagi standartlar (Sozlamalar → Loyihalar); sozlama yo'q bo'lsa — odatiy qiymatlar
  const FS = () => ({ fbH: 3, fbOutT: 0.38, fbOutMat: "gisht", fbInT: 0.12, fbInMat: "gisht", fbFd: 1.2, pGisht: 0.14, pBeton: 95, pArm: 0.95,
                      ...(typeof UstunSettings !== "undefined" ? UstunSettings.get().project : {}) });
  const blank = () => { const s = FS(); return { levels: [{ h: s.fbH, chains: [], open: [] }], outT: s.fbOutT, outMat: s.fbOutMat, inT: s.fbInT, inMat: s.fbInMat, roof: "tekis", fd: s.fbFd,
                         doorW: 0.9, winW: 1.2, winH: 1.4 }; };
  function clean(raw) {
    const m = blank();
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.levels) || !raw.levels.length) return m;
    const num = (v, a, b, d) => (Number.isFinite(Number(v)) ? clamp(Number(v), a, b) : d);
    const pt = p => Array.isArray(p) && p.length === 2 && p.every(v => Number.isFinite(Number(v))) ? [r2(clamp(Number(p[0]), 0, SITE_W)), r2(clamp(Number(p[1]), 0, SITE_D))] : null;
    m.levels = raw.levels.slice(0, 12).map(l => ({
      h: num(l && l.h, 2.4, 6, 3),
      chains: ((l && l.chains) || []).slice(0, 200).map(c => ({ k: c && c.k === "in" ? "in" : "out", closed: !!(c && c.closed), pts: ((c && c.pts) || []).slice(0, 200).map(pt).filter(Boolean) }))
        .filter(c => c.pts.length >= 2),
      open: ((l && l.open) || []).slice(0, 300).filter(o => o && (o.t === "door" || o.t === "win") && pt([o.x, o.z]))
        .map(o => ({ t: o.t, x: r2(Number(o.x)), z: r2(Number(o.z)), w: num(o.w, 0.5, 4, DEF_OPEN[o.t].w), h: num(o.h, 0.4, 3, DEF_OPEN[o.t].h), sill: num(o.sill, 0, 2, DEF_OPEN[o.t].sill) })),
    }));
    m.outT = num(raw.outT, 0.2, 0.8, 0.38); m.inT = num(raw.inT, 0.08, 0.4, 0.12);
    m.outMat = MATS[raw.outMat] ? raw.outMat : "gisht"; m.inMat = MATS[raw.inMat] ? raw.inMat : "gisht";
    m.roof = ["yoq", "nishab", "gumbaz"].includes(raw.roof) ? raw.roof : "tekis"; m.fd = num(raw.fd, 0.5, 3, 1.2);
    m.doorW = num(raw.doorW, 0.6, 3, 0.9); m.winW = num(raw.winW, 0.4, 4, 1.2); m.winH = num(raw.winH, 0.4, 2.4, 1.4);
    return m;
  }
  let M = blank();
  try { M = clean(JSON.parse(localStorage.getItem(STORE) || "null")); } catch {}
  let lv = 0, tool = "out", draw = null, hover = null, sel = null, kesim = false, msg = "", undo = [], redo = [];
  let shp = { k: "rect", w: 12, d: 10, wing: 0.4 }, arc = false, arcEnd = null;   // shakl asbobi va yoy (egri devor) rejimi
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(M)); } catch {} };

  // Devor segmentlari: [{ ci, si, a, b, k, t, L }]
  function segsOf(level) {
    const out = [];
    level.chains.forEach((c, ci) => {
      const n = c.pts.length, cnt = c.closed ? n : n - 1;
      for (let si = 0; si < cnt; si++) {
        const a = c.pts[si], b = c.pts[(si + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L > 1e-6) out.push({ ci, si, a, b, k: c.k, t: c.k === "out" ? M.outT : M.inT, L });
      }
    });
    return out;
  }
  // Nuqtadan segmentgacha: masofa va segment bo'ylab joy (s, 0..L)
  function proj(p, sg) {
    const dx = sg.b[0] - sg.a[0], dz = sg.b[1] - sg.a[1], L2 = dx * dx + dz * dz;
    const u = clamp(((p[0] - sg.a[0]) * dx + (p[1] - sg.a[1]) * dz) / L2, 0, 1);
    const q = [sg.a[0] + dx * u, sg.a[1] + dz * u];
    return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), s: u * sg.L, q };
  }
  function nearestSeg(level, p, maxD) {
    let best = null;
    for (const sg of segsOf(level)) { const r = proj(p, sg); if (r.d <= maxD && (!best || r.d < best.d)) best = { ...r, sg }; }
    return best;
  }
  // Eshik/deraza qaysi devorda: markazi devor o'qida (0,12 m gacha)
  function attach(level, o) {
    const hit = nearestSeg(level, [o.x, o.z], 0.12);
    return hit ? { sg: hit.sg, s: hit.s } : null;
  }
  // Yopiq tashqi kontur maydoni (shoelace) va perimetri — o'q chizig'i bo'yicha
  function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
  function polyPerim(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += Math.hypot(q[0] - p[0], q[1] - p[1]); } return s; }

  // ---------- Tarix ----------
  function commit(fn) {
    const before = JSON.stringify(M);
    if (fn() === false) return false;
    if (JSON.stringify(M) === before) return false;
    undo.push(before); if (undo.length > 100) undo.shift(); redo = [];
    save(); changed(); return true;
  }
  function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(M)); M = clean(JSON.parse(undo.pop())); lv = Math.min(lv, M.levels.length - 1); sel = null; save(); changed(); }
  function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(M)); M = clean(JSON.parse(redo.pop())); lv = Math.min(lv, M.levels.length - 1); sel = null; save(); changed(); }
  function flash(t) { msg = t; renderHint(); setTimeout(() => { if (msg === t) { msg = ""; renderHint(); } }, 2200); }

  // ---------- Shakl va yoy geometriyasi ----------
  // Markazi (cx, cz) bo'lgan, eni w va chuqurligi d bo'lgan yopiq kontur; z pastga (ko'cha tomonga)
  function shapePts(k, w, d, wing, cx, cz) {
    const a = Math.max(2, Math.min(w, d) * clamp(wing, 0.2, 0.6)), x0 = -w / 2, z0 = -d / 2, x1 = w / 2, z1 = d / 2, ring = (n, from, to) =>
      Array.from({ length: n }, (_, i) => { const t = from + (to - from) * i / (to === from + 2 * Math.PI ? n : n - 1); return [w / 2 * Math.cos(t), d / 2 * Math.sin(t)]; });
    let pts;
    switch (k) {
      case "L": pts = [[x0, z0], [x0 + a, z0], [x0 + a, z1 - a], [x1, z1 - a], [x1, z1], [x0, z1]]; break;
      case "U": pts = [[x0, z0], [x0 + a, z0], [x0 + a, z1 - a], [x1 - a, z1 - a], [x1 - a, z0], [x1, z0], [x1, z1], [x0, z1]]; break;
      case "T": pts = [[-a / 2, z0], [a / 2, z0], [a / 2, z1 - a], [x1, z1 - a], [x1, z1], [x0, z1], [x0, z1 - a], [-a / 2, z1 - a]]; break;
      case "circle": pts = ring(24, 0, 2 * Math.PI); break;
      case "semi": pts = ring(13, Math.PI, 2 * Math.PI).map(([x, z]) => [x, z * 2 + d / 2]); break;     // tekis tomoni ko'chaga qaragan yarim aylana
      case "octagon": { const c = Math.min(w, d) * 0.29; pts = [[x0 + c, z0], [x1 - c, z0], [x1, z0 + c], [x1, z1 - c], [x1 - c, z1], [x0 + c, z1], [x0, z1 - c], [x0, z0 + c]]; break; }
      case "hexagon": pts = [[x0 + w / 4, z0], [x1 - w / 4, z0], [x1, 0], [x1 - w / 4, z1], [x0 + w / 4, z1], [x0, 0]]; break;
      case "triangle": pts = [[0, z0], [x1, z1], [x0, z1]]; break;
      case "trapezoid": pts = [[x0 + w * 0.2, z0], [x1 - w * 0.2, z0], [x1, z1], [x0, z1]]; break;
      default: pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    }
    // Uchastkadan chiqib ketmasin: kerak bo'lsa butun shakl suriladi
    const xs = pts.map(q => q[0] + cx), zs = pts.map(q => q[1] + cz);
    const sx = Math.min(0, SITE_W - Math.max(...xs)) + Math.max(0, -Math.min(...xs)), sz = Math.min(0, SITE_D - Math.max(...zs)) + Math.max(0, -Math.min(...zs));
    return pts.map(([x, z]) => [r2(clamp(x + cx + sx, 0, SITE_W)), r2(clamp(z + cz + sz, 0, SITE_D))]);
  }
  // A dan B gacha C nuqtadan o'tadigan yoy: oraliq nuqtalar (A va B kirmaydi); C chiziqda yotsa — bo'sh
  function arcPts(A, B, C) {
    const ax = A[0], az = A[1], bx = B[0], bz = B[1], cx = C[0], cz = C[1];
    const D2 = 2 * (ax * (bz - cz) + bx * (cz - az) + cx * (az - bz)); if (Math.abs(D2) < 1e-6) return [];
    const ux = ((ax * ax + az * az) * (bz - cz) + (bx * bx + bz * bz) * (cz - az) + (cx * cx + cz * cz) * (az - bz)) / D2;
    const uz = ((ax * ax + az * az) * (cx - bx) + (bx * bx + bz * bz) * (ax - cx) + (cx * cx + cz * cz) * (bx - ax)) / D2;
    const r = Math.hypot(ax - ux, az - uz); if (r > 200) return [];
    const ang = (x, z) => Math.atan2(z - uz, x - ux), norm = t => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const tA = ang(ax, az), sweepCW = norm(ang(bx, bz) - tA), viaC = norm(ang(cx, cz) - tA);
    const sweep = viaC <= sweepCW ? sweepCW : sweepCW - 2 * Math.PI;          // C orqali o'tadigan yo'nalish
    const n = clamp(Math.ceil(Math.abs(sweep) * r / 0.6), 4, 32), out = [];
    for (let i = 1; i < n; i++) { const t = tA + sweep * i / n; out.push([r2(clamp(ux + r * Math.cos(t), 0, SITE_W)), r2(clamp(uz + r * Math.sin(t), 0, SITE_D))]); }
    return out;
  }
  function placeShape(raw) {
    const pts = shapePts(shp.k, shp.w, shp.d, shp.wing, snapG(raw[0]), snapG(raw[1]));
    commit(() => { M.levels[lv].chains.push({ k: "out", closed: true, pts }); });
    flash(`${SHAPE_KINDS.find(x => x[0] === shp.k)[1]} qo'yildi: devorlari oddiy devorlardek tahrirlanadi va hisobga kiradi.`);
  }

  // ---------- Amallar ----------
  function snapPoint(raw, ortho) {
    let p = [clamp(snapG(raw[0]), 0, SITE_W), clamp(snapG(raw[1]), 0, SITE_D)];
    if (ortho && draw && draw.pts.length) {                         // Shift: faqat gorizontal yoki vertikal
      const l = draw.pts[draw.pts.length - 1];
      if (Math.abs(p[0] - l[0]) >= Math.abs(p[1] - l[1])) p = [p[0], l[1]]; else p = [l[0], p[1]];
    }
    // mavjud devor uchlariga yopishish (devorlar ulanishi uchun)
    let best = null, bd = SNAP_PT;
    const consider = q => { const d = Math.hypot(q[0] - raw[0], q[1] - raw[1]); if (d < bd) { bd = d; best = q; } };
    M.levels[lv].chains.forEach(c => c.pts.forEach(consider));
    if (draw) draw.pts.forEach(consider);
    return best ? best.slice() : p;
  }
  function finishDraw() {
    arcEnd = null;
    if (!draw) return;
    const d = draw; draw = null;
    if (d.pts.length >= 2) commit(() => { M.levels[lv].chains.push({ k: d.k, closed: false, pts: d.pts }); });
    else changed();
  }
  function clickDraw(p) {
    if (!draw) { draw = { k: tool, pts: [p] }; changed(); return; }
    const pts = draw.pts, last = pts[pts.length - 1];
    if (same(p, last)) return;
    if (pts.length >= 3 && same(p, pts[0])) {                       // boshlang'ich nuqtaga qaytildi: kontur yopiladi
      const d = draw; draw = null;
      commit(() => { M.levels[lv].chains.push({ k: d.k, closed: true, pts: d.pts }); });
      flash(d.k === "out" ? "Kontur yopildi: fundament, pol va tom hisoblandi." : "Ichki devor konturi yopildi.");
      return;
    }
    pts.push(p); changed();
  }
  function deleteSeg(ci, si) {
    commit(() => {
      const chains = M.levels[lv].chains, c = chains[ci]; if (!c) return false;
      const n = c.pts.length;
      if (c.closed) { c.pts = [...c.pts.slice(si + 1), ...c.pts.slice(0, si + 1)]; c.closed = false; }   // yopiq kontur ochiq zanjirga aylanadi
      else {
        const A = c.pts.slice(0, si + 1), B = c.pts.slice(si + 1);
        chains.splice(ci, 1, ...[A, B].filter(p => p.length >= 2).map(p => ({ k: c.k, closed: false, pts: p })));
      }
      if (c.closed === false && c.pts.length < 2) chains.splice(ci, 1);
      void n;
    });
    sel = null;
  }
  function placeOpening(t, raw) {
    const level = M.levels[lv], hit = nearestSeg(level, raw, 0.6);
    if (!hit) { flash("Eshik yoki derazani devor ustiga qo'ying."); return; }
    if (t === "win" && hit.sg.k !== "out") { flash("Deraza faqat tashqi devorga qo'yiladi."); return; }
    const w = t === "door" ? M.doorW : M.winW, s = clamp(Math.round(hit.s * 10) / 10, w / 2 + 0.1, hit.sg.L - w / 2 - 0.1);
    if (hit.sg.L < w + 0.2) { flash(`Bu devor juda qisqa (${nf(hit.sg.L, 2)} m): ${nf(w, 2)} m teshik sig'maydi.`); return; }
    const others = level.open.map(o => ({ o, at: attach(level, o) })).filter(x => x.at && x.at.sg.ci === hit.sg.ci && x.at.sg.si === hit.sg.si);
    if (others.some(x => Math.abs(x.at.s - s) < (x.o.w + w) / 2 + 0.1)) { flash("Bu yerda boshqa teshik bor."); return; }
    const u = s / hit.sg.L, x = r2(hit.sg.a[0] + (hit.sg.b[0] - hit.sg.a[0]) * u), z = r2(hit.sg.a[1] + (hit.sg.b[1] - hit.sg.a[1]) * u);
    commit(() => { level.open.push({ t, x, z, w, h: t === "door" ? DEF_OPEN.door.h : M.winH, sill: t === "door" ? 0 : DEF_OPEN.win.sill }); });
    sel = { kind: "op", i: level.open.length - 1 }; renderSide();
  }
  function hitOpening(level, p) {
    let best = -1, bd = 0.5;
    level.open.forEach((o, i) => { const d = Math.hypot(o.x - p[0], o.z - p[1]); if (d < Math.max(bd, 0)) { const lim = o.w / 2 + 0.15; if (d < lim) { bd = d; best = i; } } });
    return best;
  }

  // Oxirgi qavatdagi har bir yopiq kontur uchun: markaz, tom balandligi (nishab) va gumbaz radiusi
  function roofForms(level) {
    const forms = level.chains.filter(c => c.k === "out" && c.closed && c.pts.length >= 3).map(c => {
      const xs = c.pts.map(q => q[0]), zs = c.pts.map(q => q[1]), w = Math.max(...xs) - Math.min(...xs), d = Math.max(...zs) - Math.min(...zs);
      const half = Math.min(w, d) / 2, R = Math.min(half * 0.75, 6), A = polyArea(c.pts), r = Math.min(half * 0.7, 8);
      const cx = c.pts.reduce((s2, q) => s2 + q[0], 0) / c.pts.length, cz = c.pts.reduce((s2, q) => s2 + q[1], 0) / c.pts.length;
      return { c, A, R, half, r, cx, cz };
    });
    return { forms, slope: forms.reduce((s2, x) => s2 + x.A * Math.hypot(1, x.R / Math.max(0.5, x.half)), 0), dome: forms.reduce((s2, x) => s2 + 2 * Math.PI * x.r * x.r * 1.15, 0) };
  }

  // ---------- Hisob-kitob (hammasi chizilgan devorlardan) ----------
  function calc() {
    const levels = M.levels.map((level, i) => {
      const segs = segsOf(level), h = level.h, top = i === M.levels.length - 1;
      const extraH = top && M.roof === "tekis" ? 0.6 : 0;               // tekis tomda tashqi devor parapet bo'lib 0,6 m ko'tariladi
      const atts = level.open.map(o => ({ o, at: attach(level, o) }));
      const stray = atts.filter(x => !x.at).length;
      const by = k => segs.filter(s => s.k === k);
      const L = k => by(k).reduce((s, x) => s + x.L, 0);
      const opArea = k => atts.filter(x => x.at && x.at.sg.k === k).reduce((s, x) => s + x.o.w * x.o.h, 0);
      const closed = level.chains.filter(c => c.k === "out" && c.closed && c.pts.length >= 3);
      const A = closed.reduce((s, c) => s + polyArea(c.pts), 0), P = closed.reduce((s, c) => s + polyPerim(c.pts), 0);
      const net = Math.max(0, A - P * M.outT / 2 - L("in") * M.inT);
      const win = atts.filter(x => x.at && x.o.t === "win"), doors = atts.filter(x => x.at && x.o.t === "door");
      return { i, h, extraH, Lout: L("out"), Lin: L("in"), opOut: opArea("out"), opIn: opArea("in"), A, P, net, closedN: closed.length,
               openOut: level.chains.filter(c => c.k === "out" && !c.closed).length, win, doors, stray,
               winA: win.reduce((s, x) => s + x.o.w * x.o.h, 0) };
    });
    const sum = f => levels.reduce((s, l) => s + f(l), 0);
    const Lout = sum(l => l.Lout), Lin = sum(l => l.Lin);
    const grossOut = sum(l => l.Lout * (l.h + l.extraH)), grossIn = sum(l => l.Lin * l.h);
    const opOut = sum(l => l.opOut), opIn = sum(l => l.opIn);
    const netOut = Math.max(0, grossOut - opOut), netIn = Math.max(0, grossIn - opIn);
    const Vout = netOut * M.outT, Vin = netIn * M.inT;
    const H = sum(l => l.h), groups = [], warns = [], boq = [], FP = FS();
    const L0 = levels[0];

    if (!Lout && !Lin) return { groups, warns: ["Hali birorta devor chizilmagan. \"Tashqi devor\" asbobini olib, to'rda nuqtalarni ketma-ket bosing; boshlang'ich nuqtani qayta bossangiz, kontur yopiladi."], boq, total: 0 };

    levels.forEach(l => {
      if (l.openOut) warns.push(`${l.i + 1}-qavat: ${l.openOut} ta tashqi devor zanjiri yopilmagan — pol maydoni${l.i === 0 ? ", fundament" : ""} va tom uning uchun hisoblanmaydi.`);
      if (l.stray) warns.push(`${l.i + 1}-qavat: ${l.stray} ta eshik/deraza devor ustida emas (devor o'chirilgan bo'lishi mumkin) — hisobga kirmadi.`);
      if ((l.Lout || l.Lin) && !l.closedN) warns.push(`${l.i + 1}-qavat: yopiq tashqi kontur yo'q — boshlang'ich nuqtani qayta bosib konturni yoping.`);
    });

    // Devorlar
    const parts = levels.filter(l => l.Lout || l.Lin).map(l => `${l.i + 1}-q: ${nf(l.Lout)}`).join(" + ");
    groups.push({ title: "Devorlar", rows: [
      { k: "Tashqi devor uzunligi (o'q bo'yicha)", f: `Σ L = ${parts || "0"}`, v: nf(Lout), u: "m" },
      { k: "Ichki devor uzunligi", f: `Σ L = ${levels.filter(l => l.Lin).map(l => `${l.i + 1}-q: ${nf(l.Lin)}`).join(" + ") || "0"}`, v: nf(Lin), u: "m" },
      { k: "Devor yuzasi (brutto)", f: `Σ L × h${levels[levels.length - 1].extraH ? " (+0,6 m parapet)" : ""} = ${nf(grossOut)} + ${nf(grossIn)}`, v: nf(grossOut + grossIn), u: "m²" },
      { k: "Teshiklar (eshik + deraza)", f: `Σ en × bo'y = ${nf(opOut, 2)} + ${nf(opIn, 2)}`, v: nf(opOut + opIn, 2), u: "m²" },
      { k: "Devor yuzasi (netto)", f: `${nf(grossOut + grossIn)} − ${nf(opOut + opIn, 2)}`, v: nf(netOut + netIn), u: "m²" },
      { k: "Devor hajmi", f: `tashqi ${nf(netOut)} × ${nf(M.outT, 2)} + ichki ${nf(netIn)} × ${nf(M.inT, 2)}`, v: nf(Vout + Vin, 2), u: "m³" },
    ] });

    // Material (tashqi va ichki devor materiali bo'yicha)
    const vol = {}; vol[M.outMat] = (vol[M.outMat] || 0) + Vout; vol[M.inMat] = (vol[M.inMat] || 0) + Vin;
    const mrows = [];
    if (vol.gisht) {
      const n = vol.gisht * 394, q = vol.gisht * 0.24;
      mrows.push({ k: "G'isht 250×120×65", f: `V × 394 dona/m³ = ${nf(vol.gisht, 2)} × 394`, v: n0(n), u: "dona" }, { k: "G'isht qorishmasi", f: `V × 0,24 = ${nf(vol.gisht, 2)} × 0,24`, v: nf(q, 2), u: "m³" });
      boq.push({ n: "G'isht 250×120×65", q: Math.ceil(n), u: "dona", p: FP.pGisht }, { n: "Sement-qum qorishmasi", q: Math.ceil(q * 10) / 10, u: "m³", p: 65 });
    }
    if (vol.gazoblok) {
      const n = vol.gazoblok * 27.8, g = vol.gazoblok * 25;
      mrows.push({ k: "Gazoblok 600×300×200", f: `V × 27,8 dona/m³ = ${nf(vol.gazoblok, 2)} × 27,8`, v: n0(n), u: "dona" }, { k: "Blok yelimi", f: `V × 25 kg/m³`, v: n0(g), u: "kg" });
      boq.push({ n: "Gazoblok 600×300×200", q: Math.ceil(n), u: "dona", p: 1.7 }, { n: "Blok yelimi", q: Math.ceil(g), u: "kg", p: 0.35 });
    }
    if (vol.beton) {
      const a = vol.beton * 80;
      mrows.push({ k: "Devor betoni (B25)", f: `V = ${nf(vol.beton, 2)}`, v: nf(vol.beton, 2), u: "m³" }, { k: "Devor armaturasi", f: `V × 80 kg/m³`, v: n0(a), u: "kg" });
      boq.push({ n: "Devor betoni B25", q: Math.ceil(vol.beton * 10) / 10, u: "m³", p: FP.pBeton }, { n: "Armatura A500", q: Math.ceil(a), u: "kg", p: FP.pArm });
    }
    if (vol.shisha) {                                                 // shisha devor: yuza bo'yicha (alyuminiy karkasli vitraj)
      const A = (M.outMat === "shisha" ? netOut : 0) + (M.inMat === "shisha" ? netIn : 0);
      mrows.push({ k: "Shisha devor (vitraj)", f: `sof devor yuzasi`, v: nf(A), u: "m²" });
      boq.push({ n: "Shisha fasad (vitraj)", q: Math.ceil(A), u: "m²", p: price("mat-shisha", 210) });
    }
    groups.push({ title: "Devor materiallari", rows: mrows });

    // Fundament: 1-qavat devorlari ostida lenta
    if (L0.Lout || L0.Lin) {
      const bo = M.outT + 0.2, bi = M.inT + 0.2, Vf = L0.Lout * bo * M.fd + L0.Lin * bi * M.fd, arm = Vf * 60;
      groups.push({ title: "Fundament (lenta, 1-qavat devorlari ostida)", rows: [
        { k: "Lenta uzunligi", f: `tashqi ${nf(L0.Lout)} + ichki ${nf(L0.Lin)}`, v: nf(L0.Lout + L0.Lin), u: "m" },
        { k: "Lenta eni", f: `devor + 0,2 m: tashqi ${nf(bo, 2)}, ichki ${nf(bi, 2)}`, v: nf(bo, 2), u: "m" },
        { k: "Chuqurligi", f: "muzlash chuqurligidan past (sozlamada o'zgartiriladi)", v: nf(M.fd, 2), u: "m" },
        { k: "Fundament betoni", f: `${nf(L0.Lout)} × ${nf(bo, 2)} × ${nf(M.fd, 2)} + ${nf(L0.Lin)} × ${nf(bi, 2)} × ${nf(M.fd, 2)}`, v: nf(Vf, 2), u: "m³", tone: L0.openOut ? "warn" : "" },
        { k: "Fundament armaturasi", f: `V × 60 kg/m³`, v: n0(arm), u: "kg" },
      ] });
      boq.push({ n: "Fundament betoni", q: Math.ceil(Vf * 10) / 10, u: "m³", p: FP.pBeton }, { n: "Armatura A500 (fundament)", q: Math.ceil(arm), u: "kg", p: FP.pArm });
    }

    // Pol, yopma, tom
    const prow = [];
    levels.forEach(l => { if (l.A) prow.push({ k: `${l.i + 1}-qavat maydoni`, f: `kontur ${nf(l.A)} − perimetr ${nf(l.P)} × ${nf(M.outT / 2, 2)} − ichki ${nf(l.Lin)} × ${nf(M.inT, 2)}`, v: nf(l.net), u: "m²" }); });
    const totalNet = sum(l => l.net);
    const slabA = levels.slice(1).reduce((s, l) => s + l.A, 0), roofA = M.roof === "tekis" || M.roof === "gumbaz" ? levels[levels.length - 1].A : 0;
    const rf = roofForms(M.levels[M.levels.length - 1]);           // nishab (cho'qqili) va gumbaz o'lchamlari
    const slabV = slabA * SLAB + roofA * 0.25;
    if (prow.length) {
      prow.push({ k: "Umumiy foydali maydon", f: levels.filter(l => l.A).map(l => nf(l.net)).join(" + "), v: nf(totalNet), u: "m²" });
      if (slabA || roofA) prow.push({ k: "Yopma plitalar", f: `${nf(slabA)} × ${SLAB}${roofA ? ` + tom ${nf(roofA)} × 0,25` : ""}`, v: nf(slabV, 2), u: "m³" });
      if (roofA) prow.push({ k: "Tekis tom yuzasi", f: `oxirgi qavat konturi`, v: nf(roofA), u: "m²" });
      if (M.roof === "nishab" && rf.slope) prow.push({ k: "Nishab tom yuzasi", f: rf.forms.map(x => `${nf(x.A)} × √(1 + (${nf(x.R, 2)} / ${nf(x.half, 2)})²)`).join(" + "), v: nf(rf.slope), u: "m²" });
      if (M.roof === "gumbaz" && rf.dome) prow.push({ k: "Gumbaz yuzasi", f: rf.forms.map(x => `2π × ${nf(x.r, 2)}² × 1,15`).join(" + "), v: nf(rf.dome), u: "m²" });
      groups.push({ title: "Pol, yopma va tom", rows: prow });
      if (slabV) boq.push({ n: "Yopma beton B25 (armatura bilan)", q: Math.ceil(slabV * 10) / 10, u: "m³", p: FP.pBeton });
      if (roofA) boq.push({ n: "Tekis tom tizimi", q: Math.ceil(roofA), u: "m²", p: price("roof-flat", 18) });
      if (M.roof === "nishab" && rf.slope) boq.push({ n: "Cherepitsa tom", q: Math.ceil(rf.slope), u: "m²", p: price("roof-tile", 28) });
      if (M.roof === "gumbaz" && rf.dome) boq.push({ n: "Gumbaz koshin qoplamasi", q: Math.ceil(rf.dome), u: "m²", p: price("roof-dome", 160) });
    }

    // Eshik, deraza, yorug'lik
    const nWin = sum(l => l.win.length), nDoor = sum(l => l.doors.length);
    const lrows = [{ k: "Eshiklar / derazalar", f: "devor ustidagilar", v: `${nDoor} / ${nWin}`, u: "dona" }, { k: "Bino balandligi", f: `Σ qavat balandligi = ${levels.map(l => nf(l.h, 2)).join(" + ")}`, v: nf(H, 2), u: "m" }];
    levels.forEach(l => { if (l.net) { const r = l.winA / l.net * 100; lrows.push({ k: `${l.i + 1}-qavat yorug'ligi`, f: `deraza ${nf(l.winA, 2)} / pol ${nf(l.net)} × 100 (me'yor ≥ 12,5%)`, v: nf(r), u: "%", tone: r >= 12.5 ? "ok" : r >= 8 ? "warn" : "bad" }); } });
    groups.push({ title: "Eshik, deraza va yorug'lik", rows: lrows });
    if (nWin) boq.push({ n: "Deraza (PVX)", q: nWin, u: "dona", p: price("el-win", 140) });
    if (nDoor) boq.push({ n: "Eshik", q: nDoor, u: "dona", p: price("el-door", 420) });

    boq.forEach(b => { b.t = b.q * b.p; });
    const total = boq.reduce((s, b) => s + b.t, 0);
    return { groups, warns, boq, total, totalNet };
  }
  let catalog = {};
  const price = (id, def) => (catalog[id] && Number.isFinite(Number(catalog[id].price)) ? Number(catalog[id].price) : def);
  fetch("products.json").then(r => r.json()).then(list => { catalog = Object.fromEntries((list || []).map(p => [p.id, p])); renderCalc(); }).catch(() => {});

  // ---------- DOM ----------
  app.innerHTML = `
    <div class="fb">
      <div class="fb-bar">
        <div class="fb-tools" role="toolbar" aria-label="Chizish asboblari">${TOOLS.map(([t, l]) => `<button type="button" data-fbt="${t}">${l}</button>`).join("")}</div>
        <button type="button" class="btn-ghost fb-arc" data-fba="arc" aria-pressed="false" title="Devorni egri (yoy) qilib chizish — A tugmasi">◠ Yoy devor</button>
        <span class="sp"></span>
        <button type="button" class="btn-ghost" data-fba="undo" title="Ctrl+Z">Orqaga</button>
        <button type="button" class="btn-ghost" data-fba="redo" title="Ctrl+Y">Qayta</button>
        <button type="button" class="btn-ghost" data-fba="save">Faylga saqlash</button>
        <label class="btn-ghost fb-file">Fayldan ochish<input type="file" accept=".json,application/json" hidden data-fba="open"></label>
        <button type="button" class="btn-danger" data-fba="new">Hammasini tozalash</button>
      </div>
      <div class="fb-levels" id="fbLevels"></div>
      <div class="fb-shape" id="fbShape" hidden>
        <span class="label">Shakl</span>
        <div class="fb-shapes" role="radiogroup" aria-label="Kontur shakli">${SHAPE_KINDS.map(([k, n]) => `<button type="button" role="radio" data-fbk="${k}" aria-checked="false">${n}</button>`).join("")}</div>
        <label>eni <input type="number" min="3" max="40" step="0.5" data-fbsh="w"> m</label>
        <label>chuqurligi <input type="number" min="3" max="30" step="0.5" data-fbsh="d"> m</label>
        <label class="fb-wing">qanot <select data-fbsh="wing"><option value="0.3">30%</option><option value="0.4">40%</option><option value="0.5">50%</option><option value="0.6">60%</option></select></label>
      </div>
      <div class="fb-opts">
        <label>Tashqi devor <select data-fbo="outT"><option value="0.25">250 mm</option><option value="0.38">380 mm</option><option value="0.51">510 mm</option><option value="0.3">300 mm</option></select></label>
        <label>material <select data-fbo="outMat">${Object.entries(MATS).map(([k, m]) => `<option value="${k}">${m.n}</option>`).join("")}</select></label>
        <label>Ichki devor <select data-fbo="inT"><option value="0.1">100 mm</option><option value="0.12">120 mm</option><option value="0.2">200 mm</option></select></label>
        <label>material <select data-fbo="inMat">${Object.entries(MATS).map(([k, m]) => `<option value="${k}">${m.n}</option>`).join("")}</select></label>
        <label>Eshik eni <input type="number" min="0.6" max="3" step="0.1" data-fbo="doorW"> m</label>
        <label>Deraza <input type="number" min="0.4" max="4" step="0.1" data-fbo="winW"> × <input type="number" min="0.4" max="2.4" step="0.1" data-fbo="winH"> m</label>
        <label>Tom <select data-fbo="roof"><option value="tekis">Tekis tom</option><option value="nishab">Nishab tom (cho'qqili)</option><option value="gumbaz">Gumbaz</option><option value="yoq">Tomsiz</option></select></label>
        <label>Fundament chuqurligi <input type="number" min="0.5" max="3" step="0.1" data-fbo="fd"> m</label>
      </div>
      <div class="fb-main">
        <div class="fb-plancol">
          <div class="fb-plan" id="fbPlan"></div>
          <p class="fb-hint" id="fbHint" role="status"></p>
          <div class="fb-side" id="fbSide"></div>
        </div>
        <div class="fb-3dcol">
          <div class="fb-3d" id="fb3d"></div>
          <div class="fb-3dbar"><button type="button" data-fbv="corner">Burchak</button><button type="button" data-fbv="top">Tepa</button><button type="button" data-fbv="kesim" aria-pressed="false" title="Faol qavatdan yuqorisi va tom yashiriladi">Kesim</button><span class="sp"></span><button type="button" data-fbv="out" aria-label="Uzoqlashtirish">−</button><button type="button" data-fbv="in" aria-label="Yaqinlashtirish">+</button></div>
        </div>
      </div>
      <div class="fb-calc" id="fbCalc"></div>
    </div>`;
  const $ = s => app.querySelector(s);

  function syncOpts() {
    app.querySelectorAll("[data-fbo]").forEach(el => { const v = M[el.dataset.fbo]; if (el.tagName === "SELECT") el.value = String(v); else el.value = v; });
    app.querySelectorAll("[data-fbt]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.fbt === tool)));
    const sp = $("#fbShape"); sp.hidden = tool !== "shape";
    sp.querySelectorAll("[data-fbk]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.fbk === shp.k)));
    sp.querySelectorAll("[data-fbsh]").forEach(el => { el.value = String(shp[el.dataset.fbsh]); });
    sp.querySelector(".fb-wing").hidden = !["L", "U", "T"].includes(shp.k);
    const ab = $("[data-fba='arc']"); ab.setAttribute("aria-pressed", String(arc)); ab.hidden = !(tool === "out" || tool === "in");
    $("[data-fbv='kesim']").setAttribute("aria-pressed", String(kesim));
    const ub = $("[data-fba='undo']"), rb = $("[data-fba='redo']"); ub.disabled = !undo.length; rb.disabled = !redo.length;
  }

  // ---------- Reja (SVG) ----------
  const svgPt = (svg, e) => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };
  function wallRect(sg, cls, extra = "") {
    const dx = (sg.b[0] - sg.a[0]) / sg.L, dz = (sg.b[1] - sg.a[1]) / sg.L, nx = -dz * sg.t / 2, nz = dx * sg.t / 2;
    const p = [[sg.a[0] + nx, sg.a[1] + nz], [sg.b[0] + nx, sg.b[1] + nz], [sg.b[0] - nx, sg.b[1] - nz], [sg.a[0] - nx, sg.a[1] - nz]];
    return `<polygon class="${cls}"${extra} points="${p.map(q => q.join(",")).join(" ")}"/>`;
  }
  function renderPlan() {
    const level = M.levels[lv], o = [];
    let grid = "", grid5 = "";
    for (let x = 0; x <= SITE_W; x += 1) (x % 5 ? (grid += `M${x} 0V${SITE_D}`) : (grid5 += `M${x} 0V${SITE_D}`));
    for (let z = 0; z <= SITE_D; z += 1) (z % 5 ? (grid += `M0 ${z}H${SITE_W}`) : (grid5 += `M0 ${z}H${SITE_W}`));
    o.push(`<rect class="fb-site" x="0" y="0" width="${SITE_W}" height="${SITE_D}"/><path class="fb-grid" d="${grid}"/><path class="fb-grid5" d="${grid5}"/>`);
    for (let x = 0; x <= SITE_W; x += 5) o.push(`<text class="fb-ax" x="${x}" y="-0.3" text-anchor="middle">${x}</text>`);
    for (let z = 5; z <= SITE_D; z += 5) o.push(`<text class="fb-ax" x="-0.35" y="${z + 0.18}" text-anchor="end">${z}</text>`);
    o.push(`<text class="fb-ax" x="${SITE_W / 2}" y="${SITE_D + 0.85}" text-anchor="middle">▼ KO'CHA · to'r 1 m, qadam ${GRID} m</text>`);
    // pastki qavat devorlari — xira (ustiga chizish uchun yo'riqnoma)
    if (lv > 0) segsOf(M.levels[lv - 1]).forEach(sg => o.push(wallRect(sg, "fb-ghost")));
    // yopiq konturlar: pol
    level.chains.forEach(c => { if (c.k === "out" && c.closed && c.pts.length >= 3) o.push(`<polygon class="fb-floor" points="${c.pts.map(p => p.join(",")).join(" ")}"/>`); });
    const segs = segsOf(level);
    segs.forEach(sg => {
      const s = sel && sel.kind === "seg" && sel.ci === sg.ci && sel.si === sg.si;
      o.push(wallRect(sg, `fb-wall ${sg.k}${s ? " sel" : ""}`, ` data-ci="${sg.ci}" data-si="${sg.si}"`));
    });
    // o'lcham yozuvlari (har segment uzunligi)
    segs.forEach(sg => {
      if (sg.L < 0.9) return;
      const ch = level.chains[sg.ci]; if (ch && ch.pts.length >= 12 && sg.L < 2.5) return;   // aylana/yoy bo'laklari: yozuvlar tiqilib qolmasin
      const mx = (sg.a[0] + sg.b[0]) / 2, mz = (sg.a[1] + sg.b[1]) / 2, dx = (sg.b[0] - sg.a[0]) / sg.L, dz = (sg.b[1] - sg.a[1]) / sg.L;
      let ang = Math.atan2(dz, dx) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      const off = sg.t / 2 + 0.35, tx = mx - dz * off, tz = mz + dx * off;
      o.push(`<text class="fb-len" x="${tx}" y="${tz}" text-anchor="middle" transform="rotate(${ang} ${tx} ${tz})">${nf(sg.L, 2)}</text>`);
    });
    // eshik va derazalar
    level.open.forEach((op, i) => {
      const at = attach(level, op), s = sel && sel.kind === "op" && sel.i === i;
      if (!at) { o.push(`<circle class="fb-stray" cx="${op.x}" cy="${op.z}" r="0.3" data-oi="${i}"><title>Devorsiz qolgan</title></circle>`); return; }
      const sg = at.sg, dx = (sg.b[0] - sg.a[0]) / sg.L, dz = (sg.b[1] - sg.a[1]) / sg.L, hw = op.w / 2;
      const p1 = [op.x - dx * hw, op.z - dz * hw], p2 = [op.x + dx * hw, op.z + dz * hw];
      const fake = { a: p1, b: p2, L: op.w, t: sg.t + 0.02 };
      o.push(`<g class="fb-op ${op.t}${s ? " sel" : ""}" data-oi="${i}">${wallRect(fake, "fb-gap")}` +
        (op.t === "win" ? `<line class="fb-glass" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}"/>`
                        : `<path class="fb-swing" d="M${p1[0]} ${p1[1]} L${p1[0] - dz * op.w} ${p1[1] + dx * op.w} A${op.w} ${op.w} 0 0 0 ${p2[0]} ${p2[1]}"/>`) + `</g>`);
    });
    // chizilayotgan zanjir va ko'rsatkich
    if (draw) {
      const pts = hover && !arcEnd ? [...draw.pts, hover] : draw.pts;
      o.push(`<polyline class="fb-draft ${draw.k}" points="${pts.map(p => p.join(",")).join(" ")}"/>`);
      draw.pts.forEach((p, i) => o.push(`<circle class="fb-node${i === 0 && draw.pts.length >= 3 ? " start" : ""}" cx="${p[0]}" cy="${p[1]}" r="${i === 0 && draw.pts.length >= 3 ? 0.32 : 0.16}"/>`));
      if (hover) {
        const l = draw.pts[draw.pts.length - 1], L = Math.hypot(hover[0] - l[0], hover[1] - l[1]);
        if (L > 0) o.push(`<text class="fb-live" x="${hover[0] + 0.4}" y="${hover[1] - 0.4}">${nf(L, 2)} m · ${nf((Math.atan2(-(hover[1] - l[1]), hover[0] - l[0]) * 180 / Math.PI + 360) % 360, 0)}°</text>`);
      }
    }
    if (hover && (tool === "out" || tool === "in")) o.push(`<circle class="fb-cursor" cx="${hover[0]}" cy="${hover[1]}" r="0.14"/>`);
    if (hover && tool === "shape") o.push(`<polygon class="fb-shape-ghost" points="${shapePts(shp.k, shp.w, shp.d, shp.wing, snapG(hover[0]), snapG(hover[1])).map(q => q.join(",")).join(" ")}"/>`);
    if (draw && arcEnd) {                                           // yoy: oxirgi nuqta -> sichqoncha -> tanlangan uch
      const l = draw.pts[draw.pts.length - 1], mid = hover ? arcPts(l, arcEnd, hover) : [];
      o.push(`<polyline class="fb-draft arc ${draw.k}" points="${[l, ...mid, arcEnd].map(q => q.join(",")).join(" ")}"/><circle class="fb-node" cx="${arcEnd[0]}" cy="${arcEnd[1]}" r="0.2"/>`);
    }
    if (hover && (tool === "door" || tool === "win")) {                // teshik qayerga tushishini ko'rsatish
      const hit = nearestSeg(level, hover, 0.6);
      if (hit) { const w = tool === "door" ? M.doorW : M.winW, dx = (hit.sg.b[0] - hit.sg.a[0]) / hit.sg.L, dz = (hit.sg.b[1] - hit.sg.a[1]) / hit.sg.L;
        o.push(wallRect({ a: [hit.q[0] - dx * w / 2, hit.q[1] - dz * w / 2], b: [hit.q[0] + dx * w / 2, hit.q[1] + dz * w / 2], L: w, t: hit.sg.t + 0.1 }, "fb-preview")); }
    }
    $("#fbPlan").innerHTML = `<svg viewBox="-1.2 -1 ${SITE_W + 2.2} ${SITE_D + 2.2}" role="img" aria-label="${lv + 1}-qavat rejasi: ${segs.length} ta devor">${o.join("")}</svg>`;
  }
  function renderHint() {
    const h = $("#fbHint"); if (!h) return;
    const base = {
      select: "Devor yoki teshikni bosib tanlang. Delete — o'chirish.",
      out: draw ? "Keyingi nuqtani bosing. Boshlang'ich nuqtani bossangiz — kontur yopiladi. Enter yoki ikki marta bosish — tugatish. Shift — faqat to'g'ri burchak." : "Tashqi devor: birinchi nuqtani bosing (devorlar 0,5 m to'rga va mavjud uchlarga yopishadi).",
      in: draw ? "Keyingi nuqtani bosing. Enter yoki ikki marta bosish — tugatish." : "Ichki devor: xonalarni ajratish uchun tashqi devordan tashqi devorgacha chizing.",
      door: `Eshik (${nf(M.doorW, 2)} m): devor ustini bosing.`, win: `Deraza (${nf(M.winW, 2)} × ${nf(M.winH, 2)} m): tashqi devor ustini bosing.`,
      erase: "O'chiriladigan devor bo'lagini yoki eshik/derazani bosing.",
      shape: "Shakl: turini va o'lchamini tanlang, keyin rejada markazini bosing — yopiq tashqi devor tayyor bo'ladi.",
    }[tool];
    const arcHint = arc && (tool === "out" || tool === "in") ? (!draw ? "Yoy devor: avval boshlang'ich nuqtani bosing." : !arcEnd ? "Yoy devor: yoy tugaydigan nuqtani bosing." : "Yoy devor: sichqonchani suring va egilishini tanlab bosing.") : "";
    h.textContent = msg || arcHint || base; h.classList.toggle("bad", !!msg && /bo'lmaydi|emas|qisqa|bor\.|faqat|qo'ying/.test(msg));
  }
  function renderLevels() {
    $("#fbLevels").innerHTML = `<span class="label">Qavatlar</span>` + M.levels.map((l, i) => `<button type="button" data-fbl="${i}" aria-pressed="${i === lv}">${i + 1}-qavat</button>`).join("") +
      `<label class="fb-lh">balandligi <input type="number" min="2.4" max="6" step="0.1" value="${M.levels[lv].h}" data-fbh> m</label>` +
      `<button type="button" class="btn-ghost" data-fba="addcopy" title="Yangi qavatga pastdagi tashqi devorlar nusxalanadi">+ Qavat (tashqi devorlar nusxasi)</button>` +
      `<button type="button" class="btn-ghost" data-fba="addblank">+ Bo'sh qavat</button>` +
      (M.levels.length > 1 ? `<button type="button" class="btn-ghost" data-fba="dellevel">${lv + 1}-qavatni o'chirish</button>` : "");
  }
  function renderSide() {
    const level = M.levels[lv], el = $("#fbSide");
    if (sel && sel.kind === "seg") {
      const sg = segsOf(level).find(s => s.ci === sel.ci && s.si === sel.si);
      if (!sg) { sel = null; el.innerHTML = ""; return; }
      el.innerHTML = `<b>${sg.k === "out" ? "Tashqi" : "Ichki"} devor</b> · uzunligi ${nf(sg.L, 2)} m · qalinligi ${nf(sg.t, 2)} m · yuzasi ${nf(sg.L * level.h, 1)} m² <button type="button" class="btn-ghost" data-fba="delsel">O'chirish</button>`;
    } else if (sel && sel.kind === "op" && level.open[sel.i]) {
      const op = level.open[sel.i];
      el.innerHTML = `<b>${op.t === "door" ? "Eshik" : "Deraza"}</b> <label>eni <input type="number" min="0.5" max="4" step="0.1" value="${op.w}" data-fbs="w"></label> <label>bo'yi <input type="number" min="0.4" max="3" step="0.1" value="${op.h}" data-fbs="h"></label>` +
        (op.t === "win" ? ` <label>tokcha <input type="number" min="0" max="2" step="0.1" value="${op.sill}" data-fbs="sill"></label>` : "") + ` <button type="button" class="btn-ghost" data-fba="delsel">O'chirish</button>`;
    } else { sel = null; el.innerHTML = ""; }
  }
  const rowHTML = r => `<div class="crow${r.tone ? " " + r.tone : ""}"><span class="ck">${esc(r.k)}</span><code class="cf">${esc(r.f)}</code><b class="cv">${esc(r.v)}${r.u ? `<small> ${esc(r.u)}</small>` : ""}</b></div>`;
  let lastCalc = null;
  function renderCalc() {
    const c = calc(); lastCalc = c;
    $("#fbCalc").innerHTML =
      (c.warns.length ? `<ul class="fb-warn">${c.warns.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : "") +
      (c.groups.length ? `<div class="calc-grid">${c.groups.map(g => `<section class="cg"><h3>${esc(g.title)}</h3>${g.rows.map(rowHTML).join("")}</section>`).join("")}</div>` : "") +
      (c.boq.length ? `<div class="boq"><div class="boq-head"><h3>Smeta: chizilgan devorlar bo'yicha</h3><div class="boq-actions"><button type="button" class="btn-ghost" data-fba="csv">CSV (Excel)</button></div></div>
        <div class="table-scroll"><table class="boq-t"><thead><tr><th>Material</th><th class="num">Miqdor</th><th class="num">Narx</th><th class="num">Jami</th></tr></thead>
        <tbody>${c.boq.map(b => `<tr><td>${esc(b.n)}</td><td class="num">${b.q.toLocaleString("ru-RU")} ${esc(b.u)}</td><td class="num">$${b.p.toLocaleString("ru-RU")}</td><td class="num">$${n0(b.t)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="3">Jami materiallar${c.totalNet ? ` · $${n0(c.total / c.totalNet)} / m²` : ""}</td><td class="num">$${n0(c.total)}</td></tr></tfoot></table></div>
        <p class="muted calc-note">Taxminiy: g'isht 394 dona/m³ (10 mm chok bilan), gazoblok 27,8 dona/m³, armatura 60–80 kg/m³. Ish haqi, tom yopmasi va pardozlash kirmagan.</p></div>` : "");
  }

  function changed() { syncOpts(); renderLevels(); renderPlan(); renderHint(); renderSide(); renderCalc(); schedule3d(); }

  // ---------- Hodisalar ----------
  app.addEventListener("click", e => {
    const k2 = e.target.closest("[data-fbk]");
    if (k2) { shp.k = k2.dataset.fbk; changed(); return; }
    const b = e.target.closest("[data-fbt],[data-fba],[data-fbl],[data-fbv]"); if (!b || b.tagName === "INPUT") return;
    if (b.dataset.fbt) { finishDraw(); tool = b.dataset.fbt; sel = null; changed(); return; }
    if (b.dataset.fbl !== undefined) { finishDraw(); lv = Number(b.dataset.fbl); sel = null; changed(); return; }
    if (b.dataset.fbv) { view3dCmd(b.dataset.fbv); return; }
    const a = b.dataset.fba;
    if (a === "arc") { arc = !arc; arcEnd = null; changed(); return; }
    if (a === "undo") doUndo(); else if (a === "redo") doRedo();
    else if (a === "addcopy" || a === "addblank") {
      finishDraw();
      commit(() => { const src = M.levels[lv]; M.levels.splice(lv + 1, 0, { h: src.h, chains: a === "addcopy" ? src.chains.filter(c => c.k === "out").map(c => ({ k: "out", closed: c.closed, pts: c.pts.map(p => p.slice()) })) : [], open: [] }); });
      lv = lv + 1; changed();
    } else if (a === "dellevel") {
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tasdiqlang"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = `${lv + 1}-qavatni o'chirish`; } }, 2500); return; }
      commit(() => { M.levels.splice(lv, 1); }); lv = Math.max(0, lv - 1); changed();
    } else if (a === "delsel") deleteSel();
    else if (a === "new") {
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tasdiqlang: hammasi o'chadi"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Hammasini tozalash"; } }, 2500); return; }
      draw = null; commit(() => { M = blank(); }); lv = 0; sel = null; changed();
    } else if (a === "save") saveFile("erkin-loyiha.json", JSON.stringify({ format: "ustun-erkin", version: 1, ...M }, null, 2));
    else if (a === "csv" && lastCalc) {
      const q = s => `"${String(s).replace(/"/g, '""')}"`;
      const rows = [["Material", "Miqdor", "Birlik", "Narx ($)", "Jami ($)"], ...lastCalc.boq.map(x => [x.n, x.q, x.u, x.p, Math.round(x.t)]), ["Jami", "", "", "", Math.round(lastCalc.total)]];
      saveFile("erkin-smeta.csv", "﻿" + rows.map(r => r.map(q).join(";")).join("\r\n"));
    }
  });
  app.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.fba === "open" && t.files && t.files[0]) {
      const f = t.files[0]; if (f.size > 2 * 1024 * 1024) { flash("Fayl juda katta."); t.value = ""; return; }
      const r = new FileReader();
      r.onload = () => { try { const d = JSON.parse(String(r.result)); if (!d || d.format !== "ustun-erkin") throw 0; commit(() => { M = clean(d); }); lv = 0; sel = null; changed(); flash("Loyiha fayldan ochildi."); } catch { flash("Bu erkin qurish fayli emas."); } t.value = ""; };
      r.readAsText(f); return;
    }
    if (t.dataset.fbo) {
      const k = t.dataset.fbo, v = t.tagName === "SELECT" && !/T$/.test(k) ? t.value : Number(t.value);
      commit(() => { M[k] = v; M = clean(M); });
      return;
    }
    if (t.dataset.fbsh) { const k = t.dataset.fbsh; shp[k] = k === "w" ? clamp(Number(t.value) || 12, 3, SITE_W) : k === "d" ? clamp(Number(t.value) || 10, 3, SITE_D) : clamp(Number(t.value) || 0.4, 0.2, 0.6); changed(); return; }
    if (t.dataset.fbh !== undefined) { commit(() => { M.levels[lv].h = clamp(Number(t.value) || 3, 2.4, 6); }); return; }
    if (t.dataset.fbs && sel && sel.kind === "op") {
      const k = t.dataset.fbs, op = M.levels[lv].open[sel.i]; if (!op) return;
      const v = Number(t.value);
      commit(() => { op[k] = k === "w" ? clamp(v, 0.5, 4) : k === "h" ? clamp(v, 0.4, 3) : clamp(v, 0, 2); });
    }
  });
  function deleteSel() {
    if (!sel) return;
    if (sel.kind === "seg") deleteSeg(sel.ci, sel.si);
    else { const i = sel.i; commit(() => { M.levels[lv].open.splice(i, 1); }); sel = null; }
    changed();
  }
  function saveFile(name, data) {
    if (window.saveFile) { window.saveFile(name, data).then(() => flash(`"${name}" saqlandi.`), () => {}); return; }
    const url = URL.createObjectURL(new Blob([data], { type: "application/octet-stream" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  let lastDown = { t: 0, x: 0, y: 0 };
  app.addEventListener("pointerdown", e => {
    const svg = e.target.closest("#fbPlan svg"); if (!svg) return;
    if (e.button === 2) { e.preventDefault(); finishDraw(); return; }
    e.preventDefault();
    const raw = svgPt(svg, e), level = M.levels[lv];
    if (tool === "out" || tool === "in") {
      const now = performance.now(), dbl = now - lastDown.t < 320 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
      lastDown = { t: now, x: e.clientX, y: e.clientY };
      if (dbl && draw && !arcEnd) { finishDraw(); return; }           // ikki marta bosish (bir joyda) — zanjirni tugatish
      if (arc && draw && draw.pts.length) {                            // yoy: 1-bosish — tugash nuqtasi, 2-bosish — egilish
        if (!arcEnd) { const p = snapPoint(raw, false); if (!same(p, draw.pts[draw.pts.length - 1])) { arcEnd = p; changed(); } return; }
        const end = arcEnd; arcEnd = null;
        draw.pts.push(...arcPts(draw.pts[draw.pts.length - 1], end, raw));
        if (draw.pts.length > 190) { flash("Yoy juda uzun: kamroq nuqta bilan chizing."); draw.pts.length = 190; }
        clickDraw(end); return;
      }
      clickDraw(snapPoint(raw, e.shiftKey)); return;
    }
    if (tool === "shape") { placeShape(raw); return; }
    if (tool === "door" || tool === "win") { placeOpening(tool, raw); return; }
    const oi = hitOpening(level, raw), seg = nearestSeg(level, raw, 0.35);
    if (tool === "erase") {
      if (oi >= 0) { commit(() => { level.open.splice(oi, 1); }); changed(); }
      else if (seg) { deleteSeg(seg.sg.ci, seg.sg.si); changed(); }
      return;
    }
    sel = oi >= 0 ? { kind: "op", i: oi } : seg ? { kind: "seg", ci: seg.sg.ci, si: seg.sg.si } : null;
    renderPlan(); renderSide();
  });
  app.addEventListener("contextmenu", e => { if (e.target.closest("#fbPlan svg")) e.preventDefault(); });
  app.addEventListener("pointermove", e => {
    const svg = e.target.closest && e.target.closest("#fbPlan svg");
    if (!svg) { if (hover) { hover = null; renderPlan(); } return; }
    const raw = svgPt(svg, e);
    hover = (tool === "out" || tool === "in") && !arcEnd ? snapPoint(raw, e.shiftKey) : raw;
    renderPlan();
  });
  document.addEventListener("keydown", e => {
    if (!app.offsetParent || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "y")) {
      if (!app.contains(document.activeElement) && document.activeElement !== document.body) return;
      e.preventDefault(); e.stopImmediatePropagation(); (k === "y" || e.shiftKey) ? doRedo() : doUndo(); return;
    }
    if (k === "a" && !e.ctrlKey && !e.metaKey && (tool === "out" || tool === "in")) { arc = !arc; arcEnd = null; changed(); return; }
    if (k === "enter" && draw) { e.preventDefault(); finishDraw(); }
    else if (k === "escape") { if (arcEnd) { arcEnd = null; changed(); } else if (draw) { draw = null; changed(); } else { sel = null; changed(); } }
    else if (k === "backspace" && draw) { e.preventDefault(); draw.pts.pop(); if (!draw.pts.length) draw = null; changed(); }
    else if ((k === "delete" || k === "backspace") && sel) { e.preventDefault(); deleteSel(); }
  }, true);

  // ---------- 3D ko'rinish ----------
  let R = null, buildT = 0;
  function init3d() {
    if (typeof THREE === "undefined") { $("#fb3d").innerHTML = `<p class="muted">3D kutubxona yuklanmadi.</p>`; return; }
    const host = $("#fb3d"), renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, 0.3, 2000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8d9296, 0.95));
    const sun = new THREE.DirectionalLight(0xfff1dc, 0.85); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
    Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 200 }); scene.add(sun, sun.target);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(SITE_W + 10, SITE_D + 10), new THREE.MeshStandardMaterial({ color: 0xd9dbd6, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(SITE_W / 2, -0.01, SITE_D / 2); ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(SITE_W, SITE_W, 0x9aa0a4, 0xbfc3c0); grid.scale.z = SITE_D / SITE_W; grid.position.set(SITE_W / 2, 0, SITE_D / 2); grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
    R = { host, renderer, scene, camera, sun, group: null, disp: [], theta: -0.6, phi: 1.0, dist: 1, center: new THREE.Vector3(SITE_W / 2, 2, SITE_D / 2), base: 40 };
    let drag = null;
    renderer.domElement.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY }; try { renderer.domElement.setPointerCapture(e.pointerId); } catch {} });
    renderer.domElement.addEventListener("pointermove", e => { if (!drag) return; R.theta -= (e.clientX - drag.x) * 0.007; R.phi = clamp(R.phi - (e.clientY - drag.y) * 0.007, 0.1, 1.5); drag = { x: e.clientX, y: e.clientY }; draw3d(); });
    renderer.domElement.addEventListener("pointerup", () => { drag = null; });
    renderer.domElement.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); R.dist = clamp(R.dist * Math.exp(e.deltaY * 0.0015), 0.3, 2.5); draw3d(); }, { passive: false });
    new ResizeObserver(() => draw3d()).observe(host);
  }
  function view3dCmd(v) {
    if (!R) return;
    if (v === "corner") { R.theta = -0.6; R.phi = 1.0; }
    if (v === "top") { R.theta = 0; R.phi = 0.12; }
    if (v === "in") R.dist = clamp(R.dist * 0.8, 0.3, 2.5);
    if (v === "out") R.dist = clamp(R.dist * 1.25, 0.3, 2.5);
    if (v === "kesim") { kesim = !kesim; syncOpts(); build3d(); return; }
    draw3d();
  }
  function draw3d() {
    if (!R) return;
    const w = R.host.clientWidth, h = R.host.clientHeight; if (!w || !h) return;
    R.renderer.setSize(w, h, false); R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
    const d = R.base * R.dist, sp = Math.sin(R.phi);
    R.camera.position.set(R.center.x + d * sp * Math.sin(R.theta), R.center.y + d * Math.cos(R.phi), R.center.z + d * sp * Math.cos(R.theta));
    R.camera.lookAt(R.center);
    R.renderer.render(R.scene, R.camera);
  }
  function schedule3d() { clearTimeout(buildT); buildT = setTimeout(build3d, 40); }
  function build3d() {
    if (!R) return;
    R.disp.splice(0).forEach(o => o.dispose && o.dispose());
    if (R.group) R.scene.remove(R.group);
    const g = new THREE.Group(); R.group = g; R.scene.add(g);
    const T = o => { R.disp.push(o); return o; };
    const matC = {}, mat = (c, extra) => matC[c + JSON.stringify(extra || {})] || (matC[c + JSON.stringify(extra || {})] = T(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...extra })));
    const glass = mat(0x4d7396, { roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.6 }), frame = mat(0xf2f2f0), doorM = mat(0x6b4a2e), slabM = mat(0xdcd8ce), floorM = mat(0xc9b08a);
    const box = (w, h, d, m, x, y, z, parent, shadow = true) => { const b = new THREE.Mesh(T(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.castShadow = shadow; b.receiveShadow = true; parent.add(b); return b; };
    const shapeOf = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], -p[1]) : s.moveTo(p[0], -p[1]))); s.closePath(); return s; };
    const slab = (pts, y, th, m) => { const me = new THREE.Mesh(T(new THREE.ExtrudeGeometry(shapeOf(pts), { depth: th, bevelEnabled: false })), m); me.rotation.x = -Math.PI / 2; me.position.y = y; me.castShadow = true; me.receiveShadow = true; g.add(me); };
    const showTo = kesim ? lv : M.levels.length - 1;
    let y0 = 0, maxH = 0, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    M.levels.forEach((level, li) => {
      const h = level.h;
      if (li > showTo) { y0 += h; return; }
      const top = li === M.levels.length - 1, segs = segsOf(level);
      const ends = []; segs.forEach(s => { ends.push(s.a, s.b); });
      const shared = p => ends.filter(q => same(p, q)).length > 1;
      level.chains.forEach(c => { if (c.k === "out" && c.closed && c.pts.length >= 3) {
        if (li === 0) slab(c.pts, 0, 0.08, floorM); else slab(c.pts, y0 - SLAB, SLAB, slabM);
        if (top && (M.roof === "tekis" || M.roof === "gumbaz") && !kesim) slab(c.pts, y0 + h, 0.25, slabM);
      } });
      if (top && !kesim && (M.roof === "nishab" || M.roof === "gumbaz")) roofForms(level).forms.forEach(fm => {
        if (M.roof === "nishab") {                                     // chetlardan markazdagi cho'qqiga (har qanday kontur uchun)
          const pos = [], apex = [fm.cx, y0 + h + fm.R, fm.cz], ring = fm.c.pts, cx = fm.cx, cz = fm.cz;
          const eave = ring.map(([x, z]) => { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; return [x + dx / l * 0.4, z + dz / l * 0.4]; });   // 40 sm chiqish
          eave.forEach(([x, z], i) => { const [x2, z2] = eave[(i + 1) % eave.length]; pos.push(x, y0 + h, z, x2, y0 + h, z2, ...apex); });
          const geo = T(new THREE.BufferGeometry()); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.computeVertexNormals();
          const me = new THREE.Mesh(geo, mat(0x8e4a32, { side: THREE.DoubleSide })); me.castShadow = true; me.receiveShadow = true; g.add(me);
          maxH = Math.max(maxH, y0 + h + fm.R);
        } else {
          const r = fm.r, dh = r * 0.45, yb = y0 + h + 0.25;
          const drum = new THREE.Mesh(T(new THREE.CylinderGeometry(r, r, dh, 40)), mat(0xece7dc)); drum.position.set(fm.cx, yb + dh / 2, fm.cz); drum.castShadow = true; g.add(drum);
          const dome = new THREE.Mesh(T(new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2)), mat(0x2a9896, { roughness: 0.35, metalness: 0.3 }));
          dome.position.set(fm.cx, yb + dh, fm.cz); dome.scale.y = 1.15; dome.castShadow = true; g.add(dome);
          maxH = Math.max(maxH, yb + dh + r * 1.15);
        }
      });
      const atts = level.open.map(o => ({ o, at: attach(level, o) })).filter(x => x.at);
      segs.forEach(sg => {
        const wallH = sg.k === "out" && top && M.roof === "tekis" && !kesim ? h + 0.6 : h;    // parapet
        const MT = MATS[sg.k === "out" ? M.outMat : M.inMat], m = MT.glass ? mat(MT.color, { transparent: true, opacity: 0.45, metalness: 0.35, roughness: 0.08 }) : mat(MT.color);
        const ea = shared(sg.a) ? sg.t / 2 : 0, eb = shared(sg.b) ? sg.t / 2 : 0;          // burchaklarda devorlar bir-biriga kirib, tirqish qolmaydi
        const wg = new THREE.Group(); wg.position.set(sg.a[0], y0 + (li === 0 ? 0.08 : 0), sg.a[1]); wg.rotation.y = -Math.atan2(sg.b[1] - sg.a[1], sg.b[0] - sg.a[0]); g.add(wg);
        const hh = wallH - (li === 0 ? 0.08 : 0);
        const ops = atts.filter(x => x.at.sg.ci === sg.ci && x.at.sg.si === sg.si).map(x => ({ ...x.o, s: x.at.s })).sort((p, q) => p.s - q.s);
        let cur = -ea;
        const solid = (a, b) => { if (b - a > 0.005) box(b - a, hh, sg.t, m, (a + b) / 2, hh / 2, 0, wg); };
        ops.forEach(op => {
          const a = Math.max(cur, op.s - op.w / 2), b = op.s + op.w / 2, sill = Math.min(op.sill, hh), top2 = Math.min(hh, op.sill + op.h);
          solid(cur, a);
          if (sill > 0.005) box(b - a, sill, sg.t, m, (a + b) / 2, sill / 2, 0, wg);
          if (hh - top2 > 0.005) box(b - a, hh - top2, sg.t, m, (a + b) / 2, (top2 + hh) / 2, 0, wg);
          if (op.t === "win") { box(b - a, top2 - sill, 0.04, glass, (a + b) / 2, (sill + top2) / 2, 0, wg, false); box(b - a, 0.06, sg.t + 0.02, frame, (a + b) / 2, sill + 0.03, 0, wg, false); }
          else { const leaf = box(0.05, top2 - 0.02, op.w - 0.04, doorM, 0, (top2) / 2, 0, wg, false); leaf.position.set(a + 0.03, top2 / 2, sg.t / 2 + (op.w - 0.04) / 2); }   // ochiq eshik tavaqasi
          cur = b;
        });
        solid(cur, sg.L + eb);
        maxH = Math.max(maxH, y0 + wallH);
        [sg.a, sg.b].forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); });
      });
      y0 += h;
    });
    if (x0 === Infinity) { x0 = 0; x1 = SITE_W; z0 = 0; z1 = SITE_D; }
    const ex = Math.max(x1 - x0, z1 - z0, maxH, 8);
    R.center.set((x0 + x1) / 2, maxH * 0.35, (z0 + z1) / 2);
    R.base = ex * 2.4 + 8;
    R.sun.position.set(R.center.x + 20, 40, R.center.z + 25); R.sun.target.position.copy(R.center);
    draw3d();
  }

  // ---------- Ishga tushirish ----------
  init3d();
  changed();
  window.FreeBuild = { get model() { return M; }, calc, _set(m) { M = clean(m); lv = 0; sel = null; draw = null; changed(); } };   // sinov uchun
})();
