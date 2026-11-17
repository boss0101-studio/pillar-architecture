# ElevenLabs uchun diktor matni (o'zbekcha)

Jami 868 belgi (bepul tarifga ham sig'adi).

## Fayllar
- `uz-toliq.txt` — butun matn bitta faylda. Ovozni tanlab ko'rish uchun yoki bitta audio kerak bo'lsa.
- `uz-sahnalar/1.txt … 9.txt` — har sahna alohida. **Video uchun shu kerak**: video har sahnaga alohida audio ishlatadi.

## Qadamlar
1. elevenlabs.io → **Text to Speech**.
2. Model: o'zbek tilini qo'llaydigan modelni tanlang (Eleven v3 yoki model ro'yxatida "Uzbek" ko'rsatilgani).
3. Ovoz: xotirjam, ishonchli erkak yoki ayol ovozi. Avval 1-sahnani sinab ko'ring.
4. `uz-sahnalar/1.txt` matnini qo'ying → Generate → MP3 yuklab oling, nomini `1.mp3` qiling. 2–9 uchun takrorlang.
5. Barcha sahnalarda **bir xil ovoz va sozlamalar**dan foydalaning — aks holda ovoz sahnadan sahnaga o'zgaradi.
6. 9 ta faylni `video-vositalari/ovoz/uz/` papkasiga qo'ying (eskilarini almashtiradi), so'ng video `README.md` dagi tartibda qayta yasaladi.

## Matn haqida
- O'zbek lotin imlosi: `oʻ`, `gʻ` (U+02BB) va tutuq belgisi `ʼ` (U+02BC) — oddiy `'` o'rniga. Ovoz modeli bularni harf sifatida o'qiydi, oddiy `'` ba'zan pauza yoki xato talaffuz beradi.
- Raqam va qisqartmalar so'z bilan yozilgan ("o'n uchta", "sun'iy intellekt"). Faqat "QR" qoldi — noto'g'ri o'qisa, "kyu-ar" deb yozing.
