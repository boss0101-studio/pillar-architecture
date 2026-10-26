// Orqa fonni tanlash: faqat arxitekturaga oid chizmalar (chiziqli SVG, chizma uslubida).
// Rasm CSS niqob (mask) sifatida ishlatiladi, shuning uchun rangi qorong'i/yorug' mavzuga o'zi moslashadi.
// Tanlov shu brauzerda eslab qolinadi (localStorage "ustun-fon") va saytning hamma sahifasiga qo'llanadi.
(function () {
  const KEY = "ustun-fon";
  const W = 1600, G = 900;                                   // chizma o'lchami va yer chizig'i
  const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 1000"><g fill="none" stroke="#000" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
  const P = (d, extra = "") => `<path d="${d}"${extra}/>`;
  const faint = ' stroke-opacity=".45"', dash = ' stroke-dasharray="12 8" stroke-opacity=".5"';
  const ground = () => P(`M0 ${G}H${W}`) + P(`M0 ${G + 14}H${W}`, ' stroke-width="1.5" stroke-dasharray="10 14" stroke-opacity=".5"');
  const axis = (x = 800) => P(`M${x} 40V960`, ' stroke-width="1.2" stroke-dasharray="32 8 4 8" stroke-opacity=".55"');
  // Yarim doira arklar qatori: x0 dan boshlab n ta, har biri w eni, pastki chiziq y, ustun balandligi h
  const arches = (x0, y, w, n, h) => { let d = ""; for (let i = 0; i < n; i++) { const x = x0 + i * w; d += `M${x} ${y}V${y - h}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y - h}V${y}`; } return d; };
  // O'tkir (gotik) ark: l..r eni, base — pastki chiziq, s — ark boshlanadigan balandlik
  const pointed = (l, r, base, s) => { const w = r - l, c = (l + r) / 2, top = s - w * 0.866; return `M${l} ${base}V${s}A${w} ${w} 0 0 1 ${c} ${top}A${w} ${w} 0 0 1 ${r} ${s}V${base}`; };
  const dims = (x0, x1, y) => P(`M${x0} ${y}H${x1}M${x0} ${y - 12}V${y + 12}M${x1} ${y - 12}V${y + 12}`, ' stroke-width="1.2" stroke-opacity=".6"');

  const BGS = [
    { id: "peshtoq", n: "Madrasa peshtoqi", file: "bg-arxitektura.svg" },
    { id: "minora", n: "Minora", make() {
      let d = "", hw = y => 70 + (y - 230) / (G - 230) * 45;          // minora pastga qarab kengayadi
      d += P(`M${800 - hw(G)} ${G}L${800 - hw(230)} 230H${800 + hw(230)}L${800 + hw(G)} ${G}`);
      for (let y = 280; y < G; y += 62) d += P(`M${800 - hw(y)} ${y}H${800 + hw(y)}`, faint);
      for (let y = 311; y < G; y += 124) { let z = `M${800 - hw(y)} ${y}`; for (let x = -hw(y), k = 0; x < hw(y); x += 14, k++) z += `L${800 + x + 14} ${y + (k % 2 ? -12 : 12)}`; d += P(z, ' stroke-opacity=".6"'); }
      d += P("M712 230V160H888V230M700 160H900M706 150H894") + P(arches(718, 222, 20.5, 8, 30), faint);
      d += P("M760 150Q800 90 840 150M800 96V70");
      d += P("M200 900V620H520V900") + P("M240 620A120 120 0 0 1 480 620") + P(arches(220, 900, 50, 6, 70), faint);
      d += P("M1080 900V560H1400V900M1070 560H1410") + P(pointed(1180, 1300, 900, 690)) + P("M1110 600l14 14-14 14-14-14zM1370 600l14 14-14 14-14-14z", faint);
      return svg(ground() + axis() + d + dims(685, 915, 946));
    } },
    { id: "gotika", n: "Gotika sobori", make() {
      let d = "";
      [[480, 640], [960, 1120]].forEach(([l, r]) => {
        d += P(`M${l} ${G}V300H${r}V${G}`) + P(`M${l - 10} 300L${(l + r) / 2} 110L${r + 10} 300`) + P(`M${(l + r) / 2} 110V70`);
        d += P(pointed(l + 40, r - 40, 560, 470), faint) + P(pointed(l + 50, r - 50, 820, 720), faint);
        for (let y = 360; y < 880; y += 90) d += P(`M${l} ${y}H${r}`, ' stroke-opacity=".3"');
      });
      d += P("M640 900V420L800 300L960 420V900") + P("M800 300V250M786 266H814");
      d += '<circle cx="800" cy="520" r="86"/><circle cx="800" cy="520" r="40" stroke-opacity=".6"/>';
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; d += P(`M${800 + 40 * Math.cos(a)} ${520 + 40 * Math.sin(a)}L${800 + 86 * Math.cos(a)} ${520 + 86 * Math.sin(a)}`, ' stroke-opacity=".6"'); }
      d += P(pointed(720, 880, G, 760)) + P(pointed(740, 860, G, 770), faint);
      d += P("M480 640L380 520M380 520V900M1120 640L1220 520M1220 520V900M380 520L360 470M1220 520L1240 470") + P("M300 900V700H380M1220 700H1300V900", faint);
      return svg(ground() + axis() + d);
    } },
    { id: "antik", n: "Antik ibodatxona", make() {
      let d = P("M250 900H1350M270 880H1330M290 860H1310");
      for (let i = 0; i < 8; i++) {
        const x = 340 + i * 132, w = 60;
        d += P(`M${x} 860V490M${x + w} 860V490M${x - 10} 490H${x + w + 10}V474H${x - 10}Z`);
        d += P(`M${x + 20} 850V500M${x + 40} 850V500`, ' stroke-opacity=".35"');
      }
      d += P("M300 474H1300V430H300ZM300 430H1300V400H300Z");
      for (let x = 320; x < 1290; x += 44) d += P(`M${x} 430V474M${x + 8} 430V474`, ' stroke-opacity=".35"');
      d += P("M290 400L800 250L1310 400Z") + P("M360 386L800 266L1240 386", faint);
      return svg(ground() + axis() + d + dims(250, 1350, 946));
    } },
    { id: "osmonopar", n: "Osmono'parlar", make() {
      let d = "";
      [[120, 150, 420], [300, 120, 300], [450, 170, 560], [650, 140, 700], [820, 200, 460], [1050, 130, 620], [1210, 170, 380], [1410, 120, 520]].forEach(([x, w, h], k) => {
        const top = G - h;
        d += P(`M${x} ${G}V${top}H${x + w}V${G}`);
        let win = "";
        for (let y = top + 24; y < G - 10; y += 26) win += `M${x + 8} ${y}H${x + w - 8}`;
        for (let c = 1; c < 5; c++) win += `M${x + c * w / 5} ${top + 12}V${G - 6}`;
        d += P(win, ' stroke-opacity=".22" stroke-width="1.2"');
        if (k === 3) d += P(`M${x + 20} ${top}L${x + 70} ${top - 120}L${x + w - 20} ${top}M${x + 70} ${top - 120}V${top - 190}`);
        if (k === 5) d += P(`M${x} ${top}L${x + w / 2} ${top - 60}L${x + w} ${top}`);
      });
      return svg(ground() + d);
    } },
    { id: "maqbara", n: "Gumbazli maqbara", make() {
      let d = P("M560 900V520H1040V900M550 520H1050") + P(pointed(720, 880, G, 700)) + P(pointed(740, 860, G, 715), faint);
      d += P("M600 600h80v240h-80zM920 600h80v240h-80z", faint);
      d += P("M640 520V410H960V520M630 410H970M640 450H960M640 480H960", ' stroke-opacity=".7"');
      d += P("M650 410C600 290 690 170 800 158C910 170 1000 290 950 410");
      [-120, -80, -40, 0, 40, 80, 120].forEach(o => { d += P(`M${800 + o * 1.25} 410Q${800 + o * 1.05} 230 800 158`, ' stroke-opacity=".55"'); });
      d += P("M800 158V100M784 120H816M790 104a10 10 0 1 0 20 0");
      d += P("M400 900V380H460V900M1140 900V380H1200V900M392 380H468L430 330ZM1132 380H1208L1170 330Z");
      for (let y = 440; y < 900; y += 70) d += P(`M400 ${y}H460M1140 ${y}H1200`, dash);
      return svg(ground() + axis() + d + dims(560, 1040, 946));
    } },
    { id: "kolizey", n: "Kolizey", make() {
      let d = P("M180 900V300H1420V900");
      [[900, 200, 130], [700, 180, 110], [520, 160, 95]].forEach(([y, h, ah]) => {
        d += P(`M180 ${y - h}H1420`) + P(arches(210, y, 74, 16, ah - 37), ' stroke-opacity=".8"');
        let pil = ""; for (let i = 0; i <= 16; i++) pil += `M${210 + i * 74} ${y}V${y - h}`;
        d += P(pil, ' stroke-opacity=".3"');
      });
      let win = ""; for (let i = 0; i < 16; i++) win += `M${232 + i * 74} 345h30v-24h-30z`;
      d += P(win, faint) + P("M180 300H1420V286H180Z");
      return svg(ground() + d);
    } },
    { id: "koprik", n: "Tosh ko'prik", make() {
      let d = P("M0 560H1600M0 580H1600") + P("M0 540H1600", faint);
      let posts = ""; for (let x = 20; x < W; x += 60) posts += `M${x} 540V560`;
      d += P(posts, faint);
      [[160, 560], [600, 1000], [1040, 1440]].forEach(([l, r]) => { const c = (l + r) / 2, rr = (r - l) / 2; d += P(`M${l} 900V760A${rr} ${rr * 0.55} 0 0 1 ${r} 760V900`) + P(`M${l + 30} 900V770A${rr - 30} ${(rr - 30) * 0.55} 0 0 1 ${r - 30} 770`, faint); void c; });
      d += P("M0 580V900M560 580V900M1000 580V900M1440 580V900M1600 580V900", ' stroke-opacity=".7"');
      let wave = ""; for (let y = 930; y < 1000; y += 22) { wave += `M0 ${y}`; for (let x = 0; x < W; x += 80) wave += `q20 -10 40 0t40 0`; }
      d += P(wave, ' stroke-opacity=".35"');
      return svg(P(`M0 ${G}H${W}`) + d);
    } },
    { id: "uy", n: "Uy chizmasi", make() {
      let d = P("M480 900V560H1120V900") + P("M440 580L800 330L1160 580") + P("M470 560L800 350L1130 560", faint);
      d += P("M960 470V380H1010V505");
      [[540, 620], [700, 620], [930, 620], [540, 760], [930, 760]].forEach(([x, y]) => { d += P(`M${x} ${y}h110v90h-110zM${x + 55} ${y}v90M${x} ${y + 45}h110`); });
      d += P("M740 900V740H860V900") + P("M846 820h-10", faint);
      d += dims(480, 1120, 946) + P("M1180 900V330M1168 900H1192M1168 560H1192M1168 330H1192", ' stroke-width="1.2" stroke-opacity=".6"');
      d += P("M480 560H1120", dash) + '<circle cx="800" cy="460" r="34" stroke-opacity=".6"/>' + P("M766 460H834M800 426V494", faint);
      return svg(ground() + axis() + d);
    } },
  ];

  // ---------- Qo'llash ----------
  const urlOf = b => (b.file ? `url("${new URL(b.file, document.baseURI).href}")` : `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(b.svg || (b.svg = b.make()))}")`);
  // Standart: oddiy, qimirlamaydigan 2D chizma. 3D jonli fonni foydalanuvchi o'zi yoqishi mumkin.
  // v:2 — avval 3D standart bo'lgan: eski saqlangan tanlovda 3D bir marta o'chiriladi
  const DEF = { id: "peshtoq", op: 9, d3: false, v: 2 };
  let state = { ...DEF };
  try { const s = JSON.parse(localStorage.getItem(KEY) || "{}"); state = { ...state, ...s }; if (s.v !== 2) { state.d3 = false; state.v = 2; } } catch {}
  function apply() {
    const b = BGS.find(x => x.id === state.id) || BGS[0], root = document.documentElement.style;
    root.setProperty("--bg-mask", urlOf(b));
    root.setProperty("--bg-op", String(Math.min(25, Math.max(3, Number(state.op) || 9)) / 100));
    window.dispatchEvent(new CustomEvent("ustun-fon", { detail: { ...state } }));   // bg3d.js shu hodisani tinglaydi
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  apply();

  // ---------- Tanlash oynasi ----------
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "bgp-btn"; btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
  btn.title = "Orqa fonni almashtirish";
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V9l9-6 9 6v12z"/><path d="M9 21v-6h6v6"/></svg><span>Fon</span>';
  const panel = document.createElement("div");
  panel.className = "bgp"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Orqa fon");
  panel.innerHTML = `<div class="bgp-head"><b>Orqa fon</b><span class="label">faqat arxitektura</span><button type="button" class="bgp-x" aria-label="Yopish">×</button></div>
    <div class="bgp-grid" role="radiogroup" aria-label="Fon rasmi">${BGS.map(b => `<button type="button" role="radio" data-bg="${b.id}"><span class="bgp-th" style="--th:${urlOf(b).replace(/"/g, "'")}"></span><small>${b.n}</small></button>`).join("")}</div>
    <label class="bgp-3d"><input type="checkbox" data-3d> <span><b>3D jonli fon</b><small>Bino 3D'da aylanadi, sichqoncha va skrolga qarab og'adi</small></span></label>
    <label class="bgp-op">Ko'rinishi <input type="range" min="3" max="25" step="1" aria-label="Fon ko'rinishi, foiz"><output></output></label>
    <button type="button" class="bgp-reset">Asl holiga qaytarish</button>`;
  document.body.append(btn, panel);
  const range = panel.querySelector('input[type="range"]'), out = panel.querySelector("output"), d3 = panel.querySelector("[data-3d]");
  function sync() {
    panel.querySelectorAll("[data-bg]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.bg === state.id)));
    range.value = state.op; out.textContent = `${state.op}%`; d3.checked = state.d3 !== false;
  }
  sync();
  const open = v => { panel.hidden = !v; btn.setAttribute("aria-expanded", String(v)); if (v) (panel.querySelector('[aria-checked="true"]') || panel.querySelector("[data-bg]")).focus(); };
  btn.addEventListener("click", () => open(panel.hidden));
  panel.addEventListener("click", e => {
    const t = e.target.closest("[data-bg]");
    if (t) { state.id = t.dataset.bg; apply(); save(); sync(); return; }
    if (e.target.closest(".bgp-x")) { open(false); btn.focus(); }
    if (e.target.closest(".bgp-reset")) { state = { ...DEF }; apply(); save(); sync(); }
  });
  range.addEventListener("input", () => { state.op = Number(range.value); out.textContent = `${state.op}%`; apply(); });
  range.addEventListener("change", save);
  d3.addEventListener("change", () => { state.d3 = d3.checked; apply(); save(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) { open(false); btn.focus(); } });
  document.addEventListener("pointerdown", e => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) open(false); });

  window.UstunFon = {
    list: BGS.map(b => b.id), items: () => BGS.map(b => ({ id: b.id, n: b.n, url: urlOf(b) })),
    set(id) { if (BGS.some(b => b.id === id)) { state.id = id; apply(); save(); sync(); } },
    setOp(v) { state.op = Math.min(25, Math.max(3, Math.round(Number(v) || 9))); apply(); save(); sync(); },
    set3d(v) { state.d3 = !!v; apply(); save(); sync(); },
    get: () => ({ ...state }),
  };
})();
