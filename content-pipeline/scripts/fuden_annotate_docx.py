"""Exporta els .docx de preguntes amb el format visible, per detectar la resposta marcada.

Cada paràgraf surt en una línia amb etiquetes:
  [IND]  sagnat inicial (espais al començament o sagnat de paràgraf)
  [B] negreta · [U] subratllat · [HL] ressaltat · [SH] ombrejat · [COL] color no negre · [LIST] element de llista
Ús: python -I scripts/fuden_annotate_docx.py   → data/fuden/annotated/<id>.txt
"""
import json
import pathlib
import re
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "raw" / "fuden"
OUT = ROOT / "data" / "fuden" / "annotated"

MARKS = [
    ("B", r"<w:b/>|<w:b w:val=\"(?:1|true)\""),
    ("U", r"<w:u w:val=\"(?!none)"),
    ("HL", r"<w:highlight "),
    ("SH", r"<w:shd [^>]*w:fill=\"(?!auto|FFFFFF)"),
    ("COL", r"<w:color w:val=\"(?!000000|auto)"),
]


def annotate(xml: str) -> str:
    lines = []
    for p in re.findall(r"<w:p[ >].*?</w:p>", xml, re.S):
        ppr = (re.search(r"<w:pPr>(.*?)</w:pPr>", p, re.S) or [None, ""])[1]
        runs = re.findall(r"<w:r[ >](.*?)</w:r>", p, re.S)
        text, tags = "", set()
        for r in runs:
            t = "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", r, re.S))
            if t.strip():
                for k, pat in MARKS:
                    if re.search(pat, r):
                        tags.add(k)
            text += t
        if not text.strip():
            continue
        for k, pat in MARKS:
            if re.search(pat, ppr):
                tags.add(k)
        if "<w:numPr>" in ppr:
            tags.add("LIST")
        if re.match(r"\s{3,}", text) or re.search(r'<w:ind w:(?:left|firstLine)="(?:[3-9]\d{2}|\d{4,})"', ppr):
            tags.add("IND")
        lines.append(("[" + ",".join(sorted(tags)) + "] " if tags else "") + re.sub(r"\s+", " ", text).strip())
    return "\n".join(lines)


def main():
    catalog = json.loads((ROOT / "data" / "fuden" / "catalog.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for e in catalog:
        p = RAW / e["file"]
        if p.exists() and p.read_bytes()[:2] == b"PK" and "word/document.xml" in zipfile.ZipFile(p).namelist():
            xml = zipfile.ZipFile(p).read("word/document.xml").decode("utf-8", "replace")
            (OUT / f"{e['id']}.txt").write_text(annotate(xml), encoding="utf-8")
            n += 1
    print(f"docx anotats: {n}")


if __name__ == "__main__":
    main()
