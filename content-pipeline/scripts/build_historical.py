"""Consolida les preguntes d'exàmens oficials històrics de l'ICS (anteriors al 2015).

Fonts (transcripcions pròpies de documents oficials públics, trobats com a material de referència):
- data/fuden/exams/*.json        exàmens complets amb plantilla oficial (2008-2010)
- data/fuden/compiled/part_*.json preguntes d'exàmens ICS 1992-2018 recopilades per temes

Regles:
- només preguntes amb resposta oficial (plantilla o marcada a la recopilació) i d'exàmens de l'ICS
- fora les que ja són al banc oficial 2015-2024 i els duplicats entre fonts (mateix enunciat i opcions)
- les preguntes històriques NO fixen pesos: el mapa de freqüències continua sortint només de 2015-2024

Ús: python -I scripts/build_historical.py  → data/historical/candidates.json + exams/*.json
"""
import difflib
import json
import pathlib
import re
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = DATA / "historical"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def signature(q) -> str:
    opts = " ".join(sorted(norm(v) for v in q["options"].values()))
    return f"{norm(q['stem'])} || {opts}"


def is_ics(q) -> tuple[bool, str]:
    notes = (q.get("notes") or "").lower()
    label = (q.get("source_exam") or "").lower()
    if "sespa" in label or "sespa" in notes:
        return False, "no ICS (SESPA)"
    if "altre tribunal" in notes or "another exam board" in notes or "no ics" in notes or "probablement d'un altre" in notes:
        return False, "probablement no ICS"
    if q.get("topic_file", "").startswith("Preguntes_ORL_OFT"):
        return False, "sense etiqueta d'examen ni clau"
    if not label and "sense etiqueta" in notes:
        return False, "sense etiqueta d'examen"
    return True, ""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "exams").mkdir(exist_ok=True)
    official = json.loads((DATA / "official_bank.json").read_text(encoding="utf-8"))
    seen = {signature(q): q["id"] for q in official}
    seen_list = list(seen.items())
    out, dropped = [], {"sense_clau": 0, "duplicat_oficial": 0, "duplicat": 0, "anul·lada": 0}
    reasons = {}

    def dup_of(sig: str):
        if sig in seen:
            return seen[sig]
        # gairebé idèntiques (variants d'accents o puntuació)
        stem = sig.split(" || ")[0]
        for s, qid in seen_list:
            other = s.split(" || ")[0]
            if abs(len(other) - len(stem)) < 20 and len(stem) > 25 and difflib.SequenceMatcher(None, other, stem).ratio() > 0.92:
                return qid  # mateix enunciat (les opcions poden variar per errors de transcripció)
        return None

    def add(item, sig):
        seen[sig] = item["id"]
        seen_list.append((sig, item["id"]))
        out.append(item)

    # 1) Exàmens complets
    for f in sorted((DATA / "fuden" / "exams").glob("*.json")):
        ex = json.loads(f.read_text(encoding="utf-8"))
        exam_id = ex["exam_id"]
        cases = []
        for c in ex.get("cases", []):
            # el text previ a cada pregunta (camp `context`) es converteix en segments per fases
            segs = [{"from_question": None, "text": c["text"]}]
            for q in ex["questions"]:
                if q.get("case_id") == c["id"] and q.get("context"):
                    segs.append({"from_question": q["n"], "text": q["context"]})
            cases.append({**c, "segments": segs})
        ex_out = {k: ex.get(k) for k in ("exam_id", "title", "date", "instructions")}
        ex_out["format"] = {"penalty": None, "time_min": None, "note": ex.get("source_note", "Examen oficial ICS (històric)")}
        ex_out["cases"] = cases
        (OUT / "exams" / f.name).write_text(json.dumps(ex_out, ensure_ascii=False, indent=1), encoding="utf-8")
        year = ex["date"][:4]
        for q in ex["questions"]:
            if q.get("annulled"):
                dropped["anul·lada"] += 1
                continue
            if not q["accepted"]:
                dropped["sense_clau"] += 1
                continue
            sig = signature(q)
            d = dup_of(sig)
            if d:
                dropped["duplicat_oficial" if d.startswith("ics-dsi-") else "duplicat"] += 1
                continue
            add({
                "id": f"{exam_id}-{q['n']}", "exam_id": exam_id, "n": q["n"], "section": q["section"],
                "case_id": q.get("case_id"), "stem": q["stem"], "options": q["options"], "accepted": q["accepted"],
                "source_label": f"{ex.get('title') or exam_id} ({year})", "year": int(year),
            }, sig)

    # 2) Preguntes recopilades per temes
    for part in sorted((DATA / "fuden" / "compiled").glob("part_*.json")):
        for q in json.loads(part.read_text(encoding="utf-8")):
            ok, why = is_ics(q)
            if not ok:
                reasons[why] = reasons.get(why, 0) + 1
                continue
            if not q["accepted"]:
                dropped["sense_clau"] += 1
                continue
            if "anul" in (q.get("notes") or "").lower() and not q["accepted"]:
                dropped["anul·lada"] += 1
                continue
            sig = signature(q)
            d = dup_of(sig)
            if d:
                dropped["duplicat_oficial" if d.startswith("ics-dsi-") else "duplicat"] += 1
                continue
            label = (q.get("source_exam") or "").strip()
            add({
                "id": f"ics-hist-{q['id'].removeprefix('cmp-')}", "exam_id": None, "n": None, "section": "test", "case_id": None,
                "stem": q["stem"], "options": q["options"], "accepted": q["accepted"],
                "source_label": f"Examen oficial ICS · {label}" if label else "Examen oficial ICS",
                "year": q.get("year"), "topic_hint": q.get("topic_file"),
            }, sig)

    (OUT / "candidates.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    years = {}
    for q in out:
        years[q.get("year")] = years.get(q.get("year"), 0) + 1
    print(f"Candidates: {len(out)} · descartades: {dropped} · no ICS/sense font: {reasons}")
    print("Per any:", dict(sorted(years.items(), key=lambda x: (x[0] is None, x[0] or 0))))


if __name__ == "__main__":
    main()
