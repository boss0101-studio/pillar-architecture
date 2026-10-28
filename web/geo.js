// Geometrik va matematik hisob-kitoblar + chizma chiziqlari (o'qlar, o'lchamlar, diagonallar, oltin kesim, burchaklar).
// Hamma hisob jonli: parametr o'zgarsa, formulalar va raqamlar darhol yangilanadi. Har bir qator formulasi bilan ko'rsatiladi.
const PHI = (1 + Math.sqrt(5)) / 2;     // oltin kesim, 1,618...

const Geo = (function () {
  const T = 0.35;                       // tashqi devor qalinligi, m (view3d bilan bir xil)
  const LIVE = { "turar-joy": 1.5, tijorat: 3.0, jamoat: 4.0, interyer: 2.0 };              // foydali yuklama, kN/m²
  const BRICKS_PER_M3 = 394;            // standart g'isht (250×120×65 mm, qorishma bilan) 1 m³ devorga
  const SOIL = 200;                     // ruxsat etilgan grunt bosimi, kPa (taxminiy qiymat)
  const SETBACK = 5;                    // uchastka chegarasidan chekinish, m
  const FIRE_GAP = 6;                   // uylar orasidagi minimal yong'inga qarshi masofa, m (taxminiy)
  const HDD = 2300;                     // Toshkent: isitish daraja-kunlari, K·kun/yil (taxminiy)
  const KWH_PRICE = 0.06;               // isitish narxi, $/kWh (taxminiy)

  const flags = { axes: true, diag: false, golden: false, angles: true };
  try { Object.assign(flags, JSON.parse(localStorage.getItem("ustun-geo") || "{}")); } catch {}

  const rnd = (v, k) => Math.round(v * k) / k;
  const n0 = v => Math.round(v).toLocaleString("ru-RU");
  const n1 = v => rnd(v, 10).toLocaleString("ru-RU");
  const n2 = v => rnd(v, 100).toLocaleString("ru-RU");
  const deg = r => (r * 180) / Math.PI;

  // Teshik yuzasi: arkali — to'g'ri to'rtburchak + yarim doira, dumaloq — doira
  function openingArea(type, cw, ch) {
    const o = OPENING[type];
    if (!o) return 0;
    const w = (o[1] - o[0]) * cw, h = (o[3] - o[2]) * ch;
    if (type === "arch" || type === "arcade") { const r = w / 2; return w * Math.max(0, h - r) + (Math.PI * r * r) / 2; }
    if (type === "round") { const r = Math.min(w, h) / 2; return Math.PI * r * r; }
    return w * h;
  }

  // ---------- O'lchovlar: yuzalar, hajmlar, elementlar soni (hisob va smeta uchun umumiy) ----------
  function measure(p, cells) {
    const g = geometry(p), W = g.W, D = g.D, N = p.floors, h = p.floor_h, Hb = g.Hb, R = g.R;
    const upper = upperType(p), counts = {};
    let frontOpen = 0, glass = 0, doors = 0;
    for (let f = 0; f < N; f++) for (let b = 0; b < p.bays; b++) {
      const t = cellType(p, cells, f, b), a = openingArea(t, p.bay_w, h);
      counts[t] = (counts[t] || 0) + 1;
      frontOpen += a;
      if (t === "door" || t === "arcade") doors += a; else glass += a;
    }
    const sideCols = Math.max(1, Math.round(D / p.bay_w)), sideW = D / sideCols;
    const sideOpen = 2 * N * sideCols * openingArea(upper, sideW, h), backOpen = N * p.bays * openingArea(upper, p.bay_w, h);
    counts[upper] = (counts[upper] || 0) + 2 * N * sideCols + N * p.bays;
    glass += sideOpen + backOpen;
    let gross = 2 * (W + D) * Hb, open = frontOpen + sideOpen + backOpen, net = gross - open;
    const ps = shapeOf(p) !== "rect" ? planShape(p) : null;
    if (ps) {                                                         // shakldor plan: old fasaddan boshqa qirralar bo'yicha derazalar
      let cols = 0, colW = 0;
      planEdges(ps).forEach(e => { if (e.full || e.L < 1.2) return; const c = Math.max(1, Math.round(e.L / p.bay_w)); cols += c; colW += e.L; });
      counts[upper] = Math.max(0, (counts[upper] || 0) - (2 * N * sideCols + N * p.bays)) + N * cols;
      glass -= sideOpen + backOpen;
      const other = N * cols * openingArea(upper, cols ? colW / cols : p.bay_w, h);
      glass += other;
      gross = ps.perimeter * Hb; open = frontOpen + other; net = gross - open;
    }

    // Tom: yuza va hajm (har bir tur uchun formula matni bilan)
    let roofArea, roofVol = 0, roofF, roofVF = "", dome = 0;
    const pw = W * 0.5, pd = D * 0.6, oh = 0.55;
    if (p.roof === "nishab") {
      const slant = Math.hypot(W / 2 + oh, R);
      roofArea = 2 * slant * (D + 2 * oh); roofVol = 0.5 * W * R * D;
      roofF = `2 × √((${n1(W / 2 + oh)})² + ${n1(R)}²) × ${n1(D + 2 * oh)}`; roofVF = `½ × ${n1(W)} × ${n1(R)} × ${n1(D)}`;
    } else if (p.roof === "bir") {
      const k = R / W, slant = Math.hypot(W + 2 * oh, R + 2 * k * oh);
      roofArea = slant * (D + 2 * oh); roofVol = 0.5 * W * R * D;
      roofF = `√(${n1(W + 2 * oh)}² + ${n1(R + 2 * k * oh)}²) × ${n1(D + 2 * oh)}`; roofVF = `½ × ${n1(W)} × ${n1(R)} × ${n1(D)}`;
    } else if (p.roof === "piramida") {
      const a = W / 2 + oh, b = D / 2 + oh;
      roofArea = 2 * a * Math.hypot(b, R) + 2 * b * Math.hypot(a, R); roofVol = (W * D * R) / 3;
      roofF = `2·${n1(a)}·√(${n1(b)}² + ${n1(R)}²) + 2·${n1(b)}·√(${n1(a)}² + ${n1(R)}²)`; roofVF = `⅓ × ${n1(W)} × ${n1(D)} × ${n1(R)}`;
    } else if (p.roof === "gumbaz") {
      const r = g.domeR, c = 1.15 * r, dh = 0.45 * r, e = Math.sqrt(1 - (r * r) / (c * c));
      dome = (2 * Math.PI * r * r * (1 + (c / (r * e)) * Math.asin(e))) / 2;      // cho'zilgan sferoidning yarmi
      roofArea = W * D + dome; roofVol = (2 / 3) * Math.PI * r * r * c + Math.PI * r * r * dh;
      roofF = `${n1(W)} × ${n1(D)} + gumbaz ${n1(dome)}`; roofVF = `⅔π·${n1(r)}²·${n1(c)} + π·${n1(r)}²·${n1(dh)}`;
    } else if (p.roof === "terrasa") {
      roofArea = W * D + (pw + 1.2) * (pd + 1.2); roofVol = pw * pd * h;
      roofF = `${n1(W)} × ${n1(D)} + (${n1(pw)}+1,2) × (${n1(pd)}+1,2)`; roofVF = `${n1(pw)} × ${n1(pd)} × ${n1(h)}`;
    } else {
      roofArea = W * D; roofF = `${n1(W)} × ${n1(D)}`;
    }
    if (ps) {                                                         // shakldor tom: tekis yuza plan bo'yicha, nishab — qiyalik koeffitsienti bilan
      const span = ps.wings ? ps.a : Math.min(W, D), k = Math.hypot(1, R / (span / 2));
      if (["nishab", "bir", "piramida"].includes(p.roof)) { roofArea = ps.area * k; roofVol = ps.area * R / 3; roofF = `S × √(1 + (R / ${n1(span / 2)})²) = ${n1(ps.area)} × ${n1(k)}`; roofVF = `⅓ × ${n1(ps.area)} × ${n1(R)}`; }
      else { roofArea = ps.area + (p.roof === "gumbaz" ? dome : p.roof === "terrasa" ? (pw + 1.2) * (pd + 1.2) : 0); roofF = `${n1(ps.area)}${p.roof === "gumbaz" ? ` + gumbaz ${n1(dome)}` : ""}`; }
    }
    const A0 = ps ? ps.area : W * D, Vb = A0 * Hb, floorArea = A0 * N + (p.roof === "terrasa" ? pw * pd : 0);
    const slabVol = N * (ps ? Math.max(0, ps.area - ps.perimeter * T) : (W - 2 * T) * (D - 2 * T)) * 0.25;
    return { g, W, D, N, h, Hb, R, upper, counts, frontOpen, sideOpen, backOpen, glass, doors, gross, open, net, roofArea, roofVol, roofF, roofVF, dome, A0, Vb, floorArea, slabVol, pw, pd, ps };
  }

  // ---------- Bitta uy uchun hisob ----------
  function building(p, cells) {
    const m = measure(p, cells), { g, W, D, N, h, Hb, R, net, glass, doors, gross, open, roofArea, roofVol, A0, Vb, floorArea, slabVol, pw, pd, ps } = m;
    const Vt = Vb + roofVol, Senv = net + roofArea, mat = MATERIALS[p.material] || {};

    // Konstruksiya (taxminiy)
    const wallVol = net * T, dens = mat.dens || 1800, wallMass = (wallVol * dens) / 1000;
    const slabMass = (slabVol * 2500) / 1000, roofMass = (roofArea * 80) / 1000;
    const G = (wallMass + slabMass + roofMass) * 9.81, q = LIVE[p.category] || 2, Ql = q * floorArea, Ed = 1.35 * G + 1.5 * Ql;
    const sigma = Ed / A0, util = (sigma / SOIL) * 100;

    const groups = [];
    groups.push({ title: "Plan geometriyasi", rows: [
      ps ? { k: "Plan shakli", f: `${SHAPES[ps.shape]} · ${n1(W)} × ${n1(D)} m${ps.wings && ps.shape !== "rect" ? ` · qanot ${n1(ps.a)} m` : ""}`, v: "", u: "" } : null,
      ps ? { k: "Perimetr", f: `P = Σ qirralar uzunligi`, v: n1(ps.perimeter), u: "m" } : { k: "Perimetr", f: `P = 2 × (W + D) = 2 × (${n1(W)} + ${n1(D)})`, v: n1(2 * (W + D)), u: "m" },
      ps ? { k: "Plan yuzasi", f: `S = kontur yuzasi${ps.holes.length ? " − ichki hovli" : ""}`, v: n1(A0), u: "m²" } : { k: "Plan yuzasi", f: `S = W × D = ${n1(W)} × ${n1(D)}`, v: n1(A0), u: "m²" },
      { k: "Plan diagonali", f: `d = √(W² + D²) = √(${n1(W)}² + ${n1(D)}²)`, v: n1(Math.hypot(W, D)), u: "m" },
      { k: "Eng katta ichki doira", f: `r = min(W, D) / 2 = ${n1(Math.min(W, D))} / 2`, v: n1(Math.min(W, D) / 2), u: "m" },
      { k: "Oraliqlar moduli", f: `W = ${p.bays} × ${n1(p.bay_w)} (o'qlar A–${String.fromCharCode(65 + p.bays)})`, v: n1(W), u: "m" },
    ].filter(Boolean) });

    const ratio = W / D, gold = (Math.abs(ratio - PHI) / PHI) * 100, hw = Hb / W;
    groups.push({ title: "Nisbatlar", rows: [
      { k: "Plan nisbati", f: `W / D = ${n1(W)} / ${n1(D)}`, v: n2(ratio), u: "" },
      { k: "Oltin kesimdan farq", f: `|W/D − φ| / φ = |${n2(ratio)} − ${n2(PHI)}| / ${n2(PHI)}`, v: n1(gold), u: "%", tone: gold < 8 ? "ok" : "" },
      { k: "Fasad nisbati", f: `W / Hb = ${n1(W)} / ${n1(Hb)}`, v: n2(1 / hw), u: "" },
      { k: "Balandlik / eni", f: `H / W = ${n1(g.H)} / ${n1(W)}`, v: n2(g.H / W), u: "" },
    ] });

    const roofRows = [];
    if (p.roof === "nishab") {
      const a = Math.atan2(R, W / 2);
      roofRows.push({ k: "Tom nishab burchagi", f: `α = arctan(R / (W/2)) = arctan(${n1(R)} / ${n1(W / 2)})`, v: n1(deg(a)), u: "°" });
      roofRows.push({ k: "Tom nishabi", f: `R / (W/2) × 100 = ${n1(R)} / ${n1(W / 2)} × 100`, v: n1((R / (W / 2)) * 100), u: "%" });
    } else if (p.roof === "bir") {
      roofRows.push({ k: "Tom nishab burchagi", f: `α = arctan(R / W) = arctan(${n1(R)} / ${n1(W)})`, v: n1(deg(Math.atan2(R, W))), u: "°" });
      roofRows.push({ k: "Tom nishabi", f: `R / W × 100 = ${n1(R)} / ${n1(W)} × 100`, v: n1((R / W) * 100), u: "%" });
    } else if (p.roof === "piramida") {
      roofRows.push({ k: "Old/orqa nishab burchagi", f: `α = arctan(R / (D/2 + 0,55)) = arctan(${n1(R)} / ${n1(D / 2 + 0.55)})`, v: n1(deg(Math.atan2(R, D / 2 + 0.55))), u: "°" });
      roofRows.push({ k: "Yon nishab burchagi", f: `β = arctan(R / (W/2 + 0,55)) = arctan(${n1(R)} / ${n1(W / 2 + 0.55)})`, v: n1(deg(Math.atan2(R, W / 2 + 0.55))), u: "°" });
    } else if (p.roof === "gumbaz") {
      roofRows.push({ k: "Gumbaz radiusi", f: `r = min(0,28·W; 0,4·D; 9) = min(${n1(0.28 * W)}; ${n1(0.4 * D)}; 9)`, v: n1(g.domeR), u: "m" });
      roofRows.push({ k: "Gumbaz balandligi", f: `c = 1,15 × r = 1,15 × ${n1(g.domeR)}`, v: n1(1.15 * g.domeR), u: "m" });
    } else if (p.roof === "terrasa") {
      roofRows.push({ k: "Tom pavilyoni", f: `${n1(pw)} × ${n1(pd)} × ${n1(h)} (eni × chuqurligi × balandligi)`, v: n1(pw * pd), u: "m²" });
    } else {
      roofRows.push({ k: "Tom nishabi", f: "tekis tom", v: "0", u: "°" });
    }
    groups.push({ title: "Hajm, balandlik va tom", rows: [
      { k: "Devor balandligi", f: `Hb = N × h = ${N} × ${n1(h)}`, v: n1(Hb), u: "m" },
      { k: "Umumiy balandlik", f: `H = Hb + R = ${n1(Hb)} + ${n1(R)}`, v: n1(g.H), u: "m" },
      { k: "Bino hajmi", f: `Vb = S × Hb = ${n1(A0)} × ${n1(Hb)}`, v: n0(Vb), u: "m³" },
      ...(roofVol ? [{ k: "Tom hajmi", f: m.roofVF, v: n0(roofVol), u: "m³" }] : []),
      { k: "Jami hajm", f: `V = Vb + Vtom = ${n0(Vb)} + ${n0(roofVol)}`, v: n0(Vt), u: "m³" },
      { k: "Umumiy maydon", f: `S × N${p.roof === "terrasa" ? " + pavilyon" : ""} = ${n1(A0)} × ${N}`, v: n0(floorArea), u: "m²" },
      { k: "Tom yuzasi", f: m.roofF, v: n0(roofArea), u: "m²" },
      ...roofRows,
    ] });

    const glazing = (glass / gross) * 100;
    groups.push({ title: "Devor va oynalanish", rows: [
      ps ? { k: "Devorning umumiy yuzasi", f: `P × Hb = ${n1(ps.perimeter)} × ${n1(Hb)}`, v: n0(gross), u: "m²" } : { k: "Devorning umumiy yuzasi", f: `2 × (W + D) × Hb = 2 × (${n1(W)} + ${n1(D)}) × ${n1(Hb)}`, v: n0(gross), u: "m²" },
      { k: "Deraza va eshiklar", f: `old ${n0(m.frontOpen)} + yon ${n0(m.sideOpen)} + orqa ${n0(m.backOpen)}`, v: n0(open), u: "m²" },
      { k: "Sof devor yuzasi", f: `${n0(gross)} − ${n0(open)}`, v: n0(net), u: "m²" },
      { k: "Oynalanish", f: `oyna / devor = ${n0(glass)} / ${n0(gross)} × 100`, v: n1(glazing), u: "%", tone: glazing > 45 ? "warn" : "" },
      { k: "Shakl koeffitsienti", f: `(devor + tom) / hajm = ${n0(Senv)} / ${n0(Vt)}`, v: n2(Senv / Vt), u: "1/m" },
    ] });

    // Energiya: issiqlik yo'qotish koeffitsienti ΣU·A va yillik isitish
    const U = { wall: mat.u || 1.2, win: p.window === "panorama" ? 1.4 : 1.8, door: 2.5, roof: p.roof === "tekis" || p.roof === "terrasa" ? 0.35 : 0.28, floor: 0.45 };
    const HL = U.wall * net + U.win * glass + U.door * doors + U.roof * roofArea + U.floor * A0;
    const kwh = (HL * HDD * 24) / 1000, spec = kwh / floorArea;
    const cls = spec < 50 ? "A" : spec < 90 ? "B" : spec < 150 ? "C" : spec < 230 ? "D" : "E";
    groups.push({ title: "Energiya (taxminiy)", rows: [
      { k: "Issiqlik yo'qotish koeffitsienti", f: `ΣU·A = ${n2(U.wall)}×${n0(net)} + ${n1(U.win)}×${n0(glass)} + ${n1(U.door)}×${n0(doors)} + ${n2(U.roof)}×${n0(roofArea)} + ${n2(U.floor)}×${n0(A0)}`, v: n0(HL), u: "W/K" },
      { k: "Yillik isitish", f: `ΣU·A × ${HDD} K·kun × 24 / 1000`, v: n0(kwh), u: "kWh" },
      { k: "Solishtirma sarf", f: `${n0(kwh)} / ${n0(floorArea)} m²`, v: n0(spec), u: "kWh/m²", tone: cls <= "B" ? "ok" : cls === "C" ? "" : "warn" },
      { k: "Energiya sinfi", f: "A < 50 · B < 90 · C < 150 · D < 230 kWh/m²", v: cls, u: "", tone: cls <= "B" ? "ok" : cls === "C" ? "" : "warn" },
      { k: "Yillik isitish xarajati", f: `${n0(kwh)} kWh × $${n2(KWH_PRICE)}`, v: "$" + n0(kwh * KWH_PRICE), u: "" },
    ] });

    const cons = [];
    if (p.material === "gisht" || p.material === "oqgisht") cons.push({ k: "G'isht soni", f: `${n0(wallVol)} m³ × ${BRICKS_PER_M3} dona/m³`, v: n0(wallVol * BRICKS_PER_M3), u: "dona" });
    cons.push(
      { k: "Devor hajmi", f: `sof devor × qalinlik = ${n0(net)} × ${T}`, v: n0(wallVol), u: "m³" },
      { k: "Devor og'irligi", f: `${n0(wallVol)} m³ × ${n0(dens)} kg/m³`, v: n0(wallMass), u: "t" },
      { k: "Yopma plitalari", f: `N × (W−2t) × (D−2t) × 0,25 = ${N} × ${n1(W - 2 * T)} × ${n1(D - 2 * T)} × 0,25`, v: n0(slabVol), u: "m³ beton" },
      { k: "Doimiy yuk G", f: `(devor + plita + tom) × 9,81 = (${n0(wallMass)} + ${n0(slabMass)} + ${n0(roofMass)}) t × 9,81`, v: n0(G), u: "kN" },
      { k: "Foydali yuk Q", f: `q × maydon = ${n1(q)} kN/m² × ${n0(floorArea)}`, v: n0(Ql), u: "kN" },
      { k: "Hisobiy yuk", f: `1,35 × G + 1,5 × Q = 1,35 × ${n0(G)} + 1,5 × ${n0(Ql)}`, v: n0(Ed), u: "kN" },
      { k: "Poydevorga bosim", f: `σ = yuk / S = ${n0(Ed)} / ${n1(A0)}`, v: n0(sigma), u: "kPa" },
      { k: `Grunt zaxirasi (${SOIL} kPa)`, f: `σ / ${SOIL} × 100`, v: n0(util), u: "%", tone: util > 100 ? "bad" : util > 75 ? "warn" : "ok" },
    );
    groups.push({ title: "Konstruksiya (taxminiy)", rows: cons });
    return groups;
  }

  // ---------- Majmua: uchastka, zichlik, masofalar ----------
  const bboxOf = L => ({ x0: Math.min(...L.map(l => l.cx - l.w / 2)), x1: Math.max(...L.map(l => l.cx + l.w / 2)),
                         z0: Math.min(...L.map(l => l.cz - l.d / 2)), z1: Math.max(...L.map(l => l.cz + l.d / 2)) });
  function pairs(L) {
    const out = [];
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) out.push({ i, j, gap: footGap(L[i], L[j]) });
    return out;
  }
  function site(list, L, yard) {
    const n = list.length, bb = bboxOf(L), bw = bb.x1 - bb.x0, bd = bb.z1 - bb.z0;
    const Y = yard && yard.on ? yard : null, R = Y ? yardRect(L, Y) : null;          // hovli bo'lsa — uchastka = hovli to'sig'i ichi
    const plotW = R ? R.x1 - R.x0 : bw + 2 * SETBACK, plotD = R ? R.z1 - R.z0 : bd + 2 * SETBACK, plot = plotW * plotD;
    const foot = i => (shapeOf(list[i].params) !== "rect" ? planShape(list[i].params).area : L[i].W * L[i].D);   // shakldor planda haqiqiy yuza
    const built = L.reduce((s, l, i) => s + foot(i), 0);
    const area = list.reduce((s, b, i) => s + foot(i) * b.params.floors, 0);
    const cover = (built / plot) * 100, far = area / plot;
    const rows = [
      { k: "Uchastka yuzasi", f: R ? `hovli: (${n1(bw)} + 2×${Y.margin}) × (${n1(bd)} + 2×${Y.margin}) = ${n1(plotW)} × ${n1(plotD)}` : `(${n1(bw)} + 2×${SETBACK}) × (${n1(bd)} + 2×${SETBACK}) = ${n1(plotW)} × ${n1(plotD)}`, v: n0(plot), u: "m²" },
      { k: "Qurilish zichligi", f: `Σ plan yuzasi / uchastka = ${n0(built)} / ${n0(plot)} × 100`, v: n1(cover), u: "%", tone: cover > 40 ? "warn" : "ok" },
      { k: "Qavatlilik koeffitsienti", f: `Σ umumiy maydon / uchastka = ${n0(area)} / ${n0(plot)}`, v: n2(far), u: "" },
      { k: "Ochiq maydon", f: `${n0(plot)} − ${n0(built)}`, v: n0(plot - built), u: "m²" },
    ];
    if (n > 1) {
      const ps = pairs(L), near = ps.reduce((m, p) => p.gap < m.gap ? p : m, ps[0]);
      const H = Math.max(L[near.i].H, L[near.j].H), lbl = `${near.i + 1}–${near.j + 1}-uy`;
      if (near.gap < 0) rows.push({ k: "Uylar ustma-ust tushdi", f: `${lbl}: uylardan birini bosh rejada suring`, v: n1(-near.gap), u: "m", tone: "bad" });
      else rows.push(
        { k: "Eng yaqin uylar orasi", f: `${lbl} · yong'inga qarshi minimal ${FIRE_GAP} m`, v: n1(near.gap), u: "m", tone: near.gap >= FIRE_GAP ? "ok" : "bad" },
        { k: "Soya: oraliq / balandlik", f: `${lbl}: ${n1(near.gap)} / ${n1(H)}`, v: n2(near.gap / H), u: "", tone: near.gap / H >= 1 ? "ok" : "warn" },
      );
      L.forEach((l, i) => { if (l.rot) rows.push({ k: `${i + 1}-uy burilishi`, f: `old fasad: ${({ 90: "sharqqa", 180: "shimolga", 270: "g'arbga" })[l.rot]}`, v: String(l.rot), u: "°" }); });
    }
    const groups = [{ title: n > 1 ? `Majmua (${n} ta uy)` : "Uchastka", rows }];
    if (R) {
      const P = yardPath(L, R), pathA = P ? P.w * (P.z1 - P.z0) : 0;
      const hard = Y.items.filter(i => !YARD_GREEN.includes(i.t)).reduce((s, i) => s + YARD_ITEMS[i.t].w * YARD_ITEMS[i.t].d, 0);
      const green = Math.max(0, plot - built - hard - pathA), gp = (green / plot) * 100;
      const trees = Y.items.filter(i => i.t === "tree").length;
      const out = Y.items.filter(i => { const f = itemFoot(i); return f.cx - f.w / 2 < R.x0 - 0.01 || f.cx + f.w / 2 > R.x1 + 0.01 || f.cz - f.d / 2 < R.z0 - 0.01 || f.cz + f.d / 2 > R.z1 + 0.01; }).length;
      const yr = [
        { k: "Ko'kalamzor maydon", f: `hovli − binolar − qattiq qoplama = ${n0(plot)} − ${n0(built)} − ${n0(hard + pathA)}`, v: n0(green), u: "m²" },
        { k: "Ko'kalamzorlashtirish", f: `${n0(green)} / ${n0(plot)} × 100 (tavsiya ≥ 25%)`, v: n1(gp), u: "%", tone: gp >= 25 ? "ok" : gp >= 15 ? "warn" : "bad" },
      ];
      if (Y.fence !== "yoq") yr.push({ k: "To'siq uzunligi", f: `2 × (${n1(plotW)} + ${n1(plotD)}) − darvoza ${YARD_GATE}`, v: n1(2 * (plotW + plotD) - YARD_GATE), u: "m" });
      yr.push({ k: "Daraxtlar", f: `soya ≈ ${trees} × π × 1,9² = ${n0(trees * Math.PI * 1.9 * 1.9)} m²`, v: String(trees), u: "dona" });
      if (out) yr.push({ k: "Hovlidan tashqarida", f: "elementni sudrab hovli ichiga qaytaring", v: String(out), u: "ta", tone: "bad" });
      groups.push({ title: `Hovli · ${FENCES[Y.fence]}`, rows: yr });
    }
    return groups;
  }

  // ---------- Materiallar smetasi (BOQ): loyihadagi mahsulotlar va miqdorlar ----------
  const CELL_PRODUCT = { win: "el-win", wide: "el-wide", arch: "el-arch", slit: "el-slit", round: "el-round", lattice: "el-lattice", balc: "el-balc", door: "el-door", shop: "el-shop",
    tall: "el-win-alu", square: "el-win", triple: "el-win-alu", door2: "el-door-wood", glassdoor: "el-door-glass", archdoor: "el-door-wood", garage: "el-garage" };
  // Ichki jihozlardan katalogda boshqa bo'limda turganlari: [mahsulot, miqdor] (radiator — seksiyalab sotiladi)
  const FURN_PRODUCT = { kitchen: ["int-oshxona", 2.4], ac: ["eng-kondi", 1], boiler: ["eng-kotel", 1], radiator: ["eng-radiator", 8] };
  const YARD_PRODUCT = { tree: "yrd-daraxt", fruit: "yrd-daraxt", pine: "yrd-archa", bush: "yrd-buta", suri: "yrd-suri", lamp: "yrd-chiroq", fountain: "yrd-favvora", gazebo: "yrd-shiypon",
    tandir: "yrd-tandir", bench: "yrd-orindiq", play: "yrd-bolalar", greenhouse: "yrd-issiqxona", bbq: "yrd-mangal", lounger: "yrd-shezlong", umbrella: "yrd-soyabon", pot: "yrd-tuvak",
    swing: "yrd-argimchoq", doghouse: "yrd-ituycha", bed: "yrd-gulzor" };
  const YARD_AREA_PRODUCT = { pool: "yrd-hovuz", swim: "yrd-basseyn", ishkom: "yrd-pergola" };
  const ROOF_PRODUCT = { nishab: "roof-tile", piramida: "roof-tile", bir: "roof-metal", tekis: "roof-flat", terrasa: "roof-flat" };
  function boq(list) {
    const qty = {}, add = (id, q) => { if (id && q > 0) qty[id] = (qty[id] || 0) + q; };
    list.forEach(b => {
      const m = measure(b.params, b.cells);
      add(`mat-${b.params.material}`, m.net);                                  // fasad qoplamasi: sof devor yuzasi
      Object.entries(m.counts).forEach(([t, n]) => add(CELL_PRODUCT[t], n));   // deraza, eshik, balkon, vitrina
      if (b.params.roof === "gumbaz") { add("roof-flat", m.A0); add("roof-dome", m.dome); }
      else add(ROOF_PRODUCT[b.params.roof], m.roofArea);
      add("con-slab", m.slabVol);                                              // qavatlararo yopma
      if (b.interior && typeof Interior !== "undefined")                       // ichki jihozlar: har biri dona (oshxona — pog. m)
        Interior.norm(b.params, b.interior).floors.forEach(fl => fl.items.forEach(([t]) => { const e = FURN_PRODUCT[t]; if (e) add(e[0], e[1]); else add(`mbl-${t}`, 1); }));
    });
    const Y = typeof Site !== "undefined" && Site.yard && Site.yard.on ? Site.yard : null;   // hovli: daraxt, mangal... dona; hovuz, basseyn, ishkom — m²
    if (Y) Y.items.forEach(i => { const sq = YARD_AREA_PRODUCT[i.t]; if (sq) add(sq, YARD_ITEMS[i.t].w * YARD_ITEMS[i.t].d); else add(YARD_PRODUCT[i.t], 1); });
    return Object.entries(qty).filter(([id]) => G.catalog[id]).map(([id, q]) => {
      const pr = G.catalog[id], qq = pr.unit === "dona" ? Math.round(q) : Math.ceil(q);
      return { id, name: pr.name, unit: pr.unit, qty: qq, price: pr.price, total: qq * pr.price };
    });
  }
  function boqCsv(lines) {
    const esc2 = s => `"${String(s).replace(/"/g, '""')}"`;
    const rows = [["Mahsulot", "Miqdor", "Birlik", "Narx ($)", "Jami ($)"], ...lines.map(l => [l.name, l.qty, l.unit, l.price, l.total])];
    rows.push(["Jami", "", "", "", lines.reduce((s, l) => s + l.total, 0)]);
    return "﻿" + rows.map(r => r.map(esc2).join(";")).join("\r\n");        // Excel uchun: BOM va ";" ajratgich
  }

  // ---------- Fasad ustiga chizma chiziqlari (building.js renderFacade chaqiradi) ----------
  function facade(p, g, m, f) {
    const { X, Y, s, gy } = m, W = g.W, Hb = g.Hb, N = p.floors, h = p.floor_h;
    const fmt = v => rnd(v, 100).toLocaleString("ru-RU"), o = [], legend = [];

    if (f.axes) {
      const topY = Math.max(21, Y(g.H) - 14);
      for (let i = 0; i <= p.bays; i++) {                       // konstruktiv o'qlar: A, B, C...
        const x = X(i * p.bay_w);
        o.push(`<line class="geo-axis" x1="${x}" y1="${topY}" x2="${x}" y2="${gy + 10}"/>`);
        o.push(`<circle class="geo-bub" cx="${x}" cy="${topY - 9}" r="8.5"/><text class="geo-text mid" x="${x}" y="${topY - 5.6}" text-anchor="middle">${String.fromCharCode(65 + i)}</text>`);
      }
      for (let k = 1; k < N; k++) {                              // oraliq qavat sathlari
        const y = Y(k * h);
        o.push(`<line class="geo-line geo-faint geo-dash" x1="${X(-0.5)}" y1="${y}" x2="${X(W + 0.5)}" y2="${y}"/>`);
        o.push(`<text class="geo-text" x="${X(0) - 6}" y="${y - 3}" text-anchor="end">+${fmt(k * h)}</text>`);
      }
      const yc = gy + 44;                                        // oraliqlar zanjiri
      o.push(`<line class="geo-line" x1="${X(0)}" y1="${yc}" x2="${X(W)}" y2="${yc}"/>`);
      for (let i = 0; i <= p.bays; i++) o.push(`<line class="geo-line" x1="${X(i * p.bay_w) - 3}" y1="${yc + 3}" x2="${X(i * p.bay_w) + 3}" y2="${yc - 3}"/>`);
      if (s * p.bay_w > 26) for (let i = 0; i < p.bays; i++) o.push(`<text class="geo-text" x="${X((i + 0.5) * p.bay_w)}" y="${yc - 4}" text-anchor="middle">${fmt(p.bay_w)}</text>`);
      o.push(`<text class="geo-text" x="${X(W / 2)}" y="${yc + 13}" text-anchor="middle">${p.bays} × ${fmt(p.bay_w)} = ${fmt(W)}</text>`);
      const xc = X(W) + 66;                                      // qavat balandliklari zanjiri
      o.push(`<line class="geo-line" x1="${xc}" y1="${Y(0)}" x2="${xc}" y2="${Y(Hb)}"/>`);
      for (let k = 0; k <= N; k++) o.push(`<line class="geo-line" x1="${xc - 3}" y1="${Y(k * h) + 3}" x2="${xc + 3}" y2="${Y(k * h) - 3}"/>`);
      if (s * h > 16) for (let k = 0; k < N; k++) { const ty = Y((k + 0.5) * h); o.push(`<text class="geo-text" x="${xc - 4}" y="${ty}" text-anchor="middle" transform="rotate(-90 ${xc - 4} ${ty})">${fmt(h)}</text>`); }
      legend.push(`O'qlar A–${String.fromCharCode(65 + p.bays)} · ${N} × ${fmt(h)} m`);
    }

    if (f.diag) {
      o.push(`<line class="geo-line geo-dash" x1="${X(0)}" y1="${Y(0)}" x2="${X(W)}" y2="${Y(Hb)}"/><line class="geo-line geo-dash" x1="${X(W)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(Hb)}"/>`);
      o.push(`<text class="geo-text halo" x="${X(W / 2)}" y="${Y(Hb / 2) - 5}" text-anchor="middle">d = ${fmt(Math.hypot(W, Hb))} m</text>`);
      legend.push(`Diagonal d = √(W² + Hb²) = ${fmt(Math.hypot(W, Hb))} m`);
    }

    if (f.golden) {
      [1 / PHI, 1 - 1 / PHI].forEach(k => {
        o.push(`<line class="geo-gold" x1="${X(W * k)}" y1="${Y(0) + 4}" x2="${X(W * k)}" y2="${Y(Hb) - 6}"/>`);
        o.push(`<line class="geo-gold" x1="${X(0) - 6}" y1="${Y(Hb * k)}" x2="${X(W) + 6}" y2="${Y(Hb * k)}"/>`);
      });
      legend.push(`<gold>Oltin kesim: 0,618 va 0,382 · W/Hb = ${fmt(W / Hb)} (φ = ${fmt(PHI)})`);
    }

    if (f.angles) {
      const q = 9;                                               // yer burchaklari: 90°
      o.push(`<path class="geo-line" d="M${X(0) + q} ${Y(0)} V${Y(0) - q} H${X(0)}"/><path class="geo-line" d="M${X(W) - q} ${Y(0)} V${Y(0) - q} H${X(W)}"/>`);
      const arc = (a, ex, ey, label) => {
        const r = 38;
        o.push(`<line class="geo-line geo-dash" x1="${ex}" y1="${ey}" x2="${ex + 66}" y2="${ey}"/>`);
        o.push(`<path class="geo-line" d="M${ex + r} ${ey} A${r} ${r} 0 0 0 ${ex + r * Math.cos(a)} ${ey - r * Math.sin(a)}"/>`);
        o.push(`<text class="geo-text halo" x="${ex + (r + 8) * Math.cos(a / 2)}" y="${ey - (r + 8) * Math.sin(a / 2)}">${fmt(deg(a))}°</text>`);
        legend.push(`${label} = ${fmt(deg(a))}°`);
      };
      if (p.roof === "nishab") { const oh = 0.55; arc(Math.atan2(g.R, W / 2), X(-oh), Y(Hb - (g.R * oh) / (W / 2)), "Tom burchagi α"); }
      if (p.roof === "bir") { const oh = 0.55, k = g.R / W; arc(Math.atan2(g.R, W), X(-oh), Y(Hb - k * oh), "Tom burchagi α"); }
      if (p.roof === "piramida") arc(Math.atan2(g.R, W / 2 + 0.55), X(-0.55), Y(Hb), "Yon nishab burchagi β");   // old ko'rinishdagi qirralar yon yuzalar nishabi bilan bir xil
      if (p.roof === "gumbaz") {
        const r = g.domeR, cx = X(W / 2), cy = Y(Hb + 0.45 * r);
        o.push(`<circle class="geo-line geo-dash" cx="${cx}" cy="${cy}" r="${r * s}"/><line class="geo-line" x1="${cx}" y1="${cy}" x2="${cx + r * s}" y2="${cy}"/><circle class="geo-dot" cx="${cx}" cy="${cy}" r="2.5"/>`);
        o.push(`<text class="geo-text halo" x="${cx + (r * s) / 2}" y="${cy - 4}" text-anchor="middle">r = ${fmt(r)}</text>`);
        legend.push(`Gumbaz: r = ${fmt(r)} m, c = 1,15·r = ${fmt(1.15 * r)} m`);
      }
    }

    legend.forEach((t, i) => {
      const gold = t.startsWith("<gold>");
      o.push(`<text class="geo-text${gold ? " gold" : ""} halo" x="10" y="${14 + i * 12}">${gold ? t.slice(6) : t}</text>`);
    });
    return `<g class="geo" pointer-events="none">${o.join("")}</g>`;
  }

  // ---------- Yuqoridan reja (bosh reja): uchastka yoki hovli, uylar, elementlar, masofalar. Hammasini sudrash mumkin ----------
  function itemSvg(it, f) {
    const x = f.cx - f.w / 2, z = f.cz - f.d / 2;
    if (it.t === "tree") return `<circle class="gy-tree" cx="${f.cx}" cy="${f.cz}" r="${f.w / 2}"/><circle class="gy-trunk" cx="${f.cx}" cy="${f.cz}" r="0.3"/>`;
    if (it.t === "bed") return `<rect class="gy-bed" x="${x}" y="${z}" width="${f.w}" height="${f.d}" rx="0.4"/>` +
      [-0.3, 0, 0.3].map(k => `<circle class="gy-flower" cx="${f.cx + k * f.w * 0.8}" cy="${f.cz + (f.w > f.d ? 0 : k * f.d * 0.8)}" r="0.32"/>`).join("");
    if (it.t === "pool") return `<rect class="gy-pool-rim" x="${x}" y="${z}" width="${f.w}" height="${f.d}"/><rect class="gy-pool" x="${x + 0.3}" y="${z + 0.3}" width="${f.w - 0.6}" height="${f.d - 0.6}" rx="0.4"/>`;
    const R = (cls, extra = "") => `<rect class="${cls}" x="${x}" y="${z}" width="${f.w}" height="${f.d}"${extra}/>`, lbl = (t, k = 0.45) => `<text class="gy-p" x="${f.cx}" y="${f.cz + Math.min(f.w, f.d) * k * 0.35}" text-anchor="middle" font-size="${Math.min(f.w, f.d) * k}">${t}</text>`;
    if (it.t === "garage") return R("gy-garage") + `<path class="gy-line" d="M${x} ${z} L${f.cx} ${z + f.d / 2} L${x + f.w} ${z} M${x} ${z + f.d} L${f.cx} ${z + f.d / 2} L${x + f.w} ${z + f.d}"/>` + lbl("G");
    if (it.t === "swim") return R("gy-pool-rim") + `<rect class="gy-swim" x="${x + 0.4}" y="${z + 0.4}" width="${f.w - 0.8}" height="${f.d - 0.8}"/><path class="gy-lane" d="M${x + 0.6} ${f.cz} H${x + f.w - 0.6}"/>`;
    if (it.t === "pine") return `<polygon class="gy-pine" points="${f.cx},${z} ${x + f.w},${z + f.d} ${x},${z + f.d}"/>`;
    if (it.t === "fruit") return `<circle class="gy-tree" cx="${f.cx}" cy="${f.cz}" r="${f.w / 2}"/>` + [[-0.25, -0.2], [0.2, -0.1], [0, 0.25], [-0.1, 0.05]].map(([a, b]) => `<circle class="gy-fruit" cx="${f.cx + a * f.w}" cy="${f.cz + b * f.d}" r="0.22"/>`).join("");
    if (it.t === "bush") return `<circle class="gy-bush" cx="${f.cx}" cy="${f.cz}" r="${f.w / 2}"/>`;
    if (it.t === "fountain") return `<circle class="gy-pool-rim" cx="${f.cx}" cy="${f.cz}" r="${f.w / 2}"/><circle class="gy-pool" cx="${f.cx}" cy="${f.cz}" r="${f.w / 2 - 0.3}"/><circle class="gy-trunk" cx="${f.cx}" cy="${f.cz}" r="0.35"/>`;
    if (it.t === "gazebo") { const pts = Array.from({ length: 6 }, (_, i) => `${f.cx + Math.cos(i * Math.PI / 3) * f.w / 2},${f.cz + Math.sin(i * Math.PI / 3) * f.d / 2}`).join(" "); return `<polygon class="gy-suri" points="${pts}"/><path class="gy-line" d="${Array.from({ length: 6 }, (_, i) => `M${f.cx} ${f.cz} L${f.cx + Math.cos(i * Math.PI / 3) * f.w / 2} ${f.cz + Math.sin(i * Math.PI / 3) * f.d / 2}`).join("")}"/>`; }
    if (it.t === "tandir") return `<circle class="gy-tandir" cx="${f.cx}" cy="${f.cz}" r="${f.w / 2}"/><circle class="gy-trunk" cx="${f.cx}" cy="${f.cz}" r="0.25"/>`;
    if (it.t === "bench") return R("gy-suri", ` rx="0.1"`);
    if (it.t === "play") return R("gy-play", ` rx="0.4"`) + `<path class="gy-line" d="M${x + 0.6} ${z + 0.8} h${f.w * 0.35} M${x + f.w - 1.2} ${z + 0.6} v${f.d - 1.2}"/>` + `<circle class="gy-fruit" cx="${f.cx}" cy="${f.cz + f.d * 0.2}" r="0.4"/>`;
    if (it.t === "lamp") return `<circle class="gy-lamp" cx="${f.cx}" cy="${f.cz}" r="0.3"/>`;
    if (it.t === "greenhouse") return R("gy-green", ` rx="0.6"`) + `<path class="gy-line" d="M${f.cx} ${z} V${z + f.d}"/>`;
    if (it.t === "bbq") return R("gy-tandir", ` rx="0.1"`) + `<path class="gy-line" d="M${x + 0.2} ${f.cz} H${x + f.w - 0.2}"/>`;
    if (it.t === "lounger") return R("gy-suri", ` rx="0.15"`) + `<rect class="gy-umb" x="${x + 0.08}" y="${z + 0.08}" width="${f.w - 0.16}" height="${Math.min(f.w, f.d) * 0.45}"/>`;
    if (it.t === "umbrella") return `<circle class="gy-umb" cx="${f.cx}" cy="${f.cz}" r="${f.w / 2}"/><path class="gy-line" d="${Array.from({ length: 8 }, (_, i) => `M${f.cx} ${f.cz} L${f.cx + Math.cos(i * Math.PI / 4) * f.w / 2} ${f.cz + Math.sin(i * Math.PI / 4) * f.d / 2}`).join("")}"/>`;
    if (it.t === "pot") return `<circle class="gy-tandir" cx="${f.cx}" cy="${f.cz}" r="${f.w / 2}"/><circle class="gy-fruit" cx="${f.cx}" cy="${f.cz}" r="${f.w * 0.25}"/>`;
    if (it.t === "swing") return `<path class="gy-line" d="M${x} ${f.cz} H${x + f.w}"/>` + R("gy-suri", ` rx="0.05" fill-opacity=".25"`) + `<rect class="gy-suri" x="${f.cx - 0.3}" y="${f.cz - 0.2}" width="0.6" height="0.4"/>`;
    if (it.t === "doghouse") return R("gy-suri") + `<path class="gy-line" d="M${x} ${z} L${f.cx} ${f.cz} L${x + f.w} ${z}"/>`;
    if (it.t === "ishkom") return R("gy-suri", ` fill-opacity=".25"`) + `<path class="gy-line" d="${Array.from({ length: 5 }, (_, i) => `M${x} ${z + i * f.d / 4} H${x + f.w}`).join("")}"/>` + [[0.25, 0.3], [0.7, 0.55], [0.4, 0.8]].map(([a, b]) => `<circle class="gy-bush" cx="${x + a * f.w}" cy="${z + b * f.d}" r="0.5"/>`).join("");
    if (it.t === "suri") return `<rect class="gy-suri" x="${x}" y="${z}" width="${f.w}" height="${f.d}"/><path class="gy-line" d="M${x} ${z} L${x + f.w} ${z + f.d} M${x + f.w} ${z} L${x} ${z + f.d}"/>`;
    return `<rect class="gy-car" x="${x}" y="${z}" width="${f.w}" height="${f.d}"/><text class="gy-p" x="${f.cx}" y="${f.cz + Math.min(f.w, f.d) * 0.2}" text-anchor="middle" font-size="${Math.min(f.w, f.d) * 0.55}">P</text>`;
  }
  function plan(list, L, active, frozenVB, yard, ysel) {
    const n = list.length, bb = bboxOf(L), Y = yard && yard.on ? yard : null, R = Y ? yardRect(L, Y) : null;
    const P = R || { x0: bb.x0 - SETBACK, z0: bb.z0 - SETBACK, x1: bb.x1 + SETBACK, z1: bb.z1 + SETBACK };
    const pad = 5, px0 = P.x0, pz0 = P.z0, pw = P.x1 - P.x0, pd = P.z1 - P.z0, st = R ? 1.2 : 0.2;   // ko'cha chizig'i to'siqdan biroz tashqarida
    let [vx, vz, vw, vd] = [px0 - pad, pz0 - pad, pw + 2 * pad, pd + 2 * pad + st];
    if (frozenVB) [vx, vz, vw, vd] = frozenVB;                       // sudrash paytida ko'rinish qimirlamaydi
    const fs = Math.max(0.55, Math.max(vw, vd) / 60), tk = fs * 0.55, o = [];
    const fmt = v => rnd(v, 10).toLocaleString("ru-RU");
    const dim = (x0, z0, x1, z1, label, cls = "") => {
      const horiz = z0 === z1, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      o.push(`<line class="gp-dim ${cls}" x1="${x0}" y1="${z0}" x2="${x1}" y2="${z1}"/>`);
      [[x0, z0], [x1, z1]].forEach(([x, z]) => o.push(`<line class="gp-dim ${cls}" x1="${x - tk * .6}" y1="${z + tk * .6}" x2="${x + tk * .6}" y2="${z - tk * .6}"/>`));
      o.push(horiz ? `<text class="gp-t ${cls}" x="${mx}" y="${mz - fs * 0.35}" text-anchor="middle" font-size="${fs}">${label}</text>`
                   : `<text class="gp-t ${cls}" x="${mx - fs * 0.35}" y="${mz}" text-anchor="middle" font-size="${fs}" transform="rotate(-90 ${mx - fs * 0.35} ${mz})">${label}</text>`);
    };

    if (R) {                                                           // hovli: maysa, yo'lak, to'siq va darvoza
      o.push(`<rect class="gp-yard" x="${px0}" y="${pz0}" width="${pw}" height="${pd}"/>`);
      const path = yardPath(L, R);
      if (path) o.push(`<rect class="gp-path" x="${path.x - path.w / 2}" y="${path.z0}" width="${path.w}" height="${path.z1 - path.z0}"/>`);
      const g0 = R.gx - R.gw / 2, g1 = R.gx + R.gw / 2;
      if (Y.fence !== "yoq") {
        o.push(`<path class="gp-fence ${Y.fence}" d="M${g0} ${R.z1} H${R.x0} V${R.z0} H${R.x1} V${R.z1} H${g1}"/>`);
        [g0, g1].forEach(x => o.push(`<rect class="gp-gate" x="${x - 0.35}" y="${R.z1 - 0.35}" width="0.7" height="0.7"/>`));
      } else o.push(`<rect class="gp-plot" x="${px0}" y="${pz0}" width="${pw}" height="${pd}"/>`);
      o.push(`<text class="gp-t soft" x="${R.gx}" y="${R.z1 + fs * 1.15}" text-anchor="middle" font-size="${fs * 0.85}">darvoza</text>`);
      Y.items.forEach((it, k) => o.push(`<g class="gp-y${k === ysel ? " sel" : ""}" data-yi="${k}">${itemSvg(it, itemFoot(it))}<title>${YARD_ITEMS[it.t].label}</title></g>`));
    } else {
      o.push(`<rect class="gp-plot" x="${px0}" y="${pz0}" width="${pw}" height="${pd}"/>`);
      o.push(`<text class="gp-t soft" x="${px0 + fs * 0.5}" y="${pz0 + pd - fs * 0.5}" font-size="${fs * 0.9}">Uchastka chegarasi (${SETBACK} m chekinish)</text>`);
    }
    o.push(`<line class="gp-street" x1="${vx}" y1="${pz0 + pd + st}" x2="${vx + vw}" y2="${pz0 + pd + st}"/><text class="gp-t soft" x="${vx + vw - fs * 0.5}" y="${pz0 + pd + st + fs * 1.15}" text-anchor="end" font-size="${fs * 0.9}">KO'CHA</text>`);

    L.forEach((l, i) => {
      const on = i === active, W = l.W, D = l.D;
      // Uy o'z koordinatalarida chiziladi: markaz (0,0), old fasad pastda (+z); keyin joyiga ko'chiriladi va buriladi
      const g = [`<rect class="gp-b${on ? " on" : ""}${n > 1 ? " drag" : ""}" data-bi="${i}" x="${-W / 2}" y="${-D / 2}" width="${W}" height="${D}"/>`,
                 `<line class="gp-front" x1="${-W / 2}" y1="${D / 2}" x2="${W / 2}" y2="${D / 2}"/>`];
      if (flags.axes) g.push(`<line class="gp-axis" x1="0" y1="${-D / 2 - 0.8}" x2="0" y2="${D / 2 + 0.8}"/><line class="gp-axis" x1="${-W / 2 - 0.8}" y1="0" x2="${W / 2 + 0.8}" y2="0"/>`);
      if (flags.diag) g.push(`<line class="gp-diag" x1="${-W / 2}" y1="${-D / 2}" x2="${W / 2}" y2="${D / 2}"/><line class="gp-diag" x1="${W / 2}" y1="${-D / 2}" x2="${-W / 2}" y2="${D / 2}"/>`);
      if (flags.angles && on) {
        const q = Math.min(1.2, W / 6, D / 6);
        [[-W / 2, -D / 2, 1, 1], [W / 2, -D / 2, -1, 1], [-W / 2, D / 2, 1, -1], [W / 2, D / 2, -1, -1]].forEach(([cx, cz, sx, sz]) =>
          g.push(`<path class="gp-dim" d="M${cx + sx * q} ${cz} V${cz + sz * q} H${cx}"/>`));
      }
      o.push(`<g transform="translate(${l.cx} ${l.cz}) rotate(${-l.rot})">${g.join("")}</g>`);
      o.push(`<text class="gp-t big" x="${l.cx}" y="${l.cz - fs * 0.2}" text-anchor="middle" font-size="${fs * 1.5}">${i + 1}</text>`);
      o.push(`<text class="gp-t" x="${l.cx}" y="${l.cz + fs * 1.1}" text-anchor="middle" font-size="${fs}">${fmt(W * D)} m²</text>`);
      if (flags.diag) o.push(`<text class="gp-t halo" x="${l.cx}" y="${l.cz + fs * 2.4}" text-anchor="middle" font-size="${fs * 0.9}">d = ${fmt(Math.hypot(W, D))} m</text>`);
      dim(l.cx - l.w / 2, l.cz - l.d / 2 - 1.7, l.cx + l.w / 2, l.cz - l.d / 2 - 1.7, `${fmt(l.w)} m`);
      dim(l.cx - l.w / 2 - 1.5, l.cz - l.d / 2, l.cx - l.w / 2 - 1.5, l.cz + l.d / 2, `${fmt(l.d)} m`);
    });
    // Uylar orasidagi eng qisqa masofalar (har juftlik uchun)
    pairs(L).forEach(p => {
      if (p.gap <= 0) return;
      const [x1, z1, x2, z2] = footNearest(L[p.i], L[p.j]), bad = p.gap < FIRE_GAP ? " bad" : "";
      o.push(`<line class="gp-dim gap${bad}" x1="${x1}" y1="${z1}" x2="${x2}" y2="${z2}"/><circle class="gp-pt${bad}" cx="${x1}" cy="${z1}" r="${tk * 0.45}"/><circle class="gp-pt${bad}" cx="${x2}" cy="${z2}" r="${tk * 0.45}"/>`);
      o.push(`<text class="gp-t gap halo${bad}" x="${(x1 + x2) / 2 + fs * 0.3}" y="${(z1 + z2) / 2 - fs * 0.35}" font-size="${fs}">${fmt(p.gap)} m</text>`);
    });
    dim(px0, pz0 + pd + st + 2.4, px0 + pw, pz0 + pd + st + 2.4, `${fmt(pw)} m`);
    dim(px0 - 2.4, pz0, px0 - 2.4, pz0 + pd, `${fmt(pd)} m`);

    const nx = px0 + pw - 1.6, nz = pz0 - 3.2;                          // shimol belgisi (old fasad janubga qaragan deb olingan)
    o.push(`<path class="gp-north" d="M${nx} ${nz - 1.8} L${nx + 0.9} ${nz + 0.9} L${nx} ${nz + 0.3} L${nx - 0.9} ${nz + 0.9} Z"/><text class="gp-t" x="${nx}" y="${nz - 2.3}" text-anchor="middle" font-size="${fs}">N</text>`);
    const sx0 = px0, sz0 = pz0 - 3;                                    // masshtab chizig'i: 5 m
    o.push(`<line class="gp-dim" x1="${sx0}" y1="${sz0}" x2="${sx0 + 5}" y2="${sz0}"/><line class="gp-dim" x1="${sx0}" y1="${sz0 - tk * .5}" x2="${sx0}" y2="${sz0 + tk * .5}"/><line class="gp-dim" x1="${sx0 + 5}" y1="${sz0 - tk * .5}" x2="${sx0 + 5}" y2="${sz0 + tk * .5}"/><text class="gp-t" x="${sx0 + 2.5}" y="${sz0 - fs * 0.35}" text-anchor="middle" font-size="${fs}">5 m</text>`);

    const yc = Y
      ? `<label class="gp-chk"><input type="checkbox" data-gy="on" checked> Hovli</label>` +
        `<label class="gp-sel">To'siq <select data-gy="fence">${Object.entries(FENCES).map(([k, v]) => `<option value="${k}"${k === Y.fence ? " selected" : ""}>${v}</option>`).join("")}</select></label>` +
        `<label class="gp-rng">Chekinish <input type="range" min="2" max="20" step="1" value="${Y.margin}" data-gy="margin" aria-label="Binolardan to'siqqacha, m"><output>${Y.margin} m</output></label>`
      : `<label class="gp-chk"><input type="checkbox" data-gy="on"> Hovli qo'shish</label>`;
    const bar = `<div class="gp-bar">${n > 1 ? `<span class="muted">Uyni sudrab ko'chiring</span>` : ""}${yc}<span class="sp"></span>` +
      (n > 1 ? `<button type="button" class="btn-ghost" data-gp="rot">↻ ${active + 1}-uyni 90° burish</button><button type="button" class="btn-ghost" data-gp="row">Qatorga tizish</button>` : "") + `</div>`;
    const sel = Y && ysel >= 0 && Y.items[ysel];
    const ybar = Y ? `<div class="gp-bar gp-ybar"><span class="muted">Hovliga:</span>` +
      Object.entries(YARD_ITEMS).map(([k, v]) => `<button type="button" class="btn-ghost" data-yadd="${k}"${Y.items.length >= YARD_MAX_ITEMS ? " disabled" : ""}>+ ${v.label}</button>`).join("") +
      `<span class="sp"></span>` + (sel ? `<b>${YARD_ITEMS[sel.t].label}</b><button type="button" class="btn-ghost" data-yact="rot" title="90° burish">↻</button><button type="button" class="btn-ghost" data-yact="del">O'chirish</button>`
                                         : `<span class="muted">Elementni bosib tanlang, sudrab suring</span>`) + `</div>` : "";
    return bar + ybar + `<svg class="gp" viewBox="${vx} ${vz} ${vw} ${vd}" role="img" aria-label="Bosh reja: ${n} ta uy${Y ? `, hovli ${Y.items.length} ta element bilan` : ""}, uchastka ${fmt(pw)} × ${fmt(pd)} m">${o.join("")}</svg>`;
  }

  // ---------- Panelni yangilash ----------
  const el = id => document.getElementById(id);
  const rowHTML = r => `<div class="crow${r.tone ? " " + r.tone : ""}"><span class="ck">${esc(r.k)}</span><code class="cf">${esc(r.f)}</code><b class="cv">${esc(r.v)}${r.u ? `<small> ${esc(r.u)}</small>` : ""}</b></div>`;

  function renderBoq(list) {
    const box = el("boqBody");
    if (!box) return;
    if (!Object.keys(G.catalog).length) { box.innerHTML = `<p class="muted">Mahsulotlar katalogi yuklanmoqda…</p>`; return; }
    const lines = boq(list), total = lines.reduce((s, l) => s + l.total, 0);
    G.lastBoq = lines;
    box.innerHTML = `
      <div class="boq-head">
        <h3>Materiallar smetasi${list.length > 1 ? ` · ${list.length} ta uy` : ""}</h3>
        <div class="boq-actions">
          <button type="button" class="btn-ghost" data-boq="cart">Savatga qo'shish</button>
          <button type="button" class="btn-ghost" data-boq="csv">CSV (Excel)</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="boq-t">
          <thead><tr><th>Mahsulot</th><th class="num">Miqdor</th><th class="num">Narx</th><th class="num">Jami</th></tr></thead>
          <tbody>${lines.map(l => `<tr><td>${esc(l.name)}</td><td class="num">${n0(l.qty)} ${esc(l.unit)}</td><td class="num">$${n0(l.price)}</td><td class="num">$${n0(l.total)}</td></tr>`).join("")}</tbody>
          <tfoot><tr><td colspan="3">Jami materiallar va elementlar</td><td class="num">$${n0(total)}</td></tr></tfoot>
        </table>
      </div>
      <p class="muted boq-msg" id="boqMsg" role="status"></p>`;
  }

  const G = {
    flags, PHI, building, site, facade, plan, measure, boq, boqCsv, openingArea,
    catalog: {},                 // mahsulotlar: id -> {name, unit, price, ...} (shop.js to'ldiradi)
    lastBoq: [],
    lastLayout: [],
    onChange: null,
    // layout: Site.layout() natijasi (eski chaqiruvlarda son — qatordagi oraliq)
    update(list, layout, active, yard) {
      const body = el("calcBody"), pl = el("geoPlan");
      if (!body || !pl || !list.length) return;
      const b = list[Math.min(active, list.length - 1)], L = Array.isArray(layout) ? layout : siteLayout(list, Number(layout) || 10);
      G.lastLayout = L;
      const ysel = typeof Site !== "undefined" ? Site.ysel : -1;
      pl.innerHTML = plan(list, L, active, drag && drag.vb, yard, ysel);
      const groups = [...building(b.params, b.cells), ...site(list, L, yard)];
      if (el("calcNote")) el("calcNote").textContent = list.length > 1 ? `${active + 1}-uy hisobi` : "Uy hisobi";
      body.innerHTML = groups.map(g => `<section class="cg"><h3>${esc(g.title)}</h3>${g.rows.map(rowHTML).join("")}</section>`).join("");
      renderBoq(list);
    },
  };

  // ---- Bosh rejada uyni yoki hovli elementini sudrash, burish, hovli sozlamalari (Site — majmua holati) ----
  let drag = null;
  const svgPt = (svg, e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  document.addEventListener("pointerdown", e => {
    const t = e.target.closest && e.target.closest("#geoPlan .gp-b.drag, #geoPlan .gp-y");
    if (!t || typeof Site === "undefined") return;
    e.preventDefault();
    const svg = t.ownerSVGElement, pt = svgPt(svg, e), vb = svg.getAttribute("viewBox").split(" ").map(Number);
    if (t.dataset.yi !== undefined) {
      const k = Number(t.dataset.yi), it = Site.yard.items[k]; if (!it) return;
      drag = { kind: "y", i: k, id: e.pointerId, dx: pt.x - it.x, dz: pt.y - it.z, vb };
      if (Site.ysel !== k) { Site.ysel = k; G.onChange && G.onChange(); }
    } else {
      const i = Number(t.dataset.bi), l = G.lastLayout[i];
      drag = { kind: "b", i, id: e.pointerId, dx: pt.x - l.cx, dz: pt.y - l.cz, vb };
      if (i !== Site.active) Site.select(i);
    }
    document.documentElement.classList.add("gp-dragging");
  });
  document.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const svg = document.querySelector("#geoPlan svg"); if (!svg) return;
    const pt = svgPt(svg, e);
    if (drag.kind === "y") Site.moveItem(drag.i, pt.x - drag.dx, pt.y - drag.dz);
    else Site.move(drag.i, pt.x - drag.dx, pt.y - drag.dz);
  });
  const endDrag = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    drag = null; document.documentElement.classList.remove("gp-dragging");
    G.onChange && G.onChange();                  // ko'rinish (viewBox) yangi joylashuvga moslashadi
  };
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-gp],[data-yadd],[data-yact]");
    if (!b || typeof Site === "undefined") return;
    const flash = (txt, back) => { b.textContent = txt; setTimeout(() => { if (b.isConnected) b.textContent = back; }, 1600); };
    if (b.dataset.gp === "rot" && !Site.rotate(Site.active)) flash("Burishga joy yetmaydi", `↻ ${Site.active + 1}-uyni 90° burish`);
    if (b.dataset.gp === "row") { Site.arrange(); Site.onChange && Site.onChange(); }
    if (b.dataset.yadd && !Site.addItem(b.dataset.yadd)) flash("Bo'sh joy yo'q", `+ ${YARD_ITEMS[b.dataset.yadd].label}`);
    if (b.dataset.yact === "rot" && !Site.rotItem(Site.ysel)) flash("Joy yetmaydi", "↻");
    if (b.dataset.yact === "del") Site.delItem(Site.ysel);
  });
  // Hovli sozlamalari: slayder qo'yib yuborilganda qo'llanadi (chizma qayta yaratilganda sudrash uzilmasin)
  document.addEventListener("change", e => {
    const t = e.target.closest && e.target.closest("[data-gy]");
    if (!t || typeof Site === "undefined") return;
    const k = t.dataset.gy;
    Site.setYard(k === "on" ? { on: t.checked } : k === "fence" ? { fence: t.value } : { margin: Number(t.value) });
  });
  document.addEventListener("input", e => {
    const t = e.target.closest && e.target.closest('[data-gy="margin"]');
    if (t && t.nextElementSibling) t.nextElementSibling.textContent = `${t.value} m`;
  });

  // Smeta tugmalari: savatga qo'shish va CSV yuklab olish
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-boq]");
    if (!btn) return;
    const msg = el("boqMsg"), lines = G.lastBoq;
    if (!lines.length) return;
    if (btn.dataset.boq === "cart" && typeof Shop !== "undefined") {
      Shop.addMany(lines.map(l => [l.id, l.qty]));
      if (msg) msg.textContent = `${lines.length} ta mahsulot savatga qo'shildi. "Mahsulotlar" bo'limida buyurtma bering.`;
    }
    if (btn.dataset.boq === "csv" && window.saveFile) {
      window.saveFile("smeta.csv", G.boqCsv(lines)).then(() => { if (msg) msg.textContent = "Smeta CSV fayl sifatida saqlandi."; }, () => {});
    }
  });

  // Katakchalar: holati saqlanadi, o'zgarsa konstruktor qayta chizadi
  [["geoAxes", "axes"], ["geoDiag", "diag"], ["geoGolden", "golden"], ["geoAngles", "angles"]].forEach(([id, key]) => {
    const box = el(id);
    if (!box) return;
    box.checked = !!flags[key];
    box.addEventListener("change", () => {
      flags[key] = box.checked;
      try { localStorage.setItem("ustun-geo", JSON.stringify(flags)); } catch {}
      G.onChange && G.onChange();
    });
  });
  return G;
})();
