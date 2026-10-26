// Bino modeli: parametrlar + qo'lda bo'yalgan kataklardan fasad (2D) va izometrik (3D) chizma yasaydi.
// Barcha o'lchamlar metrda; chizishda piksel masshtabiga o'tkaziladi.

// Fasad materiallari. dens — devor zichligi (kg/m³), u — devorning issiqlik o'tkazuvchanligi (W/m²·K), taxminiy qiymatlar
const MATERIALS = {
  gisht:     { label: "Pishiq g'isht", fill: "#b5683f", pattern: "brick",  dens: 1800, u: 1.1 },
  oqgisht:   { label: "Oq g'isht",     fill: "#e3ddcf", pattern: "brick",  dens: 1800, u: 1.1 },
  beton:     { label: "Beton",         fill: "#a9adac", pattern: "panel",  dens: 2400, u: 2.0 },
  qorabeton: { label: "Qora beton",    fill: "#4c5157", pattern: "panel",  dens: 2400, u: 2.0 },
  ganch:     { label: "Oq ganch",      fill: "#ece7dc", pattern: null,     dens: 1500, u: 0.9 },
  travertin: { label: "Travertin",     fill: "#d6c39b", pattern: "stone",  dens: 2400, u: 1.2 },
  tosh:      { label: "Tabiiy tosh",   fill: "#8c8478", pattern: "rubble", dens: 2500, u: 1.6 },
  koshin:    { label: "Koshin",        fill: "#2f5fae", pattern: "tile",   dens: 1900, u: 1.2 },
  yogoch:    { label: "Yog'och",       fill: "#a8734a", pattern: "wood",   dens: 600,  u: 0.45 },
  metall:    { label: "Metall panel",  fill: "#8e99a2", pattern: "seam",   dens: 400,  u: 0.35 },
};
const INK = "#1f2326", GLASS = "#3f5f7e", GLASS_HI = "#9cbdd8", ROOF_TILE = "#5a4840", DOME = "#2a9896";

const CELL_LABELS = {
  auto: "Avto", win: "Deraza", wide: "Panorama", arch: "Arkali", balc: "Balkon",
  door: "Eshik", shop: "Vitrina", arcade: "Arkada", wall: "Devor",
  slit: "Tor", round: "Dumaloq", lattice: "Panjara",
};
// Har bir element fasaddagi katak ichida egallagan ulushi: [x1, x2, z1, z2] (0..1)
const OPENING = {
  win:    [.28, .72, .25, .75],
  wide:   [.08, .92, .20, .80],
  arch:   [.30, .70, .20, .82],
  balc:   [.30, .70, .08, .85],
  door:   [.30, .70, .00, .75],
  shop:   [.06, .94, .00, .80],
  arcade: [.10, .90, .00, .85],
  slit:   [.40, .60, .12, .88],      // tor vertikal deraza
  round:  [.25, .75, .20, .80],      // dumaloq deraza: diametri katakning eni va balandligidan kichigi
  lattice:[.22, .78, .18, .82],      // panjarali (girih) deraza
  wall:   null,
};

// Umumiy deraza turi -> yuqori qavatlardagi katak turi
const WINDOW_CELL = { oddiy: "win", arkali: "arch", panorama: "wide", tor: "slit", dumaloq: "round", panjara: "lattice", yoq: "wall" };
const upperType = p => WINDOW_CELL[p.window] || "win";

// Tanlov ro'yxatlari (server.py dagi DESIGN_CHOICES bilan bir xil bo'lishi kerak)
// Plan shakllari. To'rtburchakdan tashqari: to'rtburchaklar birlashmasi ("qanotlar") va qavariq ko'pburchaklar
const SHAPES = {
  rect: "To'rtburchak", L: "L shakl", U: "П shakl", T: "T shakl", court: "Ichki hovlili",
  circle: "Aylana", octagon: "Sakkizburchak", hexagon: "Oltiburchak", triangle: "Uchburchak", trapezoid: "Trapetsiya",
};
const OPTIONS = {
  shape: Object.keys(SHAPES),
  category: ["turar-joy", "jamoat", "tijorat", "interyer"],
  quality: ["standart", "biznes", "premium"],
  roof: ["tekis", "nishab", "bir", "piramida", "gumbaz", "terrasa"],
  material: Object.keys(MATERIALS),
  window: Object.keys(WINDOW_CELL),
  ground: ["oddiy", "arkada", "vitrina"],
};

const DEFAULT_PARAMS = {
  category: "turar-joy", quality: "biznes", floors: 5, bays: 6, floor_h: 3.3, bay_w: 4.2, depth: 14,
  roof: "tekis", material: "gisht", window: "oddiy", ground: "oddiy", shape: "rect", wing: 0.4,
};

// Boshlang'ich nuqtalar: "bosh" — noldan, qolganlari tayyor andoza
const TEMPLATES = {
  bosh: {
    label: "Bo'sh varaq", hint: "1 qavat, derazasiz devor. Hammasini o'zingiz qo'shasiz.",
    params: { category: "turar-joy", floors: 1, bays: 3, floor_h: 3.3, bay_w: 4.2, depth: 10, roof: "tekis", material: "ganch", window: "yoq", ground: "oddiy" },
    cells: {},
  },
  hovli: {
    label: "Hovli uy", hint: "2 qavat, g'isht, nishab tom.",
    params: { category: "turar-joy", floors: 2, bays: 4, floor_h: 3.2, bay_w: 4.5, depth: 12, roof: "nishab", material: "gisht", window: "oddiy", ground: "oddiy" },
    cells: { "1,1": "balc", "1,2": "balc" },
  },
  turar: {
    label: "Ko'p qavatli uy", hint: "9 qavat, beton, pastda do'konlar.",
    params: { category: "turar-joy", floors: 9, bays: 6, floor_h: 3.0, bay_w: 3.9, depth: 14, roof: "tekis", material: "beton", window: "oddiy", ground: "vitrina" },
    cells: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].flatMap(f => [[`${f},1`, "balc"], [`${f},4`, "balc"]])),
  },
  ofis: {
    label: "Ofis bloki", hint: "6 qavat, panorama oynalar, tomda terrasa.",
    params: { category: "tijorat", floors: 6, bays: 8, floor_h: 3.6, bay_w: 4.5, depth: 18, roof: "terrasa", material: "travertin", window: "panorama", ground: "vitrina" },
    cells: {},
  },
  jamoat: {
    label: "Gumbazli bino", hint: "Arkada, arkali derazalar, koshin gumbaz.",
    params: { category: "jamoat", floors: 2, bays: 7, floor_h: 4.2, bay_w: 4.0, depth: 16, roof: "gumbaz", material: "ganch", window: "arkali", ground: "arkada" },
    cells: {},
  },
};

