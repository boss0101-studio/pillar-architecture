// Rasmdan dizayn: uy (fasad), xona yoki hovli rasmini yuklab (telefonda — kamera bilan) dizayn rejasini tuzish.
// Har doim ishlaydi (oflayn): rasmdagi asosiy ranglar (k-o'rtacha), tanlangan uslub, maqsad va byudjet bo'yicha reja —
// har qism uchun maslahat, rang palitrasi, materiallar, ish tartibi, taxminiy narx va muddat.
// Claude ulangan bo'lsa (artifact yoki server) — rasmni o'zi ko'rib, qo'shimcha tahlil va Konstruktor parametrlarini beradi.
const UstunRasm = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n0 = v => Math.round(v).toLocaleString("ru-RU");
  const web = () => typeof showView === "function";
  const I18N = () => window.UstunI18n;
  const T = s => { const L = I18N() ? I18N().lang : "uz", d = L !== "uz" && window.USTUN_I18N ? (USTUN_I18N[L] || USTUN_I18N.en) : null; return (d && d[s]) || s; };
  const KEY = "ustun-rasm";

  // ---------- Tanlovlar ----------
  const KINDS = { fasad: "Uy tashqi ko'rinishi", xona: "Xona ichi (interyer)", hovli: "Hovli va landshaft" };
  const GOALS = { tamir: "Ta'mirlash va yangilash", qayta: "Qayta qurish", yangi: "Shu uslubda yangi qurish" };
  const BUDGETS = { tejam: "Tejamkor", orta: "O'rtacha", premium: "Premium" };
  const STYLES = {
    zamonaviy: { n: "Zamonaviy", d: "Toza chiziqlar, katta oynalar, tekis yoki past nishabli tom, tabiiy material va metall uyg'unligi.",
      pal: ["#f2f0eb", "#2b2f33", "#a77b55", "#8c9399", "#c9d3d9"], k: { material: "oqgisht", roof: "tekis", window: "panorama" },
      fasad: { walls: "Oq yoki och kulrang suvoq, bir qismida yog'och yoki keramogranit panel aksent sifatida.", roof: "Tekis yoki 10–15° nishabli tom, ingichka karniz, yashirin tarnov.", win: "Katta panorama derazalar, qora alyuminiy rom, ikki kamerali paket.", entry: "Tekis kanop (soyabon), metall eshik, raqamli qulf.", light: "Fasad bo'ylab pastdan-yuqoriga yorituvchi LED chiroqlar, yo'lak chiroqlari.", yard: "Geometrik yo'laklar, maysa, 2–3 ta dekorativ daraxt, beton plitalar." },
      xona: { walls: "Och neytral bo'yoq, bitta aksent devor (yog'och reyka yoki to'q rang).", floor: "Katta formatli keramogranit yoki laminat (eman rangi).", ceil: "Tekis gipsokarton shift, chiziqli LED profillar.", light: "Ichki shiftga o'rnatilgan spotlar + osma chiroq ovqat stoli ustida.", furn: "Oddiy shakldagi mebel, yashirin tutqichlar, ochiq javonlar kam.", decor: "1–2 ta katta rasm, yashil o'simlik, gilam — oddiy geometrik." },
      hovli: { paths: "To'g'ri chiziqli beton yoki granit plitalar.", green: "Maysa, past butalar, 2–3 ta dekorativ daraxt.", water: "To'rtburchak hovuz yoki devor favvorasi.", rest: "Ayvon ostida yumshoq o'rindiqlar, gril joyi.", light: "Past ustunli LED chiroqlar, daraxtlarni pastdan yoritish.", fence: "Gorizontal reykali yog'och yoki metall to'siq." } },
    klassik: { n: "Klassik", d: "Simmetriya, karniz va moldinglar, nishabli tom, iliq ranglar va naqshli detallar.",
      pal: ["#efe6d6", "#b9a07a", "#7a5a3a", "#4a3a2e", "#d8c9a8"], k: { material: "travertin", roof: "nishab", window: "arkali" },
      fasad: { walls: "Travertin yoki dekorativ suvoq, burchaklarda rustlar, deraza atrofida moldinglar.", roof: "To'rt yoki ikki nishabli tom, cherepitsa, keng karniz.", win: "Arkali yoki to'g'ri burchakli derazalar, oq rom, sun'iy shpros.", entry: "Ustunli ayvon, yog'och eshik, zinapoyalar.", light: "Devor fonarlari (bra) eshik va burchaklarda.", yard: "Simmetrik gulzorlar, kesilgan butalar, favvora." },
      xona: { walls: "Och bej yoki krem rang, moldinglar bilan panellar.", floor: "Parket (yolka naqsh) yoki marmar plitka.", ceil: "Karniz va rozetkali shift.", light: "Qandil + devor bralari.", furn: "Yumshoq kreslo va divanlar, o'yma yog'och mebel.", decor: "Pardalar, ramkali rasmlar, ko'zgular, gilam." },
      hovli: { paths: "Tosh yoki bruschatka, egri bo'lmagan simmetrik yo'laklar.", green: "Kesilgan buta devorchalar, atirgul gulzorlari.", water: "Markazda dumaloq favvora.", rest: "Ustunli so'ri yoki besedka.", light: "Klassik fonar ustunlari.", fence: "Metall panjara va g'isht ustunlar." } },
    milliy: { n: "Milliy (o'zbek)", d: "Hovli markazida, ayvon, ganch va yog'och o'ymakorligi, koshin aksentlar, iliq tuproq ranglari.",
      pal: ["#efe7d8", "#c9a36b", "#2f5fae", "#1f8a8a", "#7a4a2e"], k: { material: "ganch", roof: "tekis", window: "arkali" },
      fasad: { walls: "Oq ganch yoki pishiq g'isht, kirish atrofida koshin bezak.", roof: "Tekis tom yoki ayvon ustida yog'och ship.", win: "Arkali derazalar, panjara (panjara naqsh) bilan.", entry: "O'yma yog'och darvoza, ayvon ustunlari (o'ymakor).", light: "Mis yoki naqshli fonarlar, ayvon ostida iliq yorug'lik.", yard: "Markazda hovuz yoki favvora, so'ri, mevali daraxtlar, tok." },
      xona: { walls: "Ganch o'ymakorlik bilan bezak, tokchalar (devor nishalari).", floor: "Gilam yoki iliq rangli parket.", ceil: "Bo'yalgan yog'och shift yoki ganch naqsh.", light: "Mis qandil, naqshli chiroqlar.", furn: "Xontaxta, ko'rpachalar, past o'rindiqlar.", decor: "Suzane, atlas yostiqlar, sopol idishlar." },
      hovli: { paths: "Pishiq g'isht yo'laklar.", green: "Mevali daraxtlar (o'rik, anor), tok, rayhon.", water: "Hovuz yoki ariqcha.", rest: "So'ri yoki supa, ayvon.", light: "Naqshli fonarlar.", fence: "Baland g'isht devor, yog'och darvoza." } },
    minimal: { n: "Minimalizm", d: "Kam element, oq va kulrang, yashirin saqlash joylari, ortiqcha bezaksiz.",
      pal: ["#ffffff", "#e6e6e3", "#b7b9b8", "#3a3d40", "#c2a27c"], k: { material: "beton", roof: "tekis", window: "kvadrat" },
      fasad: { walls: "Silliq beton yoki oq suvoq, chokli panellar.", roof: "Tekis tom, parapetsiz ko'rinish.", win: "Ramkasiz ko'rinadigan katta oynalar, kvadrat shakllar.", entry: "Devor bilan bir tekis yashirin eshik.", light: "Yashirin chiziqli yoritish.", yard: "Shag'al, bitta daraxt, maysa." },
      xona: { walls: "Oq mat bo'yoq.", floor: "Mikrotsement yoki och laminat.", ceil: "Tekis shift, yashirin karniz.", light: "Yashirin LED lentalar, kam spotlar.", furn: "O'rnatma shkaflar, past divan.", decor: "Deyarli yo'q: bitta o'simlik yoki rasm." },
      hovli: { paths: "Shag'al va beton plitalar.", green: "Maysa, bitta haykaldek daraxt.", water: "Tekis suv yuzasi.", rest: "Beton skameyka.", light: "Yerga o'rnatilgan chiroqlar.", fence: "Silliq oq devor." } },
    skandi: { n: "Skandinav", d: "Ko'p yorug'lik, oq va och yog'och, qulaylik (hygge), tabiiy to'qimalar.",
      pal: ["#f7f5f0", "#d9c7a7", "#9fb3a6", "#5c6b73", "#2d3436"], k: { material: "yogoch", roof: "nishab", window: "oddiy" },
      fasad: { walls: "Vertikal yog'och qoplama (oq yoki kulrang), qisman suvoq.", roof: "Tik nishabli metall yoki cherepitsa tom, karnizsiz.", win: "Oq romli katta derazalar.", entry: "Yog'och terrasa va soyabon.", light: "Iliq rangli devor chiroqlari.", yard: "Tabiiy maysa, yog'och terrasa, o'tlar." },
      xona: { walls: "Oq devorlar.", floor: "Och eman parket.", ceil: "Oq shift, ba'zan yog'och to'sinlar.", light: "Osma chiroqlar, torsherlar — iliq yorug'lik.", furn: "Yog'och oyoqli mebel, yumshoq to'qimalar.", decor: "Jun pledlar, o'simliklar, sodda gilam." },
      hovli: { paths: "Yog'och taxta yo'laklar.", green: "Tabiiy o'tlar, archa.", water: "Kichik tabiiy hovuz.", rest: "Yog'och terrasa, gulxan joyi.", light: "Girlyanda chiroqlar.", fence: "Yog'och reykali to'siq." } },
    loft: { n: "Loft", d: "Sanoat ruhi: ochiq g'isht, beton, qora metall, katta oynalar, ochiq kommunikatsiyalar.",
      pal: ["#3b3b3b", "#8a4b32", "#b0aaa0", "#1f1f1f", "#d6c3a5"], k: { material: "gisht", roof: "tekis", window: "panorama" },
      fasad: { walls: "Ochiq pishiq g'isht, qora metall elementlar.", roof: "Tekis tom, metall parapet.", win: "Qora metall romli katta derazalar (shprosli).", entry: "Metall eshik, beton zina.", light: "Sanoat uslubidagi metall fonarlar.", yard: "Beton plitalar, metall gulzorlar." },
      xona: { walls: "Ochiq g'isht yoki beton effekt suvoq.", floor: "Polirovka qilingan beton yoki to'q parket.", ceil: "Ochiq quvurlar va to'sinlar, to'q rang.", light: "Edison lampalar, metall osma chiroqlar.", furn: "Teri divan, metall va yog'och stol.", decor: "Katta afishalar, metall javonlar." },
      hovli: { paths: "Beton plitalar.", green: "Metall qutilarda o'simliklar.", water: "Metall idishli favvora.", rest: "Gril va bar stol.", light: "Girlyanda Edison lampalar.", fence: "Qora metall to'r yoki profil." } },
  };
  const PARTS = {
    fasad: [["walls", "Devorlar va pardoz"], ["roof", "Tom"], ["win", "Deraza va eshiklar"], ["entry", "Kirish va ayvon"], ["light", "Fasad yoritilishi"], ["yard", "Atrof va hovli"]],
    xona: [["walls", "Devorlar"], ["floor", "Pol"], ["ceil", "Shift"], ["light", "Yoritish"], ["furn", "Mebel"], ["decor", "Dekor va to'qimachilik"]],
    hovli: [["paths", "Yo'laklar"], ["green", "Ko'kalamzorlashtirish"], ["water", "Suv elementi"], ["rest", "Dam olish joyi"], ["light", "Yoritish"], ["fence", "To'siq"]],
  };
  // $/m² (ish + material), muddat — hafta / 100 m²
  const RATE = { fasad: { tejam: 25, orta: 45, premium: 90 }, xona: { tejam: 60, orta: 120, premium: 250 }, hovli: { tejam: 15, orta: 35, premium: 80 } };
  const AREA0 = { fasad: 150, xona: 20, hovli: 200 }, WEEKS = { fasad: 4, xona: 6, hovli: 3 };
  const STEPS = {
    tamir: ["O'lchov va hozirgi holatni suratga olish, nuqsonlar ro'yxati", "Rang va materiallarni tanlash, namunalarni joyida sinash", "Eski qoplamani tozalash, yoriqlarni yamash, gruntlash", "Asosiy pardoz ishlari (devor, pol yoki fasad)", "Deraza-eshik, yoritish va detallarni almashtirish", "Yakuniy tozalash, dekor va qabul qilish"],
    qayta: ["Konstruksiyani tekshirish (muhandis xulosasi)", "Loyiha: reja, fasad, kommunikatsiyalar (Konstruktor va Loyiha bo'limlari)", "Ruxsatnomalar (hokimiyat, arxitektura bo'limi)", "Demontaj va konstruktiv ishlar", "Muhandislik tarmoqlari va pardoz", "Obodonlashtirish va topshirish"],
    yangi: ["Uchastka va talablarni aniqlash (GP)", "Konstruktorda eskiz loyiha va 3D ko'rinish", "Loyiha bo'limlari: AR, KR, OV, VK, EOM, smeta", "Ruxsatnoma va pudratchi tanlash", "Qurilish (POS kalendar rejasi bo'yicha)", "Pardoz, hovli va topshirish"],
  };

  // ---------- Rasm: yuklash, kichraytirish, asosiy ranglar ----------
  let img = null;          // { blob, dataUrl, thumb, pal }
  async function readImage(file) {
    if (!file || !/^image\//.test(file.type)) return null;
    const url = URL.createObjectURL(file);
    try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const draw = max => { const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); return c; };
      const big = draw(1280), blob = await new Promise(r => big.toBlob(r, "image/jpeg", 0.85));
      return { blob, dataUrl: big.toDataURL("image/jpeg", 0.85), thumb: draw(200).toDataURL("image/jpeg", 0.7), pal: palette(draw(72)), work: draw(360), ar: big.width / big.height };   // work — moslash tahlili uchun
    } catch { return null; } finally { URL.revokeObjectURL(url); }
  }
  // k-o'rtacha (6 klaster): rasmdagi asosiy ranglar va ulushi
  function palette(c) {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, px = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    const K = 6; let cen = Array.from({ length: K }, (_, i) => px[Math.floor((i + 0.5) * px.length / K)].slice());
    let lab = new Array(px.length).fill(0);
    for (let it = 0; it < 10; it++) {
      px.forEach((p, i) => { let b = 0, bd = 1e9; cen.forEach((q, j) => { const dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (dd < bd) { bd = dd; b = j; } }); lab[i] = b; });
      const s = cen.map(() => [0, 0, 0, 0]); px.forEach((p, i) => { const t = s[lab[i]]; t[0] += p[0]; t[1] += p[1]; t[2] += p[2]; t[3]++; });
      cen = s.map((t, j) => (t[3] ? [t[0] / t[3], t[1] / t[3], t[2] / t[3]] : cen[j]));
    }
    const cnt = cen.map(() => 0); lab.forEach(l => cnt[l]++);
    return cen.map((q, j) => ({ rgb: q.map(Math.round), share: cnt[j] / px.length })).filter(x => x.share > 0.02).sort((a, b) => b.share - a.share);
  }
  const hex = rgb => "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("");
  function hsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
  }
  function colorName(rgb) {
    const { h, s, l } = hsl(rgb);
    if (l > 0.88) return "Oq"; if (l < 0.13) return "Qora";
    if (s < 0.14) return l > 0.6 ? "Och kulrang" : l > 0.35 ? "Kulrang" : "To'q kulrang";
    if (h < 15 || h >= 345) return l < 0.35 ? "To'q qizil" : "Qizil";
    if (h < 40) return l < 0.4 ? "Jigarrang" : s < 0.45 ? "Bej" : "Terrakota";
    if (h < 65) return l > 0.65 ? "Krem" : "Sariq";
    if (h < 160) return l < 0.3 ? "To'q yashil" : "Yashil";
    if (h < 200) return "Feruza";
    if (h < 250) return l > 0.6 ? "Havorang" : "Ko'k";
    return "Binafsha";
  }
  function moodOf(pal) {
    const w = pal.reduce((a, p) => a + p.share, 0) || 1;
    const L = pal.reduce((a, p) => a + hsl(p.rgb).l * p.share, 0) / w;
    const warm = pal.reduce((a, p) => { const { h, s } = hsl(p.rgb); return a + ((h < 70 || h > 330) && s > 0.12 ? p.share : 0); }, 0) / w;
    const cool = pal.reduce((a, p) => { const { h, s } = hsl(p.rgb); return a + (h > 160 && h < 280 && s > 0.12 ? p.share : 0); }, 0) / w;
    return { light: L, tone: warm > cool + 0.1 ? "iliq" : cool > warm + 0.1 ? "sovuq" : "neytral" };
  }

  // ---------- Oflayn reja ----------
  function plan(o) {
    const S = STYLES[o.style], kind = o.kind, area = Number(o.area) || AREA0[kind], rate = RATE[kind][o.budget];
    const scope = o.goal === "tamir" ? 1 : o.goal === "qayta" ? 1.6 : 2.4;                        // qayta va yangi qurishda ko'proq ish
    const cost = area * rate * scope, weeks = Math.max(1, Math.round(WEEKS[kind] * Math.max(0.5, area / (kind === "xona" ? 20 : 100)) * (o.goal === "tamir" ? 1 : 1.8)));
    const mood = img ? moodOf(img.pal) : null, keep = img && img.pal.find(p => { const c = hsl(p.rgb); return c.s > 0.25 && c.l > 0.22 && c.l < 0.85; });   // aksent: to'yingan, juda to'q yoki oq emas
    const notes = [];
    if (mood) {
      notes.push(`Rasm umumiy ${mood.light > 0.62 ? "yorug'" : mood.light < 0.38 ? "to'q" : "o'rtacha yorug'likda"}, ranglari ${mood.tone}.`);
      if (mood.light < 0.38 && kind !== "hovli") notes.push("Yorug'lik kam: och ranglar, katta oynalar va ko'proq chiroq makonni kengroq ko'rsatadi.");
      if (mood.tone === "sovuq" && /milliy|klassik/.test(o.style)) notes.push("Tanlangan uslub iliq ranglarni talab qiladi: yog'och va bej tuslar bilan muvozanatlang.");
      if (keep) notes.push(`Rasmda ko'zga tashlanadigan rang — ${colorName(keep.rgb)} (${hex(keep.rgb)}): uni aksent sifatida saqlab qolish mumkin.`);
    }
    return { S, kind, area, cost, lo: cost * 0.8, hi: cost * 1.25, weeks, notes, parts: PARTS[kind].map(([k, n]) => [n, S[kind][k]]), steps: STEPS[o.goal], keep };
  }

  // ---------- AI (Claude) ----------
  let sample = null, server = null;
  if (window.claude && typeof window.claude.use === "function") window.claude.use("sample").then(s => { sample = s || null; refreshAIState(); }).catch(() => {});
  async function hasServer() {
    if (server !== null) return server;
    if (document.querySelector('meta[name="ustun-mode"][content="static"]')) return (server = false);
    try { const r = await fetch("/api/ai/status"); const d = await r.json(); server = !!(r.ok && d.enabled); } catch { server = false; }
    return server;
  }
  const langName = () => (I18N() && I18N().name ? I18N().name() : "Uzbek") || "Uzbek";
  function prompt(o) {
    return `You are an architect and interior designer for the "Pillar Architecture" website. Look at the attached photo of ${o.kind === "fasad" ? "a house exterior (facade)" : o.kind === "xona" ? "a room interior" : "a yard / garden"}. ` +
      `The owner wants: goal "${GOALS[o.goal]}", style "${STYLES[o.style].n}", budget "${BUDGETS[o.budget]}", area about ${o.area || AREA0[o.kind]} m². ` +
      `Write all text values in ${langName()}. Be concrete and practical, mention what you actually see. ` +
      `Reply with ONLY a JSON object, no other text: {"seen": "2-3 sentences: what is in the photo and its current condition", "keep": ["what is worth keeping"], "issues": ["problems to fix"], ` +
      `"ideas": [{"area": "part of the building/room", "advice": "specific design advice"}] (5-7 items), "palette": ["#rrggbb" x5], "materials": ["specific materials"], ` +
      `"konstruktor": {"material": one of ${JSON.stringify(Object.keys(MATERIALS || {}))}, "roof": one of ["tekis","nishab","bir","piramida","gumbaz","terrasa"], "window": one of ["oddiy","arkali","panorama","tor","kvadrat","baland","uchtabaqa"], "floors": integer 1-5}, ` +
      `"match": (only for a house exterior: the CURRENT building exactly as photographed, so it can be rebuilt identically) {"box": [x0, y0, x1, y1] fractions 0-1 of image width/height enclosing the main facade walls WITHOUT the roof, ` +
      `"floors": number of storeys (rows of windows), "bays": number of window columns on the main facade (2-12), "floor_h": metres 2.7-4.5, "depth_m": estimated building depth 6-30, ` +
      `"roof": one of ["tekis","nishab","bir","piramida","gumbaz","terrasa"], "material": main wall material, one of ${JSON.stringify(Object.keys(MATERIALS || {}))}, "window": typical window, one of ["oddiy","arkali","panorama","tor","kvadrat","baland","uchtabaqa"], ` +
      `"ground": one of ["oddiy","vitrina","arkada"], "cells": [{"floor": 1-based from the bottom, "bay": 1-based from the left, "type": one of ["balc","door","wall","shop","garage","wide","arch","tall","glassdoor","door2"]}] — only cells that differ from a normal window}}. ` +
      `If the photo is not a building, room or yard, set "seen" to a short note saying so and leave other arrays empty.`;
  }
  function parseJSON(t) {
    if (!t) return null; const m = /\{[\s\S]*\}/.exec(String(t)); if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
  async function askAI(o) {
    if (sample) {
      const lim = (sample.limits ? await sample.limits().catch(() => null) : null) || {};
      if (lim.images) { const r = await sample(prompt(o), { images: [img.blob], cache: false }); return parseJSON(r && r.text); }
    }
    if (await hasServer()) {
      const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        messages: [{ role: "user", content: prompt(o) }], context: "Sahifa: Rasmdan dizayn", page: "rasm", lang: I18N() ? I18N().lang : "uz", image: img.dataUrl }) });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || String(r.status));
      return parseJSON(d.text);
    }
    return null;
  }
  const aiAvailable = () => !!sample || server === true;
  function refreshAIState() { const el = document.querySelector("[data-rz-ai]"); if (el) el.textContent = aiAvailable() ? T("Claude AI rasmni o'zi ko'rib chiqadi") : T("Oflayn reja: ranglar va tanlovlar bo'yicha (AI ulanganda rasm ham tahlil qilinadi)"); }

  // ---------- Rasmdagi uyni Konstruktorga moslash ----------
  // Ramka (rect, rasmga nisbatan 0..1) — devorlar chegarasi (tomsiz); ichida qavat × oraliq to'ri. Katak bosilsa turi almashadi.
  // Bino eni ramka proporsiyasidan: W = (ramka eni / ramka balandligi) × qavatlar × qavat balandligi.
  const CYCLE = ["auto", "balc", "door", "wall", "shop", "garage", "wide", "arch", "tall"];
  const CELL_SHORT = { auto: "", balc: "B", door: "E", wall: "▮", shop: "V", garage: "G", wide: "P", arch: "A", tall: "T" };
  const ROOFS = { tekis: "Tekis", nishab: "Nishab (ikki tomonga)", bir: "Bir nishabli", piramida: "Piramida", gumbaz: "Gumbaz", terrasa: "Terrasa" };
  const GROUNDS = { oddiy: "Oddiy (deraza va eshik)", vitrina: "Vitrina (do'kon)", arkada: "Arkada" };
  let match = null;
  const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
  function newMatch() {
    const m = { rect: [0.12, 0.3, 0.88, 0.92], floors: 2, bays: 4, floor_h: 3.0, depth: 10, roof: "nishab", material: "oqgisht", window: "oddiy", ground: "oddiy", cells: {}, src: "taxmin" };
    if (img && img.work) { const e = estimate(m.rect); m.floors = e.floors; m.bays = e.bays; m.material = e.material; }
    return m;
  }
  // Rasm piksellari bo'yicha taxmin: qavat/ustun — yorqinlik o'zgarishi profilidagi davriylik; material — devor rangi
  function estimate(rect) {
    const c = img.work, w = c.width, h = c.height, d = c.getContext("2d").getImageData(0, 0, w, h).data;
    const x0 = Math.floor(rect[0] * w), x1 = Math.ceil(rect[2] * w), y0 = Math.floor(rect[1] * h), y1 = Math.ceil(rect[3] * h);
    const g = (x, y) => { const i = (y * w + x) * 4; return 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; };
    const rows = [], cols = [];
    for (let y = y0 + 1; y < y1; y++) { let s = 0; for (let x = x0; x < x1; x++) s += Math.abs(g(x, y) - g(x, y - 1)); rows.push(s); }
    for (let x = x0 + 1; x < x1; x++) { let s = 0; for (let y = y0; y < y1; y++) s += Math.abs(g(x, y) - g(x - 1, y)); cols.push(s); }
    const period = (p, lo, hi) => {
      const n = p.length, k0 = Math.max(2, Math.floor(lo)), k1 = Math.min(n - 2, Math.ceil(hi)); if (k1 <= k0) return null;
      const sm = p.map((_, i) => { let s = 0, c2 = 0; for (let j = i - 6; j <= i + 6; j++) if (j >= 0 && j < n) { s += p[j]; c2++; } return p[i] - s / c2; });
      const v0 = sm.reduce((a, b) => a + b * b, 0) || 1; let best = null, bv = 0.12;
      for (let k = k0; k <= k1; k++) { let s = 0; for (let i = 0; i + k < n; i++) s += sm[i] * sm[i + k]; const r = s / v0; if (r > bv) { bv = r; best = k; } }
      return best;
    };
    const ph = period(rows, rows.length / 6, rows.length / 1.2), pw = period(cols, cols.length / 12, cols.length / 2);
    const floors = clampN(ph ? Math.round(rows.length / ph) : 2, 1, 6), bays = clampN(pw ? Math.round(cols.length / pw) : 4, 2, 12);
    // devor rangi: o'rtacha yorqinlikdagi piksellar
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * w + x) * 4, L = (d[i] + d[i + 1] + d[i + 2]) / 765; if (L > 0.22 && L < 0.92) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
    let material = "oqgisht";
    if (n) {
      const m = [r / n, gg / n, b / n], dist = hx => { const c2 = new THREE_Color(hx); return (c2[0] - m[0]) ** 2 + (c2[1] - m[1]) ** 2 + (c2[2] - m[2]) ** 2; };
      material = Object.keys(MATERIALS).filter(k => k !== "shisha" && k !== "koshin").sort((a2, b2) => dist(MATERIALS[a2].fill) - dist(MATERIALS[b2].fill))[0];
    }
    return { floors, bays, material };
  }
  function THREE_Color(hx) { const v = parseInt(String(hx).slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function matchParams(style) {
    const m = match, [x0, y0, x1, y1] = m.rect, H = m.floors * m.floor_h;
    const W = ((x1 - x0) * (img ? img.ar : 1.5)) / Math.max(0.02, y1 - y0) * H;
    const bay_w = clampN(Math.round(W / m.bays * 10) / 10, 3, 7.5);
    const p = { ...DEFAULT_PARAMS, category: "turar-joy", shape: "rect", floors: m.floors, bays: m.bays, floor_h: m.floor_h, bay_w, depth: m.depth, roof: m.roof, material: m.material, window: m.window, ground: m.ground };
    if (style) { const k = (ai && ai.konstruktor) || STYLES[st.style].k; if (k.material) p.material = k.material; if (k.window && k.window !== "yoq") p.window = k.window; }
    return { p, W, clamped: bay_w !== Math.round(W / m.bays * 10) / 10 };
  }
  const cellsOf = () => Object.fromEntries(Object.entries(match.cells).filter(([k, t]) => t !== "auto" && Number(k.split(",")[0]) < match.floors && Number(k.split(",")[1]) < match.bays));
  function renderMatch() {
    const box = $("rzMatch"); if (!box || !img) return;
    if (!match) match = newMatch();
    const m = match, sel = (name, obj) => `<select data-rzm="${name}">${Object.entries(obj).map(([k, v]) => `<option value="${k}"${m[name] === k ? " selected" : ""}>${esc(typeof v === "string" ? v : v.label)}</option>`).join("")}</select>`;
    const step = (name, lo, hi) => `<span class="rzm-step"><button type="button" data-rzs="${name}" data-d="-1" aria-label="Kamaytirish">−</button><b>${m[name]}</b><button type="button" data-rzs="${name}" data-d="1" aria-label="Ko'paytirish">+</button></span>`;
    const winTypes = Object.fromEntries(Object.keys(WINDOW_CELL).filter(k => k !== "yoq").map(k => [k, CELL_LABELS[WINDOW_CELL[k]] || k]));
    box.innerHTML = `<div class="rzm-head"><b>Rasmdagi uyni Konstruktorga moslash</b><small>${m.src === "ai" ? "Claude rasmdan aniqladi — kerak bo'lsa tuzating" : "Taxminiy: ramkani devorlarga (tomsiz) qo'ying, so'ng chiziqlar derazalarga to'g'ri kelguncha qavat va ustunlarni sozlang"}</small></div>
      <div class="rzm-grid">
        <div class="rzm-photo" data-rzm-photo><img src="${img.dataUrl}" alt="Yuklangan uy rasmi" draggable="false"><div class="rzm-rect" data-rzm-rect></div></div>
        <div class="rzm-side">
          <div class="rzm-ctl">
            <label>Qavatlar ${step("floors")}</label><label>Deraza ustunlari ${step("bays")}</label>
            <label>Qavat balandligi, m <input type="number" min="2.7" max="4.5" step="0.1" value="${m.floor_h}" data-rzm="floor_h"></label>
            <label>Chuqurligi, m <input type="number" min="6" max="30" step="0.5" value="${m.depth}" data-rzm="depth"></label>
            <label>Tom ${sel("roof", ROOFS)}</label><label>Material ${sel("material", MATERIALS)}</label>
            <label>Deraza turi ${sel("window", winTypes)}</label><label>Pastki qavat ${sel("ground", GROUNDS)}</label>
          </div>
          <p class="muted rzm-hint">Katakni bosing — turi almashadi: deraza → balkon → eshik → devor → vitrina → garaj… <span data-rzm-size></span></p>
          <div class="rzm-prev" data-rzm-prev aria-label="Konstruktordagi ko'rinish"></div>
          <div class="rzm-act"><button type="button" class="btn" data-rz-act="build-exact">Konstruktorda aslidek qurish</button><button type="button" class="btn-ghost" data-rz-act="build-style">${esc(STYLES[st.style].n)} uslubida qayta qurish</button></div>
        </div>
      </div>`;
    drawRect(); drawPrev();
  }
  function drawRect() {
    const el = document.querySelector("[data-rzm-rect]"); if (!el) return;
    const m = match, [x0, y0, x1, y1] = m.rect;
    Object.assign(el.style, { left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` });
    el.style.gridTemplateColumns = `repeat(${m.bays}, 1fr)`; el.style.gridTemplateRows = `repeat(${m.floors}, 1fr)`;
    let cells = "";
    for (let row = 0; row < m.floors; row++) for (let b = 0; b < m.bays; b++) {
      const f = m.floors - 1 - row, t = m.cells[`${f},${b}`] || "auto";
      cells += `<button type="button" class="rzm-c${t !== "auto" ? " on" : ""}" data-rzc="${f},${b}" title="${f + 1}-qavat, ${b + 1}-ustun: ${esc(t === "auto" ? "deraza" : CELL_LABELS[t] || t)}">${CELL_SHORT[t] || ""}</button>`;
    }
    el.innerHTML = cells + ["nw", "ne", "sw", "se"].map(c => `<i class="rzm-h ${c}" data-rzh="${c}" aria-hidden="true"></i>`).join("") + `<i class="rzm-h mv" data-rzh="mv" title="Ramkani surish" aria-hidden="true">✥</i>`;
  }
  function drawPrev() {
    const el = document.querySelector("[data-rzm-prev]"); if (!el || typeof renderFacade !== "function") return;
    const { p, W, clamped } = matchParams(false);
    el.innerHTML = renderFacade(p, cellsOf(), { dims: true, uid: "rzm" });
    const sz = document.querySelector("[data-rzm-size]");
    if (sz) sz.textContent = `Bino: ${(Math.round(p.bays * p.bay_w * 10) / 10).toLocaleString("ru-RU")} × ${p.depth} m, ${p.floors} qavat.${clamped ? ` (Rasm bo'yicha eni ${Math.round(W)} m — oraliq 3–7,5 m chegarasiga keltirildi.)` : ""}`;
  }
  // AI javobidagi "match" — ramka, qavatlar, kataklar
  function applyAIMatch(a) {
    if (!a || typeof a !== "object") return;
    const m = newMatch(), box = Array.isArray(a.box) && a.box.length === 4 && a.box.every(v => Number.isFinite(Number(v))) ? a.box.map(Number) : null;
    if (box && box[2] > box[0] + 0.05 && box[3] > box[1] + 0.05) m.rect = box.map(v => clampN(v, 0, 1));
    if (Number(a.floors)) m.floors = clampN(Math.round(a.floors), 1, 30);
    if (Number(a.bays)) m.bays = clampN(Math.round(a.bays), 2, 12);
    if (Number(a.floor_h)) m.floor_h = clampN(Number(a.floor_h), 2.7, 4.5);
    if (Number(a.depth_m)) m.depth = clampN(Number(a.depth_m), 6, 30);
    if (ROOFS[a.roof]) m.roof = a.roof; if (MATERIALS[a.material]) m.material = a.material;
    if (WINDOW_CELL[a.window] && a.window !== "yoq") m.window = a.window; if (GROUNDS[a.ground]) m.ground = a.ground;
    (Array.isArray(a.cells) ? a.cells : []).forEach(c => { const f = Math.round(c.floor) - 1, b = Math.round(c.bay) - 1; if (f >= 0 && f < m.floors && b >= 0 && b < m.bays && CELL_LABELS[c.type] && c.type !== "auto") m.cells[`${f},${b}`] = c.type; });
    m.src = "ai"; match = m; renderMatch();
  }
  // Ramka burchaklarini va o'zini sudrash
  let drag = null;
  document.addEventListener("pointerdown", e => {
    const h = e.target.closest("[data-rzh]"); if (!h || !match) return;
    const ph = document.querySelector("[data-rzm-photo]").getBoundingClientRect();
    drag = { k: h.dataset.rzh, ph, x: e.clientX, y: e.clientY, r: match.rect.slice() }; e.preventDefault();
    try { h.setPointerCapture(e.pointerId); } catch {}
  });
  document.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / drag.ph.width, dy = (e.clientY - drag.y) / drag.ph.height, r = drag.r.slice(), k = drag.k;
    if (k === "mv") { const w = r[2] - r[0], h = r[3] - r[1]; r[0] = clampN(r[0] + dx, 0, 1 - w); r[1] = clampN(r[1] + dy, 0, 1 - h); r[2] = r[0] + w; r[3] = r[1] + h; }
    else { if (k.includes("w")) r[0] = clampN(r[0] + dx, 0, r[2] - 0.05); if (k.includes("e")) r[2] = clampN(r[2] + dx, r[0] + 0.05, 1); if (k.includes("n")) r[1] = clampN(r[1] + dy, 0, r[3] - 0.05); if (k.includes("s")) r[3] = clampN(r[3] + dy, r[1] + 0.05, 1); }
    match.rect = r; const el = document.querySelector("[data-rzm-rect]");
    if (el) Object.assign(el.style, { left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${(r[2] - r[0]) * 100}%`, height: `${(r[3] - r[1]) * 100}%` });
  });
  document.addEventListener("pointerup", () => { if (drag) { drag = null; drawPrev(); } });

  // ---------- Holat va ko'rinish ----------
  let st = { kind: "fasad", style: "zamonaviy", goal: "tamir", budget: "orta", area: "" }, last = null, ai = null, aiBusy = false, aiErr = "";
  try { st = { ...st, ...(JSON.parse(localStorage.getItem(KEY) || "{}").st || {}) }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ st })); } catch {} };
  const seg = (name, obj) => `<div class="rz-seg" role="radiogroup" aria-label="${esc(name)}">${Object.entries(obj).map(([k, v]) => `<button type="button" role="radio" data-rz="${name}" data-v="${k}" aria-checked="${st[name] === k}">${esc(typeof v === "string" ? v : v.n)}</button>`).join("")}</div>`;

  function render() {
    const box = $("rasmApp"); if (!box) return;
    box.innerHTML = `<div class="rz-grid">
      <section class="rz-in">
        <label class="rz-drop${img ? " has" : ""}" data-rz-drop>
          ${img ? `<img src="${img.dataUrl}" alt="Yuklangan rasm">` : `<span class="rz-drop-ic" aria-hidden="true">📷</span><b>Rasm yuklang yoki suratga oling</b><small>JPG, PNG — uy fasadi, xona yoki hovli</small>`}
          <input type="file" accept="image/*" data-rz-file hidden>
        </label>
        <div class="rz-btns"><button type="button" class="btn-ghost" data-rz-act="pick">Rasm tanlash</button><button type="button" class="btn-ghost" data-rz-act="camera">📷 Kamera</button>${img ? `<button type="button" class="btn-ghost" data-rz-act="clear">Olib tashlash</button>` : ""}</div>
        <input type="file" accept="image/*" capture="environment" data-rz-cam hidden>
        ${img ? `<div class="rz-pal" aria-label="Rasmdagi asosiy ranglar">${img.pal.map(p => `<span style="--c:${hex(p.rgb)};flex:${Math.max(0.6, p.share * 10).toFixed(2)}" title="${esc(T(colorName(p.rgb)))} ${hex(p.rgb)} · ${Math.round(p.share * 100)}%"></span>`).join("")}</div>` : ""}
        <h3 class="rz-h">Nima rasmga olindi?</h3>${seg("kind", KINDS)}
        <h3 class="rz-h">Maqsad</h3>${seg("goal", GOALS)}
        <h3 class="rz-h">Uslub</h3>${seg("style", STYLES)}
        <h3 class="rz-h">Byudjet</h3>${seg("budget", BUDGETS)}
        <label class="rz-area">Maydon, m² <input type="number" min="1" max="100000" step="1" placeholder="${AREA0[st.kind]}" value="${esc(st.area)}" data-rz-area></label>
        <button type="button" class="btn cta rz-go" data-rz-act="plan"${img ? "" : " disabled"}>Dizayn rejasini tuzish →</button>
        <p class="muted rz-ai-note" data-rz-ai></p>
      </section>
      <section class="rz-out" aria-live="polite">${last ? out() : `<div class="rz-empty"><b>Reja shu yerda chiqadi</b><p>1. Rasm yuklang · 2. Maqsad, uslub va byudjetni tanlang · 3. "Dizayn rejasini tuzish"ni bosing.</p></div>`}</section>
    </div>
    ${img && st.kind === "fasad" ? `<section class="rz-match" id="rzMatch" aria-label="Rasmdagi uyni Konstruktorga moslash"></section>` : ""}`;
    refreshAIState();
    renderMatch();
  }
  function out() {
    const p = last, S = p.S, web_ = web();
    const k = (ai && ai.konstruktor) || S.k, canBuild = p.kind === "fasad";
    const aiHtml = aiBusy ? `<div class="rz-card rz-ai"><b>AI tahlili</b><p class="rz-wait"><span class="ai-typing"><i></i><i></i><i></i></span> Claude rasmni ko'rib chiqmoqda…</p></div>`
      : ai ? `<div class="rz-card rz-ai"><b>AI tahlili <small>Claude</small></b><p>${esc(ai.seen)}</p>
          ${ai.keep && ai.keep.length ? `<h4>Saqlab qolish kerak</h4><ul>${ai.keep.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          ${ai.issues && ai.issues.length ? `<h4>Tuzatish kerak</h4><ul>${ai.issues.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          ${ai.ideas && ai.ideas.length ? `<h4>G'oyalar</h4><dl class="rz-dl">${ai.ideas.map(x => `<dt>${esc(x.area)}</dt><dd>${esc(x.advice)}</dd>`).join("")}</dl>` : ""}
          ${ai.materials && ai.materials.length ? `<h4>Materiallar</h4><p>${ai.materials.map(esc).join(" · ")}</p>` : ""}</div>`
      : aiErr ? `<p class="muted">${esc(aiErr)}</p>` : "";
    const pal = (ai && Array.isArray(ai.palette) && ai.palette.filter(c => /^#[0-9a-f]{6}$/i.test(c)).length >= 3) ? ai.palette.filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 6) : S.pal;
    return `<div class="rz-head">${img ? `<img src="${img.thumb}" alt="">` : ""}<div><span class="label">${esc(KINDS[p.kind])} · ${esc(GOALS[st.goal])}</span><h2>${esc(S.n)} uslubida dizayn rejasi</h2><p>${esc(S.d)}</p></div></div>
      ${p.notes.length ? `<div class="rz-card"><b>Rasm bo'yicha kuzatuvlar</b><ul>${p.notes.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${aiHtml}
      <div class="rz-card"><b>Rang palitrasi</b><div class="rz-sw">${pal.map(c => `<span><i style="background:${c}"></i><small>${c}</small></span>`).join("")}${p.keep ? `<span class="keep"><i style="background:${hex(p.keep.rgb)}"></i><small>${esc(T("rasmdan"))}</small></span>` : ""}</div></div>
      <div class="rz-card"><b>Qismlar bo'yicha tavsiyalar</b><dl class="rz-dl">${p.parts.map(([n, v]) => `<dt>${esc(n)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
      <div class="rz-card"><b>Ish tartibi</b><ol>${p.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol></div>
      <div class="rz-card rz-cost"><b>Taxminiy narx va muddat</b>
        <div class="rz-kpi"><div><span class="label">Narx</span><strong>$${n0(p.lo)} – $${n0(p.hi)}</strong><small>${n0(p.area)} m² · ${esc(BUDGETS[st.budget])}</small></div><div><span class="label">Muddat</span><strong>~${p.weeks} hafta</strong><small>${esc(GOALS[st.goal])}</small></div></div>
        <p class="muted">Narx material va ish haqi bilan, Toshkent narxlarida taxminiy. Aniq smeta uchun o'lchov va loyiha kerak.</p></div>
      <div class="rz-actions">
        ${canBuild ? `<button type="button" class="btn" data-rz-act="to-match">Konstruktorga moslash ↓</button>` : ""}
        ${p.kind === "xona" ? (web_ ? `<a class="btn-ghost" href="#konstruktor" data-view="konstruktor">Ichki makonni Konstruktorda loyihalash</a>` : `<a class="btn-ghost" href="designer.html">Ichki makonni Konstruktorda loyihalash</a>`) : ""}
        ${p.kind === "hovli" ? (web_ ? `<a class="btn-ghost" href="#gp" data-view="gp">Bosh rejani ochish</a>` : `<a class="btn-ghost" href="gp.html">Bosh rejani ochish</a>`) : ""}
        <button type="button" class="btn-ghost" data-rz-act="print">Chop etish / PDF</button>
        ${!ai && !aiBusy && aiAvailable() ? `<button type="button" class="btn-ghost" data-rz-act="ai">AI bilan qayta tahlil</button>` : ""}
      </div>
      ${canBuild ? `<p class="muted rz-k">Yangi uslub uchun: material — ${esc((MATERIALS[k.material] || {}).label || k.material)}, deraza — ${esc(k.window)}. Bino tuzilishi (qavatlar, ustunlar, tom, balkon va eshiklar) rasmdagidek qoladi — pastdagi moslash bo'limi.</p>` : ""}`;
  }
  const outBox = () => document.querySelector("#rasmApp .rz-out");
  function showOut() { const o = outBox(); if (o) o.innerHTML = out(); }
  async function run() {
    if (!img) return;
    last = plan(st); ai = null; aiErr = ""; aiBusy = false;
    await hasServer();
    if (aiAvailable()) aiBusy = true;
    showOut(); refreshAIState();
    const o = outBox(); if (o && innerWidth < 900) o.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!aiBusy) return;
    try { ai = await askAI(st); if (!ai) aiErr = T("AI javobini o'qib bo'lmadi — oflayn reja ko'rsatildi."); }
    catch (e) { aiErr = T("AI javob bermadi — oflayn reja ko'rsatildi."); }
    aiBusy = false; if (ai && ai.konstruktor) ai.konstruktor = cleanK(ai.konstruktor);
    if (ai && ai.match && st.kind === "fasad") applyAIMatch(ai.match);               // Claude aniqlagan tuzilish — moslash bo'limiga
    showOut();
  }
  function cleanK(k) {
    const R = ["tekis", "nishab", "bir", "piramida", "gumbaz", "terrasa"], W = Object.keys(typeof WINDOW_CELL !== "undefined" ? WINDOW_CELL : {});
    const out = {};
    if (MATERIALS[k.material]) out.material = k.material;
    if (R.includes(k.roof)) out.roof = k.roof;
    if (W.includes(k.window)) out.window = k.window;
    const f = Math.round(Number(k.floors)); if (f >= 1 && f <= 5) out.floors = f;
    return { ...last.S.k, ...out };
  }
  // Konstruktorda yangi loyiha: rasmdagi tuzilish (qavat, ustun, o'lcham, tom, kataklar); style — material va derazalar yangi uslubda
  // Ramka ichidagi devorlar qismi — 3D old fasad teksturasi uchun (eni ≤ 1400 px)
  async function cropFacade() {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = img.dataUrl; });   // decode() fondagi oynada osilib qolishi mumkin
    const [x0, y0, x1, y1] = match.rect, sx = x0 * im.naturalWidth, sy = y0 * im.naturalHeight, sw = (x1 - x0) * im.naturalWidth, sh = (y1 - y0) * im.naturalHeight;
    const k = Math.min(1, 1400 / sw), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
    c.getContext("2d").drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  }
  const photoSig = p => [p.shape || "rect", p.floors, p.bays, Number(p.bay_w).toFixed(2), Number(p.floor_h).toFixed(2)].join("|");   // view3d.js bilan bir xil
  async function build(style) {
    if (!match) match = newMatch();
    const { p } = matchParams(style), cells = Object.entries(cellsOf()).map(([k, t]) => { const [f, b] = k.split(",").map(Number); return { floor: f + 1, bay: b + 1, type: t }; });
    // aslidek: 3D'da old fasad rasmning o'zi; yangi uslub: rasm olib tashlanadi (ko'rinish ataylab o'zgaradi)
    try {
      if (style) localStorage.removeItem("ustun-fasad-foto");
      else localStorage.setItem("ustun-fasad-foto", JSON.stringify({ sig: photoSig(p), img: await cropFacade() }));
    } catch { /* joy yetmasa — 3D odatdagi fasad bilan */ }
    window.dispatchEvent(new Event("ustun-fasad-foto"));
    const acts = [{ type: "new_design", name: style ? `${STYLES[st.style].n} uslubida (rasmdan)` : "Rasmdagi uy", params: p, cells }];
    if (web() && window.AIDesign && AIDesign.available()) {
      const r = AIDesign.apply(acts);
      showView("konstruktor");
      if (r && r.errors && r.errors.length) console.warn(r.errors);
      return;
    }
    try { localStorage.setItem("ustun-rasm-acts", JSON.stringify(acts)); } catch {}
    location.href = "designer.html";
  }

  // ---------- Hodisalar ----------
  async function take(file) {
    const r = await readImage(file); if (!r) return;
    img = r; last = null; ai = null; match = null; render();
  }
  document.addEventListener("click", e => {
    if (!$("rasmApp") || !e.target.closest("#rasmApp")) return;
    const s = e.target.closest("[data-rz]");
    if (s) { st[s.dataset.rz] = s.dataset.v; save(); if (last) { last = plan(st); } render(); return; }
    const c = e.target.closest("[data-rzc]");                          // katak turi: deraza → balkon → eshik → …
    if (c && match) { const k = c.dataset.rzc, t = match.cells[k] || "auto", nx = CYCLE[(CYCLE.indexOf(t) + 1) % CYCLE.length]; if (nx === "auto") delete match.cells[k]; else match.cells[k] = nx; drawRect(); drawPrev(); return; }
    const sp = e.target.closest("[data-rzs]");
    if (sp && match) { const n = sp.dataset.rzs, lim = n === "floors" ? [1, 30] : [2, 12]; match[n] = clampN(match[n] + Number(sp.dataset.d), lim[0], lim[1]); sp.parentElement.querySelector("b").textContent = match[n]; drawRect(); drawPrev(); return; }
    const a = e.target.closest("[data-rz-act]"); if (!a) return;
    const act = a.dataset.rzAct;
    if (act === "pick") document.querySelector("[data-rz-file]").click();
    else if (act === "camera") document.querySelector("[data-rz-cam]").click();
    else if (act === "clear") { img = null; last = null; ai = null; render(); }
    else if (act === "plan" || act === "ai") run();
    else if (act === "build-exact") build(false);
    else if (act === "build-style") build(true);
    else if (act === "to-match") { const m = $("rzMatch"); if (m) m.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (act === "print") { document.documentElement.classList.add("rz-printing"); window.print(); setTimeout(() => document.documentElement.classList.remove("rz-printing"), 800); }
  });
  document.addEventListener("change", e => {
    const f = e.target.closest("[data-rz-file],[data-rz-cam]"); if (f && f.files && f.files[0]) take(f.files[0]);
    const ar = e.target.closest("[data-rz-area]"); if (ar) { st.area = ar.value; save(); if (last) { last = plan(st); showOut(); } }
    const mz = e.target.closest("[data-rzm]");
    if (mz && match) { const n = mz.dataset.rzm, v = mz.value; match[n] = n === "floor_h" ? clampN(Number(v) || 3, 2.7, 4.5) : n === "depth" ? clampN(Number(v) || 10, 6, 30) : v; drawPrev(); }
  });
  document.addEventListener("dragover", e => { const d = e.target.closest && e.target.closest("[data-rz-drop]"); if (d) { e.preventDefault(); d.classList.add("over"); } });
  document.addEventListener("dragleave", e => { const d = e.target.closest && e.target.closest("[data-rz-drop]"); if (d) d.classList.remove("over"); });
  document.addEventListener("drop", e => { const d = e.target.closest && e.target.closest("[data-rz-drop]"); if (!d) return; e.preventDefault(); d.classList.remove("over"); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) take(f); });
  // server sahifasi: Konstruktor ochilganda "Rasmdan dizayn" tanlagan parametrlar qo'llanadi
  if (!web() && window.AIDesign && AIDesign.available()) {
    try { const acts = JSON.parse(localStorage.getItem("ustun-rasm-acts") || "null"); if (Array.isArray(acts) && acts.length) { localStorage.removeItem("ustun-rasm-acts"); setTimeout(() => AIDesign.apply(acts.slice(0, 3)), 600); } } catch {}
  }
  if (!web() && $("rasmApp")) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render); else render(); }
  return { render };
})();
window.UstunRasm = UstunRasm;
