// Majmua: bir nechta uy (eng ko'pi MAX ta). Har bir uyning o'z parametrlari va kataklari bor.
// Konstruktor har doim bitta "faol" uy ustida ishlaydi; qolgan uylar 3D ko'rinishda yonida turadi.
const Site = (function () {
  const MAX = 3;
  const clone = o => JSON.parse(JSON.stringify(o));
  const el = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const MIN_CLEAR = 1;                 // sudraganda uylar orasida kamida 1 m qoladi (ustma-ust tushmasin)
  const snap = v => Math.round(v * 2) / 2;   // 0,5 m qadam
  // Harakat 0,25 m qadamlarda tekshiriladi: tez sudralganda ingichka devor yoki to'siq "ustidan sakrab" o'tib ketmasin.
  // Avval to'g'ri chiziq bo'ylab, to'siqqa tegsa — x va z bo'ylab alohida (to'siq bo'ylab sirpanish). Nuqtalar sn qadamiga yaxlitlanadi.
  function sweep(from, to, free, sn) {
    const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.25));
    let last = from;
    for (let i = 1; i <= n; i++) {
      const q = [Math.round((from[0] + (to[0] - from[0]) * i / n) / sn) * sn, Math.round((from[1] + (to[1] - from[1]) * i / n) / sn) * sn];
      if (q[0] === last[0] && q[1] === last[1]) continue;
      if (!free(q[0], q[1])) break;
      last = q;
    }
    return last;
  }
  function slide(from, to, free, sn) {
    const a = sweep(from, to, free, sn), b = sweep(a, [to[0], a[1]], free, sn);
    return sweep(b, [b[0], to[1]], free, sn);
  }

  const S = {
    MAX, slide, list: [], active: 0, gap: 10,
    yard: cleanYard(null), ysel: -1,   // hovli va tanlangan hovli elementi
    getCurrent: null,   // () => ({ params, cells }) — konstruktorning joriy ish nusxasi
    onSelect: null,     // (uy) => void — faol uy almashganda
    onChange: null,     // () => void — uylar soni yoki masofa o'zgarganda

    current() { return this.list[this.active]; },

    // Konstruktor o'zgaruvchilarini (params, cells) faol uyga yozib qo'yadi
    sync() {
      const c = this.getCurrent && this.getCurrent(), b = this.list[this.active];
      if (c && b) { b.params = c.params; b.cells = c.cells; }
    },

    reset(params, cells) { this.list = [{ params, cells }]; this.active = 0; this.gap = 10; this.yard = cleanYard(null); this.ysel = -1; this.arrange(); this.renderUI(); },

    load(list, gap, active = 0, yard) {
      this.yard = cleanYard(yard); this.ysel = -1;
      this.list = list.slice(0, MAX).map(b => ({ params: b.params, cells: b.cells, interior: b.interior, pos: cleanPos(b.pos) }));
      if (!this.list.length) this.list = [{ params: {}, cells: {} }];
      this.gap = clamp(Number(gap) || 10, 4, 30);
      this.active = clamp(Number(active) || 0, 0, this.list.length - 1);
      if (!this.list.every(b => b.pos)) this.arrange();      // eski loyiha: joylashuv yo'q — qatorga tiziladi
      this.renderUI();
    },

    snapshot() { this.sync(); return JSON.stringify({ b: this.list.map(b => [b.params, b.cells, b.interior || null, b.pos || null]), g: this.gap, y: this.yard }); },

    // ---- Joylashuv ----
    layout() { this.sync(); return siteLayout(this.list, this.gap); },
    // Hamma uyni ko'cha bo'ylab bir qatorga, "gap" oralig'ida tizadi (burilishlar 0° ga qaytadi)
    arrange() {
      const row = rowLayout(this.list.map(b => geometry(b.params)), this.gap);
      this.list.forEach((b, i) => { b.pos = row[i]; });
    },
    // Uyni (x, z) ga ko'chiradi. Boshqa uyga urilsa, to'siq bo'ylab sirpanadi (faqat x yoki faqat z o'zgaradi)
    move(i, x, z) {
      const L = this.layout(), me = L[i]; if (!me) return false;
      x = clamp(x, -150, 150); z = clamp(z, -150, 150);
      const free = (cx, cz) => L.every((o, j) => j === i || footGap(o, { ...me, cx, cz }) >= MIN_CLEAR) && this.clearOfItems({ ...me, cx, cz });
      const ok = slide([me.cx, me.cz], [x, z], free, 0.5);
      if (ok[0] === me.cx && ok[1] === me.cz) return false;
      this.list[i].pos = { x: ok[0], z: ok[1], rot: me.rot };
      this.onChange && this.onChange();
      return true;
    },
    // ---- Hovli ----
    clearOfItems(f) { return !this.yard.on || this.yard.items.every(it => footGap(itemFoot(it), f) >= 0.3); },
    yardRect() { return yardRect(this.layout(), this.yard); },
    setYard(patch) {
      this.yard = cleanYard({ ...this.yard, ...patch });
      if (patch.on && !this.yard.items.length) this.starter();     // birinchi marta yoqilganda: 4 ta daraxt va darvoza yonida gulzorlar
      if (!this.yard.on) this.ysel = -1;
      this.onChange && this.onChange();
    },
    // Element binolarga (0,5 m) va boshqa elementlarga (0,2 m) tegmasin
    itemFree(f, skip) {
      return this.layout().every(l => footGap(l, f) >= 0.5) && this.yard.items.every((o, k) => k === skip || footGap(itemFoot(o), f) >= 0.2);
    },
    inYard(f, R) { return f.cx - f.w / 2 >= R.x0 && f.cx + f.w / 2 <= R.x1 && f.cz - f.d / 2 >= R.z0 && f.cz + f.d / 2 <= R.z1; },
    starter() {
      const R = this.yardRect();
      const put = (t, x, z) => { const it = { t, x: snap(x), z: snap(z), rot: 0 }, f = itemFoot(it); if (this.inYard(f, R) && this.itemFree(f, -1)) this.yard.items.push(it); };
      put("tree", R.x0 + 2.5, R.z0 + 2.5); put("tree", R.x1 - 2.5, R.z0 + 2.5); put("tree", R.x0 + 2.5, R.z1 - 2.5); put("tree", R.x1 - 2.5, R.z1 - 2.5);
      put("bed", R.gx - 4.5, R.z1 - 1.5); put("bed", R.gx + 4.5, R.z1 - 1.5);
    },
    // Yangi element hovlidagi birinchi bo'sh joyga (ko'cha tomondan boshlab) qo'yiladi
    addItem(t) {
      if (!YARD_ITEMS[t] || !this.yard.on || this.yard.items.length >= YARD_MAX_ITEMS) return false;
      const R = this.yardRect(), s = YARD_ITEMS[t];
      for (let z = snap(R.z1 - s.d / 2 - 0.5); z >= R.z0 + s.d / 2; z -= 1) for (let x = snap(R.x0 + s.w / 2 + 0.5); x <= R.x1 - s.w / 2; x += 1) {
        const f = { cx: x, cz: z, w: s.w, d: s.d };
        if (this.itemFree(f, -1)) {
          this.yard.items.push({ t, x, z, rot: 0 }); this.ysel = this.yard.items.length - 1;
          this.onChange && this.onChange(); return true;
        }
      }
      return false;
    },
    moveItem(k, x, z) {
      const it = this.yard.items[k]; if (!it) return false;
      const R = this.yardRect(), f0 = itemFoot(it), cl = (v, a, b) => (a > b ? (a + b) / 2 : clamp(v, a, b));
      x = cl(x, R.x0 + f0.w / 2, R.x1 - f0.w / 2); z = cl(z, R.z0 + f0.d / 2, R.z1 - f0.d / 2);   // to'siqdan chiqib ketmaydi
      const ok = slide([it.x, it.z], [x, z], (cx, cz) => this.itemFree({ ...f0, cx, cz }, k), 0.5);
      if (ok[0] === it.x && ok[1] === it.z) return false;
      it.x = ok[0]; it.z = ok[1];
      this.onChange && this.onChange(); return true;
    },
    rotItem(k) {
      const it = this.yard.items[k]; if (!it) return false;
      const cand = itemFoot({ ...it, rot: it.rot ? 0 : 90 });
      if (!this.itemFree(cand, k)) return false;
      it.rot = it.rot ? 0 : 90; this.onChange && this.onChange(); return true;
    },
    delItem(k) {
      if (!this.yard.items[k]) return;
      this.yard.items.splice(k, 1); this.ysel = -1; this.onChange && this.onChange();
    },

    // 90° ga buradi (soat strelkasi bo'yicha, yuqoridan qaraganda). Joy yetmasa — burilmaydi
    rotate(i) {
      const L = this.layout(), me = L[i]; if (!me) return false;
      const rot = (me.rot + 90) % 360, cand = { ...me, rot, w: me.d, d: me.w };
      if (!L.every((o, j) => j === i || footGap(o, cand) >= MIN_CLEAR) || !this.clearOfItems(cand)) return false;
      this.list[i].pos = { x: me.cx, z: me.cz, rot };
      this.onChange && this.onChange();
      return true;
    },

    // Serverga va qoralamaga yoziladigan shakl. params/cells — birinchi uy (eski format bilan moslik uchun)
    payload() {
      this.sync();
      return {
        params: this.list[0].params, cells: this.list[0].cells,
        buildings: this.list.map(b => ({ params: b.params, cells: b.cells, interior: b.interior, pos: b.pos })), gap: this.gap, yard: this.yard,
      };
    },

    select(i) {
      if (i === this.active || !this.list[i]) return;
      this.sync(); this.active = i; this.renderUI();
      this.onSelect && this.onSelect(this.list[i]);
    },

    // Faol uyning nusxasini yangi uy sifatida qo'shadi: noldan boshlashdan qulayroq
    add() {
      if (this.list.length >= MAX) return;
      this.sync();
      const cur = this.list[this.active], nb = { params: clone(cur.params), cells: clone(cur.cells), interior: cur.interior ? clone(cur.interior) : undefined };
      // Yangi uy hamma uylarning o'ng tomoniga, faol uy bilan bir chiziqqa qo'yiladi
      const L = siteLayout(this.list, this.gap), me = L[this.active], right = Math.max(...L.map(l => l.cx + l.w / 2));
      nb.pos = { x: right + this.gap + me.w / 2, z: me.cz, rot: me.rot };
      this.list.push(nb); this.active = this.list.length - 1; this.renderUI();
      // Faqat onSelect: u o'zi qayta chizadi. Oldin onChange chaqirilsa, eski uy parametrlari yangi uyga yozilib, ikki uy bitta obyektga aylanib qolardi
      this.onSelect && this.onSelect(nb);
    },

    remove() {
      if (this.list.length <= 1) return;
      this.sync(); this.list.splice(this.active, 1);
      this.active = Math.min(this.active, this.list.length - 1); this.renderUI();
      this.onSelect && this.onSelect(this.list[this.active]);
    },

    renderUI() {
      const tabs = el("bTabs");
      if (!tabs) return;
      // Tugmalar sonining o'zgarishidan tashqari faqat matnlar yangilanadi: fokus yo'qolmasin
      if (tabs.children.length !== this.list.length) {
        tabs.innerHTML = this.list.map((_, i) => `<button type="button" role="tab" data-i="${i}"><span></span><small></small></button>`).join("");
      }
      [...tabs.children].forEach((b, i) => {
        b.setAttribute("aria-pressed", String(i === this.active));
        b.querySelector("span").textContent = `${i + 1}-uy`;
        b.querySelector("small").textContent = ` · ${this.list[i].params.floors || "?"} qavat`;
      });
      const add = el("addBuilding"), del = el("delBuilding");
      add.disabled = this.list.length >= MAX;
      add.title = add.disabled ? `Eng ko'pi bilan ${MAX} ta uy` : "Faol uyning nusxasini qo'shadi";
      del.disabled = this.list.length <= 1;
      const many = this.list.length > 1;
      el("gapRow").hidden = !many;
      el("gap").value = this.gap;
      el("gapOut").textContent = `${this.gap} m`;
    },
  };

  // ---- Tugmalar (sahifa yuklanganda bir marta ulanadi) ----
  el("bTabs").addEventListener("click", e => {
    const b = e.target.closest("button"); if (b) S.select(Number(b.dataset.i));
  });
  el("addBuilding").addEventListener("click", () => S.add());
  el("delBuilding").addEventListener("click", e => {
    const btn = e.currentTarget;
    // Ikki bosqichli: tasodifan bosib, uyni yo'qotib qo'ymaslik uchun
    if (btn.dataset.armed !== "true") {
      btn.dataset.armed = "true"; btn.textContent = `${S.active + 1}-uyni o'chirish: tasdiqlang`;
      setTimeout(() => { btn.dataset.armed = "false"; btn.textContent = "Uyni olib tashlash"; }, 3000);
      return;
    }
    btn.dataset.armed = "false"; btn.textContent = "Uyni olib tashlash";
    S.remove();
  });
  el("gap").addEventListener("input", e => {
    S.gap = clamp(Number(e.target.value), 4, 30);
    el("gapOut").textContent = `${S.gap} m`;
    S.sync(); S.arrange();                 // slayder — "qatorga tizish" oralig'i
    S.onChange && S.onChange();
  });

  return S;
})();
