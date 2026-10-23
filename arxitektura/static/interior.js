// Ichki makon: xona devorlari, eshiklar, mebel va zina.
// Koordinatalar metrda, uyning ichki tizimida: x — chapdan o'ngga (0..W), z — orqadan oldinga (0..D).
// Old fasad z = D da turadi. Devorlar 1 metrlik to'rning chiziqlari bo'ylab o'tadi.
const Interior = (function () {
  const T = 0.35;                         // tashqi devor qalinligi (view3d bilan bir xil)
  const TREAD = 0.24, RISE = 0.19, STAIR_W = 1.1;
  const DOOR_W = 0.9, PART = 0.12;        // eshik kengligi, xona devori qalinligi

  // Mebel katalogi: w — x bo'ylab, d — z bo'ylab (rot=0 da), h — balandlik. Old tomoni rot=0 da +z ga qaraydi.
  const ITEMS = {
    bed:      { n: "Karavot",    w: 1.6,  d: 2.0,  h: 0.55, c: "#b9a28a" },
    sofa:     { n: "Divan",      w: 2.0,  d: 0.9,  h: 0.8,  c: "#5d7f99" },
    table:    { n: "Stol",       w: 1.4,  d: 0.8,  h: 0.75, c: "#9a7650" },
    chair:    { n: "Stul",       w: 0.45, d: 0.45, h: 0.9,  c: "#7a5c3e" },
    wardrobe: { n: "Shkaf",      w: 1.2,  d: 0.6,  h: 2.1,  c: "#8c6d4f" },
    kitchen:  { n: "Oshxona",    w: 2.4,  d: 0.65, h: 0.9,  c: "#d8d4c8" },
    fridge:   { n: "Muzlatkich", w: 0.7,  d: 0.7,  h: 1.9,  c: "#c9ced1" },
    bath:     { n: "Vanna",      w: 1.7,  d: 0.75, h: 0.55, c: "#f1f1ee" },
    toilet:   { n: "Unitaz",     w: 0.4,  d: 0.7,  h: 0.7,  c: "#f1f1ee" },
    sink:     { n: "Lavabo",     w: 0.6,  d: 0.45, h: 0.85, c: "#f1f1ee" },
    desk:     { n: "Ish stoli",  w: 1.4,  d: 0.7,  h: 0.75, c: "#a98a63" },
    plant:    { n: "O'simlik",   w: 0.5,  d: 0.5,  h: 1.2,  c: "#4f8a4f" },
    carpet:   { n: "Gilam",      w: 2.0,  d: 3.0,  h: 0.02, c: "#a4544a" },
    tv:       { n: "Televizor",  w: 1.2,  d: 0.35, h: 0.9,  c: "#2a2f33" },
  };
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];     // zina ko'tarilish yo'nalishi (rot 0..3)

  const round2 = v => Math.round(v * 100) / 100;

  // ---------- To'r ----------
  function size(p) {
    const W = p.bays * p.bay_w, D = p.depth;
    return { W, D, gw: Math.max(2, Math.floor(W)), gd: Math.max(2, Math.floor(D)) };
  }
  // Oxirgi to'r chizig'i devorga tegadi (kasr qoldiq o'sha oxirgi katakka qo'shiladi)
  const lineX = (g, i) => (i >= g.gw ? g.W : i);
  const lineZ = (g, j) => (j >= g.gd ? g.D : j);

  // Qirra kaliti: "h:x,z" — gorizontal (x..x+1, z chizig'ida), "v:x,z" — vertikal (x chizig'ida, z..z+1)
  function edgeSeg(g, key) {
    const m = /^([hv]):(\d{1,3}),(\d{1,3})$/.exec(String(key));
    if (!m) return null;
    const a = +m[2], b = +m[3];
    if (m[1] === "h") {
      if (a < 0 || a >= g.gw || b < 1 || b > g.gd - 1) return null;
      return { horiz: true, x0: lineX(g, a), x1: lineX(g, a + 1), z0: lineZ(g, b), z1: lineZ(g, b) };
    }
    if (a < 1 || a > g.gw - 1 || b < 0 || b >= g.gd) return null;
    return { horiz: false, x0: lineX(g, a), x1: lineX(g, a), z0: lineZ(g, b), z1: lineZ(g, b + 1) };
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
    return g.D >= 10 ? [round2(T + 0.3 + STAIR_W / 2), round2(T + 0.3 + L / 2), 0]
                     : [round2(T + 0.3 + L / 2), round2(T + 0.3 + STAIR_W / 2), 1];
  }
  function fitsStair(p, g, st) {
    if (!Array.isArray(st) || st.length < 3 || !st.every(v => Number.isFinite(Number(v)))) return false;
    const r = stairInfo(p, [Number(st[0]), Number(st[1]), st[2] | 0], g).rect;
    return r.x0 >= T + 0.05 && r.x1 <= g.W - T - 0.05 && r.z0 >= T + 0.05 && r.z1 <= g.D - T - 0.05;
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
        if (r.x0 >= T - 1e-6 && r.x1 <= g.W - T + 1e-6 && r.z0 >= T - 1e-6 && r.z1 <= g.D - T + 1e-6) items.push(t);
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
    const stair = N > 1 ? defaultStair(p, g) : undefined;
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

    const furnish = {
      bedroom(r) { put("bed", 0, r, 0, -1); put("wardrobe", 0, r, -1, 1); put("plant", 0, r, 1, 1); },
      living(r) { put("tv", 0, r, 0, -1); put("carpet", 0, r, 0, 0.1); put("sofa", 2, r, 0, 1); put("table", 0, r, 0, 0); put("plant", 0, r, -1, -1); },
      kitchen(r) { put("kitchen", 0, r, -0.4, -1); put("fridge", 0, r, 1, -1); put("table", 0, r, 0, 0.5); put("chair", 0, r, -0.35, 0.15); put("chair", 2, r, -0.35, 0.95); },
      bath(r) { put("bath", 0, r, -1, -1); put("toilet", 0, r, 1, -1); put("sink", 0, r, 0.35, -1); },
      toilet(r) { put("sink", 0, r, -0.6, -1); put("sink", 0, r, 0, -1); put("toilet", 0, r, 0.7, -1); },
      office(r) {
        [[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.55], [0.5, 0.55]].forEach(([ax, az]) => {
          const before = items.length; put("desk", 0, r, ax, az, 0.6);
          if (items.length > before) { const d = items[items.length - 1]; items.push(["chair", d[1], round2(d[2] + 0.62), 2]); }
        });
        put("plant", 0, r, 1, 1);
      },
      meeting(r) { put("table", 0, r, 0, 0); [-0.45, 0.45].forEach(a => { put("chair", 0, r, a, -0.35, 0.3); put("chair", 2, r, a, 0.35, 0.3); }); },
      reading(r) { put("desk", 0, r, -0.5, -0.5); put("desk", 0, r, 0.5, -0.5); put("desk", 0, r, -0.5, 0.5); put("desk", 0, r, 0.5, 0.5); put("plant", 0, r, 1, 1); },
      hall(r) { put("carpet", 0, r, 0, 0); put("table", 0, r, 0, 0); put("plant", 0, r, -1, -1); put("plant", 0, r, 1, -1); put("sofa", 2, r, 0, 1); },
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

    const one = { e, items };
    const out = { floors: Array.from({ length: N }, () => JSON.parse(JSON.stringify(one))) };
    if (stair) out.stair = stair;
    return out;
  }

  // Tahrirlash uchun: saqlangan ma'lumot bo'lmasa, normallashtirilgan nusxa yaratiladi (zina aniq yoziladi)
  function editable(p, raw) {
    const n = norm(p, raw), out = { floors: n.floors.map(f => ({ e: { ...f.e }, items: f.items.map(i => i.slice()) })) };
    if (p.floors > 1) out.stair = n.stair;
    return out;
  }

  return { T, STAIR_W, DOOR_W, PART, ITEMS, DIRS, size, lineX, lineZ, edgeSeg, wallPieces, itemRect, stairDims, stairInfo, defaultStair, fitsStair, norm, clean, auto, editable };
})();
