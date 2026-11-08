// Google orqali kirish: saytga kirganda taklif qilinadi, xizmatdan (Konstruktor, Erkin qurish, Galereya,
// Mahsulotlar, AI yordamchi) foydalanmoqchi bo'lganda esa talab qilinadi. Bosh sahifa va Sozlamalar ochiq.
// Egasidan hech qachon so'ralmaydi: 1) localhost (o'z kompyuteri), 2) Claude artifaktida egasi (user.isOwner),
// 3) maxfiy egasi havolasi (#owner=...) bir marta ochilgan brauzer. Kodda faqat kalitning SHA-256 xeshi turadi.
// GOOGLE_CLIENT_ID bo'sh bo'lsa — kirish o'chiq, sayt avvalgidek ochiq ishlaydi.
// Diqqat: bu statik saytdagi "eshik" — Google hisobi bilan kirganni tanib oladi, lekin brauzerda ishlagani uchun
// haqiqiy himoya emas (serverdagi ma'lumot uchun serverda ham tekshirish kerak).
const UstunAuth = (function () {
  const GOOGLE_CLIENT_ID = "";                                         // Google Cloud Console → Credentials → OAuth client ID (Web)
  const OWNER_HASH = "b7b4b210c2cf73e00342778cd3ba17e7ca49daac50cd601b4f3254b8452f2df4";
  const KEY = "ustun-auth", OWNER_KEY = "ustun-owner", LATER = "ustun-auth-later";
  const GATED = ["konstruktor", "erkin", "qogoz", "gp", "ar", "galereya", "mahsulotlar"];
  const PAGE_VIEW = { "designer.html": "konstruktor", "builder.html": "erkin", "gp.html": "gp", "ar.html": "ar", "paper.html": "qogoz", "shop.html": "mahsulotlar" };
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const inArtifact = !!(window.claude && typeof window.claude.use === "function");
  let user = null, owner = local || inArtifact, ready = false;
  try { user = JSON.parse(localStorage.getItem(KEY) || "null"); if (user && user.exp && user.exp * 1000 < Date.now() - 30 * 864e5) user = null; } catch {}
  try { if (localStorage.getItem(OWNER_KEY) === OWNER_HASH) owner = true; } catch {}
  const enabled = () => !!GOOGLE_CLIENT_ID && !inArtifact;            // artifaktda tomoshabin claude.ai hisobi bilan kirgan bo'ladi
  const signedIn = () => owner || !!user || !enabled();

  // ---------- Egasi havolasi: #owner=KALIT — xesh mos kelsa, shu brauzer egasiniki deb eslab qolinadi ----------
  async function checkOwnerLink() {
    const m = /[#&]owner=([\w-]+)/.exec(location.hash); if (!m || !crypto.subtle) return;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(m[1]));
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    history.replaceState(null, "", location.pathname + location.search);   // kalit manzil satrida qolmasin
    if (hex === OWNER_HASH) { owner = true; try { localStorage.setItem(OWNER_KEY, hex); } catch {} close(); navUser(); }
  }

  // ---------- Google Identity Services ----------
  let gisLoading = null;
  function loadGis() {
    if (window.google && google.accounts && google.accounts.id) return Promise.resolve();
    return gisLoading || (gisLoading = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = () => { google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential, auto_select: true, ux_mode: "popup" }); res(); };
      s.onerror = () => { gisLoading = null; rej(new Error("gsi")); };
      document.head.appendChild(s);
    }));
  }
  function onCredential(r) {
    try {
      const b = r.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const p = JSON.parse(decodeURIComponent(escape(atob(b + "===".slice((b.length + 3) % 4)))));
      user = { sub: p.sub, name: p.name || p.email, email: p.email, picture: p.picture, exp: p.exp };
      try { localStorage.setItem(KEY, JSON.stringify(user)); } catch {}
    } catch { return; }
    const go = pending; close(); navUser();
    if (go) go();
    window.dispatchEvent(new CustomEvent("ustun-auth", { detail: { user } }));
  }

  // ---------- Kirish oynasi ----------
  let modal = null, pending = null;
  function open(must, then) {
    if (signedIn()) { if (then) then(); return; }
    pending = then || null;
    if (!modal) {
      modal = document.createElement("div"); modal.className = "auth-modal";
      modal.innerHTML = `<div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="authT">
        <span class="label">Pillar Architecture</span><h2 id="authT">Google bilan kiring</h2>
        <p class="auth-d"></p><div class="auth-g" aria-live="polite"></div>
        <p class="auth-err" role="status"></p>
        <div class="auth-row"><button type="button" class="btn-ghost" data-auth="later"></button></div>
        <p class="muted auth-note">Biz faqat ismingiz, e-pochtangiz va rasmingizni ko'ramiz — parolingizni emas. Ma'lumot shu brauzerda saqlanadi.</p></div>`;
      modal.addEventListener("click", e => {
        if (e.target.closest('[data-auth="later"]')) {
          if (modal.dataset.must === "1") { close(); if (typeof showView === "function") showView("bosh"); else if (!/index\.html$|\/$/.test(location.pathname)) location.href = "index.html"; }
          else { try { sessionStorage.setItem(LATER, "1"); } catch {} close(); }
        }
      });
      document.body.appendChild(modal);
    }
    modal.dataset.must = must ? "1" : "";
    modal.querySelector(".auth-d").textContent = must ? "Bu xizmatdan foydalanish uchun Google hisobingiz bilan kiring. Bir bosish kifoya." : "Loyihalaringizni saqlash va barcha xizmatlardan foydalanish uchun Google hisobingiz bilan kiring.";
    modal.querySelector('[data-auth="later"]').textContent = must ? "Bosh sahifaga qaytish" : "Keyinroq";
    modal.querySelector(".auth-err").textContent = "";
    modal.hidden = false; document.documentElement.classList.add("auth-open");
    const box = modal.querySelector(".auth-g");
    loadGis().then(() => {
      box.innerHTML = "";
      google.accounts.id.renderButton(box, { theme: "filled_blue", size: "large", shape: "pill", text: "continue_with", width: 280, locale: (window.UstunI18n && UstunI18n.lang) || "uz" });
    }).catch(() => { modal.querySelector(".auth-err").textContent = "Google bilan bog'lanib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring."; });
  }
  function close() { if (modal) modal.hidden = true; document.documentElement.classList.remove("auth-open"); pending = null; window.dispatchEvent(new CustomEvent("ustun-auth", { detail: { user } })); }

  // ---------- Navbarda: kirgan foydalanuvchi va chiqish ----------
  function navUser() {
    const ul = document.querySelector(".nav ul"); if (!ul) return;
    let li = ul.querySelector(".nav-user");
    if (!user || !enabled()) { if (li) li.remove(); return; }
    if (!li) { li = document.createElement("li"); li.className = "nav-user"; ul.insertBefore(li, ul.querySelector(".nav-help") ? ul.querySelector(".nav-help").closest("li") : null); }
    li.innerHTML = `<button type="button" class="nav-acc" title="${user.email || ""}">${user.picture ? `<img src="${user.picture}" alt="" referrerpolicy="no-referrer">` : `<b>${(user.name || "?")[0].toUpperCase()}</b>`}<span>Hisobdan chiqish</span></button>`;
    li.querySelector("button").addEventListener("click", signOut);
  }
  function signOut() {
    user = null; try { localStorage.removeItem(KEY); } catch {}
    try { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); } catch {}
    navUser(); guardCurrent();
  }

  // ---------- Xizmatlarni himoyalash ----------
  const currentView = () => {
    const v = [...document.querySelectorAll(".view")].find(x => !x.hidden);
    return v ? v.id : PAGE_VIEW[location.pathname.split("/").pop()] || "bosh";
  };
  function guardCurrent() { if (!signedIn() && GATED.includes(currentView())) open(true, () => {}); }
  function boot() {
    checkOwnerLink();
    if (inArtifact) window.claude.use("user").then(u => { if (u && u.isOwner && u.isOwner()) owner = true; }).catch(() => {});
    navUser();
    if (!enabled()) { ready = true; return; }
    if (typeof window.showView === "function") {                      // web: bo'limga o'tishdan oldin tekshiriladi
      const orig = window.showView;
      window.showView = function (v) {
        if (!signedIn() && GATED.includes(v)) { const args = arguments; open(true, () => orig.apply(this, args)); return; }
        return orig.apply(this, arguments);
      };
    }
    document.addEventListener("click", e => {                         // AI yordamchi (robot) ham — kirgandan keyin
      const b = e.target.closest(".ai-btn"); if (!b || signedIn()) return;
      e.preventDefault(); e.stopImmediatePropagation(); open(true, () => b.click());
    }, true);
    const first = () => {
      if (signedIn()) return;
      if (GATED.includes(currentView())) { if (typeof showView === "function") { showView("bosh"); open(false); } else open(true); return; }
      let later = false; try { later = sessionStorage.getItem(LATER) === "1"; } catch {}
      if (!later) open(false);
    };
    if (window.UstunI18n && !UstunI18n.chosen()) window.addEventListener("ustun-til", () => setTimeout(first, 300), { once: true });   // avval til
    else setTimeout(first, 300);
    ready = true;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);

  return { get user() { return user; }, get owner() { return owner; }, get enabled() { return enabled(); }, signedIn, open, signOut, get ready() { return ready; } };
})();
window.UstunAuth = UstunAuth;
