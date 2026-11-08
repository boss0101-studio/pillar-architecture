// Loyiha bo'limlari: GP va AR'dan tashqari muhandislik bo'limlari — joriy binodan avtomatik tuziladigan A3 varaqlar (shtamp bilan):
// KR (AS / KJ / KM / KD) konstruksiyalar, OV, VK, EOM, GS, SS, PS / AUPT, TX, POS / PIC, OOS va SM (smeta).
// Hisoblar eskiz bosqichi uchun TAXMINIY: ishchi loyiha uchun mutaxassis hisobi, geologik qidiruv va me'yoriy ekspertiza kerak.
// Ichki reja bo'lmasa, Interior.auto() reja asos qilib olinadi (varaqda ko'rsatiladi).
const UstunRP = (function () {
  const SW = 420, SH = 297, ZONE = { x: 25, y: 10, w: 262, h: 222 }, PX = 292, PW = 123;
  const INK = "#1f2326", GREY = "#9aa1a6", LIGHT = "#c9cdd0", ACC = "#2b4acb";
  const C = { sup: "#c8352b", ret: "#2b6fd0", cold: "#2b6fd0", hot: "#d0462b", sew: "#7a5a3a", gas: "#c08a00", el: "#2b4acb", low: "#6a3fb0", fire: "#d0302b", evac: "#1f8a4c", vent: "#2a9896" };
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n0 = v => Math.round(v).toLocaleString("ru-RU"), n1 = v => (Math.round(v * 10) / 10).toLocaleString("ru-RU"), n2 = v => (Math.round(v * 100) / 100).toLocaleString("ru-RU");
  const up = (list, v) => list.find(x => x >= v - 1e-9) || list[list.length - 1];
  const AXL = "ABVGDEJZIKLMNOPRSTUF";
  const CLIM = { tIn: 20, tOut: -10, tAvg: 3, days: 130 };                // Toshkent: isitish davri (taxminiy)

  const SECTIONS = [
    { k: "gp", c: "GP", n: "Bosh reja", view: "gp", file: "gp.html" },
    { k: "ar", c: "AR", n: "Arxitektura yechimlari", view: "ar", file: "ar.html" },
    { k: "kr", c: "AS / KJ / KM / KD", n: "Konstruksiyalar" },
    { k: "ov", c: "OV / OVK", n: "Isitish, ventilyatsiya, konditsionerlash" },
    { k: "vk", c: "VK", n: "Suv ta'minoti va kanalizatsiya" },
    { k: "eom", c: "EOM / EM", n: "Elektr ta'minoti va yoritish" },
    { k: "gs", c: "GS", n: "Gaz ta'minoti" },
    { k: "ss", c: "SS", n: "Aloqa va signalizatsiya tizimlari" },
    { k: "ps", c: "PS / AUPT", n: "Yong'in signalizatsiyasi va o'chirish" },
    { k: "tx", c: "TX", n: "Texnologik yechimlar" },
    { k: "pos", c: "POS / PIC", n: "Qurilishni tashkil etish loyihasi" },
    { k: "oos", c: "OOS", n: "Atrof-muhitni muhofaza qilish" },
    { k: "sm", c: "SM", n: "Smeta (narx hisob-kitobi)" },
  ];
  const SEC = Object.fromEntries(SECTIONS.map(s => [s.k, s]));
  const SYS = { as: "AS — g'isht devorlar, yig'ma plitalar", kj: "KJ — temir-beton karkas", km: "KM — metall karkas", kd: "KD — yog'och konstruksiyalar" };
  const HEAT = { gaz: "Gaz qozoni", elektr: "Elektr qozon" };

  // ---------- Holat ----------
  let st = { sec: "kr", sys: "", heat: "gaz", rate: 12800 };
  try { st = { ...st, ...JSON.parse(localStorage.getItem("ustun-rp") || "{}") }; } catch {}
  if (!SEC[st.sec] || SEC[st.sec].view) st.sec = "kr";
  const save = () => { try { localStorage.setItem("ustun-rp", JSON.stringify(st)); } catch {} };
  let sheetIdx = 0, houseIdx = 0, current = "";

  // ---------- Loyiha (AR bilan bir xil manba) ----------
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

  // ---------- Bino modeli: xonalar, devorlar, ochiqliklar ----------
  const ROOM_BY = [["bed", "Yotoqxona", "bed"], ["kidsbed", "Bolalar xonasi", "bed"], ["cradle", "Bolalar xonasi", "bed"], ["kitchen", "Oshxona", "kitchen"], ["stove", "Oshxona", "kitchen"],
    ["bath", "Hammom", "bath"], ["shower", "Hammom", "bath"], ["toilet", "Sanuzel", "wc"], ["sofa", "Mehmonxona", "living"], ["tv", "Mehmonxona", "living"],
    ["dining", "Ovqatlanish xonasi", "living"], ["desk", "Ish xonasi", "study"], ["piano", "Mehmonxona", "living"]];
  const WET = { kitchen: 1, bath: 1, wc: 1 };
  const DOOR_RE = /door|garage|shop|arcade/;
  function openingsOf(p, cells) {
    let win = 0, door = 0, winN = 0, doorN = 0;
    const add = (t, w, h) => { const o = OPENING[t]; if (!o || t === "arcade") return; const a = (o[1] - o[0]) * w * (o[3] - o[2]) * h; if (DOOR_RE.test(t)) { door += a; doorN++; } else { win += a; winN++; } };
    const sc = Math.max(1, Math.round(p.depth / p.bay_w)), sw = p.depth / sc;
    for (let f = 0; f < p.floors; f++) {
      for (let b = 0; b < p.bays; b++) { add(cellType(p, cells, f, b), p.bay_w, p.floor_h); add(upperType(p), p.bay_w, p.floor_h); }
      for (let c = 0; c < 2 * sc; c++) add(upperType(p), sw, p.floor_h);
    }
    return { win, door, winN, doorN };
  }
  function model(pr, b) {
    const p = b.params, g = geometry(p), met = metrics(p, b.cells), auto = !b.interior;
    const I = Interior.norm(p, b.interior || Interior.auto(p)), ig = I.g, Tw = Interior.T;
    const rings = ig.outer || [[[0, 0], [0, ig.D], [ig.W, ig.D], [ig.W, 0]]];      // tashqi kontur manfiy aylanadi (offsetRing(r, −d) — ichkariga)
    const perim = rings.reduce((s, r) => s + r.reduce((a, [x, z], i) => { const [x2, z2] = r[(i + 1) % r.length]; return a + Math.hypot(x2 - x, z2 - z); }, 0), 0);
    const LX = i => Interior.lineX(ig, i), LZ = j => Interior.lineZ(ig, j);
    const floors = I.floors.map((fd, f) => {
      const rooms = Interior.roomsOf(ig, fd.e).list.map(cells => {
        const set = new Set(cells.map(c => c.join(",")));
        const area = cells.reduce((s, [i, j]) => s + Interior.cellArea(ig, i, j), 0);
        const cx = cells.reduce((s, [i]) => s + (LX(i) + LX(i + 1)) / 2, 0) / cells.length;
        const cz = cells.reduce((s, [, j]) => s + (LZ(j) + LZ(j + 1)) / 2, 0) / cells.length;
        const inside = it => cells.some(([i, j]) => it[1] >= LX(i) && it[1] < LX(i + 1) && it[2] >= LZ(j) && it[2] < LZ(j + 1));
        const items = fd.items.filter(inside);
        const hit = ROOM_BY.find(([t]) => items.some(it => it[0] === t));
        const name = hit ? hit[1] : items.length ? "Xona" : "Dahliz", type = hit ? hit[2] : items.length ? "room" : "hall";
        // devor qirralari: tashqi (ext) va ichki; bir chiziqdagi qo'shni qirralar birlashtiriladi
        const raw = [];
        cells.forEach(([i, j]) => [[0, 1, "S"], [0, -1, "N"], [1, 0, "E"], [-1, 0, "W"]].forEach(([di, dj, s]) => {
          if (set.has(`${i + di},${j + dj}`)) return;
          const ext = !Interior.cellOn(ig, i + di, j + dj);
          if (s === "S" || s === "N") raw.push({ s, ext, line: s === "S" ? LZ(j + 1) : LZ(j), a0: LX(i), a1: LX(i + 1) });
          else raw.push({ s, ext, line: s === "E" ? LX(i + 1) : LX(i), a0: LZ(j), a1: LZ(j + 1) });
        }));
        raw.sort((a, b) => (a.s + a.ext + a.line).localeCompare(b.s + b.ext + b.line) || a.line - b.line || a.a0 - b.a0);
        const edges = [];
        raw.forEach(e => { const l = edges[edges.length - 1]; if (l && l.s === e.s && l.ext === e.ext && Math.abs(l.line - e.line) < 1e-6 && Math.abs(l.a1 - e.a0) < 1e-6) l.a1 = e.a1; else edges.push({ ...e }); });
        const minX = Math.min(...cells.map(([i]) => LX(i))), maxX = Math.max(...cells.map(([i]) => LX(i + 1)));
        const minZ = Math.min(...cells.map(([, j]) => LZ(j))), maxZ = Math.max(...cells.map(([, j]) => LZ(j + 1)));
        return { cells, set, area, cx, cz, name, type, items, edges, box: { x0: minX, x1: maxX, z0: minZ, z1: maxZ } };
      }).filter(r => r.area >= 0.8).sort((a, b) => a.cz - b.cz || a.cx - b.cx);
      return { fd, rooms };
    });
    const op = openingsOf(p, b.cells);
    // old fasaddagi kirish eshigi (1-qavat): eshik turidagi birinchi katak, bo'lmasa o'rtadagi
    let door = -1; for (let i = 0; i < p.bays; i++) if (DOOR_RE.test(cellType(p, b.cells, 0, i))) { door = i; break; }
    const entry = { x: ((door >= 0 ? door : Math.floor(p.bays / 2)) + 0.5) * p.bay_w, z: ig.D };
    const M = { pr, b, p, g, met, I, ig, Tw, rings, perim, floors, op, auto, entry, LX, LZ,
      cat: p.category, foot: met.floorArea, total: met.totalArea, Hb: g.Hb, W: ig.W, D: ig.D };
    M.ov = calcOV(M); M.vk = calcVK(M); M.eom = calcEOM(M); M.gs = calcGS(M); M.kr = calcKR(M); M.pos = calcPOS(M); M.sm = calcSM(M);
    return M;
  }
  const allRooms = M => M.floors.flatMap((fl, f) => fl.rooms.map(r => ({ ...r, f })));
  const persons = M => Math.max(2, Math.round(M.total / ({ "turar-joy": 30, jamoat: 6, tijorat: 8, interyer: 20 }[M.cat] || 30)));

  // ---------- Hisoblar ----------
  const AC_SIZES = [2.1, 2.6, 3.5, 5.3, 7.0];
  function calcOV(M) {
    const p = M.p, dT = CLIM.tIn - CLIM.tOut, U = (MATERIALS[p.material] || {}).u || 1.1;
    const Awall = Math.max(0, M.perim * M.Hb - M.op.win - M.op.door);
    const parts = [["Tashqi devorlar", U, Awall], ["Derazalar", 2.4, M.op.win], ["Eshiklar", 2.0, M.op.door], ["Tom yopmasi", 0.6, M.foot], ["Pol (yer ustida)", 0.4, M.foot]]
      .map(([n, u, a]) => ({ n, u, a, q: u * a * dT * 1.1 }));                  // +10% — yo'nalish va infiltratsiya qo'shimchasi
    const rooms = allRooms(M), res = M.cat === "turar-joy";
    let L;
    const exh = r => (r.type === "kitchen" ? (st.heat === "gaz" ? 90 : 60) : r.type === "bath" || r.type === "wc" ? 25 : 0);
    if (res) { const live = rooms.filter(r => !WET[r.type] && r.type !== "hall").reduce((s, r) => s + r.area, 0); L = Math.max(rooms.reduce((s, r) => s + exh(r), 0), 3 * live); }
    else L = persons(M) * 40;
    const qTrans = parts.reduce((s, x) => s + x.q, 0), qVent = 0.34 * L * dT, Q = qTrans + qVent;
    const aSum = rooms.reduce((s, r) => s + r.area, 0) || 1;
    const per = rooms.map(r => {
      const q = Q * r.area / aSum, sec = Math.max(r.area > 2 ? 3 : 0, Math.ceil(q / 170));
      const cool = /bed|living|kitchen|study|room/.test(r.type) ? r.area * 0.11 : 0;      // 110 W/m² (janubiy iqlim)
      let units = []; if (cool > 0.4) { let left = cool; while (left > 0.01 && units.length < 4) { const s = up(AC_SIZES, Math.min(left, 7)); units.push(s); left -= s; } }
      return { ...r, q, sec, cool, units, ex: exh(r) };
    });
    const kW = Q / 1000, boiler = up([12, 18, 24, 28, 32, 35, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500], kW * 1.15);
    const annual = kW * 24 * CLIM.days * (CLIM.tIn - CLIM.tAvg) / dT;           // kWh/yil
    const coolKW = per.reduce((s, r) => s + r.units.reduce((a, u) => a + u, 0), 0);
    return { parts, L, qTrans, qVent, Q, kW, boiler, per, annual, coolKW, dT, U };
  }
  const FIX = { toilet: "Unitaz", sink: "Lavabo", bath: "Vanna", shower: "Dush kabinasi", kitchen: "Oshxona moykasi", washer: "Kir yuvish mashinasi", dishwasher: "Idish yuvish mashinasi" };
  function fixturesOf(r) {
    const out = r.items.filter(it => FIX[it[0]]).map(it => ({ t: it[0], x: it[1], z: it[2] }));
    if (!out.length && WET[r.type]) {                                              // reja bo'sh bo'lsa — xona turiga qarab
      const at = (dx, dz) => ({ x: r.box.x0 + 0.5 + dx, z: r.box.z0 + 0.5 + dz });
      (r.type === "bath" ? ["bath", "sink", "toilet"] : r.type === "wc" ? ["toilet", "sink"] : ["kitchen"]).forEach((t, i) => out.push({ t, ...at(i * 0.9, 0) }));
    }
    return out;
  }
  function calcVK(M) {
    const N = persons(M), NORM = { "turar-joy": [250, 100], jamoat: [16, 6], tijorat: [25, 10], interyer: [16, 6] }[M.cat] || [250, 100];
    const fx = M.floors.map(fl => fl.rooms.flatMap(r => fixturesOf(r).map(x => ({ ...x, room: r }))));
    const count = {}; fx.flat().forEach(x => { count[x.t] = (count[x.t] || 0) + 1; });
    const nFix = fx.flat().length, qDay = N * NORM[0] / 1000, qHot = N * NORM[1] / 1000, Kh = M.cat === "turar-joy" ? 2.5 : 2;
    const qH = qDay / 24 * Kh, qs = Math.max(0.3, 0.2 * Math.sqrt(Math.max(1, nFix)) + 0.1);
    const din = Math.sqrt(4 * qs / 1000 / (Math.PI * 1.2)) * 1000, DN = up([20, 25, 32, 40, 50, 63, 75, 90, 110], din * 1.25);
    // stoyak: 1-qavatdagi birinchi ho'l xona (yo'q bo'lsa — markaz)
    const wet = M.floors[0].rooms.find(r => WET[r.type]) || M.floors.flatMap(f => f.rooms).find(r => WET[r.type]);
    const riser = wet ? { x: wet.box.x0 + 0.35, z: wet.box.z0 + 0.35 } : { x: M.W / 2, z: M.D / 2 };
    const heater = st.heat === "gaz" ? (M.ov.kW <= 32 ? "Ikki konturli gaz qozoni (isitish + issiq suv)" : "Bilvosita isitiladigan bak " + up([100, 150, 200, 300, 500, 750, 1000], N * 50) + " l")
      : "Elektr suv isitgich " + up([50, 80, 100, 150, 200, 300], N * 50) + " l";
    return { N, NORM, fx, count, nFix, qDay, qHot, qH, qs, DN, riser, heater, sewDN: M.p.floors > 10 ? 160 : 110 };
  }
  const BREAK = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400];
  const CABLE = [[16, 2.5], [25, 4], [32, 6], [40, 10], [63, 16], [80, 25], [100, 35], [125, 50], [160, 70], [200, 95], [250, 120], [315, 185], [400, 240]];
  const cableFor = I => (CABLE.find(([a]) => a >= I) || CABLE[CABLE.length - 1])[1];
  function calcEOM(M) {
    const res = M.cat === "turar-joy", lightW = res ? 8 : 10;
    const fl = M.floors.map(f => f.rooms.map(r => {
      const lights = Math.max(1, Math.round(r.area / (r.type === "hall" ? 10 : 12)));
      const sockets = r.type === "wc" ? 0 : r.type === "bath" ? 1 : r.type === "kitchen" ? 5 : r.type === "hall" ? 1 : Math.max(2, Math.ceil(r.area / 6));
      return { r, lights, sockets };
    }));
    const PW_ = { fridge: 0.3, washer: 2.2, dishwasher: 1.8, tv: 0.15, boiler: 0.15, stove: st.heat === "gaz" ? 0 : 7.0, aquarium: 0.1 };
    const items = M.floors.flatMap(f => f.fd.items), app = {};
    items.forEach(it => { if (PW_[it[0]] !== undefined && PW_[it[0]] > 0) app[it[0]] = (app[it[0]] || 0) + 1; });
    const area = M.total, Plight = area * lightW / 1000, nSock = fl.flat().reduce((s, x) => s + x.sockets, 0), Psock = nSock * 0.15;
    const Papp = Object.entries(app).reduce((s, [t, n]) => s + PW_[t] * n, 0), Pac = M.ov.coolKW / 3;
    const Pheat = st.heat === "elektr" ? M.ov.kW + 2 * Math.max(1, M.floors[0].rooms.filter(r => r.type === "bath").length) : 0.15;
    const Pinst = Plight + Psock + Papp + Pac + Pheat, Kc = res ? (Pinst > 30 ? 0.4 : 0.55) : M.cat === "jamoat" ? 0.7 : 0.75, Pr = Pinst * Kc;
    const three = Pr > 10, I = three ? Pr * 1000 / (Math.sqrt(3) * 400 * 0.95) : Pr * 1000 / (230 * 0.95), main = up(BREAK, I * 1.1);
    const groups = [];
    M.floors.forEach((_, f) => {
      groups.push({ n: `${f + 1}-qavat yoritish`, p: fl[f].reduce((s, x) => s + x.r.area, 0) * lightW / 1000, a: 10, c: 1.5, rcd: false });
      groups.push({ n: `${f + 1}-qavat rozetkalar`, p: fl[f].reduce((s, x) => s + x.sockets, 0) * 0.15, a: 16, c: 2.5, rcd: true });
    });
    if (app.washer || app.dishwasher) groups.push({ n: "Kir / idish yuvish mashinasi", p: (app.washer || 0) * 2.2 + (app.dishwasher || 0) * 1.8, a: 16, c: 2.5, rcd: true });
    if (st.heat !== "gaz") groups.push({ n: "Elektr plita", p: 7, a: 32, c: 6, rcd: true });
    M.floors.forEach((_, f) => {                                                      // konditsionerlar — qavat bo'yicha bitta guruh
      const kw = M.ov.per.filter(r => r.f === f).reduce((s, r) => s + r.units.reduce((a, u) => a + u, 0), 0) / 3;
      if (kw > 0) { const a = up(BREAK, kw * 1000 / (230 * 0.95) * 1.2); groups.push({ n: `${f + 1}-qavat konditsionerlari`, p: kw, a: Math.max(16, a), c: cableFor(Math.max(16, a)), rcd: false }); }
    });
    if (st.heat === "elektr") groups.push({ n: "Elektr qozon", p: M.ov.kW, a: up(BREAK, M.ov.kW * 1000 / (Math.sqrt(3) * 400 * 0.95) * 1.1), c: cableFor(M.ov.kW * 1000 / (Math.sqrt(3) * 400)), rcd: false });
    else groups.push({ n: "Isitish qozoni (avtomatika)", p: 0.15, a: 10, c: 1.5, rcd: true });
    return { fl, lightW, Plight, nSock, Psock, Papp, Pac, Pheat, Pinst, Kc, Pr, three, I, main, cable: cableFor(main), groups };
  }
  function calcGS(M) {
    const kitchens = allRooms(M).filter(r => r.type === "kitchen");
    const stoves = Math.max(M.cat === "turar-joy" ? 1 : 0, kitchens.length);
    const qStove = 1.2, qBoiler = st.heat === "gaz" ? M.ov.kW / (9.3 * 0.92) : 0;
    const K = stoves + (qBoiler ? 1 : 0) > 1 ? 0.85 : 1, Q = (stoves * qStove + qBoiler) * K;
    const meter = (([[2.5, "G1,6"], [4, "G2,5"], [6, "G4"], [10, "G6"], [16, "G10"], [25, "G16"], [40, "G25"], [65, "G40"]].find(([a]) => a >= Q)) || [0, "G65"])[1];
    const DN = Q <= 3.5 ? 20 : Q <= 7 ? 25 : Q <= 12 ? 32 : Q <= 20 ? 40 : 50;
    const year = qBoiler ? M.ov.annual / (9.3 * 0.92) : 0, yearStove = persons(M) * (M.cat === "turar-joy" ? 120 : 0);
    const checks = kitchens.map(r => ({ r, vol: r.area * M.p.floor_h, ok: r.area * M.p.floor_h >= 15, win: r.edges.some(e => e.ext) }));
    return { stoves, qStove, qBoiler, K, Q, meter, DN, year, yearStove, checks, kitchens };
  }
  function calcKR(M) {
    const p = M.p, mat = p.material;
    const sys = SYS[st.sys] ? st.sys : /beton|qorabeton/.test(mat) ? "kj" : /metall|shisha/.test(mat) ? "km" : mat === "yogoch" ? "kd" : "as";
    const D = M.D, W = M.W, spanMax = { as: 7.2, kj: 6.6, km: 9, kd: 4.5 }[sys];
    const nZ = Math.max(1, Math.ceil(D / spanMax - 1e-9)), axZ = [...Array(nZ + 1).keys()].map(i => D * i / nZ), span = D / nZ;
    const axX = [...Array(p.bays + 1).keys()].map(i => i * p.bay_w);
    const FD = 1.2, live = { "turar-joy": 1.5, jamoat: 4.0, tijorat: 2.0, interyer: 2.0 }[M.cat] || 2;
    const dead = { as: 7.5, kj: 8.0, km: 5.5, kd: 3.0 }[sys], roof = dead + 1.5 + 0.5;                // kPa: yopma + pol + to'siqlar; tom + qor
    const wallW = M.perim * M.Hb * M.Tw * ((MATERIALS[mat] || {}).dens || 1800) * 9.81 / 1000 * (sys === "as" ? 1 : 0.35);   // karkasda devor — to'ldirish
    const N = M.foot * (p.floors * (dead + live) + roof) + wallW;                                    // kN
    // poydevor
    let fArea, fVol, fNote;
    const inner = sys === "as" && nZ > 1 ? (nZ - 1) * W : 0;
    if (sys === "as" || sys === "kd") { const b = sys === "as" ? 0.6 : 0.5; fArea = (M.perim + inner) * b; fVol = fArea * FD; fNote = `Lentasimon poydevor, b = ${b * 1000} mm`; }
    else {
      const pts = axX.flatMap(x => axZ.map(z => [x, z])).filter(([x, z]) => inPlan(M, x, z)), a = sys === "kj" ? 1.8 : 1.5;
      fArea = pts.length * a * a; fVol = fArea * 0.6 + pts.length * 0.5 * 0.5 * (FD - 0.6) + (axX.length * D + axZ.length * W) * 0.4 * 0.5;
      fNote = `Ustunosti poydevorlar ${a * 1000}×${a * 1000} mm (${pts.length} dona) + rostverk 400×500`;
    }
    const R0 = 200, press = N / fArea;
    // materiallar
    const mats = [];
    const conc = (n, v, kg) => { mats.push([n, "m³", v]); return v * kg; };
    let rebar = conc("Beton B20 — poydevor", fVol, 70);
    const cols = axX.flatMap(x => axZ.map(z => [x, z])).filter(([x, z]) => inPlan(M, x, z)).length;
    if (sys === "as") {
      const wallV = Math.max(0, M.perim * M.Hb - M.op.win - M.op.door) * M.Tw + inner * M.Hb * 0.38;
      mats.push(["G'isht (ming dona)", "ming", wallV * 0.4]); mats.push(["Qorishma M75", "m³", wallV * 0.23]);
      rebar += conc("Beton B20 — seysmik kamarlar", (M.perim + inner) * M.Tw * 0.3 * p.floors, 120);
      mats.push(["Yig'ma plitalar PK (" + n2(span + 0.2) + " m)", "dona", Math.floor(W / 1.2) * nZ * p.floors]);
    } else if (sys === "kj") {
      rebar += conc("Beton B25 — yopmalar h=220", M.foot * 0.22 * p.floors, 95);
      rebar += conc("Beton B25 — ustunlar 400×400", cols * 0.16 * M.Hb, 180);
      rebar += conc("Beton B25 — rigellar 400×500", (axX.length * D + axZ.length * W) * 0.2 * 0.5 * p.floors, 150);
    } else if (sys === "km") {
      mats.push(["Po'lat konstruksiyalar (C255)", "t", M.foot * p.floors * (35 + 2 * p.floors) / 1000]);
      rebar += conc("Beton B20 — profnastil ustida h=120", M.foot * 0.09 * p.floors, 40);
      mats.push(["Profnastil H75", "m²", M.foot * p.floors]);
    } else {
      const h = Math.ceil(span * 1000 / 18 / 25) * 25, b = h > 175 ? 150 : 100, n = Math.ceil(W / 0.6) + 1;
      mats.push([`Yog'och to'sinlar ${b}×${h} (qarag'ay, 2-nav)`, "m³", n * span * nZ * b * h / 1e6 * p.floors]);
      mats.push(["Yog'och ustunlar 150×150", "m³", cols * 0.0225 * M.Hb]);
      mats.push(["OSB-3 plita 22 mm", "m²", M.foot * p.floors]);
    }
    mats.push(["Armatura A500C", "t", rebar / 1000]);
    const beam = sys === "km" ? "IPE" + up([200, 220, 240, 270, 300, 330, 360, 400, 450, 500, 550, 600], span * 1000 / 20) : "";
    const col = sys === "km" ? "HEB" + (p.floors <= 2 ? 200 : p.floors <= 5 ? 260 : 300) : "";
    const kdH = Math.ceil(span * 1000 / 18 / 25) * 25;
    return { sys, axX, axZ, span, nZ, FD, live, dead, roof, N, fArea, fVol, fNote, press, R0, mats, beam, col, kdH, inner, wallW };
  }
  function inPlan(M, x, z) {
    if (!M.ig.outer) return x >= -1e-6 && x <= M.W + 1e-6 && z >= -1e-6 && z <= M.D + 1e-6;
    return [[0.05, 0.05], [-0.05, 0.05], [0.05, -0.05], [-0.05, -0.05]].some(([a, b]) => Interior.inRings(M.ig.outer, x + a, z + b));
  }
  function calcPOS(M) {
    const p = M.p, kr = M.kr, area = M.total, foot = M.foot;
    const exc = (M.W + 2) * (M.D + 2) * (kr.FD + 0.3);
    const W = [
      ["Tayyorlov ishlari", "", 0, 5 + area / 400],
      ["Yer ishlari (kotlovan)", "m³", exc, 2 + exc / 150],
      ["Poydevor", "m³", kr.fVol, 7 + kr.fVol / 12],
      ["Karkas / devorlar va yopmalar", "m²", area, p.floors * Math.max(10, foot / 10)],
      ["Tom", "m²", foot, 5 + foot / 25],
      ["Deraza va eshiklar", "dona", M.op.winN + M.op.doorN, 3 + (M.op.winN + M.op.doorN) / 10],
      ["Muhandislik tarmoqlari (OV, VK, EOM, GS, SS, PS)", "m²", area, 10 + area / 25],
      ["Fasad ishlari", "m²", M.perim * M.Hb, 7 + M.perim * M.Hb / 50],
      ["Ichki pardozlash", "m²", area, 10 + area / 15],
      ["Obodonlashtirish", "m²", foot * 1.5, 7 + foot / 60],
      ["Topshirish", "", 0, 5],
    ].map(([n, u, v, d]) => ({ n, u, v, d: Math.max(2, Math.round(d)) }));
    // ketma-ketlik: oldingi ish tugagach yoki uning bir qismi bajarilgach (parallel oqim)
    const end = i => W[i].s + W[i].d, part = (i, k) => W[i].s + Math.round(W[i].d * k);
    W[0].s = 0; W[1].s = end(0); W[2].s = end(1); W[3].s = end(2); W[4].s = end(3);
    W[5].s = part(3, 0.6); W[6].s = part(3, 0.5); W[7].s = part(4, 0.5); W[8].s = Math.max(end(4), part(6, 0.5)); W[9].s = part(8, 0.6);
    W[10].s = Math.max(...W.slice(0, 10).map((_, i) => end(i)));
    const total = W[10].s + W[10].d, workers = Math.max(6, Math.round(area / 40));
    const crane = p.floors >= 3 ? "Minorali kran" : "Avtokran 25 t";
    const reach = Math.hypot(M.W / 2 + 4, M.D + 4);
    return { works: W, total, workers, crane, reach, exc };
  }
  const WALL_PRICE = { gisht: 45, oqgisht: 50, beton: 55, qorabeton: 60, ganch: 40, travertin: 85, tosh: 75, koshin: 90, yogoch: 50, metall: 70, shisha: 160 };
  const ROOF_PRICE = { tekis: 45, nishab: 50, bir: 45, piramida: 55, gumbaz: 95, terrasa: 70 };
  const QK = { standart: 1.0, biznes: 1.35, premium: 1.8 };
  function calcSM(M) {
    const p = M.p, kr = M.kr, area = M.total, q = QK[p.quality] || 1.35;
    const partLen = M.floors.reduce((s, fl) => s + Object.keys(fl.fd.e).length, 0);   // 1 m'lik qirralar
    const tx = M.floors.reduce((s, fl) => s + fl.fd.items.filter(it => (Interior.ITEMS[it[0]] || {}).g === "texnika" || (Interior.ITEMS[it[0]] || {}).g === "hammom").length, 0);
    const R = (sec, n, u, v, pr) => ({ sec, n, u, v, pr, s: v * pr });
    const rows = [
      R("AS / KJ", "Yer ishlari", "m³", M.pos.exc, 6),
      R("AS / KJ", "Poydevor (beton, armatura)", "m³", kr.fVol, 140),
      R("AR", "Tashqi devorlar: " + ((MATERIALS[p.material] || {}).label || p.material), "m²", Math.max(0, M.perim * M.Hb - M.op.win - M.op.door), WALL_PRICE[p.material] || 50),
      R("AS / KJ", "Karkas va yopmalar (" + kr.sys.toUpperCase() + ")", "m²", M.foot * p.floors, { as: 55, kj: 75, km: 85, kd: 45 }[kr.sys]),
      R("AR", "Tom", "m²", M.foot, ROOF_PRICE[p.roof] || 50),
      R("AR", "Derazalar", "m²", M.op.win, 120),
      R("AR", "Eshiklar", "dona", M.op.doorN + M.floors.reduce((s, fl) => s + Object.values(fl.fd.e).filter(v => v === 2).length, 0), 250),
      R("AR", "Ichki devorlar", "m²", partLen * p.floor_h, 30),
      R("OV", "Isitish, ventilyatsiya, konditsioner", "m²", area, 28),
      R("VK", "Suv ta'minoti va kanalizatsiya", "m²", area, 22),
      R("EOM", "Elektr ta'minoti va yoritish", "m²", area, 25),
      R("GS", "Gaz ta'minoti", "kompl.", st.heat === "gaz" || M.gs.stoves ? 1 : 0, 1500 + area * 4),
      R("SS", "Aloqa va signalizatsiya", "m²", area, 8),
      R("PS", needSprinkler(M) ? "Yong'in signalizatsiyasi va AUPT" : "Yong'in signalizatsiyasi", "m²", area, needSprinkler(M) ? 30 : 6),
      R("AR", "Ichki pardozlash", "m²", area, 90 * q),
      R("AR", "Fasad pardozi", "m²", M.perim * M.Hb, 25 * q),
      R("TX", "Texnologik uskunalar (maishiy texnika, santexnika)", "dona", tx, 450 * q),
      R("GP", "Obodonlashtirish", "m²", M.foot * 1.5, 18),
    ].filter(r => r.v > 0);
    const direct = rows.reduce((s, r) => s + r.s, 0);
    const add = [["Ustama xarajatlar", 0.12], ["Smeta foydasi", 0.08], ["Kutilmagan xarajatlar", 0.05], ["Loyihalash va ekspertiza", 0.06]];
    let sub = direct; const adds = add.map(([n, k]) => { const v = direct * k; sub += v; return { n, k, v }; });
    const vat = sub * 0.12, total = sub + vat;
    return { rows, direct, adds, sub, vat, total, perM2: total / Math.max(1, area) };
  }
  const needSprinkler = M => M.cat !== "turar-joy" && M.total >= 1000;

  // ---------- Varaq: ramka, shtamp, jadval, shartli belgilar ----------
  function frame(o, M, sec, title, num, total, scale) {
    const T = (x, y, s, size, a = "middle", w = "", fill = INK) => o.push(`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${a}"${w ? ` font-weight="${w}"` : ""} fill="${fill}">${esc(s)}</text>`);
    const sx = SW - 5 - 185, sy = SH - 5 - 55, S = SEC[sec];
    o.push(`<rect x="20" y="5" width="${SW - 25}" height="${SH - 10}" fill="none" stroke="${INK}" stroke-width="0.7"/>`);
    o.push(`<rect x="${sx}" y="${sy}" width="185" height="55" fill="#fff" stroke="${INK}" stroke-width="0.7"/>`);
    o.push(`<path d="M${sx} ${sy + 15}h185M${sx} ${sy + 30}h185M${sx + 70} ${sy + 30}v25M${sx + 120} ${sy + 30}v25M${sx + 120} ${sy + 42}h65M${sx + 140} ${sy + 30}v25M${sx + 160} ${sy + 30}v25" stroke="${INK}" stroke-width="0.4" fill="none"/>`);
    T(sx + 92.5, sy + 9.5, (M.pr.name || "Loyiha").slice(0, 60), 4.2, "middle", "700");
    T(sx + 92.5, sy + 23.5, `${S.n} (${S.c})`, S.n.length > 30 ? 2.8 : 3.2);
    T(sx + 35, sy + 40.5, title, title.length > 24 ? 2.7 : title.length > 16 ? 3.4 : 4.4, "middle", "700");
    T(sx + 35, sy + 48.5, scale ? `M 1:${scale}` : "", 3);
    T(sx + 95, sy + 39, "Pillar Architecture", 3);
    T(sx + 95, sy + 46.5, `Sana: ${new Date().toLocaleDateString("ru-RU")}`, 2.6);
    [["Bosqich", "P"], ["Varaq", String(num)], ["Varaqlar", String(total)]].forEach(([h, v], i) => { T(sx + 130 + i * 20, sy + 36.8, h, 2.1); T(sx + 130 + i * 20, sy + 50, v, 3.4, "middle", "700"); });
    T(SW - 8, 10.5, `${S.c.split(" / ")[sec === "kr" ? ["as", "kj", "km", "kd"].indexOf(M.kr.sys) : 0] || S.c}-${num}`, 4, "end", "700");
    return T;
  }
  const wrap = o => `<svg class="ar-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW}mm" height="${SH}mm" font-family="Arial Narrow, Arial, sans-serif">
    <defs><pattern id="rpHatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.2" height="1.2" fill="#e6e8ea"/><path d="M0 0V1.2" stroke="${GREY}" stroke-width="0.25"/></pattern>
    <pattern id="rpFound" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#d9dcdf"/><path d="M0 0V1.6" stroke="${INK}" stroke-width="0.3"/></pattern>
    <marker id="rpArr" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L6 3L0 6Z" fill="${C.evac}"/></marker></defs>
    <rect width="${SW}" height="${SH}" fill="#fff"/>${o.join("")}</svg>`;
  function table(o, T, x, y, w, title, head, rows, cols, opt = {}) {
    if (title) { T(x + w / 2, y + 3, title, 3, "middle", "700"); y += 5; }
    const rh = opt.rh || 4.6, all = [head, ...rows], fs = opt.fs || 2.2;
    o.push(`<rect x="${x}" y="${y}" width="${w}" height="${all.length * rh}" fill="none" stroke="${INK}" stroke-width="0.35"/>`);
    let cx = x; cols.forEach((c, j) => { if (j) o.push(`<path d="M${cx} ${y}v${all.length * rh}" stroke="${INK}" stroke-width="0.2"/>`); cx += c; });
    all.forEach((r, i) => {
      if (i) o.push(`<path d="M${x} ${y + i * rh}h${w}" stroke="${INK}" stroke-width="${i === 1 ? 0.35 : 0.15}"/>`);
      const bold = !i || (opt.boldLast && i === all.length - 1);
      let xx = x; r.forEach((cell, j) => {
        const s = String(cell), max = Math.floor(cols[j] / (fs * 0.48)), txt = s.length > max ? s.slice(0, Math.max(1, max - 1)) + "…" : s;
        o.push(`<text x="${j ? xx + cols[j] / 2 : xx + 1.2}" y="${y + i * rh + rh * 0.72}" font-size="${i ? fs : fs - 0.1}" text-anchor="${j ? "middle" : "start"}"${bold ? ' font-weight="700"' : ""} fill="${opt.warn && opt.warn(i - 1, j) ? C.fire : INK}">${esc(txt)}</text>`);
        xx += cols[j];
      });
    });
    return y + all.length * rh + 5;
  }
  function legend(o, T, x, y, items, title = "Shartli belgilar") {
    T(x, y + 3, title, 3, "start", "700"); y += 6;
    items.forEach(([sym, label]) => { o.push(sym(x + 4, y)); T(x + 11, y + 1, label, 2.3, "start"); y += 5.2; });
    return y + 3;
  }
  function notes(T, x, y, lines, w = PW) {
    const per = Math.floor(w / 1.12);
    lines.forEach(s => { const words = String(s).split(" "); let line = ""; words.forEach(wd => { if ((line + " " + wd).trim().length > per) { T(x, y, line.trim(), 2.25, "start"); y += 3.4; line = wd; } else line += " " + wd; }); if (line.trim()) { T(x, y, line.trim(), 2.25, "start"); y += 3.4; } y += 0.8; });
    return y;
  }

  // ---------- Asos reja (devorlar, xonalar, o'qlar) ----------
  function fitScale(W, D, padW = 50, padH = 58) { return [50, 75, 100, 150, 200, 250, 300].find(s => W * 1000 / s <= ZONE.w - padW && D * 1000 / s <= ZONE.h - padH) || 300; }
  function planBase(o, T, M, f, opt = {}) {
    const W = M.W, D = M.D, Tw = M.Tw, scale = fitScale(W, D), k = 1000 / scale;
    const ox = ZONE.x + (ZONE.w - W * k) / 2, oy = ZONE.y + (ZONE.h - D * k) / 2 + 2;
    const X = x => +(ox + x * k).toFixed(2), Z = z => +(oy + z * k).toFixed(2);
    const fl = M.floors[f], ig = M.ig;
    // o'qlar va umumiy o'lchamlar
    const axX = opt.axX || [...Array(M.p.bays + 1).keys()].map(i => i * M.p.bay_w), axZ = opt.axZ || [0, D];
    const rA = 3, top = Z(0) - 18, bot = Z(D) + 18, left = X(0) - 18;
    axX.forEach((x, i) => {
      o.push(`<path d="M${X(x)} ${top + rA}V${bot - rA}" stroke="${GREY}" stroke-width="0.13" stroke-dasharray="8 1.5 1 1.5"/>`);
      [top, bot].forEach(y => { o.push(`<circle cx="${X(x)}" cy="${y}" r="${rA}" fill="#fff" stroke="${INK}" stroke-width="0.3"/>`); T(X(x), y + 1.1, String(i + 1), 3); });
    });
    axZ.forEach((z, i) => {
      o.push(`<path d="M${left + rA} ${Z(z)}H${X(W) + 10}" stroke="${GREY}" stroke-width="0.13" stroke-dasharray="8 1.5 1 1.5"/>`);
      o.push(`<circle cx="${left}" cy="${Z(z)}" r="${rA}" fill="#fff" stroke="${INK}" stroke-width="0.3"/>`); T(left, Z(z) + 1.1, AXL[i] || "?", 3);
    });
    const dy = Z(D) + 8; o.push(`<path d="M${X(0)} ${dy}H${X(W)}M${X(0)} ${dy - 2}v4M${X(W)} ${dy - 2}v4" stroke="${INK}" stroke-width="0.2"/>`); T((X(0) + X(W)) / 2, dy - 0.9, n2(W), 2.3);
    const dx = X(0) - 8; o.push(`<path d="M${dx} ${Z(0)}V${Z(D)}M${dx - 2} ${Z(0)}h4M${dx - 2} ${Z(D)}h4" stroke="${INK}" stroke-width="0.2"/>`);
    o.push(`<text x="${dx - 1}" y="${(Z(0) + Z(D)) / 2}" font-size="2.3" text-anchor="middle" fill="${INK}" transform="rotate(-90 ${dx - 1} ${(Z(0) + Z(D)) / 2})">${n2(D)}</text>`);
    if (opt.outline) {                                                   // faqat kontur (poydevor/karkas rejalari)
      const ring = r => "M" + r.map(([x, z]) => `${X(x)} ${Z(z)}`).join("L") + "Z";
      o.push(`<path d="${M.rings.map(ring).join("")}" fill="none" stroke="${GREY}" stroke-width="0.3" stroke-dasharray="2 1"/>`);
      return { X, Z, k, scale };
    }
    const rect = (r, a) => o.push(`<rect x="${X(r.x0)}" y="${Z(r.z0)}" width="${+((r.x1 - r.x0) * k).toFixed(2)}" height="${+((r.z1 - r.z0) * k).toFixed(2)}" ${a}/>`);
    const ring = r => "M" + r.map(([x, z]) => `${X(x)} ${Z(z)}`).join("L") + "Z";
    if (ig.outer) o.push(`<path d="${ig.outer.map(ring).join("")}${ig.inner.map(ring).join("")}" fill="url(#rpHatch)" fill-rule="evenodd" stroke="${GREY}" stroke-width="0.35"/>`);
    else o.push(`<path d="M${X(0)} ${Z(0)}H${X(W)}V${Z(D)}H${X(0)}Z M${X(Tw)} ${Z(Tw)}V${Z(D - Tw)}H${X(W - Tw)}V${Z(Tw)}Z" fill="url(#rpHatch)" fill-rule="evenodd" stroke="${GREY}" stroke-width="0.35"/>`);
    for (const [key, s] of Object.entries(fl.fd.e)) {
      const seg = Interior.edgeSeg(ig, key); if (!seg) continue;
      Interior.wallPieces(seg, s).walls.forEach(r => rect(r, `fill="${LIGHT}" stroke="${GREY}" stroke-width="0.12"`));
    }
    if (M.I.stair && M.p.floors > 1) {
      const si = Interior.stairInfo(M.p, M.I.stair, ig), r = si.rect, n = si.n, along = !!si.dir[1];
      rect(r, `fill="#fff" stroke="${GREY}" stroke-width="0.25"`);
      let d = ""; for (let i = 1; i < n; i++) d += along ? `M${X(r.x0)} ${Z(r.z0 + (r.z1 - r.z0) * i / n)}H${X(r.x1)}` : `M${X(r.x0 + (r.x1 - r.x0) * i / n)} ${Z(r.z0)}V${Z(r.z1)}`;
      o.push(`<path d="${d}" stroke="${GREY}" stroke-width="0.12"/>`);
      M._stair = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
    } else M._stair = null;
    if (opt.furn) fl.fd.items.forEach(it => { const d = Interior.ITEMS[it[0]]; if (!d || d.m || it[0] === "carpet") return; rect(Interior.itemRect(it), `fill="none" stroke="${LIGHT}" stroke-width="0.15"`); });
    if (opt.labels !== false) fl.rooms.forEach(r => { T(X(r.cx), Z(r.cz) + (opt.labelDy || 0), r.name, 2.1, "middle", "", GREY); T(X(r.cx), Z(r.cz) + (opt.labelDy || 0) + 2.8, n1(r.area) + " m²", 1.9, "middle", "", GREY); });
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, opt.title || `${f + 1}-qavat rejasi`, 3.6, "middle", "700");
    if (M.auto) T(ZONE.x + 1, ZONE.y + ZONE.h + 4, "Ichki reja chizilmagan — avto reja asosida. Konstruktor → Ichki makon'da o'zgartiring.", 2.2, "start", "", C.fire);
    return { X, Z, k, scale };
  }
  // tashqi devor bo'ylab joy (radiator, rozetka) — xona ichiga devor qalinligicha suriladi
  function wallSpot(M, e, t = 0.5, inset = 0.12) {
    const a = e.a0 + (e.a1 - e.a0) * t, d = e.ext ? M.Tw + inset : Interior.PART / 2 + inset;
    if (e.s === "S") return { x: a, z: e.line - d, horiz: true };
    if (e.s === "N") return { x: a, z: e.line + d, horiz: true };
    if (e.s === "E") return { x: e.line - d, z: a, horiz: false };
    return { x: e.line + d, z: a, horiz: false };
  }
  const bestExt = r => r.edges.filter(e => e.ext).sort((a, b) => (b.s === "S") - (a.s === "S") || (b.a1 - b.a0) - (a.a1 - a.a0))[0] || null;
  const longest = r => r.edges.slice().sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0));

  // Belgilar (varaq mm'da)
  const sym = {
    rad: (x, y, c = C.sup) => `<rect x="${x - 3}" y="${y - 0.8}" width="6" height="1.6" fill="#fff" stroke="${c}" stroke-width="0.35"/><path d="M${x - 2} ${y - 0.8}v1.6M${x - 1} ${y - 0.8}v1.6M${x} ${y - 0.8}v1.6M${x + 1} ${y - 0.8}v1.6M${x + 2} ${y - 0.8}v1.6" stroke="${c}" stroke-width="0.2"/>`,
    ac: (x, y) => `<rect x="${x - 3}" y="${y - 1}" width="6" height="2" fill="#fff" stroke="${C.ret}" stroke-width="0.3" stroke-dasharray="0.8 0.5"/><text x="${x}" y="${y + 0.8}" font-size="1.7" text-anchor="middle" fill="${C.ret}">K</text>`,
    vent: (x, y) => `<rect x="${x - 1.4}" y="${y - 1.4}" width="2.8" height="2.8" fill="#fff" stroke="${C.vent}" stroke-width="0.3"/><path d="M${x - 1.4} ${y - 1.4}l2.8 2.8M${x + 1.4} ${y - 1.4}l-2.8 2.8" stroke="${C.vent}" stroke-width="0.25"/>`,
    boiler: (x, y, c = C.sup, l = "QK") => `<rect x="${x - 2.4}" y="${y - 2.4}" width="4.8" height="4.8" fill="#fff" stroke="${c}" stroke-width="0.45"/><text x="${x}" y="${y + 0.9}" font-size="2" text-anchor="middle" font-weight="700" fill="${c}">${l}</text>`,
    riser: (x, y, c) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#fff" stroke="${c}" stroke-width="0.4"/><circle cx="${x}" cy="${y}" r="0.45" fill="${c}"/>`,
    fix: (x, y, c = C.cold) => `<rect x="${x - 1.3}" y="${y - 1}" width="2.6" height="2" rx="0.6" fill="#fff" stroke="${c}" stroke-width="0.3"/>`,
    light: (x, y) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff" stroke="${C.el}" stroke-width="0.3"/><path d="M${x - 1} ${y - 1}l2 2M${x + 1} ${y - 1}l-2 2" stroke="${C.el}" stroke-width="0.25"/>`,
    sock: (x, y) => `<path d="M${x - 1.3} ${y}a1.3 1.3 0 0 1 2.6 0Z" fill="#fff" stroke="${C.el}" stroke-width="0.3"/><path d="M${x} ${y - 1.3}v-0.9" stroke="${C.el}" stroke-width="0.3"/>`,
    board: (x, y, l = "ShR", c = C.el) => `<rect x="${x - 3}" y="${y - 1.6}" width="6" height="3.2" fill="${c}" stroke="${c}" stroke-width="0.3"/><text x="${x}" y="${y + 0.8}" font-size="1.9" text-anchor="middle" font-weight="700" fill="#fff">${l}</text>`,
    valve: (x, y, c = C.gas) => `<path d="M${x - 1.4} ${y - 1}L${x + 1.4} ${y + 1}V${y - 1}L${x - 1.4} ${y + 1}Z" fill="${c}" stroke="${c}" stroke-width="0.2"/>`,
    stove: (x, y) => `<rect x="${x - 1.8}" y="${y - 1.8}" width="3.6" height="3.6" fill="#fff" stroke="${C.gas}" stroke-width="0.35"/>${[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([a, b]) => `<circle cx="${x + a}" cy="${y + b}" r="0.55" fill="none" stroke="${C.gas}" stroke-width="0.25"/>`).join("")}`,
    data: (x, y) => `<path d="M${x - 1.3} ${y + 1}h2.6l-1.3 -2.2Z" fill="#fff" stroke="${C.low}" stroke-width="0.3"/>`,
    wifi: (x, y) => `<circle cx="${x}" cy="${y}" r="1.5" fill="#fff" stroke="${C.low}" stroke-width="0.3"/><path d="M${x - 2.6} ${y - 1.6}a3 3 0 0 1 5.2 0M${x - 3.6} ${y - 2.4}a4.4 4.4 0 0 1 7.2 0" fill="none" stroke="${C.low}" stroke-width="0.25"/>`,
    cam: (x, y) => `<path d="M${x - 1.6} ${y - 1}h2.4v2h-2.4Z M${x + 0.8} ${y - 0.4}l1.4 -0.8v2.4l-1.4 -0.8" fill="#fff" stroke="${C.low}" stroke-width="0.3"/>`,
    pir: (x, y) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#fff" stroke="${C.low}" stroke-width="0.3"/><text x="${x}" y="${y + 0.7}" font-size="1.6" text-anchor="middle" fill="${C.low}">D</text>`,
    smoke: (x, y) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff" stroke="${C.fire}" stroke-width="0.35"/><path d="M${x - 0.6} ${y + 0.6}q0.6 -1.2 0 -1.2q0.6 0 0.6 -0.6" fill="none" stroke="${C.fire}" stroke-width="0.25"/><circle cx="${x}" cy="${y}" r="0.4" fill="${C.fire}"/>`,
    heat: (x, y) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff" stroke="${C.fire}" stroke-width="0.35"/><text x="${x}" y="${y + 0.75}" font-size="1.8" text-anchor="middle" font-weight="700" fill="${C.fire}">T</text>`,
    call: (x, y) => `<rect x="${x - 1.3}" y="${y - 1.3}" width="2.6" height="2.6" fill="${C.fire}"/><circle cx="${x}" cy="${y}" r="0.6" fill="#fff"/>`,
    siren: (x, y) => `<path d="M${x - 1.4} ${y + 1.2}L${x} ${y - 1.4}L${x + 1.4} ${y + 1.2}Z" fill="#fff" stroke="${C.fire}" stroke-width="0.35"/>`,
    ext: (x, y) => `<rect x="${x - 0.8}" y="${y - 1.6}" width="1.6" height="3.2" rx="0.6" fill="${C.fire}"/>`,
    spr: (x, y) => `<circle cx="${x}" cy="${y}" r="1" fill="none" stroke="${C.ret}" stroke-width="0.3"/><path d="M${x - 1} ${y}h2M${x} ${y - 1}v2" stroke="${C.ret}" stroke-width="0.25"/>`,
    tag: (x, y, n, c = INK) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff" stroke="${c}" stroke-width="0.3"/><text x="${x}" y="${y + 0.75}" font-size="2" text-anchor="middle" font-weight="700" fill="${c}">${n}</text>`,
    line: c => (x, y) => `<path d="M${x - 3.5} ${y}h7" stroke="${c}" stroke-width="0.45"/>`,
    dash: c => (x, y) => `<path d="M${x - 3.5} ${y}h7" stroke="${c}" stroke-width="0.45" stroke-dasharray="1.2 0.7"/>`,
  };
  const orth = (o, X, Z, a, b, c, w = 0.35, dash = "") => o.push(`<path d="M${X(a.x)} ${Z(a.z)}H${X(b.x)}V${Z(b.z)}" fill="none" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
  // xona ichida n ta nuqta (katak markazlari bo'yicha bir tekis)
  function spread(M, r, n) {
    const cs = r.cells.map(([i, j]) => ({ x: (M.LX(i) + M.LX(i + 1)) / 2, z: (M.LZ(j) + M.LZ(j + 1)) / 2 }))
      .filter(c => c.x > r.box.x0 + 0.4 && c.x < r.box.x1 - 0.4 && c.z > r.box.z0 + 0.4 && c.z < r.box.z1 - 0.4);
    const pool = cs.length ? cs : [{ x: r.cx, z: r.cz }];
    if (n <= 1) { const c = pool.reduce((a, b) => (Math.hypot(b.x - r.cx, b.z - r.cz) < Math.hypot(a.x - r.cx, a.z - r.cz) ? b : a)); return [c]; }
    const out = []; for (let i = 0; i < n; i++) out.push(pool[Math.floor((i + 0.5) * pool.length / n)]);
    return out;
  }

  // =====================================================================
  // KR — konstruksiyalar
  // =====================================================================
  function krFound(M, num, total) {
    const o = [], kr = M.kr, T = frame(o, M, "kr", "Poydevor rejasi", num, total, fitScale(M.W, M.D));
    const P = planBase(o, T, M, 0, { outline: true, axZ: kr.axZ, title: "Poydevorlar rejasi" }), { X, Z, k } = P;
    const ring = r => "M" + r.map(([x, z]) => `${X(x)} ${Z(z)}`).join("L") + "Z";
    if (kr.sys === "as" || kr.sys === "kd") {
      const b = kr.sys === "as" ? 0.6 : 0.5, c = M.Tw / 2;
      const outR = M.rings.map(r => offsetRing(r, -c + b / 2)), inR = M.rings.map(r => offsetRing(r, -c - b / 2));
      o.push(`<path d="${outR.map(ring).join("")}${inR.map(ring).join("")}" fill="url(#rpFound)" fill-rule="evenodd" stroke="${INK}" stroke-width="0.4"/>`);
      kr.axZ.slice(1, -1).forEach(z => o.push(`<rect x="${X(c)}" y="${Z(z - b / 2)}" width="${(M.W - 2 * c) * k}" height="${b * k}" fill="url(#rpFound)" stroke="${INK}" stroke-width="0.4"/>`));
      T(X(M.W / 2), Z(0) + b * k + 4, `FL-1 (b=${b * 1000})`, 2.4, "middle", "700");
    } else {
      const a = kr.sys === "kj" ? 1.8 : 1.5;
      kr.axX.forEach(x => o.push(`<path d="M${X(x)} ${Z(0)}V${Z(M.D)}" stroke="${GREY}" stroke-width="${0.4 * k}" stroke-opacity=".35"/>`));
      kr.axZ.forEach(z => o.push(`<path d="M${X(0)} ${Z(z)}H${X(M.W)}" stroke="${GREY}" stroke-width="${0.4 * k}" stroke-opacity=".35"/>`));
      kr.axX.forEach(x => kr.axZ.forEach(z => { if (!inPlan(M, x, z)) return;
        o.push(`<rect x="${X(x - a / 2)}" y="${Z(z - a / 2)}" width="${a * k}" height="${a * k}" fill="url(#rpFound)" stroke="${INK}" stroke-width="0.35"/><rect x="${X(x) - 0.25 * k}" y="${Z(z) - 0.25 * k}" width="${0.5 * k}" height="${0.5 * k}" fill="#fff" stroke="${INK}" stroke-width="0.3"/>`); }));
      T(X(0) + 2, Z(0) - 3, `Fm-1 ${a * 1000}×${a * 1000}, h=600 (${kr.fNote.match(/\((\d+)/)[1]} dona)`, 2.4, "start", "700");
    }
    let y = table(o, T, PX, ZONE.y + 4, PW, "Yuklamalar va gruntga bosim", ["Ko'rsatkich", "Birlik", "Qiymat"], [
      ["Konstruktiv tizim", "—", kr.sys.toUpperCase()], ["Doimiy yuk (yopma)", "kPa", n1(kr.dead)], ["Vaqtinchalik yuk", "kPa", n1(kr.live)],
      ["Tom + qor (0,5 kPa)", "kPa", n1(kr.roof)], ["Devorlar og'irligi", "kN", n0(kr.wallW)], ["Binoning umumiy og'irligi", "kN", n0(kr.N)],
      ["Poydevor tagi maydoni", "m²", n1(kr.fArea)], ["Gruntga bosim", "kPa", n0(kr.press)], ["Grunt qarshiligi R₀ (taxminan)", "kPa", n0(kr.R0)],
    ], [62, 18, 43], { warn: (i, j) => i === 7 && j === 2 && kr.press > kr.R0 });
    y = table(o, T, PX, y, PW, "Poydevor", ["Element", "Qiymat"], [["Turi", kr.fNote.split(" (")[0].split(" +")[0]], ["Chuqurligi", `${n2(kr.FD)} m`], ["Beton hajmi", `${n1(kr.fVol)} m³`], ["Beton sinfi", "B20, W6"], ["Tayyorlov qatlami", "B7,5, 100 mm"]], [50, 73]);
    notes(T, PX, y + 2, [
      kr.press > kr.R0 ? `DIQQAT: bosim R₀ dan katta — poydevor kengligini ~${n2(kr.press / kr.R0)} marta oshiring yoki ustunli/plitali poydevor tanlang.` : "Gruntga bosim ruxsat etilgan qiymatdan kichik.",
      "Toshkent: seysmiklik 8 ball (KMK 2.01.03). Lyoss gruntlarda cho'kish xavfi — geologik qidiruv majburiy.",
      "Hisob taxminiy: ishchi chizmalar konstruktor-muhandis hisobi bilan tasdiqlanadi.",
    ]);
    return wrap(o);
  }
  function krFrame(M, num, total) {
    const o = [], kr = M.kr, title = { as: "Yopma plitalari rejasi", kj: "Karkas va yopma rejasi", km: "Metall karkas rejasi", kd: "Yog'och to'sinlar rejasi" }[kr.sys];
    const T = frame(o, M, "kr", title, num, total, fitScale(M.W, M.D));
    const P = planBase(o, T, M, 0, { outline: true, axZ: kr.axZ, title: title + " (tipik qavat)" }), { X, Z, k } = P;
    const W = M.W, D = M.D;
    if (kr.sys === "as") {
      const ring = r => "M" + r.map(([x, z]) => `${X(x)} ${Z(z)}`).join("L") + "Z";
      o.push(`<path d="${M.rings.map(ring).join("")}${M.rings.map(r => ring(offsetRing(r, -M.Tw))).join("")}" fill="url(#rpHatch)" fill-rule="evenodd" stroke="${INK}" stroke-width="0.4"/>`);
      kr.axZ.slice(1, -1).forEach(z => o.push(`<rect x="${X(M.Tw)}" y="${Z(z - 0.19)}" width="${(W - 2 * M.Tw) * k}" height="${0.38 * k}" fill="url(#rpHatch)" stroke="${INK}" stroke-width="0.35"/>`));
      const n = Math.floor((W - 2 * M.Tw) / 1.2);
      kr.axZ.slice(0, -1).forEach((z0, s) => { const z1 = kr.axZ[s + 1];
        for (let i = 0; i < n; i++) { const x0 = M.Tw + i * 1.2; o.push(`<rect x="${X(x0) + 0.15}" y="${Z(z0 + 0.12)}" width="${1.2 * k - 0.3}" height="${(z1 - z0 - 0.24) * k}" fill="none" stroke="${C.ret}" stroke-width="0.2"/>`); }
        const rest = W - 2 * M.Tw - n * 1.2; if (rest > 0.05) o.push(`<rect x="${X(M.Tw + n * 1.2)}" y="${Z(z0 + 0.12)}" width="${rest * k}" height="${(z1 - z0 - 0.24) * k}" fill="#eef1fb" stroke="${C.ret}" stroke-width="0.2"/>`);
        T(X(M.Tw + 0.6), (Z(z0) + Z(z1)) / 2, `PK ${Math.round((z1 - z0 + 0.2) * 10)}.12 — ${n} dona`, 2.2, "start", "700", C.ret);
      });
    } else {
      kr.axX.forEach(x => o.push(`<path d="M${X(x)} ${Z(0)}V${Z(D)}" stroke="${kr.sys === "kd" ? "#8a6440" : C.ret}" stroke-width="${kr.sys === "kd" ? 0.6 : 0.8}"/>`));
      kr.axZ.forEach(z => o.push(`<path d="M${X(0)} ${Z(z)}H${X(W)}" stroke="${kr.sys === "kd" ? "#8a6440" : C.ret}" stroke-width="${kr.sys === "km" ? 1 : 0.6}"/>`));
      if (kr.sys === "km") for (let z = 2; z < D - 0.5; z += 2) if (!kr.axZ.some(a => Math.abs(a - z) < 0.6)) o.push(`<path d="M${X(0)} ${Z(z)}H${X(W)}" stroke="${C.ret}" stroke-width="0.3" stroke-dasharray="2 1"/>`);
      if (kr.sys === "kd") for (let x = 0.6; x < W - 0.3; x += 0.6) o.push(`<path d="M${X(x)} ${Z(0)}V${Z(D)}" stroke="#8a6440" stroke-width="0.2"/>`);
      const cs = kr.sys === "kj" ? 0.4 : kr.sys === "km" ? 0.3 : 0.15;
      kr.axX.forEach(x => kr.axZ.forEach(z => { if (!inPlan(M, x, z)) return;
        o.push(kr.sys === "km" ? `<path d="M${X(x) - cs * k / 2} ${Z(z) - cs * k / 2}h${cs * k}M${X(x) - cs * k / 2} ${Z(z) + cs * k / 2}h${cs * k}M${X(x)} ${Z(z) - cs * k / 2}v${cs * k}" stroke="${INK}" stroke-width="0.6"/>`
          : `<rect x="${X(x) - cs * k / 2}" y="${Z(z) - cs * k / 2}" width="${cs * k}" height="${cs * k}" fill="${kr.sys === "kd" ? "#c7a37a" : INK}" stroke="${INK}" stroke-width="0.25"/>`); }));
      const lab = { kj: `Monolit plita P-1, h=220; ustunlar K-1 400×400; rigellar R-1 400×500`, km: `Ustunlar ${kr.col}; bosh to'sinlar ${kr.beam}; ikkilamchi to'sinlar IPE200, qadam 2 m`, kd: `To'sinlar ${kr.kdH > 175 ? 150 : 100}×${kr.kdH}, qadam 600; ustunlar 150×150` }[kr.sys];
      T(X(0), Z(0) - 3, lab, 2.4, "start", "700", kr.sys === "kd" ? "#8a6440" : C.ret);
    }
    const rows = kr.mats.map(([n, u, v]) => [n, u, u === "dona" ? n0(v) : n2(v)]);
    let y = table(o, T, PX, ZONE.y + 4, PW, "Materiallar spetsifikatsiyasi (butun bino)", ["Material", "Birlik", "Miqdor"], rows, [78, 15, 30]);
    y = table(o, T, PX, y, PW, "Konstruktiv sxema", ["Ko'rsatkich", "Qiymat"], [
      ["Tizim", SYS[kr.sys].split(" — ")[1]], ["Oraliq (prolyot)", `${n2(kr.span)} m`], ["Qadam (o'qlar orasi)", `${n2(M.p.bay_w)} m`],
      ["Qavatlar", String(M.p.floors)], ["Seysmiklik", "8 ball (Toshkent)"],
    ], [55, 68]);
    const warn = [];
    if (kr.sys === "as" && M.p.floors > 4) warn.push("DIQQAT: 8 ballik hududda g'isht devorli bino 4 qavatdan baland bo'lmasligi tavsiya etiladi — temir-beton karkas (KJ) tanlang.");
    if (kr.sys === "as") warn.push("Har qavat yopmasi sathida monolit seysmik kamar (beton B20, 4Ø12). Devorlar burchaklarida vertikal armatura.");
    if (kr.sys === "kj") warn.push("Ustun va rigel tugunlari qattiq (rama). Diafragma devorlar zina va lift atrofida.");
    if (kr.sys === "km") warn.push("Ustunlar bog'lovchilar (svyazlar) bilan; metall olovdan himoya qoplamasi R45 dan kam emas.");
    if (kr.sys === "kd") warn.push("Yog'och antiseptik va antipiren bilan ishlanadi; namlik 20% dan oshmasin. Oraliq 4,5 m dan katta bo'lsa — kleyli yog'och.");
    notes(T, PX, y + 2, [...warn, "Taxminiy hisob: ishchi chizmalar konstruktor hisobi bilan tasdiqlanadi."]);
    return wrap(o);
  }

  // =====================================================================
  // OV — isitish, ventilyatsiya, konditsioner
  // =====================================================================
  function ovPlan(M, f, num, total) {
    const o = [], ov = M.ov, T = frame(o, M, "ov", `${f + 1}-qavat: isitish va OVK`, num, total, fitScale(M.W, M.D));
    const { X, Z } = planBase(o, T, M, f, { title: `${f + 1}-qavat rejasi: isitish, ventilyatsiya, konditsionerlash`, labelDy: -1 });
    // ikki quvurli perimetral tizim: uzatish (qizil) va qaytish (ko'k)
    const ring = r => "M" + r.map(([x, z]) => `${X(x)} ${Z(z)}`).join("L") + "Z";
    o.push(`<path d="${M.rings.map(r => ring(offsetRing(r, -(M.Tw + 0.3)))).join("")}" fill="none" stroke="${C.sup}" stroke-width="0.35"/>`);
    o.push(`<path d="${M.rings.map(r => ring(offsetRing(r, -(M.Tw + 0.5)))).join("")}" fill="none" stroke="${C.ret}" stroke-width="0.3" stroke-dasharray="1.4 0.8"/>`);
    const per = ov.per.filter(r => r.f === f);
    per.forEach(r => {
      const e = bestExt(r);
      if (e && r.sec) { const s = wallSpot(M, e, 0.5, 0.15); o.push(`<g transform="rotate(${s.horiz ? 0 : 90} ${X(s.x)} ${Z(s.z)})">${sym.rad(X(s.x), Z(s.z))}</g>`); T(X(s.x) + (s.horiz ? 0 : 3.2), Z(s.z) + (s.horiz ? (e.s === "S" ? -1.8 : 3.4) : 0.8), `${r.sec} sek.`, 1.9, s.horiz ? "middle" : "start", "", C.sup); }
      if (r.units.length) { const e2 = e || longest(r)[0], s = wallSpot(M, e2, e2 === e ? 0.2 : 0.5, 0.7); o.push(sym.ac(X(s.x), Z(s.z))); T(X(s.x), Z(s.z) - 1.8, r.units.map(u => n1(u)).join("+") + " kW", 1.8, "middle", "", C.ret); }
      if (r.ex) { const x = r.box.x1 - 0.45, z = r.box.z0 + 0.45; o.push(sym.vent(X(x), Z(z))); T(X(x) - 2, Z(z) + 0.7, `L=${r.ex}`, 1.8, "end", "", C.vent); }
    });
    if (f === 0) {
      const kit = M.floors[0].rooms.find(r => r.type === "kitchen") || M.floors[0].rooms.find(r => WET[r.type]) || M.floors[0].rooms[0];
      const bi = M.floors[0].fd.items.find(it => it[0] === "boiler");
      const b = bi ? { x: bi[1], z: bi[2] } : kit ? { x: kit.box.x0 + 0.5, z: kit.box.z1 - 0.5 } : { x: M.W / 2, z: M.D / 2 };
      o.push(sym.boiler(X(b.x), Z(b.z), C.sup, st.heat === "gaz" ? "QK" : "EK")); T(X(b.x) + 3, Z(b.z) + 4.5, `${HEAT[st.heat]} ${ov.boiler} kW`, 2, "start", "700", C.sup);
    }
    let y = table(o, T, PX, ZONE.y + 4, PW, `Xonalar bo'yicha (${f + 1}-qavat)`, ["Xona", "m²", "Q, W", "Sek.", "Kond., kW", "L, m³/s"],
      per.map(r => [r.name, n1(r.area), n0(r.q), r.sec || "—", r.units.length ? r.units.map(n1).join("+") : "—", r.ex || "—"]), [37, 13, 18, 13, 22, 20]);
    y = legend(o, T, PX, y, [[sym.line(C.sup), "Isitish: uzatish quvuri (T1)"], [sym.dash(C.ret), "Isitish: qaytish quvuri (T2)"], [(x, yy) => sym.rad(x, yy), "Radiator (alyuminiy, 170 W/sek.)"],
      [sym.ac, "Konditsioner ichki bloki (split)"], [sym.vent, "So'rish panjarasi (tabiiy/mexanik)"], [(x, yy) => sym.boiler(x, yy), "Isitish qozoni"]]);
    notes(T, PX, y, ["Radiatorlar deraza ostiga, poldan 100 mm. Quvurlar: PP-R 25 (stoyak 32), issiqlik izolyatsiyasi bilan.", "Hisob tashqi havo −10 °C, ichki +20 °C (Toshkent)."]);
    return wrap(o);
  }
  function ovCalc(M, num, total) {
    const o = [], ov = M.ov, T = frame(o, M, "ov", "Issiqlik hisobi", num, total, 0);
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "Issiqlik yo'qotishlari va OVK uskunalari", 3.6, "middle", "700");
    let y = table(o, T, ZONE.x + 4, ZONE.y + 8, 160, "Issiqlik yo'qotishlari (ΔT = " + ov.dT + " °C)", ["To'siq konstruksiya", "U, W/m²K", "A, m²", "Q, W"],
      [...ov.parts.map(x => [x.n, n2(x.u), n1(x.a), n0(x.q)]), ["Shamollatish (infiltratsiya)", "—", `${n0(ov.L)} m³/s`, n0(ov.qVent)], ["Jami", "", "", n0(ov.Q)]], [70, 28, 30, 32], { boldLast: true });
    y = table(o, T, ZONE.x + 4, y + 2, 160, "Asosiy ko'rsatkichlar", ["Ko'rsatkich", "Qiymat"], [
      ["Isitish yuklamasi", `${n1(ov.kW)} kW`], ["Solishtirma yuklama", `${n0(ov.Q / Math.max(1, M.total))} W/m²`], ["Isitish manbai", `${HEAT[st.heat]}, ${ov.boiler} kW`],
      ["Yillik isitish energiyasi", `${n0(ov.annual)} kWh`], ["Havo almashinuvi", `${n0(ov.L)} m³/soat`], ["Sovutish quvvati (jami)", `${n1(ov.coolKW)} kW`],
      ["Radiator seksiyalari (jami)", `${ov.per.reduce((s, r) => s + r.sec, 0)} dona`], ["Konditsionerlar", `${ov.per.reduce((s, r) => s + r.units.length, 0)} dona`],
    ], [80, 80]);
    // ulushlar diagrammasi
    const bx = 200, by = ZONE.y + 14, bw = 80, items = [...ov.parts.map(x => [x.n, x.q]), ["Shamollatish", ov.qVent]], mx = Math.max(...items.map(i => i[1]), 1);
    T(bx, by - 3, "Yo'qotishlar ulushi", 3, "start", "700");
    items.forEach(([n, v], i) => { const yy = by + i * 9; T(bx, yy + 2.5, n, 2.2, "start"); o.push(`<rect x="${bx}" y="${yy + 3.5}" width="${(bw * v / mx).toFixed(2)}" height="3" fill="${i === items.length - 1 ? C.vent : C.sup}"/>`); T(bx + bw * v / mx + 1.5, yy + 6, `${Math.round(v / ov.Q * 100)}%`, 2.2, "start"); });
    const units = {}; ov.per.forEach(r => r.units.forEach(u => { units[u] = (units[u] || 0) + 1; }));
    let y2 = table(o, T, PX, ZONE.y + 4, PW, "OVK uskunalari spetsifikatsiyasi", ["Nomi", "Birlik", "Soni"], [
      [`${HEAT[st.heat]} ${ov.boiler} kW`, "dona", st.heat === "gaz" && ov.boiler > 100 ? 2 : 1],
      ["Radiator seksiyasi (alyuminiy 500)", "sek.", ov.per.reduce((s, r) => s + r.sec, 0)],
      ...Object.entries(units).sort((a, b) => a[0] - b[0]).map(([u, n]) => [`Split konditsioner ${n1(+u)} kW`, "dona", n]),
      ["Kengaytirish baki 18 l", "dona", 1], ["Sirkulyatsiya nasosi 25-60", "dona", 1],
      ["PP-R quvur 25 (taxminan)", "m", n0(M.perim * M.p.floors * 2.2)],
      ["Kanal ventilyator (oshxona, hammom)", "dona", ov.per.filter(r => r.ex).length],
    ], [78, 15, 30]);
    notes(T, PX, y2 + 2, ["Issiqlik izolyatsiyasi kuchaytirilsa (devor U ≤ 0,5) yuklama ~30–40% kamayadi.", "Gaz qozoni uchun alohida mo'ri va havo kirishi kerak (GS bo'limi)."]);
    return wrap(o);
  }

  // =====================================================================
  // VK — suv ta'minoti va kanalizatsiya
  // =====================================================================
  function vkPlan(M, f, num, total) {
    const o = [], vk = M.vk, T = frame(o, M, "vk", `${f + 1}-qavat: suv va kanalizatsiya`, num, total, fitScale(M.W, M.D));
    const { X, Z } = planBase(o, T, M, f, { title: `${f + 1}-qavat rejasi: suv ta'minoti (V1, T3) va kanalizatsiya (K1)`, furn: true });
    const R = vk.riser, fx = vk.fx[f];
    fx.forEach(x => {
      orth(o, X, Z, R, { x: x.x, z: x.z }, C.cold, 0.3);
      if (x.t !== "toilet") orth(o, X, Z, { x: R.x + 0.15, z: R.z + 0.15 }, { x: x.x + 0.15, z: x.z + 0.15 }, C.hot, 0.3);
      orth(o, X, Z, { x: x.x, z: x.z }, R, C.sew, 0.45, "1.6 0.8");
      o.push(sym.fix(X(x.x), Z(x.z), C.cold));
    });
    o.push(sym.riser(X(R.x), Z(R.z), C.cold)); T(X(R.x) + 2.4, Z(R.z) + 4, "St V1-1, T3-1, K1-1", 2, "start", "700", INK);
    if (f === 0) {
      const back = R.z < M.D / 2, zOut = back ? -1.6 : M.D + 1.6, ty = back ? Z(0) - 5 : Z(M.D) + 6;      // stoyakka yaqin tashqi devordan
      orth(o, X, Z, R, { x: R.x, z: zOut }, C.cold, 0.5); T(X(R.x) - 1.5, ty, `V1 kirish Ø${vk.DN} (hisoblagich bilan)`, 2.1, "end", "700", C.cold);
      orth(o, X, Z, { x: R.x + 0.5, z: R.z }, { x: R.x + 0.5, z: zOut }, C.sew, 0.6, "1.6 0.8"); T(X(R.x + 0.5) + 1.5, ty, `K1 chiqish Ø${vk.sewDN}, i = 0,02`, 2.1, "start", "700", C.sew);
    }
    const cnt = {}; fx.forEach(x => { cnt[x.t] = (cnt[x.t] || 0) + 1; });
    let y = table(o, T, PX, ZONE.y + 4, PW, `Sanitariya asboblari (${f + 1}-qavat)`, ["Asbob", "Soni", "V1", "T3", "K1"],
      Object.entries(cnt).map(([t, n]) => [FIX[t], n, "+", /toilet/.test(t) ? "—" : "+", "+"]).concat(fx.length ? [] : [["Ho'l xonalar yo'q", "—", "", "", ""]]), [58, 15, 16, 17, 17]);
    y = legend(o, T, PX, y, [[sym.line(C.cold), "V1 — sovuq suv quvuri"], [sym.line(C.hot), "T3 — issiq suv quvuri"], [sym.dash(C.sew), "K1 — maishiy kanalizatsiya"], [(x, yy) => sym.riser(x, yy, C.cold), "Stoyak (vertikal quvur)"], [(x, yy) => sym.fix(x, yy), "Sanitariya asbobi"]]);
    notes(T, PX, y, ["Suv quvurlari PP-R PN20, kanalizatsiya PP Ø50 (asboblar), Ø110 (unitaz va stoyak).", "Quvurlar xona burchaklari bo'ylab, devor ichida yoki pol ostida o'tkaziladi (sxematik ko'rsatilgan)."]);
    return wrap(o);
  }
  function vkCalc(M, num, total) {
    const o = [], vk = M.vk, T = frame(o, M, "vk", "Suv balansi", num, total, 0);
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "Suv iste'moli va oqova hisobi", 3.6, "middle", "700");
    let y = table(o, T, ZONE.x + 4, ZONE.y + 8, 180, "Suv balansi", ["Ko'rsatkich", "Birlik", "Qiymat"], [
      [M.cat === "turar-joy" ? "Yashovchilar soni" : "Foydalanuvchilar soni", "odam", vk.N], ["Suv iste'moli me'yori", "l/sutka·odam", vk.NORM[0]], ["shu jumladan issiq suv", "l/sutka·odam", vk.NORM[1]],
      ["Sutkalik sarf", "m³/sutka", n2(vk.qDay)], ["Issiq suv sarfi", "m³/sutka", n2(vk.qHot)], ["Soatlik maksimal sarf", "m³/soat", n2(vk.qH)],
      ["Sekundlik hisobiy sarf (taxminan)", "l/s", n2(vk.qs)], ["Yillik sarf", "m³/yil", n0(vk.qDay * 365)], ["Oqova suv (kanalizatsiya)", "m³/sutka", n2(vk.qDay)],
    ], [100, 40, 40]);
    y = table(o, T, ZONE.x + 4, y + 2, 180, "Tarmoqlar", ["Tarmoq", "Diametr", "Material"], [
      ["V1 — tashqi kirish", `Ø${vk.DN}`, "PE100 SDR17"], ["V1, T3 — stoyaklar", "Ø32", "PP-R PN20"], ["V1, T3 — asboblarga", "Ø20–25", "PP-R PN20"],
      ["K1 — stoyak", `Ø${vk.sewDN}`, "PP (shovqinsiz)"], ["K1 — tashqi chiqish", `Ø${vk.sewDN}`, "PVX SN4, i = 0,02"], ["Issiq suv manbai", vk.heater.length > 26 ? "—" : vk.heater, vk.heater.length > 26 ? vk.heater : ""],
    ], [70, 40, 70]);
    let y2 = table(o, T, PX, ZONE.y + 4, PW, "Sanitariya asboblari (butun bino)", ["Asbob", "Birlik", "Soni"],
      [...Object.entries(vk.count).map(([t, n]) => [FIX[t], "dona", n]), ["Suv hisoblagichi DN" + (vk.DN <= 25 ? 15 : 20), "dona", 1], ["Filtr va reduktor", "kompl.", 1]], [78, 15, 30]);
    notes(T, PX, y2 + 2, [`Issiq suv: ${vk.heater}.`, "Yomg'ir suvi tomdan tarnovlar orqali hovliga (yoki to'plash idishiga) chiqariladi — OOS bo'limiga qarang.", "Me'yorlar: KMK 2.04.01 (ichki suv ta'minoti va kanalizatsiya) asosida, taxminiy."]);
    return wrap(o);
  }

  // =====================================================================
  // EOM — elektr
  // =====================================================================
  function eomPlan(M, f, num, total) {
    const o = [], e = M.eom, T = frame(o, M, "eom", `${f + 1}-qavat: elektr va yoritish`, num, total, fitScale(M.W, M.D));
    const { X, Z } = planBase(o, T, M, f, { title: `${f + 1}-qavat rejasi: yoritish va kuch tarmog'i`, labelDy: 3.5 });
    const sh = f === 0 ? { x: M.entry.x + 0.8, z: M.D - M.Tw - 0.35 } : M._stair ? { x: M._stair.x + 1.2, z: M._stair.z } : { x: M.W / 2, z: M.D / 2 };
    e.fl[f].forEach(({ r, lights, sockets }) => {
      spread(M, r, lights).forEach(c => { orth(o, X, Z, sh, c, C.el, 0.15, "0.6 0.6"); o.push(sym.light(X(c.x), Z(c.z))); });
      const walls = longest(r); let placed = 0;
      for (let i = 0; placed < sockets && walls.length; i++) {
        const w = walls[i % walls.length], t = [0.25, 0.75, 0.5][Math.floor(i / walls.length) % 3], s = wallSpot(M, w, t, 0.12);
        o.push(`<g transform="rotate(${{ S: 180, N: 0, E: 90, W: 270 }[w.s]} ${X(s.x)} ${Z(s.z)})">${sym.sock(X(s.x), Z(s.z))}</g>`); placed++;
        if (i > 30) break;
      }
    });
    o.push(sym.board(X(sh.x), Z(sh.z), f === 0 ? "ShR" : "ShK")); T(X(sh.x), Z(sh.z) - 2.6, f === 0 ? `ShR — ${e.main} A` : `Qavat shiti ShK-${f + 1}`, 2, "middle", "700", C.el);
    const rows = e.fl[f].map(({ r, lights, sockets }) => [r.name, n1(r.area), lights, sockets, n0(r.area * e.lightW)]);
    let y = table(o, T, PX, ZONE.y + 4, PW, `Xonalar (${f + 1}-qavat)`, ["Xona", "m²", "Chiroq", "Rozetka", "Yoritish, W"], rows, [40, 15, 18, 22, 28]);
    y = legend(o, T, PX, y, [[sym.light, "Shift chirog'i (LED)"], [sym.sock, "Rozetka 16 A, yerga ulangan"], [(x, yy) => sym.board(x, yy, "ShR"), "Taqsimlash shiti"], [sym.dash(C.el), "Yoritish guruhi liniyasi (sxematik)"]]);
    notes(T, PX, y, ["Hammomda rozetka IP44, yerga ulash va 30 mA UZO bilan. Kabel VVGng-LS (mis).", `Yoritilganlik: xonalar 150 lk, oshxona 200 lk (LED, ${e.lightW} W/m²).`]);
    return wrap(o);
  }
  function eomCalc(M, num, total) {
    const o = [], e = M.eom, T = frame(o, M, "eom", "Yuklama hisobi", num, total, 0);
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "Elektr yuklamalari va taqsimlash shiti sxemasi", 3.6, "middle", "700");
    let y = table(o, T, ZONE.x + 4, ZONE.y + 8, 130, "Elektr yuklamalari", ["Iste'molchi", "P, kW"], [
      ["Yoritish", n2(e.Plight)], [`Rozetkalar (${e.nSock} dona)`, n2(e.Psock)], ["Maishiy texnika", n2(e.Papp)], ["Konditsionerlar", n2(e.Pac)],
      [st.heat === "elektr" ? "Elektr isitish va suv isitgich" : "Qozon avtomatikasi", n2(e.Pheat)], ["O'rnatilgan quvvat Pо'rn", n2(e.Pinst)],
      ["Talab koeffitsienti Kt", n2(e.Kc)], ["Hisobiy quvvat Ph", n2(e.Pr)], ["Hisobiy tok", n1(e.I) + " A"], ["Ulanish", e.three ? "3 faza, 380 V" : "1 faza, 220 V"],
      ["Kirish avtomati", `${e.main} A`], ["Kirish kabeli (mis)", `${e.three ? "5" : "3"}×${e.cable} mm²`],
    ], [90, 40], { boldLast: false });
    // bir chiziqli sxema
    const sx = ZONE.x + 145, sy = ZONE.y + 12, gx = sx + 30;
    T(sx, sy - 3, "Shit ShR sxemasi", 3, "start", "700");
    o.push(`<path d="M${sx} ${sy + 4}h18" stroke="${INK}" stroke-width="0.6"/>`); T(sx, sy + 2.5, "Kirish", 2.2, "start");
    o.push(`<rect x="${sx + 18}" y="${sy + 1.5}" width="6" height="5" fill="#fff" stroke="${INK}" stroke-width="0.35"/>`); T(sx + 21, sy + 5, "Wh", 2, "middle");
    const gs = e.groups.slice(0, 18), busY0 = sy + 4, busY1 = busY0 + (gs.length - 1) * 9.4;
    o.push(`<path d="M${sx + 24} ${sy + 4}H${gx}M${gx} ${busY0}V${busY1}" stroke="${INK}" stroke-width="0.8"/>`);
    T(gx - 2, busY0 - 2, `QF ${e.main} A`, 2, "end");
    gs.forEach((g, i) => {
      const yy = busY0 + i * 9.4;
      o.push(`<path d="M${gx} ${yy}h6M${gx + 6} ${yy - 1.5}l3 1.5h8" stroke="${INK}" stroke-width="0.35" fill="none"/>`);
      if (g.rcd) o.push(`<rect x="${gx + 18}" y="${yy - 1.6}" width="5" height="3.2" fill="#fff" stroke="${C.fire}" stroke-width="0.3"/>`);
      T(gx + 26, yy - 0.6, `${i + 1}. ${g.n}`, 2.1, "start", "700");
      T(gx + 26, yy + 2.6, `${g.a} A${g.rcd ? " + UZO 30 mA" : ""}, ${g.c} mm², ${n2(g.p)} kW`, 1.9, "start");
    });
    let y2 = table(o, T, PX, ZONE.y + 4, PW, "Guruhlar jadvali", ["Guruh", "P, kW", "A", "mm²"], e.groups.map((g, i) => [`${i + 1}. ${g.n}`, n2(g.p), g.a, g.c]), [70, 18, 15, 20]);
    notes(T, PX, y2 + 2, ["Yerga ulash tizimi TN-C-S, qo'shimcha potensiallarni tenglashtirish (hammom).", "Bino chaqmoqdan himoya: III toifa (tom tarmog'i + 2 ta pastga tushuvchi).", "Hisob taxminiy (KMK, PUE asosida); quvvat ajratish — hududiy elektr tarmoqlari texnik shartlari bo'yicha."]);
    return wrap(o);
  }

  // =====================================================================
  // GS — gaz
  // =====================================================================
  function gsPlan(M, f, num, total) {
    const o = [], gs = M.gs, T = frame(o, M, "gs", `${f + 1}-qavat: gaz ta'minoti`, num, total, fitScale(M.W, M.D));
    const { X, Z } = planBase(o, T, M, f, { title: `${f + 1}-qavat rejasi: gaz ta'minoti`, furn: true });
    const inlet = { x: Math.max(0.6, M.entry.x - 2), z: M.D + 0.9 };
    o.push(`<rect x="${X(inlet.x) - 3}" y="${Z(inlet.z) - 2}" width="6" height="4" fill="#fff" stroke="${C.gas}" stroke-width="0.45"/>`); T(X(inlet.x), Z(inlet.z) + 0.8, "GHU", 1.9, "middle", "700", C.gas);
    T(X(inlet.x) + 4, Z(inlet.z) + 0.8, `Hisoblagich ${gs.meter}, Ø${gs.DN}`, 2.1, "start", "700", C.gas);
    // iste'molchilar: oshxona plitasi va (1-qavatda) qozon
    const kit = M.floors[f].rooms.find(r => r.type === "kitchen") || M.floors[f].rooms.find(r => WET[r.type]) || M.floors[f].rooms[0];
    const cons = [];
    M.floors[f].rooms.filter(r => r.type === "kitchen").forEach(r => { const it = r.items.find(i => i[0] === "stove"); cons.push({ x: it ? it[1] : r.box.x0 + 0.6, z: it ? it[2] : r.box.z0 + 0.6, t: "stove", r }); });
    if (st.heat === "gaz" && f === 0 && kit) { const bi = M.floors[0].fd.items.find(it => it[0] === "boiler"); cons.push({ x: bi ? bi[1] : kit.box.x0 + 0.5, z: bi ? bi[2] : kit.box.z1 - 0.5, t: "boiler", r: kit }); }
    // quvur fasad bo'ylab tashqaridan oshxonaning tashqi devorigacha, so'ng ichkariga (sxematik)
    const out = 0.7, route = (c) => {
      const e = bestExt(c.r) || { s: "S", line: M.D, a0: c.x, a1: c.x }, pts = [inlet];
      const sideX = c.x < M.W / 2 ? -out : M.W + out;
      if (e.s === "S") pts.push({ x: c.x, z: inlet.z });
      else if (e.s === "N") pts.push({ x: sideX, z: inlet.z }, { x: sideX, z: -out }, { x: c.x, z: -out });
      else { const sx = e.s === "W" ? -out : M.W + out; pts.push({ x: sx, z: inlet.z }, { x: sx, z: c.z }); }
      pts.push({ x: c.x, z: c.z });
      o.push(`<path d="M${pts.map(p => `${X(p.x)} ${Z(p.z)}`).join("L")}" fill="none" stroke="${C.gas}" stroke-width="0.5"/>`);
    };
    cons.forEach(c => { route(c); o.push(c.t === "stove" ? sym.stove(X(c.x), Z(c.z)) : sym.boiler(X(c.x), Z(c.z), C.gas, "QK")); o.push(sym.valve(X(c.x) + 3.2, Z(c.z) - 2.6)); });
    if (f > 0) T(X(inlet.x) + 4, Z(inlet.z) + 4, `Fasad bo'ylab ${f + 1}-qavatga ko'tariladi`, 2, "start", "", C.gas);
    let y = table(o, T, PX, ZONE.y + 4, PW, "Gaz iste'molchilari", ["Iste'molchi", "Soni", "m³/soat"], [
      ["Gaz plitasi (4 kamforkali)", gs.stoves, n2(gs.stoves * gs.qStove)], ...(gs.qBoiler ? [[`Isitish qozoni ${M.ov.boiler} kW`, 1, n2(gs.qBoiler)]] : []),
      ["Bir vaqtdalik koeffitsienti", "", n2(gs.K)], ["Hisobiy sarf", "", n2(gs.Q)],
    ], [70, 18, 35], { boldLast: true });
    y = legend(o, T, PX, y, [[sym.line(C.gas), "Gaz quvuri (po'lat, sariq rangda)"], [sym.valve, "Berkitish krani"], [sym.stove, "Gaz plitasi"], [(x, yy) => sym.boiler(x, yy, C.gas), "Gaz qozoni"]]);
    notes(T, PX, y, ["Gaz quvuri fasad bo'ylab ochiq yotqiziladi, devordan o'tishda gilzada. Ichkarida — faqat ko'rinadigan joyda.", "Oshxonada gaz signalizatori (SGK) va avtomatik klapan, CO datchigi o'rnatiladi."]);
    return wrap(o);
  }
  function gsCalc(M, num, total) {
    const o = [], gs = M.gs, T = frame(o, M, "gs", "Gaz hisobi va talablar", num, total, 0);
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "Gaz sarfi va xavfsizlik talablari", 3.6, "middle", "700");
    let y = table(o, T, ZONE.x + 4, ZONE.y + 8, 180, "Gaz sarfi", ["Ko'rsatkich", "Birlik", "Qiymat"], [
      ["Maksimal soatlik sarf", "m³/soat", n2(gs.Q)], ["Hisoblagich turi", "—", gs.meter], ["Ichki quvur diametri", "mm", `Ø${gs.DN}`],
      ["Isitish uchun yillik sarf", "m³/yil", n0(gs.year)], ["Ovqat tayyorlash uchun yillik sarf", "m³/yil", n0(gs.yearStove)], ["Jami yillik sarf", "m³/yil", n0(gs.year + gs.yearStove)],
      ["Gazning issiqlik berishi", "kWh/m³", "9,3"], ["Qozon FIK", "%", st.heat === "gaz" ? "92" : "—"],
    ], [100, 40, 40], { boldLast: false });
    y = table(o, T, ZONE.x + 4, y + 2, 180, "Oshxonalar talablarga muvofiqligi", ["Oshxona", "Hajmi, m³", "≥ 15 m³", "Deraza"],
      gs.checks.length ? gs.checks.map(c => [`${c.r.name} (${c.r.f + 1}-qavat)`, n1(c.vol), c.ok ? "ha" : "YO'Q", c.win ? "bor" : "YO'Q"]) : [["Oshxona topilmadi", "—", "—", "—"]], [80, 35, 30, 35],
      { warn: (i, j) => gs.checks[i] && ((j === 2 && !gs.checks[i].ok) || (j === 3 && !gs.checks[i].win)) });
    notes(T, ZONE.x + 4, y + 4, [
      "1. 4 kamforkali plita o'rnatiladigan oshxona hajmi kamida 15 m³, balandligi kamida 2,2 m, ochiladigan derazasi (fortochka) bo'lishi shart.",
      "2. Qozon xonasi (yoki oshxona) tabiiy ventilyatsiyaga ega bo'lishi, mo'ri alohida kanal bilan tom ustiga chiqarilishi kerak.",
      "3. Gaz quvurlari bosim ostida sinovdan o'tkaziladi; loyiha hududiy gaz ta'minoti tashkilotining texnik shartlari asosida tasdiqlanadi.",
      "4. Gaz ishlarini faqat litsenziyaga ega tashkilot bajaradi.",
    ], 250);
    table(o, T, PX, ZONE.y + 4, PW, "Gaz uskunalari spetsifikatsiyasi", ["Nomi", "Birlik", "Soni"], [
      ["Gaz plitasi 4 kamforkali", "dona", gs.stoves], ...(gs.qBoiler ? [[`Gaz qozoni ${M.ov.boiler} kW`, "dona", 1]] : []), [`Gaz hisoblagichi ${gs.meter}`, "dona", 1],
      ["Berkitish krani", "dona", gs.stoves + (gs.qBoiler ? 1 : 0) + 1], ["Gaz signalizatori + klapan", "kompl.", Math.max(1, gs.kitchens.length)],
      [`Po'lat quvur Ø${gs.DN} (taxminan)`, "m", n0(M.W + M.D / 2 + 3 * M.p.floors)],
    ], [78, 15, 30]);
    return wrap(o);
  }

  // =====================================================================
  // SS — aloqa va signalizatsiya (kuchsiz toklar)
  // =====================================================================
  function ssPlan(M, f, num, total) {
    const o = [], T = frame(o, M, "ss", `${f + 1}-qavat: aloqa va signalizatsiya`, num, total, fitScale(M.W, M.D));
    const { X, Z } = planBase(o, T, M, f, { title: `${f + 1}-qavat rejasi: internet, TV, videokuzatuv, qo'riqlash signalizatsiyasi` });
    const hub = f === 0 ? { x: M.entry.x - 0.9, z: M.D - M.Tw - 0.35 } : M._stair ? { x: M._stair.x - 1.2, z: M._stair.z } : { x: M.W / 2, z: M.D / 2 };
    let nD = 0, nP = 0, nC = 0;
    M.floors[f].rooms.forEach(r => {
      if (/bed|living|study|room/.test(r.type)) { const w = longest(r)[0], s = wallSpot(M, w, 0.6, 0.15); o.push(sym.data(X(s.x), Z(s.z))); orth(o, X, Z, hub, s, C.low, 0.15, "0.8 0.6"); nD++; }
      if (f === 0 && r.edges.some(e => e.ext) && r.type !== "wc") { const c = { x: r.box.x1 - 0.4, z: r.box.z1 - 0.4 }; o.push(sym.pir(X(c.x), Z(c.z))); nP++; }
    });
    const ap = M.floors[f].rooms.slice().sort((a, b) => b.area - a.area)[0]; if (ap) { o.push(sym.wifi(X(ap.cx), Z(ap.cz) + 4)); }
    if (f === 0) [[0, 0], [M.W, 0], [M.W, M.D], [0, M.D]].forEach(([x, z]) => { o.push(sym.cam(X(x) + (x ? 2.5 : -2.5), Z(z) + (z ? 2.5 : -2.5))); nC++; });
    if (f === 0) { o.push(`<rect x="${X(M.entry.x) - 1.2}" y="${Z(M.D) + 1.2}" width="2.4" height="2.4" fill="${C.low}"/>`); T(X(M.entry.x), Z(M.D) + 6.5, "Domofon", 2, "middle", "700", C.low); }
    o.push(sym.board(X(hub.x), Z(hub.z), f === 0 ? "ShS" : "ShS", C.low)); T(X(hub.x), Z(hub.z) - 2.6, "Kuchsiz toklar shkafi", 2, "middle", "700", C.low);
    let y = table(o, T, PX, ZONE.y + 4, PW, `Qurilmalar (${f + 1}-qavat)`, ["Nomi", "Soni"], [
      ["Internet/TV rozetkasi RJ45", nD], ["Wi-Fi kirish nuqtasi", ap ? 1 : 0], ...(f === 0 ? [["Harakat datchigi (qo'riqlash)", nP], ["Videokamera (tashqi, IP)", nC], ["Domofon paneli", 1]] : []),
    ], [95, 28]);
    y = legend(o, T, PX, y, [[sym.data, "Internet / TV rozetkasi"], [sym.wifi, "Wi-Fi kirish nuqtasi"], [sym.pir, "Harakat datchigi"], [sym.cam, "Videokamera"], [(x, yy) => sym.board(x, yy, "ShS", C.low), "Kuchsiz toklar shkafi (router, NVR, PPK)"]]);
    notes(T, PX, y, ["Kabellar: UTP cat.6 (internet), RG-6 (TV), videokuzatuv — PoE. Gofra quvurda, elektr kabellardan ≥ 0,25 m uzoqda."]);
    return wrap(o);
  }

  // =====================================================================
  // PS / AUPT — yong'in xavfsizligi
  // =====================================================================
  function psPlan(M, f, num, total) {
    const o = [], spr = needSprinkler(M), T = frame(o, M, "ps", `${f + 1}-qavat: yong'in xavfsizligi`, num, total, fitScale(M.W, M.D));
    const { X, Z } = planBase(o, T, M, f, { title: `${f + 1}-qavat rejasi: yong'in signalizatsiyasi${spr ? ", AUPT" : ""} va evakuatsiya yo'llari`, labelDy: 3.5 });
    const exit = f === 0 ? { x: M.entry.x, z: M.D - 0.2 } : M._stair || { x: M.W / 2, z: M.D / 2 };
    let nS = 0, nH = 0, nSp = 0, far = 0;
    M.floors[f].rooms.forEach(r => {
      const n = Math.max(1, Math.ceil(r.area / 70));
      if (r.type === "bath" || r.type === "wc") return;
      spread(M, r, n).forEach(c => { if (r.type === "kitchen") { o.push(sym.heat(X(c.x), Z(c.z) - 3)); nH++; } else { o.push(sym.smoke(X(c.x), Z(c.z) - 3)); nS++; } });
      if (spr) spread(M, r, Math.max(1, Math.ceil(r.area / 12))).forEach(c => { o.push(sym.spr(X(c.x + 0.6), Z(c.z + 0.6))); nSp++; });
      const d = Math.abs(r.cx - exit.x) + Math.abs(r.cz - exit.z); far = Math.max(far, d);
      if (r.type !== "hall") o.push(`<path d="M${X(r.cx)} ${Z(r.cz) + 1}H${X(exit.x)}V${Z(exit.z)}" fill="none" stroke="${C.evac}" stroke-width="0.35" stroke-dasharray="2 1" marker-end="url(#rpArr)"/>`);
    });
    o.push(sym.call(X(exit.x) + 3, Z(exit.z) - 2)); o.push(sym.siren(X(exit.x) - 3, Z(exit.z) - 2.5)); o.push(sym.ext(X(exit.x) + 6, Z(exit.z) - 2));
    const nExt = Math.max(1, Math.ceil(M.foot / 150));
    T(X(exit.x), Z(exit.z) + (f === 0 ? 5 : 4.5), f === 0 ? "CHIQISH" : "Zina (evakuatsiya)", 2.2, "middle", "700", C.evac);
    if (f === 0) { o.push(sym.board(X(exit.x) - 10, Z(exit.z) - 2.2, "PPK", C.fire)); }
    const lim = M.cat === "turar-joy" ? 25 : 40;
    let y = table(o, T, PX, ZONE.y + 4, PW, `Qurilmalar (${f + 1}-qavat)`, ["Nomi", "Soni"], [
      ["Tutun datchigi (optik)", nS], ["Issiqlik datchigi (oshxona)", nH], ["Qo'l datchigi (IPR)", 1], ["Ovozli-yorug'lik sirena", 1], [`O't o'chirgich OP-4`, nExt],
      ...(spr ? [["Sprinkler (AUPT)", nSp]] : []), ...(f === 0 ? [["Qabul-nazorat pribori (PPK)", 1]] : []),
    ], [95, 28]);
    y = table(o, T, PX, y, PW, "Evakuatsiya", ["Ko'rsatkich", "Qiymat"], [["Eng uzoq masofa chiqishgacha", `${n1(far)} m`], ["Ruxsat etilgan (taxminan)", `${lim} m`]], [80, 43], { warn: (i, j) => i === 0 && j === 1 && far > lim });
    y = legend(o, T, PX, y, [[sym.smoke, "Tutun datchigi"], [sym.heat, "Issiqlik datchigi"], [sym.call, "Qo'l datchigi (IPR)"], [sym.siren, "Sirena"], [sym.ext, "O't o'chirgich"], ...(spr ? [[sym.spr, "Sprinkler"]] : []), [(x, yy) => `<path d="M${x - 3.5} ${yy}h7" stroke="${C.evac}" stroke-width="0.35" stroke-dasharray="2 1" marker-end="url(#rpArr)"/>`, "Evakuatsiya yo'li"]]);
    return wrap(o);
  }
  function psCalc(M, num, total) {
    const o = [], spr = needSprinkler(M), T = frame(o, M, "ps", "Yong'in xavfsizligi tadbirlari", num, total, 0);
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "Yong'in xavfsizligi tavsifi", 3.6, "middle", "700");
    const fire = /yogoch|metall/.test(M.p.material) || M.kr.sys === "kd" ? "IV" : "II";
    const cls = M.cat === "turar-joy" ? (M.p.floors <= 3 ? "F1.4 (yakka tartibdagi uy)" : "F1.3 (ko'p xonadonli uy)") : M.cat === "jamoat" ? "F3 (jamoat binosi)" : M.cat === "tijorat" ? "F4.3 (ofis, savdo)" : "F1.4";
    const rooms = allRooms(M).filter(r => r.type !== "bath" && r.type !== "wc");
    let y = table(o, T, ZONE.x + 4, ZONE.y + 8, 190, "Binoning yong'in-texnik tavsifi", ["Ko'rsatkich", "Qiymat"], [
      ["Funksional yong'in xavfi sinfi", cls], ["Olovbardoshlik darajasi", fire], ["Konstruktiv yong'in xavfi sinfi", fire === "II" ? "C0" : "C2"],
      ["Bino balandligi (yong'in-texnik)", `${n1(M.Hb - M.p.floor_h)} m`], ["Qavatlar soni", M.p.floors], ["Umumiy maydon", `${n0(M.total)} m²`],
      ["Avtomatik o'chirish (AUPT)", spr ? "Talab qilinadi — sprinkler tizimi" : "Talab qilinmaydi (maydon/sinf bo'yicha)"],
      ["Yong'in signalizatsiyasi", M.cat === "turar-joy" ? "Avtonom tutun datchiklari (har xonada)" : "Manzilli-analog tizim, PPK bilan"],
      ["Ogohlantirish tizimi (SOUE)", M.cat === "turar-joy" ? "1-tur (ovozli)" : M.total > 1000 ? "3-tur (ovozli + yo'nalish ko'rsatkichlari)" : "2-tur"],
    ], [85, 105]);
    notes(T, ZONE.x + 4, y + 2, [
      "1. Evakuatsiya chiqishlari kengligi kamida 0,9 m (turar-joy) / 1,2 m (jamoat), eshiklar chiqish tomonga ochiladi.",
      "2. Zinalar yonmaydigan materialdan; zina kengligi kamida 0,9 m (turar-joy) / 1,35 m (jamoat).",
      "3. Har qavatda kamida bitta o't o'chirgich (OP-4) — har 150 m² ga bittadan.",
      "4. Elektr kabellari yonishni tarqatmaydigan turdan (ng-LS). Yong'in signalizatsiyasi kabellari — FRLS.",
      "5. Gaz qozoni bo'lgan xonada CO datchigi va gazni avtomatik o'chirish klapani.",
      spr ? "6. AUPT: sprinklerlar ≤ 12 m² ga bitta, nasos stansiyasi va suv zaxirasi hisob bilan aniqlanadi." : "6. Ichki yong'in suv quvuri talab qilinmaydi (bino hajmi va sinfi bo'yicha) — tashqi gidrant 200 m radiusda.",
      "Me'yorlar: KMK 2.01.02 (yong'in xavfsizligi), SP 5.13130 (avtomatik tizimlar) asosida, taxminiy.",
    ], 270);
    const nS = rooms.filter(r => r.type !== "kitchen").reduce((s, r) => s + Math.max(1, Math.ceil(r.area / 70)), 0), nH = rooms.filter(r => r.type === "kitchen").length;
    table(o, T, PX, ZONE.y + 4, PW, "Spetsifikatsiya (butun bino)", ["Nomi", "Birlik", "Soni"], [
      ["Tutun datchigi", "dona", nS], ["Issiqlik datchigi", "dona", nH], ["Qo'l datchigi (IPR)", "dona", M.p.floors], ["Sirena", "dona", M.p.floors],
      ["O't o'chirgich OP-4", "dona", M.p.floors * Math.max(1, Math.ceil(M.foot / 150))], ["PPK (qabul-nazorat pribori)", "dona", 1],
      ...(spr ? [["Sprinkler", "dona", allRooms(M).reduce((s, r) => s + Math.max(1, Math.ceil(r.area / 12)), 0)]] : []),
      ["Kabel KPSng(A)-FRLS 1×2×0,75", "m", n0(M.total * 0.8)],
    ], [78, 15, 30]);
    return wrap(o);
  }

  // =====================================================================
  // TX — texnologik yechimlar
  // =====================================================================
  const TECH = { kitchen: [0.5, "E, S, K"], stove: [0, "G"], fridge: [0.3, "E"], washer: [2.2, "E, S, K"], dishwasher: [1.8, "E, S, K"], tv: [0.15, "E"], ac: [0, "E"], boiler: [0.15, "E, G, S"],
    radiator: [0, "T"], bath: [0, "S, K"], shower: [0, "S, K"], toilet: [0, "S, K"], sink: [0, "S, K"], chandelier: [0.1, "E"], lamp: [0.06, "E"], aquarium: [0.1, "E"], fireplace: [0, "—"] };
  function techList(M) {
    const map = {};
    M.floors.forEach((fl, f) => fl.fd.items.forEach(it => { if (!TECH[it[0]]) return; const k = it[0]; (map[k] = map[k] || { t: k, n: 0, floors: new Set() }).n++; map[k].floors.add(f + 1); }));
    const list = Object.values(map).sort((a, b) => Object.keys(TECH).indexOf(a.t) - Object.keys(TECH).indexOf(b.t));
    list.forEach((x, i) => { x.pos = i + 1; });
    return list;
  }
  function txPlan(M, f, num, total) {
    const o = [], T = frame(o, M, "tx", `${f + 1}-qavat: texnologik reja`, num, total, fitScale(M.W, M.D)), list = techList(M), pos = Object.fromEntries(list.map(x => [x.t, x.pos]));
    const { X, Z, k } = planBase(o, T, M, f, { title: `${f + 1}-qavat rejasi: texnologik uskunalar joylashuvi`, furn: true });
    M.floors[f].fd.items.forEach(it => {
      if (!pos[it[0]]) return;
      const r = Interior.itemRect(it);
      o.push(`<rect x="${X(r.x0)}" y="${Z(r.z0)}" width="${((r.x1 - r.x0) * k).toFixed(2)}" height="${((r.z1 - r.z0) * k).toFixed(2)}" fill="#eef1fb" stroke="${ACC}" stroke-width="0.3"/>`);
      o.push(sym.tag(X(it[1]) + 2.5, Z(it[2]) - 2.5, pos[it[0]], ACC));
    });
    const rows = list.filter(x => x.floors.has(f + 1)).map(x => [x.pos, Interior.ITEMS[x.t].n, M.floors[f].fd.items.filter(it => it[0] === x.t).length, TECH[x.t][1]]);
    let y = table(o, T, PX, ZONE.y + 4, PW, `Uskunalar (${f + 1}-qavat)`, ["Poz.", "Nomi", "Soni", "Ulanish"], rows.length ? rows : [["—", "Uskunalar qo'yilmagan", "", ""]], [12, 66, 15, 30]);
    notes(T, PX, y, ["Ulanish: E — elektr, S — suv, K — kanalizatsiya, G — gaz, T — isitish.", "Uskunalarni Konstruktor → Ichki makon'da joylashtirasiz; ro'yxat avtomatik yangilanadi."]);
    return wrap(o);
  }
  function txCalc(M, num, total) {
    const o = [], T = frame(o, M, "tx", "Texnologik ko'rsatkichlar", num, total, 0), list = techList(M), N = persons(M);
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "Texnologik yechimlar: ko'rsatkichlar va uskunalar", 3.6, "middle", "700");
    const res = M.cat === "turar-joy";
    const rows = res ? [["Bino vazifasi", "Turar-joy"], ["Yashovchilar (hisobiy)", `${N} odam`], ["Yashash maydoni", `${n1(allRooms(M).filter(r => r.type === "bed" || r.type === "living").reduce((s, r) => s + r.area, 0))} m²`],
      ["Xonalar soni", allRooms(M).filter(r => r.type === "bed" || r.type === "living" || r.type === "study").length], ["Oshxonalar", allRooms(M).filter(r => r.type === "kitchen").length], ["Ish rejimi", "Doimiy, yil bo'yi"]]
      : [["Bino vazifasi", { jamoat: "Jamoat binosi", tijorat: "Tijorat (ofis/savdo)", interyer: "Interyer" }[M.cat] || M.cat], ["Ish o'rinlari / tashrif buyuruvchilar", `${N} odam`],
        ["Bir odamga maydon", `${n1(M.total / N)} m²`], ["Ish rejimi", "Kuniga 8–12 soat, haftasiga 6 kun"], ["Smenalar", "1"]];
    let y = table(o, T, ZONE.x + 4, ZONE.y + 8, 170, "Texnologik ko'rsatkichlar", ["Ko'rsatkich", "Qiymat"], rows, [95, 75]);
    const sumP = list.reduce((s, x) => s + TECH[x.t][0] * x.n, 0);
    y = table(o, T, ZONE.x + 4, y + 2, 230, "Texnologik uskunalar spetsifikatsiyasi (butun bino)", ["Poz.", "Nomi", "Soni", "Quvvat, kW", "Ulanish", "Qavat"],
      [...list.map(x => [x.pos, Interior.ITEMS[x.t].n, x.n, TECH[x.t][0] ? n2(TECH[x.t][0] * x.n) : "—", TECH[x.t][1], [...x.floors].join(", ")]), ["", "Jami elektr quvvati", "", n2(sumP), "", ""]],
      [14, 80, 18, 30, 40, 48], { boldLast: true });
    notes(T, PX, ZONE.y + 8, ["TX bo'limi bino ichidagi jarayonlar va uskunalarni belgilaydi. Turar-joyda — maishiy texnika va santexnika; jamoat va tijorat binolarida — ish o'rinlari, savdo va ovqatlanish uskunalari.",
      "Uskunalar quvvati EOM, suv va kanalizatsiya — VK, gaz — GS bo'limlarida hisobga olingan.", list.length ? "" : "Ichki makonda texnika qo'yilmagan: Konstruktor → Ichki makon → Avto reja yoki buyumlarni qo'shing."].filter(Boolean));
    return wrap(o);
  }

  // =====================================================================
  // POS / PIC — qurilishni tashkil etish
  // =====================================================================
  function posPlan(M, num, total) {
    const o = [], pos = M.pos, W = M.W, D = M.D, m = 12, SWd = W + 2 * m + 10, SDd = D + 2 * m + 8;
    const scale = [100, 150, 200, 250, 300, 400, 500].find(s => SWd * 1000 / s <= ZONE.w - 20 && SDd * 1000 / s <= ZONE.h - 20) || 500, k = 1000 / scale;
    const T = frame(o, M, "pos", "Qurilish bosh rejasi", num, total, scale);
    const ox = ZONE.x + (ZONE.w - SWd * k) / 2 + m * k, oy = ZONE.y + 8 + m * k;
    const X = x => +(ox + x * k).toFixed(2), Z = z => +(oy + z * k).toFixed(2), R = (x0, z0, x1, z1, a) => o.push(`<rect x="${X(x0)}" y="${Z(z0)}" width="${((x1 - x0) * k).toFixed(2)}" height="${((z1 - z0) * k).toFixed(2)}" ${a}/>`);
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "Qurilish bosh rejasi (stroygenplan)", 3.6, "middle", "700");
    // ko'cha, vaqtinchalik yo'l, to'siq
    R(-m - 5, D + m + 1, W + m + 5, D + m + 7, `fill="#e4e6e8" stroke="${GREY}" stroke-width="0.3"`); T(X(W / 2), Z(D + m + 4.6), "Ko'cha", 2.6, "middle", "700", GREY);
    R(-m + 1, D + 3, W + m - 1, D + 7, `fill="#f0ebe0" stroke="${GREY}" stroke-width="0.25" stroke-dasharray="1.5 0.8"`); T(X(-m + 2), Z(D + 5.6), "Vaqtinchalik yo'l (shag'al, 4 m)", 2.1, "start");
    R(-m, -m, W + m, D + m, `fill="none" stroke="${INK}" stroke-width="0.5" stroke-dasharray="3 1 0.6 1"`);
    const gate = W / 2 + 3; o.push(`<path d="M${X(gate - 3)} ${Z(D + m)}H${X(gate + 3)}" stroke="#fff" stroke-width="1.6"/><path d="M${X(gate - 3)} ${Z(D + m)}l${-1.2} ${-1.2}M${X(gate + 3)} ${Z(D + m)}l1.2 -1.2" stroke="${INK}" stroke-width="0.4"/>`);
    T(X(gate), Z(D + m) - 1.5, "Darvoza va g'ildirak yuvish", 2.1, "middle", "700");
    // bino
    const ring = r => "M" + r.map(([x, z]) => `${X(x)} ${Z(z)}`).join("L") + "Z";
    o.push(`<path d="${M.rings.map(ring).join("")}" fill="url(#rpFound)" stroke="${INK}" stroke-width="0.6"/>`); T(X(W / 2), Z(D / 2), "Quriladigan bino", 2.8, "middle", "700"); T(X(W / 2), Z(D / 2) + 3.6, `${M.p.floors} qavat, ${n0(M.total)} m²`, 2.3);
    // kran va xavfli zona
    const tower = M.p.floors >= 3, cx = tower ? W + 4 : W / 2, cz = tower ? D / 2 : D + 5, Rk = tower ? Math.hypot(W + 4, D / 2 + 2) : pos.reach;
    if (tower) o.push(`<rect x="${X(cx) - 2}" y="${Z(cz) - 2}" width="4" height="4" fill="${C.sup}"/><path d="M${X(cx) - 2} ${Z(cz) - 2}l4 4M${X(cx) + 2} ${Z(cz) - 2}l-4 4" stroke="#fff" stroke-width="0.4"/>`);
    else o.push(`<rect x="${X(cx - 1.25)}" y="${Z(cz - 3)}" width="${2.5 * k}" height="${6 * k}" fill="${C.sup}"/>`);
    o.push(`<clipPath id="posClip"><rect x="21" y="6" width="${PX - 25}" height="${SH - 12}"/></clipPath><g clip-path="url(#posClip)">`);   // zona chizma maydonidan chiqmasin
    o.push(`<circle cx="${X(cx)}" cy="${Z(cz)}" r="${(Rk * k).toFixed(2)}" fill="none" stroke="${C.sup}" stroke-width="0.35" stroke-dasharray="4 1.2"/>`);
    o.push(`<circle cx="${X(cx)}" cy="${Z(cz)}" r="${((Rk + 7) * k).toFixed(2)}" fill="none" stroke="${C.fire}" stroke-width="0.25" stroke-dasharray="1 1"/></g>`);
    T(X(cx), Z(cz) - Rk * k - 1.5, `${pos.crane}, R = ${n1(Rk)} m`, 2.2, "middle", "700", C.sup);
    // omborlar, maishiy shaharcha
    R(-m + 1.5, -m + 1.5, -m + 9.5, -m + 7.5, `fill="#fff" stroke="${INK}" stroke-width="0.35"`); T(X(-m + 5.5), Z(-m + 5), "Ochiq ombor", 2, "middle");
    R(-m + 1.5, -m + 9, -m + 6, -m + 15, `fill="#fff" stroke="${INK}" stroke-width="0.35"`); T(X(-m + 3.75), Z(-m + 12.3), "Yopiq", 1.9, "middle"); T(X(-m + 3.75), Z(-m + 14.3), "ombor", 1.9, "middle");
    [0, 1, 2].forEach(i => R(W + m - 3.5, -m + 1.5 + i * 3, W + m - 1, -m + 4 + i * 3, `fill="#eef1fb" stroke="${ACC}" stroke-width="0.35"`)); T(X(W + m - 4.5), Z(-m + 6), "Maishiy bloklar", 2, "end", "700", ACC);
    R(-m + 1.5, D + m - 3, -m + 3, D + m - 1.5, `fill="${C.ret}"`); T(X(-m + 4), Z(D + m - 1.8), "Suv", 2, "start");
    R(W + m - 3, D + m - 3, W + m - 1.5, D + m - 1.5, `fill="${C.el}"`); T(X(W + m - 3.5), Z(D + m - 1.8), "TP / elektr shiti", 2, "end");
    R(-m + 8, D + m - 3, -m + 10, D + m - 1, `fill="#fff" stroke="${INK}" stroke-width="0.3"`); T(X(-m + 9), Z(D + m - 3.6), "WC", 1.8, "middle");
    // shimol
    const nx = ZONE.x + ZONE.w - 10, ny = ZONE.y + 14; o.push(`<path d="M${nx} ${ny - 6}l2.4 7h-4.8Z" fill="${INK}"/><circle cx="${nx}" cy="${ny}" r="5" fill="none" stroke="${INK}" stroke-width="0.3"/>`); T(nx, ny - 7.5, "Sh", 2.6, "middle", "700");
    let y = legend(o, T, PX, ZONE.y + 4, [[(x, yy) => `<path d="M${x - 3.5} ${yy}h7" stroke="${INK}" stroke-width="0.5" stroke-dasharray="3 1 0.6 1"/>`, "Vaqtinchalik to'siq h = 2,0 m"],
      [(x, yy) => `<path d="M${x - 3.5} ${yy}h7" stroke="${C.sup}" stroke-width="0.4" stroke-dasharray="4 1.2"/>`, "Kran ishlash zonasi"], [(x, yy) => `<path d="M${x - 3.5} ${yy}h7" stroke="${C.fire}" stroke-width="0.3" stroke-dasharray="1 1"/>`, "Xavfli zona (+7 m)"],
      [(x, yy) => `<rect x="${x - 3}" y="${yy - 1.5}" width="6" height="3" fill="#f0ebe0" stroke="${GREY}" stroke-width="0.25"/>`, "Vaqtinchalik yo'l"], [(x, yy) => `<rect x="${x - 3}" y="${yy - 1.5}" width="6" height="3" fill="#eef1fb" stroke="${ACC}" stroke-width="0.3"/>`, "Maishiy bloklar (prorab, kiyinish)"]]);
    y = table(o, T, PX, y, PW, "Asosiy ko'rsatkichlar", ["Ko'rsatkich", "Qiymat"], [["Qurilish davomiyligi", `${pos.total} ish kuni (~${n1(pos.total / 22)} oy)`], ["Ishchilar (eng ko'p)", `${pos.workers} kishi`], ["Kotlovan hajmi", `${n0(pos.exc)} m³`], ["Yuk ko'tarish mexanizmi", pos.crane]], [55, 68]);
    notes(T, PX, y, ["Qurilish maydoni to'siq bilan o'raladi, kirishda pasport-stend o'rnatiladi. Tungi vaqtda shovqinli ishlar taqiqlanadi.", "Xavfli zonada odamlar yurishi taqiqlanadi; o'tish joylari himoya ayvoni bilan."]);
    return wrap(o);
  }
  function posGantt(M, num, total) {
    const o = [], pos = M.pos, T = frame(o, M, "pos", "Kalendar reja", num, total, 0);
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "Qurilishning kalendar rejasi (ish kunlarida)", 3.6, "middle", "700");
    const x0 = ZONE.x + 2, nameW = 72, gx = x0 + nameW + 24, gw = SW - 10 - gx, y0 = ZONE.y + 12, rh = 8.6, kx = gw / pos.total;
    T(x0, y0 - 1.5, "Ish turi", 2.4, "start", "700"); T(x0 + nameW + 12, y0 - 1.5, "Kun", 2.4, "middle", "700");
    const months = Math.ceil(pos.total / 22);
    for (let mo = 0; mo <= months; mo++) { const xx = gx + mo * 22 * kx; if (xx > gx + gw + 0.1) break; o.push(`<path d="M${xx} ${y0 - 4}V${y0 + pos.works.length * rh}" stroke="${LIGHT}" stroke-width="0.2"/>`); if (mo < months) T(xx + Math.min(22 * kx, gx + gw - xx) / 2, y0 - 1.5, `${mo + 1}-oy`, 2.2); }
    pos.works.forEach((w, i) => {
      const yy = y0 + i * rh;
      o.push(`<path d="M${x0} ${yy}H${gx + gw}" stroke="${LIGHT}" stroke-width="0.2"/>`);
      T(x0, yy + 5.3, w.n, 2.3, "start"); T(x0 + nameW + 12, yy + 5.3, String(w.d), 2.3);
      o.push(`<rect x="${(gx + w.s * kx).toFixed(2)}" y="${yy + 2}" width="${Math.max(0.8, w.d * kx).toFixed(2)}" height="${rh - 4}" fill="${i === 6 ? C.vent : i >= 8 ? "#c99a3a" : ACC}"/>`);
    });
    o.push(`<path d="M${x0} ${y0 + pos.works.length * rh}H${gx + gw}" stroke="${INK}" stroke-width="0.3"/>`);
    const yy = y0 + pos.works.length * rh + 8;
    // ishchilar soni grafigi
    T(x0, yy + 3, "Ishchilar soni", 2.6, "start", "700");
    const crew = d => pos.works.filter(w => d >= w.s && d < w.s + w.d).length;
    let pts = ""; for (let d = 0; d <= pos.total; d++) { const c = crew(d) / 4 * pos.workers; pts += `${(gx + d * kx).toFixed(2)},${(yy + 30 - Math.min(1, c / pos.workers) * 24).toFixed(2)} `; }
    o.push(`<path d="M${gx} ${yy + 30}H${gx + gw}M${gx} ${yy + 6}V${yy + 30}" stroke="${INK}" stroke-width="0.25"/><polyline points="${pts}" fill="none" stroke="${C.sup}" stroke-width="0.45"/>`);
    T(gx - 2, yy + 7.5, String(pos.workers), 2.2, "end"); T(gx - 2, yy + 30, "0", 2.2, "end");
    T(SW - 10, yy + 36, `Jami: ${pos.total} ish kuni ≈ ${n1(pos.total / 22)} oy`, 3, "end", "700");
    return wrap(o);
  }

  // =====================================================================
  // OOS — atrof-muhit
  // =====================================================================
  function oosSheet(M, num, total) {
    const o = [], ov = M.ov, vk = M.vk, eom = M.eom, gs = M.gs, T = frame(o, M, "oos", "Atrof-muhit muhofazasi", num, total, 0);
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "Atrof-muhitga ta'sir va muhofaza tadbirlari", 3.6, "middle", "700");
    const waste = M.total * 0.05;                                                 // t, qurilish chiqindisi ~50 kg/m²
    let y = table(o, T, ZONE.x + 4, ZONE.y + 8, 128, "Qurilish chiqindilari", ["Turi", "t", "Qayta ishlash"], [
      ["G'isht, beton bo'laklari", n1(waste * 0.6), "Maydalab — yo'l asosi"], ["Yog'och", n1(waste * 0.1), "Qayta ishlash"], ["Metall", n1(waste * 0.05), "Metallolom"],
      ["Qadoq (karton, plyonka)", n1(waste * 0.15), "Saralab topshirish"], ["Boshqa", n1(waste * 0.1), "Poligon"], ["Jami", n1(waste), ""],
    ], [55, 20, 53], { boldLast: true });
    const kwhE = eom.Pr * 1800 * (st.heat === "elektr" ? 1 : 0.6), gasY = gs.year + gs.yearStove;
    const co2 = [["Gaz yoqish", gasY * 1.9 / 1000], ["Elektr energiya", kwhE * 0.45 / 1000]];
    y = table(o, T, ZONE.x + 4, y + 1, 128, "Havoga chiqindilar (ekspluatatsiya)", ["Manba", "Yillik", "CO₂, t/yil"], [
      ["Gaz (isitish, plita)", `${n0(gasY)} m³`, n2(co2[0][1])], ["Elektr energiya", `${n0(kwhE)} kWh`, n2(co2[1][1])], ["Jami", "", n2(co2[0][1] + co2[1][1])],
    ], [55, 35, 38], { boldLast: true });
    const rain = M.foot * 0.45 * 0.8;
    y = table(o, T, ZONE.x + 4, y + 1, 128, "Suv resurslari", ["Ko'rsatkich", "m³/yil"], [["Ichimlik suv iste'moli", n0(vk.qDay * 365)], ["Maishiy oqova", n0(vk.qDay * 365)], ["Tomdan yomg'ir suvi (to'plash mumkin)", n0(rain)]], [90, 38]);
    // energiya samaradorligi sinfi
    const spec = ov.annual / Math.max(1, M.total), cls = spec < 50 ? "A" : spec < 100 ? "B" : spec < 150 ? "C" : spec < 200 ? "D" : "E";
    const ex = ZONE.x + 142, ey = ZONE.y + 12;
    T(ex, ey - 2, "Energiya samaradorligi (isitish)", 3, "start", "700");
    ["A", "B", "C", "D", "E"].forEach((c, i) => { const col = ["#1f8a4c", "#6cb33f", "#d6c21f", "#e48a24", "#d0302b"][i], w = 30 + i * 10; o.push(`<path d="M${ex} ${ey + 2 + i * 7}h${w}l3 3 -3 3h${-w}Z" fill="${col}"/>`); T(ex + 2.5, ey + 7.2 + i * 7, c, 3.2, "start", "700", "#fff"); if (c === cls) { o.push(`<path d="M${ex + w + 8} ${ey + 5 + i * 7}l5 -3v6Z" fill="${INK}"/>`); T(ex + w + 15, ey + 6.2 + i * 7, `${n0(spec)} kWh/m²·yil`, 2.6, "start", "700"); } });
    notes(T, ex, ey + 44, [
      "Tavsiyalar:",
      `• Tashqi devor izolyatsiyasi (mineral paxta 100 mm) — isitish sarfi ~35% kam, CO₂ ~${n1(co2[0][1] * 0.35)} t/yil kam.`,
      "• Tomga quyosh panellari yoki quyosh suv isitgichi.",
      `• Yomg'ir suvini to'plash (${n0(rain)} m³/yil) — hovli sug'orish uchun.`,
      `• Ko'kalamzorlashtirish: kamida ${Math.max(3, Math.ceil(M.foot / 40))} ta daraxt (GP bo'limi).`,
    ], 140);
    notes(T, PX, ZONE.y + 8, [
      "Qurilish davridagi tadbirlar:",
      "1. Shovqin: ishlar 7:00–22:00 oralig'ida; turar-joy yonida 55 dBA dan oshmasin.",
      "2. Chang: quruq kunlari maydon va yo'llar namlanadi, sochiluvchan yuklar yopiq tashiladi.",
      "3. Unumdor tuproq qatlami (20–30 cm) olinib, alohida saqlanadi va obodonlashtirishda qayta ishlatiladi.",
      "4. Daraxtlarni kesish faqat ruxsatnoma bilan; saqlanadiganlari to'siq bilan himoyalanadi.",
      "5. Chiqindilar saralanib, litsenziyali tashkilotga topshiriladi; yoqish taqiqlanadi.",
      "6. G'ildirak yuvish moslamasi chiqishda — ko'chaga loy chiqarilmaydi.",
      "Asos: O'zR \"Tabiatni muhofaza qilish to'g'risida\"gi qonun, ekologik ekspertiza talablari (taxminiy).",
    ]);
    return wrap(o);
  }

  // =====================================================================
  // SM — smeta
  // =====================================================================
  function smSheet(M, num, total) {
    const o = [], sm = M.sm, T = frame(o, M, "sm", "Yig'ma smeta hisobi", num, total, 0), r = Number(st.rate) || 0;
    T(ZONE.x + ZONE.w / 2, ZONE.y + 3, "Qurilish qiymatining yig'ma smeta hisobi (USD)", 3.6, "middle", "700");
    const money = v => "$" + n0(v);
    let y = table(o, T, ZONE.x + 2, ZONE.y + 7, 262, "", ["Bo'lim", "Ish va xarajatlar", "Birlik", "Miqdor", "Narx, $", "Summa, $"],
      sm.rows.map(x => [x.sec, x.n, x.u, x.u === "dona" || x.u === "kompl." ? n0(x.v) : n1(x.v), n0(x.pr), n0(x.s)]), [22, 112, 20, 32, 30, 46], { rh: 4.4, fs: 2.15 });
    y = table(o, T, ZONE.x + 2, y - 2, 262, "", ["", "To'g'ridan-to'g'ri xarajatlar", "", "", "", n0(sm.direct)],
      [...sm.adds.map(a => ["", `${a.n} (${Math.round(a.k * 100)}%)`, "", "", "", n0(a.v)]), ["", "QQS (12%)", "", "", "", n0(sm.vat)], ["", "JAMI SMETA QIYMATI", "", "", "", n0(sm.total)]],
      [22, 112, 20, 32, 30, 46], { rh: 4.4, fs: 2.15, boldLast: true });
    // ulushlar
    const by = {}; sm.rows.forEach(x => { by[x.sec] = (by[x.sec] || 0) + x.s; });
    const items = Object.entries(by).sort((a, b) => b[1] - a[1]), mx = items[0] ? items[0][1] : 1;
    let yy = ZONE.y + 4; T(PX, yy + 3, "Bo'limlar ulushi", 3, "start", "700"); yy += 7;
    items.forEach(([s, v]) => { T(PX, yy + 2.4, s, 2.3, "start", "700"); o.push(`<rect x="${PX + 18}" y="${yy}" width="${(70 * v / mx).toFixed(2)}" height="3" fill="${ACC}"/>`); T(PX + 20 + 70 * v / mx, yy + 2.6, `${Math.round(v / sm.direct * 100)}%`, 2.2, "start"); yy += 5.2; });
    yy = table(o, T, PX, yy + 4, PW, "Natija", ["Ko'rsatkich", "Qiymat"], [
      ["Jami (QQS bilan)", money(sm.total)], ["1 m² narxi", money(sm.perM2)], ...(r ? [["So'mda (1 $ = " + n0(r) + ")", n0(sm.total * r / 1e6) + " mln so'm"]] : []),
      ...(typeof estimate === "function" && typeof BASE_PRICE !== "undefined" && BASE_PRICE[M.cat] ? [["Tezkor baho (m² bo'yicha)", money(estimate(M.cat, QK[M.p.quality] ? M.p.quality : "biznes", M.total, M.p.floors).construction_cost)]] : []),
    ], [62, 61]);
    notes(T, PX, yy + 2, ["Narxlar taxminiy (2026, Toshkent, materiallar va ish haqi bilan). Aniq smeta — loyiha hajmlari va joriy narxlar asosida tuziladi.", `Sifat darajasi: ${M.p.quality} (pardozlash koeffitsienti ${QK[M.p.quality] || 1.35}).`]);
    return wrap(o);
  }

  // ---------- Bo'lim varaqlari ----------
  function sheetsFor(M, sec) {
    const N = M.p.floors, L = [], per = (fn, t) => { for (let f = 0; f < N; f++) L.push({ t: `${f + 1}-qavat${t}`, make: (n, tt) => fn(M, f, n, tt) }); };
    if (sec === "kr") { L.push({ t: "Poydevor rejasi", make: (n, t) => krFound(M, n, t) }, { t: "Yopma / karkas rejasi", make: (n, t) => krFrame(M, n, t) }); }
    else if (sec === "ov") { L.push({ t: "Issiqlik hisobi", make: (n, t) => ovCalc(M, n, t) }); per(ovPlan, ""); }
    else if (sec === "vk") { L.push({ t: "Suv balansi", make: (n, t) => vkCalc(M, n, t) }); per(vkPlan, ""); }
    else if (sec === "eom") { L.push({ t: "Yuklama hisobi", make: (n, t) => eomCalc(M, n, t) }); per(eomPlan, ""); }
    else if (sec === "gs") {                                                   // 1-qavat (kirish, qozon) va oshxonasi bor qavatlar
      M.floors.forEach((fl, f) => { if (f === 0 || fl.rooms.some(r => r.type === "kitchen")) L.push({ t: `${f + 1}-qavat`, make: (n, t) => gsPlan(M, f, n, t) }); });
      L.push({ t: "Hisob va talablar", make: (n, t) => gsCalc(M, n, t) });
    }
    else if (sec === "ss") per(ssPlan, "");
    else if (sec === "ps") { L.push({ t: "Tavsif va tadbirlar", make: (n, t) => psCalc(M, n, t) }); per(psPlan, ""); }
    else if (sec === "tx") { L.push({ t: "Ko'rsatkichlar", make: (n, t) => txCalc(M, n, t) }); per(txPlan, ""); }
    else if (sec === "pos") { L.push({ t: "Qurilish bosh rejasi", make: (n, t) => posPlan(M, n, t) }, { t: "Kalendar reja", make: (n, t) => posGantt(M, n, t) }); }
    else if (sec === "oos") L.push({ t: "Muhofaza tadbirlari", make: (n, t) => oosSheet(M, n, t) });
    else if (sec === "sm") L.push({ t: "Yig'ma smeta", make: (n, t) => smSheet(M, n, t) });
    return L.map((s, i) => ({ t: s.t, make: () => s.make(i + 1, L.length) }));
  }
  const codeOf = (sec, M) => (sec === "kr" && M ? M.kr.sys.toUpperCase() : SEC[sec].c.split(" / ")[0]);

  // ---------- Bo'limlar paneli (GP, AR va shu sahifada) ----------
  const web = () => typeof showView === "function";
  function codesHTML(active) {
    return `<nav class="rp-codes" aria-label="Loyiha bo'limlari">${SECTIONS.map(s => {
      const on = s.k === active, href = s.view ? (web() ? `#${s.view}` : s.file) : web() ? "#bolimlar" : "bolimlar.html";
      const dv = web() ? ` data-view="${s.view || "bolimlar"}"` : "";
      return `<a href="${href}"${dv} data-rpk="${s.k}" title="${esc(s.n)}"${on ? ' aria-current="page"' : ""}><b>${esc(s.c)}</b><span>${esc(s.n)}</span></a>`;
    }).join("")}</nav>`;
  }
  function fillCodes() { document.querySelectorAll("[data-rp-codes]").forEach(el => { const a = el.dataset.rpCodes || st.sec; el.innerHTML = codesHTML(a === "self" ? st.sec : a); }); }

  function render() {
    fillCodes();
    const box = $("rpApp"); if (!box) return;
    const pr = project();
    if (!pr.list.length) { box.innerHTML = `<p class="empty">Avval Konstruktorda bino loyihalang — bo'limlar shu loyihadan tuziladi.</p>`; return; }
    if (houseIdx >= pr.list.length) houseIdx = Math.min(pr.active || 0, pr.list.length - 1);
    const b = pr.list[Math.min(houseIdx, pr.list.length - 1)];
    let M, sheets;
    try { M = model(pr, b); sheets = sheetsFor(M, st.sec); sheetIdx = Math.min(sheetIdx, sheets.length - 1); current = sheets[sheetIdx].make(); }
    catch (err) { console.error(err); box.innerHTML = `<p class="empty">Varaqni chizib bo'lmadi: ${esc(err.message)}</p>`; return; }
    const S = SEC[st.sec], code = codeOf(st.sec, M);
    const opts = st.sec === "kr" ? `<label class="gp-sel">Tizim <select data-rpo="sys"><option value="">Avto (materialdan)</option>${Object.entries(SYS).map(([k, v]) => `<option value="${k}"${st.sys === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`
      : /ov|vk|eom|gs|oos|sm/.test(st.sec) ? `<label class="gp-sel">Isitish <select data-rpo="heat">${Object.entries(HEAT).map(([k, v]) => `<option value="${k}"${st.heat === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>` : "";
    const rate = st.sec === "sm" ? `<label class="gp-sel">1 $ = <input type="number" min="0" step="10" value="${Number(st.rate) || 0}" data-rpo="rate" style="width:7em"> so'm</label>` : "";
    box.innerHTML = `<div class="rp-head"><b>${esc(S.c)}</b> <span>${esc(S.n)}</span></div>
      <div class="gp-bar ar-bar">
        ${pr.list.length > 1 ? `<div class="ar-tabs" role="tablist" aria-label="Uylar">${pr.list.map((_, i) => `<button type="button" role="tab" data-rph="${i}" aria-selected="${i === houseIdx}">${i + 1}-uy</button>`).join("")}</div>` : ""}
        <div class="ar-tabs" role="tablist" aria-label="Varaqlar">${sheets.map((s, i) => `<button type="button" role="tab" data-rps="${i}" aria-selected="${i === sheetIdx}"><b>${esc(code)}-${i + 1}</b> ${esc(s.t)}</button>`).join("")}</div>
        ${opts}${rate}
        <span class="sp"></span>
        <button type="button" class="btn-ghost" data-rpa="svg">SVG yuklab olish</button>
        <button type="button" class="btn-ghost" data-rpa="print">Hammasini chop etish / PDF</button>
        ${web() ? `<a class="btn" href="#konstruktor" data-view="konstruktor">Konstruktorda o'zgartirish</a>` : `<a class="btn" href="designer.html">Konstruktorda o'zgartirish</a>`}
      </div>
      <div class="gp-sheet ar-sheet">${current}</div>
      <div class="ar-print rp-print" aria-hidden="true"></div>
      <p class="muted gp-note">Varaqlar Konstruktordagi bino va ichki rejadan avtomatik tuziladi. Hisoblar eskiz bosqichi uchun taxminiy: ishchi loyiha tegishli mutaxassislar hisobi, texnik shartlar va ekspertiza bilan tasdiqlanadi.</p>`;
  }
  function download() {
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + current], { type: "image/svg+xml" }), name = `${SEC[st.sec].c.split(" / ")[0]}-${sheetIdx + 1}.svg`;
    if (window.saveFile) { window.saveFile(name, blob); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function printAll() {
    const pr = project(), box = document.querySelector(".rp-print"); if (!box || !pr.list.length) return;
    const M = model(pr, pr.list[Math.min(houseIdx, pr.list.length - 1)]);
    box.innerHTML = sheetsFor(M, st.sec).map(s => `<div class="ar-page">${s.make()}</div>`).join("");
    document.documentElement.classList.add("ar-printing"); window.print();
    setTimeout(() => { document.documentElement.classList.remove("ar-printing"); box.innerHTML = ""; }, 800);
  }
  document.addEventListener("click", e => {
    const c = e.target.closest("[data-rpk]");
    if (c) { const s = SEC[c.dataset.rpk]; if (s && !s.view) { st.sec = s.k; sheetIdx = 0; save(); if (!web() && $("rpApp")) { e.preventDefault(); render(); } else setTimeout(render, 0); } return; }
    const t = e.target.closest("[data-rps],[data-rph],[data-rpa]"); if (!t) return;
    if (t.dataset.rps) { sheetIdx = Number(t.dataset.rps); render(); }
    else if (t.dataset.rph) { houseIdx = Number(t.dataset.rph); sheetIdx = 0; render(); }
    else if (t.dataset.rpa === "svg") download();
    else if (t.dataset.rpa === "print") printAll();
  });
  document.addEventListener("change", e => {
    const t = e.target.closest("[data-rpo]"); if (!t) return;
    st[t.dataset.rpo] = t.dataset.rpo === "rate" ? Math.max(0, Number(t.value) || 0) : t.value; save(); render();
  });
  if (!web()) { const go = () => { fillCodes(); if ($("rpApp")) render(); }; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go(); }
  else { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fillCodes); else fillCodes(); }
  return { render, fillCodes, SECTIONS, model: () => { const pr = project(); return pr.list.length ? model(pr, pr.list[0]) : null; },
    sheetsOf: (b, sec) => { const M = model({ name: "", list: [b] }, b); return sheetsFor(M, sec).map(s => ({ t: s.t, svg: s.make() })); } };   // tekshirish va eksport uchun
})();
window.UstunRP = UstunRP;
