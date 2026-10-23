// AI dizaynga aralashadi: konstruktordagi loyihani o'qiydi va o'zgartiradi (qavat, oraliq, tom, material, kataklar,
// yangi uy, hovli, ichki reja) va rasm bo'yicha butun binoni noldan quradi.
// Sahifa o'zini window.DesignHost bilan tanishtiradi (web.js yoki designer.js); u yo'q sahifada AI faqat maslahat beradi.
// Har bir amal tekshiriladi (ProjectIO.cleanParams/cleanCells — fayldan ochilgan loyihadagi kabi), noto'g'ri qiymat o'tmaydi.
const AIDesign = (function () {
  const host = () => window.DesignHost || null;
  const clone = o => JSON.parse(JSON.stringify(o));
  const CELL_TYPES = ["win", "wide", "arch", "slit", "round", "lattice", "balc", "door", "shop", "arcade", "wall", "auto"];
  const LIMITS = "floors 1–30, bays 2–12, floor_h 2.7–4.5 m, bay_w 3–7.5 m, depth 6–30 m";
  let last = null;                                                     // oxirgi AI o'zgarishidan oldingi holat (bekor qilish uchun)

  // ---------- Model uchun asbob ta'rifi (Claude tool) ----------
  // Sxema ixcham (artifact: ≤ 4 KB); qiymatlar ma'nosi GUIDE matnida — u so'rov bilan birga yuboriladi
  const P = { type: "object", properties: {
    floors: { type: "integer" }, bays: { type: "integer" }, floor_h: { type: "number" }, bay_w: { type: "number" }, depth: { type: "number" },
    roof: { type: "string", enum: OPTIONS.roof }, material: { type: "string", enum: Object.keys(MATERIALS) }, window: { type: "string", enum: Object.keys(WINDOW_CELL) },
    ground: { type: "string", enum: OPTIONS.ground }, category: { type: "string", enum: OPTIONS.category }, quality: { type: "string", enum: OPTIONS.quality } } };
  const CELL = { type: "object", properties: { floor: { type: ["integer", "string"] }, bay: { type: ["integer", "string"] }, type: { type: "string", enum: CELL_TYPES } }, required: ["floor", "bay", "type"] };
  const SCHEMA = {
    type: "object", required: ["actions"],
    properties: { actions: { type: "array", minItems: 1, maxItems: 20, items: {
      type: "object", required: ["type"],
      properties: {
        type: { type: "string", enum: ["new_design", "set_params", "set_cells", "clear_cells", "add_house", "remove_house", "select_house", "yard", "interior"] },
        house: { type: "integer" }, name: { type: "string" }, params: P,
        houses: { type: "array", maxItems: 3, items: { type: "object", properties: { params: P, cells: { type: "array", items: CELL } } } },
        cells: { type: "array", maxItems: 120, items: CELL },
        on: { type: "boolean" }, fence: { type: "string", enum: Object.keys(FENCES) },
        items: { type: "array", maxItems: 20, items: { type: "string", enum: Object.keys(YARD_ITEMS) } },
        clear_items: { type: "boolean" }, mode: { type: "string", enum: ["auto", "clear"] },
      } } } },
  };
  const GUIDE = `apply_design guide: house = 1-based house number (default: active house). Limits: ${LIMITS}. ` +
    "roof: tekis=flat, nishab=gable/pitched, bir=single-pitch, piramida=pyramid, gumbaz=dome, terrasa=roof terrace. " +
    "material: gisht=red fired brick, oqgisht=white brick, beton=concrete panel, qorabeton=dark concrete, ganch=white plaster, travertin=travertine, tosh=natural stone, koshin=blue glazed tile, yogoch=wood, metall=metal panel. " +
    "window (default on upper floors): oddiy=standard, arkali=arched, panorama=panoramic, tor=narrow vertical, dumaloq=round, panjara=lattice, yoq=none. " +
    "ground: oddiy=windows + middle door, arkada=arcade, vitrina=shop windows. " +
    "cells: floor 1 = ground floor (or \"all\"/\"upper\"), bay 1 = leftmost (or \"all\"/\"middle\"); type win=window, wide=panoramic, arch=arched, slit=narrow, round, lattice, balc=balcony, door, shop=shop window, arcade, wall=blank, auto=default. " +
    "new_design: houses[] (1–3, each params + cells) replaces the project — use it to build from a photo. yard: on, fence (devor=brick, panjara=iron, yogoch=wood, yoq=none), items (tree, bed=flower bed, pool, suri=daybed, car=parking). interior: mode auto|clear.";
  const TOOL_DESC = "Change the building project open in the Designer: set floors, bays, sizes, roof, material, window type, ground floor; paint facade cells " +
    "(windows, balconies, doors, shop windows, arcade, blank wall); start a new design with 1–3 houses (use it to build a building from a photo); add/remove/select houses; " +
    "turn the yard on and add trees, pool, daybed, parking; generate or clear the interior plan. The project state is given in <design_state>.";

  // ---------- Joriy holat (model uchun qisqa JSON) ----------
  function describe() {
    const h = host(); if (!h) return null;
    Site.sync();
    return JSON.stringify({
      active_house: Site.active + 1,
      houses: Site.list.map(b => ({ params: b.params, cells: Object.entries(b.cells || {}).map(([k, t]) => { const [f, c] = k.split(",").map(Number); return { floor: f + 1, bay: c + 1, type: t }; }), interior: !!b.interior })),
      yard: { on: Site.yard.on, fence: Site.yard.fence, items: Site.yard.items.map(i => i.t) },
      limits: LIMITS,
    });
  }

  // ---------- Amallarni bajarish ----------
  const pickHouse = a => { const i = Number.isInteger(a.house) ? a.house - 1 : Site.active; if (!Site.list[i]) throw new Error(`house ${a.house} not found`); return i; };
  function cleanP(base, patch) { return ProjectIO.cleanParams({ ...base, ...(patch || {}) }); }
  function expandCells(p, list) {                                    // {floor:"all", bay:"middle"} -> aniq kataklar
    const out = [];
    const floors = v => v === "all" ? [...Array(p.floors).keys()] : v === "upper" ? [...Array(p.floors).keys()].slice(1) : [Number(v) - 1];
    const bays = v => v === "all" ? [...Array(p.bays).keys()] : v === "middle" ? [Math.floor(p.bays / 2)] : [Number(v) - 1];
    (Array.isArray(list) ? list : []).forEach(c => {
      if (!CELL_TYPES.includes(c && c.type)) return;
      floors(c.floor).forEach(f => bays(c.bay).forEach(b => { if (f >= 0 && f < p.floors && b >= 0 && b < p.bays) out.push([`${f},${b}`, c.type]); }));
    });
    return out;
  }
  function putCells(target, p, list) {
    expandCells(p, list).forEach(([k, t]) => { if (t === "auto") delete target[k]; else target[k] = t; });
    const ok = ProjectIO.cleanCells(target, p);                      // faqat ruxsat etilgan turlar va chegaralar qoladi
    Object.keys(target).forEach(k => { if (!(k in ok)) delete target[k]; });
  }
  // Faol uy konstruktorning o'zgaruvchilari bilan bir obyekt: joyida o'zgartiramiz, aks holda Site.sync eski qiymatni qaytaradi
  const houseRef = i => (i === Site.active ? { params: host().params(), cells: host().cells(), b: Site.list[i] } : { params: Site.list[i].params, cells: Site.list[i].cells, b: Site.list[i] });
  function setYardItems(a) {
    if (a.on !== undefined || a.fence) Site.setYard({ ...(a.on !== undefined ? { on: !!a.on } : {}), ...(a.fence ? { fence: a.fence } : {}) });
    if (a.clear_items || (Array.isArray(a.items) && a.items.length && Site.yard.items.length && a.on)) Site.yard.items = [];
    let added = 0;
    (Array.isArray(a.items) ? a.items : []).forEach(t => { if (Site.yard.on && Site.addItem(t)) added++; });
    return added;
  }

  function apply(actions) {
    const h = host();
    if (!h) return { ok: false, error: "The Designer is not open on this page — open the Designer (Konstruktor) to let the assistant change the building." };
    if (!Array.isArray(actions) || !actions.length) return { ok: false, error: "no actions" };
    Site.sync();
    const before = JSON.stringify({ ...Site.payload(), active: Site.active });
    const done = [], errors = [];
    actions.slice(0, 20).forEach((a, n) => {
      try {
        switch (a && a.type) {
          case "new_design": {
            const list = (Array.isArray(a.houses) && a.houses.length ? a.houses : [{ params: a.params || {} }]).slice(0, Site.MAX).map(x => {
              const p = cleanP(DEFAULT_PARAMS, x.params), c = {}; putCells(c, p, x.cells); return { params: p, cells: c };
            });
            h.load(list, 10, String(a.name || "").slice(0, 80), "");
            done.push(`new_design: ${list.length} house(s), ${list.map(b => `${b.params.floors} floors × ${b.params.bays} bays, ${b.params.roof}, ${b.params.material}`).join("; ")}`);
            break;
          }
          case "set_params": {
            const i = pickHouse(a), r = houseRef(i), np = cleanP(r.params, a.params);
            Object.assign(r.params, np);
            const ok = ProjectIO.cleanCells(r.cells, np); Object.keys(r.cells).forEach(k => { if (!(k in ok)) delete r.cells[k]; });   // kichraygan fasaddan tashqaridagi kataklar
            done.push(`house ${i + 1} params: ${Object.keys(a.params || {}).map(k => `${k}=${np[k]}`).join(", ")}`);
            break;
          }
          case "set_cells": { const i = pickHouse(a), r = houseRef(i); putCells(r.cells, r.params, a.cells); done.push(`house ${i + 1}: ${Object.keys(r.cells).length} custom cells`); break; }
          case "clear_cells": { const i = pickHouse(a), r = houseRef(i); Object.keys(r.cells).forEach(k => delete r.cells[k]); done.push(`house ${i + 1}: cells reset`); break; }
          case "add_house": {
            if (Site.list.length >= Site.MAX) throw new Error(`at most ${Site.MAX} houses`);
            Site.add();                                                // faol uy nusxasi; onSelect konstruktor o'zgaruvchilarini yangilaydi
            if (a.params) { const r = houseRef(Site.active); Object.assign(r.params, cleanP(r.params, a.params)); }
            done.push(`house ${Site.list.length} added`);
            break;
          }
          case "remove_house": { const i = pickHouse(a); if (Site.list.length <= 1) throw new Error("the only house can't be removed"); Site.select(i); Site.remove(); done.push(`house ${i + 1} removed`); break; }
          case "select_house": { const i = pickHouse(a); Site.select(i); done.push(`house ${i + 1} selected`); break; }
          case "yard": { const k = setYardItems(a); done.push(`yard ${Site.yard.on ? "on" : "off"}, fence ${Site.yard.fence}, +${k} items`); break; }
          case "interior": {
            const i = pickHouse(a), b = Site.list[i]; Site.sync();
            b.interior = a.mode === "clear" ? undefined : Interior.auto(b.params);
            done.push(`house ${i + 1} interior ${a.mode === "clear" ? "cleared" : "generated"}`);
            break;
          }
          default: throw new Error(`unknown action "${a && a.type}"`);
        }
      } catch (e) { errors.push(`step ${n + 1}: ${e.message}`); }
    });
    if (done.length) { last = before; h.refresh(); }
    return { ok: errors.length === 0, done, errors, state: describe() };
  }

  function undo() {
    const h = host(); if (!h || !last) return false;
    const d = JSON.parse(last); last = null;
    h.load(d.buildings, d.gap, null, "", d.yard);
    if (d.active && Site.list[d.active]) Site.select(d.active);
    return true;
  }

  // ---------- Oflayn: oddiy buyruqlarni tushunish ("5 qavat", "tom gumbaz", "3 floors") ----------
  const WORDS = {
    floors: /(\d+)\s*(?:-?\s*)?(?:qavat|floors?|stor(?:e)?ys?|этаж\w*|plantas?|pisos?|kat\b|katlı|étages?|stockwerke?|geschosse?)/,
    bays: /(\d+)\s*(?:ta\s*)?(?:oraliq|bays?|пролет\w*|vanos?|açıklık|travées?|felder|achsen)/,
    roof: [["gumbaz", /gumbaz|dome|купол|cúpula|kubbe|dôme|kuppel/], ["piramida", /piramid|pyramid|пирамид|pirámide|piramit|pyramide/], ["terrasa", /terras|terrace|террас|terraza|teras/],
      ["bir", /bir nishab|single.?pitch|shed roof|односкат|una vertiente|tek eğim|monopente|pultdach/], ["nishab", /nishab|gable|pitched|двускат|скатн|dos aguas|beşik|deux pentes|satteldach/], ["tekis", /tekis tom|flat roof|плоск|techo plano|düz çatı|toit plat|flachdach/]],
    material: [["oqgisht", /oq g'isht|white brick|бел\w* кирпич|ladrillo blanco|beyaz tuğla|brique blanche|weiße?r? ziegel/], ["gisht", /g'isht|brick|кирпич|ladrillo|tuğla|brique|ziegel/],
      ["qorabeton", /qora beton|dark concrete|черн\w* бетон|hormigón negro|siyah beton|béton noir|dunkle?r? beton/], ["beton", /beton|concrete|бетон|hormigón/],
      ["travertin", /travertin/], ["tosh", /tosh|stone|камен|piedra|taş|pierre|stein/], ["koshin", /koshin|tile|изразц|azulejo|çini|faïence/],
      ["yogoch", /yog'och|wood|дерев|madera|ahşap|bois|holz/], ["metall", /metall|metal/], ["ganch", /ganch|plaster|штукатур|yeso|sıva|plâtre|putz/]],
  };
  function parseCommand(q) {
    const s = String(q).toLowerCase().replace(/[ʻʼ’‘`]/g, "'"), p = {};
    let m = WORDS.floors.exec(s); if (m) p.floors = Number(m[1]);
    m = WORDS.bays.exec(s); if (m) p.bays = Number(m[1]);
    for (const [v, re] of WORDS.roof) if (re.test(s)) { p.roof = v; break; }
    for (const [v, re] of WORDS.material) if (re.test(s)) { p.material = v; break; }
    const acts = Object.keys(p).length ? [{ type: "set_params", params: p }] : [];
    if (/balkon|balcon|балкон|balkon/.test(s) && /(qo'sh|qo'y|add|добав|añad|ekle|ajout|hinzu)/.test(s)) acts.push({ type: "set_cells", cells: [{ floor: "upper", bay: "all", type: "balc" }] });
    if (/hovli|yard|двор|patio|avlu|cour|hof/.test(s) && /(qo'sh|yoq|add|turn on|добав|включ|añad|activa|ekle|ajout|hinzu)/.test(s)) acts.push({ type: "yard", on: true });
    if (/(ichki|interior|интерьер|комнат|habitaci|iç mekân|oda|intérieur|pièces|innen|zimmer)/.test(s) && /(avto|auto|yarat|qil|create|generate|созда|crea|genera|oluştur|crée|génère|erstell)/.test(s)) acts.push({ type: "interior", mode: "auto" });
    return acts;
  }

  return { available: () => !!host(), describe, apply, undo, canUndo: () => !!last, parseCommand, SCHEMA, TOOL_DESC, GUIDE };
})();
window.AIDesign = AIDesign;
