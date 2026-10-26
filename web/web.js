// Pillar Architecture — brauzer versiyasi.
// Python serverdagi API o'rnida: portfolio va smeta sahifa ichida, dizaynlar esa artifact bazasida
// (bo'lmasa — shu brauzerning localStorage'ida).

const $ = id => document.getElementById(id);
const nfmt = n => Math.round(n).toLocaleString("ru-RU");

// ================= SAYT MAZMUNI =================
const CAT_LABEL = { "turar-joy": "Turar-joy", jamoat: "Jamoat", tijorat: "Tijorat", interyer: "Interyer" };
const PROJECTS = [
  { id: 1, title: "Chilonzor Terrasalari", category: "turar-joy", city: "Toshkent", year: 2024, area_m2: 18400, floors: 12, status: "qurildi",
    description: "Pog'onali terrasalar bilan 12 qavatli turar-joy majmuasi. Har bir xonadonda janubga qaragan ochiq ayvon bor, hovli esa piyodalar uchun yopiq." },
  { id: 2, title: "Registon Mehmon Markazi", category: "jamoat", city: "Samarqand", year: 2025, area_m2: 3200, floors: 2, status: "qurilmoqda",
    description: "Tarixiy ansamblga qarab turgan past, og'ir hajmli tashrif markazi. Fasad mahalliy pishiq g'isht va soya beruvchi panjaralar bilan yopilgan." },
  { id: 3, title: "Ipak Ofis Bloki", category: "tijorat", city: "Toshkent", year: 2023, area_m2: 9600, floors: 8, status: "qurildi",
    description: "Ochiq rejali ofis binosi. Har qavatda atrium orqali tabiiy yorug'lik va havo almashinuvi ta'minlangan." },
  { id: 4, title: "Buxoro Kitob Uyi", category: "jamoat", city: "Buxoro", year: 2026, area_m2: 1450, floors: 3, status: "loyihada",
    description: "Gumbazli o'quv zali va hovli atrofida joylashgan mahalla kutubxonasi. Qalin devorlar issiq yozda tabiiy sovutish beradi." },
  { id: 5, title: "Yunusobod Villasi", category: "turar-joy", city: "Toshkent", year: 2022, area_m2: 420, floors: 2, status: "qurildi",
    description: "Ichki hovlili ikki qavatli uy. Ayvon va hovuz an'anaviy o'zbek uyi rejasidan olingan." },
  { id: 6, title: "Kafe 'Ganch'", category: "interyer", city: "Farg'ona", year: 2024, area_m2: 260, floors: 1, status: "qurildi",
    description: "Qo'lda o'yilgan ganch panellar va zamonaviy beton yuzalarni birlashtirgan kafe interyeri." },
  { id: 7, title: "Nukus Savdo Galereyasi", category: "tijorat", city: "Nukus", year: 2026, area_m2: 7200, floors: 4, status: "loyihada",
    description: "Cho'l iqlimi uchun ikki qavatli soyabon ostidagi savdo ko'chasi. Tom quyosh panellari bilan qoplanadi." },
].sort((a, b) => b.year - a.year || b.id - a.id);

// Smeta — server.py dagi estimate() bilan bir xil formula
const BASE_PRICE = { "turar-joy": 420, jamoat: 610, tijorat: 540, interyer: 180 };
const QUALITY_K = { standart: 1.0, biznes: 1.35, premium: 1.8 };
function estimate(category, quality, area, floors) {
  const perM2 = BASE_PRICE[category] * QUALITY_K[quality] * (1 + 0.015 * (floors - 1));
  const build = perM2 * area;
  return {
    per_m2: Math.round(perM2),
    construction_cost: Math.round(build / 100) * 100,
    design_fee: Math.round(build * 0.06 / 100) * 100,
    design_weeks: Math.min(40, 6 + Math.floor(area / 1000)),
  };
}

