// AI robotcha: AI yordamchi tugmasi — kichkina robot. U gapirish pufakchasida maslahat beradi:
// 1) Konstruktorda loyihani kuzatadi va muammo PAYDO BO'LGAN zahoti aytadi (eshik yo'q, yorug'lik kam, g'isht juda baland...).
//    "Tuzat" — AI loyihaga o'zi aralashadi (AIDesign.apply), "Bekor qilish" — AIDesign.undo. Claude ulangan bo'lsa — "Batafsil so'rash".
// 2) Vaqti-vaqti bilan ochiq bo'limga mos foydali maslahat ("Bilasizmi?"): avval 20 s dan keyin, so'ng har 3 daqiqada,
//    o'zi 15 s da yopiladi; 3 marta yopilsa shu sessiyada boshqa chiqmaydi.
// Bezovta qilmaslik uchun: sahifa ochilgandagi holat uchun muammo aytilmaydi, yopilgan muammo shu sessiyada qaytmaydi,
// yo'riqnoma, til oynasi yoki AI paneli ochiq bo'lsa jim turadi. O'chirish/yoqish — pufakchadagi tugma yoki Sozlamalar ("ustun-maslahat").
// Robot rasmi (UstunRobot) shu yerda: ai.js tugmani u bilan chizadi.
window.UstunRobot = cls => `<svg class="robot ${cls || ""}" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M32 7v8" class="rb-wire"/><circle cx="32" cy="6" r="3.6" class="rb-light"/>
  <rect x="5" y="25" width="6" height="11" rx="3" class="rb-ear"/><rect x="53" y="25" width="6" height="11" rx="3" class="rb-ear"/>
  <rect x="10" y="14" width="44" height="32" rx="11" class="rb-head"/><rect x="16" y="20" width="32" height="20" rx="7" class="rb-face"/>
  <g class="rb-eyes"><circle cx="25" cy="29" r="3.3" class="rb-eye"/><circle cx="39" cy="29" r="3.3" class="rb-eye"/></g>
  <path d="M26.5 35q5.5 3.6 11 0" class="rb-mouth"/>
  <rect x="19" y="48" width="26" height="13" rx="6" class="rb-body"/><circle cx="32" cy="54.5" r="2.4" class="rb-light"/></svg>`;