function cellType(p, cells, f, b) {
  const own = cells[`${f},${b}`];
  if (own) return own;
  const upper = upperType(p);
  if (f > 0) return upper;
  const mid = b === Math.floor(p.bays / 2);
  if (p.ground === "arkada") return "arcade";
  if (p.ground === "vitrina") return mid ? "door" : "shop";
  if (p.window === "yoq") return "wall";       // bo'sh varaq: eshik ham o'zingiz qo'yasiz
  return mid ? "door" : upper;
}

function geometry(p) {
  const W = p.bays * p.bay_w, Hb = p.floors * p.floor_h;
  // To'rtburchak bo'lmagan planda nishab tomlar qanot eni (yoki qavariq shaklning kichik o'lchami) bo'ylab quriladi
  const rect = shapeOf(p) === "rect", ps = rect ? null : planShape(p), span = rect ? W : ps.wings ? ps.a : Math.min(W, p.depth);
  const domeR = rect ? Math.min(W * 0.28, p.depth * 0.4, 9) : Math.min((ps.wings ? ps.a : Math.min(W, p.depth)) * 0.36, 9);
  const R = {
    tekis: 0.9,
    nishab: Math.min(span * (rect ? 0.22 : 0.4), 7),
    bir: Math.min(span * (rect ? 0.14 : 0.25), 4.5),       // bir nishabli: eni bo'ylab ko'tariladi
    piramida: Math.min(Math.min(rect ? W : span, p.depth) * 0.32, 6.5),  // to'rt nishabli, cho'qqisi markazda
    gumbaz: domeR * 0.45 + domeR * 1.15 + 1.2,
    terrasa: p.floor_h + 0.4,
  }[p.roof];
  return { W, D: p.depth, Hb, R, H: Hb + R, domeR };
}

// ---------- Plan shakli ----------
// Koordinatalar metrda: x 0..W (chapdan o'ngga), z 0..D (orqadan ko'chaga; z = D — old fasad).
// Konturlar shunday aylanadiki, AB qirraning tashqi normali (-dz, dx) bo'ladi (old fasad: +x yo'nalish, normal +z).
// Qavariq bo'lmagan shakllar to'rtburchak "qanotlar"dan yig'iladi: tom har qanotga alohida quriladi.
const shapeOf = p => (SHAPES[p && p.shape] ? p.shape : "rect");
const ringArea = pts => pts.reduce((s, [x, z], i) => { const [x2, z2] = pts[(i + 1) % pts.length]; return s + x * z2 - x2 * z; }, 0) / 2;
const orient = (pts, neg) => ((ringArea(pts) < 0) === neg ? pts : pts.slice().reverse());   // tashqi kontur: manfiy, teshik: musbat
function planShape(p) {
  const W = p.bays * p.bay_w, D = p.depth, s = shapeOf(p), m = Math.min(W, D);
  let a = Math.max(3, m * Math.min(0.6, Math.max(0.2, Number(p.wing) || 0.4)));   // qanot eni
  let outer, holes = [], wings = null;
  const R = (x0, z0, x1, z1) => ({ x0, z0, x1, z1 });
  switch (s) {
    case "L": a = Math.min(a, W - 2, D - 2);
      outer = [[0, D], [W, D], [W, D - a], [a, D - a], [a, 0], [0, 0]]; wings = [R(0, D - a, W, D), R(0, 0, a, D - a)]; break;
    case "U": a = Math.min(a, (W - 2) / 2, D - 2);
      outer = [[0, D], [W, D], [W, 0], [W - a, 0], [W - a, D - a], [a, D - a], [a, 0], [0, 0]]; wings = [R(0, D - a, W, D), R(0, 0, a, D - a), R(W - a, 0, W, D - a)]; break;
    case "T": a = Math.min(a, W - 2, D - 2);
      outer = [[0, D], [W, D], [W, D - a], [(W + a) / 2, D - a], [(W + a) / 2, 0], [(W - a) / 2, 0], [(W - a) / 2, D - a], [0, D - a]];
      wings = [R(0, D - a, W, D), R((W - a) / 2, 0, (W + a) / 2, D - a)]; break;
    case "court": a = Math.min(a, (m - 3) / 2);
      outer = [[0, D], [W, D], [W, 0], [0, 0]]; holes = [[[a, D - a], [W - a, D - a], [W - a, a], [a, a]]];
      wings = [R(0, D - a, W, D), R(0, 0, W, a), R(0, a, a, D - a), R(W - a, a, W, D - a)]; break;
    case "circle": outer = Array.from({ length: 24 }, (_, i) => [W / 2 + W / 2 * Math.cos(i * Math.PI / 12), D / 2 + D / 2 * Math.sin(i * Math.PI / 12)]); break;
    case "octagon": { const c = m * 0.29; outer = [[c, D], [W - c, D], [W, D - c], [W, c], [W - c, 0], [c, 0], [0, c], [0, D - c]]; break; }
    case "hexagon": outer = [[W / 4, D], [W * 3 / 4, D], [W, D / 2], [W * 3 / 4, 0], [W / 4, 0], [0, D / 2]]; break;
    case "triangle": outer = [[0, D], [W, D], [W / 2, 0]]; break;
    case "trapezoid": outer = [[0, D], [W, D], [W * 0.8, 0], [W * 0.2, 0]]; break;
    default: outer = [[0, D], [W, D], [W, 0], [0, 0]]; wings = [R(0, 0, W, D)];
  }
  outer = orient(outer, true); holes = holes.map(h => orient(h, false));
  const rings = [outer, ...holes];
  const area = Math.abs(ringArea(outer)) - holes.reduce((t, h) => t + Math.abs(ringArea(h)), 0);
  const perimeter = rings.reduce((t, r) => t + r.reduce((u, [x, z], i) => { const [x2, z2] = r[(i + 1) % r.length]; return u + Math.hypot(x2 - x, z2 - z); }, 0), 0);
  return { shape: s, W, D, a, outer, holes, rings, wings, convex: !wings, area, perimeter };
}
// Har bir qirra: boshlanishi, yo'nalishi, tashqi normali, uzunligi; "front" — ko'chadan ko'rinadigan qirra
function planEdges(ps) {
  const frontAt = x => {                                        // shu x da konturning eng oldingi (eng katta z) nuqtasi
    let best = -Infinity;
    ps.outer.forEach(([x1, z1], i) => { const [x2, z2] = ps.outer[(i + 1) % ps.outer.length];
      if ((x - x1) * (x - x2) <= 1e-9 && Math.abs(x2 - x1) > 1e-9) best = Math.max(best, z1 + (z2 - z1) * (x - x1) / (x2 - x1)); });
    return best;
  };
  const out = [];
  ps.rings.forEach((r, ri) => r.forEach(([x1, z1], i) => {
    const [x2, z2] = r[(i + 1) % r.length], L = Math.hypot(x2 - x1, z2 - z1); if (L < 1e-6) return;
    const dx = (x2 - x1) / L, dz = (z2 - z1) / L, nx = -dz, nz = dx, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    const full = ri === 0 && nz > 0.99 && Math.abs(L - ps.W) < 0.01 && Math.abs(mz - ps.D) < 0.01;   // to'liq eni bo'yicha old fasad
    const front = ri === 0 && nz > 0.5 && mz >= frontAt(mx) - 0.05;
    out.push({ x1, z1, x2, z2, L, dx, dz, nx, nz, full, front, hole: ri > 0 });
  }));
  return out;
}
// Ko'pburchakni d ga suradi (musbat — tashqariga), burchaklarda kesishma (miter) bilan
function offsetRing(r, d) {
  const n = r.length, out = [];
  for (let i = 0; i < n; i++) {
    const [ax, az] = r[(i - 1 + n) % n], [bx, bz] = r[i], [cx, cz] = r[(i + 1) % n];
    const l1 = Math.hypot(bx - ax, bz - az) || 1, l2 = Math.hypot(cx - bx, cz - bz) || 1;
    const n1 = [-(bz - az) / l1, (bx - ax) / l1], n2 = [-(cz - bz) / l2, (cx - bx) / l2];
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const k = d / Math.max(0.3, mx * n1[0] + mz * n1[1]);
    out.push([bx + mx * k, bz + mz * k]);
  }
  return out;
}

