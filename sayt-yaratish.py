"""Internetga (Netlify, GitHub Pages va h.k.) joylash uchun mustaqil sayt yig'adi: web/ -> sayt/.

Ishlatish:
    python sayt-yaratish.py                                   # manzil: https://ustun-arxitektura.netlify.app
    python sayt-yaratish.py --url https://mening-saytim.netlify.app

Nima qiladi:
  * web/ papkasidagi fayllarni sayt/ ga ko'chiradi;
  * index.html ga to'liq <head> qo'shadi: charset, til, Google uchun tavsif, Open Graph (ijtimoiy tarmoq ko'rinishi), canonical;
  * robots.txt, sitemap.xml (Google qidiruv robotlari uchun), favicon.svg va 404.html yaratadi;
  * yuklash qulay bo'lishi uchun sayt.zip tayyorlaydi.
"""
import argparse
import datetime
import pathlib
import shutil
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
SRC, OUT = ROOT / "web", ROOT / "sayt"

TITLE = "Pillar Architecture — bino konstruktori, 3D, VR va smeta"
DESC = ("Binongizni brauzerda o'zingiz loyihalang: fasad konstruktori, noldan devor chizish, ichki xonalar va mebel, "
        "hovli, 3D va VR ko'rinish, g'isht, beton va fundament hisob-kitobi hamda taxminiy smeta. Bepul, ro'yxatdan o'tmasdan.")
FAVICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#14181c"/><path d="M14 52V26L32 12l18 14v26z" fill="none" stroke="#8ea2ff" stroke-width="5" stroke-linejoin="round"/><path d="M26 52V36h12v16" fill="none" stroke="#8ea2ff" stroke-width="5"/></svg>"""


def head(url):
    return f"""<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{TITLE}</title>
<meta name="description" content="{DESC}">
<meta name="keywords" content="arxitektura, bino loyihasi, uy loyihasi, 3D konstruktor, smeta, g'isht hisobi, fundament hisobi, Toshkent, O'zbekiston">
<link rel="canonical" href="{url}/">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="{url}/">
<meta property="og:locale" content="uz_UZ">
<meta name="theme-color" content="#14181c">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<!-- GOOGLE-TASDIQ: Search Console bergan <meta name="google-site-verification" ...> tegini shu qatorga qo'ying -->
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"WebApplication","name":"Pillar Architecture","url":"{url}/","applicationCategory":"DesignApplication","operatingSystem":"Any","inLanguage":"uz","description":"{DESC}","offers":{{"@type":"Offer","price":"0","priceCurrency":"USD"}}}}</script>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://ustun-arxitektura.netlify.app", help="saytning internetdagi manzili")
    url = ap.parse_args().url.rstrip("/")

    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC, OUT)

    page = (SRC / "index.html").read_text(encoding="utf-8")
    lines = page.splitlines()
    # Artifact uchun yozilgan sahifada <head> yo'q: <title> qatori o'rniga to'liq head qo'yamiz
    while lines and lines[0].lstrip().startswith(("<title>", "<meta charset")):   # to'liq head o'zimizniki
        lines = lines[1:]
    body_at = next(i for i, l in enumerate(lines) if l.lstrip().startswith("<nav"))
    html = head(url) + "\n".join(lines[:body_at]) + "\n</head>\n<body>\n" + "\n".join(lines[body_at:]) + "\n</body>\n</html>\n"
    (OUT / "index.html").write_text(html, encoding="utf-8")

    (OUT / "favicon.svg").write_text(FAVICON, encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {url}/sitemap.xml\n", encoding="utf-8")
    today = datetime.date.today().isoformat()
    (OUT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"  <url><loc>{url}/</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n",
        encoding="utf-8")
    (OUT / "404.html").write_text(
        '<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        # GitHub Pages'da sayt /repo-nomi/ ichida turadi: "/" emas, sayt manzilining o'ziga qaytariladi
        f'<title>Sahifa topilmadi — Pillar</title><meta http-equiv="refresh" content="3; url={url}/"></head>'
        '<body style="font-family:sans-serif;background:#14181c;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0">'
        f'<p>Bunday sahifa yo\'q. <a href="{url}/" style="color:#8ea2ff">Bosh sahifaga</a> qaytilmoqda…</p></body></html>\n',
        encoding="utf-8")

    zpath = ROOT / "sayt.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(OUT.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(OUT).as_posix())
    n = sum(1 for f in OUT.rglob("*") if f.is_file())
    print(f"Tayyor: {OUT}  ({n} ta fayl)")
    print(f"Zip:    {zpath}")
    print(f"Manzil: {url}/   (boshqa bo'lsa: python sayt-yaratish.py --url https://...)")


if __name__ == "__main__":
    main()
