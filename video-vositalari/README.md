# Reklama videosini qayta yasash (4 til: uz / en / ru / es)

Videolar: `web/video/pillar-reklama-<til>.mp4` (1920×1080, 30 kadr/s, ~60–65 s, H.264 1,6 Mbit/s + AAC 160 kbit/s, har biri < 15 MiB). Oxirida sayt QR kodi (qrcode-generator, M daraja). Musiqa original: brauzerda sintez qilinadi (96 BPM, Am–F–C–G) — mualliflik huquqi muammosiz.

- Ekran matnlari: `generator.html` ichidagi `TX` lug'ati (`uz`, `en`, `ru`, `es`). Rus tili uchun shriftlar Oswald + Inter (Big Shoulders Display va Archivo'da kirill yo'q).
- Diktor: `diktor.py` — erkak neyron ovozlar (Microsoft Edge TTS): uz-UZ-SardorNeural, en-US-AndrewNeural, ru-RU-DmitryNeural, es-ES-AlvaroNeural. Sahna jumladan qisqa bo'lsa — o'zi uzayadi; musiqa gap paytida pasayadi.

0. `python video-vositalari/diktor.py [uz en ru es]` → `video-vositalari/ovoz/<til>/1…9.mp3` (bor fayllar o'tkazib yuboriladi; qayta yaratish: `--force`). Xizmat ba'zan javob bermaydi — skript qayta urinadi. So'ng `ovoz/` ichidagi til papkalarini `web/_ovoz/` ga nusxalang.
1. `generator.html`ni `web/_video.html` nomi bilan nusxalang (u `building.js`, `bolimlar.js`, `hero/`, `fon/` fayllaridan foydalanadi).
2. `python video-vositalari/videoserver.py 8021` — lokal server (faqat 127.0.0.1).
3. Chrome'da `http://localhost:8021/_video.html`, konsolda har til uchun: `await RUN("en"); await ENCODE()`.
4. Tayyor MP4: `C:\Users\user\Videos\Pillar-reklama-<til>.mp4`, `web/video/` va `arxitektura/static/video/`. Muqova: `pillar-reklama-<til>.jpg`.
5. Tekshiruv: `CHECKQR(sekund)` — kadrdan QR o'qiladi. `web/_video.html` va `web/_ovoz/`ni o'chiring (saytga chiqmasin).

Bosh sahifadagi til tugmalari — `web/promovideo.js` (boshlang'ich til = sayt tili). Kadrlar WebCodecs bilan kodlanadi, MP4 konteyneri `videoserver.py`da Python standart kutubxonasi bilan yig'iladi — ffmpeg kerak emas.

## O'zbekcha: ElevenLabs ovozi (2026-11-17)
Hozirgi `pillar-reklama-uz.mp4` diktori — ElevenLabs (ovoz "Asilbek", matn: `elevenlabs/uz-emotsiya.txt`). Manba: `ovoz/uz-elevenlabs.mp3` (bitta fayl, 60,8 s).
Qayta yasashda generator `_ovoz/uz/full.mp3` ni o'qib, sahnalarga pauzalar o'rtasidan bo'ladi: `CUTS_S = [5.37, 13.78, 20.64, 29.45, 35.63, 41.43, 47.90, 54.62]` (s).
Buning uchun `web/_video.html` dagi diktor yuklash qatoridan keyin full.mp3 ni CUTS_S bo'yicha kesadigan kod qo'shiladi (generator.html'da yo'q — vaqtinchalik nusxada qilingan).
Ekran yozuvlari (`TX.uz`) hali eski ssenariyda.

## Logotip (2026-11-18)
Videoda "Peshtoq" logotipi: 1-sahnada chap yuqorida, har sahnada o'ng yuqori burchakda (ixcham), yakuniy sahnada katta to'liq logo (+ "architecture").
Geometriya `generator.html` dagi `BRAND` o'zgarmasida — `brend/yaratish.py` dan olingan (ARKA, WORD, SUB, SW, KW, HW). Logo o'zgarsa, shu qiymatlarni qayta ko'chiring.
Shriftlar yuklanmasa (fonts.gstatic.com ochilmasa) `RUN()` xato beradi — video zaxira shriftda chiqib qolmasin.

## Villa sahnasi — haqiqiy dron kadrlari (2026-11-19)
2-sahna "Orzuingizdagi villa — avval Pillar'da" (13,9 s, diktorsiz): tepadan villa → villa atrofida uchish → ichkariga "sho'ng'ish" (oq chaqnash) → oshxona → yotoqxona → hovli va basseyn. Ustida dron ekrani (REC, ALT/SPD).
Kliplar Mixkit'dan (Mixkit Stock Video Free License — tijoratda bepul, muallif ko'rsatish shart emas), gitga qo'shilmaydi — qayta yasashdan oldin `web/_villa/` ga yuklab oling:
`8179, 27543, 43033, 4196, 47286` → `https://assets.mixkit.co/videos/<id>/<id>-720.mp4` → `web/_villa/<id>.mp4`. Klip vaqtlari `generator.html` dagi `VILLA` jadvalida.
"Rasmdan dizayn" sahnasi olib tashlandi (bo'lim saytda yo'q); diktorning 6-jumlasi `VOICE_SKIP` bilan o'tkazib yuboriladi.
