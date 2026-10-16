"""Divideix el text de cada supòsit en segments amb la pregunta a partir de la qual apareixen.

Als exàmens, la narració del cas continua entre preguntes. Si es mostra sencera de bon
començament, els paràgrafs posteriors poden revelar respostes. Cada segment rep
`from_question`: el número de pregunta abans del qual estava imprès (null = enunciat inicial,
"end" = després de l'última pregunta).

Les transcripcions ho marquen de tres maneres diferents:
- 2024: marcadors "[Abans de la pregunta N]" i "[Després de l'última pregunta del supòsit]"
- 2019: nota a la pregunta "Preceded in the exam by case continuation text (...): <text>"
- 2016PI: paràgrafs afegits al final del text, en ordre, abans de preguntes conegudes

Ús: python -I scripts/normalize_cases.py   (després de merge_exams.py)
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXAMS = ROOT / "data" / "exams"

# 2016PI: preguntes davant de les quals hi havia paràgrafs de continuació (verificat a la transcripció)
CONTINUATIONS_2016PI = {"C1": [111, 118], "C2": [124, 126, 132, 136, 138, 140]}

MARKER = re.compile(r"^\[(Abans de la pregunta (\d+)|Després de l.últim[a]? pregunta del supòsit)\]\s*")
NOTE = re.compile(r"Preceded in the exam by case continuation text[^:]*:\s*(.+)$", re.S)


def from_markers(text):
    segs = []
    for para in [p.strip() for p in text.split("\n\n") if p.strip()]:
        m = MARKER.match(para)
        if m:
            segs.append({"from_question": int(m.group(2)) if m.group(2) else "end", "text": para[m.end():]})
        elif segs and segs[-1]["from_question"] is not None:
            segs[-1]["text"] += "\n\n" + para
        else:
            segs.append({"from_question": None, "text": para})
    return merge_initial(segs)


def from_notes(case, questions):
    """El text del cas té cada fragment en línies; la nota de la pregunta en dona l'inici."""
    lines = [l.strip() for l in case["text"].split("\n") if l.strip()]
    starts = {}  # índex de línia -> pregunta
    for q in questions:
        if q.get("case_id") != case["id"]:
            continue
        m = NOTE.search(q.get("transcription_notes", ""))
        if not m:
            continue
        head = m.group(1).strip()[:40]
        idx = next((i for i, l in enumerate(lines) if l.startswith(head)), None)
        if idx is None:
            raise ValueError(f"{case['id']}: no trobo el fragment de la pregunta {q['n']}")
        starts[idx] = q["n"]
    segs, current = [], {"from_question": None, "lines": []}
    for i, line in enumerate(lines):
        if i in starts:
            segs.append(current)
            current = {"from_question": starts[i], "lines": []}
        current["lines"].append(line)
    segs.append(current)
    return [{"from_question": s["from_question"], "text": "\n".join(s["lines"])} for s in segs if s["lines"]]


def from_trailing(case, numbers):
    paras = [p.strip() for p in case["text"].split("\n\n") if p.strip()]
    k = len(numbers)
    base, tail = paras[:-k], paras[-k:]
    return [{"from_question": None, "text": "\n\n".join(base)}] + [
        {"from_question": n, "text": t} for n, t in zip(numbers, tail)
    ]


def merge_initial(segs):
    initial = [s["text"] for s in segs if s["from_question"] is None]
    rest = [s for s in segs if s["from_question"] is not None]
    return [{"from_question": None, "text": "\n\n".join(initial)}] + rest


for path in sorted(EXAMS.glob("*.json")):
    if ".questions" in path.name or ".auto" in path.name:
        continue
    exam = json.loads(path.read_text(encoding="utf-8"))
    for case in exam["cases"]:
        if "[Abans de la pregunta" in case["text"]:
            segs = from_markers(case["text"])
        elif path.stem == "2016PI":
            segs = from_trailing(case, CONTINUATIONS_2016PI[case["id"]])
        else:
            segs = from_notes(case, exam["questions"])
        case["segments"] = segs
        print(f"{path.stem} {case['id']}: " + ", ".join(
            f"{s['from_question']}({len(s['text'])})" for s in segs))
    path.write_text(json.dumps(exam, ensure_ascii=False, indent=1), encoding="utf-8")
