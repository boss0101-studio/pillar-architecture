// Erkin qurish — bitta bo'limda ikki chizish usuli: "Qo'lda chizish" (qalam va chizg'ichlar, avvalgi Oq qog'oz — #ppApp)
// va "Aniq chizish" (nuqtalab devor, eshik, deraza, qavat, smeta — #fbApp). Qo'lda chizilgani bir bosishda aniq chizishga o'tadi.
// Tanlov shu brauzerda eslab qolinadi ("ustun-erkin-rejim"); #qogoz yoki ?rejim=qolda havolasi qo'lda chizishni ochadi.
const UstunErkin = (function () {
  const KEY = "ustun-erkin-rejim";
  let mode = "aniq";
  try { mode = localStorage.getItem(KEY) === "qolda" ? "qolda" : "aniq"; } catch {}
  if (/^#qogoz/.test(location.hash) || /[?&]rejim=qolda/.test(location.search)) mode = "qolda";
  if (/[?&]rejim=aniq/.test(location.search)) mode = "aniq";

  function apply() {
    const fb = document.getElementById("fbApp"), pp = document.getElementById("ppApp");
    if (fb) fb.hidden = mode !== "aniq";
    if (pp) pp.hidden = mode !== "qolda";
    document.querySelectorAll("[data-erkin]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.erkin === mode)));
    document.querySelectorAll("[data-erkin-hint]").forEach(p => { p.hidden = p.dataset.erkinHint !== mode; });
  }
  function set(m) {
    const next = m === "qolda" ? "qolda" : "aniq", changed = next !== mode;
    mode = next;
    try { localStorage.setItem(KEY, mode); } catch {}
    apply();
    if (changed) window.dispatchEvent(new CustomEvent("ustun-erkin", { detail: { mode } }));
  }
  function mount() {
    const fb = document.getElementById("fbApp"); if (!fb || document.querySelector(".erkin-sw")) return;
    fb.insertAdjacentHTML("beforebegin", `<div class="erkin-sw" role="tablist" aria-label="Chizish usuli">
        <button type="button" role="tab" data-erkin="qolda"><span aria-hidden="true">✏️</span><b>Qo'lda chizish</b><small>qalam, chizg'ich, sirkul</small></button>
        <button type="button" role="tab" data-erkin="aniq"><span aria-hidden="true">📐</span><b>Aniq chizish</b><small>nuqtalab devor, eshik, smeta</small></button>
      </div>`);
    apply();
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-erkin]"); if (b) set(b.dataset.erkin); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  return { get mode() { return mode; }, set };
})();
window.UstunErkin = UstunErkin;
