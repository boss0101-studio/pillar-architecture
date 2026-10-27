// Yangi foydalanuvchi uchun yordamchi: qadamma-qadam tanishtiruv (yo'riqnoma).
// 1) Saytga birinchi kirganda (til tanlangandan keyin) — umumiy tanishuv: bo'limlar, AI yordamchi, til, fon, sozlamalar.
// 2) Har bir bo'limga (Konstruktor, Erkin qurish, Oq qog'oz) birinchi kirganda — shu bo'limning asosiy tugmalari.
// Ko'rilganlar shu brauzerda eslab qolinadi ("ustun-tour"); navbardagi "?" tugmasi yoki Sozlamalardan qayta ochiladi.
// Instruktor: kartada personaj, qo'l belgilangan tugmaga uchib borib "bosadi", ba'zi qadamlarda o'zi bosib ko'rsatadi (va qaytaradi).
// Matnlar o'zbekcha yoziladi, i18n.js ularni tanlangan tilga o'giradi.
const UstunTour = (function () {
  const KEY = "ustun-tour";
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch {} };
  const isWeb = () => !!document.getElementById("bosh") && typeof showView === "function";

  // Joriy bo'lim: web'da ko'rinib turgan .view, server sahifalarida fayl nomi
  function page() {
    if (isWeb()) { const v = [...document.querySelectorAll(".view")].find(x => !x.hidden); return v ? v.id : "bosh"; }
    const f = location.pathname.split("/").pop() || "index.html";
    return { "index.html": "bosh", "designer.html": "konstruktor", "builder.html": "erkin", "paper.html": "qogoz", "shop.html": "mahsulotlar", "settings.html": "sozlamalar" }[f] || "bosh";
  }
  const visible = el => !!el && !!(el.offsetParent || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden";
  const find = sel => (sel ? [...document.querySelectorAll(sel)].find(visible) || null : null);
  const navTo = (view, file) => (isWeb() ? `.nav a[data-view="${view}"]` : `.nav a[href="${file}"]`);

  // ---------- Jonli namoyish: instruktor tugmani o'zi bosadi, keyin avvalgi holatni qaytaradi ----------
  let undo = null, timers = [];
  const later = (f, ms) => timers.push(setTimeout(f, ms));
  function stopDemo() { timers.forEach(clearTimeout); timers = []; if (undo) { const u = undo; undo = null; u(); } }
  function demoShape() {
    const box = document.getElementById("shapes"); if (!box) return;
    const was = box.querySelector('[aria-pressed="true"]'), l = box.querySelector('[data-v="L"]');
    if (!l || was === l) return;
    tap(l); l.click();
    undo = () => { if (was) was.click(); };
    later(() => { if (was) { tap(was); stopDemo(); } }, 2200);
  }

  // ---------- Qadamlar ----------
  const TOURS = {
    bosh: [
      { t: "Salom! Men — instruktoringizman", d: "Saytni qanday ishlatishni qadamma-qadam ko'rsatib beraman: qayerni bosish, nima qilish kerakligini qo'l bilan ko'rsataman. Bir daqiqa oladi.", nx: "Ha, ko'rsating" },
      { s: () => navTo("konstruktor", "designer.html"), t: "Konstruktor", d: "Tayyor bino qutisi: qavat, plan shakli (L, П, shar...), tom, material va fasaddagi deraza, balkon, eshiklar." },
      { s: () => navTo("erkin", "builder.html"), t: "Erkin qurish", d: "Devorlarni noldan o'zingiz chizasiz: tayyor shakllar, yoy devorlar; fundament, g'isht va smeta o'zi hisoblanadi." },
      { s: () => navTo("qogoz", "paper.html"), t: "Oq qog'oz", d: "Uyni qalam bilan qo'lda chizing — chizg'ich, go'niya, sirkul yordam beradi. Keyin bir bosishda 3D'ga o'tkazasiz." },
      { s: () => ".ai-btn", t: "AI yordamchi", d: "Savol bering yoki \"menga 2 qavatli hovli uy loyihalab ber\" deb yozing — uyni o'zi quradi. Xatolik chiqsa ham shu yerdan so'rang." },
      { s: () => ".nav-lang", t: "Til", d: "Sayt tilini istalgan payt shu tugma bilan almashtirasiz." },
      { s: () => ".nav-help", t: "Yordam", d: "Bu tanishuvni qayta ko'rish uchun shu tugmani bosing. Har bir bo'limda o'sha bo'limning yo'riqnomasi ochiladi." },
      { t: "Tayyor!", d: "Boshlash uchun Konstruktorni oching yoki AI yordamchiga uy loyihalashni buyuring.", go: ["konstruktor", "designer.html", "Konstruktorni ochish"] },
    ],
    konstruktor: [
      { t: "Konstruktor", d: "Chapda o'lchamlar va uslub, o'rtada fasad chizmasi va 3D, o'ngda hisob-kitob. Har bir o'zgarish darhol ko'rinadi." },
      { s: () => "#shapes", t: "Plan shakli", d: "To'rtburchak, L, П, T, ichki hovlili, silindr, shar va boshqa shakllar. L, П, T uchun qanot enini sozlaysiz.", demo: demoShape },
      { s: () => "#tools", t: "Fasad asboblari", d: "Deraza, balkon yoki eshikni tanlang va fasaddagi katakni bosing yoki ustidan sudrang." },
      { s: () => "#facade", t: "Old fasad", d: "Shu chizmada kataklarni bo'yaysiz. Orqaga — Ctrl+Z." },
      { s: () => ".v3", t: "3D ko'rinish", d: "Sudrab aylantiring. VR — ichiga kirib yurish, Kesim — tom olinib xonalar ko'rinadi." },
      { s: () => "#addBuilding", t: "Majmua", d: "2–3 ta uy qo'shib, bosh rejada joylashtirasiz; hovli ham shu yerda yoqiladi." },
      { s: () => "#intCard", t: "Ichki makon", d: "\"Avto reja yaratish\" ni bosing — xonalar, eshiklar, mebel va zina o'zi joylashadi. Keyin qo'lda o'zgartirasiz." },
    ],
    erkin: [
      { t: "Erkin qurish", d: "Tayyor quti yo'q: tashqi va ichki devorlarni nuqtama-nuqta chizasiz, hisob-kitob chizilganga qarab chiqadi." },
      { s: () => ".fb-tools", t: "Chizish asboblari", d: "Tashqi devor: to'rda nuqtalarni ketma-ket bosing, boshlang'ich nuqtani qayta bossangiz — kontur yopiladi." },
      { s: () => '[data-fbt="shape"]', t: "Tayyor shakllar", d: "To'rtburchak, L, П, aylana va boshqa konturlarni bir bosishda qo'yasiz." },
      { s: () => '[data-fba="arc"]', t: "Yoy devor", d: "Egri devor chizish: tugash nuqtasini, keyin egilishini bosing (A tugmasi)." },
      { s: () => "#fbCalc", t: "Hisob-kitob", d: "Fundament, g'isht, beton, tom va smeta formulasi bilan shu yerda chiqadi." },
    ],
    qogoz: [
      { t: "Oq qog'oz", d: "Uyni qo'lda chizing: qiyshiq chiziqlar to'g'ri devorga aylanadi, uchlari ulanadi." },
      { s: () => ".pp-tools", t: "Qalam", d: "Qalin qalam — tashqi devor, ingichka — ichki devor." },
      { s: () => ".pp-rulers", t: "Chizg'ichlar", d: "Chizg'ich, go'niya, uchburchak, transportir, sirkul va shablonlar tekis chizishga yordam beradi." },
      { s: () => ".pp-modes", t: "3D ga o'tkazish", d: "Chizib bo'lgach 3D'da ko'ring yoki Erkin qurishga yuborib eshik, deraza va smeta qo'shing." },
    ],
  };

  // ---------- Ko'rinish ----------
  // Instruktor: kaska kiygan me'mor
  const AVATAR = `<svg class="tour-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" class="av-bg"/>
    <path d="M9 47c1-8 7-12 15-12s14 4 15 12" class="av-body"/><circle cx="24" cy="23" r="9" class="av-face"/>
    <circle cx="20.5" cy="23" r="1.3" class="av-eye"/><circle cx="27.5" cy="23" r="1.3" class="av-eye"/><path d="M20.5 27.5q3.5 2.6 7 0" class="av-mouth"/>
    <path d="M13 19.5a11 11 0 0 1 22 0z" class="av-hat"/><rect x="11" y="18.5" width="26" height="3" rx="1.5" class="av-hat"/><path d="M24 9v6" class="av-line"/></svg>`;
  let ui = null, steps = [], at = 0, cur = "";
  function build() {
    ui = document.createElement("div");
    ui.className = "tour"; ui.hidden = true;
    ui.innerHTML = `<div class="tour-hole" aria-hidden="true"></div>
      <svg class="tour-hand" viewBox="0 0 32 32" aria-hidden="true"><path d="M11 3.5c1.4 0 2.4 1 2.4 2.4v8.3l1-.1c1.1 0 1.9.6 2.2 1.4.5-.5 1.1-.7 1.8-.7 1.1 0 2 .7 2.3 1.6.4-.3 1-.5 1.5-.5 1.4 0 2.4 1 2.4 2.4V24c0 3-2.4 5-5.3 5h-3.6c-1.8 0-3.4-.9-4.4-2.4L6 19.8c-.6-1-.3-2.3.7-2.9.9-.5 2-.3 2.6.5l-.7-.9V5.9C8.6 4.5 9.6 3.5 11 3.5z"/></svg>
      <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourT">
        <div class="tour-who">${AVATAR}<span class="label">Instruktor · <span class="tour-n"></span></span></div>
        <h3 id="tourT"></h3><p class="tour-d"></p>
        <div class="tour-row"><button type="button" class="btn-ghost" data-tour="skip">O'tkazib yuborish</button><span class="sp"></span>
          <button type="button" class="btn-ghost" data-tour="prev">Oldingisi</button><button type="button" class="btn" data-tour="next">Keyingisi</button></div>
      </div>`;
    document.body.appendChild(ui);
    ui.addEventListener("click", e => {
      const b = e.target.closest("[data-tour]"); if (!b) return;
      const a = b.dataset.tour;
      if (a === "skip") close(); else if (a === "prev") show(at - 1); else if (a === "next") show(at + 1);
      else if (a === "go") { const g = steps[at].go; close(); if (isWeb()) showView(g[0]); else location.href = g[1]; }
    });
    document.addEventListener("keydown", e => {
      if (!ui || ui.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
    });
    window.addEventListener("resize", () => { if (ui && !ui.hidden) place(); });
    window.addEventListener("scroll", () => { if (ui && !ui.hidden) place(); }, { passive: true });
  }
  function target() { const st = steps[at]; return st && st.s ? find(st.s()) : null; }
  // Belgilangan element atrofida "teshik" va uning yonida karta (sig'magan tomonga emas)
  function place() {
    const el = target(), hole = ui.querySelector(".tour-hole"), card = ui.querySelector(".tour-card");
    const hand = ui.querySelector(".tour-hand");
    if (!el) { hole.style.cssText = "left:50%;top:50%;width:0;height:0"; card.style.cssText = ""; card.classList.add("center"); hand.classList.remove("on"); return; }
    card.classList.remove("center");
    const r = el.getBoundingClientRect(), pad = 6;
    hole.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + 2 * pad}px;height:${r.height + 2 * pad}px`;
    const cw = Math.min(340, innerWidth - 24), ch = card.offsetHeight || 180;
    let top = r.bottom + 14; if (top + ch > innerHeight - 10) top = Math.max(10, r.top - ch - 14);
    if (top < 10 || (top + ch > innerHeight - 10)) top = Math.max(10, innerHeight - ch - 10);
    const left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), innerWidth - cw - 12);
    card.style.cssText = `left:${left}px;top:${top}px;width:${cw}px`;
    if (!undo) pointAt(el);
  }
  // Qo'l elementga uchib boradi va "bosadi" (namoyishda — bosilayotgan tugmaga)
  function pointAt(el) {
    const hand = ui.querySelector(".tour-hand"), r = el.getBoundingClientRect();
    hand.style.left = `${Math.min(r.left + Math.min(r.width / 2, 60), innerWidth - 30)}px`;
    hand.style.top = `${Math.min(r.top + Math.min(r.height / 2, 30), innerHeight - 30)}px`;
    hand.classList.add("on");
  }
  function tap(el) {
    if (!ui) return;
    if (el) pointAt(el);
    const hand = ui.querySelector(".tour-hand");
    hand.classList.remove("tap"); void hand.offsetWidth; hand.classList.add("tap");
  }
  function show(i) {
    if (i < 0) return;
    stopDemo();
    while (i < steps.length && steps[i].s && !find(steps[i].s())) i++;   // ko'rinmaydigan element — qadam o'tkaziladi
    if (i >= steps.length) { close(); return; }
    at = i; const st = steps[i], n = steps.length;
    ui.querySelector(".tour-n").textContent = `${i + 1} / ${n}`;
    ui.querySelector("#tourT").textContent = st.t;
    ui.querySelector(".tour-d").textContent = st.d;
    ui.querySelector('[data-tour="prev"]').hidden = i === 0;
    const next = ui.querySelector('[data-tour="next"], [data-tour="go"]');
    if (st.go) { next.dataset.tour = "go"; next.textContent = st.go[2]; }
    else { next.dataset.tour = "next"; next.textContent = st.nx || (i === n - 1 ? "Tushunarli" : "Keyingisi"); }
    ui.querySelector(".tour-card").classList.toggle("intro", i === 0 && !st.s);
    ui.hidden = false; document.documentElement.classList.add("touring");
    const el = target();
    if (el) { const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight - 40) el.scrollIntoView({ block: "center", behavior: "instant" }); }
    requestAnimationFrame(() => { place(); next.focus(); });
    if (el) later(() => tap(null), 650);
    if (st.demo) later(st.demo, 1400);
  }
  function close() {
    if (!ui || ui.hidden) return;
    stopDemo(); ui.querySelector(".tour-hand").classList.remove("on");
    ui.hidden = true; document.documentElement.classList.remove("touring");
    seen[cur] = 1; save();
    if (cur === "bosh") setTimeout(() => start(), 500);              // so'ng ochiq bo'limning o'z yo'riqnomasi
    const h = document.querySelector(".nav-help"); if (h) h.focus();
  }
  function start(key, force) {
    key = key || (seen.bosh ? page() : "bosh");                       // birinchi kirish: avval instruktor salomlashadi
    if (!TOURS[key] || (!force && seen[key])) return false;
    if (!force && ui && !ui.hidden) return false;
    if (document.querySelector(".lang-modal")) return false;          // til tanlash oynasi ochiq — keyinroq
    if (!ui) build();
    cur = key; steps = TOURS[key]; show(0);
    return true;
  }

  // ---------- Navbardagi "?" tugmasi ----------
  function navButton() {
    const ul = document.querySelector(".nav ul"); if (!ul || ul.querySelector(".nav-help")) return;
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" class="nav-help" aria-label="Yordam: yo'riqnoma" title="Yo'riqnoma"><b>?</b></button>`;
    const lang = ul.querySelector(".nav-lang"); lang ? ul.insertBefore(li, lang.closest("li")) : ul.appendChild(li);
    li.querySelector("button").addEventListener("click", () => start(TOURS[page()] ? page() : "bosh", true));
  }

  // ---------- Ishga tushirish ----------
  function boot() {
    navButton();
    const go = () => setTimeout(() => { navButton(); start(); }, 600);
    if (window.UstunI18n && !UstunI18n.chosen()) window.addEventListener("ustun-til", go, { once: true });   // avval til tanlanadi
    else go();
    if (isWeb()) {                                                     // web: bo'lim almashganda o'sha bo'limning yo'riqnomasi
      const mo = new MutationObserver(() => { if (!ui || ui.hidden) setTimeout(() => start(), 450); });
      document.querySelectorAll(".view").forEach(v => mo.observe(v, { attributes: true, attributeFilter: ["hidden"] }));
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);

  return { start: (k) => start(k, true), reset() { seen = {}; save(); }, get seen() { return { ...seen }; }, page };
})();
window.UstunTour = UstunTour;
