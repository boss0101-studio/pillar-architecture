// Fayllar: yuklab olish va loyihani JSON fayl sifatida saqlash / fayldan ochish.

// Faylni foydalanuvchiga beradi. Artifact ichida brauzer yuklab olishni bloklaydi, u yerda "downloads" imkoniyati ishlatiladi.
window.saveFile = async function (filename, data) {
  const c = window.claude;
  if (c && typeof c.use === "function") {
    const d = await c.use("downloads");
    if (d) return d.save({ filename, data });
  }
  const type = filename.endsWith(".json") ? "application/json" : filename.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/octet-stream";
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const ProjectIO = (function () {
  const FORMAT = "ustun-loyiha";
  const LIMITS = { floors: [1, 30, 1], bays: [2, 12, 1], floor_h: [2.7, 4.5, 0.1], bay_w: [3, 7.5, 0.1], depth: [6, 30, 0.5], wing: [0.2, 0.6, 0.1] };
  const CELLS = new Set(Object.keys(OPENING));

  // Fayl ichidagi ma'lumot ishonchsiz: har bir qiymat ruxsat etilgan oraliqqa keltiriladi
  function cleanParams(raw) {
    const p = {};
    for (const [k, [lo, hi, step]] of Object.entries(LIMITS)) {
      const v = Number(raw && raw[k]);
      p[k] = Number.isFinite(v) ? Math.round(Math.round(Math.min(hi, Math.max(lo, v)) / step) * step * 10) / 10 : DEFAULT_PARAMS[k];
    }
    for (const [k, list] of Object.entries(OPTIONS)) p[k] = list.includes(raw && raw[k]) ? raw[k] : DEFAULT_PARAMS[k];
    return p;
  }
  function cleanCells(raw, p) {
    const out = {};
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        const m = /^(\d{1,2}),(\d{1,2})$/.exec(k);
        if (m && CELLS.has(v) && +m[1] < p.floors && +m[2] < p.bays) out[k] = v;
      }
    }
    return out;
  }

  function serialize(name, payload) {
    return JSON.stringify({
      format: FORMAT, version: 1, name, savedAt: new Date().toISOString(),
      gap: payload.gap, buildings: payload.buildings.map(b => ({ params: b.params, cells: b.cells, pos: b.pos, interior: b.interior })), yard: payload.yard,
    }, null, 2);
  }
  function parse(text) {
    let d;
    try { d = JSON.parse(text); } catch { throw new Error("Fayl JSON formatida emas."); }
    if (!d || typeof d !== "object" || d.format !== FORMAT) throw new Error("Bu Pillar loyiha fayli emas.");
    const raw = Array.isArray(d.buildings) ? d.buildings.slice(0, 3) : [];
    if (!raw.length) throw new Error("Faylda birorta ham uy topilmadi.");
    const buildings = raw.map(b => { const p = cleanParams(b && b.params); return { params: p, cells: cleanCells(b && b.cells, p), pos: cleanPos(b && b.pos), interior: Interior.clean(b && b.interior) }; });
    return { name: String(d.name || "").slice(0, 80), gap: Math.min(30, Math.max(4, Math.round(Number(d.gap) || 10))), buildings, yard: cleanYard(d.yard) };
  }

  const P = { serialize, parse, cleanParams, cleanCells, getPayload: null, onLoad: null };
  const msg = (text, ok) => { const m = document.getElementById("saveMsg"); if (m) { m.textContent = text; m.className = "msg " + (ok ? "ok" : "bad"); } };

  const exp = document.getElementById("exportJson"), inp = document.getElementById("importFile");
  if (exp) exp.addEventListener("click", async () => {
    if (!P.getPayload) return;
    const name = ((document.getElementById("dName") || {}).value || "").trim() || "loyiha";
    try {
      await window.saveFile(`${name.replace(/[^\w\-]+/g, "_") || "loyiha"}.json`, serialize(name, P.getPayload()));
      msg(`"${name}" fayl sifatida saqlandi. Uni boshqa kompyuterda "Fayldan ochish" orqali ochish mumkin.`, true);
    } catch (err) {
      if (!err || err.code !== "declined") msg("Faylni saqlab bo'lmadi.", false);
    }
  });
  if (inp) inp.addEventListener("change", () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { msg("Fayl juda katta (2 MB dan ortiq).", false); inp.value = ""; return; }
    const r = new FileReader();
    r.onload = () => {
      try { const d = parse(String(r.result)); P.onLoad && P.onLoad(d); }
      catch (err) { msg(err.message, false); }
      finally { inp.value = ""; }
    };
    r.onerror = () => msg("Faylni o'qib bo'lmadi.", false);
    r.readAsText(f);
  });
  return P;
})();
