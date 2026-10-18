"""Control d'originalitat: cap fitxa pot reproduir text del material de referència privat.

Busca seqüències de N paraules seguides (per defecte 8) de cada fitxa que apareguin a algun
text de data/fuden/text. Les frases de normativa (que és pública) es permeten.

Ús: python -I scripts/check_originality.py [N]
"""
import json
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
N = int(sys.argv[1]) if len(sys.argv) > 1 else 8


def words(s: str) -> list[str]:
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.findall(r"[a-z0-9]+", s)


def grams(ws: list[str]) -> set[str]:
    return {" ".join(ws[i : i + N]) for i in range(len(ws) - N + 1)}


# Només el material redactat per l'acadèmia (temari, presentacions, tests); les guies clíniques,
# codis i normativa oficials que hi ha com a annex són documents públics.
cov = json.loads((ROOT / "data" / "fuden" / "coverage.json").read_text(encoding="utf-8"))
own = {d["id"] for d in cov["documents"] if d.get("kind") in ("temari", "presentacio", "test", "simulacre")}
ref = set()
for f in (ROOT / "data" / "fuden" / "text").glob("*.txt"):
    if int(f.stem) in own:
        ref |= grams(words(f.read_text(encoding="utf-8", errors="replace")))
# La normativa oficial és pública: no compta com a còpia
public = set()
for f in (ROOT / "data" / "sources").glob("*.json"):
    if f.name != "index.json":
        for c in json.loads(f.read_text(encoding="utf-8"))["chunks"]:
            public |= grams(words(c["text"]))

FAIL_LEN = 15  # tram continu de 15+ paraules idèntiques = còpia; més curts (títols, noms de lleis) = informatiu
fails, info = [], 0
notes = sorted((ROOT / "data" / "notes").glob("*.json"))
for f in notes:
    note = json.loads(f.read_text(encoding="utf-8"))
    w = words(note["body_md"] + " " + " ".join(note.get("key_points", [])))
    hits = [i for i in range(len(w) - N + 1) if " ".join(w[i : i + N]) in ref and " ".join(w[i : i + N]) not in public]
    spans = []
    for i in hits:
        if spans and i <= spans[-1][1] + 1:
            spans[-1][1] = i
        else:
            spans.append([i, i])
    long = [" ".join(w[a : b + N]) for a, b in spans if b + N - a >= FAIL_LEN]
    info += len(spans) - len(long)
    if long:
        fails.append((f.stem, long))
print(f"Fitxes revisades: {len(notes)} · trams curts coincidents (títols, noms): {info} · fitxes amb còpia ({FAIL_LEN}+ paraules): {len(fails)}")
for ep, long in fails:
    for t in long:
        print(f"  {ep}: {t[:160]}")
sys.exit(1 if fails else 0)
