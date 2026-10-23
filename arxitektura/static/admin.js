// Token faqat shu brauzer sessiyasida saqlanadi (tab yopilsa o'chadi)
let token = "";
try { token = sessionStorage.getItem("ustun-token") || ""; } catch {}

async function adminApi(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error("Token noto'g'ri"); }
  if (!res.ok) throw new Error(data.error || `Server xatosi (${res.status})`);
  return data;
}

function showPanel(on) {
  document.getElementById("login").hidden = on;
  document.getElementById("panel").hidden = !on;
  document.getElementById("logout").hidden = !on;
}
function logout() {
  token = "";
  try { sessionStorage.removeItem("ustun-token"); } catch {}
  showPanel(false);
}

document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  token = document.getElementById("token").value.trim();
  const msg = document.getElementById("loginMsg");
  try {
    await loadAll();
    try { sessionStorage.setItem("ustun-token", token); } catch {}
    showPanel(true);
    msg.textContent = "";
  } catch (err) {
    msg.textContent = err.message; msg.className = "msg bad";
  }
});
document.getElementById("logout").addEventListener("click", e => { e.preventDefault(); logout(); });
document.getElementById("refresh").addEventListener("click", () => loadRequests());

// ---------- Arizalar ----------
async function loadRequests() {
  const rows = await adminApi("/api/requests");
  const body = document.getElementById("reqBody");
  if (!rows.length) { body.innerHTML = `<tr><td colspan="7">Hozircha ariza yo'q.</td></tr>`; return; }
  body.innerHTML = rows.map(r => `
    <tr>
      <td class="num">${r.id}</td>
      <td class="num">${esc(r.created_at.slice(0, 16).replace("T", " "))}</td>
      <td>${esc(r.name)}<br><span class="mono">${esc(r.phone)}</span></td>
      <td>${esc(r.project_type)}</td>
      <td class="num">${r.area_m2 ? r.area_m2.toLocaleString("ru-RU") + " m²" : "—"}</td>
      <td>${esc(r.message)}</td>
      <td>
        <select data-id="${r.id}" aria-label="Ariza ${r.id} holati">
          ${["yangi", "ko'rildi", "yopildi"].map(s => `<option value="${s}" ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
    </tr>`).join("");
}
document.getElementById("reqBody").addEventListener("change", async e => {
  const sel = e.target.closest("select");
  if (!sel) return;
  try { await adminApi(`/api/requests/${sel.dataset.id}`, { method: "PATCH", body: JSON.stringify({ status: sel.value }) }); }
  catch (err) { sel.insertAdjacentText("afterend", " " + err.message); }
});

// ---------- Loyihalar ----------
async function loadProjectsAdmin() {
  const rows = await adminApi("/api/projects");
  document.getElementById("projBody").innerHTML = rows.map(p => `
    <tr>
      <td>${esc(p.title)}<br><span class="label">${esc(p.city)}</span></td>
      <td class="num">${p.year}</td>
      <td><span class="pill ${p.status}">${p.status}</span></td>
      <td><button class="btn-danger" type="button" data-id="${p.id}">O'chirish</button></td>
    </tr>`).join("");
}
async function loadDesignsAdmin() {
  const rows = await (await fetch("/api/designs")).json();
  const body = document.getElementById("designBody");
  if (!rows.length) { body.innerHTML = `<tr><td colspan="6">Hozircha dizayn yo'q.</td></tr>`; return; }
  body.innerHTML = rows.map(d => `
    <tr>
      <td class="num">${d.id}</td>
      <td><a href="designer.html?id=${d.id}">${esc(d.name)}</a></td>
      <td>${esc(d.author)}</td>
      <td class="num">${d.buildings && d.buildings.length > 1 ? d.buildings.length + " uy · " : ""}${d.params.floors} qavat × ${d.params.bays} oraliq</td>
      <td class="num">${esc(d.created_at.slice(0, 10))}</td>
      <td><button class="btn-danger" type="button" data-kind="designs" data-id="${d.id}">O'chirish</button></td>
    </tr>`).join("");
}

// O'chirish ikki bosqichli: birinchi bosish tugmani "Tasdiqlash"ga aylantiradi
async function onDelete(e) {
  const btn = e.target.closest(".btn-danger");
  if (!btn) return;
  if (btn.dataset.armed !== "true") {
    btn.dataset.armed = "true"; btn.textContent = "Tasdiqlash";
    setTimeout(() => { btn.dataset.armed = "false"; btn.textContent = "O'chirish"; }, 3000);
    return;
  }
  const kind = btn.dataset.kind || "projects";
  try {
    await adminApi(`/api/${kind}/${btn.dataset.id}`, { method: "DELETE" });
    await (kind === "designs" ? loadDesignsAdmin() : loadProjectsAdmin());
  } catch (err) { btn.textContent = err.message; }
}
document.getElementById("projBody").addEventListener("click", onDelete);
document.getElementById("designBody").addEventListener("click", onDelete);

const projForm = document.getElementById("projForm");
projForm.addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("projMsg");
  try {
    const r = await adminApi("/api/projects", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(projForm))) });
    msg.textContent = `Loyiha qo'shildi (id ${r.id}).`; msg.className = "msg ok";
    projForm.reset();
    await loadProjectsAdmin();
  } catch (err) {
    msg.textContent = err.message; msg.className = "msg bad";
  }
});

// ---------- Buyurtmalar ----------
async function loadOrders() {
  const rows = await adminApi("/api/orders");
  const body = document.getElementById("orderBody");
  if (!rows.length) { body.innerHTML = `<tr><td colspan="6">Hozircha buyurtma yo'q.</td></tr>`; return; }
  body.innerHTML = rows.map(o => `
    <tr>
      <td class="num">${o.id}</td>
      <td class="num">${esc(o.created_at.slice(0, 16).replace("T", " "))}</td>
      <td>${esc(o.name)}<br><span class="mono">${esc(o.phone)}</span>${o.note ? `<br><span class="muted">${esc(o.note)}</span>` : ""}</td>
      <td>${o.items.map(i => `${esc(i.name)} × ${esc(i.qty)} ${esc(i.unit)}`).join("<br>")}</td>
      <td class="num">$${Math.round(o.total).toLocaleString("ru-RU")}</td>
      <td><select data-order="${o.id}" aria-label="Buyurtma ${o.id} holati">${["yangi", "tasdiqlandi", "yetkazildi", "bekor"].map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
    </tr>`).join("");
}
document.getElementById("orderBody").addEventListener("change", async e => {
  const sel = e.target.closest("select[data-order]");
  if (!sel) return;
  try { await adminApi(`/api/orders/${sel.dataset.order}`, { method: "PATCH", body: JSON.stringify({ status: sel.value }) }); }
  catch (err) { sel.insertAdjacentText("afterend", " " + err.message); }
});

async function loadAll() { await Promise.all([loadRequests(), loadProjectsAdmin(), loadDesignsAdmin(), loadOrders()]); }

if (token) loadAll().then(() => showPanel(true)).catch(() => showPanel(false));
