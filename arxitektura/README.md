# Pillar Architecture

Arxitektura byurosi sayti va **bino konstruktori**: o'z binongizni noldan loyihalang,
fasadga deraza, balkon va eshiklarni qo'ying, 3D ko'rinishini va taxminiy narxini ko'ring.

## Kerak bo'ladigan narsa

Faqat **Python 3.8 yoki yangisi**. Boshqa hech narsa o'rnatilmaydi, internet ham shart emas
(faqat shriftlar internetdan yuklanadi, internetsiz oddiy shrift bilan ishlaydi).

Python yo'q bo'lsa: https://www.python.org/downloads/
Windows'da o'rnatayotganda **"Add python.exe to PATH"** belgisini qo'ying.

## Ishga tushirish

**Windows:** `ishga-tushirish.bat` faylini ikki marta bosing.

**macOS / Linux:** shu papkada terminal ochib:

```bash
sh ishga-tushirish.sh
```

**Yoki qo'lda:**

```bash
python server.py
```

Brauzerda oching:

| Sahifa | Manzil |
|---|---|
| Asosiy sayt | http://localhost:8000 |
| Bino konstruktori | http://localhost:8000/designer.html |
| Admin panel | http://localhost:8000/admin.html |

To'xtatish: server oynasini yoping yoki `Ctrl+C`.

## Admin panel

Har ishga tushganda server oynasida vaqtinchalik **admin token** chiqadi — admin panelga shu bilan kiriladi.
Doimiy token o'rnatish:

```bash
# Windows (PowerShell)
$env:ADMIN_TOKEN = "o'z-tokeningiz"; python server.py
# macOS / Linux
ADMIN_TOKEN="o'z-tokeningiz" python3 server.py
```

## Ma'lumotlar

Birinchi ishga tushishda shu papkada `arxitektura.db` fayli yaratiladi (7 ta namunaviy loyiha bilan).
Saqlangan dizaynlar va arizalar shu faylda turadi. Toza holatga qaytish uchun serverni to'xtatib,
`arxitektura.db` ni o'chiring.

8000-port band bo'lsa, boshqa portda ishga tushiring: `PORT=8080` (yoki PowerShell'da `$env:PORT = "8080"`).

## Fayllar

```
server.py          Backend: REST API, ma'lumot tekshiruvi, SQLite
static/
  index.html       Asosiy sayt: portfolio, smeta, ariza
  designer.html    Bino konstruktori
  admin.html       Admin panel
  building.js      Fasad va 3D chizish mexanizmi
  designer.js      Konstruktor mantig'i
  app.js, admin.js, facade.js, style.css
```

## API

| Metod | Yo'l | Kim | Vazifa |
|---|---|---|---|
| GET | /api/projects?category= | hamma | Loyihalar ro'yxati |
| GET | /api/projects/{id} | hamma | Bitta loyiha |
| GET | /api/stats | hamma | Umumiy statistika |
| POST | /api/estimate | hamma | Smeta hisoblash |
| POST | /api/requests | hamma | Ariza yuborish |
| GET | /api/designs | hamma | Konstruktorda saqlangan dizaynlar |
| GET | /api/designs/{id} | hamma | Bitta dizayn |
| POST | /api/designs | hamma | Dizaynni saqlash |
| DELETE | /api/designs/{id} | admin | Dizaynni o'chirish |
| GET | /api/requests | admin | Arizalar |
| PATCH | /api/requests/{id} | admin | Ariza holatini o'zgartirish |
| POST | /api/projects | admin | Loyiha qo'shish |
| DELETE | /api/projects/{id} | admin | Loyihani o'chirish |

Admin so'rovlari `Authorization: Bearer <token>` sarlavhasi bilan yuboriladi.
