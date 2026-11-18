// Bosh sahifa: tanlangan mahsulotlar (foto slayd-shou — hero.js).
(function () {
  const $ = id => document.getElementById(id);
  const nf = v => Math.round(v).toLocaleString("ru-RU");

  // ---------- Tanlangan mahsulotlar ----------
  const feat = $("homeProducts");
  if (feat && typeof Shop !== "undefined") Shop.onReady(() => {
    const by = Shop.byId(), shopView = !!$("mahsulotlar");
    const ids = ["mat-travertin", "mat-koshin", "el-lattice", "roof-dome", "srv-3d"].filter(id => by[id]);
    feat.innerHTML = ids.length ? ids.map(id => {
      const p = by[id];
      return `<a class="fcard" href="${shopView ? "#mahsulotlar" : "shop.html"}"${shopView ? ' data-view="mahsulotlar"' : ""}>
        <div class="pvis">${Shop.visual(p)}</div>
        <div class="fbody"><span class="label">${esc(Shop.CATS[p.cat] || p.cat)}</span><b>${esc(p.name)}</b><span class="pprice">$${nf(p.price)}<small> / ${esc(p.unit)}</small></span></div>
      </a>`;
    }).join("") : `<p class="empty">Katalog hozircha bo'sh.</p>`;
  });
})();

// ---------- Imkoniyatlar mozaikasi va raqamlar ----------
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // 01-kartochka: zamonaviy villa fotosurati (index.html, fon/bento-uy.jpg — Unsplash)
  // Ko'ringanda: devor chizilishi va raqamlar sanalishi bir marta ishlaydi
  const fmt = (v, d) => v.toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });
  function count(el) {
    const end = Number(el.dataset.count), d = Number(el.dataset.dec || 0), t0 = performance.now(), dur = 1300;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(end * e, d); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const tiles = document.querySelectorAll(".bento-t");
  if (!reduce && "IntersectionObserver" in window && tiles.length) {
    document.documentElement.classList.add("bento-anim");
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in"); io.unobserve(e.target);
      e.target.querySelectorAll("[data-count]").forEach(count);
    }), { threshold: 0.35 });
    tiles.forEach(t => io.observe(t));
  }
})();
