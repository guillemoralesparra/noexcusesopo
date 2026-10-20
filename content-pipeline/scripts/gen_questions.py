"""Preguntes pròpies per als epígrafs amb poques preguntes (temari v2), amb verificació en dos passos.

Ús:
  python -I scripts/gen_questions.py targets        # quantes en falten per epígraf i preguntes existents (context)
  python -I scripts/gen_questions.py check [lot]    # format i que l'evidència citada sigui literal al temari
  python -I scripts/gen_questions.py blind          # lots sense resposta per a la resolució a cegues
  python -I scripts/gen_questions.py merge          # desa a data/generated/questions.json les que superen tot

Treball a data/fuden/generated/ (fora del repositori perquè conté fragments del material); el resultat
final (preguntes, explicació i font) és a data/generated/questions.json. No usa cap model.
"""
import collections
import json
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
WORK = DATA / "fuden" / "generated"
GUIA = DATA / "fuden" / "temari" / "guia"
TARGET = 10  # preguntes per epígraf com a mínim
sys.path.insert(0, str(ROOT / "scripts"))


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).lower()
    s = re.sub(r"[*_`|#>]+", " ", s)
    s = re.sub(r"[’‘´`]", "'", s)
    s = re.sub(r"[“”«»]", '"', s)
    return re.sub(r"\s+", " ", s).strip()


def epigraf_text(ep: str) -> str:
    f = next(GUIA.glob(f"*/{ep}.md"), None)
    return norm(f.read_text(encoding="utf-8")) if f else ""


def targets():
    import reclass_v2 as r
    res, _ = r.results()
    count = collections.Counter(v["e"] for v in res.values())
    qs = r.all_questions()
    eps = [(e["id"], e["titol"]) for b in r.V2["blocs"] for t in b["temes"] for e in t["epigrafs"]]
    out = []
    (WORK / "existing").mkdir(parents=True, exist_ok=True)
    for ep, title in eps:
        need = TARGET - count[ep]
        if need <= 0:
            continue
        out.append({"epigraf": ep, "titol": title, "need": need, "have": count[ep]})
        lines = [f"# Preguntes que ja hi ha a {ep} {title} (no les repeteixis)", ""]
        lines += [f"- {q['stem']}" for q in qs if res[q["id"]]["e"] == ep]
        (WORK / "existing" / f"{ep}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (WORK / "targets.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(out)} epígrafs, {sum(t['need'] for t in out)} preguntes a fer")


def load_batches(pattern="batch_*.json"):
    items = []
    for f in sorted(WORK.glob(pattern)):
        for q in json.loads(f.read_text(encoding="utf-8")):
            items.append((f.name, q))
    return items


def problems(q: dict) -> list[str]:
    p = []
    for k in ("id", "epigraf", "stem", "options", "answer", "explanation", "evidence", "source"):
        if not q.get(k):
            p.append(f"falta {k}")
    if p:
        return p
    if sorted(q["options"]) != ["a", "b", "c", "d"]:
        p.append("cal exactament les opcions a-d")
    if q["answer"] not in q["options"]:
        p.append("resposta no vàlida")
    ex = q["explanation"]
    if not ex.get("summary") or sorted((ex.get("options") or {})) != ["a", "b", "c", "d"]:
        p.append("explicació incompleta (summary i una línia per opció)")
    text = epigraf_text(q["epigraf"])
    if not text:
        p.append("epígraf desconegut")
    elif norm(q["evidence"]) not in text:
        p.append("l'evidència no surt literal al temari de l'epígraf")
    if len(set(norm(v) for v in q["options"].values())) < 4:
        p.append("opcions repetides")
    return p


def check(only: str | None = None):
    pattern = f"batch_{int(only):02d}.json" if only else "batch_*.json"
    items = load_batches(pattern)
    ids = collections.Counter(q.get("id") for _, q in load_batches())
    bad = 0
    for f, q in items:
        p = problems(q) + (["id repetit"] if ids[q.get("id")] > 1 else [])
        if p:
            bad += 1
            print(f"{f} {q.get('id')}: {'; '.join(p)}")
    print(f"{len(items)} preguntes, {bad} amb problemes")


def blind():
    items = [q for _, q in load_batches() if not problems(q)]
    n = 3
    size = -(-len(items) // n)
    for i in range(n):
        part = items[i * size:(i + 1) * size]
        lines = [f"# Resolució a cegues, lot {i + 1}: {len(part)} preguntes", ""]
        for q in part:
            lines += [f"### {q['id']} · {q['epigraf']}", q["stem"]] + [f"{k}) {v}" for k, v in sorted(q["options"].items())] + [""]
        (WORK / f"blind_{i + 1}.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"{len(items)} preguntes vàlides en {n} lots per resoldre a cegues")


def merge():
    blind_ans = {}
    for f in WORK.glob("blind_out_*.json"):
        blind_ans.update(json.loads(f.read_text(encoding="utf-8")))
    ok, rejected = [], []
    for _, q in load_batches():
        why = problems(q)
        b = blind_ans.get(q["id"])
        if not why and (not b or b.get("answer") != q["answer"]):
            why = [f"la resolució a cegues diu {b.get('answer') if b else '—'}" + (f" ({b.get('why')})" if b and b.get("why") else "")]
        if why:
            rejected.append({"id": q["id"], "epigraf": q["epigraf"], "why": why})
            continue
        ok.append({k: q[k] for k in ("id", "epigraf", "stem", "options", "answer", "explanation", "source")})
    out = DATA / "generated"
    out.mkdir(exist_ok=True)
    (out / "questions.json").write_text(json.dumps(ok, ensure_ascii=False, indent=1), encoding="utf-8")
    (WORK / "rejected.json").write_text(json.dumps(rejected, ensure_ascii=False, indent=1), encoding="utf-8")
    per = collections.Counter(q["epigraf"] for q in ok)
    print(f"{len(ok)} preguntes verificades a data/generated/questions.json; {len(rejected)} descartades")
    print(dict(sorted(per.items())))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "check":
        check(sys.argv[2] if len(sys.argv) > 2 else None)
    else:
        {"targets": targets, "blind": blind, "merge": merge}[cmd]()
