"""Passa les fitxes pròpies (data/notes/*.json) dels epígrafs v1 als del temari v2.

Ús: python -I scripts/notes_v2.py
Les fitxes que van al mateix epígraf v2 es fusionen (cada una amb el seu títol v1 com a apartat).
Les fitxes v1 originals es conserven a data/notes_v1/.
"""
import json
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
NOTES, OLD = DATA / "notes", DATA / "notes_v1"

# Epígraf v1 -> epígraf v2 on la fitxa encaixa millor
MAP = {
    "T1.1": "T1.1", "T1.2": "T1.2", "T1.3": "T1.3", "T2.1": "T2.1", "T2.2": "T2.2", "T2.3": "T2.3",
    "T3.1": "T3.2", "T3.2": "T3.3", "T3.3": "T3.2", "T3.4": "T3.1", "T3.5": "T3.4",
    "T4.1": "T4.1", "T4.2": "T4.2", "T4.3": "T4.3", "T4.4": "T4.4", "T4.5": "T4.5",
    "T5.1": "T5.1", "T5.2": "T5.2", "T5.3": "T5.3", "T6.1": "T6.1", "T6.2": "T6.2",
    "T7.1": "T7.1", "T7.2": "T7.2", "T7.3": "T7.3", "T7.4": "T7.4", "T8.1": "T8.1", "T8.2": "T8.2", "T8.3": "T8.3",
    "T9.1": "T9.1", "T9.2": "T9.2", "T9.3": "T9.1", "T10.1": "T10.1", "T10.2": "T10.2", "T11.1": "T11.1", "T11.2": "T11.3",
    "E1.1": "E1.1", "E1.2": "E1.4", "E1.3": "E1.5", "E1.4": "E1.6", "E1.5": "E1.7", "E1.6": "E1.8", "E1.7": "E1.9",
    "E1.8": "E1.10", "E1.9": "E1.12", "E1.10": "E1.13", "E1.11": "E1.13", "E1.12": "E1.14",
    "E2.1": "E2.1", "E2.2": "E2.3", "E2.3": "E2.4", "E2.4": "E2.5", "E2.5": "E2.6", "E2.6": "E2.7", "E2.7": "E2.8",
    "E2.8": "E2.9", "E2.9": "E2.11", "E2.10": "E2.12", "E2.11": "E2.13", "E2.12": "E2.14", "E2.13": "E2.1", "E2.14": "E2.15",
    "E3.1": "E3.1", "E3.2": "E3.5", "E3.3": "E3.6", "E3.4": "E3.8", "E3.5": "E3.12", "E3.6": "E3.15", "E3.7": "E3.18", "E3.8": "E3.3",
    "E4.1": "E4.1", "E4.2": "E4.3", "E4.3": "E4.4", "E4.4": "E4.6", "E4.5": "E4.9", "E4.6": "E4.11", "E4.7": "E4.12",
    "E4.8": "E4.13", "E4.9": "E4.2",
    "E5.1": "E5.3", "E5.2": "E5.6", "E5.3": "E5.9", "E5.4": "E5.11", "E5.5": "E5.13", "E5.6": "E5.15", "E5.7": "E5.17", "E5.8": "E5.1",
    "E6.1": "E6.1", "E6.2": "E6.2", "E6.3": "E6.3", "E6.4": "E6.6", "E6.5": "E6.7", "E6.6": "E6.6", "E6.7": "E6.8",
    "E6.8": "E6.10", "E6.9": "E6.12", "E6.10": "E6.9", "E6.11": "E6.11",
    "E7.1": "E7.2", "E7.2": "E7.3", "E7.3": "E7.4", "E7.4": "E7.6", "E7.5": "E7.6", "E7.6": "E7.7", "E7.7": "E7.8",
    "E7.8": "E7.10", "E7.9": "E7.11",
    "E8.1": "E8.1", "E8.2": "E8.2", "E8.3": "E8.3", "E8.4": "E8.4",
}


def main():
    v1 = json.loads((DATA / "temario_v1.json").read_text(encoding="utf-8"))
    v2 = json.loads((DATA / "temario.json").read_text(encoding="utf-8"))
    t1 = {e["id"]: e["titol"] for b in v1["blocs"] for t in b["temes"] for e in t["epigrafs"]}
    v2ids = {e["id"] for b in v2["blocs"] for t in b["temes"] for e in t["epigrafs"]}
    assert set(MAP) == set(t1), set(t1) ^ set(MAP)
    assert set(MAP.values()) <= v2ids, set(MAP.values()) - v2ids
    if not OLD.exists():  # primera execució: es guarden les fitxes v1
        shutil.copytree(NOTES, OLD)
    groups: dict[str, list[dict]] = {}
    for f in sorted(OLD.glob("*.json"), key=lambda f: [int(x) if x.isdigit() else x for x in f.stem.replace(".", " ").split()]):
        n = json.loads(f.read_text(encoding="utf-8"))
        groups.setdefault(MAP[n["epigraf"]], []).append(n)
    for f in NOTES.glob("*.json"):
        f.unlink()
    for ep, ns in groups.items():
        if len(ns) == 1:
            body = ns[0]["body_md"]
        else:  # diverses fitxes v1 al mateix epígraf: cadascuna com a apartat
            body = "\n\n".join(f"## {t1[n['epigraf']]}\n\n" + re.sub(r"^## ", "### ", n["body_md"], flags=re.M) for n in ns)
        merged = {"epigraf": ep, "epigraf_v1": [n["epigraf"] for n in ns], "body_md": body,
                  "key_points": [k for n in ns for k in n.get("key_points", [])],
                  "sources": list({s["label"]: s for n in ns for s in n.get("sources", [])}.values()),
                  "review_flags": [r for n in ns for r in n.get("review_flags", [])]}
        (NOTES / f"{ep}.json").write_text(json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"{sum(len(v) for v in groups.values())} fitxes v1 -> {len(groups)} fitxes v2; epígrafs v2 sense fitxa: {len(v2ids - set(groups))}")


if __name__ == "__main__":
    main()