// ================= BO'LIMLAR =================
const VIEWS = ["bosh", "konstruktor", "erkin", "qogoz", "galereya", "mahsulotlar", "sozlamalar"];
let firstDesignerVisit = true;
function showView(v, scroll = true) {
  if (!VIEWS.includes(v)) v = "bosh";
  VIEWS.forEach(n => { $(n).hidden = n !== v; });
  document.querySelectorAll(".nav ul a").forEach(a => a.toggleAttribute("aria-current", a.dataset.view === v));
  document.querySelectorAll(".nav ul a[aria-current]").forEach(a => a.setAttribute("aria-current", "page"));
  if (scroll) window.scrollTo(0, 0);
  try { localStorage.setItem("ustun-view", v); } catch {}
  if (v === "sozlamalar" && typeof UstunSettings !== "undefined") UstunSettings.render();   // saqlangan loyihalar ro'yxati yangilansin
  if (v === "konstruktor") {
    render();
    window.playBuild && window.playBuild();
    // Birinchi marta, qoralamasiz kirilganda boshlang'ich nuqtani tanlashni taklif qilamiz
    if (firstDesignerVisit && !hadDraft) openNewDialog();
    firstDesignerVisit = false;
  }
}
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-view]");
  if (!a) return;
  e.preventDefault();
  showView(a.dataset.view);
});

// ================= BOSH SAHIFA =================
(function initHome() {
  const vals = [
    PROJECTS.length,
    PROJECTS.filter(p => p.status === "qurildi").length,
    nfmt(PROJECTS.reduce((s, p) => s + p.area_m2, 0)),
    new Set(PROJECTS.map(p => p.city)).size,
  ];
  document.querySelectorAll("#stats b").forEach((b, i) => { b.textContent = vals[i]; });
  renderProjects("");
})();

