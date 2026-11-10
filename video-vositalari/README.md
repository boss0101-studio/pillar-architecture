# Reklama videosini qayta yasash

Video: `web/video/pillar-reklama.mp4` (1920×1080, 30 kadr/s, 44 s, H.264 + AAC 160 kbit/s). Musiqa original: brauzerda sintez qilinadi (96 BPM, Am–F–C–G; pad, arpedjio, bas, baraban, sahna o'tishlarida "vush", yakunda zarba) — mualliflik huquqi muammosiz.

1. `generator.html`ni `web/_video.html` nomi bilan `web/` papkasiga nusxalang (u `building.js`, `bolimlar.js`, `hero/`, `fon/` fayllaridan foydalanadi).
2. `python video-vositalari/videoserver.py 8021` — lokal server (faqat 127.0.0.1).
3. Chrome'da `http://localhost:8021/_video.html` ni oching, konsolda: `await RUN(); await ENCODE()`.
4. Tayyor MP4: `C:\Users\user\Videos\Pillar-reklama.mp4`, `web/video/` va `arxitektura/static/video/`. Muqova: `pillar-reklama.jpg`.
5. `web/_video.html`ni o'chiring (saytga chiqmasin).

Kadrlar WebCodecs bilan kodlanadi (real vaqt shart emas), MP4 konteyneri `videoserver.py`da Python standart kutubxonasi bilan yig'iladi — ffmpeg kerak emas.
