// AR — Arxitektura chizmalari: joriy binoning varaqlar to'plami (A3, 420×297 mm, har birida shtamp):
// AR-1 old fasad + deraza va eshiklar spetsifikatsiyasi; AR-2… har bir qavat rejasi (devorlar, eshik-derazalar, zina, mebel,
// o'qlar, o'lcham zanjirlari, xona raqami va maydoni, xonalar ekspliktsiyasi); oxirgisi — 1-1 kesim (poydevor, yopmalar, tom, sath belgilari).
// Ma'lumot: web'da Site (Konstruktor), server sahifasida — Konstruktor qoralamasi ("ustun-draft"). Masshtab har varaqda o'zi tanlanadi.
const UstunAR = (function () {
  const SW = 420, SH = 297, ZONE = { x: 25, y: 10, w: 262, h: 222 };
  const INK = "#1f2326", WALL = "#8e9499", PART = "#5d6468", FURN = "#9aa3a8", ACC = "#2b4acb";
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n1 = v => (Math.round(v * 10) / 10).toLocaleString("ru-RU"), n2 = v => (Math.round(v * 100) / 100).toLocaleString("ru-RU");
  const lvl = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(3);   // sath belgisi: +3.300
  const AXL = "ABVGDEJZIKLMNOPRSTUF";                                   // harfli o'qlar (A, B, V, G…)
  let sheetIdx = 0, houseIdx = 0, showFurn = true;

  // ---------- Loyiha ----------
  function project() {
    if (window.Site && Site.list && Site.list.length) {
      Site.sync();
      return { list: Site.list.map(b => ({ params: b.params, cells: b.cells || {}, interior: b.interior })), active: Site.active, name: ($("dName") && $("dName").value.trim()) || "" };
    }
    try {
      const d = JSON.parse(localStorage.getItem("ustun-draft") || "null");
      const bs = d && Array.isArray(d.buildings) && d.buildings.length ? d.buildings : d && d.params ? [{ params: d.params, cells: d.cells }] : [];
      const cp = p => (window.ProjectIO && ProjectIO.cleanParams ? ProjectIO.cleanParams(p) : { ...DEFAULT_PARAMS, ...p });
      const cc = (c, p) => (window.ProjectIO && ProjectIO.cleanCells ? ProjectIO.cleanCells(c || {}, p) : c || {});
      return { list: bs.slice(0, 3).map(b => { const p = cp(b.params || {}); return { params: p, cells: cc(b.cells, p), interior: b.interior }; }), active: Number(d.active) || 0, name: String(d.name || "").slice(0, 80) };
    } catch { return { list: [] }; }
  }

  // ---------- Varaq ramkasi va shtamp ----------
  function frame(o, pr, title, code, num, total, scale) {
    const T = (x, y, s, size, a = "middle", w = "") => o.push(`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${a}"${w ? ` font-weight="${w}"` : ""} fill="${INK}">${esc(s)}</text>`);
    const sx = SW - 5 - 185, sy = SH - 5 - 55;
    o.push(`<rect x="20" y="5" width="${SW - 25}" height="${SH - 10}" fill="none" stroke="${INK}" stroke-width="0.7"/>`);
    o.push(`<rect x="${sx}" y="${sy}" width="185" height="55" fill="#fff" stroke="${INK}" stroke-width="0.7"/>`);
    o.push(`<path d="M${sx} ${sy + 15}h185M${sx} ${sy + 30}h185M${sx + 70} ${sy + 30}v25M${sx + 120} ${sy + 30}v25M${sx + 120} ${sy + 42}h65M${sx + 140} ${sy + 30}v25M${sx + 160} ${sy + 30}v25" stroke="${INK}" stroke-width="0.4" fill="none"/>`);
    T(sx + 92.5, sy + 9.5, (pr.name || "Loyiha").slice(0, 60), 4.2, "middle", "700");
    T(sx + 92.5, sy + 23.5, "Arxitektura yechimlari (AR)", 3.2);
    T(sx + 35, sy + 40.5, title, title.length > 16 ? 3.6 : 4.6, "middle", "700");
    T(sx + 35, sy + 48.5, scale ? `M 1:${scale}` : "", 3);
    T(sx + 95, sy + 39, "Pillar Architecture", 3);
    T(sx + 95, sy + 46.5, `Sana: ${new Date().toLocaleDateString("ru-RU")}`, 2.6);
    [["Bosqich", "P"], ["Varaq", String(num)], ["Varaqlar", String(total)]].forEach(([h, v], i) => { T(sx + 130 + i * 20, sy + 36.8, h, 2.1); T(sx + 130 + i * 20, sy + 50, v, 3.4, "middle", "700"); });
    T(SW - 8, 10.5, code, 4, "end", "700");
    return T;
  }
  const wrap = o => `<svg class="ar-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW}mm" height="${SH}mm" font-family="Arial Narrow, Arial, sans-serif">
    <defs><pattern id="arHatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.2" height="1.2" fill="#d5d8db"/><path d="M0 0V1.2" stroke="${PART}" stroke-width="0.3"/></pattern></defs>
    <rect width="${SW}" height="${SH}" fill="#fff"/>${o.join("")}</svg>`;
  // Jadval (o'ng panel)
  function table(o, T, x, y, w, title, head, rows, cols) {
    T(x + w / 2, y + 3, title, 3, "middle", "700"); y += 5;
    const rh = 5, all = [head, ...rows];
    o.push(`<rect x="${x}" y="${y}" width="${w}" height="${all.length * rh}" fill="none" stroke="${INK}" stroke-width="0.35"/>`);
    let cx = x; cols.forEach((c, j) => { if (j) o.push(`<path d="M${cx} ${y}v${all.length * rh}" stroke="${INK}" stroke-width="0.2"/>`); cx += c; });
    all.forEach((r, i) => {
      if (i) o.push(`<path d="M${x} ${y + i * rh}h${w}" stroke="${INK}" stroke-width="${i === 1 ? 0.35 : 0.15}"/>`);
      let xx = x; r.forEach((cell, j) => { o.push(`<text x="${j ? xx + cols[j] / 2 : xx + 1.2}" y="${y + i * rh + 3.5}" font-size="${i ? 2.3 : 2.1}" text-anchor="${j ? "middle" : "start"}"${i ? "" : ' font-weight="700"'} fill="${INK}">${esc(cell)}</text>`); xx += cols[j]; });
    });
    return y + all.length * rh + 6;
  }

  // ---------- Deraza va eshiklar: turi, o'lchami, soni (rejadagi kabi: old fasad + orqa va yon devorlar) ----------
  function openings(p, cells) {
    const cnt = {}, add = (t, w, h) => { if (!OPENING[t]) return; const o = OPENING[t], k = `${t}|${n2((o[1] - o[0]) * w)}×${n2((o[3] - o[2]) * h)}`; cnt[k] = (cnt[k] || 0) + 1; };
    const sc = Math.max(1, Math.round(p.depth / p.bay_w)), sw = p.depth / sc;
    for (let f = 0; f < p.floors; f++) {
      for (let b = 0; b < p.bays; b++) { add(cellType(p, cells, f, b), p.bay_w, p.floor_h); add(upperType(p), p.bay_w, p.floor_h); }
      for (let c = 0; c < 2 * sc; c++) add(upperType(p), sw, p.floor_h);
    }
    return Object.entries(cnt).map(([k, n]) => { const [t, size] = k.split("|"); return [CELL_LABELS[t] || t, size, String(n), t]; })
      .sort((a, b) => (/door|garage|shop|arcade/.test(a[3]) ? 1 : 0) - (/door|garage|shop|arcade/.test(b[3]) ? 1 : 0));
  }

  // ---------- AR-1: old fasad ----------
  function facadeSheet(pr, b, num, total) {
    const o = [], p = b.params, T = frame(o, pr, "Old fasad", `AR-${num}`, num, total, 0);
    const svg = renderFacade(p, b.cells, { dims: true, uid: "ar" + num });
    const fw = 255, fh = 210;
    o.push(svg.replace(/^<svg\b/, `<svg x="${ZONE.x}" y="${ZONE.y + 4}" width="${fw}" height="${fh}" preserveAspectRatio="xMidYMid meet"`));
    T(ZONE.x + fw / 2, ZONE.y + 2, `Old fasad, 1–${p.bays + 1} o'qlar`, 3.4, "middle", "700");
    const rows = openings(p, b.cells).map(r => r.slice(0, 3));
    let y = table(o, T, 292, ZONE.y + 4, 123, "Deraza va eshiklar", ["Turi", "O'lcham, m", "Soni"], rows.length ? rows : [["—", "—", "0"]], [55, 40, 28]);
    const g = geometry(p);
    y = table(o, T, 292, y, 123, "Bino ko'rsatkichlari", ["Ko'rsatkich", "Birlik", "Miqdor"], [
      ["Qavatlar soni", "—", String(p.floors)], ["Qavat balandligi", "m", n2(p.floor_h)], ["Bino balandligi", "m", n2(g.H)],
      ["Eni × chuqurligi", "m", `${n1(g.W)} × ${n1(g.D)}`], ["Umumiy maydon", "m²", n1(metrics(p, b.cells).totalArea)],
      ["Fasad materiali", "—", (MATERIALS[p.material] || {}).label || p.material], ["Tom", "—", { tekis: "Tekis", nishab: "Nishab", bir: "Bir nishab", piramida: "Piramida", gumbaz: "Gumbaz", terrasa: "Terrasa" }[p.roof] || p.roof],
    ], [60, 18, 45]);
    return wrap(o);
  }

  // ---------- Xona nomi ichidagi mebeldan ----------
  const ROOM_BY = [["bed", "Yotoqxona"], ["kidsbed", "Bolalar xonasi"], ["cradle", "Bolalar xonasi"], ["kitchen", "Oshxona"], ["stove", "Oshxona"], ["bath", "Hammom"], ["shower", "Hammom"],
    ["toilet", "Sanuzel"], ["sofa", "Mehmonxona"], ["tv", "Mehmonxona"], ["dining", "Ovqatlanish xonasi"], ["desk", "Ish xonasi"], ["piano", "Mehmonxona"]];
  function roomName(cells, items, ig) {
    const inside = it => cells.some(([i, j]) => it[1] >= Interior.lineX(ig, i) && it[1] < Interior.lineX(ig, i + 1) && it[2] >= Interior.lineZ(ig, j) && it[2] < Interior.lineZ(ig, j + 1));
    const here = items.filter(inside).map(it => it[0]);
    const hit = ROOM_BY.find(([t]) => here.includes(t));
    return hit ? hit[1] : here.length ? "Xona" : "Dahliz";
  }

  // ---------- Qavat rejasi ----------
  function planSheet(pr, b, f, num, total) {
    const p = b.params, I = Interior.norm(p, b.interior || {}), ig = I.g, W = ig.W, D = ig.D, Tw = Interior.T, fd = I.floors[f];
    const scale = [50, 75, 100, 150, 200].find(s => W * 1000 / s <= ZONE.w - 50 && D * 1000 / s <= ZONE.h - 58) || 200, k = 1000 / scale;   // o'qlar va o'lchamlar uchun chetda ~25 mm
    const ox = ZONE.x + (ZONE.w - W * k) / 2, oy = ZONE.y + (ZONE.h - D * k) / 2 + 2;
    const X = x => +(ox + x * k).toFixed(2), Z = z => +(oy + z * k).toFixed(2);
    const o = [], T = frame(o, pr, `${f + 1}-qavat rejasi`, `AR-${num}`, num, total, scale);
    const rect = (r, attrs) => o.push(`<rect x="${X(r.x0)}" y="${Z(r.z0)}" width="${+((r.x1 - r.x0) * k).toFixed(2)}" height="${+((r.z1 - r.z0) * k).toFixed(2)}" ${attrs}/>`);
    // o'qlar (vertikal 1…n+1, gorizontal A, B …) va o'lcham zanjirlari
    const axX = [...Array(p.bays + 1).keys()].map(i => i * p.bay_w), axZ = [0, D];
    const rA = 3.2, top = Z(0) - 22, bot = Z(D) + 22, left = X(0) - 22;
    axX.forEach((x, i) => {
      o.push(`<path d="M${X(x)} ${top + rA}V${bot - rA}" stroke="${INK}" stroke-width="0.15" stroke-dasharray="8 1.5 1 1.5"/>`);
      [top, bot].forEach(y => { o.push(`<circle cx="${X(x)}" cy="${y}" r="${rA}" fill="#fff" stroke="${INK}" stroke-width="0.3"/>`); T(X(x), y + 1.2, String(i + 1), 3.2); });
    });
    axZ.forEach((z, i) => {
      o.push(`<path d="M${left + rA} ${Z(z)}H${X(W) + 12}" stroke="${INK}" stroke-width="0.15" stroke-dasharray="8 1.5 1 1.5"/>`);
      o.push(`<circle cx="${left}" cy="${Z(z)}" r="${rA}" fill="#fff" stroke="${INK}" stroke-width="0.3"/>`); T(left, Z(z) + 1.2, AXL[i], 3.2);
    });
    const dimH = (x0, x1, y, label) => {
      o.push(`<path d="M${X(x0)} ${y}H${X(x1)}" stroke="${INK}" stroke-width="0.18"/>`);
      [x0, x1].forEach(x => o.push(`<path d="M${X(x) - 0.8} ${y + 0.8}l1.6 -1.6M${X(x)} ${y - 2}v4" stroke="${INK}" stroke-width="0.25"/>`));
      T((X(x0) + X(x1)) / 2, y - 0.9, label, 2.3);
    };
    const dimV = (z0, z1, x, label) => {
      o.push(`<path d="M${x} ${Z(z0)}V${Z(z1)}" stroke="${INK}" stroke-width="0.18"/>`);
      [z0, z1].forEach(z => o.push(`<path d="M${x - 0.8} ${Z(z) + 0.8}l1.6 -1.6M${x - 2} ${Z(z)}h4" stroke="${INK}" stroke-width="0.25"/>`));
      o.push(`<text x="${x - 1}" y="${(Z(z0) + Z(z1)) / 2}" font-size="2.3" text-anchor="middle" fill="${INK}" transform="rotate(-90 ${x - 1} ${(Z(z0) + Z(z1)) / 2})">${esc(label)}</text>`);
    };
    axX.slice(1).forEach((x, i) => dimH(axX[i], x, Z(D) + 8, n2(p.bay_w)));
    dimH(0, W, Z(D) + 14, n2(W));
    dimV(0, D, X(0) - 10, n2(D));
    // mebel (ixtiyoriy) — devorlar ostida
    if (showFurn) fd.items.forEach(it => {
      const d = Interior.ITEMS[it[0]]; if (!d || d.m) return;
      const r = Interior.itemRect(it); rect(r, `fill="none" stroke="${FURN}" stroke-width="0.18"${it[0] === "carpet" ? ' stroke-dasharray="1 0.8"' : ""}`);
    });
    // xonalar: raqam va maydon
    const rooms = Interior.roomsOf(ig, fd.e).list.map(cells => {
      const area = cells.reduce((s, [i, j]) => s + Interior.cellArea(ig, i, j), 0);
      const cx = cells.reduce((s, [i]) => s + (Interior.lineX(ig, i) + Interior.lineX(ig, i + 1)) / 2, 0) / cells.length;
      const cz = cells.reduce((s, [, j]) => s + (Interior.lineZ(ig, j) + Interior.lineZ(ig, j + 1)) / 2, 0) / cells.length;
      return { area, cx, cz, name: roomName(cells, fd.items, ig) };
    }).filter(r => r.area >= 0.8).sort((a, b) => a.cz - b.cz || a.cx - b.cx);
    // tashqi devorlar (shtrix bilan)
    const ring = r => "M" + r.map(([x, z]) => `${X(x)} ${Z(z)}`).join("L") + "Z";
    if (ig.outer) o.push(`<path d="${ig.outer.map(ring).join("")}${ig.inner.map(ring).join("")}" fill="url(#arHatch)" fill-rule="evenodd" stroke="${INK}" stroke-width="0.45"/>`);
    else o.push(`<path d="M${X(0)} ${Z(0)}H${X(W)}V${Z(D)}H${X(0)}Z M${X(Tw)} ${Z(Tw)}V${Z(D - Tw)}H${X(W - Tw)}V${Z(Tw)}Z" fill="url(#arHatch)" fill-rule="evenodd" stroke="${INK}" stroke-width="0.45"/>`);
    // tashqi devordagi deraza va eshiklar (to'rtburchak planda)
    if (!ig.outer) {
      const mark = (type, a0, cw, horiz, fix, outSide) => {
        const op = OPENING[type]; if (!op) return;
        const s = a0 + op[0] * cw, len = (op[1] - op[0]) * cw, door = /door|garage|shop|arcade/.test(type);
        const r = horiz ? { x0: s, x1: s + len, z0: fix, z1: fix + Tw } : { x0: fix, x1: fix + Tw, z0: s, z1: s + len };
        rect(r, `fill="#fff" stroke="${INK}" stroke-width="0.25"`);
        if (!door) {                                                    // deraza: rom chiziqlari
          const m = horiz ? `M${X(r.x0)} ${Z(fix + Tw / 2)}H${X(r.x1)}` : `M${X(fix + Tw / 2)} ${Z(r.z0)}V${Z(r.z1)}`;
          o.push(`<path d="${m}" stroke="${ACC}" stroke-width="0.3"/>`);
        } else if (type !== "arcade" && type !== "shop") {              // eshik: tabaqa va ochilish yoyi (ichkariga)
          const L = len * k, hx = X(r.x0), hz = outSide ? Z(fix) : Z(fix + Tw);
          if (horiz) o.push(`<path d="M${hx} ${hz}v${outSide ? -L : L}M${hx} ${hz + (outSide ? -L : L)}A${L} ${L} 0 0 ${outSide ? 1 : 0} ${hx + L} ${hz}" fill="none" stroke="${INK}" stroke-width="0.2"/>`);
        }
      };
      for (let bb = 0; bb < p.bays; bb++) { mark(cellType(p, b.cells, f, bb), bb * p.bay_w, p.bay_w, true, D - Tw, true); mark(upperType(p), bb * p.bay_w, p.bay_w, true, 0, false); }
      const sc = Math.max(1, Math.round(D / p.bay_w)), sw = D / sc;
      for (let c = 0; c < sc; c++) { mark(upperType(p), c * sw, sw, false, 0); mark(upperType(p), c * sw, sw, false, W - Tw); }
    }
    // ichki devorlar va eshiklar
    for (const [key, state] of Object.entries(fd.e)) {
      const seg = Interior.edgeSeg(ig, key); if (!seg) continue;
      const wp = Interior.wallPieces(seg, state);
      wp.walls.forEach(r => rect(r, `fill="${PART}" stroke="${INK}" stroke-width="0.15"`));
      if (wp.lintel) {
        const r = wp.lintel, L = (seg.horiz ? r.x1 - r.x0 : r.z1 - r.z0) * k;
        if (seg.horiz) o.push(`<path d="M${X(r.x0)} ${Z(r.z1)}v${L}M${X(r.x0)} ${Z(r.z1) + L}A${L} ${L} 0 0 0 ${X(r.x1)} ${Z(r.z1)}" fill="none" stroke="${INK}" stroke-width="0.18"/>`);
        else o.push(`<path d="M${X(r.x1)} ${Z(r.z0)}h${L}M${X(r.x1) + L} ${Z(r.z0)}A${L} ${L} 0 0 1 ${X(r.x1)} ${Z(r.z1)}" fill="none" stroke="${INK}" stroke-width="0.18"/>`);
      }
    }
    // zina
    if (I.stair && p.floors > 1) {
      const st = Interior.stairInfo(p, I.stair, ig), r = st.rect, n = st.n, along = !!st.dir[1];
      rect(r, `fill="#fff" stroke="${INK}" stroke-width="0.3"`);
      let d = "";
      for (let i = 1; i < n; i++) d += along ? `M${X(r.x0)} ${Z(r.z0 + (r.z1 - r.z0) * i / n)}H${X(r.x1)}` : `M${X(r.x0 + (r.x1 - r.x0) * i / n)} ${Z(r.z0)}V${Z(r.z1)}`;
      o.push(`<path d="${d}" stroke="${INK}" stroke-width="0.15"/>`);
      T((X(r.x0) + X(r.x1)) / 2, (Z(r.z0) + Z(r.z1)) / 2 + 1, f < p.floors - 1 ? "Zina ↑" : "Zina", 2.4, "middle", "700");
    }
    // xona yorliqlari
    rooms.forEach((r, i) => {
      const x = X(r.cx), y = Z(r.cz);
      o.push(`<circle cx="${x}" cy="${y - 2}" r="2.4" fill="#fff" stroke="${INK}" stroke-width="0.3"/>`);
      T(x, y - 1, String(i + 1), 2.6, "middle", "700");
      T(x, y + 3.6, n1(r.area), 2.5); o.push(`<path d="M${x - 3} ${y + 4.4}h6" stroke="${INK}" stroke-width="0.2"/>`);
    });
    T(X(0) + 1, Z(0) - 3, lvl(f * p.floor_h), 2.4, "start");
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, `${f + 1}-qavat rejasi`, 3.6, "middle", "700");
    // ekspliktsiya
    const sum = rooms.reduce((s, r) => s + r.area, 0);
    let y = table(o, T, 292, ZONE.y + 4, 123, `Xonalar ekspliktsiyasi (${f + 1}-qavat)`, ["№", "Xona nomi", "Maydon, m²"],
      [...rooms.map((r, i) => [String(i + 1), r.name, n1(r.area)]), ["", "Jami", n1(sum)]], [12, 81, 30]);
    if (!b.interior) T(292, y + 2, "Ichki reja yo'q: Konstruktor → Ichki makon → Avto reja.", 2.3, "start");
    return wrap(o);
  }

  // ---------- 1-1 kesim (bino chuqurligi bo'ylab) ----------
  function sectionSheet(pr, b, num, total) {
    const p = b.params, g = geometry(p), D = p.depth, N = p.floors, fh = p.floor_h, H = g.H, Hb = N * fh, Tw = Interior.T, SL = 0.22, FD = 1.2;
    const scale = [50, 75, 100, 150, 200, 300].find(s => (D + 10) * 1000 / s <= ZONE.w - 40 && (H + FD + 4) * 1000 / s <= ZONE.h - 30) || 300, k = 1000 / scale;
    const ox = ZONE.x + (ZONE.w - D * k) / 2, gy = ZONE.y + ZONE.h - 22 - FD * k;     // gy — ±0.000 sathi
    const X = z => +(ox + z * k).toFixed(2), Y = h => +(gy - h * k).toFixed(2);
    const o = [], T = frame(o, pr, "1-1 kesim", `AR-${num}`, num, total, scale);
    o.push(`<path d="M${X(-4)} ${Y(-0.15)}H${X(D + 4)}" stroke="${INK}" stroke-width="0.6"/>`);    // yer sathi
    o.push(`<rect x="${X(-4)}" y="${Y(-0.15)}" width="${(D + 8) * k}" height="${(FD + 0.4) * k}" fill="#efe9dc"/>`);
    [[0, Tw], [D - Tw, D]].forEach(([z0, z1]) => {
      o.push(`<rect x="${X(z0 - 0.15)}" y="${Y(0)}" width="${(z1 - z0 + 0.3) * k}" height="${FD * k}" fill="url(#arHatch)" stroke="${INK}" stroke-width="0.35"/>`);   // poydevor
      o.push(`<rect x="${X(z0)}" y="${Y(Hb)}" width="${(z1 - z0) * k}" height="${Hb * k}" fill="url(#arHatch)" stroke="${INK}" stroke-width="0.45"/>`);        // devor
    });
    for (let f = 0; f <= N; f++) {                                       // yopmalar va sath belgilari
      const h = f * fh;
      if (f > 0) o.push(`<rect x="${X(Tw)}" y="${Y(h)}" width="${(D - 2 * Tw) * k}" height="${SL * k}" fill="#c4c8cc" stroke="${INK}" stroke-width="0.3"/>`);
      else o.push(`<rect x="${X(Tw)}" y="${Y(0.06)}" width="${(D - 2 * Tw) * k}" height="${0.15 * k}" fill="#c4c8cc" stroke="${INK}" stroke-width="0.3"/>`);
      const mx = X(D) + 10, my = Y(h);
      o.push(`<path d="M${X(D)} ${my}H${mx + 12}M${mx - 1.6} ${my - 1.6}L${mx} ${my}L${mx + 1.6} ${my - 1.6}" fill="none" stroke="${INK}" stroke-width="0.25"/>`);
      T(mx + 2, my - 1.2, lvl(h), 2.4, "start");
    }
    // tom
    const roofT = { tekis: "flat", terrasa: "flat" }[p.roof] || p.roof;
    if (roofT === "flat") {
      o.push(`<rect x="${X(0)}" y="${Y(Hb + 0.9)}" width="${Tw * k}" height="${0.9 * k}" fill="url(#arHatch)" stroke="${INK}" stroke-width="0.35"/><rect x="${X(D - Tw)}" y="${Y(Hb + 0.9)}" width="${Tw * k}" height="${0.9 * k}" fill="url(#arHatch)" stroke="${INK}" stroke-width="0.35"/>`);
    } else if (p.roof === "gumbaz") {
      const r = D / 2 - Tw, cy = Y(Hb);
      o.push(`<path d="M${X(Tw)} ${cy}A${r * k} ${Math.max(0.5, H - Hb) * k} 0 0 1 ${X(D - Tw)} ${cy}" fill="none" stroke="${INK}" stroke-width="0.6"/>`);
    } else if (p.roof === "bir") {
      o.push(`<path d="M${X(-0.4)} ${Y(Hb)}L${X(D + 0.4)} ${Y(H)}" fill="none" stroke="${INK}" stroke-width="0.7"/>`);
    } else {
      o.push(`<path d="M${X(-0.5)} ${Y(Hb - 0.1)}L${X(D / 2)} ${Y(H)}L${X(D + 0.5)} ${Y(Hb - 0.1)}" fill="none" stroke="${INK}" stroke-width="0.7"/>`);
      o.push(`<path d="M${X(Tw)} ${Y(Hb)}H${X(D - Tw)}" stroke="${INK}" stroke-width="0.3" stroke-dasharray="1.5 1"/>`);
    }
    if (H > Hb + 0.05) { const mx = X(D) + 10, my = Y(H); o.push(`<path d="M${X(D / 2)} ${my}H${mx + 12}" stroke="${INK}" stroke-width="0.2" stroke-dasharray="1 1"/>`); T(mx + 2, my - 1.2, lvl(H), 2.4, "start"); }
    // balandlik o'lchamlari (chapda) va o'qlar
    const dx = X(0) - 9;
    for (let f = 0; f < N; f++) {
      o.push(`<path d="M${dx} ${Y(f * fh)}V${Y((f + 1) * fh)}" stroke="${INK}" stroke-width="0.18"/><path d="M${dx - 2} ${Y(f * fh)}h4M${dx - 2} ${Y((f + 1) * fh)}h4" stroke="${INK}" stroke-width="0.25"/>`);
      o.push(`<text x="${dx - 1}" y="${(Y(f * fh) + Y((f + 1) * fh)) / 2}" font-size="2.3" text-anchor="middle" fill="${INK}" transform="rotate(-90 ${dx - 1} ${(Y(f * fh) + Y((f + 1) * fh)) / 2})">${n2(fh)}</text>`);
    }
    [[0, "A"], [D, "B"]].forEach(([z, l]) => { o.push(`<path d="M${X(z)} ${Y(-FD) + 2}V${Y(-FD) + 10}" stroke="${INK}" stroke-width="0.15" stroke-dasharray="4 1 1 1"/><circle cx="${X(z)}" cy="${Y(-FD) + 13}" r="3" fill="#fff" stroke="${INK}" stroke-width="0.3"/>`); T(X(z), Y(-FD) + 14.2, l, 3); });
    o.push(`<path d="M${X(0)} ${Y(-FD) + 7}H${X(D)}" stroke="${INK}" stroke-width="0.18"/>`); T((X(0) + X(D)) / 2, Y(-FD) + 6, n2(D), 2.4);
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "1-1 kesim", 3.6, "middle", "700");
    table(o, T, 292, ZONE.y + 4, 123, "Konstruksiyalar", ["Element", "Qiymat"], [
      ["Tashqi devor qalinligi", `${Tw * 1000} mm`], ["Ichki devor qalinligi", `${Interior.PART * 1000} mm`], ["Yopma qalinligi", `${SL * 1000} mm`],
      ["Poydevor chuqurligi", `${n2(FD)} m`], ["Qavat balandligi", `${n2(fh)} m`], ["Bino balandligi", `${n2(H)} m`],
    ], [80, 43]);
    return wrap(o);
  }

  // ---------- Bo'lim ----------
  function sheetsFor(pr) {
    const b = pr.list[Math.min(houseIdx, pr.list.length - 1)], N = b.params.floors, total = N + 2;
    const list = [{ t: "Old fasad", make: () => facadeSheet(pr, b, 1, total) }];
    for (let f = 0; f < N; f++) list.push({ t: `${f + 1}-qavat rejasi`, make: () => planSheet(pr, b, f, f + 2, total) });
    list.push({ t: "1-1 kesim", make: () => sectionSheet(pr, b, total, total) });
    return list;
  }
  let current = "";
  function render() {
    const box = $("arApp"); if (!box) return;
    const pr = project();
    if (!pr.list.length) { box.innerHTML = `<p class="empty">Avval Konstruktorda bino loyihalang — arxitektura chizmalari shu loyihadan chiziladi.</p>`; return; }
    if (houseIdx >= pr.list.length) houseIdx = Math.min(pr.active || 0, pr.list.length - 1);
    const sheets = sheetsFor(pr); sheetIdx = Math.min(sheetIdx, sheets.length - 1);
    current = sheets[sheetIdx].make();
    const web = typeof showView === "function";
    box.innerHTML = `<div class="gp-bar ar-bar">
        ${pr.list.length > 1 ? `<div class="ar-tabs" role="tablist" aria-label="Uylar">${pr.list.map((_, i) => `<button type="button" role="tab" data-arh="${i}" aria-selected="${i === houseIdx}">${i + 1}-uy</button>`).join("")}</div>` : ""}
        <div class="ar-tabs" role="tablist" aria-label="Varaqlar">${sheets.map((s, i) => `<button type="button" role="tab" data-ars="${i}" aria-selected="${i === sheetIdx}"><b>AR-${i + 1}</b> ${esc(s.t)}</button>`).join("")}</div>
        <label class="gp-chk"><input type="checkbox" data-arf${showFurn ? " checked" : ""}> Mebel</label>
        <span class="sp"></span>
        <button type="button" class="btn-ghost" data-ara="svg">SVG yuklab olish</button>
        <button type="button" class="btn-ghost" data-ara="print">Hammasini chop etish / PDF</button>
        ${web ? `<a class="btn" href="#konstruktor" data-view="konstruktor">Konstruktorda o'zgartirish</a>` : `<a class="btn" href="designer.html">Konstruktorda o'zgartirish</a>`}
      </div>
      <div class="gp-sheet ar-sheet">${current}</div>
      <div class="ar-print" aria-hidden="true"></div>
      <p class="muted gp-note">Chizmalar Konstruktordagi bino, fasad kataklari va ichki rejadan avtomatik tuziladi. Eskiz loyiha bosqichi uchun: ishchi chizmalarda konstruktor hisobi va tafsilotlar kerak.</p>`;
  }
  function download() {
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + current], { type: "image/svg+xml" }), name = `AR-${sheetIdx + 1}.svg`;
    if (window.saveFile) { window.saveFile(name, blob); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function printAll() {
    const pr = project(), box = document.querySelector(".ar-print"); if (!box) return;
    box.innerHTML = sheetsFor(pr).map(s => `<div class="ar-page">${s.make()}</div>`).join("");
    document.documentElement.classList.add("ar-printing"); window.print();
    setTimeout(() => { document.documentElement.classList.remove("ar-printing"); box.innerHTML = ""; }, 800);
  }
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-ars],[data-arh],[data-ara]"); if (!t) return;
    if (t.dataset.ars) { sheetIdx = Number(t.dataset.ars); render(); }
    else if (t.dataset.arh) { houseIdx = Number(t.dataset.arh); sheetIdx = 0; render(); }
    else if (t.dataset.ara === "svg") download();
    else if (t.dataset.ara === "print") printAll();
  });
  document.addEventListener("change", e => { if (e.target.closest("[data-arf]")) { showFurn = e.target.checked; render(); } });
  if (!(typeof showView === "function") && document.getElementById("arApp")) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render); else render();
  }
  return { render, sheets: () => sheetsFor(project()).map(s => s.t) };
})();
window.UstunAR = UstunAR;
