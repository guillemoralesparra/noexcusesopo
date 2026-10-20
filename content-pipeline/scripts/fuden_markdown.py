"""Converteix tot el material de FUDEN (referència privada) a Markdown llegible com a web.

Ús: python -I scripts/fuden_markdown.py [--force] [--workers N] [id ...]
    python -I scripts/fuden_markdown.py --reclean   (només torna a netejar els .md existents)
Llegeix data/fuden/catalog.json (fet per fuden_extract.py) i escriu a data/fuden/web/:
  md/<id>-<nom>.md   un Markdown per document, amb capçalera YAML i una marca <!-- pàg. N -->
                     a l'inici de cada pàgina (per citar la pàgina literal del PDF)
  img/<id>/pNNN.webp una imatge de cada diapositiva i de cada pàgina escanejada (enllaçada des del .md)
  index.json         catàleg: id, títol, secció, pàgines, mètode, fitxers i índex de títols
Tot es fa en local: pymupdf4llm (text amb format), Tesseract (pàgines escanejades) i Pillow (WebP).
"""
import json
import os
import pathlib
import re
import sys
import unicodedata
import zipfile
from concurrent.futures import ProcessPoolExecutor, as_completed

import pymupdf
import pymupdf4llm

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "raw" / "fuden"
OUT = ROOT / "data" / "fuden" / "web"
TESSDATA = pathlib.Path.home() / "tessdata"
SLIDES = "Presentacions"  # secció de les presentacions de les sessions presencials
SLIDE_ZOOM = 1.25
WEBP_QUALITY = 60
# Marca d'aigua de descàrrega ("Descarga autorizada a ... desde oposiciones.fuden.es"), amb el format que hi posa pymupdf4llm
WATERMARK = re.compile(r"_?Descarga autorizada a.{0,160}?oposiciones\.fuden\.es_?(<br>)?", re.S)


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()[:70] or "doc"


# Trossos de la marca d'aigua que pymupdf4llm parteix amb <br> dins de taules ("_JDLHH (id 138_", "_de oposiciones.fuden.es_")
WM_PIECE = re.compile(r"(Descarga au|autorizad|JDL|138173|\(id 1\d|\d{3}\) el \d|fuden\.es)")
# Trossos curts en cursiva ("_scarga au_", "_026 14:13:40 desde op_"): només si duen restes reconeixibles
WM_ITALIC = re.compile(r"^_[^_<|\n]{1,40}_$")
WM_HINT = re.compile(r"scarga|autor(?![es])|izada|JD|LHH|138|\d\) el|fuden|desde|(?<![a-zà-ú])opos|\d:\d\d:|10-202|-2026")


def wm_piece(s: str) -> bool:
    t = s.strip()
    return bool(WM_PIECE.search(t)) or bool(WM_ITALIC.match(t) and WM_HINT.search(t))


def clean(md: str) -> str:
    md = WATERMARK.sub("", md)
    md = re.sub(r"Descarga autorizada a \S+ \(id \d+\) el [\d :-]+(desde)?", "", md)
    md = re.sub(r"(?:^|(?<=<br>)|(?<=\|))[^|<\n]{0,60}(?=<br>|\||\n|$)",
                lambda m: "" if wm_piece(m.group(0)) else m.group(0), md, flags=re.M)
    md = re.sub(r"(<br>){2,}", "<br>", md).replace("|<br>", "|").replace("<br>|", "|")
    return re.sub(r"\n{3,}", "\n\n", md).strip()


def ocr_text(page: pymupdf.Page) -> str:
    tp = page.get_textpage_ocr(language="cat+spa", dpi=300, full=True, tessdata=str(TESSDATA))
    return page.get_text(textpage=tp)


def docx_markdown(xml: str) -> str:
    """Paràgrafs de Word a Markdown: llistes com a "- " i negreta/subratllat com a **…** (sovint marquen la resposta)."""
    lines = []
    for p in re.findall(r"<w:p[ >].*?</w:p>", xml, re.S):
        runs = []
        for r in re.findall(r"<w:r[ >].*?</w:r>", p, re.S):
            t = "".join(re.findall(r"<w:t(?: [^>]*)?>(.*?)</w:t>", r, re.S))
            if not t:
                continue
            marked = re.search(r"<w:b/>|<w:b w:val=\"(1|true)\"/>|<w:highlight |<w:u w:val=\"(?!none)", r)
            runs.append(f"**{t.strip()}** " if marked and t.strip() else t)
        text = re.sub(r"[ \t]+", " ", "".join(runs)).replace("** **", " ").strip()
        text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        if text:
            lines.append(("- " if "<w:numPr>" in p else "") + text)
    return "\n\n".join(lines)