function renderProjects(cat) {
  const list = PROJECTS.filter(p => !cat || p.category === cat);
  $("grid").innerHTML = list.length ? list.map(p => `
    <button class="card" type="button" data-id="${p.id}">
      <div class="facade">${facadeSVG(p)}</div>
      <div class="body">
        <div class="meta"><span>${esc(CAT_LABEL[p.category])} · ${esc(p.city)}</span><span>${p.year}</span></div>
        <h3>${esc(p.title)}</h3>
        <span><span class="pill ${p.status}">${p.status}</span></span>
      </div>
    </button>`).join("") : `<p class="empty">Bu kategoriyada hozircha loyiha yo'q.</p>`;
}
$("filters").addEventListener("click", e => {
  const btn = e.target.closest("button"); if (!btn) return;
  document.querySelectorAll("#filters button").forEach(b => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
  renderProjects(btn.dataset.cat);
});

const dlg = $("dlg");
$("grid").addEventListener("click", e => {
  const card = e.target.closest(".card"); if (!card) return;
  const p = PROJECTS.find(x => x.id === +card.dataset.id);
  $("dFacade").innerHTML = facadeSVG(p);
  $("dStatus").className = `pill ${p.status}`; $("dStatus").textContent = p.status;
  $("dTitle").textContent = p.title;
  $("dDesc").textContent = p.description;
  $("dSpec").innerHTML = [["Turi", CAT_LABEL[p.category]], ["Shahar", p.city], ["Yil", p.year], ["Maydon", `${nfmt(p.area_m2)} m²`], ["Qavatlar", p.floors]]
    .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
  dlg.showModal();
});
$("dClose").addEventListener("click", () => dlg.close());
dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

function runEstimate() {
  const cat = $("estCat").value, q = $("estQ").value;
  const area = Number($("estArea").value), floors = Number($("estFloors").value);
  const msg = $("estMsg");
  if (!(area >= 20 && area <= 200000) || !(Number.isInteger(floors) && floors >= 1 && floors <= 60)) {
    msg.textContent = "Maydon 20–200 000 m², qavatlar 1–60 oralig'ida bo'lsin."; msg.className = "msg bad";
    return;
  }
  msg.textContent = ""; msg.className = "msg";
  const r = estimate(cat, q, area, floors);
  $("rBuild").textContent = `$${nfmt(r.construction_cost)}`;
  $("rM2").textContent = `$${nfmt(r.per_m2)}`;
  $("rFee").textContent = `$${nfmt(r.design_fee)}`;
  $("rWeeks").textContent = `${r.design_weeks} hafta`;
}
$("estForm").addEventListener("input", runEstimate);
$("estForm").addEventListener("submit", e => { e.preventDefault(); runEstimate(); });
runEstimate();

// ================= DIZAYNLARNI TOZALASH =================
// Bazadagi va brauzerdagi ma'lumot — boshqalar yozgan, ishonchsiz. Chizishdan oldin oraliqlarga keltiriladi.
// Tekshiruv io.js dagi ProjectIO bilan bir xil (yagona manba): plan shakli, qanot eni, barcha tom/deraza/material turlari.
// Avval bu yerda eskirgan nusxa bor edi — u shakl, bir nishabli/piramida tom va yangi deraza turlarini olib tashlardi.
const cleanParams = raw => ProjectIO.cleanParams(raw);
const cleanCells = (raw, p) => ProjectIO.cleanCells(raw, p);
function cleanDesign(d) {
  if (!d || typeof d !== "object") return null;
  // Eski dizaynda bitta uy (params, cells), yangisida 1–3 ta uy (buildings) bo'ladi
  const raw = Array.isArray(d.buildings) && d.buildings.length ? d.buildings.slice(0, 3) : [{ params: d.params, cells: d.cells }];
  const buildings = raw.map(b => { const p = cleanParams(b && b.params), pos = cleanPos(b && b.pos), int = Interior.clean(b && b.interior); return { params: p, cells: cleanCells(b && b.cells, p), ...(pos ? { pos } : {}), ...(int ? { interior: int } : {}) }; });
  const gap = Number(d.gap);
  return {
    id: String(d.id || "").replace(/[^\w-]/g, "").slice(0, 40) || newId(),
    name: String(d.name || "Nomsiz").slice(0, 80),
    author: String(d.author || "Mehmon").slice(0, 60),
    createdAt: String(d.createdAt || "").slice(0, 30),
    params: buildings[0].params, cells: buildings[0].cells,
    buildings, gap: Number.isFinite(gap) ? Math.min(30, Math.max(4, Math.round(gap))) : 10,
    yard: cleanYard(d.yard),
  };
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ================= SAQLASH JOYI: baza yoki brauzer =================
const MY_KEY = "ustun-my-designs";
const store = { db: null, uid: null, canShare: false, isAdmin: false, shared: [], sharedState: "loading" };

function loadMine() {
  try {
    const arr = JSON.parse(localStorage.getItem(MY_KEY) || "[]");
    return Array.isArray(arr) ? arr.map(cleanDesign).filter(Boolean) : [];
  } catch { return []; }
}
function saveMine(list) {
  try { localStorage.setItem(MY_KEY, JSON.stringify(list.slice(0, 30))); return true; } catch { return false; }
}

async function initStore() {
  const c = window.claude;
  if (!c || typeof c.use !== "function") { store.sharedState = "off"; renderGalleries(); return; }
  const [db, user] = await Promise.all([c.use("db"), c.use("user")]);
  if (user) {
    store.uid = await user.id();
    store.isAdmin = await user.canEdit();
    const w = await user.can("data.write");
    store.canShare = !!(db && store.uid) && w !== false;
  }
  store.db = db;
  updateTarget();
  if (!db) { store.sharedState = "off"; renderGalleries(); return; }

  // Har bir muallifning dizaynlari bitta hujjatda: designs/<uid> = { items: [...] }
  db.collection("designs").onSnapshot(snap => {
    const all = [];
    snap.docs.forEach(doc => {
      const items = doc.data() && Array.isArray(doc.data().items) ? doc.data().items : [];
      items.forEach(it => { const d = cleanDesign(it); if (d) all.push({ ...d, owner: doc.id }); });
    });
    all.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    store.shared = all;
    store.sharedState = "ready";
    renderGalleries();
  }, () => { store.sharedState = "off"; renderGalleries(); });
}

function updateTarget() {
  $("targetDot").classList.toggle("shared", store.canShare);
  $("targetText").innerHTML = store.canShare
    ? "Saqlanadi: <b>umumiy galereyaga</b> — havolani ochgan hamma ko'radi"
    : "Saqlanadi: <b>shu brauzerga</b> — faqat siz ko'rasiz";
}

async function saveShared(design) {
  const ref = store.db.doc("designs/" + store.uid);
  const snap = await ref.get();
  const items = snap.exists && Array.isArray(snap.data().items) ? snap.data().items.slice() : [];
  items.unshift(design);
  const keep = items.slice(0, 40);
  while (keep.length > 1 && JSON.stringify({ items: keep }).length > 200000) keep.pop();   // bitta hujjat 256 KB dan oshmasligi uchun
  await ref.set({ items: keep });
}
async function deleteShared(owner, id) {
  const ref = store.db.doc("designs/" + owner);
  const snap = await ref.get();
  if (!snap.exists) return;
  const items = (snap.data().items || []).filter(it => it && it.id !== id);
  await ref.set({ items });
}

// ================= KONSTRUKTOR =================
const DRAFT_KEY = "ustun-draft";
let params = { ...DEFAULT_PARAMS };
let cells = {};
let tool = "balc";
const undoStack = [], redoStack = [];
let savedSnap = "";
let hadDraft = false;
const snap = () => Site.snapshot();
const isDirty = () => snap() !== savedSnap;
const RANGES = ["floors", "bays", "floor_h", "bay_w", "depth"];

// ---------- Majmua: bir nechta uy ----------
Site.getCurrent = () => ({ params, cells });            // Site faol uyni shu o'zgaruvchilardan oladi
Site.reset(params, cells);
Site.onSelect = b => { params = b.params; cells = b.cells; undoStack.length = 0; redoStack.length = 0; syncControls(); render(); };
Site.onChange = () => render();
Geo.onChange = () => render();                           // geometrik chiziqlar katakchalari
if (typeof Shop !== "undefined") Shop.onReady(() => queueMicrotask(render));   // katalog yuklangach smeta chiqadi; katalog skript tugashidan oldin kelsa ham render keyinroq ishlaydi
ProjectIO.getPayload = () => Site.payload();
ProjectIO.onLoad = d => loadIntoDesigner(d.buildings, d.gap, d.name, `"${d.name || "Loyiha"}" fayldan ochildi.`, d.yard);
if (window.View3D) View3D.onPick = i => Site.select(i);   // 3D'da uyni bosib tanlash
// AI yordamchi uchun: konstruktor holatini o'qish va o'zgartirish (ai-design.js)
window.DesignHost = {
  params: () => params, cells: () => cells,
  refresh() { undoStack.length = 0; redoStack.length = 0; syncControls(); if ($("konstruktor").hidden) showView("konstruktor"); else render(); },
  load(list, gap, name, note, yard) { loadIntoDesigner(list, gap, name == null ? $("dName").value : name, note, yard); },
};
if (window.View3D) { View3D.onMove = (i, x, z) => Site.move(i, x, z); View3D.onRotate = i => Site.rotate(i); }   // 3D'da ko'chirish va burish
if (window.View3D) { View3D.onMoveItem = (k, x, z) => Site.moveItem(k, x, z); View3D.onPickItem = k => { if (Site.ysel !== k) { Site.ysel = k; render(); } }; }   // hovli elementlari

$("materials").innerHTML = Object.entries(MATERIALS).map(([k, m]) =>
  `<button type="button" data-v="${k}" aria-pressed="false"><i style="background:${m.fill}"></i>${m.label}</button>`).join("");
$("tools").innerHTML = ["balc", "win", "wide", "arch", "slit", "round", "lattice", "tall", "square", "triple", "door", "door2", "glassdoor", "archdoor", "garage", "shop", "arcade", "wall", "auto"].map(t =>
  `<button type="button" data-tool="${t}" aria-pressed="${t === tool}">
     <svg viewBox="0 0 40 40" aria-hidden="true">${t === "auto" ? `<text x="20" y="25" text-anchor="middle" font-size="12" fill="${INK}">A</text>` : drawCell(t, 0, 0, 40, 40)}</svg>
     <span>${CELL_LABELS[t]}</span>
   </button>`).join("");

function syncControls() {
  RANGES.forEach(k => { $(k).value = params[k]; $(k + "Out").textContent = String(params[k]).replace(".", ","); });
  document.querySelectorAll(".seg").forEach(seg => seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === params[seg.dataset.name])));
  $("materials").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === params.material));
  $("category").value = params.category;
  $("quality").value = params.quality;
  if (window.ShapeUI) ShapeUI.sync(params);                    // plan shakli va qanot eni (shape-ui.js)
}

