"""Reassociació de totes les preguntes (oficials, històriques i FUDEN) als epígrafs del temari v2.

Ús:
  python -I scripts/reclass_v2.py batches N   # lots per classificar: data/fuden/reclass/batch_NN.md
  python -I scripts/reclass_v2.py check       # comprova data/fuden/reclass/out/*.json (totes, un cop, epígrafs vàlids)
  python -I scripts/reclass_v2.py apply       # escriu classification/v2.json (oficials i històriques) i el camp
                                              # epigraf de data/fuden/questions/*.json (guarda l'anterior a epigraf_v1)

Els lots i les sortides són a data/fuden/ (privat) perquè inclouen enunciats de FUDEN.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
WORK = DATA / "fuden" / "reclass"
V1 = json.loads((DATA / "temario_v1.json").read_text(encoding="utf-8"))
V2 = json.loads((DATA / "temario.json").read_text(encoding="utf-8"))
v1_titles = {e["id"]: e["titol"] for b in V1["blocs"] for t in b["temes"] for e in t["epigrafs"]}
v2_ids = {e["id"] for b in V2["blocs"] for t in b["temes"] for e in t["epigrafs"]}


def tema_key(ep: str) -> tuple:
    t = ep.split(".")[0]
    return (t[0] != "T", int(t[1:]), int(ep.split(".")[1]) if "." in ep else 0)


def all_questions() -> list[dict]:
    """Totes les preguntes amb el seu epígraf v1 (l'estat d'abans de la reassociació)."""
    out = []
    bank = {q["id"]: q for q in json.loads((DATA / "official_bank.json").read_text(encoding="utf-8"))}
    for c in json.loads((DATA / "classification" / "classification.json").read_text(encoding="utf-8")):
        q = bank[c["id"]]
        out.append({"id": c["id"], "origin": "oficial", "v1": c.get("epigraf_v1", c["epigraf"]), "stem": q["stem"],
                    "options": q["options"], "accepted": q.get("accepted") or [], "case": None})
    for q in json.loads((DATA / "historical" / "questions.json").read_text(encoding="utf-8")):
        out.append({"id": q["id"], "origin": "històrica", "v1": q.get("epigraf_v1", q["epigraf"]), "stem": q["stem"],
                    "options": q["options"], "accepted": q.get("accepted") or [], "case": None})
    for f in sorted((DATA / "fuden" / "questions").glob("*.json")):
        if f.name.startswith("_"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        cases = {c["id"]: c for c in d.get("cases", [])}
        for q in d["questions"]:
            case = cases.get(q.get("case_id") or "")
            out.append({"id": f"fuden-{d['slug']}-{q['n']}", "origin": "FUDEN", "v1": q.get("epigraf_v1", q["epigraf"]),
                        "stem": q["stem"], "options": q["options"], "accepted": q.get("accepted") or [],
                        "case": (case["text"][:400] + "…") if case and case.get("text") else None})
    return out


def batches(n: int):
    WORK.mkdir(parents=True, exist_ok=True)
    qs = sorted(all_questions(), key=lambda q: (tema_key(q["v1"]), q["id"]))
    size = -(-len(qs) // n)
    for i in range(n):
        part = qs[i * size:(i + 1) * size]
        lines = [f"# Lot {i + 1:02d}: {len(part)} preguntes", ""]
        for q in part:
            lines.append(f"### {q['id']} · {q['origin']} · v1 {q['v1']} ({v1_titles.get(q['v1'], '?')})")
            if q["case"]:
                lines.append(f"[Cas] {q['case']}")
            lines.append(q["stem"])
            lines += [f"{k}) {v}" for k, v in q["options"].items()]
            lines += [f"Correcta: {', '.join(q['accepted']) or '—'}", ""]
        (WORK / f"batch_{i + 1:02d}.md").write_text("\n".join(lines), encoding="utf-8")
        print(f"batch_{i + 1:02d}.md: {len(part)} ({part[0]['v1']} … {part[-1]['v1']})")


def results() -> tuple[dict, list[str]]:
    res, errs = {}, []
    for f in sorted((WORK / "out").glob("*.json")):
        for qid, r in json.loads(f.read_text(encoding="utf-8")).items():
            if qid in res:
                errs.append(f"{f.name}: {qid} repetida")
            if r.get("e") not in v2_ids:
                errs.append(f"{f.name}: {qid} epígraf no vàlid {r.get('e')}")
            if r.get("s") and r["s"] not in v2_ids:
                errs.append(f"{f.name}: {qid} secundari no vàlid {r['s']}")
            res[qid] = r
    return res, errs


def check(only: str | None = None):
    res, errs = results()
    qs = all_questions()
    if only:  # només les preguntes d'un lot
        ids = {l[4:].split(" · ")[0] for l in (WORK / f"batch_{int(only):02d}.md").read_text(encoding="utf-8").splitlines() if l.startswith("### ")}
        qs = [q for q in qs if q["id"] in ids]
    missing = [q["id"] for q in qs if q["id"] not in res]
    for e in errs[:40]:
        print("ERROR", e)
    print(f"{len(errs)} errors; {len(missing)} preguntes sense classificar de {len(qs)}" + (f": {missing[:10]}" if missing else ""))


def apply():
    res, errs = results()
    qs = all_questions()
    missing = [q["id"] for q in qs if q["id"] not in res]
    if errs or missing:
        raise SystemExit(f"{len(errs)} errors i {len(missing)} sense classificar: executa check")
    v1 = {q["id"]: q["v1"] for q in qs}
    public = {q["id"]: {"epigraf": res[q["id"]]["e"], "secondary": res[q["id"]].get("s") or None, "epigraf_v1": v1[q["id"]]}
              for q in qs if q["origin"] != "FUDEN"}
    (DATA / "classification" / "v2.json").write_text(json.dumps(
        {"_doc": "Epígrafs del temari v2 (prevalen sobre part*.json, overrides.json i processed_*.json). Generat per scripts/reclass_v2.py.",
         **dict(sorted(public.items()))}, ensure_ascii=False, indent=1), encoding="utf-8")
    n = 0
    for f in sorted((DATA / "fuden" / "questions").glob("*.json")):
        if f.name.startswith("_"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        for q in d["questions"]:
            r = res[f"fuden-{d['slug']}-{q['n']}"]
            q.setdefault("epigraf_v1", q["epigraf"])
            q["epigraf"], q["secondary"] = r["e"], r.get("s") or None
            n += 1
        f.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(public)} oficials/històriques a classification/v2.json; {n} preguntes FUDEN actualitzades")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "batches":
        batches(int(sys.argv[2]))
    elif cmd == "check":
        check(sys.argv[2] if len(sys.argv) > 2 else None)
    else:
        apply()
