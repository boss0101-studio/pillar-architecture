// Konstruktor holati: parametrlar, qo'lda bo'yalgan kataklar, tanlangan asbob va "orqaga" tarixi
const DRAFT_KEY = "ustun-draft";
let params = { ...DEFAULT_PARAMS };
let cells = {};
let tool = "balc";
const undoStack = [], redoStack = [];
// Oxirgi saqlangan/ochilgan holat — joriy ish undan farq qilsa, "saqlanmagan" hisoblanadi
let savedSnap = "";
const snap = () => Site.snapshot();
const isDirty = () => snap() !== savedSnap;

const $ = id => document.getElementById(id);
const nfmt = n => Math.round(n).toLocaleString("ru-RU");
const RANGES = ["floors", "bays", "floor_h", "bay_w", "depth"];

// ---------- Majmua: bir nechta uy ----------
Site.getCurrent = () => ({ params, cells });            // Site faol uyni shu o'zgaruvchilardan oladi
Site.reset(params, cells);
Site.onSelect = b => { params = b.params; cells = b.cells; undoStack.length = 0; redoStack.length = 0; syncControls(); render(); };
Site.onChange = () => render();
Geo.onChange = () => render();                           // geometrik chiziqlar katakchalari
if (typeof Shop !== "undefined") Shop.onReady(() => queueMicrotask(render));   // katalog yuklangach smeta chiqadi; katalog skript tugashidan oldin kelsa ham render keyinroq ishlaydi
ProjectIO.getPayload = () => Site.payload();
ProjectIO.onLoad = d => {                                         // JSON fayldan ochilgan loyiha
  Site.load(d.buildings, d.gap, 0, d.yard);
  ({ params, cells } = Site.current());
  undoStack.length = 0; redoStack.length = 0; savedSnap = "";
  $("dName").value = d.name;
  $("saveMsg").textContent = `"${d.name || "Loyiha"}" fayldan ochildi.`; $("saveMsg").className = "msg ok";
  syncControls(); render(); window.playBuild && window.playBuild();
};
if (window.View3D) View3D.onPick = i => Site.select(i);   // 3D'da uyni bosib tanlash
// AI yordamchi uchun: konstruktor holatini o'qish va o'zgartirish (ai-design.js)
window.DesignHost = {
  params: () => params, cells: () => cells,
  refresh() { undoStack.length = 0; redoStack.length = 0; syncControls(); render(); },
  load(list, gap, name, note, yard) {
    Site.load(list, gap, 0, yard); ({ params, cells } = Site.current());
    undoStack.length = 0; redoStack.length = 0;
    if (name != null) $("dName").value = name;
    syncControls(); render(); window.playBuild && window.playBuild();
  },
};
if (window.View3D) { View3D.onMove = (i, x, z) => Site.move(i, x, z); View3D.onRotate = i => Site.rotate(i); }   // 3D'da ko'chirish va burish
if (window.View3D) { View3D.onMoveItem = (k, x, z) => Site.moveItem(k, x, z); View3D.onPickItem = k => { if (Site.ysel !== k) { Site.ysel = k; render(); } }; }   // hovli elementlari

// ---------- UI qurish ----------
$("materials").innerHTML = Object.entries(MATERIALS).map(([k, m]) =>
  `<button type="button" data-v="${k}" aria-pressed="false"><i style="background:${m.fill}"></i>${m.label}</button>`).join("");

$("tools").innerHTML = ["balc", "win", "wide", "arch", "slit", "round", "lattice", "tall", "square", "triple", "door", "door2", "glassdoor", "archdoor", "garage", "shop", "arcade", "wall", "auto"].map(t =>
  `<button type="button" data-tool="${t}" aria-pressed="${t === tool}">
     <svg viewBox="0 0 40 40" aria-hidden="true">${t === "auto" ? `<text x="20" y="25" text-anchor="middle" font-size="12" fill="${INK}">A</text>` : drawCell(t, 0, 0, 40, 40)}</svg>
     <span>${CELL_LABELS[t]}</span>
   </button>`).join("");

function syncControls() {
  RANGES.forEach(k => { $(k).value = params[k]; $(k + "Out").textContent = String(params[k]).replace(".", ","); });
  document.querySelectorAll(".seg").forEach(seg => {
    seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === params[seg.dataset.name]));
  });
  $("materials").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === params.material));
  $("category").value = params.category;
  $("quality").value = params.quality;
  if (window.ShapeUI) ShapeUI.sync(params);                    // plan shakli va qanot eni (shape-ui.js)
}

