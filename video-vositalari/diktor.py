"""Reklama videosi uchun diktor ovozi: har sahnaga bitta jumla, 4 tilda neyron erkak ovoz (Microsoft Edge TTS).
Natija: video-vositalari/ovoz/<til>/1.mp3 … 9.mp3.
Ishga tushirish: python video-vositalari/diktor.py [uz en ru es]   (edge-tts paketi kerak; til berilmasa — hammasi)."""
import asyncio, pathlib, sys
import edge_tts

# ru: erkak ovozi ru-RU-DmitryNeural 2026-11-10 da xizmatdan javob bermadi — vaqtincha ayol ovozi (Svetlana)
VOICES = {"uz": "uz-UZ-SardorNeural", "en": "en-US-AndrewNeural", "ru": "ru-RU-SvetlanaNeural", "es": "es-ES-AlvaroNeural"}
LINES = {
    "uz": [
        "Pillar — uyingizni bugunoq loyihalang.",
        "Qavat, tom, material va derazalarni tanlang — bino shu zahoti chizmada paydo bo'ladi.",
        "Erkin qurishda devorlarni qo'lda chizing — Pillar ularni aniq chizmaga aylantiradi.",
        "Uyingizni uch o'lchamda ko'ring, virtual reallikda ichida yuring va mebel joylang.",
        "O'n uchta loyiha bo'limi: bosh reja, arxitektura, konstruksiya, muhandislik tarmoqlari va smeta — chizmalar avtomatik tayyorlanadi.",
        "Uy rasmini yuklang — Pillar dizayn rejasini tuzadi va aynan o'sha uyni Konstruktorda quradi.",
        "Qurilish narxini oldindan biling: materiallar va smeta bir zumda hisoblanadi.",
        "Sun'iy intellekt yordamchisi savollaringizga javob beradi va kerakli bo'limni ochadi.",
        "Pillar. Bepul sinab ko'ring — QR kodni skanerlang.",
    ],
    "en": [
        "Pillar — design your home today.",
        "Choose floors, roof, materials and windows — your building appears on the drawing instantly.",
        "In Free Build, sketch walls by hand — Pillar turns them into a precise drawing.",
        "See your home in 3D, walk inside it in virtual reality and place the furniture.",
        "Thirteen project sections: site plan, architecture, structures, building services and cost estimate — drawings are generated automatically.",
        "Upload a photo of a house — Pillar creates a design plan and rebuilds that exact house in the Designer.",
        "Know the construction cost in advance: materials and estimates are calculated in a moment.",
        "The AI assistant answers your questions and opens the right section.",
        "Pillar. Try it for free — scan the QR code.",
    ],
    "ru": [
        "Pillar — спроектируйте свой дом уже сегодня.",
        "Выберите этажи, крышу, материалы и окна — здание сразу появится на чертеже.",
        "В режиме свободного строительства рисуйте стены от руки — Pillar превратит их в точный чертёж.",
        "Смотрите дом в 3D, гуляйте по нему в виртуальной реальности и расставляйте мебель.",
        "Тринадцать разделов проекта: генплан, архитектура, конструкции, инженерные сети и смета — чертежи готовятся автоматически.",
        "Загрузите фото дома — Pillar составит дизайн-план и построит точно такой же дом в Конструкторе.",
        "Узнайте стоимость строительства заранее: материалы и смета рассчитываются за секунды.",
        "Помощник с искусственным интеллектом отвечает на вопросы и открывает нужный раздел.",
        "Pillar. Попробуйте бесплатно — отсканируйте QR-код.",
    ],
    "es": [
        "Pillar: diseña tu casa hoy mismo.",
        "Elige plantas, cubierta, materiales y ventanas: el edificio aparece al instante en el plano.",
        "En Construcción libre, dibuja los muros a mano: Pillar los convierte en un plano preciso.",
        "Mira tu casa en 3D, recórrela en realidad virtual y coloca los muebles.",
        "Trece secciones del proyecto: plano general, arquitectura, estructuras, instalaciones y presupuesto: los planos se generan automáticamente.",
        "Sube una foto de una casa: Pillar crea un plan de diseño y reconstruye esa misma casa en el Diseñador.",
        "Conoce el coste de la obra de antemano: materiales y presupuesto se calculan al instante.",
        "El asistente con inteligencia artificial responde tus preguntas y abre la sección adecuada.",
        "Pillar. Pruébalo gratis: escanea el código QR.",
    ],
}
ROOT = pathlib.Path(__file__).resolve().parent / "ovoz"

async def main(langs):
    for lang in langs:
        out = ROOT / lang; out.mkdir(parents=True, exist_ok=True)
        for i, text in enumerate(LINES[lang], 1):
            if (out / f"{i}.mp3").exists() and (out / f"{i}.mp3").stat().st_size > 0 and "--force" not in sys.argv:
                continue
            for attempt in range(8):                     # xizmat ba'zan bo'sh javob qaytaradi — qayta urinamiz
                try:
                    await asyncio.wait_for(edge_tts.Communicate(text, VOICES[lang], rate="+4%").save(str(out / f"{i}.mp3")), 45)
                    if (out / f"{i}.mp3").stat().st_size > 0: break
                except (edge_tts.exceptions.NoAudioReceived, asyncio.TimeoutError, OSError):
                    await asyncio.sleep(2 + attempt * 2)
            else:
                raise SystemExit(f"{lang} {i}: ovoz olinmadi")
            print(lang, i, (out / f"{i}.mp3").stat().st_size, "bayt", flush=True)

asyncio.run(main([a for a in sys.argv[1:] if a in LINES] or list(LINES)))
