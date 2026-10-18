"""Segona passada: descarrega els recursos (modtype resource_*) que el mapa no va baixar.

Ús: python -I scripts/fuden_resources.py <fitxer_cookie>
"""
import json
import pathlib
import sys

sys.argv = [sys.argv[0], sys.argv[1], "481"]
import importlib.util

spec = importlib.util.spec_from_file_location("fm", pathlib.Path(__file__).with_name("fuden_map.py"))
fm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fm)

path = fm.OUT / "map.json"
inv = json.loads(path.read_text(encoding="utf-8"))
n = 0
for sec in inv["sections"]:
    for a in sec["activities"]:
        if (a.get("mod") or "").startswith("resource") and a.get("url") and "fetched" not in a:
            try:
                a["fetched"] = fm.download(a["url"] + "&redirect=1", sec["title"].split("|")[0].replace("Mosaico: ", ""), a["name"])
                n += 1
            except Exception as e:  # noqa: BLE001
                a["error"] = f"{type(e).__name__}: {e}"
                print("ERROR", a["name"], a["error"], flush=True)
    path.write_text(json.dumps(inv, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"Recursos descarregats: {n}")
