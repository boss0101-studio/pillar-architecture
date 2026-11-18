// Logotip ("Peshtoq", brend/yaratish.py — ixcham variant): sahifadagi har bir .brand yozuvi logoga almashtiriladi.
// Belgi rangi --logo (style.css: och/to'q mavzu, foto ustida oq), yozuv — joriy matn rangi. Qo'shimcha so'z ("admin") saqlanadi.
(function () {
  const LOGO = '<svg class="brand-logo" viewBox="0 0 171.5 64" aria-hidden="true" focusable="false"><g style="fill:var(--logo,#11766f)"><path fill-rule="evenodd" d="M10 10H54V58H10Z M22 58V33C22 24.5 27 19 32 14C37 19 42 24.5 42 33V58Z"/><rect x="10" y="4" width="6" height="7"/><rect x="48" y="4" width="6" height="7"/></g><g fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="butt" stroke-linejoin="miter" transform="translate(80.00 15.00)"><path transform="translate(0.00 0)" d="M2 8V34M11 8a9 9 0 1 1 0 18a9 9 0 1 1 0-18"/><path transform="translate(24.50 0)" d="M2 8v18M2 0.5v4.5"/><path transform="translate(33.00 0)" d="M2 0v26"/><path transform="translate(41.50 0)" d="M2 0v26"/><path transform="translate(50.00 0)" d="M9 8a9 9 0 1 0 0 18a9 9 0 1 0 0-18M18 8v18"/><path transform="translate(74.50 0)" d="M2 8v18M2 17a9 9 0 0 1 9-9h2.5"/></g></svg>';
  document.querySelectorAll("a.brand").forEach(a => {
    const extra = a.textContent.replace(/^\s*Pillar\.?\s*/i, "").trim();
    a.innerHTML = LOGO + (extra ? `<span class="brand-extra">${extra.replace(/[&<>"]/g, "")}</span>` : "");
    a.setAttribute("aria-label", "Pillar Architecture" + (extra ? " — " + extra : ""));
    a.setAttribute("translate", "no");
  });
})();

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
  // bo'lim havolalari — fotosuratli kartochka; yordam, til va kirish tugmalari — kichik qatorda (keyin qo'shilganlari ham)
  const mark = () => ul.querySelectorAll(":scope > li").forEach(li => li.classList.toggle("nav-tile", !!li.querySelector(":scope > a") && !li.classList.contains("nav-user")));
  mark(); new MutationObserver(mark).observe(ul, { childList: true });
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
