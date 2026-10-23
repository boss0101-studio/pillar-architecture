// Tillar: sayt matni o'zbekcha yozilgan, boshqa tillarga lug'at (til-xx.js) bo'yicha avtomatik o'giriladi.
// Sahifadagi matn tugunlari va atributlar (placeholder, title, aria-label, alt) kuzatiladi: keyin chizilgan matnlar ham o'giriladi.
// Sonli matnlar qolip bo'yicha: "3-qavat" -> "{0}-qavat" -> "Floor {0}". Birinchi kirishda til tanlash oynasi chiqadi (inglizcha, English birinchi).
const UstunI18n = (function () {
  const KEY = "ustun-til";
  const LANGS = [
    { code: "en", name: "English", en: "English" },
    { code: "es", name: "Español", en: "Spanish" },
    // lug'at tayyorlanmoqda: { code: "ru", name: "Русский", en: "Russian" },
    { code: "uz", name: "O'zbekcha", en: "Uzbek" },
    // lug'at tayyorlanmoqda: { code: "tr", name: "Türkçe", en: "Turkish" },
    // lug'at tayyorlanmoqda: { code: "fr", name: "Français", en: "French" },
    // lug'at tayyorlanmoqda: { code: "de", name: "Deutsch", en: "German" },
  ];
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];
  const SKIP = "script,style,noscript,textarea,[translate='no'],.notranslate,[contenteditable='true']";
  const NUM = /\d{1,3}(?:[ \u00A0\u202F]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;   // "40 530" va "4,2" — bitta son
  const DICT = (window.USTUN_I18N = window.USTUN_I18N || {});
  const me = document.currentScript, base = me && me.src ? me.src.replace(/[^/]*$/, "") : "";
  let lang = null;
  try { lang = localStorage.getItem(KEY); } catch {}
  if (!LANGS.some(l => l.code === lang)) lang = null;
  const active = () => lang || "en";

  // ---------- Tarjima ----------
  const norm = s => s.replace(/\s+/g, " ").trim();
  const has = (d, k) => Object.prototype.hasOwnProperty.call(d, k);
  // Qolipli kalitlar: {n} o'rniga istalgan matn (nom, son, boshqa ibora) tushishi mumkin — masalan '"{0}" saqlandi.'
  const PATS = {};
  function patterns(L) {
    if (PATS[L]) return PATS[L];
    const list = [];
    for (const k of Object.keys(DICT[L] || {})) {
      if (k.indexOf("{") < 0) continue;
      const lits = k.split(/\{\d+\}/), lit = lits.reduce((a, b) => (b.trim().length > a.trim().length ? b : a), "");
      if (lit.replace(/[^A-Za-zʻ'А-Яа-я]/g, "").length < 3) continue;   // "{0} {1}" kabi juda umumiy qoliplar emas
      const order = (k.match(/\{(\d+)\}/g) || []).map(x => +x.slice(1, -1));
      const re = new RegExp("^" + lits.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)") + "$");
      list.push({ re, order, lit, val: DICT[L][k] });
    }
    list.sort((a, b) => b.lit.length - a.lit.length);
    return (PATS[L] = list);
  }
  function t(s, depth, lang) {                                       // lang — boshqa tilga o'girish (masalan, AI savol tilida javob bersa)
    const L = lang || active();
    if (L === "uz" || s == null) return s;
    const d = DICT[L]; if (!d) return s;
    const key = norm(String(s)); if (!key) return s;
    if (has(d, key)) return d[key];
    const nums = [], pk = key.replace(NUM, m => { nums.push(m); return `{${nums.length - 1}}`; });
    if (nums.length && has(d, pk)) return d[pk].replace(/\{(\d+)\}/g, (_, i) => (nums[i] != null ? nums[i] : ""));
    if ((depth || 0) > 2 || !/[A-Za-z]{2}/.test(key)) return s;
    for (const p of patterns(L)) {
      if (key.indexOf(p.lit) < 0) continue;
      const m = p.re.exec(key); if (!m) continue;
      const got = {}; p.order.forEach((n, i) => { got[n] = m[i + 1]; });
      return p.val.replace(/\{(\d+)\}/g, (_, n) => (got[n] != null ? translateKeep(got[n], (depth || 0) + 1, lang) : ""));
    }
    return s;
  }
  function translateKeep(s, depth, lang) { const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), out = t(m[2], depth, lang); return out === m[2] ? s : m[1] + out + m[3]; }

  // ---------- Sahifa matni ----------
  const srcText = new WeakMap(), setText = new WeakMap(), srcAttr = new WeakMap(), setAttr = new WeakMap();
  const skip = el => !el || (el.closest && el.closest(SKIP));
  function doText(n) {
    if (skip(n.parentElement)) return;
    const cur = n.nodeValue;
    if (setText.get(n) !== cur) srcText.set(n, cur);                 // sahifa yangi matn yozdi — u manba bo'ladi
    const out = active() === "uz" ? srcText.get(n) : translateKeep(srcText.get(n));
    setText.set(n, out);
    if (n.nodeValue !== out) n.nodeValue = out;
  }
  function doAttrs(el) {                                             // textarea matni emas, lekin placeholder'i o'giriladi
    if (skip(el.parentElement) || el.matches("[translate='no'],.notranslate,script,style")) return;
    let src = srcAttr.get(el), mine = setAttr.get(el);
    ATTRS.forEach(a => {
      if (!el.hasAttribute(a)) return;
      const cur = el.getAttribute(a);
      if (!src) { src = {}; srcAttr.set(el, src); }
      if (!mine) { mine = {}; setAttr.set(el, mine); }
      if (mine[a] !== cur) src[a] = cur;
      const out = active() === "uz" ? src[a] : t(src[a]);
      mine[a] = out;
      if (cur !== out) el.setAttribute(a, out);
    });
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    doAttrs(root);
    root.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach(doAttrs);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim()) doText(n);
  }
  let titleSrc = null;
  function applyAll() {
    document.documentElement.lang = active();
    if (titleSrc === null) titleSrc = document.title;
    document.title = active() === "uz" ? titleSrc : t(titleSrc);
    walk(document.body);
    const b = document.querySelector(".nav-lang b"); if (b) b.textContent = active().toUpperCase();
  }
  const obs = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === "characterData") { if (r.target.nodeValue.trim()) doText(r.target); }
      else if (r.type === "attributes") doAttrs(r.target);
      else r.addedNodes.forEach(walk);
    }
  });

  // ---------- Lug'atni yuklash ----------
  function load(code, cb) {
    if (code === "uz" || DICT[code]) return cb();
    const s = document.createElement("script");
    s.src = `${base}til-${code}.js`; s.onload = cb; s.onerror = cb;   // lug'at topilmasa — o'zbekcha qoladi
    document.head.appendChild(s);
  }
  function set(code) {
    if (!LANGS.some(l => l.code === code)) return;
    lang = code;
    try { localStorage.setItem(KEY, code); } catch {}
    load(code, () => { applyAll(); window.dispatchEvent(new CustomEvent("ustun-til", { detail: { lang: code } })); });
  }

  // ---------- Til tanlash oynasi (doim inglizcha, English birinchi) ----------
  function picker(first) {
    if (document.querySelector(".lang-modal")) return;
    const m = document.createElement("div");
    m.className = "lang-modal"; m.setAttribute("translate", "no");
    m.innerHTML = `<div class="lang-card" role="dialog" aria-modal="true" aria-labelledby="langTitle">
      <span class="label">Language · Til · Idioma · Язык</span>
      <h2 id="langTitle">${first ? "Welcome! Choose your language" : "Choose your language"}</h2>
      <p>${first ? "Please select the language for the website. You can change it any time with the 🌐 button at the top or in Settings." : "The page switches immediately."}</p>
      <div class="lang-list" role="radiogroup" aria-label="Languages">${LANGS.map((l, i) => `<button type="button" role="radio" data-lang="${l.code}" aria-checked="${l.code === active()}">
        <b>${l.name}</b><small>${l.en}${i === 0 ? " · recommended" : ""}</small><i>${l.code.toUpperCase()}</i></button>`).join("")}</div>
      ${first ? "" : `<button type="button" class="lang-close">Close</button>`}
    </div>`;
    document.body.appendChild(m);
    const btns = [...m.querySelectorAll("[data-lang]")];
    (btns.find(b => b.dataset.lang === active()) || btns[0]).focus();
    const close = () => { m.remove(); document.removeEventListener("keydown", key, true); const nb = document.querySelector(".nav-lang"); if (nb && !first) nb.focus(); };
    m.addEventListener("click", e => {
      const b = e.target.closest("[data-lang]");
      if (b) { set(b.dataset.lang); close(); return; }
      if (e.target.closest(".lang-close") || (!first && e.target === m)) close();
    });
    function key(e) {
      if (e.key === "Escape" && !first) { e.preventDefault(); close(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); const i = btns.indexOf(document.activeElement);
        btns[(i + (e.key === "ArrowDown" ? 1 : btns.length - 1)) % btns.length].focus();
      }
      if (e.key === "Tab") {                                       // fokus oynadan chiqib ketmasin
        const f = [...m.querySelectorAll("button")], i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      }
    }
    document.addEventListener("keydown", key, true);
  }
  function navButton() {
    const ul = document.querySelector(".nav ul"); if (!ul || ul.querySelector(".nav-lang")) return;
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" class="nav-lang" translate="no" aria-label="Language / Til" title="Language"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg><b>${active().toUpperCase()}</b></button>`;
    ul.appendChild(li);
    li.querySelector("button").addEventListener("click", () => picker(false));
  }

  // ---------- Ishga tushirish ----------
  function boot() {
    navButton();
    load(active(), () => {
      applyAll();
      obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      if (!lang) picker(true);                                      // birinchi kirish: til so'raladi
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  // Ishlab chiquvchi uchun: sahifadagi o'zbekcha matnlarni yig'ish (lug'at tuzish uchun)
  function harvest() {
    const out = new Set(), add = s => { let i = 0; const k = norm(s || "").replace(NUM, () => `{${i++}}`); if (/[A-Za-zʻ']{2}/.test(k)) out.add(k); };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (!skip(n.parentElement)) add(srcText.get(n) ?? n.nodeValue);
    document.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach(el => { if (!skip(el)) ATTRS.forEach(a => el.hasAttribute(a) && add((srcAttr.get(el) || {})[a] ?? el.getAttribute(a))); });
    add(titleSrc ?? document.title);
    return [...out];
  }
  return { t, set, ensure: code => new Promise(r => load(code, r)), get lang() { return active(); }, chosen: () => !!lang, langs: LANGS, picker: () => picker(false), harvest, name: c => (LANGS.find(l => l.code === (c || active())) || {}).en };
})();
window.UstunI18n = UstunI18n;   // const global window'da ko'rinmaydi: boshqa skriptlar (AI, Sozlamalar) window orqali oladi
