"""Mapa de frecuencias: cuántas preguntas oficiales ha tenido cada tema y epígrafe.

Uso: python -I scripts/frequency_map.py
Lee data/temario.json, data/official_bank.json y data/classification/*.json.
Escribe data/frequency_map.json y data/frequency_map.md.
"""
import collections
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

temario = json.loads((DATA / "temario.json").read_text(encoding="utf-8"))
bank = {q["id"]: q for q in json.loads((DATA / "official_bank.json").read_text(encoding="utf-8"))}
cls = []
for f in sorted((DATA / "classification").glob("part*.json")):
    cls += json.loads(f.read_text(encoding="utf-8"))
overrides = json.loads((DATA / "classification" / "overrides.json").read_text(encoding="utf-8"))
for c in cls:
    if c["id"] in overrides:
        c["secondary"], c["epigraf"] = c["epigraf"], overrides[c["id"]]
(DATA / "classification" / "classification.json").write_text(
    json.dumps(sorted(cls, key=lambda c: c["id"]), ensure_ascii=False, indent=1), encoding="utf-8")
missing = set(bank) - {c["id"] for c in cls}
assert not missing, f"preguntas sin clasificar: {sorted(missing)[:10]}"

exams = sorted({q["exam_id"] for q in bank.values()})
per_ep = collections.defaultdict(lambda: collections.Counter())
for c in cls:
    per_ep[c["epigraf"]][bank[c["id"]]["exam_id"]] += 1

rows, md = [], ["# Mapa de frecuencias (exámenes oficiales ICS Infermeria)", "",
                f"Exámenes: {', '.join(exams)} · {len(cls)} preguntas", "",
                "| Epígraf | Títol | " + " | ".join(e.replace('ics-dsi-', '') for e in exams) + " | Total | % |",
                "|---|---|" + "---|" * (len(exams) + 2)]
total = len(cls)
for bloc in temario["blocs"]:
    for tema in bloc["temes"]:
        t_count = sum(sum(per_ep[e["id"]].values()) for e in tema["epigrafs"])
        md.append(f"| **{tema['id']}** | **{tema['titol']}** | " + " | ".join(
            str(sum(per_ep[e["id"]][x] for e in tema["epigrafs"])) for x in exams)
            + f" | **{t_count}** | **{100 * t_count / total:.1f}** |")
        for ep in tema["epigrafs"]:
            n = sum(per_ep[ep["id"]].values())
            rows.append({"epigraf": ep["id"], "tema": tema["id"], "titol": ep["titol"],
                         "per_exam": dict(per_ep[ep["id"]]), "total": n, "share": n / total})
            md.append(f"| {ep['id']} | {ep['titol']} | " + " | ".join(
                str(per_ep[ep["id"]][x]) for x in exams) + f" | {n} | {100 * n / total:.1f} |")

(DATA / "frequency_map.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
(DATA / "frequency_map.md").write_text("\n".join(md) + "\n", encoding="utf-8")
top = sorted(rows, key=lambda r: -r["total"])[:15]
print("Top 15 epígrafs:")
for r in top:
    print(f"  {r['epigraf']:6} {r['total']:3}  {r['titol']}")
print("Sense cap pregunta:", [r["epigraf"] for r in rows if r["total"] == 0])
