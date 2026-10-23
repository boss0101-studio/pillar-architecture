# Loyihani internetga chiqarish va Google'da topiladigan qilish

Sayt tayyor holda `sayt/` papkasida turibdi (`sayt.zip` — xuddi shuning arxivi).
U serversiz ishlaydi, shuning uchun istalgan bepul statik hostingga yuklash mumkin.

## 1-qadam. Saytni internetga joylash (Netlify, bepul, ~5 daqiqa)

1. Brauzerda **https://app.netlify.com/drop** ni oching.
2. Hisobingiz bilan kiring (Google yoki GitHub orqali). Hisob ochish va kirishni o'zingiz qilasiz.
3. Kompyuterdagi **`sayt`** papkasini (yoki `sayt.zip` ni) sahifadagi maydonga sudrab tashlang.
4. Bir necha soniyada sayt ochiladi va tasodifiy nomli manzil beriladi, masalan `https://jolly-fox-123.netlify.app`.
5. Nomini chiroyli qilish: **Site configuration → Change site name** → `ustun-arxitektura` (band bo'lsa, boshqa nom tanlang).
   Natija: `https://ustun-arxitektura.netlify.app`

> Agar manzil `ustun-arxitektura.netlify.app` dan boshqacha bo'lsa, saytni shu manzil bilan qayta yig'ing:
> ```
> python sayt-yaratish.py --url https://SIZNING-MANZILINGIZ.netlify.app
> ```
> va Netlify'da **Deploys** bo'limiga yangi `sayt` papkasini qayta sudrab tashlang.

Muqobillar: GitHub Pages (github.com da repo ochib, `sayt` ichidagi fayllarni yuklash), Cloudflare Pages yoki Vercel ham xuddi shunday ishlaydi.

## 2-qadam. Google'ga saytni tanitish (Search Console)

1. **https://search.google.com/search-console** ni oching va Google hisobingiz bilan kiring.
2. **Mulk qo'shish → URL prefiksi** → sayt manzilini yozing (`https://ustun-arxitektura.netlify.app/`).
3. Tasdiqlash usulidan **HTML teg** ni tanlang. Google `<meta name="google-site-verification" content="...">` ko'rinishidagi qator beradi.
4. `sayt/index.html` ni oching, `GOOGLE-TASDIQ` izohli qatorni toping va o'rniga Google bergan qatorni qo'ying.
   Saytni Netlify'ga qayta yuklang, keyin Search Console'da **Tasdiqlash** tugmasini bosing.
   (Diqqat: `python sayt-yaratish.py` ni qayta ishga tushirsangiz, bu qator o'chadi — kerak bo'lsa yana qo'ying.)
5. Chap menyuda **Sitemaps** → `sitemap.xml` deb yozing → **Yuborish**.
6. **URL tekshiruvi** → bosh sahifa manzilini kiriting → **Indekslashni so'rash**.

Google odatda saytni **bir necha kundan 2–3 haftagacha** bo'lgan muddatda qidiruvga qo'shadi. Buni tezlashtirib bo'lmaydi.
Tekshirish uchun Google'da yozing: `site:ustun-arxitektura.netlify.app`

## Qidiruvda yuqoriroq chiqishi uchun

- Saytga boshqa joylardan havola qo'ying: Telegram kanal, Instagram profili, Google Biznes profili (agar kompaniya bo'lsa).
- Sayt nomi va tavsifi `sayt-yaratish.py` boshidagi `TITLE` va `DESC` da. Ularni o'zgartirib, saytni qayta yig'ish mumkin.

## Saytni yangilash

Loyihada biror narsa o'zgarsa:
```
python sayt-yaratish.py
```
so'ng yangi `sayt` papkasini Netlify'da **Deploys** maydoniga sudrab tashlang. Manzil o'zgarmaydi.

## Bilish kerak bo'lgan cheklovlar

- Internetdagi versiya **serversiz** ishlaydi: galereya va buyurtmalar har bir tashrif buyuruvchining o'z brauzerida saqlanadi, boshqalarga ko'rinmaydi.
  Umumiy galereya va admin panel (Python server) uchun alohida server hosting kerak (masalan Render yoki PythonAnywhere).
- Sayt bitta sahifadan iborat (bo'limlar `#konstruktor`, `#erkin` kabi). Google uni bitta sahifa sifatida indekslaydi.
