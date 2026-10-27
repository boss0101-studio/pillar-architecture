// Sodda rejim: yangi foydalanuvchi faqat asosiy boshqaruvlarni ko'radi (qavat, shakl, tom, material, asosiy asboblar, saqlash).
// Qolgani — qo'shimcha o'lchamlar, geometrik chiziqlar, formulalar, JSON, kam ishlatiladigan asboblar — "To'liq" rejimda.
// Hech narsa o'chirilmaydi: style.css dagi html.simple qoidalari faqat yashiradi. Tanlov shu brauzerda eslab qolinadi ("ustun-rejim").
const UstunSimple = (function () {
  const KEY = "ustun-rejim";
  let simple = true;
  try { simple = localStorage.getItem(KEY) !== "full"; } catch {}
  const root = document.documentElement;
  root.classList.toggle("simple", simple);

  function apply() {
    root.classList.toggle("simple", simple);
    document.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.mode === "simple") === simple)));
  }
  function set(v) {
    simple = !!v;
    try { localStorage.setItem(KEY, simple ? "simple" : "full"); } catch {}
    apply();
    window.dispatchEvent(new CustomEvent("ustun-rejim", { detail: { simple } }));
  }

  // Konstruktor sarlavhasida: Sodda | To'liq almashtirgichi va sodda rejim uchun 3 qadamli qisqa ko'rsatma
  function mount() {
    const form = document.getElementById("params"), side = form && form.closest("main") && form.closest("main").querySelector(".ds-head-side");
    if (!side || side.querySelector(".mode-sw")) return;
    const p = side.querySelector("p"); if (p) p.dataset.adv = "";
    side.insertAdjacentHTML("afterbegin", `<div class="mode-sw" role="group" aria-label="Interfeys rejimi">
        <span class="label">Rejim</span><button type="button" data-mode="simple">Sodda</button><button type="button" data-mode="full">To'liq</button></div>
      <ol class="mode-steps">
        <li>Chapda qavatlar, plan shakli va tomni tanlang.</li>
        <li>Pastdagi asbobni olib, fasad katagini bosing.</li>
        <li>Tayyor bo'lsa — nom yozib, Saqlang.</li>
      </ol>
      <p class="mode-hint muted">Sodda rejim: faqat asosiy sozlamalar. Barcha imkoniyatlar — To'liq rejimda.</p>`);
    apply();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-mode]"); if (b) set(b.dataset.mode === "simple");
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  return { get simple() { return simple; }, set, apply };
})();
window.UstunSimple = UstunSimple;
