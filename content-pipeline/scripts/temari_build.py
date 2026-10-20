"""Construeix el temari v2 amb el contingut literal del material de FUDEN i la normativa.

Ús:
  python -I scripts/temari_build.py listings   # llistats de segments per document (per repartir-los)
  python -I scripts/temari_build.py check      # comprova que cada segment està assignat una sola vegada
  python -I scripts/temari_build.py build      # genera la guia: data/fuden/temari/guia/

Entrades: data/temario.json (estructura v2), data/fuden/temari/segments.json (temari_segments.py),
data/fuden/temari/assign/*.json (repartiment) i data/sources/*.json (normativa).
Tot el que escriu és a data/fuden/ (privat, .gitignore). No usa cap model.
"""
import json
import pathlib
import re
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TEMARI = DATA / "fuden" / "temari"
WEB = DATA / "fuden" / "web"


def load(p: pathlib.Path):
    return json.loads(p.read_text(encoding="utf-8"))


def structure() -> tuple[dict, dict]:
    t = load(DATA / "temario.json")
    temes, eps = {}, {}
    for b in t["blocs"]:
        for tm in b["temes"]:
            temes[tm["id"]] = tm
            for e in tm["epigrafs"]:
                eps[e["id"]] = {**e, "tema": tm["id"]}
    return temes, eps


def segments() -> tuple[list, dict]:
    docs = load(TEMARI / "segments.json")
    return docs, {s["id"]: (d, s) for d in docs for s in d["segments"]}


def listings():
    out = TEMARI / "listings"
    out.mkdir(parents=True, exist_ok=True)
    docs, _ = segments()
    for d in docs:
        if d["dup_doc"] is not None:
            continue
        lines = [f"# doc {d['doc']} · {d['title']} · {d['kind']} · {d['pages']} pàg. · {d['md']}",
                 "# segment|nivell|pàgines|caràcters|títol   (DUP = ja és en un altre document; no cal assignar-lo)"]
        for s in d["segments"]:
            dup = f" DUP={s['dup_of']}" if s["dup_of"] else ""
            lines.append(f"{s['id']}|{s['level']}|{s['pages'][0]}-{s['pages'][1]}|{s['chars']}|{s['title']}{dup}")
        (out / f"{d['doc']:03d}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{sum(1 for d in docs if d['dup_doc'] is None)} llistats a {out}")


def expand(spec: str, docs_by_id: dict) -> list[str]:
    """'343.5-40' o '343.5-343.40' o '343.7' -> ids de segment."""
    m = re.fullmatch(r"(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?", spec.strip())
    if not m:
        raise ValueError(f"rang no vàlid: {spec}")
    doc, a = int(m.group(1)), int(m.group(2))
    if m.group(3) and int(m.group(3)) != doc:
        raise ValueError(f"rang entre documents: {spec}")
    b = int(m.group(4)) if m.group(4) else a
    if doc not in docs_by_id:
        raise ValueError(f"document desconegut: {spec}")
    n = len(docs_by_id[doc]["segments"])
    if not (0 <= a <= b < n):
        raise ValueError(f"fora de rang (doc {doc} té {n} segments): {spec}")
    return [f"{doc}.{i}" for i in range(a, b + 1)]


def assignments():
    docs, seg = segments()
    by_id = {d["doc"]: d for d in docs}
    _, eps = structure()
    errors, owner = [], {}
    rows = []
    for f in sorted((TEMARI / "assign").glob("*.json")):
        a = load(f)
        for kind in ("assignments", "omit"):
            for r in a.get(kind, []):
                try:
                    ids = expand(r["segs"], by_id)
                except ValueError as e:
                    errors.append(f"{f.name}: {e}")
                    continue
                if kind == "assignments" and r.get("epigraf") not in eps:
                    errors.append(f"{f.name}: epígraf desconegut {r.get('epigraf')} ({r['segs']})")
                    continue
                for i in ids:
                    if i in owner:
                        errors.append(f"{f.name}: {i} ja assignat a {owner[i]}")
                    owner[i] = f"{f.name}:{r.get('epigraf', 'omit')}"
                if kind == "assignments":
                    rows.append({**r, "ids": ids, "file": f.name})
    missing = [s["id"] for d in docs if d["dup_doc"] is None for s in d["segments"] if not s["dup_of"] and s["id"] not in owner]
    return rows, errors, missing, eps, seg, by_id


