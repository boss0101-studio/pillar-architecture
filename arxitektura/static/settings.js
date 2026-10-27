// Sozlamalar: Hisob (profil va ma'lumotlar), Loyihalar (yangi loyiha standartlari, narxlar, saqlangan loyihalar), Ko'rinish (mavzu, matn, animatsiya, fon).
// Hammasi shu brauzerda saqlanadi (localStorage "ustun-sozlamalar"). Har sahifada: mavzu va o'lcham qo'llanadi, profil formalarga yoziladi,
// konstruktorga "Mening sozlamam" andozasi qo'shiladi. #settingsApp bo'lgan sahifada sozlamalar oynasi chiziladi.
const UstunSettings = (function () {
  const KEY = "ustun-sozlamalar";
  const DATA_KEYS = {
    "ustun-sozlamalar": "Sozlamalar va profil", "ustun-draft": "Konstruktor qoralamasi", "ustun-erkin": "Erkin qurish loyihasi",
    "ustun-my-designs": "Saqlangan dizaynlar", "ustun-cart": "Savat", "ustun-orders": "Buyurtmalar (shu brauzerda)",
    "ustun-qogoz": "Oq qog'oz chizmasi", "ustun-ai": "AI suhbat tarixi", "ustun-geo": "Chizma chiziqlari", "ustun-fon": "Orqa fon", "ustun-view": "Oxirgi ochilgan bo'lim",
  };
  const ROLES = ["Uy egasi", "Arxitektor", "Muhandis", "Quruvchi", "Talaba", "Boshqa"];
  const COLORS = ["#2b4acb", "#8da2ff", "#b5683f", "#3f8f6a", "#a8323e", "#6b4a8e", "#2a2f33"];
  const MATS = { gisht: "Pishiq g'isht", gazoblok: "Gazoblok", beton: "Monolit beton" };
  const RANGE = { floors: [1, 30, 1], bays: [2, 12, 1], floor_h: [2.7, 4.5, 0.1], bay_w: [3, 7.5, 0.1], depth: [6, 30, 0.5],
                  fbH: [2.4, 6, 0.1], fbFd: [0.5, 3, 0.1], pGisht: [0.01, 5, 0.01], pBeton: [10, 500, 1], pArm: [0.1, 10, 0.01] };
  const DEF = {
    profile: { first: "", last: "", email: "", phone: "", role: "Uy egasi", city: "", color: "#2b4acb" },
    project: { category: "turar-joy", quality: "biznes", floors: 2, bays: 4, floor_h: 3.2, bay_w: 4.2, depth: 12, roof: "nishab", material: "gisht", window: "oddiy", ground: "oddiy",
               fbOutT: 0.38, fbOutMat: "gisht", fbInT: 0.12, fbInMat: "gisht", fbH: 3, fbFd: 1.2, pGisht: 0.14, pBeton: 95, pArm: 0.95 },
    ui: { theme: "auto", scale: 100, motion: true },
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, [a, b, st], d) => { const n = Number(v); return Number.isFinite(n) ? Math.round(Math.min(b, Math.max(a, n)) / st) * st * 1000 / 1000 : d; };
  const r3 = v => Math.round(v * 1000) / 1000;
  const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

  // Saqlangan ma'lumot ishonchsiz: har qiymat ruxsat etilgan ko'rinishga keltiriladi
  function clean(raw) {
    const r = raw && typeof raw === "object" ? raw : {}, p = r.profile || {}, j = r.project || {}, u = r.ui || {};
    const opt = (k, v, d) => (typeof OPTIONS !== "undefined" && OPTIONS[k] ? (OPTIONS[k].includes(v) ? v : d) : (typeof v === "string" && v ? v : d));
    return {
      profile: { first: str(p.first, 40), last: str(p.last, 40), email: str(p.email, 80), phone: str(p.phone, 30), role: ROLES.includes(p.role) ? p.role : DEF.profile.role,
                 city: str(p.city, 40), color: COLORS.includes(p.color) ? p.color : DEF.profile.color },
      project: {
        category: opt("category", j.category, DEF.project.category), quality: opt("quality", j.quality, DEF.project.quality),
        roof: opt("roof", j.roof, DEF.project.roof), material: opt("material", j.material, DEF.project.material), window: opt("window", j.window, DEF.project.window), ground: opt("ground", j.ground, DEF.project.ground),
        ...Object.fromEntries(["floors", "bays", "floor_h", "bay_w", "depth", "fbH", "fbFd", "pGisht", "pBeton", "pArm"].map(k => [k, r3(num(j[k], RANGE[k], DEF.project[k]))])),
        fbOutT: [0.25, 0.3, 0.38, 0.51].includes(Number(j.fbOutT)) ? Number(j.fbOutT) : DEF.project.fbOutT,
        fbInT: [0.1, 0.12, 0.2].includes(Number(j.fbInT)) ? Number(j.fbInT) : DEF.project.fbInT,
        fbOutMat: MATS[j.fbOutMat] ? j.fbOutMat : "gisht", fbInMat: MATS[j.fbInMat] ? j.fbInMat : "gisht",
      },
      ui: { theme: ["auto", "light", "dark"].includes(u.theme) ? u.theme : "auto", scale: num(u.scale, [90, 125, 5], 100), motion: u.motion !== false },
    };
  }
  let S = DEF;
  try { S = clean(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { S = clean(null); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch { return false; } };

  // ---------- Har sahifada qo'llanadi ----------
  function applyUi() {
    const h = document.documentElement;
    if (S.ui.theme === "auto") delete h.dataset.theme; else h.dataset.theme = S.ui.theme;
    h.style.fontSize = S.ui.scale === 100 ? "" : `${S.ui.scale}%`;
    h.classList.toggle("reduce-motion", !S.ui.motion);
  }
  applyUi();
  // Konstruktorning "Yangi bino" oynasiga foydalanuvchi standarti andoza bo'lib qo'shiladi
  if (typeof TEMPLATES !== "undefined") {
    const j = S.project;
    TEMPLATES.mening = { label: "Mening sozlamam", hint: `${j.floors} qavat, ${j.bays} oraliq · Sozlamalardagi standart.`,
      params: { category: j.category, quality: j.quality, floors: j.floors, bays: j.bays, floor_h: j.floor_h, bay_w: j.bay_w, depth: j.depth, roof: j.roof, material: j.material, window: j.window, ground: j.ground }, cells: {} };
  }
  const fullName = () => [S.profile.first, S.profile.last].filter(Boolean).join(" ");
  const initials = () => ((S.profile.first[0] || "") + (S.profile.last[0] || "")).toUpperCase() || "?";
  function prefill() {                                            // bo'sh formalarga profil yoziladi (yozilganini o'zgartirmaydi)
    const set = (id, v) => { const el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
    set("dAuthor", fullName()); set("oName", fullName()); set("oPhone", S.profile.phone); set("rqName", fullName()); set("rqPhone", S.profile.phone);
  }
  function navLink() {
    const ul = document.querySelector(".nav ul"); if (!ul || ul.querySelector(".nav-set")) return;
    const web = !!document.getElementById("sozlamalar"), here = !!document.getElementById("settingsApp") && !web;
    const li = document.createElement("li");
    li.innerHTML = `<a class="nav-set" ${web ? 'href="#sozlamalar" data-view="sozlamalar"' : 'href="settings.html"'}${here ? ' aria-current="page"' : ""} title="Sozlamalar">` +
      `<span class="nav-ava" style="background:${S.profile.color}" aria-hidden="true">${esc(fullName() ? initials() : "")}</span><span class="nav-set-t">Sozlamalar</span></a>`;
    ul.appendChild(li);
  }
  function refreshNav() { const a = document.querySelector(".nav-ava"); if (a) { a.style.background = S.profile.color; a.textContent = fullName() ? initials() : ""; } }
  navLink();

  // ---------- Sozlamalar oynasi ----------
  let tab = "hisob";
  const app = () => document.getElementById("settingsApp");
  const kb = n => (n < 1024 ? `${n} bayt` : `${(n / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} KB`);
  const readJSON = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
  function dataRows() {
    return Object.entries(DATA_KEYS).map(([k, n]) => {
      let v = null; try { v = localStorage.getItem(k); } catch {}
      if (v == null) return null;
      const j = readJSON(k);
      const what = k === "ustun-my-designs" && Array.isArray(j) ? `${j.length} ta dizayn` : k === "ustun-cart" && j ? `${Object.keys(j).length} ta mahsulot` :
        k === "ustun-orders" && Array.isArray(j) ? `${j.length} ta buyurtma` : k === "ustun-erkin" && j && j.levels ? `${j.levels.length} qavat` :
        k === "ustun-draft" && j ? `${(j.buildings || [1]).length} ta uy` : "";
      return { k, n, what, size: v.length * 2 };
    }).filter(Boolean);
  }
  function saveFile(name, data) {
    if (window.saveFile) return window.saveFile(name, data);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500); return Promise.resolve();
  }
  function toast(t, bad) {
    const el = document.getElementById("stToast"); if (!el) return;
    el.textContent = t; el.className = "st-toast show" + (bad ? " bad" : "");
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.className = "st-toast"; }, 2200);
  }
  const sel = (name, opts, cur) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const numIn = (name, cur, unit) => { const [a, b, st] = RANGE[name]; return `<span class="st-num"><input type="number" name="${name}" min="${a}" max="${b}" step="${st}" value="${cur}">${unit ? `<small>${unit}</small>` : ""}</span>`; };
  const field = (label, control, hint) => `<label class="st-f"><span>${label}</span>${control}${hint ? `<small class="muted">${hint}</small>` : ""}</label>`;
  const optList = k => (typeof OPTIONS !== "undefined" && OPTIONS[k] ? OPTIONS[k] : [DEF.project[k]]);
  const LBL = {
    category: { "turar-joy": "Turar-joy", jamoat: "Jamoat", tijorat: "Tijorat", interyer: "Interyer" }, quality: { standart: "Standart", biznes: "Biznes", premium: "Premium" },
    roof: { tekis: "Tekis", nishab: "Nishab", bir: "Bir nishabli", piramida: "Piramida", gumbaz: "Gumbaz", terrasa: "Terrasa" },
    window: { oddiy: "Oddiy", arkali: "Arkali", panorama: "Panorama", tor: "Tor", dumaloq: "Dumaloq", panjara: "Panjara", yoq: "Derazasiz" },
    ground: { oddiy: "Oddiy", arkada: "Arkada", vitrina: "Vitrina" },
  };
  const opts = k => optList(k).map(v => [v, k === "material" && typeof MATERIALS !== "undefined" && MATERIALS[v] ? MATERIALS[v].label : (LBL[k] && LBL[k][v]) || v]);

  function hisob() {
    const p = S.profile, rows = dataRows(), total = rows.reduce((s, r) => s + r.size, 0);
    return `<section class="st-sec">
      <div class="st-card st-profile">
        <span class="st-ava" style="background:${p.color}">${esc(initials())}</span>
        <div><b>${esc(fullName() || "Mehmon")}</b><span class="muted">${esc(p.role)}${p.city ? " · " + esc(p.city) : ""}${p.email ? " · " + esc(p.email) : ""}</span></div>
      </div>
      <form class="st-card" data-form="profile" novalidate>
        <h3>Profil</h3>
        <div class="st-grid">
          ${field("Ism", `<input name="first" maxlength="40" autocomplete="given-name" value="${esc(p.first)}">`)}
          ${field("Familiya", `<input name="last" maxlength="40" autocomplete="family-name" value="${esc(p.last)}">`)}
          ${field("Email", `<input name="email" type="email" maxlength="80" autocomplete="email" value="${esc(p.email)}" placeholder="ism@misol.uz">`)}
          ${field("Telefon", `<input name="phone" type="tel" maxlength="30" autocomplete="tel" value="${esc(p.phone)}" placeholder="+998 90 123 45 67">`)}
          ${field("Kim sifatida", sel("role", ROLES.map(r => [r, r]), p.role))}
          ${field("Shahar", `<input name="city" maxlength="40" autocomplete="address-level2" value="${esc(p.city)}">`)}
        </div>
        <div class="st-f"><span>Avatar rangi</span><div class="st-colors" role="radiogroup" aria-label="Avatar rangi">${COLORS.map(c => `<button type="button" role="radio" data-color="${c}" aria-checked="${c === p.color}" style="background:${c}" aria-label="${c}"></button>`).join("")}</div></div>
        <p class="muted st-note">Ism va telefon konstruktordagi "Muallif" va buyurtma formalariga o'zi yoziladi. Profil serverga yuborilmaydi — faqat shu brauzerda turadi.</p>
        <p class="msg" data-msg="profile" role="status"></p>
        <button class="btn" type="submit">Profilni saqlash</button>
      </form>
      <div class="st-card">
        <h3>Ma'lumotlarim</h3>
        ${rows.length ? `<table class="st-table"><tbody>${rows.map(r => `<tr><td>${esc(r.n)}</td><td class="muted">${esc(r.what)}</td><td class="num">${kb(r.size)}</td></tr>`).join("")}</tbody>
          <tfoot><tr><td colspan="2">Jami shu brauzerda</td><td class="num">${kb(total)}</td></tr></tfoot></table>` : `<p class="muted">Hali hech narsa saqlanmagan.</p>`}
        <div class="st-row">
          <button type="button" class="btn-ghost" data-act="backup">Zaxira nusxa (JSON)</button>
          <label class="btn-ghost st-file">Zaxiradan tiklash<input type="file" accept=".json,application/json" hidden data-act="restore"></label>
        </div>
        <p class="muted st-note">Zaxira nusxa bilan loyihalar, savat va sozlamalarni boshqa kompyuter yoki brauzerga ko'chirasiz.</p>
      </div>
      <div class="st-card st-danger">
        <h3>Hisobni o'chirish</h3>
        <p class="muted">Profil, qoralamalar, saqlangan dizaynlar, savat va sozlamalar shu brauzerdan butunlay o'chadi. Avval zaxira nusxa olishni tavsiya qilamiz.</p>
        <button type="button" class="btn-danger" data-act="wipe">Hisobni va barcha ma'lumotlarni o'chirish</button>
      </div>
    </section>`;
  }

  function loyihalar() {
    const j = S.project, web = typeof loadIntoDesigner === "function";
    const draft = readJSON("ustun-draft"), erkin = readJSON("ustun-erkin"), mine = readJSON("ustun-my-designs");
    const items = [];
    if (draft && draft.params) items.push({ k: "draft", n: draft.name || "Nomsiz qoralama", what: `Konstruktor · ${(draft.buildings || [1]).length} ta uy`, open: web ? 'data-view="konstruktor" href="#konstruktor"' : 'href="designer.html"' });
    if (erkin && Array.isArray(erkin.levels)) {
      const walls = erkin.levels.reduce((s, l) => s + (l.chains || []).reduce((q, c) => q + Math.max(0, (c.pts || []).length - (c.closed ? 0 : 1)), 0), 0);
      items.push({ k: "erkin", n: "Erkin qurish loyihasi", what: `${erkin.levels.length} qavat · ${walls} ta devor`, open: web ? 'data-view="erkin" href="#erkin"' : 'href="builder.html"' });
    }
    if (Array.isArray(mine)) mine.forEach((d, i) => items.push({ k: "mine", i, n: d.name || "Nomsiz", what: `Saqlangan dizayn · ${(d.buildings || [1]).length} ta uy${d.createdAt ? " · " + String(d.createdAt).slice(0, 10) : ""}`, open: web ? `data-open-mine="${i}" href="#konstruktor"` : "" }));
    return `<section class="st-sec">
      <form class="st-card" data-form="project">
        <h3>Yangi loyiha uchun standart</h3>
        <p class="muted st-note">Konstruktorda "Yangi bino" bosilganda bu qiymatlar <b>"Mening sozlamam"</b> andozasi bo'lib chiqadi.</p>
        <div class="st-grid">
          ${field("Bino turi", sel("category", opts("category"), j.category))}
          ${field("Sifat", sel("quality", opts("quality"), j.quality))}
          ${field("Qavatlar", numIn("floors", j.floors))}
          ${field("Fasad oraliqlari", numIn("bays", j.bays))}
          ${field("Qavat balandligi", numIn("floor_h", j.floor_h, "m"))}
          ${field("Oraliq kengligi", numIn("bay_w", j.bay_w, "m"))}
          ${field("Bino chuqurligi", numIn("depth", j.depth, "m"))}
          ${field("Tom", sel("roof", opts("roof"), j.roof))}
          ${field("Fasad materiali", sel("material", opts("material"), j.material))}
          ${field("Derazalar", sel("window", opts("window"), j.window))}
          ${field("1-qavat", sel("ground", opts("ground"), j.ground))}
        </div>
        <h3>Erkin qurish standartlari</h3>
        <p class="muted st-note">Erkin qurishda "Hammasini tozalash" yoki birinchi ochilishda shu qiymatlar bilan boshlanadi.</p>
        <div class="st-grid">
          ${field("Tashqi devor", sel("fbOutT", [[0.25, "250 mm"], [0.3, "300 mm"], [0.38, "380 mm"], [0.51, "510 mm"]], j.fbOutT))}
          ${field("Tashqi devor materiali", sel("fbOutMat", Object.entries(MATS), j.fbOutMat))}
          ${field("Ichki devor", sel("fbInT", [[0.1, "100 mm"], [0.12, "120 mm"], [0.2, "200 mm"]], j.fbInT))}
          ${field("Ichki devor materiali", sel("fbInMat", Object.entries(MATS), j.fbInMat))}
          ${field("Qavat balandligi", numIn("fbH", j.fbH, "m"))}
          ${field("Fundament chuqurligi", numIn("fbFd", j.fbFd, "m"))}
        </div>
        <h3>Smeta narxlari</h3>
        <p class="muted st-note">Erkin qurish smetasida ishlatiladi. Bozor narxi o'zgarsa, shu yerda yangilang.</p>
        <div class="st-grid">
          ${field("G'isht, 1 dona", numIn("pGisht", j.pGisht, "$"))}
          ${field("Beton B25, 1 m³", numIn("pBeton", j.pBeton, "$"))}
          ${field("Armatura, 1 kg", numIn("pArm", j.pArm, "$"))}
        </div>
        <div class="st-row"><button type="button" class="btn-ghost" data-act="project-reset">Standartlarni tiklash</button></div>
      </form>
      <div class="st-card">
        <h3>Saqlangan loyihalar</h3>
        ${items.length ? `<ul class="st-list">${items.map(it => `<li><div><b>${esc(it.n)}</b><span class="muted">${esc(it.what)}</span></div>
          ${it.open ? `<a class="btn-ghost" ${it.open}>Ochish</a>` : ""}<button type="button" class="btn-ghost" data-del="${it.k}"${it.i !== undefined ? ` data-i="${it.i}"` : ""}>O'chirish</button></li>`).join("")}</ul>`
          : `<p class="muted">Shu brauzerda saqlangan loyiha yo'q.</p>`}
        ${web ? "" : `<p class="muted st-note">Galereyaga yuborilgan dizaynlar serverda turadi va admin paneldan boshqariladi.</p>`}
      </div>
    </section>`;
  }

  function korinish() {
    const u = S.ui, fon = window.UstunFon, items = fon && fon.items ? fon.items() : [], cur = fon ? fon.get() : null;
    const I = window.UstunI18n;
    return `<section class="st-sec">
      ${I ? `<div class="st-card">
        <h3>Til <span class="label">Language</span></h3>
        <div class="st-langs" role="radiogroup" aria-label="Til / Language" translate="no">${I.langs.map(l => `<button type="button" role="radio" data-langset="${l.code}" aria-checked="${I.lang === l.code}"><b>${l.name}</b><small>${l.en}</small></button>`).join("")}</div>
        <p class="muted st-note">Sayt matni va AI yordamchi javoblari tanlangan tilda bo'ladi.</p>
      </div>` : ""}
      ${window.UstunTour ? `<div class="st-card">
        <h3>Yordamchi</h3>
        <p class="muted st-note">Saytga birinchi kirganda bo'limlar qisqacha tanishtiriladi. Uni qayta ko'rish mumkin.</p>
        <div class="st-row"><button type="button" class="btn-ghost" data-act="tour">Yo'riqnomani qayta ko'rsatish</button></div>
      </div>` : ""}
      <form class="st-card" data-form="ui">
        <h3>Mavzu</h3>
        <div class="st-themes" role="radiogroup" aria-label="Mavzu">
          ${[["auto", "Avtomatik", "Qurilmaga qarab"], ["light", "Yorug'", "Beton va kobalt"], ["dark", "Qorong'i", "Grafit va ko'k"]].map(([v, l, h]) =>
            `<label class="st-theme t-${v}"><input type="radio" name="theme" value="${v}"${u.theme === v ? " checked" : ""}><span class="st-prev" aria-hidden="true"><i></i><i></i><i></i></span><b>${l}</b><small class="muted">${h}</small></label>`).join("")}
        </div>
        <h3>Matn va harakat</h3>
        <div class="st-grid">
          ${field(`Matn o'lchami: <output data-out="scale">${u.scale}%</output>`, `<input type="range" name="scale" min="90" max="125" step="5" value="${u.scale}">`)}
          <label class="st-f st-switch"><input type="checkbox" name="motion"${u.motion ? " checked" : ""}><span>Animatsiyalar</span><small class="muted">O'chirilsa sahifa harakatsiz bo'ladi: bosh qayishi yoki sekin kompyuter uchun qulay.</small></label>
        </div>
      </form>
      ${fon ? `<div class="st-card">
        <h3>Orqa fon <span class="label">faqat arxitektura</span></h3>
        <div class="st-fons" role="radiogroup" aria-label="Orqa fon">${items.map(b => `<button type="button" role="radio" data-fon="${b.id}" aria-checked="${cur && cur.id === b.id}"><span class="bgp-th" style="--th:${b.url.replace(/"/g, "'")}"></span><small>${esc(b.n)}</small></button>`).join("")}</div>
        <label class="st-f st-switch"><input type="checkbox" data-fon3d${cur && cur.d3 === false ? "" : " checked"}><span>3D jonli fon</span><small class="muted">Tanlangan bino 3D'da sekin aylanadi. Sekin kompyuterda o'chirib qo'ying — 2D chizma qoladi.</small></label>
        <label class="st-f">Ko'rinishi: <output data-out="fonop">${cur ? cur.op : 9}%</output><input type="range" min="3" max="25" step="1" value="${cur ? cur.op : 9}" data-fonop></label>
      </div>` : ""}
      <div class="st-row"><button type="button" class="btn-ghost" data-act="ui-reset">Ko'rinishni tiklash</button></div>
    </section>`;
  }

  function render() {
    const el = app(); if (!el) return;
    const tabs = [["hisob", "Hisob", "Profil va ma'lumotlar"], ["loyihalar", "Loyihalar", "Standartlar va saqlanganlar"], ["korinish", "Ko'rinish", "Mavzu, matn, fon"]];
    el.innerHTML = `<div class="st">
      <nav class="st-nav" role="tablist" aria-label="Sozlamalar bo'limlari">${tabs.map(([k, l, h]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}"><b>${l}</b><small>${h}</small></button>`).join("")}</nav>
      <div class="st-body" role="tabpanel">${tab === "hisob" ? hisob() : tab === "loyihalar" ? loyihalar() : korinish()}</div>
      <p class="st-toast" id="stToast" role="status" aria-live="polite"></p>
    </div>`;
  }

  // ---------- Hodisalar ----------
  function bind() {
    const el = app(); if (!el || el.dataset.bound) return;
    el.dataset.bound = "1";
    el.addEventListener("click", e => {
      const t = e.target.closest("[data-tab],[data-color],[data-act],[data-del],[data-fon],[data-open-mine],[data-langset]"); if (!t) return;
      if (t.dataset.tab) { tab = t.dataset.tab; render(); return; }
      if (t.dataset.langset && window.UstunI18n) { window.UstunI18n.set(t.dataset.langset); return; }
      if (t.dataset.act === "tour" && window.UstunTour) { window.UstunTour.reset(); window.UstunTour.start("bosh"); return; }   // hamma bo'lim yo'riqnomasi qaytadan
      if (t.dataset.color) { el.querySelectorAll("[data-color]").forEach(b => b.setAttribute("aria-checked", String(b === t))); el.querySelector(".st-ava").style.background = t.dataset.color; return; }
      if (t.dataset.fon) { window.UstunFon.set(t.dataset.fon); el.querySelectorAll("[data-fon]").forEach(b => b.setAttribute("aria-checked", String(b === t))); toast("Fon almashtirildi"); return; }
      if (t.dataset.openMine !== undefined) {
        const d = (readJSON("ustun-my-designs") || [])[Number(t.dataset.openMine)];
        if (d && typeof loadIntoDesigner === "function") { e.preventDefault(); loadIntoDesigner(d.buildings || [{ params: d.params, cells: d.cells }], d.gap, d.name, `"${d.name}" ochildi.`, d.yard); if (typeof showView === "function") showView("konstruktor"); }
        return;
      }
      if (t.dataset.del) {
        if (t.dataset.armed !== "1") { t.dataset.armed = "1"; t.textContent = "Tasdiqlang"; setTimeout(() => { if (t.isConnected) { t.dataset.armed = ""; t.textContent = "O'chirish"; } }, 2500); return; }
        try {
          if (t.dataset.del === "draft") localStorage.removeItem("ustun-draft");
          if (t.dataset.del === "erkin") { localStorage.removeItem("ustun-erkin"); if (window.FreeBuild) window.FreeBuild._set(null); }
          if (t.dataset.del === "mine") { const list = readJSON("ustun-my-designs") || []; list.splice(Number(t.dataset.i), 1); localStorage.setItem("ustun-my-designs", JSON.stringify(list)); }
        } catch {}
        render(); toast("Loyiha o'chirildi"); return;
      }
      const a = t.dataset.act;
      if (a === "backup") {
        const data = {}; Object.keys(DATA_KEYS).forEach(k => { try { const v = localStorage.getItem(k); if (v != null) data[k] = v; } catch {} });
        saveFile(`ustun-zaxira-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ format: "ustun-zaxira", version: 1, savedAt: new Date().toISOString(), data }, null, 2))
          .then(() => toast("Zaxira nusxa saqlandi"), () => {});
      } else if (a === "wipe") {
        if (t.dataset.armed !== "1") { t.dataset.armed = "1"; t.textContent = "Ishonchingiz komilmi? Yana bir bor bosing"; setTimeout(() => { if (t.isConnected) { t.dataset.armed = ""; t.textContent = "Hisobni va barcha ma'lumotlarni o'chirish"; } }, 3500); return; }
        Object.keys(DATA_KEYS).forEach(k => { try { localStorage.removeItem(k); } catch {} });
        location.reload();
      } else if (a === "project-reset") { S.project = clean({ project: DEF.project }).project; save(); render(); toast("Standartlar tiklandi"); }
      else if (a === "ui-reset") { S.ui = { ...DEF.ui }; save(); applyUi(); if (window.UstunFon) window.UstunFon.set("peshtoq"), window.UstunFon.setOp(9); render(); toast("Ko'rinish tiklandi"); }
    });
    el.addEventListener("submit", e => {
      const f = e.target.closest('[data-form="profile"]'); if (!f) return;
      e.preventDefault();
      const fd = new FormData(f), msg = f.querySelector('[data-msg="profile"]');
      const email = str(fd.get("email"), 80), phone = str(fd.get("phone"), 30);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = "Email noto'g'ri: masalan ism@misol.uz"; msg.className = "msg bad"; f.email.focus(); return; }
      if (phone && !/^[+\d\s()-]{7,30}$/.test(phone)) { msg.textContent = "Telefon raqami noto'g'ri: masalan +998 90 123 45 67"; msg.className = "msg bad"; f.phone.focus(); return; }
      const color = (f.querySelector('[data-color][aria-checked="true"]') || {}).dataset;
      S.profile = clean({ profile: { first: fd.get("first"), last: fd.get("last"), email, phone, role: fd.get("role"), city: fd.get("city"), color: color && color.color } }).profile;
      save(); refreshNav(); prefill(); render(); toast("Profil saqlandi");
    });
    el.addEventListener("change", e => {
      const t = e.target;
      if (t.dataset.act === "restore" && t.files && t.files[0]) {
        const r = new FileReader();
        r.onload = () => {
          try {
            const d = JSON.parse(String(r.result));
            if (!d || d.format !== "ustun-zaxira" || !d.data || typeof d.data !== "object") throw new Error();
            Object.entries(d.data).forEach(([k, v]) => { if (DATA_KEYS[k] && typeof v === "string" && v.length < 3e6) localStorage.setItem(k, v); });
            toast("Zaxira tiklandi, sahifa yangilanmoqda…"); setTimeout(() => location.reload(), 700);
          } catch { toast("Bu Pillar zaxira fayli emas", true); }
        };
        r.readAsText(t.files[0]); t.value = ""; return;
      }
      const f = t.closest("[data-form]");
      if (f && f.dataset.form === "project") {
        const fd = Object.fromEntries(new FormData(f));
        S.project = clean({ project: { ...S.project, ...fd } }).project; save();
        if (t.type === "number") t.value = S.project[t.name];        // chegaradan chiqqan qiymat to'g'rilanadi
        toast("Saqlandi");
      } else if (f && f.dataset.form === "ui") {
        const fd = new FormData(f);
        S.ui = clean({ ui: { theme: fd.get("theme"), scale: fd.get("scale"), motion: fd.get("motion") === "on" } }).ui; save(); applyUi(); toast("Saqlandi");
      } else if (t.dataset.fon3d !== undefined && window.UstunFon) { window.UstunFon.set3d(t.checked); toast(t.checked ? "3D fon yoqildi" : "2D fon qaytdi"); }
      else if (t.dataset.fonop !== undefined) toast("Saqlandi");
    });
    el.addEventListener("input", e => {
      const t = e.target;
      if (t.name === "scale") { const o = el.querySelector('[data-out="scale"]'); if (o) o.textContent = `${t.value}%`; }
      if (t.dataset.fonop !== undefined && window.UstunFon) { window.UstunFon.setOp(Number(t.value)); el.querySelector('[data-out="fonop"]').textContent = `${t.value}%`; }
    });
  }

  function boot() { prefill(); render(); bind(); }
  window.addEventListener("ustun-til", () => { if (tab === "korinish") render(); });   // tanlangan til belgisi yangilansin
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);

  return { get: () => JSON.parse(JSON.stringify(S)), render };
})();
