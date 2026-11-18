"""Pillar Architecture logotipi — "Peshtoq": firuza portal ichida o'tkir (sharqona) arka, tepada ikki guldasta;
yozuv — kichik harfli geometrik "pillar", ostida aynan shu kenglikdagi "architecture". Harflar chiziq bilan
chizilgan (shriftga bog'liq emas). Shakllar shu yerda bir marta yozilgan — barcha variantlar ulardan yig'iladi.
Ishlatish:  python brend/yaratish.py   (so'ng PNG: bash brend/png-yaratish.sh)
"""
import pathlib

OUT = pathlib.Path(__file__).resolve().parent
FIRUZA, FIRUZA_TUN = "#11766f", "#4fc2b8"          # Samarqand koshinlari rangi; to'q fonda — ochroq
GRAFIT, OQ, TUN = "#161a1d", "#eceeed", "#121516"

# ---- Kichik harflar: tayanch chiziq y=26, kichik harf balandligi 18 (y 8..26), yuqori 0, pastki 34 ----
G = {
    "p": ("M2 8V34M11 8a9 9 0 1 1 0 18a9 9 0 1 1 0-18", 20),
    "i": ("M2 8v18M2 0.5v4.5", 4),
    "l": ("M2 0v26", 4),
    "a": ("M9 8a9 9 0 1 0 0 18a9 9 0 1 0 0-18M18 8v18", 20),
    "r": ("M2 8v18M2 17a9 9 0 0 1 9-9h2.5", 14),
    "c": ("M16.4 11.6A9 9 0 1 0 16.4 22.4", 17),
    "h": ("M2 0v26M2 17a8 8 0 0 1 16 0v9", 20),
    "t": ("M5 1v20a5 5 0 0 0 5 5h2.5M0 9.5h12", 13),
    "e": ("M1 17h16A8.2 8.2 0 1 0 14.9 22.9", 18),
    "u": ("M2 8v9a7 7 0 0 0 14 0M16 8v18", 18),
}
SW = 4.2                                            # asosiy yozuv chizig'i


def word(text, track):
    x, parts = 0.0, []
    for ch in text:
        d, w = G[ch]
        parts.append(f'<path transform="translate({x:.2f} 0)" d="{d}"/>')
        x += w + track
    return "".join(parts), x - track


def st(color, inner, sw, tx=0, ty=0, s=1):
    tr = f' transform="translate({tx:.2f} {ty:.2f}){f" scale({s})" if s != 1 else ""}"' if (tx or ty or s != 1) else ""
    return f'<g fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="butt" stroke-linejoin="miter"{tr}>{inner}</g>'


WORD, WORD_W = word("pillar", 4.5)                  # eni 88,5
SUB_S = 0.36
SUB, _ = word("architecture", (WORD_W / SUB_S - sum(G[c][1] for c in "architecture")) / 11)   # "pillar" eniga cho'zilgan


def wordmark(color, x, y):
    return st(color, WORD, SW, x, y) + st(color, SUB, SW * 0.55, x, y + 44, SUB_S)


# ---- Belgi (64×64): portal + o'tkir arka (teshik) + ikki guldasta ----
ARKA = "M10 10H54V58H10Z M22 58V33C22 24.5 27 19 32 14C37 19 42 24.5 42 33V58Z"


def peshtoq(c, towers=True):
    t = (f'<rect x="10" y="4" width="6" height="7"/><rect x="48" y="4" width="6" height="7"/>' if towers else "")
    return f'<g fill="{c}"><path fill-rule="evenodd" d="{ARKA}"/>{t}</g>'


def place(inner, x, y, s=1):
    return f'<g transform="translate({x:g} {y:g}){f" scale({s:g})" if s != 1 else ""}">{inner}</g>'


def svg(w, h, body, scale=4):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w * scale:g}" height="{h * scale:g}" '
            f'role="img" aria-label="Pillar Architecture"><title>Pillar Architecture</title>\n{body}\n</svg>\n')


HW = 64 + 20 + WORD_W + 4                            # gorizontal: belgi + yozuv (+4 — chiziq chetdan chiqmasin)
VW, VH = WORD_W + 24, 142                            # vertikal: belgi tepada, yozuv ostida


def horizontal(mc, tc):
    return peshtoq(mc) + wordmark(tc, 84, 4)


def vertical(mc, tc):
    return place(peshtoq(mc), (VW - 64) / 2, 4) + wordmark(tc, 12, 78)


FILES = {
    "pillar-logo.svg": svg(HW, 64, horizontal(FIRUZA, GRAFIT)),               # och fon
    "pillar-logo-tungi.svg": svg(HW, 64, horizontal(FIRUZA_TUN, OQ)),         # to'q fon
    "pillar-logo-oq.svg": svg(HW, 64, horizontal("#ffffff", "#ffffff")),      # foto/rangli fon ustida, bir rang
    "pillar-logo-vertikal.svg": svg(VW, VH, vertical(FIRUZA, GRAFIT)),
    "pillar-logo-vertikal-tungi.svg": svg(VW, VH, vertical(FIRUZA_TUN, OQ)),
    "pillar-belgi.svg": svg(64, 64, peshtoq(FIRUZA)),
    "pillar-belgi-oq.svg": svg(64, 64, peshtoq("#ffffff")),
    "pillar-belgi-qora.svg": svg(64, 64, peshtoq(GRAFIT)),
    "pillar-ikonka.svg": svg(64, 64, f'<rect width="64" height="64" fill="{FIRUZA}"/>\n' + place(peshtoq("#ffffff"), 9, 8, 0.72)),
    # favicon: guldastasiz (16 px'da mayda bo'laklar shovqin bo'ladi), portal kattaroq
    "favicon.svg": svg(64, 64, f'<rect width="64" height="64" rx="12" fill="{FIRUZA}"/>\n' + place(peshtoq("#ffffff", False), 4.8, -0.6, 0.85)),
}

# Ixcham (sayt menyusi uchun): peshtoq + "pillar", "architecture"siz — 32–40 px balandlikda u o'qilmaydi
KW = 64 + 16 + WORD_W + 3


def compact(mark_fill, text_color):
    return peshtoq(mark_fill) + st(text_color, WORD, SW, 80, 15)


FILES["pillar-logo-kompakt.svg"] = svg(KW, 64, compact(FIRUZA, GRAFIT))


def nav_markup():
    """nav.js uchun: belgi rangi CSS o'zgaruvchisidan (--logo), yozuv — joriy matn rangi (mavzu va foto ustida moslashadi)"""
    return (f'<svg class="brand-logo" viewBox="0 0 {KW:g} 64" aria-hidden="true" focusable="false">'
            + compact("var(--logo,#11766f)", "currentColor").replace('<g fill="var(--logo,#11766f)">', '<g style="fill:var(--logo,#11766f)">')
            + "</svg>")

if __name__ == "__main__":
    for old in OUT.glob("*.svg"):
        if old.name not in FILES:
            old.unlink()                                   # eski fayllar qolmasin
    for name, text in FILES.items():
        (OUT / name).write_text(text, encoding="utf-8", newline="\n")
        print(name)
    print(f"gorizontal {HW:g}x64, vertikal {VW:g}x{VH}")