function metrics(p, cells) {
  const g = geometry(p);
  let glass = 0;
  for (let f = 0; f < p.floors; f++) for (let b = 0; b < p.bays; b++) {
    const o = OPENING[cellType(p, cells, f, b)];
    if (o && cellType(p, cells, f, b) !== "arcade") glass += (o[1] - o[0]) * (o[3] - o[2]);
  }
  const floorArea = shapeOf(p) === "rect" ? g.W * g.D : planShape(p).area;
  const extra = p.roof === "terrasa" ? floorArea * 0.3 : 0;   // tomdagi pavilon
  return {
    width: g.W, height: g.H, floorArea,
    totalArea: Math.round(floorArea * p.floors + extra),
    glazing: Math.round(glass / (p.floors * p.bays) * 100),
  };
}

const f1 = n => (Math.round(n * 10) / 10).toLocaleString("ru-RU");

// ---------------- FASAD (old ko'rinish) ----------------
function renderFacade(p, cells, opts = {}) {
  const uid = opts.uid || "f" + Math.random().toString(36).slice(2, 7);
  const VW = 640, VH = 520, L = 56, Rm = 80, T = 24, B = 56;
  const g = geometry(p);
  const s = Math.min((VW - L - Rm) / (g.W + 1), (VH - T - B) / g.H);
  const x0 = L + ((VW - L - Rm) - g.W * s) / 2, gy = VH - B;
  const X = m => x0 + m * s, Y = z => gy - z * s;
  const mat = MATERIALS[p.material];
  const out = [];

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" class="bld">`);
  out.push(`<defs>${patternDef(uid, mat.pattern, s)}</defs>`);
  out.push(`<line class="d-ground" x1="8" y1="${gy}" x2="${VW - 8}" y2="${gy}"/>`);

  // Tom (orqa qism, devordan oldin chiziladi)
  if (p.roof === "nishab") {
    const oh = 0.55, yE = g.Hb - (g.R * oh) / (g.W / 2);          // 3D bilan bir xil: tom chetga tushib boradi, nishab burchagi atan(R / (W/2))
    out.push(`<polygon points="${X(-oh)},${Y(yE)} ${X(g.W / 2)},${Y(g.H)} ${X(g.W + oh)},${Y(yE)}" fill="${ROOF_TILE}" stroke="${INK}" stroke-width="1.2"/>`);
    for (let i = 1; i < 6; i++) {           // cherepitsa qatorlari
      const z = yE + (g.H - yE) * i / 6, half = (g.W / 2 + oh) * (1 - i / 6);
      out.push(`<line x1="${X(g.W / 2 - half)}" y1="${Y(z)}" x2="${X(g.W / 2 + half)}" y2="${Y(z)}" stroke="${INK}" stroke-opacity=".3"/>`);
    }
  }
  if (p.roof === "piramida") {
    const oh = 0.55;
    out.push(`<polygon points="${X(-oh)},${Y(g.Hb)} ${X(g.W / 2)},${Y(g.H)} ${X(g.W + oh)},${Y(g.Hb)}" fill="${ROOF_TILE}" stroke="${INK}" stroke-width="1.2"/>`);
    for (let i = 1; i < 6; i++) {
      const z = g.Hb + g.R * i / 6, half = (g.W / 2 + oh) * (1 - i / 6);
      out.push(`<line x1="${X(g.W / 2 - half)}" y1="${Y(z)}" x2="${X(g.W / 2 + half)}" y2="${Y(z)}" stroke="${INK}" stroke-opacity=".3"/>`);
    }
  }
  if (p.roof === "gumbaz") {
    const r = g.domeR, dh = r * 0.45, cx = g.W / 2;
    out.push(`<rect x="${X(cx - r)}" y="${Y(g.Hb + dh)}" width="${2 * r * s}" height="${dh * s}" fill="${mat.fill}" stroke="${INK}" stroke-width="1.2"/>`);
    out.push(`<path d="M${X(cx - r)},${Y(g.Hb + dh)} A${r * s},${r * 1.15 * s} 0 0 1 ${X(cx + r)},${Y(g.Hb + dh)} Z" fill="${DOME}" stroke="${INK}" stroke-width="1.2"/>`);
    for (let i = -2; i <= 2; i++) {         // gumbaz qovurg'alari
      const rx = Math.abs(i) * r / 3;
      out.push(`<path d="M${X(cx + i * r / 3)},${Y(g.Hb + dh)} Q${X(cx + i * r / 3 * 0.6)},${Y(g.Hb + dh + r * 0.9)} ${X(cx)},${Y(g.Hb + dh + r * 1.15)}" fill="none" stroke="${INK}" stroke-opacity="${rx ? .25 : 0}"/>`);
    }
    out.push(`<line x1="${X(cx)}" y1="${Y(g.Hb + dh + r * 1.15)}" x2="${X(cx)}" y2="${Y(g.H)}" stroke="${INK}" stroke-width="1.5"/>`);
    // baraban derazachalari
    const n = Math.max(3, Math.round(r));
    for (let i = 0; i < n; i++) {
      const wx = cx - r + (2 * r) * (i + 0.5) / n;
      out.push(`<rect x="${X(wx - 0.25)}" y="${Y(g.Hb + dh * 0.8)}" width="${0.5 * s}" height="${dh * 0.55 * s}" fill="${GLASS}"/>`);
    }
  }
  if (p.roof === "terrasa") {
    const pw = g.W * 0.5, px = (g.W - pw) / 2;
    out.push(`<rect x="${X(px)}" y="${Y(g.Hb + p.floor_h)}" width="${pw * s}" height="${p.floor_h * s}" fill="${mat.fill}" stroke="${INK}" stroke-width="1.2"/>`);
    out.push(`<rect x="${X(px + 0.4)}" y="${Y(g.Hb + p.floor_h - 0.4)}" width="${(pw - 0.8) * s}" height="${(p.floor_h - 0.4) * s}" fill="${GLASS}"/>`);
    out.push(`<rect x="${X(px - 0.6)}" y="${Y(g.H)}" width="${(pw + 1.2) * s}" height="${0.4 * s}" fill="${INK}"/>`);
    // pergola ustunlari va terrasa panjarasi
    for (let m = 0.3; m < px - 0.2; m += 1.4) {
      out.push(`<line x1="${X(m)}" y1="${Y(g.Hb)}" x2="${X(m)}" y2="${Y(g.Hb + 1.0)}" stroke="${INK}" stroke-opacity=".6"/>`);
      out.push(`<line x1="${X(g.W - m)}" y1="${Y(g.Hb)}" x2="${X(g.W - m)}" y2="${Y(g.Hb + 1.0)}" stroke="${INK}" stroke-opacity=".6"/>`);
    }
    out.push(`<line x1="${X(0)}" y1="${Y(g.Hb + 1.0)}" x2="${X(g.W)}" y2="${Y(g.Hb + 1.0)}" stroke="${INK}"/>`);
  }

  // Devor
  out.push(`<rect x="${X(0)}" y="${Y(g.Hb)}" width="${g.W * s}" height="${g.Hb * s}" fill="${mat.fill}"/>`);
  if (mat.pattern && s > 6) out.push(`<rect x="${X(0)}" y="${Y(g.Hb)}" width="${g.W * s}" height="${g.Hb * s}" fill="url(#${uid}-pat)"/>`);
  for (let f = 1; f < p.floors; f++) {
    out.push(`<line x1="${X(0)}" y1="${Y(f * p.floor_h)}" x2="${X(g.W)}" y2="${Y(f * p.floor_h)}" stroke="${INK}" stroke-opacity=".22"/>`);
  }

  // Kataklar: deraza, balkon, eshik...
  for (let f = 0; f < p.floors; f++) for (let b = 0; b < p.bays; b++) {
    out.push(drawCell(cellType(p, cells, f, b), X(b * p.bay_w), Y((f + 1) * p.floor_h), p.bay_w * s, p.floor_h * s));
  }
  out.push(`<rect x="${X(0)}" y="${Y(g.Hb)}" width="${g.W * s}" height="${g.Hb * s}" fill="none" stroke="${INK}" stroke-width="1.6"/>`);

  if (p.roof === "bir") {                               // bir nishabli tom: devor uchburchagi + qiya plita
    const oh = 0.55, k = g.R / g.W, tri = `${X(0)},${Y(g.Hb)} ${X(g.W)},${Y(g.Hb)} ${X(g.W)},${Y(g.H)}`;
    out.push(`<polygon points="${tri}" fill="${mat.fill}" stroke="${INK}" stroke-width="1.2"/>`);
    if (mat.pattern && s > 6) out.push(`<polygon points="${tri}" fill="url(#${uid}-pat)"/>`);
    out.push(`<polygon points="${X(-oh)},${Y(g.Hb - k * oh)} ${X(g.W + oh)},${Y(g.H + k * oh)} ${X(g.W + oh)},${Y(g.H + k * oh + 0.35)} ${X(-oh)},${Y(g.Hb - k * oh + 0.35)}" fill="${ROOF_TILE}" stroke="${INK}" stroke-width="1.2"/>`);
  }
  if (p.roof === "tekis" || p.roof === "gumbaz") {      // parapet
    out.push(`<rect x="${X(-0.2)}" y="${Y(g.Hb + 0.9)}" width="${(g.W + 0.4) * s}" height="${0.9 * s}" fill="${mat.fill}" stroke="${INK}" stroke-width="1.2"/>`);
  }

  if (opts.interactive) {
    out.push(`<g class="hits">`);
    for (let f = 0; f < p.floors; f++) for (let b = 0; b < p.bays; b++) {
      out.push(`<rect class="hit" data-k="${f},${b}" x="${X(b * p.bay_w)}" y="${Y((f + 1) * p.floor_h)}" width="${p.bay_w * s}" height="${p.floor_h * s}"/>`);
    }
    out.push(`</g>`);
  }

  if (opts.dims) {
    const dx = X(g.W) + 26;
    out.push(dimV(dx, Y(0), Y(g.H), `+${f1(g.H)}`));
    out.push(dimV(dx + 30 > VW - 8 ? dx : dx + 30, Y(0), Y(g.Hb), ""));
    out.push(dimH(X(0), X(g.W), gy + 26, `${f1(g.W)} m`));
    // sath belgilari
    out.push(level(X(0) - 8, Y(0), "±0,000"));
    out.push(level(X(0) - 8, Y(g.Hb), `+${f1(g.Hb).replace(/\s/g, "")}`));
  }
  if (opts.geo && typeof Geo !== "undefined") out.push(Geo.facade(p, g, { X, Y, s, gy, VW, VH }, opts.geo));   // o'qlar, o'lchamlar, diagonallar, oltin kesim, burchaklar
  out.push(`</svg>`);
  return out.join("");
}

