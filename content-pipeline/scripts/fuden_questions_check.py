"""Valida els fitxers de preguntes FUDEN extrets.

Ús: python -I scripts/fuden_questions_check.py data/fuden/questions/<slug>.json [...]
"""
import json
import pathlib
import sys

EPIGRAFS = {
    line.split("\t")[0]
    for line in pathlib.Path("data/fuden/questions/_epigrafs.txt").read_text(encoding="utf-8").splitlines()
    if line and not line.startswith("#")
}
bad = 0
for f in sys.argv[1:]:
    d = json.loads(pathlib.Path(f).read_text(encoding="utf-8"))
    errs = []
    for k in ("slug", "source_doc", "label", "kind", "title", "questions"):
        if k not in d:
            errs.append(f"falta {k}")
    cases = {c["id"] for c in d.get("cases", [])}
    seen = set()
    nokey = 0
    for q in d.get("questions", []):
        tag = f"#{q.get('n')}"
        if q.get("n") in seen:
            errs.append(f"{tag} número repetit")
        seen.add(q.get("n"))
        opts = q.get("options", {})
        if not q.get("stem", "").strip():
            errs.append(f"{tag} sense enunciat")
        if len(opts) < 2 or any(k not in "abcde" or not str(v).strip() for k, v in opts.items()):
            errs.append(f"{tag} opcions incorrectes")
        acc = q.get("accepted", [])
        if not acc and not q.get("annulled"):
            nokey += 1
        if any(a not in opts for a in acc):
            errs.append(f"{tag} clau fora de les opcions")
        if q.get("epigraf") not in EPIGRAFS:
            errs.append(f"{tag} epígraf desconegut {q.get('epigraf')}")
        if q.get("section") == "case" and q.get("case_id") not in cases:
            errs.append(f"{tag} cas inexistent {q.get('case_id')}")
        text = q.get("stem", "") + " ".join(map(str, opts.values()))
        if "Descarga autorizada" in text or "JDLHH" in text:
            errs.append(f"{tag} marca d'aigua")
    n = len(d.get("questions", []))
    print(f"{f}: {n} preguntes, {nokey} sense clau, {len(errs)} errors")
    for e in errs[:30]:
        print("  -", e)
    bad += bool(errs)
sys.exit(1 if bad else 0)
