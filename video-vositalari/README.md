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