function drawCell(t, x, y, w, h) {
  const o = OPENING[t];
  if (!o) return "";
  const ox = x + w * o[0], ow = w * (o[1] - o[0]);
  const oy = y + h * (1 - o[3]), oh = h * (o[3] - o[2]);
  const st = `stroke="${INK}" stroke-width="1"`;
  switch (t) {
    case "win":
      return `<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="${GLASS}" ${st}/>` +
        `<line x1="${ox + ow / 2}" y1="${oy}" x2="${ox + ow / 2}" y2="${oy + oh}" ${st}/>` +
        `<line x1="${ox}" y1="${oy + oh * .35}" x2="${ox + ow}" y2="${oy + oh * .35}" ${st} stroke-opacity=".6"/>` +
        `<rect x="${ox - w * .03}" y="${oy + oh}" width="${ow + w * .06}" height="${Math.max(1.5, h * .04)}" fill="${INK}" fill-opacity=".7"/>`;
    case "wide": {
      let s = `<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="${GLASS}" ${st}/>`;
      for (let i = 1; i < 3; i++) s += `<line x1="${ox + ow * i / 3}" y1="${oy}" x2="${ox + ow * i / 3}" y2="${oy + oh}" ${st}/>`;
      return s + `<line x1="${ox + ow * .08}" y1="${oy + oh * .15}" x2="${ox + ow * .25}" y2="${oy + oh * .15}" stroke="${GLASS_HI}" stroke-width="2"/>`;
    }
    case "arch": {
      const r = ow / 2;
      return `<path d="M${ox},${oy + oh} V${oy + r} A${r},${r} 0 0 1 ${ox + ow},${oy + r} V${oy + oh} Z" fill="${GLASS}" ${st}/>` +
        `<line x1="${ox + r}" y1="${oy}" x2="${ox + r}" y2="${oy + oh}" ${st}/>`;
    }
    case "balc": {
      const by = y + h * .9, rail = h * .32;
      let s = `<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="${GLASS}" ${st}/>`;
      s += `<rect x="${x + w * .1}" y="${by}" width="${w * .8}" height="${h * .07}" fill="${INK}" fill-opacity=".8"/>`;
      s += `<rect x="${x + w * .1}" y="${by - rail}" width="${w * .8}" height="${rail}" fill="${GLASS_HI}" fill-opacity=".25" ${st}/>`;
      for (let i = 1; i < 8; i++) s += `<line x1="${x + w * .1 + w * .8 * i / 8}" y1="${by - rail}" x2="${x + w * .1 + w * .8 * i / 8}" y2="${by}" ${st} stroke-opacity=".7"/>`;
      return s;
    }
    case "door":
      return `<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="${INK}" fill-opacity=".85"/>` +
        `<rect x="${ox + ow * .12}" y="${oy + oh * .1}" width="${ow * .76}" height="${oh * .35}" fill="${GLASS}"/>` +
        `<rect x="${ox - w * .06}" y="${oy - h * .06}" width="${ow + w * .12}" height="${h * .05}" fill="${INK}"/>`;
    case "shop":
      return `<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="${GLASS}" ${st}/>` +
        `<line x1="${ox + ow / 2}" y1="${oy}" x2="${ox + ow / 2}" y2="${oy + oh}" ${st}/>` +
        `<path d="M${ox - w * .02},${oy} h${ow + w * .04} l${-w * .05},${h * .12} h${-(ow - w * .06)} Z" fill="${INK}" fill-opacity=".75"/>`;
    case "arcade": {
      const r = ow / 2;
      return `<path d="M${ox},${oy + oh} V${oy + r} A${r},${r} 0 0 1 ${ox + ow},${oy + r} V${oy + oh} Z" fill="${INK}" fill-opacity=".6" ${st}/>`;
    }
    case "slit":
      return `<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="${GLASS}" ${st}/>` +
        `<line x1="${ox}" y1="${oy + oh * .5}" x2="${ox + ow}" y2="${oy + oh * .5}" ${st} stroke-opacity=".7"/>`;
    case "round": {
      const r = Math.min(ow, oh) / 2, cx = ox + ow / 2, cy = oy + oh / 2;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GLASS}" ${st}/>` +
        `<line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" ${st} stroke-opacity=".7"/><line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" ${st} stroke-opacity=".7"/>`;
    }
    case "lattice": {
      const cx = ox + ow / 2, cy = oy + oh / 2;
      let s = `<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="${GLASS}" ${st}/>`;
      for (let i = 1; i < 4; i++) s += `<line x1="${ox + ow * i / 4}" y1="${oy}" x2="${ox + ow * i / 4}" y2="${oy + oh}" ${st} stroke-opacity=".55"/><line x1="${ox}" y1="${oy + oh * i / 4}" x2="${ox + ow}" y2="${oy + oh * i / 4}" ${st} stroke-opacity=".55"/>`;
      return s + `<polygon points="${cx},${oy} ${ox + ow},${cy} ${cx},${oy + oh} ${ox},${cy}" fill="none" ${st}/>`;
    }
  }
  return "";
}

