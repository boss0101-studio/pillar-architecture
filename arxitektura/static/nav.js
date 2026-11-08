// Menyu tugmasi (gamburger): tor ekranda havolalar to'liq ekranli menyuda ochiladi.
// Bosh sahifadagi foto ustida menyu shaffof turadi, fotodan o'tgach odatiy fonga qaytadi.
(function () {
  const nav = document.querySelector(".nav"); if (!nav) return;
  const wrap = nav.querySelector(".wrap"), ul = nav.querySelector("ul"); if (!wrap || !ul) return;
  const root = document.documentElement;
  ul.id = ul.id || "navMenu";
  const b = document.createElement("button");
  b.type = "button"; b.className = "nav-burger";
  b.setAttribute("aria-controls", ul.id); b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-label", "Menyu");
  b.innerHTML = '<i aria-hidden="true"></i>';
  wrap.appendChild(b); nav.classList.add("has-burger");
  const set = open => {
    root.classList.toggle("menu-open", open); b.setAttribute("aria-expanded", String(open));
    if (open) { const f = ul.querySelector("a, button"); if (f) f.focus(); }
  };
  b.addEventListener("click", () => set(!root.classList.contains("menu-open")));
  ul.addEventListener("click", e => { if (e.target.closest("a, button")) set(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && root.classList.contains("menu-open")) { set(false); b.focus(); } });
  matchMedia("(min-width: 1100px)").addEventListener("change", e => { if (e.matches) set(false); });

  // Menyu balandligi — foto shu qadar yuqoriga, menyu ostiga suriladi
  const navH = () => root.style.setProperty("--nav-h", nav.offsetHeight + "px");
  navH(); if ("ResizeObserver" in window) new ResizeObserver(navH).observe(nav);
  addEventListener("resize", navH);
  const hero = document.getElementById("phero");
  if (hero) {
    const upd = () => nav.classList.toggle("nav-over", hero.getClientRects().length > 0 && hero.getBoundingClientRect().bottom > nav.offsetHeight + 30);
    upd();
    addEventListener("scroll", upd, { passive: true });
    addEventListener("hashchange", upd);
    document.addEventListener("click", () => setTimeout(upd, 0));   // bo'lim almashganda (foto yashiriladi yoki qaytadi)
  }
})();
