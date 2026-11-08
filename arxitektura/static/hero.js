// Bosh sahifa: to'liq ekranli foto slayd-shou (Unsplash, bepul litsenziya). Avtomatik o'tish progress chizig'i tugaganda bo'ladi;
// sichqoncha ustida yoki fokusda to'xtaydi, "kamroq harakat" sozlamasida faqat qo'lda almashtiriladi.
(function () {
  const hero = document.getElementById("phero"); if (!hero) return;
  const slides = [...hero.querySelectorAll(".phero-slide")], txts = [...hero.querySelectorAll(".phero-txt")], creds = [...hero.querySelectorAll(".phero-credit")];
  const no = hero.querySelector(".phero-no b"), bar = hero.querySelector(".phero-bar i");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const n = slides.length; let cur = 0;
  const load = i => { const s = slides[i % n]; if (s && !s.style.backgroundImage) s.style.backgroundImage = `url("${s.dataset.img}")`; };   // rasm kerak bo'lganda yuklanadi
  function show(i) {
    cur = (i + n) % n;
    load(cur); load(cur + 1);
    [slides, txts, creds].forEach(list => list.forEach((el, k) => { el.classList.toggle("is-on", k === cur); el.toggleAttribute("aria-hidden", k !== cur); }));
    no.textContent = String(cur + 1).padStart(2, "0");
    if (bar && !reduce) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; }   // progress qaytadan boshlanadi
  }
  if (bar && !reduce) bar.addEventListener("animationend", () => show(cur + 1));
  hero.querySelector(".phero-prev").addEventListener("click", () => show(cur - 1));
  hero.querySelector(".phero-next").addEventListener("click", () => show(cur + 1));
  hero.addEventListener("keydown", e => {
    if (e.target.closest("a")) return;
    if (e.key === "ArrowRight") show(cur + 1); else if (e.key === "ArrowLeft") show(cur - 1);
  });
  // Barmoq bilan surish (telefon)
  let x0 = null;
  hero.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); });
  if (reduce) hero.classList.add("phero-still");
  show(0);
})();