function patternDef(uid, kind, s) {
  if (!kind || s <= 6) return "";
  const id = `${uid}-pat`;
  if (kind === "brick") {
    const w = 0.9 * s, h = 0.3 * s;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h * 2}">` +
      `<path d="M0,${h} H${w} M0,${h * 2} H${w} M${w / 2},0 V${h} M0,${h} V${h * 2}" stroke="${INK}" stroke-opacity=".18" fill="none"/></pattern>`;
  }
  if (kind === "panel") {
    const w = 1.5 * s;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${w}">` +
      `<rect x="0" y="0" width="${w}" height="${w}" fill="none" stroke="${INK}" stroke-opacity=".12"/>` +
      `<circle cx="${w * .15}" cy="${w * .15}" r="1" fill="${INK}" fill-opacity=".3"/></pattern>`;
  }
  if (kind === "stone") {
    const w = 1.2 * s, h = 0.6 * s;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}">` +
      `<path d="M0,${h} H${w} M${w * .6},0 V${h}" stroke="${INK}" stroke-opacity=".14" fill="none"/></pattern>`;
  }
  if (kind === "wood") {           // vertikal taxtalar
    const w = 0.2 * s, h = 2 * s;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}">` +
      `<path d="M0,0 V${h} M${w * .55},${h * .2} v${h * .15} M${w * .3},${h * .65} v${h * .12}" stroke="${INK}" stroke-opacity=".2" fill="none"/></pattern>`;
  }
  if (kind === "seam") {           // metall panel choklari
    const w = 0.5 * s;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${w}">` +
      `<path d="M0,0 V${w}" stroke="${INK}" stroke-opacity=".28" stroke-width="1.5"/><path d="M2,0 V${w}" stroke="#ffffff" stroke-opacity=".2"/></pattern>`;
  }
  if (kind === "rubble") {         // notekis tabiiy tosh
    const w = 1.4 * s, h = 1.0 * s, P = (a, b) => `${a * w},${b * h}`;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}">` +
      `<path d="M${P(0, .35)} L${P(.5, .3)} L${P(.9, .45)} L${P(1, .4)} M${P(0, .78)} L${P(.6, .82)} L${P(1, .75)} M${P(.3, 0)} L${P(.27, .33)} M${P(.75, 0)} L${P(.8, .38)} M${P(.62, .45)} L${P(.58, .8)} M${P(.2, .78)} L${P(.24, 1)} M${P(.88, .76)} L${P(.9, 1)}" stroke="${INK}" stroke-opacity=".22" fill="none"/></pattern>`;
  }
  if (kind === "tile") {           // girih uslubidagi romb
    const w = 0.8 * s;
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${w}">` +
      `<path d="M${w / 2},0 L${w},${w / 2} L${w / 2},${w} L0,${w / 2} Z" fill="none" stroke="#ffffff" stroke-opacity=".28"/></pattern>`;
  }
  return "";
}

