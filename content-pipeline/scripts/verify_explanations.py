"""Verifica les explicacions i les creua amb la resolució a cegues.

Uso: python -I scripts/verify_explanations.py
Escriu data/explanations/verified.json: una entrada per pregunta amb l'explicació, les fonts
resoltes (etiqueta + URL oficial) i l'estat de verificació:
  - "consistent": la resolució a cegues coincideix amb la plantilla i l'explicació hi està d'acord
  - "disputed":   la resolució a cegues discrepa, o l'explicació qüestiona la resposta oficial
"""
import collections
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
FILES = {"2015_A": "ics-dsi-2015-A", "2016PI": "ics-dsi-2016PI", "2019_A": "ics-dsi-2019-A", "2024_A": "ics-dsi-2024-A"}

bank = {q["id"]: q for q in json.loads((DATA / "official_bank.json").read_text(encoding="utf-8"))}
blind = {}
for part in ("part1", "part2"):
    for b in json.loads((DATA / "blind" / f"{part}.json").read_text(encoding="utf-8")):
        blind[b["id"]] = b

# Fonts normatives: id de fragment -> etiqueta i URL
chunks = {}
for f in (DATA / "sources").glob("*.json"):
    if f.name == "index.json":
        continue
    norm = json.loads(f.read_text(encoding="utf-8"))
    for c in norm["chunks"]:
        chunks[c["id"]] = {"label": f"{norm['short']}, {c['unit']}", "url": norm["url"]}

problems, out = [], []
stats = collections.Counter()
for stem, exam_id in FILES.items():
    items = json.loads((DATA / "explanations" / f"{stem}.json").read_text(encoding="utf-8"))
    ids = [e["id"] for e in items]
    expected = {i for i, q in bank.items() if q["exam_id"] == exam_id and not q["annulled"]}
    foreign = [i for i in ids if i not in expected]
    dupes = [i for i, n in collections.Counter(ids).items() if n > 1]
    missing = expected - set(ids)
    if foreign or dupes or missing:
        problems.append(f"{stem}: foranes={foreign[:5]} duplicades={dupes[:5]} falten={sorted(missing)[:5]}")
    for e in items:
        if e["id"] not in expected:
            continue
        q = bank[e["id"]]
        b = blind.get(e["id"])
        if b is None:
            problems.append(f"{e['id']}: sense resolució a cegues")
            continue
        blind_ok = sorted(b["answer"]) == sorted(q["accepted"])
        sources = []
        for s in e.get("sources", []):
            if s.get("type") == "norma":
                if s["chunk"] not in chunks:
                    problems.append(f"{e['id']}: fragment inexistent {s['chunk']}")
                    continue
                sources.append({"kind": "norma", **chunks[s["chunk"]]})
            elif s.get("label"):
                sources.append({"kind": "ref", "label": s["label"]})
        disputed = (not blind_ok) or (not e.get("agrees_with_official", True))
        status = "disputed" if disputed else "consistent"
        stats[status] += 1
        notes = [n for n in [e.get("doubt")] if n]
        if not blind_ok:
            notes.append(f"Resolució independent: {', '.join(b['answer'])} ({b['reason']})")
        out.append({
            "id": e["id"],
            "summary": e["summary"],
            "options": e["options"],
            "key_point": e.get("key_point"),
            "sources": sources,
            "status": status,
            "notes": notes,
            "confidence": e.get("confidence"),
        })

(DATA / "explanations" / "verified.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"Explicacions verificades: {len(out)} · {dict(stats)}")
for p in problems:
    print("PROBLEMA:", p)
disp = [o for o in out if o["status"] == "disputed"]
print(f"Discutides ({len(disp)}):")
for o in disp:
    print(" ", o["id"], "|", " / ".join(o["notes"])[:220])
sys.exit(1 if problems else 0)