function render() {
  Site.sync(); Site.renderUI();
  if ($("konstruktor").hidden) { saveDraft(); return; }      // yashirin bo'limni chizish shart emas
  const n = Site.list.length;
  $("facadeCap").textContent = n > 1 ? `${Site.active + 1}-uy · old fasad` : "Old fasad";
  $("facade").innerHTML = renderFacade(params, cells, { interactive: true, dims: true, uid: "main", geo: Geo.flags });
  Geo.update(Site.list, Site.layout(), Site.active, Site.yard);   // geometrik chizma, bosh reja, hovli va hisob-kitoblar
  if (window.View3D && View3D.ready()) View3D.updateSite(Site.list, Site.gap, Site.active, Geo.flags, Site.yard); else $("iso").innerHTML = renderIso(params, cells);
  if (typeof InteriorUI !== "undefined") InteriorUI.render();     // ichki makon tahrirlash oynasi
  const m = metrics(params, cells);
  const tiles = [
    ["Balandlik", `${f1(m.height)} m`], ["Fasad eni", `${f1(m.width)} m`],
    ["Qavat maydoni", `${nfmt(m.floorArea)} m²`], ["Umumiy maydon", `${nfmt(m.totalArea)} m²`],
    ["Oynalanish", `${m.glazing}%`], ["Qo'lda o'zgartirilgan", `${Object.keys(cells).length} katak`],
  ];
  if (n > 1) tiles.push(["Uylar soni", `${n} ta`], ["Majmua maydoni", `${nfmt(Site.list.reduce((s, b) => s + metrics(b.params, b.cells).totalArea, 0))} m²`]);
  $("dstats").innerHTML = tiles.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  // Narx butun majmua uchun: har bir uy alohida hisoblanadi, jami ko'rsatiladi
  const rs = Site.list.map(b => estimate(b.params.category, b.params.quality, Math.max(20, metrics(b.params, b.cells).totalArea), b.params.floors));
  $("cost").textContent = `$${nfmt(rs.reduce((s, r) => s + r.construction_cost, 0))}`;
  $("costSub").textContent = rs.length > 1
    ? rs.map((r, i) => `${i + 1}-uy $${nfmt(r.construction_cost)}`).join(" · ")
    : `$${nfmt(rs[0].per_m2)} / m² · loyihalash ${rs[0].design_weeks} hafta`;
  saveDraft();
}function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...Site.payload(), active: Site.active, savedSnap, name: $("dName").value })); } catch {}
}