def check(only: set[int] | None = None):
    rows, errors, missing, eps, seg, _ = assignments()
    if only:
        missing = [m for m in missing if int(m.split(".")[0]) in only]
    by_doc = defaultdict(list)
    for m in missing:
        by_doc[int(m.split(".")[0])].append(m)
    for e in errors[:80]:
        print("ERROR", e)
    print(f"{len(errors)} errors; {len(missing)} segments sense assignar en {len(by_doc)} documents")
    for d, ms in sorted(by_doc.items()):
        print(f"  doc {d}: {len(ms)} ({ms[0]} … {ms[-1]})")
    chars = defaultdict(int)
    for r in rows:
        for i in r["ids"]:
            chars[r["epigraf"]] += seg[i][1]["chars"]
    empty = [e for e in eps if chars[e] == 0]
    print(f"Epígrafs sense contingut FUDEN: {len(empty)} {empty}")


# Trossos de la marca d'aigua de descàrrega que encara queden dins de taules ("_rizad_<br>", "_38173_<br>")
# (xifres normalitzades a 9: la data i l'hora canvien d'una descàrrega a l'altra). Només trossos seguits de <br>
# o sols dins d'una cel·la, per no tocar cursives del text.
WM_TEXT = "descarga autorizada a jdlhh (id 999999) el 99-99-9999 99:99:99 desde oposiciones.fuden.es"
WM_FRAG = re.compile(r"_([^_\n|<]{1,25})_(?=<br>|\s*\||\s*$)(?:<br>)?")
PAGE = re.compile(r"^<!-- pàg\. (\d+) -->$", re.M)
HEAD = re.compile(r"^(#{1,6}) +")
ROLE_ORDER = {"temari": 0, "resum": 1, "suport": 2, "presentacio": 3, "normativa": 4, "bibliografia": 5}
ROLE_TITLE = {"temari": "Temari", "resum": "Resums del temari", "suport": "Material de suport",
              "presentacio": "Diapositives de les sessions", "normativa": "Normativa", "bibliografia": "Bibliografia"}


def wm_fragment(m: re.Match) -> str:
    t = re.sub(r"\d", "9", m.group(1).strip().lower())
    if t and (t in WM_TEXT or re.sub(r"[ .]", "", t) in re.sub(r"[ .]", "", WM_TEXT)):
        return ""
    return m.group(0)


def clean_text(text: str, repeated: set[str], img_prefix: str) -> str:
    out = []
    for line in text.splitlines():
        key = re.sub(r"[*_\s]+", " ", line).strip().lower()
        if key in repeated or re.fullmatch(r"\**\s*\d{1,4}\s*\**", line.strip()):
            continue
        if re.search(r"38173|jdlhh|descarga autorizada", line, re.I):
            line = re.sub(r"[^|]*(38173|JDLHH|Descarga autorizada)[^|]*", "", line, flags=re.I)
        line = WM_FRAG.sub(wm_fragment, line)
        line = line.replace("](../img/", f"]({img_prefix}")
        m = HEAD.match(line)
        if m:  # els títols del document queden per sota del de l'epígraf (#), la part (##) i el bloc (###)
            line = "#" * min(6, len(m.group(1)) + 3) + " " + line[m.end():]
        out.append(line)
    text, last = [], None
    for line in out:  # una sola marca per pàgina encara que s'hi ajuntin diversos segments
        m = PAGE.match(line)
        if m:
            if m.group(1) == last:
                continue
            last = m.group(1)
        text.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(text)).strip()


def doc_pages(md_rel: str) -> dict[int, str]:
    md = (WEB / md_rel).read_text(encoding="utf-8")
    body = md.split("\n---\n", 1)[1] if md.startswith("---") else md
    parts = PAGE.split(body)
    return {int(parts[i]): parts[i + 1] for i in range(1, len(parts) - 1, 2)}


def repeated_lines(pages: dict[int, str]) -> set[str]:
    """Capçaleres i peus que surten a moltes pàgines del mateix document (nom de l'ICS, número de tema...)."""
    if len(pages) < 4:
        return set()
    count = defaultdict(int)
    for t in pages.values():
        for key in {re.sub(r"[*_\s]+", " ", l).strip().lower() for l in t.splitlines()}:
            if 3 <= len(key) <= 90 and not key.startswith(("![", "|", "<!--")):
                count[key] += 1
    return {k for k, n in count.items() if n >= max(4, 0.25 * len(pages))}