def office_text(p: pathlib.Path) -> str:
    """Text de docx/pptx/odt. Els .doc/.ppt binaris no es poden llegir."""
    with zipfile.ZipFile(p) as z:
        names = [n for n in z.namelist() if re.match(r"(word/document|ppt/slides/slide\d+|content)\.xml$", n)]
        names.sort(key=lambda n: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", n)])
        parts = []
        for n in names:
            xml = z.read(n).decode("utf-8", "replace")
            if n == "word/document.xml":
                parts.append(docx_markdown(xml))
                continue
            xml = re.sub(r"</w:p>|</a:p>|</text:p>|</text:h>", "\n", xml)
            txt = re.sub(r"[ \t]+", " ", re.sub(r"<[^>]+>", "", xml)).strip()
            parts.append(f"<!-- diapositiva {len(parts) + 1} -->\n{txt}" if n.startswith("ppt/") else txt)
    return "\n\n".join(parts)


def convert(item: dict) -> dict:
    src = RAW / item["file"].replace("\\", "/")
    title = item["activity"].strip() or src.stem
    name = f"{item['id']:03d}-{slug(src.stem)}.md"
    rec = {"id": item["id"], "title": title, "section": item["section"], "source": item["file"], "md": f"md/{name}",
           "pages": 0, "method": "", "ocr_pages": [], "images": None, "toc": []}
    ext = src.suffix.lower()
    # Alguns fitxers tenen l'extensió malmesa ("...CATALUNYApdf", "...APdocx."): es decideix pel contingut
    magic = src.read_bytes()[:4]
    if magic == b"%PDF":
        doc = pymupdf.open(src, filetype="pdf")
        chunks = pymupdf4llm.to_markdown(doc, page_chunks=True, show_progress=False)
        slides = SLIDES in item["section"]
        body = []
        for i, ch in enumerate(chunks):
            page = doc[i]
            text = clean(ch["text"])
            # Pàgina sense capa de text però amb imatge: escanejada → OCR, i se'n guarda la imatge
            # perquè l'OCR de taules (plantilles de solucions) no és fiable
            scanned = len(page.get_text().strip()) < 20 and bool(page.get_images())
            # Capa de text amb la tipografia codificada (surt "�"): es llegeix amb OCR com si fos escanejada
            scanned = scanned or ch["text"].count("�") > 20
            if scanned:
                text = clean(ocr_text(page))
                rec["ocr_pages"].append(i + 1)
            img = ""
            if slides or scanned:
                d = OUT / "img" / str(item["id"])
                d.mkdir(parents=True, exist_ok=True)
                f = d / f"p{i + 1:03d}.webp"
                if not f.exists():
                    page.get_pixmap(matrix=pymupdf.Matrix(SLIDE_ZOOM, SLIDE_ZOOM)).pil_save(f, format="WEBP", quality=WEBP_QUALITY)
                img = f"![pàg. {i + 1}](../img/{item['id']}/{f.name})\n\n"
                rec["images"] = f"img/{item['id']}"
            body.append(f"<!-- pàg. {i + 1} -->\n\n{img}{text}")
            for line in text.splitlines():
                m = re.match(r"^(#{1,4})\s+(.*)$", line)
                if m:
                    h = re.sub(r"[*_`]", "", m.group(2)).strip()
                    if h:
                        rec["toc"].append({"level": len(m.group(1)), "text": h, "page": i + 1})
        rec["pages"] = doc.page_count
        rec["method"] = "pymupdf4llm" + ("+ocr" if rec["ocr_pages"] else "")
        doc.close()
        md = "\n\n".join(body)
    elif magic.startswith(b"PK"):
        md = clean(office_text(src))
        rec["method"] = "office-xml"
    else:
        md = f"> Format {ext or '(sense extensió)'} no convertible automàticament. Original: `{item['file']}`"
        rec["method"] = "no-convertit"
    head = "---\n" + "\n".join(f"{k}: {json.dumps(rec[k], ensure_ascii=False)}" for k in ("id", "title", "section", "source", "pages", "method")) + "\n---\n\n"
    (OUT / rec["md"]).write_text(head + f"# {title}\n\n" + md + "\n", encoding="utf-8")
    return rec


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows (cp1252) no admet alguns títols
    args = sys.argv[1:]
    if "--reclean" in args:  # torna a aplicar clean() als .md ja fets, sense convertir de nou
        n = 0
        for f in (OUT / "md").glob("*.md"):
            old = f.read_text(encoding="utf-8")
            head, _, body = old.partition("\n---\n\n")
            new = head + "\n---\n\n" + clean(body) + "\n"
            if new != old:
                f.write_text(new, encoding="utf-8")
                n += 1
        print(f"{n} fitxers netejats")
        return
    force = "--force" in args
    workers = int(args[args.index("--workers") + 1]) if "--workers" in args else 4
    only = {int(a) for i, a in enumerate(args) if a.isdigit() and (i == 0 or args[i - 1] != "--workers")}
    catalog = json.loads((ROOT / "data" / "fuden" / "catalog.json").read_text(encoding="utf-8"))
    items = [c for c in catalog if not c["file"].lower().endswith(".ico") and (not only or c["id"] in only)]
    (OUT / "md").mkdir(parents=True, exist_ok=True)
    idx_path = OUT / "index.json"
    index = {r["id"]: r for r in json.loads(idx_path.read_text(encoding="utf-8"))} if idx_path.exists() else {}
    todo = [c for c in items if force or c["id"] not in index or not (OUT / index[c["id"]]["md"]).exists()]
    print(f"{len(items)} documents, {len(todo)} per convertir", flush=True)
    errors = []
    with ProcessPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(convert, c): c for c in todo}
        for n, f in enumerate(as_completed(futs), 1):
            c = futs[f]
            try:
                r = f.result()
                index[r["id"]] = r
                print(f"[{n}/{len(todo)}] {r['id']} {r['pages']}p {r['method']} {r['title'][:60]}", flush=True)
            except Exception as e:  # un document defectuós no atura la resta
                errors.append({"id": c["id"], "file": c["file"], "error": repr(e)})
                print(f"[{n}/{len(todo)}] ERROR {c['id']} {e!r}", flush=True)
            if n % 20 == 0:
                idx_path.write_text(json.dumps(sorted(index.values(), key=lambda r: r["id"]), ensure_ascii=False, indent=1), encoding="utf-8")
    idx_path.write_text(json.dumps(sorted(index.values(), key=lambda r: r["id"]), ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "errors.json").write_text(json.dumps(errors, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Fet: {len(index)} documents a l'índex, {len(errors)} errors")


if __name__ == "__main__":
    main()
