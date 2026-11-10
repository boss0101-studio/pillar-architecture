// Bosh sahifadagi reklama videosi: 4 til (uz / en / ru / es). Tugma videoni, muqovani va yuklab olish havolasini almashtiradi.
// Boshlang'ich til — sayt tili (UstunI18n.lang); tanlov localStorage'da eslab qolinadi.
(function () {
  const box = document.getElementById("video"); if (!box) return;
  const v = box.querySelector("video"), src = v && v.querySelector("source"), dl = box.querySelector(".pv-dl a"), tabs = [...box.querySelectorAll(".pv-tabs [data-l]")];
  if (!v || !src || !tabs.length) return;
  const KEY = "ustun-video-til", HAS = tabs.map(b => b.dataset.l);
  let picked = null; try { picked = localStorage.getItem(KEY); } catch {}
  function show(l, remember) {
    if (!HAS.includes(l)) l = "uz";
    const file = `video/pillar-reklama-${l}.mp4`;
    tabs.forEach(b => { const on = b.dataset.l === l; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    if (src.getAttribute("src") !== file) {
      const playing = !v.paused; src.setAttribute("src", file); v.setAttribute("poster", `video/pillar-reklama-${l}.jpg`); v.load();
      if (playing) v.play().catch(() => {});
    }
    if (dl) { dl.href = file; dl.textContent = `pillar-reklama-${l}.mp4`; }
    if (remember) { picked = l; try { localStorage.setItem(KEY, l); } catch {} }
  }
  const siteLang = () => (window.UstunI18n && UstunI18n.lang) || "uz";
  tabs.forEach(b => b.addEventListener("click", () => show(b.dataset.l, true)));
  show(picked || siteLang());
  window.addEventListener("ustun-til", e => { if (!picked) show((e.detail && e.detail.lang) || siteLang()); });   // sayt tili o'zgarsa (tanlanmagan bo'lsa)
})();