const UstunAdvisor = (function () {
  const KEY = "ustun-maslahat";
  let on = true;
  try { on = localStorage.getItem(KEY) !== "off"; } catch {}

  const DOORS = ["door", "door2", "glassdoor", "archdoor", "shop", "garage"];
  const GREEN = ["tree", "pine", "fruit", "bush"];
  const house = () => (window.Site && Site.list[Site.active]) || {};

  // ---------- Qoidalar: test(p, cells, x) — muammo bormi; fix — AIDesign amallari; v — kartada ko'rsatiladigan qiymat ----------
  const RULES = [
    { id: "door", t: "Kirish eshigi yo'q", d: "Birinchi qavatda eshik yo'q — binoga kirib bo'lmaydi. Odatda eshik fasad o'rtasiga qo'yiladi.",
      test: (p, c, x) => p.ground !== "arkada" && !x.ground.some(t => DOORS.includes(t)),
      fix: () => [{ type: "set_cells", cells: [{ floor: 1, bay: "middle", type: "door" }] }], fl: "Eshik qo'yish" },
    { id: "wood", t: "Yog'och bino juda baland", d: "Yog'och bino 3 qavatdan baland bo'lsa, yong'in xavfi oshadi va qurilish me'yorlariga to'g'ri kelmaydi.",
      test: p => p.material === "yogoch" && p.floors > 3, v: p => `${p.floors} qavat`,
      fix: () => [{ type: "set_params", params: { floors: 3 } }], fl: "3 qavatga tushirish" },
    { id: "brick", t: "G'isht uchun juda baland", d: "G'isht devor 9 qavatdan baland binoni ko'tara olmaydi — beton karkas kerak.",
      test: p => ["gisht", "oqgisht"].includes(p.material) && p.floors > 9, v: p => `${p.floors} qavat`,
      fix: () => [{ type: "set_params", params: { material: "beton" } }], fl: "Betonga almashtirish" },
    { id: "dark", t: "Xonalarga yorug'lik kam", d: "Derazalar juda kam — xonalarga kun yorug'i yetmaydi. Fasadning taxminan chorak qismi oyna bo'lgani ma'qul.",
      test: (p, c, x) => p.category !== "interyer" && x.m.glazing < 15, v: (p, c, x) => `${x.m.glazing}%`,
      fix: p => (p.window === "yoq" ? [{ type: "set_params", params: { window: "oddiy" } }] : null), fl: "Deraza qo'yish" },
    { id: "hot", t: "Oyna juda ko'p", d: "Yozda xonalar qizib ketadi, qishda issiqlik yo'qoladi. Kichikroq deraza yoki janub tomonga soyabon yaxshiroq.",
      test: (p, c, x) => p.material !== "shisha" && x.m.glazing > 55, v: (p, c, x) => `${x.m.glazing}%`,
      fix: p => (p.window !== "oddiy" ? [{ type: "set_params", params: { window: "oddiy" } }] : null), fl: "Oddiy derazaga o'tish" },
    { id: "roof", t: "Past uyga nishab tom", d: "Past uy uchun nishab tom yomg'ir va qorni yaxshi oqizadi, ostida chordoq ham bo'ladi. Tekis tom tez-tez oqadi.",
      test: p => p.roof === "tekis" && p.category === "turar-joy" && p.floors <= 3,
      fix: () => [{ type: "set_params", params: { roof: "nishab" } }], fl: "Nishab tom qilish" },
    { id: "lift", t: "Lift kerak", d: "6 va undan ko'p qavatli binoga lift kerak. Uning narxini smetaga qo'shib qo'ying.",
      test: p => p.floors >= 6 && p.category !== "interyer", v: p => `${p.floors} qavat` },
    { id: "deep", t: "Bino juda chuqur", d: "O'rtadagi xonalarga tabiiy yorug'lik yetmaydi. Ichki hovlili shakl yoki kamroq chuqurlik yaxshiroq.",
      test: p => p.depth > 18 && shapeOf(p) === "rect", v: p => `${String(p.depth).replace(".", ",")} m`,
      fix: () => [{ type: "set_params", params: { shape: "court" } }], fl: "Ichki hovli qilish" },
    { id: "low", t: "Shift past", d: "Qavat balandligi past — xonalar siqiq ko'rinadi. 3 m va undan baland qulayroq.",
      test: p => p.floor_h < 2.9, v: p => `${String(p.floor_h).replace(".", ",")} m`,
      fix: () => [{ type: "set_params", params: { floor_h: 3 } }], fl: "3 m qilish" },
    { id: "gbalc", t: "Balkon birinchi qavatda", d: "Birinchi qavatdagi balkon ko'chaga juda yaqin. Odatda balkon yuqori qavatlarga qo'yiladi.",
      test: (p, c) => Object.entries(c).some(([k, t]) => k.startsWith("0,") && t === "balc"),
      fix: (p, c) => [{ type: "set_cells", cells: Object.entries(c).filter(([k, t]) => k.startsWith("0,") && t === "balc").map(([k]) => ({ floor: 1, bay: Number(k.split(",")[1]) + 1, type: "auto" })) }],
      fl: "Balkonni olib tashlash" },
    { id: "yard", t: "Hovlini ham loyihalang", d: "Hovli uyga daraxt, gulzor va garaj qo'shsangiz, bosh reja to'liq bo'ladi. Ularni keyin sudrab joylashtirasiz.",
      test: p => window.Site && Site.list.length === 1 && !Site.yard.on && p.category === "turar-joy" && p.floors <= 3,
      fix: () => [{ type: "yard", on: true, items: ["tree", "fruit", "bed", "garage"] }], fl: "Hovlini yoqish" },
    { id: "shade", t: "Basseyn yonida soya yo'q", d: "Basseyn yonida daraxt bo'lsa, yozda soya beradi va hovli salqin bo'ladi.",
      test: () => window.Site && Site.yard.on && Site.yard.items.some(i => i.t === "swim" || i.t === "pool") && !Site.yard.items.some(i => GREEN.includes(i.t)),
      fix: () => [{ type: "yard", items: ["tree", "fruit"] }], fl: "Daraxt qo'shish" },
    { id: "int", t: "Ichki rejani ko'ring", d: "Xonalar, eshiklar, mebel va zina avtomatik joylashadi — keyin qo'lda o'zgartirasiz.",
      test: p => p.category === "turar-joy" && p.floors <= 3 && !house().interior,
      fix: () => [{ type: "interior", mode: "auto" }], fl: "Ichki reja yaratish" },
  ];

  function check() {
    const h = window.DesignHost; if (!h || typeof metrics !== "function") return null;
    const p = h.params(), c = h.cells();
    const x = { m: metrics(p, c), ground: [...Array(p.bays).keys()].map(b => cellType(p, c, 0, b)) };
    return { p, c, x, act: RULES.filter(r => { try { return r.test(p, c, x); } catch { return false; } }) };
  }

  // ---------- Kuzatish: holat o'zgarganda (0,8 s tinchlikdan keyin) yangi paydo bo'lgan muammolar navbatga ----------
  let sig = null, prev = null, queue = [], dismissed = new Set(), timer = 0, cur = null, applied = false;
  const designerVisible = () => { const f = document.getElementById("params"); return !!f && f.getClientRects().length > 0; };
  function signature() {
    const h = window.DesignHost; if (!h) return "";
    try { return JSON.stringify([h.params(), h.cells(), window.Site ? [Site.active, Site.list.length, Site.yard.on, Site.yard.items.length, !!house().interior] : 0]); } catch { return ""; }
  }
  function tick() {
    if (!window.DesignHost) return;
    const s = signature();
    if (s === sig) return;
    const first = sig === null; sig = s;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const r = check(); if (!r) return;
      const ids = r.act.map(a => a.id);
      if (!first && prev) ids.filter(id => !prev.includes(id) && !dismissed.has(id) && !queue.includes(id)).forEach(id => queue.push(id));
      queue = queue.filter(id => ids.includes(id));                   // tuzalgan muammo navbatdan chiqadi
      prev = ids;
      if (cur && !ids.includes(cur) && !applied) hide();              // foydalanuvchi o'zi tuzatdi
      if (!cur || kind === "tip") showNext();
    }, first ? 0 : 800);
  }

  // ---------- "Bilasizmi?" — bo'limga mos foydali maslahatlar ----------
  const TIPS = {
    all: [
      "Menga savol bering yoki \"2 qavatli hovli uy loyihalab ber\" deb yozing — uyni o'zim quraman.",
      "Sayt tilini yuqoridagi 🌐 tugmasi bilan istalgan payt almashtirasiz.",
      "Yo'riqnomani qayta ko'rish uchun yuqoridagi \"?\" tugmasini bosing.",
      "Fon xalaqit bersa — chap pastdagi Fon tugmasidan uni susaytiring.",
      "Meni bossangiz, AI yordamchi oynasi ochiladi: xatolikni ham shu yerdan so'rang.",
    ],
    bosh: [
      "Boshlash uchun Konstruktorni oching: tayyor andozadan boshlash eng oson yo'l.",
      "Pastdagi kalkulyator maydon va sifatga qarab dastlabki smetani hisoblaydi.",
    ],
    konstruktor: [
      "Fasad kataklari ustidan sudrasangiz, bir nechta derazani birdaniga qo'yasiz.",
      "Ctrl+Z — oxirgi o'zgarishni bekor qiladi, Ctrl+Y — qaytaradi.",
      "3D ko'rinishni sichqoncha bilan aylantiring, VR bilan esa uy ichiga kirib yurasiz.",
      "\"Kesim\" tugmasi tomni olib, ichidagi xonalarni ko'rsatadi.",
      "Hovlini yoqing: daraxt, basseyn va garajni bosh rejada sudrab joylashtirasiz.",
      "Loyihani nom berib saqlang — keyin Galereyadan qayta ochasiz.",
      "Ko'proq sozlama kerakmi? Yuqoridagi To'liq rejimni yoqing.",
    ],
    erkin: [
      "Shift bosib tursangiz, devor faqat to'g'ri burchak ostida chiziladi.",
      "Enter yoki ikki marta bosish devor chizishni tugatadi.",
      "Tayyor shakllar bilan L yoki П konturini bir bosishda qo'yasiz.",
      "Eshik va derazani devor chizig'ining ustiga bosing.",
    ],
    qogoz: [
      "Qiyshiq chizsangiz ham bo'ladi — chiziqlar o'zi to'g'ri devorga aylanadi.",
      "Chizg'ich va go'niya tekis chizishga yordam beradi.",
      "Chizib bo'lgach, uyingizni 3D'da ko'ring.",
    ],
    galereya: ["Galereyadagi loyihani ochsangiz, nusxasi Konstruktorda ochiladi — asl loyiha o'zgarmaydi."],
    mahsulotlar: ["Konstruktordagi smetani bir bosishda savatga qo'shasiz."],
  };
  let tipTimer = 0, autoTimer = 0, tipsClosed = 0, tipNo = 0, kind = null;
  const shownTips = new Set();
  const pageId = () => (window.UstunTour && UstunTour.page ? UstunTour.page() : "bosh");
  const aiOpen = () => { const ai = document.getElementById("aiPanel"); return !!(ai && !ai.hidden); };
  const busy = () => document.hidden || aiOpen() || document.documentElement.classList.contains("touring") || !!document.querySelector(".lang-modal, dialog[open]");
  function scheduleTip(ms) { clearTimeout(tipTimer); if (on && tipsClosed < 3) tipTimer = setTimeout(() => showTip(false), ms); }
  function pickTip() {
    const list = [...(TIPS[pageId()] || []), ...TIPS.all];
    let t = list.find(x => !shownTips.has(x));
    if (!t) { list.forEach(x => shownTips.delete(x)); t = list[0]; }
    shownTips.add(t); return t;
  }
  function showTip(asked) {
    if (!on || (cur && kind === "rule")) { scheduleTip(60000); return; }
    if (!asked && busy()) { scheduleTip(15000); return; }
    if (!card) build();
    cur = "tip"; kind = "tip"; applied = false;
    card.querySelector(".adv-t").textContent = "Bilasizmi?";
    card.querySelector(".adv-d").textContent = pickTip();
    card.querySelector(".adv-v").textContent = `${++tipNo}`;
    ["fix", "undo", "more", "next"].forEach(k => { card.querySelector(`[data-tip="${k}"]`).hidden = true; });
    card.querySelector('[data-tip="tip"]').hidden = false;
    sync();
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { if (kind === "tip" && !card.matches(":hover, :focus-within")) { hide(); scheduleTip(180000); } }, 15000);
  }

  // ---------- Gapirish pufakchasi ----------
  let card = null;
  function build() {
    card = document.createElement("aside");
    card.className = "adv"; card.hidden = true; card.setAttribute("role", "status"); card.setAttribute("aria-live", "polite");
    card.innerHTML = `<div class="adv-head"><span class="adv-ic" aria-hidden="true">✦</span><span class="label">AI maslahat</span><b class="adv-v"></b>
        <button type="button" class="adv-x" data-tip="close" aria-label="Yopish" title="Yopish">×</button></div>
      <h4 class="adv-t"></h4><p class="adv-d"></p>
      <div class="adv-row"><button type="button" class="btn" data-tip="fix"></button><button type="button" class="btn-ghost" data-tip="undo" hidden>Bekor qilish</button>
        <button type="button" class="btn-ghost" data-tip="more" hidden>Batafsil so'rash</button><button type="button" class="btn-ghost" data-tip="next" hidden>Keyingi maslahat</button>
        <button type="button" class="btn-ghost" data-tip="tip" hidden>Yana maslahat</button></div>
      <button type="button" class="adv-off" data-tip="off">Maslahatlarni o'chirish</button>`;
    document.body.appendChild(card);
    card.addEventListener("click", e => {
      const b = e.target.closest("[data-tip]"); if (!b) return;
      const a = b.dataset.tip, r = RULES.find(x => x.id === cur);
      if (a === "close" && kind === "tip") { tipsClosed++; hide(); scheduleTip(180000); }
      else if (a === "close") { if (cur) dismissed.add(cur); hide(); showNext(); }
      else if (a === "tip") { showTip(true); }
      else if (a === "next") { if (cur) dismissed.add(cur); showNext(); }
      else if (a === "off") { set(false); }
      else if (a === "fix" && r && window.AIDesign) {
        const st = check(), acts = r.fix && st ? r.fix(st.p, st.c, st.x) : null; if (!acts) return;
        const res = AIDesign.apply(acts);
        if (res && res.ok) {
          applied = true; dismissed.add(cur);
          card.querySelector(".adv-d").textContent = "Bajarildi: AI loyihangizni o'zgartirdi. Yoqmasa — bekor qiling.";
          b.hidden = true; card.querySelector('[data-tip="undo"]').hidden = false; card.querySelector('[data-tip="more"]').hidden = true;
        }
      } else if (a === "undo" && window.AIDesign && AIDesign.undo()) { hide(); }
      else if (a === "more" && r && window.UstunAI) {
        if (window.UstunAI.open) UstunAI.open(true);
        UstunAI.ask(`Loyihamni ko'rib chiqing va maslahat bering: ${r.t}. ${r.d}`);
        hide();
      }
    });
  }
  function showNext() {
    while (queue.length && dismissed.has(queue[0])) queue.shift();
    const id = queue.shift(); if (!id) { if (kind === "rule") hide(); return; }
    show(id);
  }
  function show(id) {
    if (!on) return;
    const r = RULES.find(x => x.id === id), st = check(); if (!r || !st) return;
    if (!card) build();
    clearTimeout(autoTimer);                                         // loyiha muammosi "Bilasizmi?" dan muhimroq
    cur = id; kind = "rule"; applied = false;
    card.querySelector(".adv-t").textContent = r.t;
    card.querySelector(".adv-d").textContent = r.d;
    card.querySelector(".adv-v").textContent = r.v ? r.v(st.p, st.c, st.x) : "";
    const canFix = !!(r.fix && r.fix(st.p, st.c, st.x)), fb = card.querySelector('[data-tip="fix"]');
    fb.hidden = !canFix; fb.textContent = r.fl || "Tuzat";
    card.querySelector('[data-tip="undo"]').hidden = true;
    card.querySelector('[data-tip="tip"]').hidden = true;
    card.querySelector('[data-tip="more"]').hidden = !(window.UstunAI && UstunAI.mode && UstunAI.mode !== "offline");
    card.querySelector('[data-tip="next"]').hidden = !queue.length;
    sync();
  }
  function hide() { cur = null; kind = null; applied = false; clearTimeout(autoTimer); if (card) card.hidden = true; document.documentElement.classList.remove("robot-talk"); }
  // Yo'riqnoma, til oynasi, AI paneli ochiq bo'lsa yoki loyiha muammosi Konstruktor yopiq paytda — pufakcha yashiriladi (navbat saqlanadi)
  function sync() {
    if (!card || !cur) return;
    card.hidden = !on || (kind === "rule" && !designerVisible()) || document.documentElement.classList.contains("touring") || aiOpen() || !!document.querySelector(".lang-modal");
    document.documentElement.classList.toggle("robot-talk", !card.hidden);
  }
  function set(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
    if (!on) { hide(); clearTimeout(tipTimer); } else scheduleTip(20000);
    document.querySelectorAll("[data-advisor]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.advisor === "on") === on)));
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-advisor]"); if (b) set(b.dataset.advisor === "on"); });

  setInterval(() => { tick(); sync(); }, 700);
  scheduleTip(20000);
  return { get on() { return on; }, set, tip: () => showTip(true), check: () => { const r = check(); return r ? r.act.map(a => a.id) : []; }, rules: RULES, tips: TIPS };
})();
window.UstunAdvisor = UstunAdvisor;
