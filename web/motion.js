// Animatsiyalarning JS qismi: raqamlar sanog'i va "bino qurilishi" effekti.
// Hammasi ixtiyoriy: skript ishlamasa ham sahifa to'liq va o'qiladigan holda ko'rinadi.
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { window.playBuild = function () {}; return; }

  // 1) Statistika raqamlari noldan sanab chiqadi
  const stats = document.getElementById("stats");
  if (stats) {
    const fmt = n => n.toLocaleString("ru-RU");
    const obs = new MutationObserver(records => {
      const els = new Set(records.map(r => (r.target.nodeType === 1 ? r.target : r.target.parentElement)).filter(el => el && el.matches("b")));
      els.forEach(el => countUp(el, el.textContent.trim()));
    });
    function countUp(el, finalText) {
      const target = parseInt(finalText.replace(/\D/g, ""), 10);
      if (!Number.isFinite(target) || target < 2) return;     // "—" yoki 0/1 uchun sanash kerak emas
      const t0 = performance.now(), dur = 1100;
      const tick = now => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = k < 1 ? fmt(Math.round(target * e)) : finalText;
        obs.takeRecords();                                     // o'z yozuvimiz kuzatuvchini qayta ishga tushirmasin
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    obs.observe(stats, { childList: true, subtree: true });
  }

  // 2) Konstruktor: fasad va 3D ko'rinish pastdan yuqoriga "quriladi"
  let timer;
  window.playBuild = function () {
    const els = ["facade", "iso"].map(id => document.getElementById(id)).filter(Boolean);
    els.forEach(el => el.classList.remove("pop"));
    void document.body.offsetWidth;                            // animatsiyani boshidan boshlash uchun
    els.forEach(el => el.classList.add("pop"));
    if (window.View3D) window.View3D.rise();
    clearTimeout(timer);
    timer = setTimeout(() => els.forEach(el => el.classList.remove("pop")), 1400);
  };
})();
