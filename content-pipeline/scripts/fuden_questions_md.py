"""Passa les preguntes de FUDEN ja extretes (data/fuden/questions/*.json) a Markdown amb la solució.

Ús: python -I scripts/fuden_questions_md.py
Escriu data/fuden/web/preguntes/<slug>.md i data/fuden/web/preguntes/index.json. No usa cap model.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "fuden" / "questions"
OUT = ROOT / "data" / "fuden" / "web" / "preguntes"


def render(d: dict) -> str:
    out = [f"# {d.get('title') or d.get('label') or d['slug']}", ""]
    out.append(f"Tipus: {d.get('kind', '')} · Data: {d.get('date') or '—'} · Document font: {d.get('source_doc')} · Solucionari: {d.get('key_doc')}")
    cases = {c["id"]: c for c in d.get("cases", [])}
    shown = set()
    for q in d.get("questions", []):
        cid = q.get("case_id")
        if cid and cid not in shown and cid in cases:
            shown.add(cid)
            out += ["", f"## {cases[cid].get('title', cid)}", "", cases[cid].get("text", "")]
        out += ["", f"### {q['n']}. {q['stem']}", ""]
        acc = q.get("accepted") or []
        for k, v in q.get("options", {}).items():
            out.append(f"- **{k}) {v}** ✅" if k in acc else f"- {k}) {v}")
        sol = ", ".join(acc) if acc else "sense clau"
        extra = " · ANUL·LADA" if q.get("annulled") else ""
        out += ["", f"> Solució: **{sol}**{extra} · Epígraf: {q.get('epigraf', '')}" + (f" · Nota: {q['notes']}" if q.get("notes") else "")]
    return "\n".join(out) + "\n"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for f in sorted(SRC.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        (OUT / f"{d['slug']}.md").write_text(render(d), encoding="utf-8")
        index.append({"slug": d["slug"], "title": d.get("title"), "kind": d.get("kind"), "date": d.get("date"),
                      "source_doc": d.get("source_doc"), "key_doc": d.get("key_doc"), "questions": len(d.get("questions", [])),
                      "md": f"preguntes/{d['slug']}.md"})
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(index)} blocs, {sum(i['questions'] for i in index)} preguntes")


if __name__ == "__main__":
    main()
