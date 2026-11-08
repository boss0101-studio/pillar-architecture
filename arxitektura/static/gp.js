// GP — Bosh reja (arxitektura bo'limi): joriy loyihaning bosh reja varag'i (A3, 420×297 mm).
// Chizma: uchastka chegarasi, qizil chiziq va ko'cha, binolar (shtrix, raqam, qavat, ±0.000), hovli — maysa, yo'lak, daraxt,
// to'siq va darvoza, o'lchamlar, shimol ko'rsatkichi; o'ngda — binolar ekspliktsiyasi, TEP va shartli belgilar; pastda — shtamp.
// Ma'lumot: web'da Site (Konstruktor), server sahifasida — Konstruktor qoralamasi ("ustun-draft"). Masshtab o'zi tanlanadi.
// Varaq har doim oq qog'ozda (chop etish va eksport bir xil chiqishi uchun), ranglar SVG ichida yozilgan.
const UstunGP = (function () {
  const SCALES = [100, 200, 250, 500, 1000, 2000];
  const SW = 420, SH = 297, ZONE = { x: 25, y: 10, w: 262, h: 222 };   // varaq va chizma maydoni, mm
  const SETBACK = 5, STREET = 10;
  const INK = "#1f2326", RED = "#c62828", GREEN = "#d6ead0", GREEN_L = "#5e8f4a", PAVE = "#e3ded3", HATCH = "#5d6468";
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n0 = v => Math.round(v).toLocaleString("ru-RU"), n1 = v => (Math.round(v * 10) / 10).toLocaleString("ru-RU"), n2 = v => (Math.round(v * 100) / 100).toLocaleString("ru-RU");
  const CAT = { "turar-joy": "Turar-joy binosi", jamoat: "Jamoat binosi", tijorat: "Tijorat binosi", interyer: "Bino" };
  const opts = { grid: true, dims: true, addr: "" };
  try { Object.assign(opts, JSON.parse(localStorage.getItem("ustun-gp") || "{}")); } catch {}
  const saveOpts = () => { try { localStorage.setItem("ustun-gp", JSON.stringify(opts)); } catch {} };

  // ---------- Loyiha ma'lumoti ----------
  function project() {
    if (window.Site && Site.list && Site.list.length) {
      Site.sync();
      const name = ($("dName") && $("dName").value.trim()) || "";
      return { list: Site.list.map(b => ({ params: b.params })), gap: Site.gap, yard: Site.yard, name };
    }
    try {                                                              // server sahifasi: Konstruktor qoralamasi
      const d = JSON.parse(localStorage.getItem("ustun-draft") || "null");
      const bs = d && Array.isArray(d.buildings) && d.buildings.length ? d.buildings : d && d.params ? [{ params: d.params }] : [];
      const clean = p => (window.ProjectIO && ProjectIO.cleanParams ? ProjectIO.cleanParams(p) : { ...DEFAULT_PARAMS, ...p });
      return { list: bs.slice(0, 3).map(b => ({ params: clean(b.params || {}), pos: b.pos })), gap: Number(d.gap) || 10, yard: typeof cleanYard === "function" ? cleanYard(d.yard) : null, name: String(d.name || "").slice(0, 80) };
    } catch { return { list: [] }; }
  }
  // Bino plani (dunyo koordinatalarida): shakl halqalari burilish bilan (3D bilan bir xil: rotation.y = rot)
  function footprint(p, l) {
    const th = (l.rot * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
    const tr = ([x, z]) => { const lx = x - l.W / 2, lz = z - l.D / 2; return [l.cx + lx * cs + lz * sn, l.cz - lx * sn + lz * cs]; };
    const rings = shapeOf(p) !== "rect" ? planShape(p).rings : [[[0, 0], [l.W, 0], [l.W, l.D], [0, l.D]]];
    return { rings: rings.map(r => r.map(tr)), area: shapeOf(p) !== "rect" ? planShape(p).area : l.W * l.D };
  }

  // ---------- Hisob: TEP ----------
  function compute(pr) {
    const L = siteLayout(pr.list, pr.gap), Y = pr.yard && pr.yard.on ? pr.yard : null;
    const bb = { x0: Math.min(...L.map(l => l.cx - l.w / 2)), x1: Math.max(...L.map(l => l.cx + l.w / 2)), z0: Math.min(...L.map(l => l.cz - l.d / 2)), z1: Math.max(...L.map(l => l.cz + l.d / 2)) };
    const R = Y ? yardRect(L, Y) : { x0: bb.x0 - SETBACK, x1: bb.x1 + SETBACK, z0: bb.z0 - SETBACK, z1: bb.z1 + SETBACK, gx: (bb.x0 + bb.x1) / 2, gw: 4 };
    const pw = R.x1 - R.x0, pd = R.z1 - R.z0, plot = pw * pd;
    const B = pr.list.map((b, i) => { const m = metrics(b.params, {}), f = footprint(b.params, L[i]); return { p: b.params, l: L[i], fp: f, foot: f.area, total: m.totalArea, H: L[i].H }; });
    const built = B.reduce((s, b) => s + b.foot, 0), total = B.reduce((s, b) => s + b.total, 0), volume = B.reduce((s, b) => s + b.foot * b.H, 0);
    const path = Y ? yardPath(L, R) : null, pathA = path ? path.w * (path.z1 - path.z0) : 0;
    const items = Y ? Y.items : [];
    const hardItems = items.filter(i => !YARD_GREEN.includes(i.t)).reduce((s, i) => s + YARD_ITEMS[i.t].w * YARD_ITEMS[i.t].d, 0);
    const otmostka = B.reduce((s, b) => s + 2 * (b.l.w + b.l.d) * 0.8, 0);   // bino atrofidagi 0,8 m otmostka
    const hard = hardItems + pathA + otmostka, green = Math.max(0, plot - built - hard);
    const fence = Y && Y.fence !== "yoq" ? 2 * (pw + pd) - YARD_GATE : 0;
    return { L, R, B, Y, path, pw, pd, plot, built, total, volume, hard, green, fence, trees: items.filter(i => ["tree", "fruit", "pine"].includes(i.t)).length };
  }

  // ---------- Varaq (SVG) ----------
  function sheet(pr, c) {
    const scale = SCALES.find(s => c.pw * 1000 / s <= ZONE.w - 16 && (c.pd + STREET + 3) * 1000 / s <= ZONE.h - 16) || SCALES[SCALES.length - 1];
    const k = 1000 / scale, cw = c.pw * k, ch = (c.pd + STREET) * k;
    const ox = ZONE.x + (ZONE.w - cw) / 2, oy = ZONE.y + (ZONE.h - ch) / 2 + 4;
    const X = x => ox + (x - c.R.x0) * k, Z = z => oy + (z - c.R.z0) * k;
    const o = [], T = (x, y, s, size = 2.6, a = "middle", extra = "") => o.push(`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size}" text-anchor="${a}"${extra}>${esc(s)}</text>`);
    const poly = (pts, attrs) => `<polygon points="${pts.map(([x, z]) => `${X(x).toFixed(2)},${Z(z).toFixed(2)}`).join(" ")}" ${attrs}/>`;

    // to'r (har 10 m)
    if (opts.grid) {
      let g = "";
      for (let x = Math.ceil(c.R.x0 / 10) * 10; x <= c.R.x1; x += 10) g += `M${X(x).toFixed(2)} ${Z(c.R.z0).toFixed(2)}V${Z(c.R.z1).toFixed(2)}`;
      for (let z = Math.ceil(c.R.z0 / 10) * 10; z <= c.R.z1; z += 10) g += `M${X(c.R.x0).toFixed(2)} ${Z(z).toFixed(2)}H${X(c.R.x1).toFixed(2)}`;
      o.push(`<path d="${g}" stroke="#c9cfd3" stroke-width="0.12" fill="none"/>`);
    }
    // maysa (butun uchastka), ko'cha va yo'lak
    o.push(`<rect x="${X(c.R.x0)}" y="${Z(c.R.z0)}" width="${cw}" height="${c.pd * k}" fill="${GREEN}" fill-opacity=".55"/>`);
    const sy = Z(c.R.z1);
    o.push(`<rect x="${(ox - 6).toFixed(2)}" y="${(sy + 2 * k).toFixed(2)}" width="${(cw + 12).toFixed(2)}" height="${(7 * k).toFixed(2)}" fill="#bfc3c6"/>`);
    o.push(`<rect x="${(ox - 6).toFixed(2)}" y="${sy.toFixed(2)}" width="${(cw + 12).toFixed(2)}" height="${(2 * k).toFixed(2)}" fill="${PAVE}" stroke="${INK}" stroke-width="0.15"/>`);
    o.push(`<path d="M${(ox - 6).toFixed(2)} ${(sy + 5.5 * k).toFixed(2)}H${(ox + cw + 6).toFixed(2)}" stroke="#fff" stroke-width="0.35" stroke-dasharray="3 2"/>`);
    T(ox + cw / 2, sy + 6.2 * k, "Ko'cha", Math.max(2.4, 1.6 * k), "middle", ` font-style="italic" fill="${INK}"`);
    if (c.path) o.push(`<rect x="${X(c.path.x - c.path.w / 2)}" y="${Z(c.path.z0)}" width="${c.path.w * k}" height="${(c.path.z1 - c.path.z0) * k}" fill="${PAVE}" stroke="${INK}" stroke-width="0.12"/>`);
    // hovli elementlari
    if (c.Y) c.Y.items.forEach(it => {
      const f = itemFoot(it), x = X(f.cx), z = Z(f.cz), w = f.w * k, d = f.d * k;
      if (["tree", "fruit", "pine", "bush"].includes(it.t)) o.push(`<circle cx="${x.toFixed(2)}" cy="${z.toFixed(2)}" r="${(Math.min(w, d) / 2).toFixed(2)}" fill="#8fbf74" stroke="${GREEN_L}" stroke-width="0.2"/><circle cx="${x.toFixed(2)}" cy="${z.toFixed(2)}" r="0.35" fill="${GREEN_L}"/>`);
      else if (it.t === "bed") o.push(`<rect x="${(x - w / 2).toFixed(2)}" y="${(z - d / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${d.toFixed(2)}" rx="0.6" fill="#f2b6c6" stroke="${GREEN_L}" stroke-width="0.15"/>`);
      else if (["pool", "swim", "fountain"].includes(it.t)) o.push(`<rect x="${(x - w / 2).toFixed(2)}" y="${(z - d / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${d.toFixed(2)}" rx="${it.t === "fountain" ? (w / 2).toFixed(2) : 0.4}" fill="#9fd0ea" stroke="${INK}" stroke-width="0.15"/>`);
      else o.push(`<rect x="${(x - w / 2).toFixed(2)}" y="${(z - d / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${d.toFixed(2)}" fill="${PAVE}" stroke="${INK}" stroke-width="0.15"/>`);
    });
    // binolar: otmostka, shtrixlangan plan, raqam va qavatlar
    c.B.forEach((b, i) => {
      const ring = b.fp.rings[0], cx = X(b.l.cx), cz = Z(b.l.cz);
      o.push(poly(ring, `fill="none" stroke="${INK}" stroke-width="${(1.6 * k).toFixed(2)}" stroke-opacity=".18" stroke-linejoin="round"`));   // otmostka
      o.push(`<path d="${b.fp.rings.map(r => "M" + r.map(([x, z]) => `${X(x).toFixed(2)} ${Z(z).toFixed(2)}`).join("L") + "Z").join("")}" fill="url(#gpHatch)" fill-rule="evenodd" stroke="${INK}" stroke-width="0.5"/>`);
      const r = Math.max(2.2, Math.min(4, Math.min(b.l.w, b.l.d) * k * 0.18));
      o.push(`<circle cx="${cx.toFixed(2)}" cy="${cz.toFixed(2)}" r="${r.toFixed(2)}" fill="#fff" stroke="${INK}" stroke-width="0.35"/>`);
      T(cx, cz + r * 0.38, String(i + 1), r * 1.05, "middle", ` font-weight="700" fill="${INK}"`);
      T(cx, cz + r + 3.2, `${b.p.floors} q.`, 2.4, "middle", ` fill="${INK}"`);
      T(X(b.l.cx + b.l.w / 2) - 1, Z(b.l.cz - b.l.d / 2) - 1, "±0.000", 1.9, "end", ` fill="${INK}"`);
    });
    // uchastka chegarasi (shtrix-punktir), qizil chiziq, to'siq va darvoza
    o.push(`<rect x="${X(c.R.x0)}" y="${Z(c.R.z0)}" width="${cw}" height="${c.pd * k}" fill="none" stroke="${INK}" stroke-width="0.5" stroke-dasharray="6 1.5 1 1.5"/>`);
    o.push(`<path d="M${(ox - 4).toFixed(2)} ${sy.toFixed(2)}H${(ox + cw + 4).toFixed(2)}" stroke="${RED}" stroke-width="0.6"/>`);
    T(ox + cw + 4, sy - 1, "qizil chiziq", 2, "end", ` fill="${RED}"`);
    if (c.Y && c.Y.fence !== "yoq") {
      const g0 = X(c.R.gx - c.R.gw / 2), g1 = X(c.R.gx + c.R.gw / 2);
      o.push(`<path d="M${g0.toFixed(2)} ${sy.toFixed(2)}H${X(c.R.x0)}V${Z(c.R.z0)}H${X(c.R.x1)}V${sy.toFixed(2)}H${g1.toFixed(2)}" fill="none" stroke="${INK}" stroke-width="0.35" stroke-dasharray="2 0.8"/>`);
      o.push(`<path d="M${((g0 + g1) / 2).toFixed(2)} ${(sy + 4).toFixed(2)}v-5.5m-1.4 1.8l1.4 -1.8l1.4 1.8" fill="none" stroke="${INK}" stroke-width="0.4"/>`);   // kirish
    }
    // o'lchamlar: uchastka eni va bo'yi, oldingi bino chekinishi
    if (opts.dims) {
      const dm = (x0, y0, x1, y1, label, rot) => {
        o.push(`<path d="M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}" stroke="${INK}" stroke-width="0.18"/>`);
        [[x0, y0], [x1, y1]].forEach(([x, y]) => o.push(`<path d="M${(x - 0.9).toFixed(2)} ${(y + 0.9).toFixed(2)}l1.8 -1.8" stroke="${INK}" stroke-width="0.3"/>`));
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        T(mx + (rot ? -1 : 0), my - (rot ? 0 : 1), label, 2.3, "middle", rot ? ` transform="rotate(-90 ${(mx - 1).toFixed(2)} ${my.toFixed(2)})" fill="${INK}"` : ` fill="${INK}"`);
      };
      const top = Z(c.R.z0) - 5, left = X(c.R.x0) - 5;
      dm(X(c.R.x0), top, X(c.R.x1), top, `${n1(c.pw)}`);
      dm(left, Z(c.R.z0), left, Z(c.R.z1), `${n1(c.pd)}`, true);
      const fr = c.B.reduce((a, b) => (b.l.cz + b.l.d / 2 > a.l.cz + a.l.d / 2 ? b : a), c.B[0]), fz = fr.l.cz + fr.l.d / 2;
      if (c.R.z1 - fz > 0.5) dm(X(fr.l.cx + fr.l.w / 2) + 3, Z(fz), X(fr.l.cx + fr.l.w / 2) + 3, Z(c.R.z1), n1(c.R.z1 - fz), true);
    }
    // shimol ko'rsatkichi
    const nx = ZONE.x + ZONE.w - 10, ny = ZONE.y + 12;
    o.push(`<g fill="${INK}" stroke="${INK}" stroke-width="0.3"><circle cx="${nx}" cy="${ny}" r="6" fill="none"/><path d="M${nx} ${ny - 6}L${nx + 2.4} ${ny + 4}L${nx} ${ny + 2}L${nx - 2.4} ${ny + 4}Z"/></g>`);
    T(nx, ny - 7.5, "Sh", 2.8, "middle", ` font-weight="700" fill="${INK}"`);

    // ---------- O'ng panel: ekspliktsiya, TEP, shartli belgilar ----------
    const px = 292, pw = 123;
    let y = ZONE.y + 4;
    const tbl = (title, head, rows, cols) => {
      T(px + pw / 2, y + 3, title, 3, "middle", ` font-weight="700" fill="${INK}"`); y += 5;
      const rh = 5.2, all = head ? [head, ...rows] : rows;
      o.push(`<rect x="${px}" y="${y}" width="${pw}" height="${(all.length * rh).toFixed(2)}" fill="none" stroke="${INK}" stroke-width="0.35"/>`);
      let cx = px; cols.forEach((w, j) => { if (j) o.push(`<path d="M${cx} ${y}v${(all.length * rh).toFixed(2)}" stroke="${INK}" stroke-width="0.2"/>`); cx += w; });
      all.forEach((r, ri) => {
        if (ri) o.push(`<path d="M${px} ${(y + ri * rh).toFixed(2)}h${pw}" stroke="${INK}" stroke-width="${ri === 1 && head ? 0.35 : 0.15}"/>`);
        let x = px; r.forEach((cell, j) => { T(j ? x + cols[j] / 2 : x + 1.2, y + ri * rh + 3.6, cell, ri === 0 && head ? 2.1 : 2.3, j ? "middle" : "start", ` fill="${INK}"${ri === 0 && head ? ' font-weight="700"' : ""}`); x += cols[j]; });
      });
      y += all.length * rh + 6;
    };
    tbl("Binolar ekspliktsiyasi", ["№", "Nomi", "Qavat", "Maydon, m²"], c.B.map((b, i) => [String(i + 1), (pr.name && c.B.length === 1 ? pr.name : CAT[b.p.category] || "Bino").slice(0, 26), String(b.p.floors), n0(b.total)]), [10, 71, 16, 26]);
    tbl("Texnik-iqtisodiy ko'rsatkichlar", ["Ko'rsatkich", "Birlik", "Miqdor"], [
      ["Uchastka maydoni", "m²", n0(c.plot)], ["Qurilish maydoni", "m²", n0(c.built)], ["Qurilish zichligi", "%", n1(c.built / c.plot * 100)],
      ["Qattiq qoplama", "m²", n0(c.hard)], ["Ko'kalamzorlashtirish", "m²", n0(c.green)], ["Ko'kalamzorlashtirish ulushi", "%", n1(c.green / c.plot * 100)],
      ["Binolar umumiy maydoni", "m²", n0(c.total)], ["Qavatlilik koeffitsienti", "—", n2(c.total / c.plot)], ["Qurilish hajmi", "m³", n0(c.volume)],
      ["Binolar soni", "dona", String(c.B.length)], ...(c.fence ? [["To'siq uzunligi", "m", n1(c.fence)]] : []), ...(c.trees ? [["Daraxtlar", "dona", String(c.trees)]] : []),
    ], [73, 18, 32]);
    T(px + pw / 2, y + 3, "Shartli belgilar", 3, "middle", ` font-weight="700" fill="${INK}"`); y += 6;
    const lg = (sym, label) => { o.push(sym(px + 1, y)); T(px + 16, y + 2.6, label, 2.3, "start", ` fill="${INK}"`); y += 5.4; };
    lg((x, yy) => `<path d="M${x} ${yy + 1.8}h12" stroke="${INK}" stroke-width="0.5" stroke-dasharray="6 1.5 1 1.5"/>`, "Uchastka chegarasi");
    lg((x, yy) => `<path d="M${x} ${yy + 1.8}h12" stroke="${RED}" stroke-width="0.6"/>`, "Qizil chiziq");
    lg((x, yy) => `<rect x="${x}" y="${yy}" width="12" height="3.6" fill="url(#gpHatch)" stroke="${INK}" stroke-width="0.4"/>`, "Loyihalanayotgan bino");
    lg((x, yy) => `<rect x="${x}" y="${yy}" width="12" height="3.6" fill="${PAVE}" stroke="${INK}" stroke-width="0.15"/>`, "Qattiq qoplama, yo'lak");
    lg((x, yy) => `<rect x="${x}" y="${yy}" width="12" height="3.6" fill="${GREEN}" stroke="${GREEN_L}" stroke-width="0.15"/>`, "Maysa (ko'kalamzor)");
    lg((x, yy) => `<circle cx="${x + 6}" cy="${yy + 1.8}" r="1.8" fill="#8fbf74" stroke="${GREEN_L}" stroke-width="0.2"/>`, "Daraxt, buta");
    if (c.Y && c.Y.fence !== "yoq") lg((x, yy) => `<path d="M${x} ${yy + 1.8}h12" stroke="${INK}" stroke-width="0.35" stroke-dasharray="2 0.8"/>`, `To'siq: ${FENCES[c.Y.fence] || ""}`);

    // ---------- Ramka va shtamp (185×55) ----------
    const sx = SW - 5 - 185, sy0 = SH - 5 - 55, date = new Date().toLocaleDateString("ru-RU");
    o.push(`<rect x="20" y="5" width="${SW - 25}" height="${SH - 10}" fill="none" stroke="${INK}" stroke-width="0.7"/>`);
    o.push(`<rect x="${sx}" y="${sy0}" width="185" height="55" fill="#fff" stroke="${INK}" stroke-width="0.7"/>`);
    o.push(`<path d="M${sx} ${sy0 + 15}h185M${sx} ${sy0 + 30}h185M${sx + 70} ${sy0 + 30}v25M${sx + 120} ${sy0 + 30}v25M${sx + 120} ${sy0 + 42}h65M${sx + 140} ${sy0 + 30}v25M${sx + 160} ${sy0 + 30}v25" stroke="${INK}" stroke-width="0.4" fill="none"/>`);
    T(sx + 92.5, sy0 + 9.5, (pr.name || "Loyiha").slice(0, 60), 4.2, "middle", ` font-weight="700" fill="${INK}"`);
    T(sx + 92.5, sy0 + 23.5, opts.addr ? opts.addr.slice(0, 70) : "Manzil: —", 3.2, "middle", ` fill="${INK}"`);
    T(sx + 35, sy0 + 41, "Bosh reja", 5, "middle", ` font-weight="700" fill="${INK}"`);
    T(sx + 35, sy0 + 48.5, `M 1:${scale}`, 3, "middle", ` fill="${INK}"`);
    T(sx + 95, sy0 + 39, "Pillar Architecture", 3, "middle", ` fill="${INK}"`);
    T(sx + 95, sy0 + 46.5, `Sana: ${date}`, 2.6, "middle", ` fill="${INK}"`);
    [["Bosqich", "P"], ["Varaq", "1"], ["Varaqlar", "1"]].forEach(([h, v], i) => {
      T(sx + 130 + i * 20, sy0 + 36.8, h, 2.1, "middle", ` fill="${INK}"`); T(sx + 130 + i * 20, sy0 + 50, v, 3.4, "middle", ` font-weight="700" fill="${INK}"`);
    });
    T(SW - 8, 10.5, "GP-1", 4, "end", ` font-weight="700" fill="${INK}"`);

    return `<svg class="gp-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW}mm" height="${SH}mm" font-family="Arial Narrow, Arial, sans-serif" role="img" aria-label="Bosh reja (GP), M 1:${scale}">
      <defs><pattern id="gpHatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#f3f1ec"/><path d="M0 0V1.6" stroke="${HATCH}" stroke-width="0.35"/></pattern></defs>
      <rect width="${SW}" height="${SH}" fill="#fff"/>${o.join("")}</svg>`;
  }

  // ---------- Bo'lim ----------
  let lastSvg = "";
  function render() {
    const box = $("gpApp"); if (!box) return;
    const pr = project();
    if (!pr.list.length) { box.innerHTML = `<p class="empty">Avval Konstruktorda bino loyihalang — bosh reja shu loyihadan chiziladi.</p>`; return; }
    const c = compute(pr);
    lastSvg = sheet(pr, c);
    const web = typeof showView === "function";
    box.innerHTML = `<div class="gp-bar">
        <label class="gp-f">Manzil<input type="text" data-gp="addr" maxlength="70" value="${esc(opts.addr)}" placeholder="Masalan: Toshkent sh., Mirobod tumani"></label>
        <label class="gp-chk"><input type="checkbox" data-gp="grid"${opts.grid ? " checked" : ""}> To'r (10 m)</label>
        <label class="gp-chk"><input type="checkbox" data-gp="dims"${opts.dims ? " checked" : ""}> O'lchamlar</label>
        <span class="sp"></span>
        <button type="button" class="btn-ghost" data-gpa="svg">SVG yuklab olish</button>
        <button type="button" class="btn-ghost" data-gpa="print">Chop etish / PDF</button>
        ${web ? `<a class="btn" href="#konstruktor" data-view="konstruktor">Konstruktorda o'zgartirish</a>` : `<a class="btn" href="designer.html">Konstruktorda o'zgartirish</a>`}
      </div>
      <div class="gp-sheet">${lastSvg}</div>
      <p class="muted gp-note">Bosh reja Konstruktordagi binolar, ularning joylashuvi va hovlidan avtomatik chiziladi. Hisoblar taxminiy: haqiqiy loyiha uchun topografik s'yomka va shaharsozlik talablari kerak.</p>`;
  }
  function download() {
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + lastSvg], { type: "image/svg+xml" });
    if (window.saveFile) { window.saveFile("bosh-reja-GP.svg", blob); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bosh-reja-GP.svg"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-gpa]"); if (!b) return;
    if (b.dataset.gpa === "svg") download();
    else if (b.dataset.gpa === "print") { document.documentElement.classList.add("gp-printing"); window.print(); setTimeout(() => document.documentElement.classList.remove("gp-printing"), 500); }
  });
  document.addEventListener("change", e => {
    const t = e.target.closest("[data-gp]"); if (!t) return;
    const k = t.dataset.gp; opts[k] = t.type === "checkbox" ? t.checked : t.value.trim().slice(0, 70); saveOpts(); render();
  });
  if (!(typeof showView === "function") && document.getElementById("gpApp")) {   // server sahifasi
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render); else render();
  }
  return { render, compute: () => compute(project()) };
})();
window.UstunGP = UstunGP;
