// Bosh sahifadagi reklama videosi: saytning 17 tilida. Video sayt tiliga ergashadi (til o'zgarsa — video ham o'zgaradi);
// alohida til tugmalari yo'q (foydalanuvchi talabi). Videoni, muqovani va yuklab olish havolasini almashtiradi.
(function () {
  const box = document.getElementById("video"); if (!box) return;
  const v = box.querySelector("video"), src = v && v.querySelector("source"), dl = box.querySelector(".pv-dl a");
  if (!v || !src) return;
  // video/pillar-reklama-<til>.mp4 bor tillar (video-vositalari/generator.html bilan yasalgan)
  const HAS = ["ar", "zh", "en", "fr", "de", "hi", "it", "ja", "kk", "ko", "ky", "pt", "ru", "es", "tg", "tr", "uz"];
  const siteLang = () => (window.UstunI18n && window.UstunI18n.lang) || "uz";
  function show(l) {
    if (!HAS.includes(l)) l = "en";
    const file = `video/pillar-reklama-${l}.mp4`;
    if (src.getAttribute("src") !== file) {
      const playing = !v.paused; src.setAttribute("src", file); v.setAttribute("poster", `video/pillar-reklama-${l}.jpg`); v.load();
      if (playing) v.play().catch(() => {});
    }
    if (dl) { dl.href = file; dl.textContent = `pillar-reklama-${l}.mp4`; }
  }
  // Video fayli topilmasa (hali yasalmagan yoki yuklanmagan) — inglizchasi ko'rsatiladi, pleer bo'sh qolmaydi
  src.addEventListener("error", () => { if (!/-en\.mp4$/.test(src.getAttribute("src") || "")) show("en"); });
  show(siteLang());
  window.addEventListener("ustun-til", e => show((e.detail && e.detail.lang) || siteLang()));   // sayt tili o'zgarsa — video ham o'sha tilda
})();