def find_heading(text: str, title: str, after: int = 0):
    for m in re.finditer(r"^#{1,4} +(.+?)\s*$", text, re.M):
        if m.start() >= after and re.sub(r"[*_`]+", "", m.group(1)).strip()[:160] == title:
            return m.start()
    return None


def segment_text(d: dict, seg: dict, pages: dict[int, str]) -> str:
    """Text literal d'un segment: del seu títol fins al títol del segment següent (encara que comparteixin pàgina)."""
    segs = d["segments"]
    i = segs.index(seg)
    a, b = seg["pages"]
    text = "\n".join(f"<!-- pàg. {n} -->\n" + pages.get(n, "") for n in range(a, b + 1))
    if seg["level"] > 0 and not seg["title"].endswith("(cont.)"):
        pos = find_heading(text, seg["title"])
        if pos is not None:
            text = f"<!-- pàg. {a} -->\n" + text[pos:]
    elif seg["title"].endswith("(cont.)") and i > 0:
        # Continuació: comença on acaba el segment anterior (que ocupa la mateixa pàgina inicial si escau)
        pass
    if i + 1 < len(segs):
        nxt = segs[i + 1]
        if nxt["pages"][0] == b and nxt["level"] > 0 and not nxt["title"].endswith("(cont.)"):
            pos = find_heading(text, nxt["title"], after=1)
            if pos is not None:
                text = text[:pos]
    return text


def doc_label(d: dict, docs_by_id: dict) -> str:
    t = d["title"].strip()
    if t.lower().startswith("resumen"):
        prev = docs_by_id.get(d["doc"] - 1)
        return f"Resum · {prev['title'].strip()}" if prev else t
    return t


def role_of(r: dict, d: dict) -> str:
    if r.get("role") == "bibliografia":
        return "bibliografia"
    if d["kind"] == "temari" and (d["title"].lower().startswith("resumen") or "(resumen)" in d["title"].lower()):
        return "resum"
    return d["kind"]


def page_span(segs: list[dict]) -> str:
    a, b = segs[0]["pages"][0], segs[-1]["pages"][1]
    return f"pàg. {a}" if a == b else f"pàg. {a}-{b}"


def seg_no(s: dict) -> int:
    return int(s["id"].split(".")[1])


def build():
    rows, errors, missing, eps, seg, by_id = assignments()
    if errors:
        raise SystemExit(f"{len(errors)} errors al repartiment: executa check")
    temes, _ = structure()
    out = TEMARI / "guia"
    out.mkdir(parents=True, exist_ok=True)
    blocks = defaultdict(list)
    for r in rows:
        d = by_id[int(r["ids"][0].split(".")[0])]
        segs = [seg[i][1] for i in r["ids"] if not seg[i][1]["dup_of"]]
        if segs:
            blocks[r["epigraf"]].append((role_of(r, d), d, segs))
    normativa = defaultdict(list)
    sources = {f.stem: load(f) for f in (DATA / "sources").glob("*.json") if f.stem != "index"}
    for f in sorted((TEMARI / "assign").glob("*.json")):
        for n in load(f).get("normativa", []):
            src = sources.get(n.get("slug"))
            if not src or n.get("epigraf") not in eps:
                print("AVÍS normativa desconeguda:", n.get("slug"), n.get("epigraf"))
                continue
            chunks = {c["id"]: c for c in src["chunks"]}
            for cid in n["chunks"]:
                if cid in chunks:
                    normativa[n["epigraf"]].append((src, chunks[cid]))
                else:
                    print("AVÍS article desconegut:", cid)
    cache: dict[int, tuple[dict, set]] = {}
    index = {"epigrafs": {}}
    web: list[dict] = []
    for tid, tm in temes.items():
        (out / tid).mkdir(exist_ok=True)
        for e in tm["epigrafs"]:
            eid = e["id"]
            parts, meta = defaultdict(list), []
            items = sorted(blocks[eid], key=lambda x: (ROLE_ORDER[x[0]], x[1]["doc"], seg_no(x[2][0])))
            merged = []  # trossos consecutius del mateix document en un sol bloc
            for role, d, segs in items:
                if merged and merged[-1][0] == role and merged[-1][1] is d and seg_no(segs[0]) == seg_no(merged[-1][2][-1]) + 1:
                    merged[-1][2].extend(segs)
                else:
                    merged.append((role, d, list(segs)))
            for role, d, segs in merged:
                if d["doc"] not in cache:
                    pg = doc_pages(d["md"])
                    cache[d["doc"]] = (pg, repeated_lines(pg))
                pg, rep = cache[d["doc"]]
                body = clean_text("\n\n".join(segment_text(d, s, pg) for s in segs), rep, "../../web/img/")
                label = doc_label(d, by_id)
                parts[role].append(f"### {label} · {page_span(segs)}\n\n> Font: FUDEN, doc. {d['doc']} ({d['md'].split('/')[-1]})\n\n{body}")
                meta.append({"role": role, "doc": d["doc"], "title": label, "pages": page_span(segs),
                             "segs": [s["id"] for s in segs], "words": len(body.split())})
                web.append({"epigraf": eid, "part": role, "title": label, "source": f"FUDEN · {page_span(segs)}",
                            "url": None, "body": IMG_LINE.sub("", body)})
            for src, c in normativa[eid]:
                head = f"{c['unit']}. {c['heading']}".strip(". ")
                parts["normativa"].append(f"### {src.get('short') or src['title']} · {head}\n\n> Font: {src['title']} ({src['url']})\n\n{c['text'].strip()}")
                meta.append({"role": "normativa", "slug": src["slug"], "chunk": c["id"], "title": f"{src.get('short')} · {head}", "words": len(c["text"].split())})
                web.append({"epigraf": eid, "part": "normativa", "title": f"{src.get('short') or src['title']} · {head}",
                            "source": src["title"], "url": src["url"], "body": c["text"].strip()})
            md = [f"---\nepigraf: {eid}\ntema: {tid}\n---\n", f"# {eid} {e['titol']}\n",
                  f"> Tema {tid} · {tm['titol']}" + (f"  \n> Abast: {e['abast']}" if e.get("abast") else "") + "\n"]
            if not meta:
                md.append("_Aquest epígraf encara no té material: vegeu els buits a la guia._\n")
            for role in sorted(parts, key=ROLE_ORDER.get):
                md.append(f"## {ROLE_TITLE[role]}\n\n" + "\n\n".join(parts[role]) + "\n")
            (out / tid / f"{eid}.md").write_text("\n".join(md), encoding="utf-8")
            index["epigrafs"][eid] = {"tema": tid, "titol": e["titol"], "file": f"{tid}/{eid}.md", "blocks": meta}
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    write_guide(out, temes, index, missing)
    write_web_blocks(web)


