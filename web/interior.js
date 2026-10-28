// Ichki makon: xona devorlari, eshiklar, mebel va zina.
// Koordinatalar metrda, uyning ichki tizimida: x — chapdan o'ngga (0..W), z — orqadan oldinga (0..D).
// Old fasad z = D da turadi. Devorlar 1 metrlik to'rning chiziqlari bo'ylab o'tadi.
const Interior = (function () {
  const T = 0.35;                         // tashqi devor qalinligi (view3d bilan bir xil)
  const TREAD = 0.24, RISE = 0.19, STAIR_W = 1.1;
  const DOOR_W = 0.9, PART = 0.12;        // eshik kengligi, xona devori qalinligi

  // Mebel va jihozlar katalogi: w — x bo'ylab, d — z bo'ylab (rot=0 da), h — balandlik. Old tomoni rot=0 da +z ga qaraydi.
  // g — guruh (tanlash panelida), m — devor/shiftga osiladi: polda joy egallamaydi (boshqa buyum ustida tura oladi),
  // y — poldan balandligi, top — shiftdan osiladi (qandil). Har biri mahsulotlar katalogida "mbl-<tur>" (oshxona — "int-oshxona").
  const ITEMS = {
    bed:        { n: "Karavot",          w: 1.6,  d: 2.0,  h: 0.55, c: "#b9a28a", g: "mebel" },
    kidsbed:    { n: "Bolalar karavoti", w: 0.9,  d: 1.9,  h: 0.5,  c: "#c7a7d8", g: "mebel" },
    cradle:     { n: "Beshik",           w: 0.6,  d: 1.0,  h: 0.8,  c: "#c49a6c", g: "mebel" },
    sofa:       { n: "Divan",            w: 2.0,  d: 0.9,  h: 0.8,  c: "#5d7f99", g: "mebel" },
    armchair:   { n: "Kreslo",           w: 0.85, d: 0.85, h: 0.85, c: "#6f8fa8", g: "mebel" },
    table:      { n: "Stol",             w: 1.4,  d: 0.8,  h: 0.75, c: "#9a7650", g: "mebel" },
    dining:     { n: "Ovqat stoli",      w: 1.8,  d: 0.9,  h: 0.75, c: "#8a6440", g: "mebel" },
    ctable:     { n: "Jurnal stoli",     w: 1.0,  d: 0.6,  h: 0.45, c: "#9a7650", g: "mebel" },
    xontaxta:   { n: "Xontaxta",         w: 1.2,  d: 0.8,  h: 0.35, c: "#a0683c", g: "mebel" },
    korpacha:   { n: "Ko'rpacha",        w: 0.7,  d: 1.9,  h: 0.08, c: "#b0413e", g: "mebel" },
    chair:      { n: "Stul",             w: 0.45, d: 0.45, h: 0.9,  c: "#7a5c3e", g: "mebel" },
    desk:       { n: "Ish stoli",        w: 1.4,  d: 0.7,  h: 0.75, c: "#a98a63", g: "mebel" },
    wardrobe:   { n: "Shkaf",            w: 1.2,  d: 0.6,  h: 2.1,  c: "#8c6d4f", g: "mebel" },
    dresser:    { n: "Komod",            w: 1.0,  d: 0.5,  h: 0.9,  c: "#a98a63", g: "mebel" },
    nightstand: { n: "Tumbochka",        w: 0.45, d: 0.4,  h: 0.55, c: "#a98a63", g: "mebel" },
    shelf:      { n: "Kitob javoni",     w: 1.0,  d: 0.35, h: 2.0,  c: "#8c6d4f", g: "mebel" },
    kitchen:    { n: "Oshxona",          w: 2.4,  d: 0.65, h: 0.9,  c: "#d8d4c8", g: "texnika" },
    stove:      { n: "Gaz plitasi",      w: 0.6,  d: 0.6,  h: 0.9,  c: "#e4e6e8", g: "texnika" },
    fridge:     { n: "Muzlatkich",       w: 0.7,  d: 0.7,  h: 1.9,  c: "#c9ced1", g: "texnika" },
    washer:     { n: "Kir yuvish mashinasi", w: 0.6, d: 0.6, h: 0.85, c: "#eef0f1", g: "texnika" },
    dishwasher: { n: "Idish yuvish mashinasi", w: 0.6, d: 0.6, h: 0.85, c: "#dfe3e6", g: "texnika" },
    tv:         { n: "Televizor",        w: 1.2,  d: 0.35, h: 0.9,  c: "#2a2f33", g: "texnika" },
    ac:         { n: "Konditsioner",     w: 0.9,  d: 0.25, h: 0.3,  c: "#f4f5f5", g: "texnika", m: 1, y: 2.2 },
    boiler:     { n: "Isitish qozoni",   w: 0.45, d: 0.35, h: 0.75, c: "#f0f0ee", g: "texnika", m: 1, y: 1.2 },
    radiator:   { n: "Radiator",         w: 1.0,  d: 0.1,  h: 0.6,  c: "#f3f3f1", g: "texnika", m: 1, y: 0.15 },
    bath:       { n: "Vanna",            w: 1.7,  d: 0.75, h: 0.55, c: "#f1f1ee", g: "hammom" },
    shower:     { n: "Dush kabinasi",    w: 0.9,  d: 0.9,  h: 2.0,  c: "#bcd6e6", g: "hammom" },
    toilet:     { n: "Unitaz",           w: 0.4,  d: 0.7,  h: 0.7,  c: "#f1f1ee", g: "hammom" },
    sink:       { n: "Lavabo",           w: 0.6,  d: 0.45, h: 0.85, c: "#f1f1ee", g: "hammom" },
    mirror:     { n: "Ko'zgu",           w: 0.8,  d: 0.06, h: 1.1,  c: "#cfe3ee", g: "hammom", m: 1, y: 1.0 },
    carpet:     { n: "Gilam",            w: 2.0,  d: 3.0,  h: 0.02, c: "#a4544a", g: "bezak" },
    plant:      { n: "O'simlik",         w: 0.5,  d: 0.5,  h: 1.2,  c: "#4f8a4f", g: "bezak" },
    lamp:       { n: "Torsher",          w: 0.4,  d: 0.4,  h: 1.7,  c: "#e8d9a8", g: "bezak" },
    chandelier: { n: "Qandil",           w: 0.8,  d: 0.8,  h: 0.45, c: "#e9c46a", g: "bezak", m: 1, top: 1 },
    painting:   { n: "Kartina",          w: 1.0,  d: 0.05, h: 0.7,  c: "#c08a4a", g: "bezak", m: 1, y: 1.4 },
    curtain:    { n: "Parda",            w: 2.0,  d: 0.12, h: 2.5,  c: "#c9b48e", g: "bezak" },
    fireplace:  { n: "Kamin",            w: 1.4,  d: 0.5,  h: 1.1,  c: "#8c8478", g: "bezak" },
    piano:      { n: "Pianino",          w: 1.5,  d: 0.6,  h: 1.25, c: "#24282b", g: "bezak" },
    aquarium:   { n: "Akvarium",         w: 1.2,  d: 0.45, h: 1.3,  c: "#5aa8d8", g: "bezak" },
  };
  const GROUPS = { mebel: "Mebel", texnika: "Maishiy texnika", hammom: "Hammom", bezak: "Bezak va yoritish" };
  const mounted = t => !!(ITEMS[t] && ITEMS[t].m);
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];     // zina ko'tarilish yo'nalishi (rot 0..3)

  const round2 = v => Math.round(v * 100) / 100;

  // ---------- Ko'pburchak yordamchilari (shakldor plan uchun) ----------
  // Juft-toq qoida: tashqi kontur va teshiklar (ichki hovli) birga beriladi
  function inRings(rings, x, z) {
    let c = false;
    rings.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, zi] = r[i], [xj, zj] = r[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
    } });
    return c;
  }
  function nearRings(rings, x, z, eps) {
    return rings.some(r => r.some(([x1, z1], i) => {
      const [x2, z2] = r[(i + 1) % r.length], dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / L2));
      return Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz)) < eps;
    }));
  }

  // ---------- To'r ----------
  // Oxirgi to'r chizig'i devorga tegadi (kasr qoldiq o'sha oxirgi katakka qo'shiladi)
  const lineX = (g, i) => (i >= g.gw ? g.W : i);
  const lineZ = (g, j) => (j >= g.gd ? g.D : j);
  // To'rtburchak bo'lmagan planda (L, П, aylana...) to'r bino tashqi chegarasi bo'ylab qirqiladi:
  // katak bino ichida hisoblanadi, agar uning kamida yarmi tashqi devorning ichki yuzasidan ichkarida bo'lsa
  function size(p) {
    const W = p.bays * p.bay_w, D = p.depth, g = { W, D, gw: Math.max(2, Math.floor(W)), gd: Math.max(2, Math.floor(D)) };
    if (typeof shapeOf === "function" && shapeOf(p) !== "rect") {
      const ps = planShape(p);
      g.outer = ps.rings; g.inner = ps.rings.map(r => offsetRing(r, -T)); g.mask = []; g.frac = [];
      for (let i = 0; i < g.gw; i++) for (let j = 0; j < g.gd; j++) {
        const x0 = lineX(g, i), x1 = lineX(g, i + 1), z0 = lineZ(g, j), z1 = lineZ(g, j + 1);
        let n = 0;
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (inRings(g.inner, x0 + (x1 - x0) * (a + 0.5) / 4, z0 + (z1 - z0) * (b + 0.5) / 4)) n++;
        g.frac[i * g.gd + j] = n / 16; g.mask[i * g.gd + j] = n >= 8;
      }
    }
    return g;
  }
  const cellOn = (g, i, j) => i >= 0 && j >= 0 && i < g.gw && j < g.gd && (!g.mask || g.mask[i * g.gd + j]);
  // Katakning foydali yuzasi: to'rtburchakda tashqi devor ichi, shakldor planda — ichkaridagi ulushi
  function cellArea(g, i, j) {
    const x0 = lineX(g, i), x1 = lineX(g, i + 1), z0 = lineZ(g, j), z1 = lineZ(g, j + 1);
    if (g.mask) return (x1 - x0) * (z1 - z0) * g.frac[i * g.gd + j];
    return (Math.min(x1, g.W - T) - Math.max(x0, T)) * (Math.min(z1, g.D - T) - Math.max(z0, T));
  }
  // To'rtburchak (mebel, zina) bino ichidami: chegara bo'ylab har 0,5 m da tekshiriladi (П shaklning ochiq qismini kesib o'tmasin)
  function rectInside(g, r) {
    if (r.x0 < T - 1e-6 || r.x1 > g.W - T + 1e-6 || r.z0 < T - 1e-6 || r.z1 > g.D - T + 1e-6) return false;
    if (!g.inner) return true;
    const pts = [[(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]], nx = Math.max(1, Math.ceil((r.x1 - r.x0) / 0.5)), nz = Math.max(1, Math.ceil((r.z1 - r.z0) / 0.5));
    for (let k = 0; k <= nx; k++) { const x = r.x0 + (r.x1 - r.x0) * k / nx; pts.push([x, r.z0], [x, r.z1]); }
    for (let k = 0; k <= nz; k++) { const z = r.z0 + (r.z1 - r.z0) * k / nz; pts.push([r.x0, z], [r.x1, z]); }
    return pts.every(([x, z]) => inRings(g.inner, x, z) || nearRings(g.inner, x, z, 0.02));
  }
  // Qirraning ikki tomonidagi kataklar
  const edgeCells = (horiz, a, b) => (horiz ? [[a, b - 1], [a, b]] : [[a - 1, b], [a, b]]);

  // Qirra kaliti: "h:x,z" — gorizontal (x..x+1, z chizig'ida), "v:x,z" — vertikal (x chizig'ida, z..z+1)
  function edgeSeg(g, key) {
    const m = /^([hv]):(\d{1,3}),(\d{1,3})$/.exec(String(key));
    if (!m) return null;
    const a = +m[2], b = +m[3];
    let seg;
    if (m[1] === "h") {
      if (a < 0 || a >= g.gw || b < 1 || b > g.gd - 1) return null;
      seg = { horiz: true, x0: lineX(g, a), x1: lineX(g, a + 1), z0: lineZ(g, b), z1: lineZ(g, b) };
    } else {
      if (a < 1 || a > g.gw - 1 || b < 0 || b >= g.gd) return null;
      seg = { horiz: false, x0: lineX(g, a), x1: lineX(g, a), z0: lineZ(g, b), z1: lineZ(g, b + 1) };
    }
    if (g.mask) {                                   // shakldor plan: ikki tomoni ham bino ichida, uchlari tashqi devordan chiqmaydi
      if (!edgeCells(seg.horiz, a, b).every(([i, j]) => cellOn(g, i, j))) return null;
      const on = (x, z) => inRings(g.outer, x, z) || nearRings(g.outer, x, z, 0.02);
      if (!on(seg.x0, seg.z0) || !on(seg.x1, seg.z1)) return null;
    }
    return seg;
  }

  // ---------- Xonalar: kataklar devor va eshiklar bo'yicha guruhlanadi ----------
  function roomsOf(g, e) {
    const lab = new Map(), list = [], key = (i, j) => i + "," + j;
    for (let i0 = 0; i0 < g.gw; i0++) for (let j0 = 0; j0 < g.gd; j0++) {
      if (!cellOn(g, i0, j0) || lab.has(key(i0, j0))) continue;
      const id = list.length, cells = [], q = [[i0, j0]]; lab.set(key(i0, j0), id);
      while (q.length) {
        const [i, j] = q.pop(); cells.push([i, j]);
        for (const [a, b, k] of [[i + 1, j, `v:${i + 1},${j}`], [i - 1, j, `v:${i},${j}`], [i, j + 1, `h:${i},${j + 1}`], [i, j - 1, `h:${i},${j}`]])
          if (cellOn(g, a, b) && !e[k] && !lab.has(key(a, b))) { lab.set(key(a, b), id); q.push([a, b]); }
      }
      list.push(cells);
    }
    return { lab, list };
  }
  // Har bir xonaga kirish bo'lsin: eng katta xonadan eshiklar orqali yetib bo'lmaydigan xonaga umumiy devorning o'rtasiga eshik qo'yiladi
  function connectRooms(g, e) {
    for (let guard = 0; guard < 60; guard++) {
      const { lab, list } = roomsOf(g, e); if (list.length < 2) return;
      const parent = list.map((_, i) => i), find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      const sides = k => { const m = /^([hv]):(\d+),(\d+)$/.exec(k), [c1, c2] = edgeCells(m[1] === "h", +m[2], +m[3]); return [lab.get(c1.join(",")), lab.get(c2.join(","))]; };
      for (const [k, v] of Object.entries(e)) if (v === 2) { const [r1, r2] = sides(k); if (r1 !== undefined && r2 !== undefined) parent[find(r1)] = find(r2); }
      const main = find(list.reduce((bi, c, i) => (c.length > list[bi].length ? i : bi), 0));
      if (list.every((_, i) => find(i) === main)) return;
      const cand = Object.keys(e).filter(k => e[k] === 1).map(k => ({ k, r: sides(k) }))
        .filter(({ r: [r1, r2] }) => r1 !== undefined && r2 !== undefined && (find(r1) === main) !== (find(r2) === main));
      if (!cand.length) return;
      const other = (c => (find(c.r[0]) === main ? c.r[1] : c.r[0]))(cand[0]), mine = cand.filter(c => c.r.includes(other));
      e[mine[Math.floor(mine.length / 2)].k] = 2;
    }
  }

  // Qirrani devor bo'laklariga ajratadi; eshik (state 2) bo'lsa, o'rtasida DOOR_W teshik qoladi
  function wallPieces(seg, state) {
    const a0 = seg.horiz ? seg.x0 : seg.z0, a1 = seg.horiz ? seg.x1 : seg.z1, fix = seg.horiz ? seg.z0 : seg.x0;
    const mk = (s, e) => seg.horiz ? { x0: s, x1: e, z0: fix - PART / 2, z1: fix + PART / 2 } : { x0: fix - PART / 2, x1: fix + PART / 2, z0: s, z1: e };
    if (state !== 2) return { walls: [mk(a0, a1)], lintel: null };
    const c = (a0 + a1) / 2, ow = Math.min(DOOR_W, a1 - a0 - 0.1);
    return { walls: [mk(a0, c - ow / 2), mk(c + ow / 2, a1)], lintel: mk(c - ow / 2, c + ow / 2) };
  }

  // ---------- Mebel ----------
  function itemRect(it) {
    const d = ITEMS[it[0]], odd = (it[3] | 0) % 2 === 1, w = odd ? d.d : d.w, dd = odd ? d.w : d.d;
    return { x0: it[1] - w / 2, x1: it[1] + w / 2, z0: it[2] - dd / 2, z1: it[2] + dd / 2, w, d: dd };
  }

  // ---------- Zina ----------
  function stairDims(p) {
    const n = Math.max(8, Math.round(p.floor_h / RISE));
    return { n, L: n * TREAD };
  }
  // st = [x, z, rot] — zina markazi. Odam zina yonidan (perpendikulyar tomondan) chiqadi va tushadi.
  function stairInfo(p, st, g) {
    const { n, L } = stairDims(p), rot = (st[2] | 0) % 4, odd = rot % 2 === 1;
    const w = odd ? L : STAIR_W, d = odd ? STAIR_W : L;
    const rect = { x0: st[0] - w / 2, x1: st[0] + w / 2, z0: st[1] - d / 2, z1: st[1] + d / 2 };
    const perp = odd ? [0, 1] : [1, 0], off = STAIR_W / 2 + 0.9;
    const inb = (x, z) => x >= T + 0.4 && x <= g.W - T - 0.4 && z >= T + 0.4 && z <= g.D - T - 0.4;
    let ex = [st[0] + perp[0] * off, st[1] + perp[1] * off];
    if (!inb(ex[0], ex[1])) ex = [st[0] - perp[0] * off, st[1] - perp[1] * off];
    ex = [Math.min(g.W - T - 0.4, Math.max(T + 0.4, ex[0])), Math.min(g.D - T - 0.4, Math.max(T + 0.4, ex[1]))];
    return { rect, n, L, rot, dir: DIRS[rot], center: { x: st[0], z: st[1] }, exit: { x: ex[0], z: ex[1] } };
  }
  function defaultStair(p, g) {
    const { L } = stairDims(p);
    const st = g.D >= 10 ? [round2(T + 0.3 + STAIR_W / 2), round2(T + 0.3 + L / 2), 0]
                         : [round2(T + 0.3 + L / 2), round2(T + 0.3 + STAIR_W / 2), 1];
    if (!g.mask || fitsStair(p, g, st)) return st;
    for (const rot of [0, 1])                       // shakldor plan: orqa tomondan boshlab birinchi sig'adigan joy
      for (let z = T + 0.3; z < g.D; z += 0.5) for (let x = T + 0.3; x < g.W; x += 0.5) {
        const c = rot ? [round2(x + L / 2), round2(z + STAIR_W / 2), 1] : [round2(x + STAIR_W / 2), round2(z + L / 2), 0];
        if (fitsStair(p, g, c)) return c;
      }
    return null;
  }
  function fitsStair(p, g, st) {
    if (!Array.isArray(st) || st.length < 3 || !st.every(v => Number.isFinite(Number(v)))) return false;
    const r = stairInfo(p, [Number(st[0]), Number(st[1]), st[2] | 0], g).rect;
    return rectInside(g, { x0: r.x0 - 0.05, x1: r.x1 + 0.05, z0: r.z0 - 0.05, z1: r.z1 + 0.05 });
  }

  // ---------- Normallashtirish: saqlangan ma'lumotni joriy o'lchamlarga moslaydi (saqlanganni o'zgartirmaydi) ----------
  function norm(p, raw) {
    const g = size(p), N = p.floors, out = { g, floors: [], stair: null };
    const rf = raw && Array.isArray(raw.floors) ? raw.floors : [];
    for (let f = 0; f < N; f++) {
      const src = rf[f] || {}, e = {}, items = [];
      for (const [k, v] of Object.entries(src.e || {})) if ((v === 1 || v === 2) && edgeSeg(g, k)) e[k] = v;
      for (const it of src.items || []) {
        if (!Array.isArray(it) || !ITEMS[it[0]]) continue;
        const t = [it[0], Number(it[1]), Number(it[2]), (it[3] | 0) % 4], r = itemRect(t);
        if (![t[1], t[2]].every(Number.isFinite)) continue;
        if (rectInside(g, r)) items.push(t);
      }
      out.floors.push({ e, items });
    }
    if (N > 1) {
      const st = raw && raw.stair !== undefined ? raw.stair : undefined;     // null — zina ataylab olib tashlangan
      if (st === null) out.stair = null;
      else out.stair = fitsStair(p, g, st) ? [Number(st[0]), Number(st[1]), st[2] | 0] : defaultStair(p, g);
    }
    return out;
  }

  // Faqat tuzilma va turlarni tekshiradi (o'lchamga bog'liq kesish yo'q): brauzerdagi saqlangan ma'lumot uchun
  function clean(raw) {
    if (!raw || typeof raw !== "object") return undefined;
    const floors = (Array.isArray(raw.floors) ? raw.floors : []).slice(0, 30).map(f => {
      const e = {}, items = [];
      for (const [k, v] of Object.entries((f && f.e) || {})) if ((v === 1 || v === 2) && /^[hv]:\d{1,3},\d{1,3}$/.test(k) && Object.keys(e).length < 600) e[k] = v;
      for (const it of ((f && f.items) || []).slice(0, 80)) {
        if (Array.isArray(it) && ITEMS[it[0]] && Number.isFinite(Number(it[1])) && Number.isFinite(Number(it[2]))) items.push([it[0], round2(Number(it[1])), round2(Number(it[2])), (it[3] | 0) % 4]);
      }
      return { e, items };
    });
    const out = { floors };
    if (raw.stair === null) out.stair = null;
    else if (Array.isArray(raw.stair) && raw.stair.length >= 3 && raw.stair.every(v => Number.isFinite(Number(v)))) out.stair = [round2(Number(raw.stair[0])), round2(Number(raw.stair[1])), (raw.stair[2] | 0) % 4];
    return out;
  }

  // ---------- Avto reja: xonalarga bo'lingan, mebel qo'yilgan reja ----------
  function auto(p) {
    const g = size(p), N = p.floors, cat = p.category;
    const e = {}, items = [];
    const stair = N > 1 ? defaultStair(p, g) || undefined : undefined;
    let hallW = 0;
    if (stair) hallW = stair[2] === 0 ? 4 : Math.ceil(stairDims(p).L + 1.7);
    if (g.gw - hallW < 4) hallW = 0;

    const two = g.gd >= 9, zm = Math.round(g.gd / 2);
    const rows = two ? [[0, zm], [zm, g.gd]] : [[0, g.gd]];
    const span = g.gw - hallW, ncols = Math.max(1, Math.round(span / 4.5)), cb = [hallW];
    for (let k = 1; k < ncols; k++) cb.push(Math.round(hallW + (k * span) / ncols));
    cb.push(g.gw);

    const doorCell = (a, b) => a + Math.floor((b - a - 1) / 2);      // [a, b) oralig'idagi o'rta katak
    if (hallW > 0) {                                                 // zina zali bilan xonalar orasidagi devor
      for (let z = 0; z < g.gd; z++) e[`v:${hallW},${z}`] = 1;
      rows.forEach(([a, b]) => { e[`v:${hallW},${doorCell(a, b)}`] = 2; });
    }
    for (let k = 1; k < ncols; k++) {                                // ustunlar orasidagi devorlar
      for (let z = 0; z < g.gd; z++) e[`v:${cb[k]},${z}`] = 1;
      rows.forEach(([a, b]) => { e[`v:${cb[k]},${doorCell(a, b)}`] = 2; });
    }
    if (two) {                                                       // qatorlar orasidagi devor
      for (let x = hallW; x < g.gw; x++) e[`h:${x},${zm}`] = 1;
      for (let k = 0; k < ncols; k++) e[`h:${doorCell(cb[k], cb[k + 1])},${zm}`] = 2;
    }

    const put = (type, rot, r, ax, az, m = 0.15) => {
      const d = ITEMS[type], odd = rot % 2 === 1, w = odd ? d.d : d.w, dd = odd ? d.w : d.d;
      const hw = (r.x1 - r.x0) / 2 - w / 2 - m, hd = (r.z1 - r.z0) / 2 - dd / 2 - m;
      if (hw < 0 || hd < 0) return;                                  // xona buyumga juda tor
      items.push([type, round2((r.x0 + r.x1) / 2 + ax * hw), round2((r.z0 + r.z1) / 2 + az * hd), rot]);
    };
    const KINDS = {
      "turar-joy": { front: ["living", "bedroom", "bedroom", "living"], back: ["kitchen", "bath", "bedroom", "bath"], single: ["living", "bedroom", "kitchen", "bath"] },
      jamoat:      { front: ["hall", "hall", "hall", "hall"],            back: ["reading", "toilet", "reading", "hall"], single: ["hall", "reading", "hall", "toilet"] },
      tijorat:     { front: ["office", "office", "office", "office"],    back: ["meeting", "toilet", "office", "meeting"], single: ["office", "meeting", "office", "toilet"] },
      interyer:    { front: ["living", "living", "living", "living"],    back: ["living", "living", "living", "living"], single: ["living", "living", "living", "living"] },
    }[cat] || KINDS_FALLBACK();
    function KINDS_FALLBACK() { return { front: ["living"], back: ["living"], single: ["living"] }; }

    // Karavot yonidagi tumbochkalar: karavot bosh tomonida, ikki yonida (xonaga sig'sa)
    const besideBed = r => {
      const b = items[items.length - 1]; if (!b || b[0] !== "bed") return;
      [-1, 1].forEach(s => { const x = round2(b[1] + s * 1.08), z = round2(b[2] - 0.78); if (x - 0.25 > r.x0 && x + 0.25 < r.x1) items.push(["nightstand", x, z, 0]); });
    };
    const furnish = {
      bedroom(r) { put("bed", 0, r, 0, -1); besideBed(r); put("wardrobe", 0, r, -1, 1); put("plant", 0, r, 1, 1); put("ac", 2, r, 0, 1); put("chandelier", 0, r, 0, 0); put("curtain", 2, r, 0.5, 1, 0.05); },
      living(r) { put("tv", 0, r, 0, -1); put("carpet", 0, r, 0, 0.1); put("sofa", 2, r, 0, 1); put("ctable", 0, r, 0, 0.2); put("armchair", 3, r, 1, 0); put("plant", 0, r, -1, -1);
        put("lamp", 0, r, 1, 1); put("ac", 0, r, 0.7, -1, 0.05); put("chandelier", 0, r, 0, 0); put("painting", 1, r, -1, 0, 0.02); put("curtain", 2, r, -0.5, 1, 0.05); },
      kitchen(r) { put("kitchen", 0, r, -0.4, -1); put("fridge", 0, r, 1, -1); put("stove", 1, r, -1, 0.2); put("dining", 0, r, 0.15, 0.5); put("chair", 0, r, -0.1, 0.15); put("chair", 2, r, -0.1, 0.95);
        put("dishwasher", 3, r, 1, 0.25); put("ac", 2, r, 0.6, 1, 0.05); },
      bath(r) { put("bath", 0, r, -1, -1); put("toilet", 0, r, 1, -1); put("sink", 0, r, 0.35, -1); put("mirror", 0, r, 0.35, -1, 0.02); put("washer", 0, r, -1, 1); },
      toilet(r) { put("sink", 0, r, -0.6, -1); put("sink", 0, r, 0, -1); put("toilet", 0, r, 0.7, -1); },
      office(r) {
        put("ac", 0, r, 0, -1, 0.05);
        [[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.55], [0.5, 0.55]].forEach(([ax, az]) => {
          const before = items.length; put("desk", 0, r, ax, az, 0.6);
          if (items.length > before) { const d = items[items.length - 1]; items.push(["chair", d[1], round2(d[2] + 0.62), 2]); }
        });
        put("plant", 0, r, 1, 1);
      },
      meeting(r) { put("table", 0, r, 0, 0); [-0.45, 0.45].forEach(a => { put("chair", 0, r, a, -0.35, 0.3); put("chair", 2, r, a, 0.35, 0.3); }); put("ac", 0, r, 0, -1, 0.05); put("chandelier", 0, r, 0, 0); },
      reading(r) { put("desk", 0, r, -0.5, -0.5); put("desk", 0, r, 0.5, -0.5); put("desk", 0, r, -0.5, 0.5); put("desk", 0, r, 0.5, 0.5); put("plant", 0, r, 1, 1); put("shelf", 0, r, -1, -1, 0.05); put("ac", 0, r, 0.3, -1, 0.05); },
      hall(r) { put("carpet", 0, r, 0, 0); put("table", 0, r, 0, 0); put("plant", 0, r, -1, -1); put("plant", 0, r, 1, -1); put("sofa", 2, r, 0, 1); put("chandelier", 0, r, 0, 0); put("ac", 0, r, 0, -1, 0.05); },
    };

    rows.forEach(([za, zb], ri) => {
      const list = two ? (ri === 0 ? KINDS.back : KINDS.front) : KINDS.single;
      for (let k = 0; k < ncols; k++) {
        const r = { x0: lineX(g, cb[k]) + (k === 0 && hallW === 0 ? T : 0.06), x1: (k === ncols - 1 ? g.W - T : lineX(g, cb[k + 1])) - 0.06, z0: lineZ(g, za) + (za === 0 ? T : 0.06), z1: (zb === g.gd ? g.D - T : lineZ(g, zb)) - 0.06 };
        (furnish[list[k % list.length]] || furnish.living)(r);
      }
    });
    if (hallW > 0) {                                                 // zina zali: o'simliklar va old tomonda gilam
      const hr = { x0: T, x1: hallW - 0.06, z0: T, z1: g.D - T };
      const sr = stairInfo(p, stair, g).rect;
      if (hr.z1 - sr.z1 > 2.5) { put("plant", 0, { x0: hr.x0, x1: hr.x1, z0: sr.z1 + 0.2, z1: hr.z1 }, -1, 1); put("carpet", 0, { x0: hr.x0, x1: hr.x1, z0: sr.z1 + 0.2, z1: hr.z1 }, 0, 0.9); }
    }

    if (g.mask) {                                   // shakldor plan: bino tashqarisiga tushgan devor va mebel olib tashlanadi
      const sr = stair ? stairInfo(p, stair, g).rect : null, hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
      for (const k of Object.keys(e)) {
        const seg = edgeSeg(g, k);
        if (!seg || (sr && wallPieces(seg, 1).walls.some(w => hit(w, sr)))) delete e[k];
      }
      for (let i = items.length - 1; i >= 0; i--) { const r = itemRect(items[i]); if (!rectInside(g, r) || (sr && items[i][0] !== "carpet" && hit(r, sr))) items.splice(i, 1); }
      connectRooms(g, e);
    }
    const one = { e, items };
    const out = { floors: Array.from({ length: N }, () => JSON.parse(JSON.stringify(one))) };
    if (stair) out.stair = stair;
    else if (N > 1) out.stair = null;
    return out;
  }

  // ---------- Buyum joyiga sig'adimi: bino ichida, devor/zina/boshqa buyumga kirmaydi (osma buyumlar va gilam boshqalar bilan ustma-ust tura oladi) ----------
  const ov = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;
  function wallRects(g, e) {
    const out = [];
    for (const [k, s] of Object.entries(e)) { const seg = edgeSeg(g, k); if (seg) wallPieces(seg, s).walls.forEach(r => out.push(r)); }
    return out;
  }
  function fits(p, I, f, it, skip) {
    const r = itemRect(it); if (!rectInside(I.g, r)) return false;
    const sr = I.stair && p.floors > 1 ? stairInfo(p, I.stair, I.g).rect : null, free = it[0] === "carpet" || mounted(it[0]);
    if (sr && it[0] !== "carpet" && !mounted(it[0]) && ov(r, sr)) return false;
    if (wallRects(I.g, I.floors[f].e).some(w => ov(r, w))) return false;
    return I.floors[f].items.every((o, i) => i === skip || free || o[0] === "carpet" || mounted(o[0]) || !ov(r, itemRect(o)));
  }
  // AI uchun: buyumni qavatdagi birinchi bo'sh joyga qo'yadi (devor yaqinidan boshlab, 0,25 m qadam bilan, 4 burilishda)
  function placeFree(p, I, f, type) {
    if (!ITEMS[type] || I.floors[f].items.length >= 80) return null;
    const g = I.g, pts = [];
    for (let z = T + 0.2; z < g.D - T; z += 0.25) for (let x = T + 0.2; x < g.W - T; x += 0.25) pts.push([round2(x), round2(z)]);
    const edge = ([x, z]) => Math.min(x, g.W - x, z, g.D - z);       // devorga yaqin joylar avval
    pts.sort((a, b) => edge(a) - edge(b));
    for (const [x, z] of pts) for (let rot = 0; rot < 4; rot++) {
      const it = [type, x, z, rot]; if (fits(p, I, f, it, -1)) return it;
    }
    return null;
  }

  // Tahrirlash uchun: saqlangan ma'lumot bo'lmasa, normallashtirilgan nusxa yaratiladi (zina aniq yoziladi)
  function editable(p, raw) {
    const n = norm(p, raw), out = { floors: n.floors.map(f => ({ e: { ...f.e }, items: f.items.map(i => i.slice()) })) };
    if (p.floors > 1) out.stair = n.stair;
    return out;
  }

  return { T, STAIR_W, DOOR_W, PART, ITEMS, GROUPS, mounted, fits, placeFree, DIRS, size, lineX, lineZ, edgeSeg, wallPieces, itemRect, stairDims, stairInfo, defaultStair, fitsStair, norm, clean, auto, editable,
           cellOn, cellArea, rectInside, inRings, roomsOf };
})();
