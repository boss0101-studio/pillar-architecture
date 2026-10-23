// Mahsulotlar katalogi, savat va buyurtma.
// Python versiyasida katalog va buyurtmalar /api orqali ishlaydi; server bo'lmasa (brauzer versiyasi)
// katalog products.json faylidan o'qiladi, buyurtma esa shu brauzerga saqlanadi.
const Shop = (function () {
  const CART_KEY = "ustun-cart", ORDERS_KEY = "ustun-orders";
  const CATS = { material: "Fasad materiallari", element: "Deraza va eshiklar", tom: "Tom va yopma", qurilish: "Qurilish materiallari",
    ichki: "Ichki pardoz", muhandislik: "Muhandislik tizimlari", hovli: "Hovli va obodonlashtirish", xizmat: "Xizmatlar" };
  const nf = n => Math.round(n).toLocaleString("ru-RU");
  const pf = n => (n < 10 && n % 1 ? n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : nf(n));   // g'isht $0,18 — 0 bo'lib qolmasin
  const $ = id => document.getElementById(id);
  const escH = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let products = [], byId = {}, cart = {}, backend = false, loaded = false, cat = "";
  const ready = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY) || "{}") || {}; } catch { cart = {}; }
  const save = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} };

  // Brauzer versiyasi (serversiz) o'zini <meta name="ustun-mode" content="static"> bilan belgilaydi: API so'ralmaydi
  const staticMode = !!document.querySelector('meta[name="ustun-mode"][content="static"]');
  async function load() {
    try {
      if (staticMode) throw new Error("serversiz rejim");
      const r = await fetch("/api/products", { headers: { Accept: "application/json" } });
      if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error("backend yo'q");
      products = await r.json(); backend = true;
    } catch {
      try { products = await (await fetch("products.json")).json(); } catch { products = []; }
    }
    products = (Array.isArray(products) ? products : []).filter(p => p && p.id && Number.isFinite(Number(p.price))).map(p => ({ ...p, price: Number(p.price) }));
    byId = Object.fromEntries(products.map(p => [p.id, p]));
    Object.keys(cart).forEach(id => { if (!byId[id] || !(cart[id] > 0)) delete cart[id]; });   // katalogda yo'q mahsulotlar savatdan chiqadi
    save();
    if (typeof Geo !== "undefined") Geo.catalog = byId;
    loaded = true;
    badge(); renderShop(); renderCart();
    ready.splice(0).forEach(fn => fn());
  }

  // ---------- Savat ----------
  const clampQ = q => Math.min(1e6, Math.max(0, Math.round(Number(q) * 100) / 100));
  function add(id, qty = 1) { addMany([[id, qty]]); }
  function addMany(pairs) {
    pairs.forEach(([id, q]) => { if (byId[id] && q > 0) cart[id] = clampQ((cart[id] || 0) + Number(q)); });
    save(); badge(); renderCart();
  }
  function setQty(id, q) {
    q = clampQ(q);
    if (q <= 0) delete cart[id]; else cart[id] = q;
    save(); badge(); renderCart();
  }
  const items = () => Object.entries(cart).filter(([id]) => byId[id]).map(([id, qty]) => ({ ...byId[id], qty, sum: qty * byId[id].price }));
  const total = () => items().reduce((s, i) => s + i.sum, 0);
  function badge() {
    const n = Object.keys(cart).length;
    document.querySelectorAll("[data-cart-count]").forEach(b => { b.textContent = n; b.hidden = n === 0; });
  }

  // ---------- Ko'rinishlar ----------
  // Yangi mahsulotlar uchun kichik chizma-belgilar (120×80). Rang: chiziq #1f2326, aksent #2b4acb, g'isht #b5683f.
  const K = 'stroke="#1f2326" stroke-width="2"', A = "#2b4acb", B = "#b5683f", W = "#f7f8f7";
  const brickRows = (x, y, w, h, n) => Array.from({ length: n }, (_, r) => `<path d="M${x} ${y + (r + 1) * h / n}H${x + w}" ${K}/>` +
    Array.from({ length: 4 }, (_, c) => `<path d="M${x + (c + (r % 2 ? 0.5 : 0)) * w / 4 + w / 8} ${y + r * h / n}v${h / n}" ${K}/>`).join("")).join("");
  const ICONS = {
    panel: `<rect x="20" y="12" width="38" height="56" fill="#bfc3c0" ${K}/><rect x="62" y="12" width="38" height="56" fill="#aeb3b0" ${K}/>`,
    plaster: `<rect x="16" y="12" width="88" height="56" fill="#e8dcc4" ${K}/><path d="M24 24q8-4 16 0t16 0 16 0 16 0M24 40q8-4 16 0t16 0 16 0 16 0M24 56q8-4 16 0t16 0 16 0 16 0" fill="none" stroke="#b9a983" stroke-width="2"/>`,
    brick: `<rect x="16" y="14" width="88" height="52" fill="${B}" ${K}/>${brickRows(16, 14, 88, 52, 4)}`,
    glass: `<rect x="18" y="10" width="84" height="60" fill="#9fc0dc" ${K}/><path d="M46 10v60M74 10v60M18 40h84" ${K}/><path d="M26 18l14 14M54 18l14 14" stroke="${W}" stroke-width="3"/>`,
    skylight: `<polygon points="10,62 60,22 110,62" fill="#6a5047" ${K}/><polygon points="48,40 66,26 78,36 60,50" fill="#9fc0dc" ${K}/>`,
    glassdoor: `<rect x="38" y="8" width="44" height="66" fill="#9fc0dc" ${K}/><path d="M60 8v66" ${K}/><path d="M55 38v10M65 38v10" stroke="#1f2326" stroke-width="3"/>`,
    garage: `<rect x="18" y="14" width="84" height="58" fill="#c9cdc9" ${K}/>${[0, 1, 2, 3, 4].map(i => `<path d="M22 ${24 + i * 10}h76" ${K}/>`).join("")}`,
    roller: `<rect x="30" y="10" width="60" height="12" fill="#8e99a2" ${K}/><rect x="34" y="22" width="52" height="46" fill="#c9cdc9" ${K}/>${[0, 1, 2, 3].map(i => `<path d="M34 ${32 + i * 9}h52" stroke="#8e99a2" stroke-width="2"/>`).join("")}`,
    sill: `<rect x="34" y="10" width="52" height="44" fill="#9fc0dc" ${K}/><rect x="24" y="54" width="72" height="8" fill="${W}" ${K}/>`,
    canopy: `<rect x="44" y="34" width="32" height="40" fill="${W}" ${K}/><polygon points="30,30 90,30 84,22 36,22" fill="#9fc0dc" ${K}/>`,
    block: `<rect x="20" y="22" width="80" height="40" fill="#e6e3dc" ${K}/><path d="M20 22l10-10h80l-10 10M100 62l10-10V12" fill="#d4d0c6" ${K}/>`,
    bag: `<path d="M34 16h52l6 54H28z" fill="#cfc4a6" ${K}/><path d="M34 16l6-6h40l6 6" fill="none" ${K}/><text x="60" y="50" text-anchor="middle" font-size="14" font-weight="700" fill="#1f2326">50kg</text>`,
    pile: `<path d="M12 68Q60 4 108 68z" fill="#c9b48a" ${K}/><circle cx="48" cy="52" r="3" fill="#8c7a58"/><circle cx="68" cy="44" r="3" fill="#8c7a58"/><circle cx="74" cy="58" r="3" fill="#8c7a58"/>`,
    mixer: `<rect x="12" y="44" width="30" height="20" fill="${A}" ${K}/><ellipse cx="74" cy="40" rx="30" ry="18" fill="#c9cdc9" ${K}/><path d="M44 54h62" ${K}/><circle cx="28" cy="66" r="6" fill="#1f2326"/><circle cx="90" cy="66" r="6" fill="#1f2326"/>`,
    rebar: `${[0, 1, 2, 3].map(i => `<path d="M14 ${24 + i * 11}h92" stroke="#6b5a4a" stroke-width="5"/><path d="M${20 + i * 3} ${21 + i * 11}l4 6M${40 + i * 3} ${21 + i * 11}l4 6M${60 + i * 3} ${21 + i * 11}l4 6M${80 + i * 3} ${21 + i * 11}l4 6" stroke="#1f2326" stroke-width="1.5"/>`).join("")}`,
    insul: `<rect x="16" y="20" width="88" height="40" fill="#e8c86a" ${K}/><path d="M16 30q11 10 22 0t22 0 22 0 22 0M16 48q11 10 22 0t22 0 22 0 22 0" fill="none" stroke="#b8962e" stroke-width="2"/>`,
    roll: `<rect x="30" y="20" width="70" height="40" fill="#3a3f44" ${K}/><ellipse cx="30" cy="40" rx="12" ry="20" fill="#555b61" ${K}/><ellipse cx="30" cy="40" rx="4" ry="7" fill="#d9d4c8"/>`,
    floor: `<rect x="14" y="14" width="92" height="52" fill="#c49a6c" ${K}/>${[0, 1, 2, 3].map(i => `<path d="M14 ${27 + i * 13}h92" ${K}/><path d="M${30 + (i % 2) * 22} ${14 + i * 13}v13M${74 + (i % 2) * 14} ${14 + i * 13}v13" ${K}/>`).join("")}`,
    tile: `<rect x="20" y="10" width="80" height="60" fill="${W}" ${K}/><path d="M40 10v60M60 10v60M80 10v60M20 30h80M20 50h80" stroke="#8e99a2" stroke-width="2"/><rect x="40" y="30" width="20" height="20" fill="#9fc0dc"/>`,
    paint: `<path d="M34 24h44v42H34z" fill="${A}" ${K}/><ellipse cx="56" cy="24" rx="22" ry="6" fill="#4a64d8" ${K}/><path d="M78 30q16 0 16 16" fill="none" ${K}/><rect x="86" y="46" width="14" height="22" fill="#e8dcc4" ${K}/>`,
    board: `<rect x="22" y="10" width="76" height="60" fill="#ecebe6" ${K}/><path d="M22 40h76M60 10v60" stroke="#c4c2ba" stroke-width="2"/><circle cx="30" cy="18" r="2" fill="#1f2326"/><circle cx="90" cy="62" r="2" fill="#1f2326"/>`,
    ceiling: `<rect x="12" y="14" width="96" height="10" fill="${W}" ${K}/><path d="M24 24v8M60 24v8M96 24v8" ${K}/><circle cx="60" cy="40" r="7" fill="#f2d16b" ${K}/><path d="M60 47l-10 22M60 47l10 22" stroke="#f2d16b" stroke-width="2"/>`,
    door: `<rect x="40" y="8" width="40" height="66" fill="#c49a6c" ${K}/><rect x="46" y="16" width="28" height="22" fill="none" ${K}/><rect x="46" y="44" width="28" height="22" fill="none" ${K}/><circle cx="74" cy="42" r="2.5" fill="#1f2326"/>`,
    stair: `<path d="M14 70h18V58h18V46h18V34h18V22h20v48z" fill="#c49a6c" ${K}/><path d="M24 58l70-40" ${K}/>`,
    kitchen: `<rect x="14" y="36" width="92" height="34" fill="${W}" ${K}/><rect x="14" y="30" width="92" height="6" fill="#8e99a2" ${K}/><path d="M44 36v34M74 36v34" ${K}/><rect x="14" y="8" width="44" height="16" fill="${W}" ${K}/><circle cx="90" cy="18" r="6" fill="none" ${K}/>`,
    ornament: `<rect x="16" y="10" width="88" height="60" fill="#ece7dc" ${K}/><path d="M60 18l14 22-14 22-14-22zM32 40l14-14M88 40L74 26M32 40l14 14M88 40L74 54" fill="none" stroke="${A}" stroke-width="2"/><circle cx="60" cy="40" r="5" fill="${A}"/>`,
    wardrobe: `<rect x="22" y="8" width="76" height="64" fill="#d8c3a0" ${K}/><path d="M60 8v64" ${K}/><path d="M55 36v10M65 36v10" stroke="#1f2326" stroke-width="3"/>`,
    boiler: `<rect x="38" y="8" width="44" height="58" rx="4" fill="${W}" ${K}/><circle cx="60" cy="30" r="8" fill="none" ${K}/><path d="M60 24q-6 8 0 12 6-4 0-12" fill="#e2733c"/><path d="M48 66v8M60 66v8M72 66v8" ${K}/>`,
    radiator: `${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${18 + i * 14}" y="16" width="11" height="50" rx="4" fill="${W}" ${K}/>`).join("")}<path d="M14 24h92M14 58h92" ${K}/>`,
    floorheat: `<rect x="12" y="20" width="96" height="44" fill="#d8c3a0" ${K}/><path d="M20 28h76q6 0 6 7t-6 7H24q-6 0-6 7t6 7h80" fill="none" stroke="#e2733c" stroke-width="3"/>`,
    ac: `<rect x="14" y="20" width="92" height="28" rx="6" fill="${W}" ${K}/><path d="M22 40h76" ${K}/><path d="M34 56q4 6 0 12M60 56q4 6 0 12M86 56q4 6 0 12" fill="none" stroke="${A}" stroke-width="2"/>`,
    solar: `<polygon points="10,66 30,14 110,14 90,66" fill="#1f3c88" ${K}/>${[1, 2, 3].map(i => `<path d="M${10 + i * 20 + 0} 66L${30 + i * 20} 14" stroke="#9fc0dc" stroke-width="1.5"/>`).join("")}<path d="M20 40h80" stroke="#9fc0dc" stroke-width="1.5"/>`,
    inverter: `<rect x="34" y="10" width="52" height="60" rx="4" fill="${W}" ${K}/><rect x="42" y="18" width="36" height="16" fill="#2b4a3b"/><path d="M50 52l6-10h-6l6-10" fill="none" stroke="#e2b93c" stroke-width="3"/>`,
    faucet: `<path d="M30 30h40q12 0 12 12v6" fill="none" stroke="#8e99a2" stroke-width="7"/><rect x="40" y="20" width="12" height="12" fill="#8e99a2" ${K}/><path d="M82 56q-4 8 0 12 4-4 0-12" fill="#4a90d9"/><path d="M20 70h80" ${K}/>`,
    bolt: `<polygon points="66,8 34,46 56,46 48,74 86,32 62,32" fill="#e2b93c" ${K}/>`,
    bulb: `<circle cx="60" cy="32" r="18" fill="#f2d16b" ${K}/><rect x="52" y="50" width="16" height="14" fill="#8e99a2" ${K}/><path d="M60 6v4M34 32h-6M92 32h-6M40 12l3 3M80 12l-3 3" ${K}/>`,
    fan: `<circle cx="60" cy="40" r="28" fill="${W}" ${K}/><path d="M60 40q-4-20 8-20 0 14-8 20zM60 40q20-4 20 8-14 0-20-8zM60 40q4 20-8 20 0-14 8-20zM60 40q-20 4-20-8 14 0 20 8z" fill="${A}"/>`,
    pipe: `<path d="M10 30h50v30h50" fill="none" stroke="#8e99a2" stroke-width="10"/><path d="M10 30h50v30h50" fill="none" stroke="#1f2326" stroke-width="1"/>`,
    wall: `<rect x="10" y="22" width="100" height="44" fill="${B}" ${K}/>${brickRows(10, 22, 100, 44, 3)}<rect x="10" y="14" width="14" height="52" fill="#9b5634" ${K}/><rect x="96" y="14" width="14" height="52" fill="#9b5634" ${K}/>`,
    fence: `${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${18 + i * 14} 66V24l-3-6M${18 + i * 14} 24l3-6" stroke="#1f2326" stroke-width="3" fill="none"/>`).join("")}<path d="M12 34h96M12 58h96" stroke="#1f2326" stroke-width="3"/>`,
    gate: `<rect x="8" y="16" width="10" height="56" fill="#9b5634" ${K}/><rect x="102" y="16" width="10" height="56" fill="#9b5634" ${K}/><rect x="18" y="24" width="84" height="44" fill="#8e99a2" ${K}/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${30 + i * 12} 24v44" ${K}/>`).join("")}`,
    paving: `<rect x="10" y="14" width="100" height="52" fill="#b9b2a4" ${K}/>${[0, 1, 2, 3].map(r => `<path d="M10 ${27 + r * 13}h100" stroke="#8a8274" stroke-width="2"/>` + [0, 1, 2, 3].map(c => `<path d="M${22 + c * 25 + (r % 2) * 12} ${14 + r * 13}v13" stroke="#8a8274" stroke-width="2"/>`).join("")).join("")}`,
    grass: `<rect x="10" y="52" width="100" height="18" fill="#6d4c33"/><path d="M10 52h100" ${K}/>${Array.from({ length: 16 }, (_, i) => `<path d="M${14 + i * 6} 52l-3-14M${14 + i * 6} 52l3-12" stroke="#3f8f4a" stroke-width="2"/>`).join("")}`,
    tree: `<rect x="56" y="44" width="8" height="28" fill="#6d4c33"/><circle cx="60" cy="32" r="22" fill="#3f8f4a" ${K}/><circle cx="52" cy="28" r="3" fill="#e2733c"/><circle cx="68" cy="36" r="3" fill="#e2733c"/><circle cx="62" cy="22" r="3" fill="#e2733c"/>`,
    suri: `<rect x="18" y="34" width="84" height="10" fill="#c49a6c" ${K}/><path d="M22 44v24M98 44v24M22 34V20M98 34V20M22 22h76" ${K}/><path d="M26 30h68" stroke="#b5683f" stroke-width="5"/>`,
    ayvon: `<polygon points="10,20 60,8 110,20" fill="#6a5047" ${K}/><rect x="14" y="20" width="92" height="6" fill="#c49a6c" ${K}/>${[0, 1, 2, 3].map(i => `<rect x="${20 + i * 26}" y="26" width="6" height="44" fill="#c49a6c" ${K}/>`).join("")}`,
    pool: `<rect x="14" y="20" width="92" height="44" rx="6" fill="#d9d4c8" ${K}/><rect x="20" y="26" width="80" height="32" rx="4" fill="#4a90d9"/><path d="M26 38q7-5 14 0t14 0 14 0 14 0 12 0" fill="none" stroke="${W}" stroke-width="2"/>`,
    lamp: `<path d="M60 30v42" stroke="#1f2326" stroke-width="4"/><path d="M46 30h28l-6-14H52z" fill="#3a3f44" ${K}/><path d="M50 32l-8 14M70 32l8 14" stroke="#f2d16b" stroke-width="2"/><rect x="48" y="70" width="24" height="4" fill="#1f2326"/>`,
    drop: `<path d="M60 10q-24 30-24 40a24 24 0 0 0 48 0q0-10-24-40z" fill="#4a90d9" ${K}/><path d="M48 50q0 10 10 12" fill="none" stroke="${W}" stroke-width="3"/>`,
    pergola: `${[0, 1, 2].map(i => `<rect x="${16 + i * 40}" y="22" width="8" height="50" fill="#c49a6c" ${K}/>`).join("")}<path d="M10 22h100M10 30h100" stroke="#8a6a46" stroke-width="5"/><circle cx="40" cy="38" r="5" fill="#6a3f8c"/><circle cx="46" cy="44" r="5" fill="#6a3f8c"/><circle cx="82" cy="40" r="5" fill="#3f8f4a"/>`,
  };
  function visual(p) {
    if (p.icon && ICONS[p.icon]) return `<svg viewBox="0 0 120 80" aria-hidden="true"><rect width="120" height="80" fill="#d9d4c8"/>${ICONS[p.icon]}</svg>`;
    if (p.draw && typeof drawCell === "function") return `<svg viewBox="0 0 120 80" aria-hidden="true"><rect width="120" height="80" fill="#d9d4c8"/>${drawCell(p.draw, 30, 2, 60, 76)}</svg>`;
    if (p.mat && typeof MATERIALS !== "undefined" && MATERIALS[p.mat]) {
      const m = MATERIALS[p.mat], uid = "sw-" + p.id;
      const pat = m.pattern && typeof patternDef === "function" ? patternDef(uid, m.pattern, 40) : "";
      return `<svg viewBox="0 0 120 80" aria-hidden="true"><defs>${pat}</defs><rect width="120" height="80" fill="${m.fill}"/>${pat ? `<rect width="120" height="80" fill="url(#${uid}-pat)"/>` : ""}</svg>`;
    }
    if (p.cell && typeof drawCell === "function") {
      return `<svg viewBox="0 0 120 80" aria-hidden="true"><rect width="120" height="80" fill="#d9d4c8"/>${drawCell(p.cell, 30, 2, 60, 76)}</svg>`;
    }
    if (p.cat === "tom") {
      return `<svg viewBox="0 0 120 80" aria-hidden="true"><rect width="120" height="80" fill="#d9d4c8"/><polygon points="14,52 60,16 106,52" fill="#6a5047" stroke="#1f2326" stroke-width="2"/><rect x="24" y="52" width="72" height="22" fill="#b5683f" stroke="#1f2326" stroke-width="2"/></svg>`;
    }
    return `<svg viewBox="0 0 120 80" aria-hidden="true"><rect width="120" height="80" fill="#d9d4c8"/><rect x="40" y="10" width="40" height="58" fill="#f7f8f7" stroke="#1f2326" stroke-width="2"/><path d="M47 24h26M47 32h26M47 40h18" stroke="#2b4acb" stroke-width="3"/><circle cx="74" cy="58" r="9" fill="#2b4acb"/></svg>`;
  }

  function renderShop() {
    const grid = $("shopGrid"), filt = $("shopFilters");
    if (!grid) return;
    if (filt && !filt.children.length) {
      filt.innerHTML = [["", "Barchasi"], ...Object.entries(CATS)].map(([k, v]) => `<button type="button" data-cat="${k}" aria-pressed="${k === cat}">${v}</button>`).join("");
    }
    if (filt) filt.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === cat)));
    const list = products.filter(p => !cat || p.cat === cat);
    if (!loaded) { grid.innerHTML = `<p class="empty">Katalog yuklanmoqda…</p>`; return; }
    if (!list.length) { grid.innerHTML = `<p class="empty">Bu bo'limda mahsulot yo'q.</p>`; return; }
    grid.innerHTML = list.map(p => `
      <article class="pcard">
        <div class="pvis">${visual(p)}</div>
        <div class="pbody">
          <span class="label">${escH(CATS[p.cat] || p.cat)}</span>
          <h3>${escH(p.name)}</h3>
          <p class="muted">${escH(p.desc || "")}</p>
          <div class="pfoot">
            <b class="pprice">$${pf(p.price)}<small> / <span>${escH(p.unit)}</span></small></b>
            <div class="padd">
              <input type="number" min="1" step="1" value="1" data-qty="${escH(p.id)}" aria-label="${escH(p.name)}: miqdor">
              <button type="button" class="btn" data-add="${escH(p.id)}">Savatga</button>
            </div>
          </div>
        </div>
      </article>`).join("");
  }

  function renderCart() {
    const list = $("cartList");
    if (!list) return;
    const its = items();
    list.innerHTML = its.length ? its.map(i => `
      <li>
        <div class="cname"><b>${escH(i.name)}</b><span class="muted">$${pf(i.price)} / <span>${escH(i.unit)}</span></span></div>
        <div class="cq">
          <button type="button" data-cdec="${escH(i.id)}" aria-label="Kamaytirish">−</button>
          <input type="number" min="0" step="1" value="${i.qty}" data-cset="${escH(i.id)}" aria-label="${escH(i.name)}: miqdor">
          <button type="button" data-cinc="${escH(i.id)}" aria-label="Ko'paytirish">+</button>
        </div>
        <b class="csum">$${nf(i.sum)}</b>
        <button type="button" class="cdel" data-cdel="${escH(i.id)}" aria-label="${escH(i.name)}: savatdan olib tashlash">×</button>
      </li>`).join("") : `<li class="empty">Savat bo'sh. Mahsulot qo'shing yoki konstruktordagi smetani "Savatga qo'shish" bilan yuboring.</li>`;
    if ($("cartTotal")) $("cartTotal").textContent = `$${nf(total())}`;
    const btn = document.querySelector("#orderForm button[type=submit]");
    if (btn) btn.disabled = !its.length;
  }

  // ---------- Buyurtma ----------
  async function sendOrder(name, phone, note) {
    const payload = { name, phone, note, items: items().map(i => ({ id: i.id, qty: i.qty })) };
    if (backend) {
      const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Buyurtmani yuborib bo'lmadi.");
      return { id: d.id, total: d.total, local: false };
    }
    let list = [];
    try { list = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); } catch {}
    const order = { ...payload, id: list.length + 1, total: total(), at: new Date().toISOString() };
    list.push(order);
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify(list)); } catch { throw new Error("Brauzer xotirasiga yozib bo'lmadi."); }
    return { id: order.id, total: order.total, local: true };
  }

  // ---------- Hodisalar (bir marta ulanadi) ----------
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-cat],[data-add],[data-cinc],[data-cdec],[data-cdel]");
    if (!t) return;
    if (t.dataset.cat !== undefined && t.closest("#shopFilters")) { cat = t.dataset.cat; renderShop(); return; }
    if (t.dataset.add) {
      const inp = document.querySelector(`[data-qty="${CSS.escape(t.dataset.add)}"]`);
      add(t.dataset.add, Math.max(1, Number(inp && inp.value) || 1));
      t.textContent = "Qo'shildi ✓"; setTimeout(() => { if (t.isConnected) t.textContent = "Savatga"; }, 1200);
      return;
    }
    if (t.dataset.cinc) setQty(t.dataset.cinc, (cart[t.dataset.cinc] || 0) + 1);
    if (t.dataset.cdec) setQty(t.dataset.cdec, (cart[t.dataset.cdec] || 0) - 1);
    if (t.dataset.cdel) setQty(t.dataset.cdel, 0);
  });
  document.addEventListener("change", e => {
    const t = e.target.closest("[data-cset]");
    if (t) setQty(t.dataset.cset, t.value);
  });
  const form = $("orderForm");
  if (form) form.addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $("orderMsg"), btn = form.querySelector("button[type=submit]");
    const name = $("oName").value.trim(), phone = $("oPhone").value.trim(), note = ($("oNote") || { value: "" }).value.trim();
    if (name.length < 2 || !/^[+\d\s()-]{7,30}$/.test(phone)) { msg.textContent = "Ism va to'g'ri telefon raqamini kiriting."; msg.className = "msg bad"; return; }
    if (!items().length) { msg.textContent = "Savat bo'sh."; msg.className = "msg bad"; return; }
    btn.disabled = true;
    try {
      const r = await sendOrder(name, phone, note);
      cart = {}; save(); badge(); renderCart(); form.reset();
      msg.textContent = r.local
        ? `Buyurtma №${r.id} ($${nf(r.total)}) shu brauzerga saqlandi. Bu namunaviy sahifa: buyurtmani telefon orqali tasdiqlang.`
        : `Buyurtma №${r.id} qabul qilindi: $${nf(r.total)}. Menejer siz bilan bog'lanadi.`;
      msg.className = "msg ok";
    } catch (err) {
      msg.textContent = err.message; msg.className = "msg bad";
    } finally { btn.disabled = !items().length; }
  });

  const S = { CATS, visual, load, add, addMany, setQty, items, total, renderShop, products: () => products, byId: () => byId, onReady(fn) { if (loaded) fn(); else ready.push(fn); } };
  load();
  return S;
})();
