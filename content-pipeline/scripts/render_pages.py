"""Renderiza cada página de los PDF de exámenes a PNG para transcripción.

Uso: python -I scripts/render_pages.py raw/exams pages [dpi]
"""
import pathlib
import sys

import pymupdf

src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 150

for pdf in sorted(src.glob("*.pdf")):
    doc = pymupdf.open(pdf)
    target = out / pdf.stem
    target.mkdir(parents=True, exist_ok=True)
    text_chars = sum(len(p.get_text().strip()) for p in doc)
    for i, page in enumerate(doc):
        page.get_pixmap(dpi=dpi).save(target / f"p{i + 1:02d}.png")
    print(f"{pdf.stem}: {doc.page_count} pág., capa de texto={text_chars} chars")
