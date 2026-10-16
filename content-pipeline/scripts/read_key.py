"""Lee las respuestas marcadas en una plantilla oficial escaneada (hoja óptica).

Uso: python -I scripts/read_key.py <key_name> [<key_name> ...]
  - lee pages/<key_name>/hi_p01.png y la geometría de scripts/key_grids.json
  - escribe data/exams/<key_name>.auto.json y pages/<key_name>/overlay.png

Para cada pregunta mide la proporción de tinta oscura (no naranja) en cada
burbuja A..E. Marca como dudosas las filas sin marca clara o con dos marcas.
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
GRIDS = json.loads((ROOT / "scripts" / "key_grids.json").read_text(encoding="utf-8"))
LETTERS = "abcde"
MIN_FILL = 0.30   # proporción mínima de tinta para considerar una burbuja marcada
RATIO = 0.55      # una burbuja cuenta como marcada si supera esto × la marca más fuerte
RED_STRIKE = 0.02  # proporción de tinta roja en la fila a partir de la cual se considera tachada


def read_key(name: str) -> dict:
    cfg = GRIDS[name]
    page = ROOT / "pages" / name / "hi_p01.png"
    img = Image.open(page).convert("RGB")
    a = np.asarray(img).astype(int)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    ink = ((R + G + B) / 3 < 120) & ~((R - G) > 60)
    # tinta roja manuscrita (tachado "Anul·lar"), más saturada que el naranja impreso
    red = (R > 150) & (G < 90) & (B < 110) & (R - G > 90)

    rows, cols = cfg["rows"], cfg["cols"]
    pitch_y = np.median(np.diff(rows[:10]))
    pitch_x = np.median(np.diff(cols[0]))
    hh, hw = int(pitch_y * 0.22), int(pitch_x * 0.38)

    draw = ImageDraw.Draw(img)
    answers = {}
    for lo, hi in cfg["ranges"]:
        for n in range(lo, hi + 1):
            col, row = (n - 1) // 50, (n - 1) % 50
            y = rows[row]
            fills = []
            for x in cols[col]:
                win = ink[y - hh:y + hh, x - hw:x + hw]
                fills.append(float(win.mean()))
            order = np.argsort(fills)[::-1]
            top = fills[order[0]]
            band = red[y - hh:y + hh, cols[col][0] - int(pitch_x):cols[col][-1] + hw]
            red_frac = float(band.mean())
            marked = [LETTERS[i] for i in range(5) if fills[i] >= MIN_FILL and fills[i] > RATIO * top]
            if red_frac > RED_STRIKE:
                status, ans = "annulled", None
            elif top < MIN_FILL:
                status, ans = "blank", None
            elif len(marked) > 1:
                status, ans = "multi", None
            else:
                status, ans = "ok", LETTERS[order[0]]
            answers[str(n)] = {"answer": ans, "accepted": marked, "status": status,
                               "fills": [round(f, 2) for f in fills], "red": round(red_frac, 3)}
            for i, x in enumerate(cols[col]):
                color = "lime" if (ans and LETTERS[i] == ans) else ("red" if status != "ok" else "cyan")
                width = 4 if (ans and LETTERS[i] == ans) or status != "ok" else 1
                draw.rectangle([x - hw, y - hh, x + hw, y + hh], outline=color, width=width)
    img.save(ROOT / "pages" / name / "overlay.png")
    return answers


if __name__ == "__main__":
    for name in sys.argv[1:]:
        res = read_key(name)
        out = ROOT / "data" / "exams" / f"{name}.auto.json"
        out.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
        issues = {k: v for k, v in res.items() if v["status"] != "ok"}
        print(f"{name}: {len(res)} preguntas, {len(issues)} dudosas/en blanco")
        for k, v in issues.items():
            print(f"   {k}: {v['status']} {v['fills']}")
