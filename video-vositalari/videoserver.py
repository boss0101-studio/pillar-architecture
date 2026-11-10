"""Reklama videosi uchun vaqtinchalik lokal server (faqat 127.0.0.1).
GET  — web/ papkadagi fayllar (generator sahifasi va loyiha rasmlari).
POST /mux — brauzer WebCodecs bilan kodlagan H.264 kadrlarini MP4 ga yig'adi va saqlaydi.
POST /poster — muqova JPEG.
Paket: [4 bayt JSON uzunligi][JSON {w,h,fps,sizes,keys}][4 bayt avcC uzunligi][avcC][kadrlar ketma-ket]"""
import http.server, json, pathlib, struct, sys, functools

WEB = pathlib.Path(r"C:\Users\user\Desktop\ustun-arxitektura\web")
OUT = [pathlib.Path(r"C:\Users\user\Videos\Pillar-reklama.mp4"), WEB / "video" / "pillar-reklama.mp4",
       pathlib.Path(r"C:\Users\user\Desktop\ustun-arxitektura\arxitektura\static\video\pillar-reklama.mp4")]
POSTER = [WEB / "video" / "pillar-reklama.jpg", pathlib.Path(r"C:\Users\user\Desktop\ustun-arxitektura\arxitektura\static\video\pillar-reklama.jpg")]

def box(kind, *parts):
    body = b"".join(parts)
    return struct.pack(">I", 8 + len(body)) + kind + body
def full(kind, ver, flags, *parts):
    return box(kind, struct.pack(">I", (ver << 24) | flags), *parts)