// ---------- Chizish ----------
let costTimer;
function render() {
  Site.sync(); Site.renderUI();
  const n = Site.list.length;
  $("facadeCap").textContent = n > 1 ? `${Site.active + 1}-uy · old fasad` : "Old fasad";
  $("facade").innerHTML = renderFacade(params, cells, { interactive: true, dims: true, uid: "main", geo: Geo.flags });
  Geo.update(Site.list, Site.layout(), Site.active, Site.yard);   // geometrik chizma, bosh reja, hovli va hisob-kitoblar
  if (window.View3D && View3D.ready()) View3D.updateSite(Site.list, Site.gap, Site.active, Geo.flags, Site.yard); else $("iso").innerHTML = renderIso(params, cells);
  if (typeof InteriorUI !== "undefined") InteriorUI.render();     // ichki makon tahrirlash oynasi
  const m = metrics(params, cells);
  const tiles = [
    ["Balandlik", `${f1(m.height)} m`],
    ["Fasad eni", `${f1(m.width)} m`],
    ["Qavat maydoni", `${nfmt(m.floorArea)} m²`],
    ["Umumiy maydon", `${nfmt(m.totalArea)} m²`],
    ["Oynalanish", `${m.glazing}%`],
    ["Qo'lda o'zgartirilgan", `${Object.keys(cells).length} katak`],
  ];
  if (n > 1) tiles.push(["Uylar soni", `${n} ta`], ["Majmua maydoni", `${nfmt(Site.list.reduce((s, b) => s + metrics(b.params, b.cells).totalArea, 0))} m²`]);
  $("stats").innerHTML = tiles.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  saveDraft();
  clearTimeout(costTimer);
  costTimer = setTimeout(fetchCost, 250);   // slayder sudralganda serverni ko'mib yubormaslik uchun
}

// Narx butun majmua uchun: har bir uy alohida hisoblanadi, jami ko'rsatiladi
async function fetchCost() {
  try {
    const rs = await Promise.all(Site.list.map(async b => {
      const area = metrics(b.params, b.cells).totalArea;
      const res = await fetch("/api/estimate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: b.params.category, quality: b.params.quality, area_m2: Math.max(20, area), floors: b.params.floors }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);
      return r;
    }));
    $("cost").textContent = `$${nfmt(rs.reduce((s, r) => s + r.construction_cost, 0))}`;
    $("costSub").textContent = rs.length > 1
      ? rs.map((r, i) => `${i + 1}-uy $${nfmt(r.construction_cost)}`).join(" · ")
      : `$${nfmt(rs[0].per_m2)} / m² · loyihalash ${rs[0].design_weeks} hafta`;
  } catch {
    $("cost").textContent = "—";
    $("costSub").textContent = "Server bilan aloqa yo'q";
  }
}
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...Site.payload(), active: Site.active, savedSnap, name: $("dName").value })); } catch {}
}

// ---------- Yangi bino (noldan yoki andozadan) ----------
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
  params = { ...DEFAULT_PARAMS, ...t.params };
  cells = { ...t.cells };
  Site.reset(params, cells);
  undoStack.length = 0; redoStack.length = 0;
  savedSnap = snap();                       // yangi bino hali hech narsa yo'qotmaydi
  $("dName").value = ""; $("dAuthor").value = "";
  $("saveMsg").textContent = b.dataset.tpl === "bosh"
    ? "Bo'sh varaq tayyor. Qavat va oraliqlarni sozlang, keyin asbob bilan deraza va eshiklarni qo'ying."
    : `"${t.label}" andozasi ochildi. Uni xohlagancha o'zgartiring.`;
  $("saveMsg").className = "msg ok";
  window.history.replaceState(null, "", location.pathname);   // eski ?id= ni olib tashlash
  syncControls(); render(); window.playBuild && window.playBuild();
  newDlg.close();
  document.querySelector(".ds").scrollIntoView({ behavior: "smooth" });
});

// ---------- Parametrlar ----------
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