RANGES.forEach(k => $(k).addEventListener("input", e => {
  params[k] = Number(e.target.value);
  $(k + "Out").textContent = e.target.value.replace(".", ",");
  render();
}));
document.querySelectorAll(".seg").forEach(seg => seg.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  params[seg.dataset.name] = b.dataset.v; syncControls(); render();
}));
$("materials").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  params.material = b.dataset.v; syncControls(); render();
});
["category", "quality"].forEach(k => $(k).addEventListener("change", e => { params[k] = e.target.value; render(); }));

// Fasadni bo'yash
$("tools").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  tool = b.dataset.tool;
  $("tools").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
});
function paint(k) {
  const before = cells[k];
  if (tool === "auto") delete cells[k]; else cells[k] = tool;
  if (before !== cells[k]) render();
}
let painting = false;
$("facade").addEventListener("pointerdown", e => {
  const hit = e.target.closest(".hit"); if (!hit) return;
  e.preventDefault();
  undoStack.push(JSON.stringify(cells));
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
  painting = true;
  paint(hit.dataset.k);
});
$("facade").addEventListener("pointermove", e => {
  if (!painting) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && el.classList.contains("hit")) paint(el.dataset.k);
});
window.addEventListener("pointerup", () => { painting = false; });

function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(cells));
  cells = JSON.parse(undoStack.pop());
  render();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(cells));
  cells = JSON.parse(redoStack.pop());
  render();
}
$("undo").addEventListener("click", undo);
$("redo").addEventListener("click", redo);
// Ctrl+Y yoki Ctrl+Shift+Z — "Qayta" (capture: oddiy Ctrl+Z ishlovchisigacha yetib bormaydi)
document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase(), kon = document.getElementById("konstruktor");
  if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey)) && (!kon || !kon.hidden) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    e.preventDefault(); e.stopImmediatePropagation(); redo();
  }
}, true);
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !$("konstruktor").hidden && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    e.preventDefault(); undo();
  }
});
$("clear").addEventListener("click", () => {
  if (!Object.keys(cells).length) return;
  undoStack.push(JSON.stringify(cells)); redoStack.length = 0; cells = {}; render();
});

