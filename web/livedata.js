// AI yordamchi uchun jonli ma'lumot: ob-havo (Open-Meteo), dunyo yangiliklari (Vikipediya "In the news") va valyuta kursi (open.er-api.com).
// Hammasi bepul va kalitsiz; so'rov faqat foydalanuvchi shu mavzuda savol berganda yuboriladi (tashqariga faqat shahar nomi ketadi).
// Internet qidiruv: Vikipediya API (kalitsiz) + Google qidiruv havolasi; Claude ulangan bo'lsa u web_search asbobi orqali o'zi qidiradi.
// lookup(savol, til) → { kind, text (oflayn javob, markdown), data (AI uchun ixcham matn) } yoki null (savol bu mavzuda emas).
// Shablonlar o'zbekcha; tarjimasi til-*.js lug'atidan olinadi ({0}, {1} — qiymatlar o'rni).
const UstunLive = (function () {
  const RE = {
    weather: /ob-?havo|obhavo|havo (qanday|harorat|qalay)|harorat|yomg'ir yog|qor yog|weather|forecast|temperature|погод|прогноз|температур|clima|tiempo|pronóstico|hava durumu|météo|wetter/,
    news: /yangilik|xabarlar|news|headlines|новост|noticias|haber|actualit|nachricht/,
    search: /internet|google|gugl|qidir|izla|search|look up|найди|поищи|интернет|гугл|busca|ara[sş]t[iı]r|recherche|such/,
    money: /valyuta|kurs|dollar|yevro|evro|so'm kurs|exchange rate|currency|курс|валют|доллар|tipo de cambio|divisa|döviz|kur |taux de change|wechselkurs/,
  };
  const WMO = [[0, "Ochiq osmon", "☀️"], [1, "Asosan ochiq", "🌤"], [2, "Qisman bulutli", "⛅"], [3, "Bulutli", "☁️"], [48, "Tuman", "🌫"], [57, "Mayda yomg'ir", "🌦"],
    [67, "Yomg'ir", "🌧"], [77, "Qor", "❄️"], [82, "Jala", "🌧"], [86, "Qor yog'ishi", "🌨"], [99, "Momaqaldiroq", "⛈"]];
  const wmo = c => WMO.find(([k]) => c <= k) || WMO[WMO.length - 1];
  let L = "uz";
  const dict = () => (L !== "uz" && window.USTUN_I18N && (USTUN_I18N[L] || USTUN_I18N.en)) || null;
  const tr = (tpl, ...a) => { const d = dict(); return ((d && d[tpl]) || tpl).replace(/\{(\d+)\}/g, (_, i) => (a[i] != null ? a[i] : "")); };
  const n1 = v => (Math.round(v * 10) / 10).toLocaleString("ru-RU");
  const n0 = v => Math.round(v).toLocaleString("ru-RU");
  async function getJSON(url, ms = 8000) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); }
    finally { clearTimeout(t); }
  }

  // ---------- Ob-havo ----------
  function cityOf(q) {
    const s = q.replace(/[ʻʼ’‘`]/g, "'");
    const pats = [/(\p{L}[\p{L}'-]{2,})(?:da|dagi|day)\s+(?:bugun\s+|ertaga\s+)?(?:ob-?havo|havo|harorat)/iu, /(?:ob-?havo|harorat)\s+(\p{L}[\p{L}'-]{2,})/iu,
      /weather\s+(?:in|for|at)\s+(\p{L}[\p{L} '-]{1,30}?)(?:\s+(?:today|tomorrow|now)|[?.!]|$)/iu, /погод\p{L}*\s+(?:в|во)\s+(\p{L}[\p{L}-]{1,30})/iu,
      /(?:tiempo|clima)\s+(?:en|de)\s+(\p{L}[\p{L} -]{1,30}?)(?:\s+(?:hoy|mañana)|[?.!]|$)/iu, /(\p{L}[\p{L}-]{2,})\s+hava durumu/iu, /météo\s+(?:à|a|de)\s+(\p{L}[\p{L} -]{1,30})/iu, /wetter\s+in\s+(\p{L}[\p{L} -]{1,30})/iu];
    const skip = /^(bugun|ertaga|hozir|bugungi|the|today|qanday|qalay|sizning|bizning|mening)$/i;
    for (const re of pats) { const m = re.exec(s); if (m && !skip.test(m[1].trim())) return m[1].trim(); }
    return "";
  }
  async function geocode(name) {
    for (const lang of [L === "uz" ? "uz" : L, "en"]) {
      const d = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=${lang}&format=json`);
      if (d && d.results && d.results[0]) { const r = d.results[0]; return { name: r.name, country: r.country || "", lat: r.latitude, lon: r.longitude }; }
    }
    return null;
  }
  function buildTip(t0, t1, rain, wind) {
    if (t0 < 5) return tr("Sovuq: beton va suvoq ishlari uchun isitish yoki maxsus qo'shimcha kerak (5°C dan past).");
    if (t1 > 35) return tr("Juda issiq: betonni ertalab yoki kechqurun quying va namlab turing.");
    if (rain >= 60) return tr("Yog'ingarchilik ehtimoli yuqori: tom, bo'yash va tashqi ishlarni boshqa kunga qoldiring.");
    if (wind >= 40) return tr("Kuchli shamol: kran va balandlikdagi ishlarda ehtiyot bo'ling.");
    return tr("Qurilish va tashqi ishlar uchun qulay kun.");
  }
  async function weather(q) {
    const asked = cityOf(q);
    const place = (asked && await geocode(asked)) || { name: asked && L === "uz" ? asked : tr("Toshkent"), country: "", lat: 41.31, lon: 69.28, guess: !!asked };
    const d = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`);
    const c = d.current, dy = d.daily, w = wmo(c.weather_code), day = i => ({ w: wmo(dy.weather_code[i]), lo: dy.temperature_2m_min[i], hi: dy.temperature_2m_max[i], p: dy.precipitation_probability_max[i] || 0 });
    const D = [0, 1, 2].map(day), title = place.country ? `${place.name}, ${place.country}` : place.name;
    const text = [`**${tr("{0}: ob-havo", title)}** ${w[2]}`,
      `- ${tr("Hozir: {0}, {1}°C (his qilinadi {2}°C), shamol {3} km/soat, namlik {4}%", tr(w[1]), n1(c.temperature_2m), n1(c.apparent_temperature), n0(c.wind_speed_10m), n0(c.relative_humidity_2m))}`,
      `- ${tr("Bugun: {0}…{1}°C, yog'ingarchilik ehtimoli {2}%", n1(D[0].lo), n1(D[0].hi), n0(D[0].p))}`,
      `- ${D[1].w[2]} ${tr("Ertaga: {0}, {1}…{2}°C", tr(D[1].w[1]), n1(D[1].lo), n1(D[1].hi))}`,
      `- ${D[2].w[2]} ${tr("Indinga: {0}, {1}…{2}°C", tr(D[2].w[1]), n1(D[2].lo), n1(D[2].hi))}`,
      "", `🏗 ${buildTip(D[0].lo, D[0].hi, D[0].p, c.wind_speed_10m)}`,
      place.guess ? `\n_${tr("\"{0}\" topilmadi — Toshkent ko'rsatildi.", asked)}_` : !asked ? `\n_${tr("Boshqa shahar uchun yozing, masalan: \"Samarqandda ob-havo\".")}_` : "",
      `\n_${tr("Manba: Open-Meteo, hozirgi ma'lumot.")}_`].filter(x => x !== "").join("\n");
    const data = `weather (Open-Meteo, live) ${title}: now ${c.temperature_2m}°C feels ${c.apparent_temperature}°C, ${w[1]} (WMO ${c.weather_code}), wind ${c.wind_speed_10m} km/h, humidity ${c.relative_humidity_2m}%; ` +
      D.map((x, i) => `${dy.time[i]}: ${x.lo}…${x.hi}°C, rain ${x.p}%, WMO ${dy.weather_code[i]}`).join("; ");
    return { kind: "weather", text, data };
  }

  // ---------- Dunyo yangiliklari ----------
  const strip = h => String(h).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  async function news() {
    const wl = L === "es" ? "es" : "en", now = new Date();
    let d = null, used = null;
    for (let back = 0; back < 3 && !(d && d.news && d.news.length); back++) {   // bugungi lenta hali tayyor bo'lmasa — oldingi kun
      const t = new Date(now.getTime() - back * 864e5), ds = `${t.getUTCFullYear()}/${String(t.getUTCMonth() + 1).padStart(2, "0")}/${String(t.getUTCDate()).padStart(2, "0")}`;
      try { d = await getJSON(`https://${wl}.wikipedia.org/api/rest_v1/feed/featured/${ds}`); used = ds; } catch { d = null; }
      if (wl === "es" && !(d && d.news && d.news.length) && back === 2) { d = await getJSON(`https://en.wikipedia.org/api/rest_v1/feed/featured/${ds}`); }
    }
    const items = ((d && d.news) || []).slice(0, 6).map(n => strip(n.story)).filter(Boolean);
    if (!items.length) throw new Error("no news");
    const text = [`**${tr("Dunyo yangiliklari")}** 📰 _(${used})_`, ...items.map(s => `- ${s}`),
      L === "uz" ? `\n_${tr("Sarlavhalar ingliz tilida. Tarjima va izoh uchun AI'dan so'rang (Claude ulangan versiyada).")}_` : "",
      `_${tr("Manba: Vikipediya — \"Yangiliklarda\" bo'limi.")}_`].filter(Boolean).join("\n");
    return { kind: "news", text, data: `world news (Wikipedia "In the news", ${used}):\n` + items.map(s => `- ${s}`).join("\n") };
  }

  // ---------- Valyuta kursi ----------
  async function money() {
    const d = await getJSON("https://open.er-api.com/v6/latest/USD");
    const r = d.rates || {}, uzs = r.UZS; if (!uzs) throw new Error("no rate");
    const per = k => (r[k] ? uzs / r[k] : null), date = (d.time_last_update_utc || "").slice(5, 16);
    const rows = [["USD", 1], ["EUR", per("EUR")], ["RUB", per("RUB")], ["KZT", per("KZT")], ["CNY", per("CNY")]].filter(([, v]) => v);
    const lines = rows.map(([k, v]) => `- 1 ${k} = **${k === "USD" ? n0(uzs) : n1(v)}** ${tr("so'm")}`);
    const costEl = document.getElementById("cost"), m = costEl && /\$\s*([\d\s ]+)/.exec(costEl.textContent || "");
    const cost = m ? Number(m[1].replace(/[\s ]/g, "")) : 0;
    const text = [`**${tr("Valyuta kursi")}** 💱 _(${date})_`, ...lines,
      cost ? `\n${tr("Joriy loyiha narxi: ${0} ≈ {1} so'm", n0(cost), n0(cost * uzs))}` : "",
      `\n_${tr("Manba: open.er-api.com (kunlik o'rtacha kurs). Rasmiy kurs uchun Markaziy bankni tekshiring.")}_`].filter(Boolean).join("\n");
    return { kind: "money", text, data: `exchange rates (open.er-api.com, ${date}): 1 USD = ${uzs} UZS` + rows.slice(1).map(([k, v]) => `, 1 ${k} = ${v.toFixed(1)} UZS`).join("") + (cost ? `; current project cost $${cost}` : "") };
  }

  // ---------- Internet qidiruv: Vikipediya (kalitsiz, istalgan tilda) + Google havolasi ----------
  const WIKI = { uz: "uz", en: "en", es: "es", ru: "ru", tr: "tr", fr: "fr", de: "de" };
  const cleanQuery = q => String(q).replace(/[?!.]+\s*$/, "")
    .replace(/(internet(dan|da)?|google'?(da|dan|ga)?|gugl(da|dan)?|qidirib ber(ing)?|qidir(ing)?|izlab ber|search( for)?|look up|найди|поищи|в интернете|в гугле|buscar? en (internet|google)|buscar?|araştır|recherche|suche)/gi, " ")
    .replace(/^[\s:,.\-—–]+/, "").replace(/\s+/g, " ").trim();
  // Vikipediya qidiruvi uchun kalit so'zlar: savol so'zlari olib tashlanadi ("Eyfel minorasi qachon qurilgan" → "Eyfel minorasi")
  const STOP = /(^|\s)(qachon|qayerda|qayerdan|qaysi|kim|kimlar|nima|nimalar|nega|nechta|necha|qancha|qanday|haqida|ma'lumot|ber|bering|aytib|qurilgan|bo'lgan|edi|mi|what|when|where|who|whom|which|why|how|is|are|was|were|the|a|an|of|about|tell|me|built|designed|invented|founded|created|located|made|does|did|do|mean|means|кто|что|когда|где|как|какой|почему|про|о|расскажи|qué|cuándo|dónde|quién|cómo|cuál|por|el|la|los|las|de|sobre)(?=\s|$)/gi;
  const keywords = q => q.replace(/[?!.,;:"«»]/g, " ").replace(STOP, " ").replace(STOP, " ").replace(/\s+/g, " ").trim();
  async function wikiSearch(query, wl) {
    const d = await getJSON(`https://${wl}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&prop=extracts|info&exintro=1&explaintext=1&exsentences=3&exlimit=3&inprop=url`);
    return Object.values((d.query && d.query.pages) || {}).sort((a, b) => a.index - b.index)
      .map(p => ({ title: p.title, text: (p.extract || "").replace(/\s+/g, " ").trim(), url: p.fullurl })).filter(p => p.text);
  }
  async function search(q, lang) {
    L = lang || (window.UstunI18n ? UstunI18n.lang : "uz");
    const query = cleanQuery(q) || String(q).trim(), kw = keywords(query) || query, wl = WIKI[L] || "en";
    let res = [];
    try { res = await wikiSearch(kw, wl); } catch {}
    if (res.length < 2 && wl !== "en") { try { res = res.concat(await wikiSearch(kw, "en")); } catch {} }   // o'z tilida kam bo'lsa — inglizcha ham
    res = res.slice(0, 3);
    const g = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const text = [`**${tr("Internetdan: \"{0}\"", query)}** 🔎`,
      ...(res.length ? res.map(r => `- **${r.title}** — ${r.text.length > 280 ? r.text.slice(0, 280) + "…" : r.text} [${tr("Vikipediya")}](${r.url})`) : [tr("Vikipediyada mos maqola topilmadi.")]),
      "", `[${tr("Google'da qidirish")} →](${g})`, `_${tr("Manba: Vikipediya. To'liqroq natija uchun Google havolasini oching.")}_`].join("\n");
    const data = `internet search (Wikipedia) for "${query}":\n` + (res.length ? res.map(r => `- ${r.title} (${r.url}): ${r.text.slice(0, 450)}`).join("\n") : "- no Wikipedia article found") + `\nGoogle search link: ${g}`;
    return { kind: "search", text, data, google: g };
  }

  // ---------- Kirish nuqtasi ----------
  async function lookup(q, lang) {
    L = lang || (window.UstunI18n ? UstunI18n.lang : "uz");
    const s = String(q).toLowerCase().replace(/[ʻʼ’‘`]/g, "'");
    const kind = RE.weather.test(s) ? "weather" : RE.news.test(s) ? "news" : RE.money.test(s) ? "money" : RE.search.test(s) ? "search" : null;
    if (!kind) return null;
    try { return await (kind === "weather" ? weather(q) : kind === "news" ? news() : kind === "money" ? money() : search(q, L)); }
    catch { return { kind, failed: true, text: tr("Internetdan ma'lumot olib bo'lmadi: aloqa yo'q yoki bu versiyada tashqi manbalar yopiq. Keyinroq urinib ko'ring."), data: "" }; }
  }
  return { lookup, search, cityOf };
})();
window.UstunLive = UstunLive;