// ---------- Fasadni bo'yash ----------
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
const facadeEl = $("facade");
facadeEl.addEventListener("pointerdown", e => {
  const hit = e.target.closest(".hit"); if (!hit) return;
  e.preventDefault();
  undoStack.push(JSON.stringify(cells));
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
  painting = true;
  paint(hit.dataset.k);
});
facadeEl.addEventListener("pointermove", e => {
  if (!painting) return;
  // innerHTML har safar yangilangani uchun element nuqtadan topiladi
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
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
  if (/^furn/.test(op)) return typeof InteriorUI !== "undefined" && InteriorUI.vrEdit ? InteriorUI.vrEdit(op, a) : false;   // VR ichki dizayn
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

// ---------- SVG eksport ----------
$("export").addEventListener("click", () => {
  // CSS o'zgaruvchilari fayl ichida ishlamaydi — o'lcham chiziqlari uchun aniq ranglar qo'shiladi
  const style = `<style>.d-dim line,.d-dim path{stroke:#555;fill:#555}.d-text{fill:#555;font:11px monospace}.d-ground{stroke:#1f2326}</style>`;
  const svg = renderFacade(params, cells, { dims: true, uid: "exp" }).replace(/(<svg[^>]*>)/, `$1${style}<rect width="100%" height="100%" fill="#f7f8f7"/>`);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${($("dName").value || "bino").replace(/[^\w\-]+/g, "_")}.svg` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ---------- Saqlash va galereya ----------
$("saveForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("saveMsg"), btn = e.target.querySelector("button");
  const name = $("dName").value.trim();
  if (name.length < 2) { msg.textContent = "Loyihaga kamida 2 harfli nom bering."; msg.className = "msg bad"; $("dName").focus(); return; }
  btn.disabled = true;
  try {
    const res = await fetch("/api/designs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, author: $("dAuthor").value, ...Site.payload() }),
    });
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || "Saqlab bo'lmadi");
    msg.textContent = `"${name}" galereyaga saqlandi (№${r.id}).`; msg.className = "msg ok";
    savedSnap = snap(); saveDraft();
    window.history.replaceState(null, "", `?id=${r.id}`);
    loadGallery();
  } catch (err) {
    msg.textContent = err.message; msg.className = "msg bad";
  } finally { btn.disabled = false; }
});

async function loadGallery() {
  const el = $("gallery");
  try {
    const res = await fetch("/api/designs");
    const list = await res.json();
    if (!list.length) { el.innerHTML = `<p class="empty">Hali hech kim dizayn saqlamagan. Birinchisi siz bo'ling.</p>`; return; }
    el.innerHTML = list.map(d => `
      <button class="card" type="button" data-id="${d.id}">
        <div class="facade">${renderFacade(d.params, d.cells, { uid: "g" + d.id })}</div>
        <div class="body">
          <div class="meta"><span>${esc(d.author)}</span><span>${esc(d.created_at.slice(0, 10))}</span></div>
          <h3>${esc(d.name)}</h3>
          <div class="meta"><span>${d.buildings.length > 1 ? `${d.buildings.length} ta uy · ${nfmt(d.buildings.reduce((s, b) => s + metrics(b.params, b.cells).totalArea, 0))} m²` : `${d.params.floors} qavat · ${f1(geometry(d.params).H)} m`}</span><span>${esc(MATERIALS[d.params.material].label)}</span></div>
        </div>
      </button>`).join("");
  } catch {
    el.innerHTML = `<p class="err">Galereyani yuklab bo'lmadi. Server ishlayotganini tekshiring.</p>`;
  }
}
$("gallery").addEventListener("click", e => {
  const card = e.target.closest(".card"); if (card) openDesign(card.dataset.id, true);
});

async function openDesign(id, scroll) {
  try {
    const res = await fetch(`/api/designs/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error();
    const d = await res.json();
    Site.load((d.buildings && d.buildings.length ? d.buildings : [{ params: d.params, cells: d.cells }])
      .map(b => ({ params: { ...DEFAULT_PARAMS, ...b.params }, cells: b.cells || {}, pos: b.pos, interior: b.interior })), d.gap, 0, d.yard);
    ({ params, cells } = Site.current());
    undoStack.length = 0; redoStack.length = 0;
    savedSnap = snap();
    $("dName").value = d.name + " (nusxa)";
    $("dAuthor").value = "";
    $("saveMsg").textContent = `"${d.name}" ochildi. O'zgartirib, yangi nom bilan saqlashingiz mumkin.`;
    $("saveMsg").className = "msg ok";
    syncControls(); render(); window.playBuild && window.playBuild();
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    $("saveMsg").textContent = "Dizaynni ochib bo'lmadi."; $("saveMsg").className = "msg bad";
  }
}

// ---------- Ishga tushirish ----------
const startId = new URLSearchParams(location.search).get("id");
let hasDraft = false;
if (startId) {
  openDesign(startId);
} else {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (d && d.params) {
      const list = Array.isArray(d.buildings) && d.buildings.length ? d.buildings : [{ params: d.params, cells: d.cells }];
      Site.load(list.map(b => ({ params: { ...DEFAULT_PARAMS, ...b.params }, cells: b.cells || {}, pos: b.pos, interior: b.interior })), d.gap, d.active, d.yard);
      ({ params, cells } = Site.current());
      savedSnap = d.savedSnap || ""; $("dName").value = d.name || "";
      hasDraft = true;
    }
  } catch {}
}
const tplKey = new URLSearchParams(location.search).get("tpl");
if (!startId && tplKey && TEMPLATES[tplKey]) {                 // bosh sahifadan andoza bilan kelindi
  params = { ...DEFAULT_PARAMS, ...TEMPLATES[tplKey].params };
  cells = { ...TEMPLATES[tplKey].cells };
  Site.reset(params, cells);
  hasDraft = true; savedSnap = snap();
  window.history.replaceState(null, "", location.pathname);
}
if (!startId && !hasDraft) savedSnap = snap();
syncControls();
render();
window.playBuild && window.playBuild();
loadGallery();
// Birinchi kirish: qoralama ham, ochilgan dizayn ham yo'q — boshlang'ich nuqtani tanlashni taklif qilamiz
if (!startId && !hasDraft) openNewDialog();