// ---------- VR ichida qurish: 3D ko'rinish so'raydi, holat shu yerda o'zgaradi (orqaga/qayta bilan) ----------
if (window.View3D) View3D.onVrEdit = (i, op, a) => {
  if (i !== Site.active && Site.list[i]) Site.select(i);          // boshqa uyga qaralgan bo'lsa, avval o'sha uy faol bo'ladi
  if (op === "paint") {
    const before = cells[a.k];
    if (a.tool === "auto" ? before === undefined : before === a.tool) return;
    undoStack.push(JSON.stringify(cells)); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0;
    if (a.tool === "auto") delete cells[a.k]; else cells[a.k] = a.tool;
    render();
  } else if (op === "step") {
    const el = $(a.name);
    params[a.name] = Math.min(Number(el.max), Math.max(Number(el.min), params[a.name] + a.d));
    syncControls(); render();
  } else if (op === "cycle") {
    const opts = OPTIONS[a.name];
    params[a.name] = opts[(opts.indexOf(params[a.name]) + 1) % opts.length];
    syncControls(); render();
  } else if (op === "undo") undo();
  else if (op === "redo") redo();
};

// SVG yuklab olish — artifact ichida faqat "downloads" orqali (tasdiq so'raladi)
let downloads = null;
(async () => {
  const c = window.claude;
  downloads = c && typeof c.use === "function" ? await c.use("downloads") : null;
  $("export").hidden = !downloads;
})();
$("export").addEventListener("click", async () => {
  const style = `<style>.d-dim line,.d-dim path{stroke:#555;fill:#555}.d-text{fill:#555;font:11px monospace}.d-ground{stroke:#1f2326}</style>`;
  const svg = renderFacade(params, cells, { dims: true, uid: "exp" }).replace(/(<svg[^>]*>)/, `$1${style}<rect width="100%" height="100%" fill="#f7f8f7"/>`);
  const name = ($("dName").value.trim() || "bino").replace(/[^\w\-]+/g, "_");
  const msg = $("saveMsg");
  try {
    await downloads.save({ filename: `${name}.svg`, data: svg });
    msg.textContent = "SVG chizma yuklab olindi."; msg.className = "msg ok";
  } catch (err) {
    if (err && err.code !== "declined") { msg.textContent = "Faylni yuklab bo'lmadi."; msg.className = "msg bad"; }
  }
});

