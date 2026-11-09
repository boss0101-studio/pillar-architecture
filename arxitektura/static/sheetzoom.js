// Chizma varaqlarini yaqinlashtirish (GP, AR, loyiha bo'limlari): har bir .gp-sheet ustiga asboblar paneli qo'yiladi.
// − / + / 100% tugmalari, Ctrl + g'ildirak (kursor nuqtasiga), ikki marta bosish, sichqoncha bilan sudrab surish,
// telefonda ikki barmoq bilan kattalashtirish, to'liq ekran. Varaq qayta chizilganda (boshqa tab) masshtab saqlanadi.
(function () {
  const MIN = 1, MAX = 8;
  let scale = 1;
  const clamp = v => Math.min(MAX, Math.max(MIN, v));

  function apply(box) {
    box.style.setProperty("--sz", scale);
    box.classList.toggle("sz-on", scale > 1.001);
    const wrap = box.closest(".sz-wrap"), lab = wrap && wrap.querySelector("[data-sz-val]");
    if (lab) lab.textContent = Math.round(scale * 100) + "%";
  }
  // (cx, cy) ekrandagi nuqta joyida qoladi
  function zoomAt(box, next, cx, cy) {
    const r = box.getBoundingClientRect();
    if (cx === undefined) { cx = r.left + r.width / 2; cy = r.top + Math.min(r.height, innerHeight - r.top) / 2; }
    const ox = cx - r.left, oy = cy - r.top, px = box.scrollLeft + ox, py = box.scrollTop + oy, k0 = scale;
    scale = clamp(next); apply(box);
    const k = scale / k0;
    box.scrollLeft = px * k - ox; box.scrollTop = py * k - oy;
  }

  function enhance(box) {
    if (box.dataset.sz) return;
    box.dataset.sz = "1"; box.tabIndex = 0;
    box.setAttribute("aria-label", "Chizma varag'i: Ctrl + g'ildirak yoki + / − tugmalari bilan yaqinlashtiring, sudrab suring");
    const wrap = document.createElement("div"); wrap.className = "sz-wrap";
    box.parentNode.insertBefore(wrap, box);
    const bar = document.createElement("div"); bar.className = "sz-bar";
    bar.innerHTML = `<button type="button" data-sza="out" aria-label="Uzoqlashtirish" title="Uzoqlashtirish">−</button>
      <button type="button" data-sza="fit" title="Varaqni sig'dirish"><span data-sz-val>100%</span></button>
      <button type="button" data-sza="in" aria-label="Yaqinlashtirish" title="Yaqinlashtirish">+</button>
      <button type="button" data-sza="full" title="To'liq ekran">⛶ <span>To'liq ekran</span></button>
      <span class="sz-hint">Ctrl + g'ildirak — yaqinlashtirish, sudrash — surish, 2 marta bosish — ×2</span>`;
    wrap.append(bar, box);
    apply(box);

    bar.addEventListener("click", e => {
      const b = e.target.closest("[data-sza]"); if (!b) return;
      const a = b.dataset.sza;
      if (a === "in") zoomAt(box, scale * 1.5);
      else if (a === "out") zoomAt(box, scale / 1.5);
      else if (a === "fit") { scale = 1; apply(box); box.scrollLeft = box.scrollTop = 0; }
      else if (a === "full") {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => wrap.classList.toggle("sz-max"));
        else wrap.classList.toggle("sz-max");
      }
    });
    box.addEventListener("wheel", e => {
      if (!(e.ctrlKey || e.metaKey) && !wrap.matches(":fullscreen, .sz-max")) return;   // oddiy g'ildirak sahifani aylantiradi
      e.preventDefault();
      zoomAt(box, scale * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0018)), e.clientX, e.clientY);
    }, { passive: false });
    box.addEventListener("dblclick", e => { e.preventDefault(); zoomAt(box, scale >= MAX / 1.01 ? 1 : scale * 2, e.clientX, e.clientY); });
    box.addEventListener("keydown", e => {
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomAt(box, scale * 1.5); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomAt(box, scale / 1.5); }
      else if (e.key === "0") { e.preventDefault(); scale = 1; apply(box); }
    });
    // sudrab surish (sichqoncha) va ikki barmoq bilan kattalashtirish
    const pts = new Map(); let drag = null, pinch = null;
    box.addEventListener("pointerdown", e => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scale }; drag = null;
      } else if (e.pointerType === "mouse" && e.button === 0 && scale > 1.001) {
        drag = { x: e.clientX, y: e.clientY, l: box.scrollLeft, t: box.scrollTop }; box.setPointerCapture(e.pointerId); box.classList.add("sz-drag");
      }
    });
    box.addEventListener("pointermove", e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt(box, pinch.s * d / Math.max(10, pinch.d), (a.x + b.x) / 2, (a.y + b.y) / 2);
      } else if (drag) { box.scrollLeft = drag.l - (e.clientX - drag.x); box.scrollTop = drag.t - (e.clientY - drag.y); }
    });
    const end = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (drag) { drag = null; box.classList.remove("sz-drag"); } };
    box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
  }

  const scan = () => document.querySelectorAll(".gp-sheet:not([data-sz])").forEach(b => { if (b.querySelector("svg")) enhance(b); });
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("fullscreenchange", () => document.querySelectorAll(".sz-wrap").forEach(w => w.classList.toggle("sz-full", document.fullscreenElement === w)));
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".sz-wrap.sz-max").forEach(w => w.classList.remove("sz-max")); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan); else scan();
})();
