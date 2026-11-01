// Tezkor loyiha ustasi (bosh sahifa): bino turi, qavat, xonalar, uslub, shakl, hovli va sifat tanlanadi —
// fasad chizmasi, maydon va narx darhol yangilanadi; "Konstruktorda ochish" tayyor loyihani (ichki reja va hovli bilan) quradi.
// Web versiyada Konstruktor shu sahifada; server versiyasida amallar sessionStorage orqali designer.html ga uzatiladi.
const UstunWizard = (function () {
  const PEND = "ustun-wiz";
  const KINDS = {
    hovli:  { n: "Hovli uy",        cat: "turar-joy", floors: 2, depth: 12, bw: 4.4 },
    villa:  { n: "Villa",           cat: "turar-joy", floors: 2, depth: 14, bw: 4.8 },
    kop:    { n: "Ko'p qavatli uy", cat: "turar-joy", floors: 9, depth: 14, bw: 3.9 },
    ofis:   { n: "Ofis",            cat: "tijorat",   floors: 5, depth: 16, bw: 4.5 },
    jamoat: { n: "Jamoat binosi",   cat: "jamoat",    floors: 2, depth: 16, bw: 4.2 },
  };
  const STYLES = {
    zamonaviy: { n: "Zamonaviy",  roof: "tekis",   material: "oqgisht", window: "panorama" },
    anana:     { n: "An'anaviy",  roof: "nishab",  material: "gisht",   window: "oddiy" },
    sharq:     { n: "Sharqona",   roof: "gumbaz",  material: "ganch",   window: "arkali" },
    oyna:      { n: "Oynali",     roof: "terrasa", material: "shisha",  window: "panorama" },
    yogoch:    { n: "Yog'och",    roof: "nishab",  material: "yogoch",  window: "kvadrat" },
  };
  const SHAPES_W = { rect: "To'rtburchak", L: "L shakl", U: "П shakl", court: "Ichki hovli" };
  const YARDS = { yoq: "Hovlisiz", oddiy: "Oddiy hovli", boy: "Hashamatli hovli" };
  const QUAL = { standart: "Standart", biznes: "Biznes", premium: "Premium" };
  const st = { kind: "hovli", floors: 2, rooms: 3, style: "anana", shape: "rect", yard: "oddiy", quality: "biznes" };

  // Tanlovdan konstruktor parametrlari: xonalar soni fasad oraliqlarini belgilaydi (mehmonxona + oshxona + yotoqxonalar)
  function params() {
    const k = KINDS[st.kind], s = STYLES[st.style];
    const bays = Math.min(12, Math.max(3, st.rooms + 2));
    const p = { category: k.cat, quality: st.quality, floors: st.floors, bays, floor_h: k.cat === "turar-joy" ? 3.1 : 3.6, bay_w: k.bw, depth: k.depth,
      roof: s.roof, material: s.material, window: s.window, ground: k.cat === "tijorat" ? "vitrina" : st.style === "sharq" && k.cat !== "turar-joy" ? "arkada" : "oddiy", shape: st.shape, wing: 0.4 };
    if (p.material === "yogoch" && p.floors > 3) p.material = "gisht";           // yog'och baland binoga yaramaydi
    if (["gisht", "oqgisht"].includes(p.material) && p.floors > 9) p.material = "beton";
    return p;
  }
  function cells(p) {
    const c = {}, mid = Math.floor(p.bays / 2);
    if (p.ground === "oddiy") c[`0,${mid}`] = "door";                            // kirish eshigi o'rtada
    if (st.kind !== "ofis" && p.floors > 1) for (let f = 1; f < p.floors; f++) { c[`${f},1`] = "balc"; if (p.bays > 4) c[`${f},${p.bays - 2}`] = "balc"; }
    if (st.kind === "villa" && p.bays > 3) c[`0,0`] = "garage";
    return c;
  }
  function yardItems() {
    if (st.yard === "boy") return ["garage", "swim", "gazebo", "fruit", "fruit", "pine", "bed", "lamp", "lamp", "lounger", "umbrella"];
    if (st.yard === "oddiy") return ["tree", "fruit", "bed", "suri", "tandir"];
    return [];
  }
  function actions() {
    const p = params(), c = cells(p), cl = Object.entries(c).map(([k, t]) => { const [f, b] = k.split(",").map(Number); return { floor: f + 1, bay: b + 1, type: t }; });
    const acts = [{ type: "new_design", name: `${KINDS[st.kind].n} · ${STYLES[st.style].n}`, houses: [{ params: p, cells: cl }] }];
    if (st.yard !== "yoq") acts.push({ type: "yard", on: true, fence: st.style === "oyna" ? "panjara" : "devor", items: yardItems() });
    if (p.floors <= 12) acts.push({ type: "interior", mode: "auto" });
    return acts;
  }

  // ---------- Ko'rinish ----------
  const seg = (key, opts, label) => `<fieldset class="wiz-f"><legend class="label">${label}</legend><div class="wiz-seg" data-w="${key}">${
    Object.entries(opts).map(([v, o]) => `<button type="button" data-v="${v}" aria-pressed="${String(st[key] === v)}">${typeof o === "string" ? o : o.n}</button>`).join("")}</div></fieldset>`;
  const rng = (key, min, max, label) => `<fieldset class="wiz-f"><legend class="label">${label}</legend><div class="wiz-rng"><input type="range" data-w="${key}" min="${min}" max="${max}" step="1" value="${st[key]}" aria-label="${label}"><output>${st[key]}</output></div></fieldset>`;
  let box = null;
  function mount() {
    box = document.getElementById("wiz"); if (!box) return;
    box.innerHTML = `<form class="wiz-form" onsubmit="return false">
        ${seg("kind", KINDS, "Bino turi")}
        <div class="wiz-two">${rng("floors", 1, 12, "Qavatlar")}${rng("rooms", 1, 8, "Xonalar (qavatda)")}</div>
        ${seg("style", STYLES, "Uslub")}${seg("shape", SHAPES_W, "Plan shakli")}${seg("yard", YARDS, "Hovli")}${seg("quality", QUAL, "Sifat")}
      </form>
      <div class="wiz-out">
        <div class="wiz-pic" aria-label="Fasad chizmasi"></div>
        <dl class="wiz-sum"></dl>
        <button type="button" class="btn wiz-go">Konstruktorda ochish →</button>
        <p class="muted wiz-note">Ichki xonalar, mebel va hovli o'zi joylashadi. Keyin hammasini o'zingiz o'zgartirasiz.</p>
      </div>`;
    box.addEventListener("click", e => {
      const b = e.target.closest(".wiz-seg button");
      if (b) {
        const key = b.parentElement.dataset.w; st[key] = b.dataset.v;
        if (key === "kind") st.floors = KINDS[st.kind].floors;                   // tur almashsa — mos qavat soni
        sync(); return;
      }
      if (e.target.closest(".wiz-go")) go();
    });
    box.addEventListener("input", e => {
      const r = e.target.closest("input[data-w]"); if (!r) return;
      st[r.dataset.w] = Number(r.value); r.nextElementSibling.textContent = r.value; draw();
    });
    sync();
  }
  function sync() {
    box.querySelectorAll(".wiz-seg").forEach(g => g.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(st[g.dataset.w] === b.dataset.v))));
    box.querySelectorAll("input[data-w]").forEach(r => { r.value = st[r.dataset.w]; r.nextElementSibling.textContent = st[r.dataset.w]; });
    draw();
  }
  const nf = n => Math.round(n).toLocaleString("ru-RU");
  function draw() {
    const p = params(), c = cells(p);
    if (typeof renderFacade === "function") box.querySelector(".wiz-pic").innerHTML = renderFacade(p, c, { dims: true, uid: "wiz" });
    const m = typeof metrics === "function" ? metrics(p, c) : null;
    const rows = [["Qavatlar", `${p.floors}`], ["Xonalar", `${st.rooms * p.floors}`]];
    if (m) rows.push(["Umumiy maydon", `${nf(m.totalArea)} m²`], ["Balandlik", `${(Math.round(m.height * 10) / 10).toLocaleString("ru-RU")} m`]);
    if (m && typeof estimate === "function") { const r = estimate(p.category, p.quality, Math.max(20, m.totalArea), p.floors); rows.push(["Taxminiy narx", `$${nf(r.construction_cost)}`]); }
    box.querySelector(".wiz-sum").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  }
  function go() {
    const acts = actions();
    if (window.AIDesign && window.DesignHost) {                                  // web: Konstruktor shu sahifada
      const run = () => {
        AIDesign.apply(acts); if (typeof showView === "function") showView("konstruktor");
        const d = document.getElementById("newDlg"); if (d && d.open) d.close();   // "Nimadan boshlaymiz?" kerak emas — loyiha tayyor
      };
      if (window.UstunAuth && !UstunAuth.signedIn()) { UstunAuth.open(true, run); return; }
      run(); return;
    }
    try { sessionStorage.setItem(PEND, JSON.stringify(acts)); } catch {}
    location.href = "designer.html";
  }
  // Server versiyasi: designer.html ochilganda bosh sahifadan kelgan loyiha quriladi
  function applyPending() {
    let acts = null; try { acts = JSON.parse(sessionStorage.getItem(PEND) || "null"); sessionStorage.removeItem(PEND); } catch {}
    if (acts && window.AIDesign && window.DesignHost) setTimeout(() => {
      AIDesign.apply(acts);
      const d = document.getElementById("newDlg"); if (d && d.open) d.close();
    }, 300);
  }
  function boot() { mount(); if (!document.getElementById("wiz")) applyPending(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  return { actions, params, state: st };
})();
window.UstunWizard = UstunWizard;
