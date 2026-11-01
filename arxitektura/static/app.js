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

// ---------- Loyiha oynasi ----------
const dlg = document.getElementById("dlg");
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
runEstimate();