function dimV(x, y1, y2, label) {
  return `<g class="d-dim"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>` +
    `<line x1="${x - 4}" y1="${y1 + 4}" x2="${x + 4}" y2="${y1 - 4}"/><line x1="${x - 4}" y1="${y2 + 4}" x2="${x + 4}" y2="${y2 - 4}"/></g>` +
    (label ? `<text class="d-text" x="${x + 6}" y="${(y1 + y2) / 2}" transform="rotate(-90 ${x + 6} ${(y1 + y2) / 2})" text-anchor="middle" dy="10">${label}</text>` : "");
}
function dimH(x1, x2, y, label) {
  return `<g class="d-dim"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>` +
    `<line x1="${x1 - 4}" y1="${y + 4}" x2="${x1 + 4}" y2="${y - 4}"/><line x1="${x2 - 4}" y1="${y + 4}" x2="${x2 + 4}" y2="${y - 4}"/></g>` +
    `<text class="d-text" x="${(x1 + x2) / 2}" y="${y - 6}" text-anchor="middle">${label}</text>`;
}
function level(x, y, label) {
  return `<g class="d-dim"><path d="M${x},${y} l-6,-7 h12 Z"/></g><text class="d-text" x="${x - 10}" y="${y - 10}" text-anchor="end">${label}</text>`;
}

