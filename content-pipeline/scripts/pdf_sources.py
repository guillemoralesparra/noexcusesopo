"""Passa documents oficials en PDF (protocols, acords publicats al DOGC) al format de data/sources/.

Ús: python -I scripts/pdf_sources.py
Llegeix els PDF de raw/normativa/ llistats a DOCS i escriu data/sources/<slug>.json amb un tros per apartat
(títols detectats per la mida de lletra) o, si el document no en té, un tros per pàgina. No usa cap model.
"""
import json
import pathlib
import re
import sys
from datetime import date

import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "raw" / "normativa"
OUT = ROOT / "data" / "sources"

DOCS = [
    {
        "slug": "protocol-assetjament-gencat",
        "pdf": "protocol-assetjament-2015.pdf",
        "title": "Protocol per a la prevenció, la detecció, l'actuació i la resolució de situacions d'assetjament sexual, per raó del sexe, de l'orientació sexual i/o de la identitat sexual a l'Administració de la Generalitat de Catalunya",
        "short": "Protocol d'assetjament (Generalitat)",
        "url": "https://documents.espai.educacio.gencat.cat/IPCServeisPersonal/PrevencioRiscosLaborals/Protocol-assetjament-sexual.pdf",
        "jurisdiction": "catalunya",
        "temario": ["T7.4"],
        "source_note": "Direcció General de Funció Pública (Acord de Govern de 4/8/2015). És el text que cita el temari oficial (annex 3, tema 7).",
        "heading_size": 11.0,
        "skip": [r"^Direcció General de Funció Pública$"],
    },
    {
        "slug": "iii-acord-ics",
        "pdf": "iii-acord-ics-2024-ca.pdf",
        "title": "Resolució EMT/74/2024, de 12 de gener, per la qual es disposa la inscripció i la publicació de l'Acord de la Mesa Sectorial de Negociació de Sanitat, de 22 de novembre de 2023, de millora de les condicions de treball, aplicació temporal i redacció definitiva del III Acord de condicions de treball del personal estatutari de l'Institut Català de la Salut (ICS)",
        "short": "III Acord ICS (Resolució EMT/74/2024)",
        "url": "https://portaldogc.gencat.cat/utilsEADOP/PDF/9085/2009512.pdf",
        "jurisdiction": "catalunya",
        "temario": ["T5.3"],
        "source_note": "DOGC núm. 9085, de 23/01/2024 (CVE-DOGC-B-24016056-2024).",
        "heading_size": None,  # sense títols marcats: un tros per pàgina
        "skip": [r"^Diari Oficial de la Generalitat de Catalunya", r"^ISSN ", r"^CVE-DOGC", r"^https?://", r"^Núm\. 9085", r"^\d+/\d+$"],
    },
]


def lines(page):
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            spans = [s for s in l["spans"] if s["text"].strip()]
            if spans:
                yield "".join(s["text"] for s in l["spans"]).strip(), max(s["size"] for s in spans)


def convert(doc: dict) -> dict:
    pdf = pymupdf.open(RAW / doc["pdf"])
    skip = [re.compile(p) for p in doc["skip"]]
    chunks: list[dict] = []
    cur = None
    for n, page in enumerate(pdf, 1):
        if doc["heading_size"] is None:
            cur = {"unit": f"Pàgina {n}", "heading": "", "lines": []}
            chunks.append(cur)
        for text, size in lines(page):
            if any(p.search(text) for p in skip):
                continue
            if doc["heading_size"] and size >= doc["heading_size"] and re.match(r"^(\d+(\.\d+)?\.?|Annex \d+)\s", text):
                cur = {"unit": text.split()[0].rstrip("."), "heading": text, "lines": []}
                chunks.append(cur)
                continue
            if cur is None:
                cur = {"unit": "Presentació", "heading": "", "lines": []}
                chunks.append(cur)
            cur["lines"].append(text)
    out = []
    for i, c in enumerate(chunks):
        text = re.sub(r"(?<=[a-zà-ú,;])\n(?=[a-zà-ú])", " ", "\n".join(c["lines"])).strip()
        if text:
            cid = re.sub(r"[^a-z0-9]+", "-", c["unit"].lower()).strip("-") or str(i)
            out.append({"id": f"{doc['slug']}#{cid}-{i}", "unit": c["unit"], "heading": c["heading"], "path": "", "text": text})
    return {"slug": doc["slug"], "title": doc["title"], "short": doc["short"], "jurisdiction": doc["jurisdiction"],
            "language": "ca", "url": doc["url"], "consolidated_as_of": None, "fetched": date.today().isoformat(),
            "temario": doc["temario"], "source_note": doc["source_note"], "chunks": out}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    for doc in DOCS:
        data = convert(doc)
        (OUT / f"{doc['slug']}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{doc['slug']}: {len(data['chunks'])} trossos")


if __name__ == "__main__":
    main()
