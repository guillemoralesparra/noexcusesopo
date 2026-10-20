"""Uneix les preguntes històriques amb la seva classificació i explicació (format de l'app).

Ús: python -I scripts/merge_historical.py → data/historical/questions.json
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
H = ROOT / "data" / "historical"

chunks = {}
for f in sorted(H.glob("processed_*.json")):
    for p in json.loads(f.read_text(encoding="utf-8")):
        chunks[p["id"]] = p

sources = {}
for f in (ROOT / "data" / "sources").glob("*.json"):
    if f.name == "index.json":
        continue
    norm = json.loads(f.read_text(encoding="utf-8"))
    for c in norm["chunks"]:
        sources[c["id"]] = {"kind": "norma", "label": f"{norm['short']}, {c['unit']}", "url": norm["url"]}

valid_eps = {e["id"] for b in json.loads((ROOT / "data" / "temario.json").read_text(encoding="utf-8"))["blocs"] for t in b["temes"] for e in t["epigrafs"]}
# Epígrafs del temari v2 (scripts/reclass_v2.py): prevalen sobre la classificació original
v2_path = ROOT / "data" / "classification" / "v2.json"
v2 = json.loads(v2_path.read_text(encoding="utf-8")) if v2_path.exists() else {}
out, missing, bad_ep = [], 0, 0
for q in json.loads((H / "candidates.json").read_text(encoding="utf-8")):
    p = chunks.get(q["id"])
    if not p:
        missing += 1
        continue
    if q["id"] in v2:
        p = {**p, "epigraf_v1": p["epigraf"], "epigraf": v2[q["id"]]["epigraf"], "secondary": v2[q["id"]]["secondary"]}
    # Correcció de prefixos equivocats (p. ex. E10.2 → T10.2)
    if p["epigraf"] not in valid_eps and ("T" + p["epigraf"][1:]) in valid_eps:
        p["epigraf"] = "T" + p["epigraf"][1:]
    if p["epigraf"] not in valid_eps:
        bad_ep += 1
        continue
    srcs = []
    for s in p.get("sources", []):
        if s.get("type") == "norma" and s.get("chunk") in sources:
            srcs.append(sources[s["chunk"]])
        elif s.get("type") == "ref" and s.get("label"):
            srcs.append({"kind": "ref", "label": s["label"]})
    disputed = (not p.get("blind_agrees", True)) or (not p.get("agrees_with_official", True))
    notes = [n for n in [p.get("doubt")] if n]
    if not p.get("blind_agrees", True) and not notes:
        notes.append("La resolució independent de la plataforma no coincideix amb la plantilla oficial.")
    out.append({
        **{k: q[k] for k in ("id", "exam_id", "n", "section", "case_id", "stem", "options", "accepted", "source_label")},
        "annulled": False,
        "epigraf": p["epigraf"],
        **({"epigraf_v1": p["epigraf_v1"]} if "epigraf_v1" in p else {}),
        "secondary": p.get("secondary") if p.get("secondary") in valid_eps else None,
        "concept": p.get("concept"),
        "currency": p.get("currency", "check"),
        "currency_reason": p.get("currency_reason"),
        "explanation": {
            "summary": p["summary"],
            "options": p["options"],
            "keyPoint": p.get("key_point"),
            "sources": srcs,
            "status": "disputed" if disputed else "consistent",
            "notes": notes,
        },
    })
(H / "questions.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
disp = sum(1 for o in out if o["explanation"]["status"] == "disputed")
chk = sum(1 for o in out if o["currency"] == "check")
print(f"Històriques llestes: {len(out)} · pendents: {missing} · epígraf invàlid: {bad_ep} · discutibles: {disp} · possiblement desactualitzades: {chk}")
