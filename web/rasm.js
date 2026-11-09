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
      return { blob, dataUrl: big.toDataURL("image/jpeg", 0.85), thumb: draw(200).toDataURL("image/jpeg", 0.7), pal: palette(draw(72)) };
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
      `"konstruktor": {"material": one of ${JSON.stringify(Object.keys(MATERIALS || {}))}, "roof": one of ["tekis","nishab","bir","piramida","gumbaz","terrasa"], "window": one of ["oddiy","arkali","panorama","tor","kvadrat","baland","uchtabaqa"], "floors": integer 1-5}}. ` +
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
    </div>`;
    refreshAIState();
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
        ${canBuild ? `<button type="button" class="btn" data-rz-act="build">Konstruktorda shu uslubda boshlash</button>` : ""}
        ${p.kind === "xona" ? (web_ ? `<a class="btn-ghost" href="#konstruktor" data-view="konstruktor">Ichki makonni Konstruktorda loyihalash</a>` : `<a class="btn-ghost" href="designer.html">Ichki makonni Konstruktorda loyihalash</a>`) : ""}
        ${p.kind === "hovli" ? (web_ ? `<a class="btn-ghost" href="#gp" data-view="gp">Bosh rejani ochish</a>` : `<a class="btn-ghost" href="gp.html">Bosh rejani ochish</a>`) : ""}
        <button type="button" class="btn-ghost" data-rz-act="print">Chop etish / PDF</button>
        ${!ai && !aiBusy && aiAvailable() ? `<button type="button" class="btn-ghost" data-rz-act="ai">AI bilan qayta tahlil</button>` : ""}
      </div>
      ${canBuild ? `<p class="muted rz-k">Konstruktor uchun: material — ${esc((MATERIALS[k.material] || {}).label || k.material)}, tom — ${esc(k.roof)}, deraza — ${esc(k.window)}${k.floors ? `, ${k.floors} qavat` : ""}.</p>` : ""}`;
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
  function build() {
    const k = (ai && ai.konstruktor) || last.S.k, params = { ...k };
    if (web() && window.AIDesign && AIDesign.available()) {
      const r = AIDesign.apply([{ type: "set_params", params }]);
      showView("konstruktor");
      if (r && r.errors && r.errors.length) console.warn(r.errors);
      return;
    }
    try { localStorage.setItem("ustun-rasm-k", JSON.stringify(params)); } catch {}
    location.href = "designer.html";
  }

  // ---------- Hodisalar ----------
  async function take(file) {
    const r = await readImage(file); if (!r) return;
    img = r; last = null; ai = null; render();
  }
  document.addEventListener("click", e => {
    if (!$("rasmApp") || !e.target.closest("#rasmApp")) return;
    const s = e.target.closest("[data-rz]");
    if (s) { st[s.dataset.rz] = s.dataset.v; save(); if (last) { last = plan(st); } render(); return; }
    const a = e.target.closest("[data-rz-act]"); if (!a) return;
    const act = a.dataset.rzAct;
    if (act === "pick") document.querySelector("[data-rz-file]").click();
    else if (act === "camera") document.querySelector("[data-rz-cam]").click();
    else if (act === "clear") { img = null; last = null; ai = null; render(); }
    else if (act === "plan" || act === "ai") run();
    else if (act === "build") build();
    else if (act === "print") { document.documentElement.classList.add("rz-printing"); window.print(); setTimeout(() => document.documentElement.classList.remove("rz-printing"), 800); }
  });
  document.addEventListener("change", e => {
    const f = e.target.closest("[data-rz-file],[data-rz-cam]"); if (f && f.files && f.files[0]) take(f.files[0]);
    const ar = e.target.closest("[data-rz-area]"); if (ar) { st.area = ar.value; save(); if (last) { last = plan(st); showOut(); } }
  });
  document.addEventListener("dragover", e => { const d = e.target.closest && e.target.closest("[data-rz-drop]"); if (d) { e.preventDefault(); d.classList.add("over"); } });
  document.addEventListener("dragleave", e => { const d = e.target.closest && e.target.closest("[data-rz-drop]"); if (d) d.classList.remove("over"); });
  document.addEventListener("drop", e => { const d = e.target.closest && e.target.closest("[data-rz-drop]"); if (!d) return; e.preventDefault(); d.classList.remove("over"); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) take(f); });
  // server sahifasi: Konstruktor ochilganda "Rasmdan dizayn" tanlagan parametrlar qo'llanadi
  if (!web() && window.AIDesign && AIDesign.available()) {
    try { const k = JSON.parse(localStorage.getItem("ustun-rasm-k") || "null"); if (k) { localStorage.removeItem("ustun-rasm-k"); setTimeout(() => AIDesign.apply([{ type: "set_params", params: k }]), 600); } } catch {}
  }
  if (!web() && $("rasmApp")) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render); else render(); }
  return { render };
})();
window.UstunRasm = UstunRasm;