def mux(meta, avcc, data):
    w, h, fps, sizes, keys = meta["w"], meta["h"], meta["fps"], meta["sizes"], meta["keys"]
    au = meta.get("audio")                                       # ixtiyoriy AAC trek: video kadrlaridan keyin keladi
    n = len(sizes); vlen = sum(sizes); alen = sum(au["sizes"]) if au else 0
    assert n and vlen + alen == len(data), (n, vlen, alen, len(data))
    ftyp = box(b"ftyp", b"isom", struct.pack(">I", 512), b"isom", b"iso2", b"avc1", b"mp41")
    mdat_off = len(ftyp) + 8                                     # birinchi kadr mdat sarlavhasidan keyin
    mdat = struct.pack(">I", 8 + len(data)) + b"mdat" + data
    ts, dur_ms = fps, int(round(n * 1000 / fps))                 # media vaqt birligi: 1 kadr = 1
    matrix = struct.pack(">9I", 0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000)
    mvhd = full(b"mvhd", 0, 0, struct.pack(">IIII", 0, 0, 1000, dur_ms), struct.pack(">IH", 0x10000, 0x100), b"\0" * 10, matrix, b"\0" * 24, struct.pack(">I", 3 if au else 2))
    tkhd = full(b"tkhd", 0, 3, struct.pack(">IIIII", 0, 0, 1, 0, dur_ms), b"\0" * 8, struct.pack(">HHHH", 0, 0, 0, 0), matrix, struct.pack(">II", w << 16, h << 16))
    mdhd = full(b"mdhd", 0, 0, struct.pack(">IIII", 0, 0, ts, n), struct.pack(">HH", 0x55C4, 0))   # til: und
    hdlr = full(b"hdlr", 0, 0, struct.pack(">I", 0), b"vide", b"\0" * 12, b"Pillar video\0")
    vmhd = full(b"vmhd", 0, 1, b"\0" * 8)
    dinf = box(b"dinf", full(b"dref", 0, 0, struct.pack(">I", 1), full(b"url ", 0, 1)))
    avc1 = box(b"avc1", b"\0" * 6, struct.pack(">H", 1), b"\0" * 16, struct.pack(">HH", w, h), struct.pack(">II", 0x480000, 0x480000), struct.pack(">I", 0),
               struct.pack(">H", 1), b"\0" * 32, struct.pack(">Hh", 0x18, -1), box(b"avcC", avcc))
    stsd = full(b"stsd", 0, 0, struct.pack(">I", 1), avc1)
    stts = full(b"stts", 0, 0, struct.pack(">III", 1, n, 1))
    sync = [i + 1 for i, k in enumerate(keys) if k]
    stss = full(b"stss", 0, 0, struct.pack(">I", len(sync)), struct.pack(">%dI" % len(sync), *sync))
    stsc = full(b"stsc", 0, 0, struct.pack(">IIII", 1, 1, n, 1))
    stsz = full(b"stsz", 0, 0, struct.pack(">II", 0, n), struct.pack(">%dI" % n, *sizes))
    stco = full(b"stco", 0, 0, struct.pack(">II", 1, mdat_off))
    stbl = box(b"stbl", stsd, stts, stss, stsc, stsz, stco)
    minf = box(b"minf", vmhd, dinf, stbl)
    mdia = box(b"mdia", mdhd, hdlr, minf)
    trak = box(b"trak", tkhd, mdia)
    traks = [trak]
    if au:                                                       # AAC-LC trek (1 kadr = 1024 namuna)
        sr, chn, asz, asc = au["sr"], au["ch"], au["sizes"], bytes(au["asc"]); an = len(asz)
        desc = lambda tag, body: bytes([tag, len(body)]) + body   # MPEG-4 deskriptor (uzunlik < 128)
        dcd = desc(0x04, bytes([0x40, 0x15]) + b"\0\0\0" + struct.pack(">II", 160000, 160000) + desc(0x05, asc))
        esds = full(b"esds", 0, 0, desc(0x03, struct.pack(">HB", 1, 0) + dcd + desc(0x06, b"\x02")))
        mp4a = box(b"mp4a", b"\0" * 6, struct.pack(">H", 1), b"\0" * 8, struct.pack(">HHHH", chn, 16, 0, 0), struct.pack(">I", sr << 16), esds)
        adur = int(round(an * 1024 * 1000 / sr))
        atkhd = full(b"tkhd", 0, 3, struct.pack(">IIIII", 0, 0, 2, 0, adur), b"\0" * 8, struct.pack(">HHHH", 0, 1, 0x100, 0), matrix, struct.pack(">II", 0, 0))
        amdhd = full(b"mdhd", 0, 0, struct.pack(">IIII", 0, 0, sr, an * 1024), struct.pack(">HH", 0x55C4, 0))
        ahdlr = full(b"hdlr", 0, 0, struct.pack(">I", 0), b"soun", b"\0" * 12, b"Pillar music\0")
        smhd = full(b"smhd", 0, 0, b"\0" * 4)
        astbl = box(b"stbl", full(b"stsd", 0, 0, struct.pack(">I", 1), mp4a), full(b"stts", 0, 0, struct.pack(">III", 1, an, 1024)),
                    full(b"stsc", 0, 0, struct.pack(">IIII", 1, 1, an, 1)), full(b"stsz", 0, 0, struct.pack(">II", 0, an), struct.pack(">%dI" % an, *asz)),
                    full(b"stco", 0, 0, struct.pack(">II", 1, mdat_off + vlen)))
        traks.append(box(b"trak", atkhd, box(b"mdia", amdhd, ahdlr, box(b"minf", smhd, dinf, astbl))))
    moov = box(b"moov", mvhd, *traks)
    return ftyp + mdat + moov

class H(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); body = self.rfile.read(n)
        try:
            if self.path == "/mux":
                jl = struct.unpack(">I", body[:4])[0]; meta = json.loads(body[4:4 + jl]); p = 4 + jl
                al = struct.unpack(">I", body[p:p + 4])[0]; avcc = body[p + 4:p + 4 + al]; data = body[p + 4 + al:]
                mp4 = mux(meta, avcc, data)
                for f in OUT: f.parent.mkdir(parents=True, exist_ok=True); f.write_bytes(mp4)
                msg = {"ok": True, "bytes": len(mp4), "frames": len(meta["sizes"]), "saved": [str(f) for f in OUT]}
            elif self.path == "/poster":
                for f in POSTER: f.parent.mkdir(parents=True, exist_ok=True); f.write_bytes(body)
                msg = {"ok": True, "bytes": len(body)}
            else:
                msg = {"ok": False, "error": "unknown path"}
        except Exception as e:
            msg = {"ok": False, "error": repr(e)}
        out = json.dumps(msg).encode(); self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(out))); self.end_headers(); self.wfile.write(out)
        print(msg, flush=True)
    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8021
    http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(H, directory=str(WEB))).serve_forever()
