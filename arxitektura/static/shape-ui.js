// Konstruktor: plan shakli tanlovi (to'rtburchak, L, П, T, ichki hovli, aylana, ko'pburchaklar) va qanot eni.
// Tugmalar <div class="seg" data-name="shape" id="shapes"> ichiga chiziladi: bosish sahifaning umumiy .seg ishlovchisi orqali
// params.shape ni o'zgartiradi. Qanot eni slayderi faqat L, П, T va ichki hovli uchun ko'rinadi.
const ShapeUI = (function () {
  const WINGED = ["L", "U", "T", "court"];
  const box = document.getElementById("shapes"), row = document.getElementById("wingRow"), inp = document.getElementById("wing"), out = document.getElementById("wingOut");
  if (!box) return { sync() {} };
  // Tugmadagi kichik plan rasmi: shu shaklning konturi (ko'cha tomoni pastda)
  function icon(k) {
    const ps = planShape({ ...DEFAULT_PARAMS, shape: k, bays: 5, bay_w: 4, depth: 16, wing: 0.4 }), s = 22 / Math.max(ps.W, ps.D);
    const d = ps.rings.map(r => "M" + r.map(([x, z]) => `${(1 + x * s).toFixed(1)} ${(1 + z * s).toFixed(1)}`).join("L") + "Z").join("");
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill-rule="evenodd"/></svg>`;
  }
  box.innerHTML = Object.entries(SHAPES).map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="false">${icon(k)}<span>${n}</span></button>`).join("");
  if (inp) inp.addEventListener("input", () => {
    const h = window.DesignHost; if (!h) return;
    h.params().wing = Number(inp.value); out.textContent = `${Math.round(inp.value * 100)}%`;
    h.refresh();
  });
  return {
    sync(p) {
      box.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === shapeOf(p))));
      if (row) row.hidden = !WINGED.includes(shapeOf(p));
      if (inp) { inp.value = p.wing || 0.4; out.textContent = `${Math.round((p.wing || 0.4) * 100)}%`; }
    },
  };
})();
window.ShapeUI = ShapeUI;
