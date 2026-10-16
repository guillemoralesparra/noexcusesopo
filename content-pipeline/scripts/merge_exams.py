"""Une cada transcripción de examen con su plantilla oficial leída por read_key.py.

Uso: python -I scripts/merge_exams.py
Escribe data/exams/<exam>.json y data/official_bank.json (todas las preguntas).
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXAMS = ROOT / "data" / "exams"

# examen -> (plantilla, metadatos de formato conocidos por las instrucciones impresas)
SOURCES = {
    "2015_A": ("2015_A_key", {"penalty": None, "time_min": None,
                              "note": "Sense instruccions impreses de temps ni penalització"}),
    "2016PI": ("2016PI_key", {"penalty": None, "time_min": None,
                              "note": "Promoció interna; s'escull un dels dos supòsits (A: 101-120, B: 121-140)"}),
    "2019_A": ("2019_A_key", {"penalty": 0, "time_min": 120,
                              "note": "Diligència 12.4.2019: errors i blancs no descompten"}),
    "2024_A": ("2024_A_key", {"penalty": 0, "time_min": 120,
                              "note": "Diligència 8.5.2024: errors i blancs no descompten; exercicis no eliminatoris"}),
}


def main() -> int:
    bank, problems = [], []
    for exam, (key_name, fmt) in SOURCES.items():
        q = json.loads((EXAMS / f"{exam}.questions.json").read_text(encoding="utf-8"))
        key = json.loads((EXAMS / f"{key_name}.auto.json").read_text(encoding="utf-8"))
        numbers = {str(x["n"]) for x in q["questions"]}
        # una fila marcada en la plantilla sin pregunta transcrita (o al revés) indica un error
        marked = {n for n, v in key.items() if v["status"] != "blank"}
        for n in sorted(marked - numbers, key=int):
            problems.append(f"{exam}: la plantilla marca la {n} pero no hay pregunta")
        for item in q["questions"]:
            k = key.get(str(item["n"]))
            if k is None or k["status"] == "blank":
                problems.append(f"{exam}: pregunta {item['n']} sin respuesta en plantilla")
                continue
            item["annulled"] = k["status"] == "annulled"
            item["accepted"] = [] if item["annulled"] else k["accepted"] or [k["answer"]]
            item["answer"] = item["accepted"][0] if len(item["accepted"]) == 1 else None
            item["id"] = f"{q['exam_id']}-{item['n']}"
            bank.append({**item, "exam_id": q["exam_id"], "date": q["date"]})
        q["format"] = fmt
        (EXAMS / f"{exam}.json").write_text(json.dumps(q, ensure_ascii=False, indent=1), encoding="utf-8")
        n_ann = sum(1 for x in q["questions"] if x.get("annulled"))
        n_multi = sum(1 for x in q["questions"] if len(x.get("accepted", [])) > 1)
        print(f"{exam}: {len(q['questions'])} preguntas, {len(q['cases'])} supuestos, "
              f"{n_ann} anuladas, {n_multi} con varias respuestas válidas")
    (ROOT / "data" / "official_bank.json").write_text(
        json.dumps(bank, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Total banco oficial: {len(bank)} preguntas")
    for p in problems:
        print("PROBLEMA:", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