# Imatges de diapositives i pàgines escanejades: la web mostra només el text
IMG_LINE = re.compile(r"^!\[[^\]]*\]\([^)]*\)\s*$\n?", re.M)
PAGE_WORDS = 4000  # els blocs llargs es parteixen en pàgines d'aquesta mida (pel títol o la pàgina més propers)


def split_pages(body: str) -> list[str]:
    if len(body.split()) <= PAGE_WORDS * 1.25:
        return [body]
    pages, cur, words = [], [], 0
    for line in body.splitlines():
        cut = line.startswith("#### ") or PAGE.match(line)
        if cut and words >= PAGE_WORDS and cur:
            pages.append("\n".join(cur).strip())
            cur, words = [], 0
        cur.append(line)
        words += len(line.split())
    if cur:
        pages.append("\n".join(cur).strip())
    return pages


def write_web_blocks(web: list[dict]):
    """blocs.json: el contingut de cada epígraf per a l'app (scripts/seed.ts), en l'ordre de lectura i paginat."""
    rows, per_ep = [], defaultdict(int)
    order = defaultdict(list)
    for b in web:
        order[b["epigraf"]].append(b)
    for eid, bs in order.items():
        for b in sorted(bs, key=lambda b: ROLE_ORDER[b["part"]]):  # sorted és estable: es manté l'ordre dels documents
            pages = split_pages(b["body"])
            for i, p in enumerate(pages):
                n = per_ep[eid]
                per_ep[eid] += 1
                title = b["title"] + (f" ({i + 1}/{len(pages)})" if len(pages) > 1 else "")
                rows.append({"id": f"{eid}:{n}", "epigraf": eid, "part": b["part"], "sort": n, "title": title,
                             "source": b["source"], "url": b["url"], "body": p})
    (TEMARI / "blocs.json").write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    print(f"blocs.json: {len(rows)} pàgines de contingut per a l'app")


def fmt_words(n: int) -> str:
    return f"{n / 1000:.1f}k".replace(".", ",") if n >= 1000 else str(n)