// Saqlash
$("saveForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("saveMsg"), btn = e.target.querySelector("button[type=submit]");
  const name = $("dName").value.trim();
  if (name.length < 2) { msg.textContent = "Loyihaga kamida 2 harfli nom bering."; msg.className = "msg bad"; $("dName").focus(); return; }
  const design = cleanDesign({
    id: newId(), name, author: $("dAuthor").value.trim() || "Mehmon",
    createdAt: new Date().toISOString(), ...Site.payload(),
  });
  btn.disabled = true;
  try {
    if (store.canShare) {
      try {
        await saveShared(design);
        msg.textContent = `"${name}" umumiy galereyaga saqlandi.`;
      } catch (err) {
        if (err && err.code === "quota_exceeded") throw new Error("Galereya to'lgan. Eski dizaynlardan birini o'chiring.");
        if (err && err.code === "invalid_argument") {          // yozish huquqi yo'q ekan — brauzerga o'tamiz
          store.canShare = false; updateTarget();
        } else throw err;
      }
    }
    if (!store.canShare) {
      const mine = loadMine();
      mine.unshift(design);
      if (!saveMine(mine)) throw new Error("Brauzer xotirasiga yozib bo'lmadi (yashirin rejim yoqilganmi?).");
      msg.textContent = `"${name}" shu brauzerga saqlandi. "Galereya" bo'limida ko'rinadi.`;
    }
    msg.className = "msg ok";
    savedSnap = snap(); saveDraft();
    renderGalleries();
  } catch (err) {
    msg.textContent = (err && err.message) || "Saqlab bo'lmadi. Birozdan keyin qayta urinib ko'ring."; msg.className = "msg bad";
  } finally { btn.disabled = false; }
});

// ================= YANGI BINO =================
const newDlg = $("newDlg");
$("tplGrid").innerHTML = Object.entries(TEMPLATES).map(([k, t]) => `
  <button type="button" class="tpl${k === "bosh" ? " tpl-blank" : ""}" data-tpl="${k}">
    <div class="tpl-img">${renderFacade({ ...DEFAULT_PARAMS, ...t.params }, t.cells, { uid: "t" + k })}</div>
    <b>${t.label}</b>
    <span>${t.hint}</span>
  </button>`).join("");

function openNewDialog() {
  $("newWarn").hidden = !isDirty();
  newDlg.showModal();
}
$("newBtn").addEventListener("click", openNewDialog);
$("newCancel").addEventListener("click", () => newDlg.close());
newDlg.addEventListener("click", e => { if (e.target === newDlg) newDlg.close(); });
$("tplGrid").addEventListener("click", e => {
  const b = e.target.closest(".tpl"); if (!b) return;
  const t = TEMPLATES[b.dataset.tpl];
  loadIntoDesigner([{ params: { ...DEFAULT_PARAMS, ...t.params }, cells: { ...t.cells } }], 10, "", b.dataset.tpl === "bosh"
    ? "Bo'sh varaq tayyor. Qavat va oraliqlarni sozlang, keyin asbob bilan deraza va eshiklarni qo'ying."
    : `"${t.label}" andozasi ochildi. Uni xohlagancha o'zgartiring.`);
  newDlg.close();
});

function loadIntoDesigner(list, gap, name, note, yard) {
  Site.load(list.map(b => { const p = cleanParams(b.params); return { params: p, cells: cleanCells(b.cells, p), pos: b.pos, interior: Interior.clean(b.interior) }; }), gap, 0, yard);
  ({ params, cells } = Site.current());
  undoStack.length = 0; redoStack.length = 0;
  savedSnap = snap();
  $("dName").value = name; $("dAuthor").value = "";
  $("saveMsg").textContent = note; $("saveMsg").className = "msg ok";
  syncControls();
  if ($("konstruktor").hidden) showView("konstruktor"); else render();
  window.playBuild && window.playBuild();
}

