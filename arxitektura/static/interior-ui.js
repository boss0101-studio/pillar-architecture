// Ichki makonni loyihalash: yuqoridan reja ustida xona devorlari, eshiklar, mebel va zina.
// Ma'lumot Site.current().interior da turadi (Interior moduli shaklida), har bir o'zgarish Site.onChange orqali 3D va hisoblarga o'tadi.
const InteriorUI = (function () {
  const el = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const f1 = v => (Math.round(v * 10) / 10).toLocaleString("ru-RU");
  const T = Interior.T, ITEMS = Interior.ITEMS;
  const ov = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;
  const snap = (v, s) => Math.round(v / s) * s;
  const r2 = v => Math.round(v * 100) / 100;
  const clone = o => JSON.parse(JSON.stringify(o));

  let fl = 0, tool = "select", sel = null, lastActive = -1;
  let undo = [], redo = [], drag = null, painting = null, failMsg = "";

  // ---------- Tekshiruvlar: mebel devor yoki zinaga kirib ketmasin ----------
  function wallRects(ig, e) {
    const out = [];
    for (const [k, s] of Object.entries(e)) { const seg = Interior.edgeSeg(ig, k); if (seg) Interior.wallPieces(seg, s).walls.forEach(r => out.push(r)); }
    return out;
  }
  const stairRect = (p, I) => (I.stair && p.floors > 1 ? Interior.stairInfo(p, I.stair, I.g).rect : null);
  function itemOK(I, p, f, it, skip) {
    const ig = I.g, r = Interior.itemRect(it);
    if (r.x0 < T - 1e-6 || r.x1 > ig.W - T + 1e-6 || r.z0 < T - 1e-6 || r.z1 > ig.D - T + 1e-6) return false;
    const sr = stairRect(p, I);
    if (sr && it[0] !== "carpet" && ov(r, sr)) return false;
    const fd = I.floors[f];
    if (wallRects(ig, fd.e).some(w => ov(r, w))) return false;
    return fd.items.every((o, i) => i === skip || o[0] === "carpet" || it[0] === "carpet" || !ov(r, Interior.itemRect(o)));
  }
  function edgeOK(I, p, f, key) {
    const seg = Interior.edgeSeg(I.g, key); if (!seg) return false;
    const r = Interior.wallPieces(seg, 1).walls[0], sr = stairRect(p, I);
    if (sr && ov(r, sr)) return false;
    return I.floors[f].items.every(o => o[0] === "carpet" || !ov(r, Interior.itemRect(o)));
  }
  function stairOK(I, p, st) {
    if (!Interior.fitsStair(p, I.g, st)) return false;
    const r = Interior.stairInfo(p, st, I.g).rect;
    return I.floors.every(fd => !wallRects(I.g, fd.e).some(w => ov(r, w)) && fd.items.every(o => o[0] === "carpet" || !ov(r, Interior.itemRect(o))));
  }

  // ---------- Xonalar: to'rdagi kataklarni devorlar bo'yicha guruhlash ----------
  function rooms(ig, e) {
    const seen = new Set(), out = [], key = (i, j) => i + "," + j;
    const cw = i => Math.min(Interior.lineX(ig, i + 1), ig.W - T) - Math.max(Interior.lineX(ig, i), T);
    const ch = j => Math.min(Interior.lineZ(ig, j + 1), ig.D - T) - Math.max(Interior.lineZ(ig, j), T);
    for (let i0 = 0; i0 < ig.gw; i0++) for (let j0 = 0; j0 < ig.gd; j0++) {
      if (seen.has(key(i0, j0))) continue;
      const q = [[i0, j0]], cells = []; seen.add(key(i0, j0));
      while (q.length) {
        const [i, j] = q.pop(); cells.push([i, j]);
        const nb = [[i + 1, j, `v:${i + 1},${j}`], [i - 1, j, `v:${i},${j}`], [i, j + 1, `h:${i},${j + 1}`], [i, j - 1, `h:${i},${j}`]];
        for (const [a, b, k] of nb) if (a >= 0 && b >= 0 && a < ig.gw && b < ig.gd && !e[k] && !seen.has(key(a, b))) { seen.add(key(a, b)); q.push([a, b]); }
      }
      const area = cells.reduce((s, [i, j]) => s + cw(i) * ch(j), 0);
      const cx = cells.reduce((s, [i]) => s + (Interior.lineX(ig, i) + Interior.lineX(ig, i + 1)) / 2, 0) / cells.length;
      const cz = cells.reduce((s, [, j]) => s + (Interior.lineZ(ig, j) + Interior.lineZ(ig, j + 1)) / 2, 0) / cells.length;
      out.push({ area, cx, cz, cells });
    }
    return out;
  }

  // ---------- O'zgartirish va tarix ----------
  const snapJson = b => JSON.stringify(b.interior === undefined ? null : b.interior);
  function current() { Site.sync(); const b = Site.current(); return { b, p: b.params }; }
  // fn(int, p, I): int — tahrirlanadigan nusxa; false qaytarsa o'zgarmaydi. quiet — tarixga yozilmaydi (sudrash paytida)
  function mutate(fn, quiet) {
    const { b, p } = current(), before = snapJson(b);
    const int = Interior.editable(p, b.interior || {});
    const I = Interior.norm(p, int);
    if (fn(int, p, I) === false) return false;
    if (b.interior && Array.isArray(b.interior.floors)) int.floors.push(...clone(b.interior.floors.slice(p.floors)));   // kamaytirilgan qavatlar ma'lumoti saqlanadi
    if (JSON.stringify(int) === before) return false;
    if (!quiet) { undo.push(before); if (undo.length > 80) undo.shift(); redo = []; }
    b.interior = int;
    Site.onChange && Site.onChange();
    return true;
  }
  function setRaw(json) { const { b } = current(); const v = JSON.parse(json); b.interior = v === null ? undefined : v; Site.onChange && Site.onChange(); }
  function doUndo() { if (!undo.length) return; const { b } = current(); redo.push(snapJson(b)); setRaw(undo.pop()); }
  function doRedo() { if (!redo.length) return; const { b } = current(); undo.push(snapJson(b)); setRaw(redo.pop()); }
  function fail(t) { failMsg = t; render(); setTimeout(() => { if (failMsg === t) { failMsg = ""; render(); } }, 1800); }

  // ---------- Amallar ----------
  function startAuto() { const { b, p } = current(), before = snapJson(b); undo.push(before); redo = []; b.interior = Interior.auto(p); sel = null; Site.onChange && Site.onChange(); }
  function startBlank() { const { b, p } = current(), before = snapJson(b); undo.push(before); redo = []; b.interior = Interior.editable(p, {}); sel = null; Site.onChange && Site.onChange(); }
  function removeAll() { const { b } = current(); undo.push(snapJson(b)); redo = []; b.interior = undefined; sel = null; Site.onChange && Site.onChange(); }
  function clearFloor() { mutate(int => { int.floors[fl] = { e: {}, items: [] }; }); sel = null; }
  function copyFloor() { mutate(int => { int.floors.forEach((_, f) => { if (f !== fl) int.floors[f] = clone(int.floors[fl]); }); }); }
  function placeItem(type, x, z) {
    const ok = mutate((int, p, I) => {
      const it = [type, r2(snap(x, 0.25)), r2(snap(z, 0.25)), 0];
      if (!itemOK(I, p, fl, it, -1) || int.floors[fl].items.length >= 80) return false;
      int.floors[fl].items.push(it); sel = { k: "item", i: int.floors[fl].items.length - 1 };
    });
    if (!ok) fail("Bu yerga joylab bo'lmaydi");
  }
  function applyEdge(key, mode, quiet) {
    return mutate((int, p, I) => {
      const e = int.floors[fl].e;
      if (mode === 0) { if (!e[key]) return false; delete e[key]; }
      else { if (e[key] === mode || !edgeOK(I, p, fl, key)) return false; e[key] = mode; }
    }, quiet);
  }
  function rotSel() {
    if (!sel) return;
    const ok = mutate((int, p, I) => {
      if (sel.k === "item") {
        const it = int.floors[fl].items[sel.i]; if (!it) return false;
        const t = [it[0], it[1], it[2], (it[3] + 1) % 4];
        if (!itemOK(I, p, fl, t, sel.i)) return false;
        int.floors[fl].items[sel.i] = t;
      } else {
        if (!int.stair) return false;
        const st = [int.stair[0], int.stair[1], (int.stair[2] + 1) % 4];
        if (!stairOK(I, p, st)) return false;
        int.stair = st;
      }
    });
    if (!ok) fail("Burishga joy yetmaydi");
  }
  function delSel() {
    if (!sel) return;
    mutate(int => {
      if (sel.k === "item") int.floors[fl].items.splice(sel.i, 1); else int.stair = null;
    });
    sel = null; render();
  }
  function placeStair(x, z) {
    const ok = mutate((int, p, I) => {
      const st = [r2(snap(x, 0.5)), r2(snap(z, 0.5)), int.stair ? int.stair[2] : 0];
      if (!stairOK(I, p, st)) return false;
      int.stair = st;
    });
    if (ok) sel = { k: "stair" }; else fail("Zina bu yerga sig'maydi");
  }

  // ---------- Chizma ----------
  function openingsSvg(p, cells, f, ig) {
    const out = [], W = ig.W, D = ig.D;
    const mark = (type, a0, cwid, horiz, fix, flip) => {
      const o = typeof OPENING !== "undefined" ? OPENING[type] : null; if (!o) return;
      const s = a0 + o[0] * cwid, len = (o[1] - o[0]) * cwid, cls = type === "door" || type === "arcade" ? "io-door" : "io-win";
      out.push(horiz ? `<rect class="${cls}" x="${s}" y="${fix}" width="${len}" height="${T}"/>` : `<rect class="${cls}" x="${fix}" y="${s}" width="${T}" height="${len}"/>`);
    };
    for (let b = 0; b < p.bays; b++) {
      mark(cellType(p, cells, f, b), b * p.bay_w, p.bay_w, true, D - T);          // old fasad (pastda)
      mark(upperType(p), b * p.bay_w, p.bay_w, true, 0);                          // orqa devor
    }
    const sc = Math.max(1, Math.round(D / p.bay_w)), sw = D / sc;
    for (let c = 0; c < sc; c++) { mark(upperType(p), c * sw, sw, false, 0); mark(upperType(p), c * sw, sw, false, W - T); }
    return out.join("");
  }
  function itemSvg(it, k, selected) {
    const d = ITEMS[it[0]], r = Interior.itemRect(it), rot = (it[3] | 0) % 4;
    const fx = [[0, 1], [1, 0], [0, -1], [-1, 0]][rot];                          // old tomon (ko'rinish yo'nalishi)
    const cx = it[1], cz = it[2], fs = Math.min(0.3, Math.min(r.w, r.d) * 0.4);
    const front = `<line class="ip-front" x1="${cx + fx[0] * r.w * 0.18}" y1="${cz + fx[1] * r.d * 0.18}" x2="${cx + fx[0] * r.w * 0.5}" y2="${cz + fx[1] * r.d * 0.5}"/>`;
    return `<g class="ip-it${selected ? " sel" : ""}" data-i="${k}"><rect x="${r.x0}" y="${r.z0}" width="${r.w}" height="${r.d}" fill="${d.c}"${it[0] === "carpet" ? ' fill-opacity=".55"' : ""}/>${it[0] === "carpet" ? "" : front}` +
      (r.w >= 0.6 && r.d >= 0.6 ? `<text x="${cx}" y="${cz + fs * 0.35}" text-anchor="middle" font-size="${fs}">${esc(d.n)}</text>` : "") + `<title>${esc(d.n)}</title></g>`;
  }
  function planSvg(p, cells, I) {
    const ig = I.g, W = ig.W, D = ig.D, pad = 1, N = p.floors, fd = I.floors[fl], o = [];
    const rs = rooms(ig, fd.e);
    rs.forEach((r, i) => r.cells.forEach(([a, b]) => {
      const x0 = Interior.lineX(ig, a), x1 = Interior.lineX(ig, a + 1), z0 = Interior.lineZ(ig, b), z1 = Interior.lineZ(ig, b + 1);
      o.push(`<rect class="io-room" style="fill:hsl(${(i * 47 + 190) % 360} 45% 55% / .16)" x="${x0}" y="${z0}" width="${x1 - x0}" height="${z1 - z0}"/>`);
    }));
    let grid = "";
    for (let i = 1; i < ig.gw; i++) grid += `M${i} ${T}V${D - T}`;
    for (let j = 1; j < ig.gd; j++) grid += `M${T} ${j}H${W - T}`;
    o.push(`<path class="io-grid" d="${grid}"/>`);
    o.push(`<path class="io-outer" d="M0 0H${W}V${D}H0Z M${T} ${T}V${D - T}H${W - T}V${T}Z" fill-rule="evenodd"/>`);
    o.push(openingsSvg(p, cells, fl, ig));
    for (const [k, s] of Object.entries(fd.e)) {
      const seg = Interior.edgeSeg(ig, k); if (!seg) continue;
      Interior.wallPieces(seg, s).walls.forEach(r => o.push(`<rect class="io-wall" x="${r.x0}" y="${r.z0}" width="${r.x1 - r.x0}" height="${r.z1 - r.z0}"/>`));
      if (s === 2) {                                                              // eshik: ochilish yoyi
        const ow = Math.min(Interior.DOOR_W, (seg.horiz ? seg.x1 - seg.x0 : seg.z1 - seg.z0) - 0.1);
        if (seg.horiz) { const c = (seg.x0 + seg.x1) / 2, z = seg.z0, h = c - ow / 2; o.push(`<path class="io-swing" d="M${h} ${z}V${z + ow}M${c + ow / 2} ${z}A${ow} ${ow} 0 0 1 ${h} ${z + ow}"/>`); }
        else { const c = (seg.z0 + seg.z1) / 2, x = seg.x0, h = c - ow / 2; o.push(`<path class="io-swing" d="M${x} ${h}H${x + ow}M${x} ${c + ow / 2}A${ow} ${ow} 0 0 0 ${x + ow} ${h}"/>`); }
      }
    }
    // zina (oxirgi qavatda — faqat pastdan chiqish teshigi, shtrix bilan)
    if (N > 1 && I.stair) {
      const si = Interior.stairInfo(p, I.stair, ig), r = si.rect, top = fl === N - 1, sl = sel && sel.k === "stair";
      let steps = "";
      if (!top) for (let i = 1; i < si.n; i++) {
        const t = -si.L / 2 + i * (si.L / si.n);
        steps += si.dir[0] ? `M${si.center.x + t} ${r.z0}V${r.z1}` : `M${r.x0} ${si.center.z + t}H${r.x1}`;
      }
      const a = [si.center.x - si.dir[0] * si.L * 0.3, si.center.z - si.dir[1] * si.L * 0.3, si.center.x + si.dir[0] * si.L * 0.3, si.center.z + si.dir[1] * si.L * 0.3];
      o.push(`<g class="ip-st${top ? " ghost" : ""}${sl ? " sel" : ""}" data-st="1"><rect x="${r.x0}" y="${r.z0}" width="${r.x1 - r.x0}" height="${r.z1 - r.z0}"/><path class="ip-steps" d="${steps}"/>` +
        (top ? "" : `<path class="ip-arrow" d="M${a[0]} ${a[1]}L${a[2]} ${a[3]}"/><circle cx="${a[0]}" cy="${a[1]}" r=".12"/>`) + `<title>Zina</title></g>`);
    }
    fd.items.forEach((it, k) => o.push(itemSvg(it, k, sel && sel.k === "item" && sel.i === k)));
    rs.forEach(r => o.push(`<text class="io-area" x="${r.cx}" y="${r.cz}" text-anchor="middle" font-size=".55">${f1(r.area)} m²</text>`));
    if (["wall", "door", "erase"].includes(tool)) {                              // devor asboblarida har bir qirra bosiladigan zona
      for (let a = 0; a < ig.gw; a++) for (let b = 1; b < ig.gd; b++) {
        const k = `h:${a},${b}`, s = Interior.edgeSeg(ig, k);
        if (s) o.push(`<rect class="ie" data-e="${k}" x="${s.x0}" y="${s.z0 - 0.28}" width="${s.x1 - s.x0}" height=".56"/>`);
      }
      for (let a = 1; a < ig.gw; a++) for (let b = 0; b < ig.gd; b++) {
        const k = `v:${a},${b}`, s = Interior.edgeSeg(ig, k);
        if (s) o.push(`<rect class="ie" data-e="${k}" x="${s.x0 - 0.28}" y="${s.z0}" width=".56" height="${s.z1 - s.z0}"/>`);
      }
    }
    o.push(`<text class="io-lbl" x="${W / 2}" y="${-0.35}" text-anchor="middle" font-size=".6">${f1(W)} m</text><text class="io-lbl" x="${-0.35}" y="${D / 2}" text-anchor="middle" font-size=".6" transform="rotate(-90 ${-0.35} ${D / 2})">${f1(D)} m</text>`);
    o.push(`<text class="io-lbl" x="${W / 2}" y="${D + 0.75}" text-anchor="middle" font-size=".55">▼ OLD FASAD (ko'cha)</text>`);
    return `<svg viewBox="${-pad} ${-pad} ${W + 2 * pad} ${D + 2 * pad}" role="img" aria-label="${fl + 1}-qavat ichki rejasi, ${rs.length} ta xona">${o.join("")}</svg>`;
  }

  function render() {
    const body = el("intBody"); if (!body || typeof Site === "undefined" || !Site.list.length) return;
    const { b, p } = current(), card = el("intCard");
    if (Site.active !== lastActive) { lastActive = Site.active; undo = []; redo = []; sel = null; }
    if (fl > p.floors - 1) fl = p.floors - 1;
    if (!p.floors || sel && sel.k === "stair" && p.floors < 2) sel = null;
    const many = Site.list.length > 1, who = many ? `${Site.active + 1}-uy · ` : "";
    if (shapeOf(p) !== "rect") {                                     // shakldor planda xona to'ri hali yo'q; reja o'chmaydi, to'rtburchakka qaytsa chiqadi
      el("intNote").textContent = `${who}ichki reja: faqat to'rtburchak planda`;
      body.innerHTML = `<div class="int-empty"><p>Ichki xonalar va mebel hozircha faqat to'rtburchak planda chiziladi. "${esc(SHAPES[shapeOf(p)])}" shaklida bino 3D'da tashqi ko'rinishi bilan quriladi.</p></div>`;
      return;
    }
    el("intNote").textContent = b.interior === undefined ? `${who}ichi loyihalanmagan` : `${who}ichki reja yoqilgan`;
    if (b.interior === undefined) {
      body.innerHTML = `<div class="int-empty"><p>${who ? esc(who) : ""}Bu uyning ichi hali loyihalanmagan: 3D ko'rinishda u qorong'i hajm bo'lib turadi. Xonalarga bo'ling, eshik va mebel qo'ying — ichkarini 3D'da ko'rasiz, VR'da esa kirib yurasiz.</p>` +
        `<div class="int-row"><button type="button" class="btn" data-ia="auto">Avto reja yaratish</button><button type="button" class="btn-ghost" data-ia="blank">Bo'sh reja bilan boshlash</button></div></div>`;
      return;
    }
    const I = Interior.norm(p, b.interior), fd = I.floors[fl], N = p.floors;
    const selItem = sel && sel.k === "item" ? fd.items[sel.i] : null;
    if (sel && sel.k === "item" && !selItem) sel = null;
    const edgeTools = [["select", "Tanlash"], ["wall", "Devor"], ["door", "Eshik"], ["erase", "Devorni o'chirish"]];
    const tb = (t, label, extra = "") => `<button type="button" data-itool="${t}" aria-pressed="${tool === t}">${extra}${esc(label)}</button>`;
    const rs = rooms(I.g, fd.e);
    const wallLen = I.floors.reduce((s, f) => s + Object.keys(f.e).reduce((q, k) => { const g = Interior.edgeSeg(I.g, k); return g ? q + (g.horiz ? g.x1 - g.x0 : g.z1 - g.z0) : q; }, 0), 0);
    const doors = I.floors.reduce((s, f) => s + Object.values(f.e).filter(v => v === 2).length, 0);
    const furn = I.floors.reduce((s, f) => s + f.items.filter(i => i[0] !== "carpet").length, 0);
    const net = rs.reduce((s, r) => s + r.area, 0);
    body.innerHTML =
      (N > 1 ? `<div class="int-row int-floors" role="tablist" aria-label="Qavatlar">${Array.from({ length: N }, (_, f) => `<button type="button" role="tab" data-ifl="${f}" aria-pressed="${f === fl}">${f + 1}-qavat</button>`).join("")}<button type="button" class="btn-ghost" data-ia="copy" title="Shu qavat rejasini hamma qavatga nusxalaydi">Hamma qavatga nusxalash</button></div>` : "") +
      `<div class="int-row int-tools" role="toolbar" aria-label="Ichki makon asboblari">${edgeTools.map(([t, l]) => tb(t, l)).join("")}${N > 1 ? tb("stair", I.stair ? "Zinani ko'chirish" : "Zina qo'yish") : ""}</div>` +
      `<div class="int-row int-furn" role="toolbar" aria-label="Mebel">${Object.entries(ITEMS).map(([k, v]) => tb(k, v.n, `<i style="background:${v.c}"></i>`)).join("")}</div>` +
      `<div class="int-row int-act"><button type="button" class="btn-ghost" data-ia="undo"${undo.length ? "" : " disabled"}>Orqaga</button><button type="button" class="btn-ghost" data-ia="redo"${redo.length ? "" : " disabled"}>Qayta</button>` +
      `<button type="button" class="btn-ghost" data-ia="auto" title="Hamma qavatni avto reja bilan almashtiradi">Avto reja</button><button type="button" class="btn-ghost" data-ia="clear">${N > 1 ? fl + 1 + "-qavatni tozalash" : "Tozalash"}</button>` +
      `<span class="sp"></span>${selItem || (sel && sel.k === "stair") ? `<b>${selItem ? esc(ITEMS[selItem[0]].n) : "Zina"}</b><button type="button" class="btn-ghost" data-ia="rot" title="90° burish (R)">↻ Burish</button><button type="button" class="btn-ghost" data-ia="del" title="Delete">O'chirish</button>` : ""}` +
      `<button type="button" class="btn-danger" data-ia="off" title="Ichki rejani butunlay o'chiradi">Ichkini o'chirish</button></div>` +
      `<p class="int-hint${failMsg ? " bad" : ""}" role="status">${failMsg ? esc(failMsg) : tool === "select" ? "Mebelni bosib tanlang va sudrab suring (R — burish, Delete — o'chirish)." : ["wall", "door", "erase"].includes(tool) ? "Devor qirrasini bosing yoki sudrang. Bosilgan joyda devor bo'lsa — o'chadi." : tool === "stair" ? "Zina qo'yiladigan joyni bosing." : `Xona ichida bo'sh joyni bosing: ${esc(ITEMS[tool].n)} qo'yiladi.`}</p>` +
      `<div class="int-plan" id="intPlan" aria-label="Ichki reja chizmasi">${planSvg(p, b.cells, I)}</div>` +
      `<dl class="int-stats"><div><dt>${N > 1 ? fl + 1 + "-qavat xonalari" : "Xonalar"}</dt><dd>${rs.length} ta</dd></div><div><dt>Foydali maydon (${N > 1 ? fl + 1 + "-qavat" : "qavat"})</dt><dd>${f1(net)} m²</dd></div>` +
      `<div><dt>Xona devorlari</dt><dd>${f1(wallLen)} m</dd></div><div><dt>Eshiklar</dt><dd>${doors} ta</dd></div><div><dt>Mebel</dt><dd>${furn} dona</dd></div></dl>`;
  }

  // ---------- Hodisalar (bir marta ulanadi) ----------
  const svgPt = (svg, e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  document.addEventListener("click", e => {
    const c = e.target.closest && e.target.closest("#intCard"); if (!c) return;
    const t = e.target.closest("[data-itool],[data-ifl],[data-ia]"); if (!t) return;
    if (t.dataset.itool) { tool = t.dataset.itool; if (tool !== "select") sel = null; render(); }
    else if (t.dataset.ifl !== undefined) { fl = Number(t.dataset.ifl); sel = null; render(); }
    else {
      const a = t.dataset.ia;
      if (a === "auto") startAuto(); else if (a === "blank") startBlank(); else if (a === "undo") doUndo(); else if (a === "redo") doRedo();
      else if (a === "clear") clearFloor(); else if (a === "copy") copyFloor(); else if (a === "rot") rotSel(); else if (a === "del") delSel();
      else if (a === "off") { if (t.dataset.armed === "1") removeAll(); else { t.dataset.armed = "1"; t.textContent = "Tasdiqlang"; setTimeout(() => { if (t.isConnected) { t.dataset.armed = ""; t.textContent = "Ichkini o'chirish"; } }, 2500); } }
    }
  });
  document.addEventListener("pointerdown", e => {
    const svg = e.target.closest && e.target.closest("#intPlan svg"); if (!svg) return;
    e.preventDefault();
    const card = el("intCard"); if (card) card.focus({ preventScroll: true });
    const pt = svgPt(svg, e), { b, p } = current(), I = Interior.norm(p, b.interior), fd = I.floors[fl];
    const edge = e.target.closest("[data-e]"), itEl = e.target.closest("[data-i]"), stEl = e.target.closest("[data-st]");
    if (edge && ["wall", "door", "erase"].includes(tool)) {
      const k = edge.dataset.e, s0 = fd.e[k] || 0;
      const mode = tool === "erase" ? 0 : tool === "wall" ? (s0 === 1 ? 0 : 1) : (s0 === 2 ? 1 : 2);
      painting = { mode, id: e.pointerId, h0: snapJson(b), changed: false };
      painting.changed = applyEdge(k, mode, true) || painting.changed;
      return;
    }
    if (itEl || stEl) {
      sel = itEl ? { k: "item", i: Number(itEl.dataset.i) } : { k: "stair" };
      const src = itEl ? fd.items[sel.i] : I.stair;
      if (!src) return;
      drag = { id: e.pointerId, dx: pt.x - (itEl ? src[1] : src[0]), dz: pt.y - (itEl ? src[2] : src[1]), h0: snapJson(b), moved: false };
      render(); return;
    }
    if (ITEMS[tool]) { placeItem(tool, pt.x, pt.y); return; }
    if (tool === "stair") { placeStair(pt.x, pt.y); return; }
    sel = null; render();
  });
  document.addEventListener("pointermove", e => {
    if (painting && e.pointerId === painting.id) {
      const t = document.elementFromPoint(e.clientX, e.clientY), ed = t && t.closest && t.closest("[data-e]");
      if (ed) painting.changed = applyEdge(ed.dataset.e, painting.mode, true) || painting.changed;
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const svg = document.querySelector("#intPlan svg"); if (!svg || !sel) return;
    const pt = svgPt(svg, e), x = pt.x - drag.dx, z = pt.y - drag.dz;
    const ok = mutate((int, p, I) => {
      if (sel.k === "item") {
        const old = int.floors[fl].items[sel.i]; if (!old) return false;
        // 0,25 m qadamlarda: devorga urilganda to'xtaydi yoki sirpanadi, ustidan sakramaydi
        const [nx, nz] = Site.slide([old[1], old[2]], [x, z], (cx, cz) => itemOK(I, p, fl, [old[0], r2(cx), r2(cz), old[3]], sel.i), 0.25);
        int.floors[fl].items[sel.i] = [old[0], r2(nx), r2(nz), old[3]];
        return true;
      }
      if (!int.stair) return false;
      const [nx, nz] = Site.slide([int.stair[0], int.stair[1]], [x, z], (cx, cz) => stairOK(I, p, [r2(cx), r2(cz), int.stair[2]]), 0.5);
      int.stair = [r2(nx), r2(nz), int.stair[2]];
    }, true);
    if (ok) drag.moved = true;
  });
  const endAll = e => {
    if (painting && (!e || e.pointerId === painting.id)) { if (painting.changed) { undo.push(painting.h0); redo = []; } painting = null; render(); }
    if (drag && (!e || e.pointerId === drag.id)) { if (drag.moved) { undo.push(drag.h0); redo = []; } drag = null; render(); }
  };
  document.addEventListener("pointerup", endAll);
  document.addEventListener("pointercancel", endAll);
  document.addEventListener("keydown", e => {
    const c = e.target.closest && e.target.closest("#intCard"); if (!c || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); e.stopImmediatePropagation(); e.shiftKey ? doRedo() : doUndo(); }   // fasad "Orqaga"si ishlamasin
    else if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); e.stopImmediatePropagation(); doRedo(); }
    else if (k === "r" && sel) { e.preventDefault(); rotSel(); }
    else if ((k === "delete" || k === "backspace") && sel) { e.preventDefault(); delSel(); }
    else if (k === "escape") { sel = null; tool = "select"; render(); }
  });

  return { render };
})();
