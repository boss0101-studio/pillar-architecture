// Bosh sahifa: jonli chizma doskasi (namunaviy fasadlar almashib turadi) va tanlangan mahsulotlar.
(function () {
  const $ = id => document.getElementById(id);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const f1 = v => (Math.round(v * 10) / 10).toLocaleString("ru-RU");
  const nf = v => Math.round(v).toLocaleString("ru-RU");
  const ROOF = { tekis: "Tekis", nishab: "Nishab", bir: "Bir nishabli", piramida: "Piramida", gumbaz: "Gumbaz", terrasa: "Terrasa" };
  // Bosh sahifa chizmalari uchun bino parametrlari (faqat rasm — konstruktorda andoza emas)
  const SAMPLE = {
    jamoat: { params: { category: "jamoat", floors: 2, bays: 7, floor_h: 4.2, bay_w: 4.0, depth: 16, roof: "gumbaz", material: "ganch", window: "arkali", ground: "arkada" }, cells: {} },
    hovli: { params: { category: "turar-joy", floors: 2, bays: 4, floor_h: 3.2, bay_w: 4.5, depth: 12, roof: "nishab", material: "gisht", window: "oddiy", ground: "oddiy" }, cells: { "1,1": "balc", "1,2": "balc" } },
    ofis: { params: { category: "tijorat", floors: 6, bays: 8, floor_h: 3.6, bay_w: 4.5, depth: 18, roof: "terrasa", material: "travertin", window: "panorama", ground: "vitrina" }, cells: {} },
  };

  // ---------- Jonli chizma doskasi ----------
  const SHOW = [{ key: "jamoat", name: "Mahalla markazi" }, { key: "hovli", name: "Hovli uy" }, { key: "ofis", name: "Ofis bloki" }];
  const board = $("heroBoard"), sheet = $("heroSheet");
  if (board && sheet && typeof renderFacade === "function") {
    let i = 0;
    const draw = () => {
      const s = SHOW[i % SHOW.length], t = SAMPLE[s.key], p = { ...DEFAULT_PARAMS, ...t.params }, g = geometry(p);
      const geo = typeof Geo !== "undefined" ? { axes: true, diag: false, golden: false, angles: true } : null;
      sheet.innerHTML = renderFacade(p, t.cells, { dims: true, geo, uid: "hero" + (i % SHOW.length) });
      $("tbName").textContent = s.name;
      $("tbSize").textContent = `${f1(g.W)} × ${f1(g.D)} × ${f1(g.H)}`;
      $("tbRoof").textContent = `${ROOF[p.roof] || p.roof}, ${p.floors} qavat`;
      $("tbSheet").textContent = `VARAQ A-0${(i % SHOW.length) + 1} · OLD FASAD`;
      board.classList.remove("drawing"); void board.offsetWidth; board.classList.add("drawing");   // chizilish animatsiyasi
      i++;
    };
    draw();
    if (!reduce) setInterval(() => { if (!document.hidden && board.getClientRects().length) draw(); }, 7000);
  }

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

// ---------- Imkoniyatlar mozaikasi, raqamlar, doska og'ishi ----------
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // 01-kartochka: jonli fasad chizmasi (konstruktordagi bilan bir xil chizuvchi)
  const bf = document.getElementById("bentoFacade");
  if (bf && typeof renderFacade === "function") {
    const p = { ...DEFAULT_PARAMS, category: "jamoat", floors: 2, bays: 7, floor_h: 4.2, bay_w: 4.0, depth: 16, roof: "gumbaz", material: "ganch", window: "arkali", ground: "arkada" }, t = { cells: {} };
    bf.innerHTML = renderFacade(p, t.cells, { uid: "bento", dims: true });
  }
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
  // Chizma doskasi sichqonchaga qarab biroz og'adi (faqat sichqonchali qurilmalarda)
  const hero = document.querySelector(".hero2"), board = document.getElementById("heroBoard");
  if (hero && board && !reduce && matchMedia("(pointer: fine)").matches) {
    let raf = 0;
    hero.addEventListener("pointermove", e => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        board.style.transform = `perspective(1400px) rotateY(${(x * 7).toFixed(2)}deg) rotateX(${(-y * 5).toFixed(2)}deg)`;
      });
    });
    hero.addEventListener("pointerleave", () => { board.style.transform = ""; });
  }
})();