// ---------------- IZOMETRIYA (3D ko'rinish) ----------------
function renderIso(p, cells) {
  const VW = 640, VH = 520, M = 36;
  const g = geometry(p), c = Math.cos(Math.PI / 6);
  const spanX = (g.W + g.D) * c, spanY = (g.W + g.D) * 0.5 + g.H;
  const s = Math.min((VW - 2 * M) / spanX, (VH - 2 * M) / spanY);
  const ox = M + g.D * c * s + ((VW - 2 * M) - spanX * s) / 2;
  const oy = M + g.H * s + ((VH - 2 * M) - spanY * s) / 2;
  const P = (x, y, z) => `${(ox + (x - y) * c * s).toFixed(1)},${(oy + (x + y) * 0.5 * s - z * s).toFixed(1)}`;
  const poly = (pts, fill, extra = "") => `<polygon points="${pts.join(" ")}" fill="${fill}" ${extra}/>`;
  const mat = MATERIALS[p.material], edge = `stroke="${INK}" stroke-width="1" stroke-linejoin="round"`;
  const { W, D, Hb } = g;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" class="bld">`];
  if (shapeOf(p) !== "rect") {                                       // shakldor plan: devorlar prizma, orqadan oldga chiziladi
    const ps = planShape(p), E = planEdges(ps).filter(e => e.nx > 0.01 || e.nz > 0.01);
    out.push(poly(ps.outer.map(([x, z]) => P(x + 1.5, z + 1.5, 0)), INK, `fill-opacity=".08"`));
    E.sort((a, b) => (a.x1 + a.x2 + a.z1 + a.z2) - (b.x1 + b.x2 + b.z1 + b.z2)).forEach(e => {
      const shade = e.nz > 0.5 ? "" : `<polygon points="${[P(e.x1, e.z1, 0), P(e.x2, e.z2, 0), P(e.x2, e.z2, Hb), P(e.x1, e.z1, Hb)].join(" ")}" fill="${INK}" fill-opacity=".18"/>`;
      out.push(poly([P(e.x1, e.z1, 0), P(e.x2, e.z2, 0), P(e.x2, e.z2, Hb), P(e.x1, e.z1, Hb)], mat.fill, edge) + shade);
      const n = e.L < 1.2 || p.window === "yoq" ? 0 : Math.max(1, Math.round(e.L / p.bay_w));
      for (let f = 0; f < p.floors; f++) for (let i = 0; i < n; i++) {
        const t0 = (i + .3) / n, t1 = (i + .7) / n, za = (f + .25) * p.floor_h, zb = (f + .75) * p.floor_h;
        const A = [e.x1 + (e.x2 - e.x1) * t0, e.z1 + (e.z2 - e.z1) * t0], B = [e.x1 + (e.x2 - e.x1) * t1, e.z1 + (e.z2 - e.z1) * t1];
        out.push(poly([P(A[0], A[1], za), P(B[0], B[1], za), P(B[0], B[1], zb), P(A[0], A[1], zb)], GLASS, `fill-opacity=".85"`));
      }
    });
    ps.rings.forEach((r, i) => out.push(poly(r.map(([x, z]) => P(x, z, Hb)), i ? INK : mat.fill, i ? `fill-opacity=".35"` : edge)));
    out.push(`</svg>`);
    return out.join("");
  }

  // yerdagi soya
  out.push(poly([P(0, 0, 0), P(W + 3, 0, 0), P(W + 3, D + 3, 0), P(0, D + 3, 0)], INK, `fill-opacity=".08"`));

  function box(x0, y0, z0, w, d, h, frontFill) {
    const r = [];
    r.push(poly([P(x0 + w, y0 + d, z0), P(x0 + w, y0, z0), P(x0 + w, y0, z0 + h), P(x0 + w, y0 + d, z0 + h)], mat.fill, edge));
    r.push(poly([P(x0 + w, y0 + d, z0), P(x0 + w, y0, z0), P(x0 + w, y0, z0 + h), P(x0 + w, y0 + d, z0 + h)], INK, `fill-opacity=".22"`));
    r.push(poly([P(x0, y0 + d, z0), P(x0 + w, y0 + d, z0), P(x0 + w, y0 + d, z0 + h), P(x0, y0 + d, z0 + h)], frontFill || mat.fill, edge));
    r.push(poly([P(x0, y0, z0 + h), P(x0 + w, y0, z0 + h), P(x0 + w, y0 + d, z0 + h), P(x0, y0 + d, z0 + h)], mat.fill, edge));
    r.push(poly([P(x0, y0, z0 + h), P(x0 + w, y0, z0 + h), P(x0 + w, y0 + d, z0 + h), P(x0, y0 + d, z0 + h)], "#ffffff", `fill-opacity=".22"`));
    return r.join("");
  }

  out.push(box(0, 0, 0, W, D, Hb));

  // qavat chiziqlari
  for (let f = 1; f < p.floors; f++) {
    const z = f * p.floor_h;
    out.push(`<polyline points="${P(0, D, z)} ${P(W, D, z)} ${P(W, 0, z)}" fill="none" stroke="${INK}" stroke-opacity=".25"/>`);
  }
  // old fasad kataklari (konstruktordagi bilan bir xil)
  for (let f = 0; f < p.floors; f++) for (let b = 0; b < p.bays; b++) {
    const t = cellType(p, cells, f, b), o = OPENING[t];
    if (!o) continue;
    const xa = (b + o[0]) * p.bay_w, xb = (b + o[1]) * p.bay_w;
    const za = (f + o[2]) * p.floor_h, zb = (f + o[3]) * p.floor_h;
    const fill = t === "door" || t === "arcade" ? INK : GLASS;
    out.push(poly([P(xa, D, za), P(xb, D, za), P(xb, D, zb), P(xa, D, zb)], fill, t === "arcade" ? `fill-opacity=".6"` : ""));
    if (t === "balc") {
      const z = f * p.floor_h + 0.1;
      out.push(poly([P(b * p.bay_w + .4, D, z), P((b + 1) * p.bay_w - .4, D, z), P((b + 1) * p.bay_w - .4, D + 1.2, z), P(b * p.bay_w + .4, D + 1.2, z)], INK, `fill-opacity=".75"`));
      out.push(poly([P(b * p.bay_w + .4, D + 1.2, z), P((b + 1) * p.bay_w - .4, D + 1.2, z), P((b + 1) * p.bay_w - .4, D + 1.2, z + 1.05), P(b * p.bay_w + .4, D + 1.2, z + 1.05)], GLASS_HI, `fill-opacity=".45" ${edge}`));
    }
  }
  // yon fasad derazalari
  const n = Math.max(1, Math.round(D / p.bay_w)), sw = D / n;
  const sideFloors = p.window === "yoq" ? 0 : p.floors;   // "derazasiz" bino yon tomondan ham yaxlit
  for (let f = 0; f < sideFloors; f++) for (let i = 0; i < n; i++) {
    const ya = i * sw + sw * .28, yb = i * sw + sw * .72, za = (f + .25) * p.floor_h, zb = (f + .75) * p.floor_h;
    out.push(poly([P(W, yb, za), P(W, ya, za), P(W, ya, zb), P(W, yb, zb)], GLASS, `fill-opacity=".85"`));
  }

  // tom
  if (p.roof === "nishab") {
    const top = Hb + g.R;
    out.push(poly([P(0, 0, Hb), P(0, D, Hb), P(W / 2, D, top), P(W / 2, 0, top)], ROOF_TILE, edge));
    out.push(poly([P(W / 2, 0, top), P(W / 2, D, top), P(W, D, Hb), P(W, 0, Hb)], ROOF_TILE, edge));
    out.push(poly([P(W / 2, 0, top), P(W / 2, D, top), P(W, D, Hb), P(W, 0, Hb)], INK, `fill-opacity=".2"`));
    out.push(poly([P(0, D, Hb), P(W, D, Hb), P(W / 2, D, top)], mat.fill, edge));
  }
  if (p.roof === "gumbaz") {
    const [cx, cy] = P(W / 2, D / 2, Hb).split(",").map(Number);
    const r = g.domeR * s * 1.05, dh = g.domeR * 0.45 * s, ry = r * 0.5;
    out.push(`<path d="M${cx - r},${cy} A${r},${ry} 0 0 0 ${cx + r},${cy} V${cy - dh} A${r},${ry} 0 0 1 ${cx - r},${cy - dh} Z" fill="${mat.fill}" ${edge}/>`);
    out.push(`<path d="M${cx - r},${cy - dh} A${r},${g.domeR * 1.15 * s} 0 0 1 ${cx + r},${cy - dh} A${r},${ry} 0 0 1 ${cx - r},${cy - dh} Z" fill="${DOME}" ${edge}/>`);
    out.push(`<path d="M${cx + r * .1},${cy - dh - g.domeR * 1.1 * s} A${r * .8},${g.domeR * s} 0 0 1 ${cx + r * .85},${cy - dh - r * .1}" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="3"/>`);
    out.push(`<line x1="${cx}" y1="${cy - dh - g.domeR * 1.15 * s}" x2="${cx}" y2="${cy - dh - g.domeR * 1.15 * s - 1.2 * s}" stroke="${INK}" stroke-width="2"/>`);
  }
  if (p.roof === "terrasa") {
    out.push(box(W * .25, D * .2, Hb, W * .5, D * .6, p.floor_h, GLASS));
  }
  out.push(`</svg>`);
  return out.join("");
}