// ================= GALEREYA =================
function designCard(d, canDelete, where) {
  return `
    <article class="dcard">
      <div class="facade">${renderFacade(d.params, d.cells, { uid: where + d.id })}</div>
      <div class="body">
        <div class="meta"><span>${esc(d.author)}</span><span>${esc(d.createdAt.slice(0, 10))}</span></div>
        <h3>${esc(d.name)}</h3>
        <div class="meta"><span>${d.buildings.length > 1 ? `${d.buildings.length} ta uy · ${nfmt(d.buildings.reduce((s, b) => s + metrics(b.params, b.cells).totalArea, 0))} m²` : `${d.params.floors} qavat · ${f1(geometry(d.params).H)} m`}</span><span>${esc(MATERIALS[d.params.material].label)}</span></div>
        <div class="actions">
          <button type="button" class="btn-ghost" data-open="${where}:${d.id}">Konstruktorda ochish</button>
          ${canDelete ? `<button type="button" class="btn-danger" data-del="${where}:${d.id}">O'chirish</button>` : ""}
        </div>
      </div>
    </article>`;
}

function renderGalleries() {
  const sharedEl = $("sharedGallery");
  if (store.sharedState === "loading") {
    sharedEl.innerHTML = `<p class="empty">Galereya yuklanmoqda…</p>`;
  } else if (store.sharedState === "off") {
    sharedEl.innerHTML = `<p class="empty">Umumiy galereya bu ko'rinishda mavjud emas (masalan, tizimga kirilmagan). Dizaynlaringiz "Mening dizaynlarim" bo'limiga saqlanadi.</p>`;
  } else if (!store.shared.length) {
    sharedEl.innerHTML = `<p class="empty">Umumiy galereya hozircha bo'sh. Konstruktorda bino yarating va "Saqlash"ni bosing.</p>`;
  } else {
    sharedEl.innerHTML = store.shared.map(d => designCard(d, store.isAdmin || d.owner === store.uid, "s")).join("");
  }
  const mine = loadMine();
  $("myGallery").innerHTML = mine.length
    ? mine.map(d => designCard(d, true, "m")).join("")
    : `<p class="empty">Bu brauzerda saqlangan dizayn yo'q.</p>`;
}

function findDesign(key) {
  const [where, id] = key.split(":");
  return where === "s" ? store.shared.find(d => d.id === id) : loadMine().find(d => d.id === id);
}
$("galereya").addEventListener("click", async e => {
  const open = e.target.closest("[data-open]");
  if (open) {
    const d = findDesign(open.dataset.open);
    if (d) loadIntoDesigner(d.buildings, d.gap, d.name + " (nusxa)", `"${d.name}" ochildi. O'zgartirib, yangi nom bilan saqlashingiz mumkin.`, d.yard);
    return;
  }
  const del = e.target.closest("[data-del]");
  if (!del) return;
  // Ikki bosqichli o'chirish: birinchi bosish tasdiqlashni so'raydi
  if (del.dataset.armed !== "true") {
    del.dataset.armed = "true"; del.textContent = "Tasdiqlash";
    setTimeout(() => { if (del.isConnected) { del.dataset.armed = "false"; del.textContent = "O'chirish"; } }, 3000);
    return;
  }
  const [where, id] = del.dataset.del.split(":");
  if (where === "m") {
    saveMine(loadMine().filter(d => d.id !== id));
    renderGalleries();
  } else {
    const d = store.shared.find(x => x.id === id);
    try { await deleteShared(d.owner, id); }
    catch { del.textContent = "O'chirib bo'lmadi"; }
  }
});

// ================= ISHGA TUSHIRISH =================
try {
  const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
  if (d && d.params) {
    const raw = Array.isArray(d.buildings) && d.buildings.length ? d.buildings : [{ params: d.params, cells: d.cells }];
    Site.load(raw.map(b => { const p = cleanParams(b && b.params); return { params: p, cells: cleanCells(b && b.cells, p), pos: b && b.pos, interior: Interior.clean(b && b.interior) }; }), d.gap, d.active, d.yard);
    ({ params, cells } = Site.current());
    savedSnap = typeof d.savedSnap === "string" ? d.savedSnap : "";
    $("dName").value = typeof d.name === "string" ? d.name.slice(0, 80) : "";
    hadDraft = true;
  }
} catch {}
if (!hadDraft) savedSnap = snap();
syncControls();
renderGalleries();
initStore();

let startView = (location.hash || "").slice(1);
if (!VIEWS.includes(startView)) { try { startView = localStorage.getItem("ustun-view") || "bosh"; } catch { startView = "bosh"; } }
// Sahifa birinchi ochilganda dialog chiqmasligi uchun: konstruktorni faqat foydalanuvchi o'zi ochganda taklif qilamiz
if (startView === "konstruktor") firstDesignerVisit = false;
showView(startView, false);
