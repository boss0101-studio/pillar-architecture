const CAT_LABEL = { "turar-joy": "Turar-joy", jamoat: "Jamoat", tijorat: "Tijorat", interyer: "Interyer" };
const nf = n => Number(n).toLocaleString("ru-RU");
let projects = [];

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server xatosi (${res.status})`);
  return data;
}

// ---------- Statistika ----------
async function loadStats() {
  try {
    const s = await api("/api/stats");
    const vals = [s.projects, s.built, nf(s.area), s.cities];
    document.querySelectorAll("#stats b").forEach((b, i) => { b.textContent = vals[i]; });
  } catch { /* statistika ixtiyoriy */ }
}

// ---------- Loyihalar ----------
async function loadProjects(cat = "") {
  const grid = document.getElementById("grid");
  try {
    projects = await api("/api/projects" + (cat ? `?category=${encodeURIComponent(cat)}` : ""));
  } catch (e) {
    grid.innerHTML = `<p class="err">Loyihalarni yuklab bo'lmadi: ${esc(e.message)}. Server ishlayotganini tekshiring.</p>`;
    return;
  }
  if (!projects.length) {
    grid.innerHTML = `<p class="empty">Bu kategoriyada hozircha loyiha yo'q.</p>`;
    return;
  }
  grid.innerHTML = projects.map(p => `
    <button class="card" type="button" data-id="${p.id}">
      <div class="facade">${facadeSVG(p)}</div>
      <div class="body">
        <div class="meta"><span>${esc(CAT_LABEL[p.category])} · ${esc(p.city)}</span><span>${p.year}</span></div>
        <h3>${esc(p.title)}</h3>
        <span><span class="pill ${p.status}">${esc(p.status)}</span></span>
      </div>
    </button>`).join("");
}

document.getElementById("filters").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  document.querySelectorAll("#filters button").forEach(b => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
  loadProjects(btn.dataset.cat);
});

// ---------- Loyiha oynasi ----------
const dlg = document.getElementById("dlg");
document.getElementById("grid").addEventListener("click", async e => {
  const card = e.target.closest(".card");
  if (!card) return;
  let p;
  try { p = await api(`/api/projects/${card.dataset.id}`); } catch { return; }
  document.getElementById("dFacade").innerHTML = facadeSVG(p);
  const st = document.getElementById("dStatus");
  st.className = `pill ${p.status}`; st.textContent = p.status;
  document.getElementById("dTitle").textContent = p.title;
  document.getElementById("dDesc").textContent = p.description;
  document.getElementById("dSpec").innerHTML = [
    ["Turi", CAT_LABEL[p.category]], ["Shahar", p.city], ["Yil", p.year],
    ["Maydon", `${nf(p.area_m2)} m²`], ["Qavatlar", p.floors],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
  dlg.showModal();
});
document.getElementById("dClose").addEventListener("click", () => dlg.close());
dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

// ---------- Smeta ----------
const estForm = document.getElementById("estForm");
async function runEstimate(e) {
  if (e) e.preventDefault();
  const msg = document.getElementById("estMsg");
  const body = Object.fromEntries(new FormData(estForm));
  try {
    const r = await api("/api/estimate", { method: "POST", body: JSON.stringify(body) });
    document.getElementById("rBuild").textContent = `$${nf(r.construction_cost)}`;
    document.getElementById("rM2").textContent = `$${nf(r.per_m2)}`;
    document.getElementById("rFee").textContent = `$${nf(r.design_fee)}`;
    document.getElementById("rWeeks").textContent = `${r.design_weeks} hafta`;
    msg.textContent = ""; msg.className = "msg";
  } catch (err) {
    msg.textContent = err.message; msg.className = "msg bad";
  }
}
estForm.addEventListener("submit", runEstimate);

// ---------- Ariza ----------
const reqForm = document.getElementById("reqForm");
reqForm.addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("reqMsg");
  const btn = reqForm.querySelector("button");
  if (!reqForm.checkValidity()) {
    msg.textContent = "Ism, telefon va loyiha haqida maydonlarini to'ldiring.";
    msg.className = "msg bad";
    return;
  }
  btn.disabled = true;
  try {
    const r = await api("/api/requests", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(reqForm))) });
    msg.textContent = `Ariza №${r.id} qabul qilindi. Tez orada bog'lanamiz.`;
    msg.className = "msg ok";
    reqForm.reset();
  } catch (err) {
    msg.textContent = err.message; msg.className = "msg bad";
  } finally {
    btn.disabled = false;
  }
});

loadStats();
loadProjects();
runEstimate();