// ---------- Majmua joylashuvi: har bir uyning markazi (x, z), burilishi va plandagi o'lchami ----------
// Koordinatalar metrda: x — sharqqa, z — ko'chaga (janubga). rot — 0/90/180/270°, 0 da old fasad ko'chaga qaraydi.
function cleanPos(p) {
  if (!p || typeof p !== "object") return undefined;
  const x = Number(p.x), z = Number(p.z), r = Number(p.rot) || 0;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return undefined;
  const c = v => Math.round(Math.min(300, Math.max(-300, v)) * 100) / 100;
  return { x: c(x), z: c(z), rot: ((Math.round(r / 90) * 90) % 360 + 360) % 360 };
}
// Eski usul: uylar ko'cha bo'ylab bir qatorda, old tomonlari bir chiziqda
function rowLayout(gs, gap) {
  const n = gs.length, g2 = n > 1 ? gap : 0;
  const totalW = gs.reduce((s, g) => s + g.W, 0) + g2 * (n - 1), Dmax = Math.max(...gs.map(g => g.D));
  let x = -totalW / 2;
  return gs.map(g => { const p = { x: x + g.W / 2, z: Dmax / 2 - g.D / 2, rot: 0 }; x += g.W + g2; return p; });
}
// [{ cx, cz, rot, W, D, H, Hb, w, d }] — w, d: plandagi eni va chuqurligi (90° burilganda W va D almashadi)
function siteLayout(list, gap = 10) {
  const gs = list.map(b => geometry(b.params));
  const all = list.every(b => cleanPos(b.pos)), row = all ? null : rowLayout(gs, gap);
  return list.map((b, i) => {
    const g = gs[i], p = all ? cleanPos(b.pos) : row[i], side = p.rot % 180 !== 0;
    return { cx: p.x, cz: p.z, rot: p.rot, W: g.W, D: g.D, H: g.H, Hb: g.Hb, w: side ? g.D : g.W, d: side ? g.W : g.D };
  });
}
// Ikki uy plani orasidagi eng qisqa masofa; manfiy bo'lsa — uylar ustma-ust tushgan
function footGap(a, b) {
  const dx = Math.abs(a.cx - b.cx) - (a.w + b.w) / 2, dz = Math.abs(a.cz - b.cz) - (a.d + b.d) / 2;
  return dx > 0 && dz > 0 ? Math.hypot(dx, dz) : Math.max(dx, dz);
}
// Masofa chizig'i uchun ikki uyning bir-biriga eng yaqin nuqtalari: [x1, z1, x2, z2]
function footNearest(a, b) {
  const axis = (a0, a1, b0, b1) => a1 < b0 ? [a1, b0] : b1 < a0 ? [a0, b1] : (m => [m, m])((Math.max(a0, b0) + Math.min(a1, b1)) / 2);
  const [x1, x2] = axis(a.cx - a.w / 2, a.cx + a.w / 2, b.cx - b.w / 2, b.cx + b.w / 2);
  const [z1, z2] = axis(a.cz - a.d / 2, a.cz + a.d / 2, b.cz - b.d / 2, b.cz + b.d / 2);
  return [x1, z1, x2, z2];
}

// ---------- Hovli: to'siq, darvoza, yo'lak va obodonlashtirish elementlari ----------
const YARD_ITEMS = {
  tree: { label: "Daraxt", w: 3.8, d: 3.8 },
  bed: { label: "Gulzor", w: 3, d: 1.6 },
  pool: { label: "Hovuz", w: 6.6, d: 4.1 },
  suri: { label: "So'ri", w: 3.4, d: 3.4 },
  car: { label: "Mashina joyi", w: 2.7, d: 5.3 },
};
const FENCES = { devor: "G'isht devor", panjara: "Temir panjara", yogoch: "Yog'och to'siq", yoq: "To'siqsiz" };
const YARD_GATE = 4, YARD_MAX_ITEMS = 40;
// Ishonchsiz ma'lumotni (fayl, baza) ruxsat etilgan ko'rinishga keltiradi
function cleanYard(y) {
  if (!y || typeof y !== "object") return { on: false, margin: 6, fence: "devor", items: [] };
  const m = Number(y.margin), c = v => Math.round(Math.min(400, Math.max(-400, v)) * 100) / 100;
  const items = (Array.isArray(y.items) ? y.items : []).slice(0, YARD_MAX_ITEMS)
    .filter(it => it && YARD_ITEMS[it.t] && Number.isFinite(Number(it.x)) && Number.isFinite(Number(it.z)))
    .map(it => ({ t: it.t, x: c(Number(it.x)), z: c(Number(it.z)), rot: Number(it.rot) === 90 ? 90 : 0 }));
  return { on: !!y.on, margin: Number.isFinite(m) ? Math.min(20, Math.max(2, Math.round(m))) : 6, fence: FENCES[y.fence] ? y.fence : "devor", items };
}
// Element plani (90° da eni va bo'yi almashadi) — footGap bilan bir xil shakl
function itemFoot(it) { const s = YARD_ITEMS[it.t], side = it.rot === 90; return { cx: it.x, cz: it.z, w: side ? s.d : s.w, d: side ? s.w : s.d }; }
// Hovli chegarasi: binolarni o'rab turgan to'rtburchak + chekinish. Darvoza ko'cha tomonida, eng oldingi uy ro'parasida
function yardRect(L, y) {
  const m = y.margin;
  const x0 = Math.min(...L.map(l => l.cx - l.w / 2)) - m, x1 = Math.max(...L.map(l => l.cx + l.w / 2)) + m;
  const z0 = Math.min(...L.map(l => l.cz - l.d / 2)) - m, z1 = Math.max(...L.map(l => l.cz + l.d / 2)) + m;
  const fr = L.reduce((a, l) => (l.cz + l.d / 2 > a.cz + a.d / 2 ? l : a), L[0]);
  const gx = Math.min(x1 - YARD_GATE / 2 - 0.5, Math.max(x0 + YARD_GATE / 2 + 0.5, fr.cx));
  return { x0, x1, z0, z1, gx, gw: YARD_GATE };
}
// Darvozadan ro'paradagi uy eshigigacha tosh yo'lak
function yardPath(L, R) {
  const hit = L.filter(l => Math.abs(R.gx - l.cx) < l.w / 2);
  const zb = hit.length ? Math.max(...hit.map(l => l.cz + l.d / 2)) : (R.z0 + R.z1) / 2;
  return zb < R.z1 ? { x: R.gx, z0: zb, z1: R.z1, w: 1.6 } : null;
}
