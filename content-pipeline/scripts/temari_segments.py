"""Trosseja el material de FUDEN en Markdown en segments (per títols o per pàgines) per construir el temari.

Ús: python -I scripts/temari_segments.py
Llegeix data/fuden/web/index.json i md/*.md i escriu data/fuden/temari/segments.json:
un segment per títol (o per pàgina a les presentacions sense títols), amb les pàgines que ocupa,
els caràcters i si és un duplicat literal d'una pàgina d'un altre document de més prioritat.
No usa cap model. Tot data/fuden/ és privat (.gitignore).
"""
import json
import pathlib
import re
import sys
import unicodedata
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "data" / "fuden" / "web"
OUT = ROOT / "data" / "fuden" / "temari"

# Ordre de prioritat: el temari mana; el material de suport i les presentacions només aporten el que no hi és
SECTIONS = {
    "TEMARIO TRANSVERSAL - TODAS LAS CATEGORÍAS": "temari",
    "ESPECÍFICO PARA DIPLOMADO/A SANITARIO/A EN ENFERMERÍA": "temari",
    "Material de apoyo para el estudio": "suport",
    "Presentacions sessions presencials": "presentacio",
}
EXCLUDE = {0, 338, *range(78, 85)}  # calendari del curs, test del temari transversal i preguntes de WhatsApp (són preguntes, no temari)
PAGE = re.compile(r"^<!-- pàg\. (\d+) -->$", re.M)
HEAD = re.compile(r"^(#{1,4}) +(.+?)\s*$")


def shingles(s: str) -> set[int]:
    """Grups de 3 paraules (sense imatges, fragments de marca d'aigua en cursiva ni accents)."""
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)|_[^_\n|]{1,40}_", " ", s)
    s = unicodedata.normalize("NFD", s.lower())
    words = [w for w in re.findall(r"[a-z]{3,}", "".join(c for c in s if not unicodedata.combining(c)))]
    return {hash(" ".join(words[i:i + 3])) for i in range(len(words) - 2)}


def pages_of(md: str) -> list[tuple[int, str]]:
    body = md.split("\n---\n", 1)[1] if md.startswith("---") else md
    parts = PAGE.split(body)
    return [(int(parts[i]), parts[i + 1]) for i in range(1, len(parts) - 1, 2)]


def heading_text(s: str) -> str:
    return re.sub(r"[*_`]+", "", s).strip()


def segment(doc: dict, pages: list[tuple[int, str]]) -> list[dict]:
    heads = sum(1 for _, t in pages for line in t.splitlines() if HEAD.match(line))
    by_page = heads < max(3, len(pages) // 8)
    segs: list[dict] = []
    cur = None
    for n, text in pages:
        if by_page:
            first = next((heading_text(l) for l in text.splitlines() if l.strip() and not l.startswith("![")), "")
            segs.append({"level": 0, "title": first[:120], "pages": [n, n], "text": text})
            continue
        # Apartats llargs sense subtítols: es continuen en un segment nou a cada pàgina per poder-los repartir
        if cur is not None and cur["pages"][0] < n and len(cur["text"]) > 3000:
            cur = {"level": cur["level"], "title": cur["title"].removesuffix(" (cont.)") + " (cont.)", "pages": [n, n], "text": ""}
            segs.append(cur)
        for line in text.splitlines(keepends=True):
            m = HEAD.match(line)
            if m and heading_text(m.group(2)):
                cur = {"level": len(m.group(1)), "title": heading_text(m.group(2))[:160], "pages": [n, n], "text": ""}
                segs.append(cur)
            if cur is None:
                cur = {"level": 0, "title": "(inici)", "pages": [n, n], "text": ""}
                segs.append(cur)
            cur["text"] += line
            cur["pages"][1] = n
        if cur is not None:
            cur["pages"][1] = n
    return segs


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    OUT.mkdir(parents=True, exist_ok=True)
    index = json.loads((WEB / "index.json").read_text(encoding="utf-8"))
    prio = {"temari": 0, "suport": 1, "presentacio": 2}
    docs = [d for d in index if d["section"] in SECTIONS and d["id"] not in EXCLUDE]
    docs.sort(key=lambda d: (prio[SECTIONS[d["section"]]], d["id"]))
    prior: dict[int, dict[int, set[int]]] = {}
    seen: dict[int, list[str]] = {}  # shingle -> pàgines ("doc:pàg") de més prioritat on surt
    out = []
    for d in docs:
        md = (WEB / d["md"]).read_text(encoding="utf-8")
        pages = pages_of(md)
        dup_pages = {}
        new: dict[int, list[str]] = {}
        substantive = 0
        page_sh = {n: shingles(t) for n, t in pages}
        # Mateix PDF penjat dues vegades: comparació pàgina a pàgina amb els documents anteriors de la mateixa mida
        twin = None
        for other, osh in prior.items():
            if len(osh) == len(page_sh) and len(page_sh) > 1:
                same = sum(1 for n, sh in page_sh.items() if sh and len(sh & osh.get(n, set())) >= 0.8 * len(sh))
                if same >= 0.85 * sum(1 for sh in page_sh.values() if sh):
                    twin = other
                    break
        prior[d["id"]] = page_sh
        for n, t in pages:
            sh = page_sh[n]
            if len(sh) >= 15:
                substantive += 1
            if twin is not None and sh:
                dup_pages[n] = f"{twin}:{n}"
                continue
            if len(sh) >= 15:
                # Duplicat si el 80 % dels seus grups de paraules ja surten en una mateixa pàgina anterior
                votes = Counter(p for h in sh for p in seen.get(h, ())[:20])
                best = votes.most_common(1)
                if best and best[0][1] >= 0.8 * len(sh):
                    dup_pages[n] = best[0][0]
            for h in sh:
                new.setdefault(h, []).append(f"{d['id']}:{n}")
        for h, ps in new.items():
            seen.setdefault(h, []).extend(ps)
        segs = segment(d, pages)
        for i, s in enumerate(segs):
            pr = range(s["pages"][0], s["pages"][1] + 1)
            dups = [dup_pages[p] for p in pr if p in dup_pages]
            s["id"] = f"{d['id']}.{i}"
            s["chars"] = len(s.pop("text"))
            s["dup_of"] = dups[0] if dups and len(dups) == len(pr) else None
        # Document sencer repetit (p. ex. el mateix PDF penjat a les presentacions i al material de suport)
        src = Counter(v.split(":")[0] for v in dup_pages.values()).most_common(1)
        dup_doc = int(src[0][0]) if substantive and len(dup_pages) >= 0.85 * substantive else None
        out.append({"doc": d["id"], "title": d["title"], "kind": SECTIONS[d["section"]], "md": d["md"],
                    "pages": d["pages"], "dup_pages": len(dup_pages), "substantive_pages": substantive,
                    "dup_doc": dup_doc, "segments": segs})
    (OUT / "segments.json").write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
    n = sum(len(d["segments"]) for d in out)
    dup = sum(1 for d in out for s in d["segments"] if s["dup_of"])
    print(f"{len(out)} documents, {n} segments ({dup} duplicats literals)")
    for d in out:
        if d["dup_pages"] > d["substantive_pages"] * 0.5:
            whole = f" -> còpia del doc {d['dup_doc']}" if d["dup_doc"] is not None else ""
            print(f"  doc {d['doc']} ({d['title'][:50]}): {d['dup_pages']}/{d['substantive_pages']} pàgines duplicades{whole}")


if __name__ == "__main__":
    main()
