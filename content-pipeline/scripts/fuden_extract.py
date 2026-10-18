"""Extreu el text de tots els fitxers de FUDEN (referència privada) i en fa un catàleg.

Ús: python -I scripts/fuden_extract.py
Escriu data/fuden/text/<n>.txt i data/fuden/catalog.json amb, per a cada fitxer: secció,
activitat, nom, pàgines, caràcters i si sembla escanejat (sense capa de text).
"""
import json
import pathlib
import re
import zipfile

import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "raw" / "fuden"
OUT = ROOT / "data" / "fuden"


def docx_text(p: pathlib.Path) -> str:
    with zipfile.ZipFile(p) as z:
        names = [n for n in z.namelist() if re.match(r"(word/document|ppt/slides/slide\d+|content)\.xml$", n)]
        xml = " ".join(z.read(n).decode("utf-8", "replace") for n in sorted(names))
    xml = re.sub(r"</w:p>|</a:p>|</text:p>", "\n", xml)
    return re.sub(r"[ \t]+", " ", re.sub(r"<[^>]+>", "", xml)).strip()


def pdf_text(p: pathlib.Path) -> tuple[str, int]:
    doc = pymupdf.open(p)
    return "\n\f\n".join(page.get_text() for page in doc), doc.page_count


def main():
    inv = json.loads((RAW / "map.json").read_text(encoding="utf-8"))
    (OUT / "text").mkdir(parents=True, exist_ok=True)
    catalog = []
    for sec in inv["sections"]:
        stitle = sec["title"].split("|")[0].replace("Mosaico: ", "").strip()
        for a in sec["activities"]:
            files = [a["fetched"]] if (a.get("fetched") or {}).get("kind") == "file" else []
            files += [f for f in a.get("files", []) if f.get("kind") == "file"]
            for f in files:
                p = RAW / f["file"] if not pathlib.Path(f["file"]).is_absolute() else pathlib.Path(f["file"])
                if not p.exists():
                    p = RAW / pathlib.Path(f["file"]).relative_to(pathlib.Path(f["file"]).anchor) if False else RAW / f["file"]
                entry = {"id": len(catalog), "section": stitle, "activity": a["name"], "mod": a["mod"], "file": str(p.relative_to(RAW)), "pages": None}
                try:
                    head = p.read_bytes()[:4]
                    if head.startswith(b"%PDF"):
                        txt, entry["pages"] = pdf_text(p)
                    elif head.startswith(b"PK"):
                        txt = docx_text(p)
                    else:
                        txt = ""
                        entry["note"] = "format no llegible (doc/ppt antic o icona)"
                except Exception as e:  # noqa: BLE001
                    txt, entry["error"] = "", f"{type(e).__name__}: {e}"
                entry["chars"] = len(txt)
                entry["scanned"] = bool(entry["pages"]) and len(txt) / max(1, entry["pages"]) < 80
                (OUT / "text" / f"{entry['id']}.txt").write_text(txt, encoding="utf-8")
                catalog.append(entry)
    (OUT / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding="utf-8")
    scanned = [c for c in catalog if c["scanned"]]
    print(f"Fitxers: {len(catalog)} · amb text: {sum(1 for c in catalog if c['chars'] > 0 and not c['scanned'])} · escanejats: {len(scanned)}")
    print(f"Pàgines totals: {sum(c['pages'] or 0 for c in catalog)} · caràcters: {sum(c['chars'] for c in catalog):,}")
    for c in scanned:
        print("  ESCANEJAT:", c["section"][:30], "|", c["activity"][:50], "|", c["pages"], "pàg")


if __name__ == "__main__":
    main()