def write_guide(out: pathlib.Path, temes: dict, index: dict, missing: list):
    """00-GUIA.md: com està fet el temari, índex complet amb les fonts de cada epígraf i buits."""
    eps = index["epigrafs"]
    words = {e: sum(b["words"] for b in v["blocks"]) for e, v in eps.items()}
    by_role = defaultdict(int)
    for v in eps.values():
        for b in v["blocks"]:
            by_role[b["role"]] += b["words"]
    docs_used = {b["doc"] for v in eps.values() for b in v["blocks"] if "doc" in b}
    g = ["# Guia del temari (v2) — OPE Infermeria ICS", "",
         "Temari complet amb el **contingut literal** del material del curs de FUDEN i de la normativa oficial, "
         "reorganitzat segons el temari de la convocatòria 100-2025 (Resolució SLT/2380/2025, annexos 3 i 35.3). "
         "Res no està resumit ni reescrit: cada bloc diu de quin document i pàgines surt. "
         "**Còpia privada** (`data/fuden/` és a `.gitignore`): no es puja a GitHub ni es comparteix.", "",
         f"- {len(temes)} temes oficials i {len(eps)} epígrafs.",
         f"- {len(docs_used)} documents de FUDEN aprofitats; {fmt_words(sum(words.values()))} paraules en total "
         f"({', '.join(f'{ROLE_TITLE[r].lower()}: {fmt_words(n)}' for r, n in sorted(by_role.items(), key=lambda x: ROLE_ORDER[x[0]]))}).",
         f"- Segments del material sense repartir: {len(missing)}.", "",
         "Cada epígraf és un fitxer `guia/<tema>/<epígraf>.md` amb aquestes parts, en aquest ordre: "
         "**Temari** (els temes del curs), **Resums del temari** (els resums que dona el curs), **Material de suport** "
         "(guies, protocols i manuals), **Diapositives de les sessions**, **Normativa** (articles literals) i **Bibliografia**. "
         "`<!-- pàg. N -->` marca on comença cada pàgina de l'original. Es llegeix bé a VS Code (Ctrl+Shift+V) o a Obsidian.", ""]
    analisi = TEMARI / "analisi.md"
    if analisi.exists():
        g += [analisi.read_text(encoding="utf-8").strip(), ""]
    g += ["## Índex del temari", ""]
    for tid, tm in temes.items():
        tw = sum(words[e["id"]] for e in tm["epigrafs"])
        g += [f"### {tid} {tm['titol']} ({fmt_words(tw)} paraules)", "", f"> {tm['oficial']}", ""]
        for e in tm["epigrafs"]:
            v = eps[e["id"]]
            g.append(f"- [**{e['id']}** {e['titol']}]({v['file']}) — {fmt_words(words[e['id']])} paraules")
            fonts = defaultdict(list)
            for b in v["blocks"]:
                key = b["title"] if b["role"] != "normativa" else b["title"].split(" · ")[0]
                fonts[(b["role"], key)].append(b.get("pages") or b["title"].split(" · ", 1)[-1])
            for (role, key), where in sorted(fonts.items(), key=lambda x: ROLE_ORDER[x[0][0]]):
                shown = ", ".join(where[:6]) + (f" (+{len(where) - 6})" if len(where) > 6 else "")
                g.append(f"  - {ROLE_TITLE[role]}: {key} — {shown}")
            if not v["blocks"]:
                g.append("  - ⚠️ Sense material")
        g.append("")
    omits = defaultdict(list)
    for f in sorted((TEMARI / "assign").glob("*.json")):
        for o in load(f).get("omit", []):
            omits[o.get("reason", "")].append(o["segs"])
    g += ["## Material que no forma part del temari", "",
          "- Tests, simulacres, exàmens anteriors i preguntes de WhatsApp: són preguntes (s'associaran al temari a part).",
          "- Documents repetits (el mateix PDF penjat en diverses seccions) i pàgines idèntiques a una altra: només hi surt la primera còpia.",
          f"- Fragments omesos per no tenir contingut docent ({sum(len(v) for v in omits.values())} rangs: portades, índexs, pàgines en blanc…)."]
    (out / "00-GUIA.md").write_text("\n".join(g) + "\n", encoding="utf-8")
    print(f"Guia: {out / '00-GUIA.md'} · {len(eps)} epígrafs · {fmt_words(sum(words.values()))} paraules")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "check":
        # check [doc,doc,...]: només els documents indicats
        check({int(x) for x in sys.argv[2].split(",")} if len(sys.argv) > 2 else None)
    else:
        {"listings": listings, "build": build}[cmd]()
