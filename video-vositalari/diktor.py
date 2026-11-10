"""Reklama videosi uchun diktor ovozi: har sahnaga bitta jumla, o'zbekcha neyron ovoz (Microsoft Edge TTS, uz-UZ-SardorNeural).
Natija: video-vositalari/ovoz/1.mp3 … 9.mp3. Ishga tushirish: python video-vositalari/diktor.py  (edge-tts paketi kerak)."""
import asyncio, pathlib
import edge_tts

VOICE = "uz-UZ-SardorNeural"
LINES = [
    "Pillar — uyingizni bugunoq loyihalang.",
    "Qavat, tom, material va derazalarni tanlang — bino shu zahoti chizmada paydo bo'ladi.",
    "Erkin qurishda devorlarni qo'lda chizing — Pillar ularni aniq chizmaga aylantiradi.",
    "Uyingizni uch o'lchamda ko'ring, virtual reallikda ichida yuring va mebel joylang.",
    "O'n uchta loyiha bo'limi: bosh reja, arxitektura, konstruksiya, muhandislik tarmoqlari va smeta — chizmalar avtomatik tayyorlanadi.",
    "Uy rasmini yuklang — Pillar dizayn rejasini tuzadi va aynan o'sha uyni Konstruktorda quradi.",
    "Qurilish narxini oldindan biling: materiallar va smeta bir zumda hisoblanadi.",
    "Sun'iy intellekt yordamchisi savollaringizga javob beradi va kerakli bo'limni ochadi.",
    "Pillar. Bepul sinab ko'ring — QR kodni skanerlang.",
]
OUT = pathlib.Path(__file__).resolve().parent / "ovoz"

async def main():
    OUT.mkdir(exist_ok=True)
    for i, text in enumerate(LINES, 1):
        await edge_tts.Communicate(text, VOICE, rate="+4%").save(str(OUT / f"{i}.mp3"))
        print(i, (OUT / f"{i}.mp3").stat().st_size, "bayt")

asyncio.run(main())
