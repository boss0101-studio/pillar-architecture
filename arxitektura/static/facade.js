// Loyiha ma'lumotidan (qavatlar, maydon, kategoriya) sxematik fasad chizmasini yasaydi.
// Rasm o'rniga chizma: har bir loyiha o'z qavatlari soniga mos ko'rinishga ega bo'ladi.
function facadeSVG(p) {
  const W = 320, H = 200, ground = 176;
  const shown = Math.min(p.floors, 16);              // juda baland binolar siqib chiziladi
  const floorH = Math.min(18, 130 / shown);
  const bays = p.category === "interyer" ? 5 : Math.max(3, Math.min(9, Math.round(Math.sqrt(p.area_m2 / Math.max(1, p.floors)) / 6)));
  const bw = Math.min(240, bays * 26);
  const x0 = (W - bw) / 2, h = shown * floorH, y0 = ground - h;

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(p.title)}: ${p.floors} qavatli fasad sxemasi">`;
  s += `<line class="ground" x1="12" y1="${ground}" x2="${W - 12}" y2="${ground}"/>`;
  s += `<rect class="mass" x="${x0}" y="${y0}" width="${bw}" height="${h}"/>`;

  // Turar-joyda pog'onali terrasa, jamoat binosida soyabon
  if (p.category === "jamoat") {
    s += `<rect class="mass" x="${x0 - 14}" y="${y0 - 6}" width="${bw + 28}" height="6"/>`;
  }
  const cw = bw / bays;
  for (let f = 0; f < shown; f++) {
    const fy = ground - (f + 1) * floorH;
    for (let b = 0; b < bays; b++) {
      if (f === 0 && b === Math.floor(bays / 2)) {   // kirish eshigi
        s += `<rect class="win" x="${x0 + b * cw + cw * .25}" y="${fy + floorH * .2}" width="${cw * .5}" height="${floorH * .8}"/>`;
        continue;
      }
      const wide = p.category === "tijorat";
      s += `<rect class="win" x="${x0 + b * cw + cw * (wide ? .08 : .25)}" y="${fy + floorH * .25}" width="${cw * (wide ? .84 : .5)}" height="${floorH * .5}"/>`;
    }
  }
  // Balandlik o'lcham chizig'i (taxminan 3.3 m qavat)
  const dx = x0 + bw + 18;
  const height = (p.floors * 3.3).toFixed(1).replace(".", ",");
  s += `<line class="dimline" x1="${dx}" y1="${y0}" x2="${dx}" y2="${ground}"/>`;
  s += `<line class="dimline" x1="${dx - 4}" y1="${y0}" x2="${dx + 4}" y2="${y0}"/>`;
  s += `<line class="dimline" x1="${dx - 4}" y1="${ground}" x2="${dx + 4}" y2="${ground}"/>`;
  s += `<text class="dimtext" x="${dx + 6}" y="${(y0 + ground) / 2 + 3}">+${height}</text>`;
  s += `<text class="dimtext" x="14" y="${H - 8}">${p.floors} qavat · ${p.area_m2.toLocaleString("ru-RU")} m²</text>`;
  return s + `</svg>`;
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
