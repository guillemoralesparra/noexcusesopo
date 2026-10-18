"""Mapa de només lectura del curs de FUDEN (Moodle) per a referència privada.

- No inicia cap intent de test: només llegeix la portada dels tests i les revisions d'intents ja fets.
- Una petició per segon. Descarrega fitxers (resource/folder) a raw/fuden/files/.
- La cookie de sessió es llegeix d'un fitxer passat per argument (mai es desa al repositori).

Ús: python -I scripts/fuden_map.py <fitxer_cookie> <course_id>
Escriu raw/fuden/map.json (inventari) i raw/fuden/pages/*.html.
"""
import html
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "raw" / "fuden"
BASE = "https://oposiciones.fuden.es"
COOKIE = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").strip()
COURSE = sys.argv[2]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155 Safari/537.36"
_last = [0.0]


def get(url: str) -> tuple[bytes, str, str]:
    wait = 1.0 - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={"Cookie": COOKIE, "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        _last[0] = time.time()
        return r.read(), r.headers.get("Content-Type", ""), r.geturl()


def text(s: str) -> str:
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def slug(s: str, n: int = 80) -> str:
    return re.sub(r"[^\w.-]+", "_", s, flags=re.UNICODE)[:n].strip("_")


def activities(page: str):
    """Activitats d'una secció: tipus de mòdul, id, nom i enllaç."""
    out = []
    # Cada activitat és un <li data-for="cmitem" ...>; el bloc acaba on comença la següent
    starts = [m.start() for m in re.finditer(r'<li\s[^>]*data-for="cmitem"', page)]
    for i, st in enumerate(starts):
        block = page[st: starts[i + 1] if i + 1 < len(starts) else len(page)]
        attr = lambda k: (re.search(rf'data-{k}="([^"]*)"', block) or [None, None])[1]  # noqa: E731
        link = re.search(r'href="(https://oposiciones\.fuden\.es/mod/[^"]+)"', block)
        avail = re.search(r'class="availabilityinfo[^"]*"[^>]*>(.*?)</div>', block, re.S)
        alt = re.search(r'class="[^"]*(?:activity-altcontent|contentafterlink)[^"]*"[^>]*>(.*?)</div>', block, re.S)
        out.append({
            "mod": attr("modtype"),
            "cmid": attr("cmid"),
            "name": html.unescape(attr("title") or ""),
            "url": html.unescape(link.group(1)) if link else None,
            "restricted": text(avail.group(1)) if avail else None,
            "description": text(alt.group(1))[:1500] if alt else "",
        })
    return out


def save_page(name: str, data: bytes):
    p = OUT / "pages" / f"{slug(name)}.html"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    return str(p.relative_to(OUT))


def download(url: str, folder: str, fallback: str) -> dict:
    data, ctype, final = get(url)
    if "text/html" in ctype:
        return {"kind": "html", "page": save_page(fallback, data), "final_url": final}
    fname = urllib.parse.unquote(final.split("?")[0].rsplit("/", 1)[-1]) or fallback
    p = OUT / "files" / slug(folder, 60) / slug(fname, 120)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    return {"kind": "file", "file": str(p.relative_to(OUT)), "bytes": len(data), "content_type": ctype}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    course, _, _ = get(f"{BASE}/course/view.php?id={COURSE}")
    course = course.decode("utf-8", "replace")
    sections = sorted({int(n) for n in re.findall(rf'course/view\.php\?id={COURSE}(?:&amp;|&)section=(\d+)', course)})
    inventory = {"course": COURSE, "sections": []}
    for n in sections:
        raw, _, _ = get(f"{BASE}/course/view.php?id={COURSE}&section={n}")
        page = raw.decode("utf-8", "replace")
        title = re.search(r'<h2[^>]*class="[^"]*sectionname[^"]*"[^>]*>(.*?)</h2>', page, re.S) or re.search(r"<title>(.*?)</title>", page)
        sec = {"n": n, "title": text(title.group(1)) if title else str(n), "summary": "", "activities": activities(page)}
        summ = re.search(r'class="summarytext"[^>]*>(.*?)</div>', page, re.S)
        sec["summary"] = text(summ.group(1))[:2000] if summ else ""
        print(f"Secció {n}: {sec['title']} — {len(sec['activities'])} activitats", flush=True)
        for a in sec["activities"]:
            if not a["url"] or a["restricted"]:
                continue
            try:
                if a["mod"] == "resource":
                    a["fetched"] = download(a["url"] + "&redirect=1", sec["title"], a["name"])
                elif a["mod"] == "folder":
                    data, _, _ = get(a["url"])
                    fpage = data.decode("utf-8", "replace")
                    files = sorted(set(re.findall(r'href="(https://oposiciones\.fuden\.es/pluginfile\.php/[^"]+)"', fpage)))
                    a["files"] = [download(html.unescape(f), f"{sec['title']}/{a['name']}", a["name"]) for f in files]
                elif a["mod"] in ("page", "url", "book", "label", "forum", "lesson", "hvp", "h5pactivity", "scorm"):
                    data, _, final = get(a["url"])
                    a["fetched"] = {"kind": "html", "page": save_page(f"{a['mod']}_{a['cmid']}_{a['name']}", data), "final_url": final}
                elif a["mod"] == "quiz":
                    data, _, _ = get(a["url"])
                    qpage = data.decode("utf-8", "replace")
                    a["fetched"] = {"kind": "html", "page": save_page(f"quiz_{a['cmid']}_{a['name']}", data)}
                    # Revisions d'intents ja fets (només lectura; no es comença cap intent)
                    reviews = sorted(set(html.unescape(r) for r in re.findall(r'href="(https://oposiciones\.fuden\.es/mod/quiz/review\.php\?attempt=\d+[^"]*)"', qpage)))
                    a["reviews"] = []
                    for r in reviews:
                        rdata, _, _ = get(r + "&showall=1")
                        a["reviews"].append(save_page(f"review_{a['cmid']}_{re.search(r'attempt=(\d+)', r).group(1)}", rdata))
                    a["quiz_info"] = text(re.search(r'<div[^>]*class="[^"]*quizinfo[^"]*"[^>]*>(.*?)</div>', qpage, re.S).group(1)) if "quizinfo" in qpage else ""
                else:
                    data, _, final = get(a["url"])
                    a["fetched"] = {"kind": "html", "page": save_page(f"{a['mod']}_{a['cmid']}_{a['name']}", data), "final_url": final}
            except Exception as e:  # noqa: BLE001 — l'inventari ha de continuar
                a["error"] = f"{type(e).__name__}: {e}"
                print(f"  ERROR {a['mod']} {a['name']}: {a['error']}", flush=True)
        inventory["sections"].append(sec)
        (OUT / "map.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(len(s["activities"]) for s in inventory["sections"])
    print(f"Fet: {len(inventory['sections'])} seccions, {total} activitats", flush=True)


if __name__ == "__main__":
    main()
