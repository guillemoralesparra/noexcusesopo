"""Split the raw legal texts in raw/normativa/ into article-level chunks.

Usage: python -I scripts/split_articles.py [--only slug1,slug2]

Reads scripts/normativa_sources.json + raw/normativa/fetch_log.json and writes
data/sources/{slug}.json and data/sources/index.json. Raw files are parsed as data only.
"""
import html
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "scripts" / "normativa_sources.json"
RAW = ROOT / "raw" / "normativa"
OUT = ROOT / "data" / "sources"
TODAY = date.today().strftime("%Y%m%d")


# ---------------------------------------------------------------- numbers / ids

def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _es_cardinals():
    units = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]
    teens = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete",
             "dieciocho", "diecinueve"]
    tens = {3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta",
            8: "ochenta", 9: "noventa"}
    d = {}
    for n in range(1, 200):
        h, r = divmod(n, 100)
        if r == 0:
            w = ""
        elif r < 10:
            w = units[r]
        elif r < 20:
            w = teens[r - 10]
        elif r == 20:
            w = "veinte"
        elif r < 30:
            w = "veinti" + units[r - 20]
        else:
            t, u = divmod(r, 10)
            w = tens[t] + (" y " + units[u] if u else "")
        if h:
            w = ("cien" if r == 0 else "ciento " + w)
        d[w.replace(" ", "")] = n
    return d


def _es_ordinals():
    stems = ["primer", "segund", "tercer", "cuart", "quint", "sext", "septim", "octav", "noven"]
    tens = {1: "decim", 2: "vigesim", 3: "trigesim", 4: "cuadragesim", 5: "quincuagesim"}
    d = {}
    for g in "oa":
        for i, s in enumerate(stems, 1):
            d[s + g] = i
        d["setim" + g] = 7
        d["undecim" + g] = 11
        d["duodecim" + g] = 12
        for t, tp in tens.items():
            d[tp + g] = t * 10
            for g2 in "oa":
                for i, s in enumerate(stems, 1):
                    d[tp + g2 + s + g] = t * 10 + i
    return d


CA_ORD = {"primera": 1, "primer": 1, "segona": 2, "segon": 2, "tercera": 3, "tercer": 3,
          "quarta": 4, "quart": 4, "cinquena": 5, "cinque": 5, "sisena": 6, "setena": 7,
          "vuitena": 8, "novena": 9, "desena": 10, "onzena": 11, "dotzena": 12, "tretzena": 13,
          "catorzena": 14, "quinzena": 15, "setzena": 16, "dissetena": 17, "divuitena": 18,
          "dinovena": 19, "vintena": 20, "trentena": 30}
_ca_units = {"unena": 1, "dosena": 2, "tresena": 3, "quatrena": 4, "cinquena": 5, "sisena": 6,
             "setena": 7, "vuitena": 8, "novena": 9}
for _u, _n in _ca_units.items():
    CA_ORD["vintiu" + _u[1:] if _u == "unena" else "vinti" + _u] = 20 + _n
    CA_ORD["trentau" + _u[1:] if _u == "unena" else "trenta" + _u] = 30 + _n

ES_CARD = _es_cardinals()
ES_ORD = _es_ordinals()
SUFFIXES = ("bis", "ter", "quater", "quinquies", "sexies", "septies", "octies", "nonies", "decies")


def parse_number(s):
    """'10 bis' / 'veintiuno' / 'decimoctava' / 'Vint-i-unena' / 'única' -> '10-bis' / '21' / ..."""
    s0 = strip_accents(s).lower().strip().rstrip(".")
    suffix = ""
    m = re.search(r"\s+(%s)$" % "|".join(SUFFIXES), s0)
    if m:
        suffix = "-" + m.group(1)
        s0 = s0[:m.start()]
    m = re.match(r"^(\d+)(?:\s*\.)?\s*([a-z]*)$", s0)
    if m:
        extra = "-" + m.group(2) if m.group(2) else ""
        return m.group(1) + extra + suffix
    key = re.sub(r"[\s\-]", "", s0)
    if key in ("unico", "unica", "unic"):
        return "unica" + suffix if key == "unica" else "unico" + suffix
    for table in (ES_CARD, ES_ORD, CA_ORD):
        if key in table:
            return str(table[key]) + suffix
    if key == "ciento":  # BOE writes "Artículo ciento" for art. 100 of the LGS
        return "100" + suffix
    if key == "decimoctavo" or key == "decimoctava":
        return "18" + suffix
    return None


ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}


def roman(s):
    total, prev = 0, 0
    for ch in reversed(s.upper()):
        v = ROMAN.get(ch)
        if v is None:
            return None
        total = total - v if v < prev else total + v
        prev = max(prev, v)
    return total


DISP_KIND = [
    (r"^disposici[oó]n(?:es)? adicional(?:es)?|^disposici[oó] addicional|^disposicions addicionals", "da"),
    (r"^disposici[oó]n(?:es)? transitori[ao]s?|^disposici[oó] transit[oò]ri[ae]s?|^disposicions transit[oò]ries", "dt"),
    (r"^disposici[oó]n(?:es)? derogatori[ao]s?|^disposici[oó] derogat[oò]ri[ae]s?|^disposicions derogat[oò]ries", "dd"),
    (r"^disposici[oó]n(?:es)? finale?s?|^disposici[oó] final|^disposicions finals", "df"),
]


def unit_key(unit):
    """Map a unit label to (kind, number-string or None)."""
    u = re.sub(r"\s+", " ", unit.replace("\xa0", " ")).strip()
    low = u.lower()
    m = re.match(r"^(?:art[ií]culo|article)\s+(.+)$", low)
    if m:
        return "art", parse_number(m.group(1))
    for rx, kind in DISP_KIND:
        m = re.match(rx, low)
        if m:
            rest = low[m.end():].strip()
            return kind, (parse_number(rest) if rest else None)
    m = re.match(r"^(anexo|annex|annexo)\s*(.*)$", low)
    if m:
        rest = m.group(2).strip()
        if not rest:
            return "annex", None
        n = roman(rest) if re.fullmatch(r"[ivxlc]+", rest) else None
        return "annex", str(n) if n else parse_number(rest)
    m = re.match(r"^considerando\s+(\d+)$", low)
    if m:
        return "cons", m.group(1)
    if low.startswith(("preámbulo", "preambulo", "preàmbul", "preambul")):
        return "preambulo", None
    return None, None


def make_id(slug, unit, prefix=""):
    kind, num = unit_key(unit)
    if kind is None:
        local = re.sub(r"[^a-z0-9]+", "-", strip_accents(unit).lower()).strip("-")
    elif num is None:
        local = kind
    else:
        local = f"{kind}-{num}"
    return f"{slug}#{prefix}{local}"


STUB_RX = re.compile(r"^\(?(derogad[oa]s?|derogat(s|des)?|sense contingut|anulad[oa]|no vigent|sin efecto|suprimid[oa])\)?\.?$", re.I)


def clean_ws(s):
    s = s.replace("\xa0", " ").replace("​", "")
    return re.sub(r"\s+", " ", s).strip()


def join_lines(lines):
    return "\n".join(l for l in (clean_ws(x) for x in lines) if l)


# ---------------------------------------------------------------- BOE

def boe_version(bloque):
    versions = bloque.findall("version")
    if not versions:
        return None, False
    current = [v for v in versions if (v.get("fecha_vigencia") or "0") <= TODAY]
    chosen = current[-1] if current else versions[-1]
    pending = len(current) < len(versions)
    return chosen, pending


def el_text(e):
    return clean_ws("".join(e.itertext()))


def boe_content(version):
    """Return (lines, heading_lines_by_class, notes) for a <version> element."""
    lines, notes, heads = [], [], []
    for child in version:
        tag = child.tag
        if tag == "p":
            cls = child.get("class", "")
            t = el_text(child)
            if not t:
                if child.find(".//img") is not None:
                    lines.append(("imagen", "[Imagen]"))
                continue
            heads.append((cls, t))
            lines.append((cls, t))
        elif tag == "blockquote":
            for p in child.iter("p"):
                t = el_text(p)
                if t:
                    notes.append(t)
            if not list(child.iter("p")):
                t = el_text(child)
                if t:
                    notes.append(t)
        elif tag == "table":
            for tr in child.iter("tr"):
                cells = [el_text(td) for td in tr if td.tag in ("td", "th")]
                row = " | ".join(c for c in cells if c)
                if row:
                    lines.append(("tabla", row))
        elif tag in ("img",):
            lines.append(("imagen", "[Imagen]"))
        else:
            t = el_text(child)
            if t:
                lines.append((child.get("class", tag), t))
    return lines, notes


HEADING_CLASSES = {"titulo_num", "titulo_tit", "capitulo_num", "capitulo_tit", "seccion",
                   "subseccion", "libro_num", "libro_tit", "titulo", "capitulo", "anexo",
                   "anexo_num", "anexo_tit", "centro_redonda", "centro_negrita"}
LEVELS = [("libro", 0), ("parte", 0), ("título", 1), ("titulo", 1), ("capítulo", 2),
          ("capitulo", 2), ("subsección", 4), ("subseccion", 4), ("sección", 3), ("seccion", 3)]


def split_boe(src, log):
    files = log["files"]
    meta = ET.parse(RAW / files["metadatos"]).getroot().find("data/metadatos")
    texto = ET.parse(RAW / files["texto"]).getroot().find("data/texto")
    slug = src["slug"]
    title = clean_ws(meta.findtext("titulo"))
    blocks = list(texto.findall("bloque"))
    ids = [b.get("id") for b in blocks]
    wrapper_until = ids.index("texto") if "texto" in ids else None

    chunks, warnings = [], []
    path = [None] * 5
    root = None
    pending_any = []
    expired = []
    initial_notes = []
    last_pub = "0"
    for i, b in enumerate(blocks):
        tipo, titulo = b.get("tipo"), (b.get("titulo") or "").strip()
        cad = b.get("fecha_caducidad")
        if cad and cad <= TODAY:  # block no longer displayed in the consolidated text
            expired.append(titulo or b.get("id"))
            continue
        v, pending = boe_version(b)
        if v is None:
            continue
        pending_info = None
        if pending:
            pending_any.append(titulo or b.get("id"))
            fut = b.findall("version")[-1]
            fl, _ = boe_content(fut)
            fv = fut.get("fecha_vigencia")
            pending_info = {"vigencia_from": f"{fv[:4]}-{fv[4:6]}-{fv[6:8]}", "id_norma": fut.get("id_norma"),
                            "text": join_lines(t for c, t in fl if c != "articulo")}
        last_pub = max(last_pub, v.get("fecha_publicacion") or "0")
        lines, notes = boe_content(v)
        prefix = "rdl-" if wrapper_until is not None and i < wrapper_until else ""
        if tipo == "firma":
            continue
        if tipo == "nota_inicial":
            initial_notes.extend(t for _, t in lines)
            initial_notes.extend(notes)
            continue
        if tipo == "preambulo":
            text = join_lines(t for _, t in lines)
            chunks.append({"id": f"{slug}#preambulo", "unit": "Preámbulo", "heading": "",
                           "path": "", "text": text})
            continue
        if tipo == "encabezado":
            head = [t for c, t in lines if c in HEADING_CLASSES]
            body = [t for c, t in lines if c not in HEADING_CLASSES]
            low = titulo.lower()
            if b.get("id") == "texto":
                root = " ".join(head) or titulo
                path = [None] * 5
                continue
            if body and len(body) == 1 and STUB_RX.match(body[0]):
                head = head + [body[0]]
                body = []
            if low.startswith("anexo") or body:
                unit = titulo.title() if titulo.isupper() else titulo
                heading = " ".join(h for h in head if h.lower() != titulo.lower())
                chunks.append({"id": make_id(slug, titulo, prefix), "unit": unit, "heading": heading,
                               "path": root or "", "text": join_lines(body) or heading or unit,
                               **({"notes": notes} if notes else {})})
                continue
            level = next((lv for k, lv in LEVELS if low.startswith(k)), 1)
            path[level] = ". ".join(head) if head else titulo
            for j in range(level + 1, 5):
                path[j] = None
            continue
        # precepto
        kind, _ = unit_key(titulo)
        heading, body = "", []
        for c, t in lines:
            if c == "articulo" and not heading and not body:
                h = t
                if strip_accents(h.lower()).startswith(strip_accents(titulo.lower())):
                    h = h[len(titulo):]
                heading = h.strip(" .")
            else:
                body.append(t)
        text = join_lines(body) or heading
        if kind == "art" or kind is None:
            p = " > ".join(x for x in ([root] if root else []) + [x for x in path if x])
        else:
            p = root or ""
            path = [None] * 5
        if kind == "annex":
            p = root or ""
        chunks.append({"id": make_id(slug, titulo, prefix), "unit": titulo, "heading": heading,
                       "path": p, "text": text, **({"notes": notes} if notes else {}),
                       **({"pending_version": pending_info} if pending_info else {})})
    if expired:
        warnings.append(f"skipped {len(expired)} expired blocks (fecha_caducidad): {expired[:12]}")
    if pending_any:
        warnings.append(f"versions with future fecha_vigencia ignored in: {pending_any[:10]}")
    upd = meta.findtext("fecha_actualizacion") or ""
    as_of = f"{last_pub[:4]}-{last_pub[4:6]}-{last_pub[6:8]}" if last_pub != "0" else None
    info = {
        "title": title,
        "language": "es",
        "url": meta.findtext("url_html_consolidada") or f"https://www.boe.es/buscar/act.php?id={src['boe_id']}",
        "consolidated_as_of": as_of,
        "source_note": (f"BOE texto consolidado ({src['boe_id']}); estado consolidación: "
                        f"{meta.findtext('estado_consolidacion')}; registro actualizado {upd[:8]}; "
                        f"consolidated_as_of = publicación de la última modificación incorporada. "
                        "Las notas editoriales del BOE van en 'notes', fuera de 'text'."
                        + (" Nota inicial BOE: " + " ".join(initial_notes) if initial_notes else "")),
    }
    return info, chunks, warnings


# ---------------------------------------------------------------- PJC (Portal Juridic)

def html_to_text(s):
    if not s:
        return ""
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", "", s)
    s = re.sub(r"(?i)<br\s*/?>", "\n", s)

    def row(m):  # one table row -> one line, cells separated by " | "
        cells = re.findall(r"(?is)<t[dh][^>]*>(.*?)</t[dh]>", m.group(0))
        cells = [clean_ws(html.unescape(re.sub(r"<[^>]+>", " ", c))) for c in cells]
        return "\n" + " | ".join(c for c in cells if c).replace("<", "&lt;") + "\n"
    s = re.sub(r"(?is)<tr[^>]*>.*?</tr>", row, s)
    s = re.sub(r"(?i)</t[dh]>", " | ", s)
    s = re.sub(r"(?i)</(p|div|li|tr|h\d|table|ul|ol)>", "\n", s)
    s = re.sub(r"(?i)<(p|div|li|tr|h\d|table)(\s[^>]*)?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    lines = []
    for line in s.split("\n"):
        line = clean_ws(line).strip(" |").strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


STRUCT_RX = re.compile(r"^(t[ií]tol|cap[ií]tol|secci[oó]|subsecci[oó]|llibre|part)\b", re.I)
GROUP_RX = re.compile(r"^disposicions\s", re.I)


def pjc_strip_range(desc, children):
    desc = clean_ws(desc or "")
    if children:
        first = clean_ws(children[0]["title"])
        last = clean_ws(children[-1]["title"])
        for suf in (f"{first} - {last}", first):
            if desc.endswith(suf):
                return desc[: -len(suf)].strip()
    return desc


def pjc_unit_label(title):
    t = clean_ws(title)
    m = re.match(r"^(Disposici[oó] \w+)\s+(.*)$", t, re.I)
    if m:  # 'Disposició addicional Primera' -> 'Disposició addicional primera'
        return m.group(1)[0].upper() + m.group(1)[1:].lower() + " " + m.group(2).lower()
    if re.match(r"^Disposici[oó] \w+$", t, re.I):
        return t[0].upper() + t[1:].lower()
    return t


def split_pjc_tree(src, data):
    slug = src["slug"]
    chunks, warnings = [], []

    def walk(nodes, path):
        for n in nodes:
            title = clean_ws(n.get("title") or "")
            children = n.get("children") or []
            text = html_to_text(n.get("text") or "")
            if children:
                if STRUCT_RX.match(title):
                    seg = title
                    d = pjc_strip_range(n.get("description"), children)
                    if d:
                        seg += ". " + d
                    walk(children, path + [seg])
                elif GROUP_RX.match(title):
                    walk(children, [])
                else:
                    warnings.append(f"unknown container '{title}', walked as group")
                    walk(children, path)
                if len(text) > 40:
                    warnings.append(f"container '{title}' has own text ({len(text)} chars) not chunked")
                continue
            unit = pjc_unit_label(title)
            if unit.lower().startswith("preàmbul") or unit.lower().startswith("preambul"):
                unit = "Preàmbul"
            kind, _ = unit_key(unit)
            chunks.append({"id": make_id(slug, unit), "unit": unit,
                           "heading": clean_ws(n.get("description") or ""),
                           "path": " > ".join(path) if kind in ("art", None) else "",
                           "text": text})

    walk(data["bodyDocument"], [])
    return chunks, warnings


DOGC_STRUCT = re.compile(r"^(T[ií]tol|Cap[ií]tol|Secci[oó])\s+\S+$")
DOGC_GROUP = re.compile(r"^Disposicions (addicionals|transit[oò]ries|derogat[oò]ries|finals)$")
DOGC_SINGLE = re.compile(r"^Disposici[oó] (addicional|transit[oò]ria|derogat[oò]ria|final)( \S+)?$")
DOGC_ART = re.compile(r"^Article (\d+(?: bis| ter)?|únic)$")
CA_ORD_WORDS = {k.capitalize() for k in CA_ORD} | {"Única"}


def looks_heading(p):
    return len(p) < 160 and not p.rstrip().endswith((".", ":", ";")) and not re.match(r"^[a-z0-9]{1,3}[\).]", p)


def split_dogc_html(src, data):
    """Published (never consolidated) DOGC text as one HTML blob, e.g. Decret 13/2009."""
    slug = src["slug"]
    raw = data["textDocument"]
    paras = [clean_ws(html.unescape(re.sub(r"<[^>]+>", "", p))) for p in re.split(r"(?i)</p>", raw)]
    paras = [p for p in paras if p and p != "\xa0"]
    chunks, warnings = [], []
    cur = None
    group = None
    root = ""
    path = {}
    preamble = []
    state = "preamble"
    i = 0

    def close():
        nonlocal cur
        if cur:
            cur["text"] = "\n".join(cur.pop("_lines"))
            chunks.append(cur)
        cur = None

    def start(unit, kind_path):
        nonlocal cur
        close()
        cur = {"id": make_id(slug, unit), "unit": unit, "heading": "", "path": kind_path, "_lines": []}

    while i < len(paras):
        p = paras[i]
        nxt = paras[i + 1] if i + 1 < len(paras) else ""
        if state == "preamble":
            if DOGC_ART.match(p) or DOGC_GROUP.match(p):
                chunks.append({"id": f"{slug}#preambulo", "unit": "Preàmbul", "heading": "",
                               "path": "", "text": "\n".join(preamble)})
                state = "body"
                continue
            preamble.append(p)
            i += 1
            continue
        if re.match(r"^\(\d{2}\.\d{3}\.\d{3}\)$", p):  # DOGC control number
            i += 1
            continue
        if re.match(r"^Barcelona, \d+ de \w+ de \d{4}$", p):
            close()
            state = "signature"
            i += 1
            continue
        if state == "signature":
            if p == "Annex":
                state = "body"
                root = "Annex"
                if nxt and looks_heading(nxt):
                    root = f"Annex. {nxt}"
                    i += 1
                path = {}
                group = None
            i += 1
            continue
        if p == "Annex":
            close()
            root = f"Annex. {nxt}" if nxt and looks_heading(nxt) else "Annex"
            i += 2 if root != "Annex" else 1
            path, group = {}, None
            continue
        m = DOGC_STRUCT.match(p)
        if m and looks_heading(nxt):
            close()
            level = {"t": 1, "c": 2, "s": 3}[strip_accents(m.group(1))[0].lower()]
            path[level] = f"{p}. {nxt}"
            for k in list(path):
                if k > level:
                    del path[k]
            group = None
            i += 2
            continue
        if DOGC_ART.match(p):
            group = None
            start(p, " > ".join([root] * bool(root) + [path[k] for k in sorted(path)]))
            if looks_heading(nxt) and not DOGC_ART.match(nxt):
                cur["heading"] = nxt
                i += 1
            i += 1
            continue
        mg = DOGC_GROUP.match(p)
        if mg:
            close()
            group = {"addicionals": "Disposició addicional", "finals": "Disposició final"}.get(
                mg.group(1), "Disposició transitòria" if mg.group(1).startswith("transit") else "Disposició derogatòria")
            i += 1
            continue
        if DOGC_SINGLE.match(p):
            close()
            group = None
            start(p, root)
            if looks_heading(nxt):
                cur["heading"] = nxt
                i += 1
            i += 1
            continue
        if group and p in CA_ORD_WORDS:
            start(f"{group} {p.lower()}", root)
            if looks_heading(nxt):
                cur["heading"] = nxt
                i += 1
            i += 1
            continue
        if cur is None:
            warnings.append(f"orphan paragraph skipped: {p[:80]}")
        else:
            cur["_lines"].append(p)
        i += 1
    close()
    return chunks, warnings


def split_pjc(src, log):
    files = log["files"]
    data = json.loads((RAW / files["document"]).read_text(encoding="utf-8"))
    page = (RAW / files["eli_page"]).read_text(encoding="utf-8")
    m = re.search(r'ontology#version_date" content="([^"]*)"', page)
    vdate = m.group(1) if m and m.group(1) else None
    if files.get("mode") == "published-html":
        chunks, warnings = split_dogc_html(src, data)
        dd = data.get("documentData") or {}
        note = (f"Portal Jurídic de Catalunya: només text publicat (DOGC {dd.get('numOfficialDiary')}, "
                f"{dd.get('datePublicationDiary')}); no hi ha text consolidat.")
        aff = json.loads((RAW / files["affectations"]).read_text(encoding="utf-8"))
        npass = aff["affectations"]["passiveAffectations"]["numPassiveAffectations"]
        note += f" Afectacions passives registrades: {npass}."
        if npass == 0 and dd.get("datePublicationDiary"):
            d, mth, y = dd["datePublicationDiary"].split("/")
            vdate = f"{y}-{mth}-{d}"
    else:
        chunks, warnings = split_pjc_tree(src, data)
        note = ("Portal Jurídic de Catalunya, text consolidat en català (versió vigent, "
                f"documentId {files['documentId']}, versió {files['validity']}). "
                "Els textos consolidats del Portal Jurídic no tenen caràcter oficial.")
    title = clean_ws(re.sub(r"<[^>]+>", "", data.get("titleDocument") or "")).rstrip(".")
    info = {"title": title, "language": "ca", "url": src["eli"], "consolidated_as_of": vdate,
            "source_note": note}
    return info, chunks, warnings


# ---------------------------------------------------------------- EUR-Lex

VOID = {"br", "img", "hr", "meta", "link", "input", "col", "area", "base", "wbr", "source"}


class Node:
    __slots__ = ("tag", "attrs", "children", "parent")

    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.children, self.parent = tag, dict(attrs), [], parent


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", [], None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def find_all(node, pred):
    for c in node.children:
        if isinstance(c, Node):
            if pred(c):
                yield c
            yield from find_all(c, pred)


def node_lines(node, skip=lambda n: False):
    """Block-aware text: p/div/tr produce lines, td cells are joined with spaces."""
    lines, buf = [], []
    depth = [0]

    def flush():
        if depth[0]:
            buf.append(" ")
            return
        t = clean_ws("".join(buf))
        if t:
            lines.append(t)
        buf.clear()

    def rec(n):
        for c in n.children:
            if isinstance(c, str):
                buf.append(c)
            elif skip(c):
                continue
            elif c.tag in ("p", "div", "tr", "table", "li", "h1", "h2", "h3"):
                flush()
                rec(c)
                flush()
            elif c.tag in ("td", "th"):
                depth[0] += 1
                rec(c)
                depth[0] -= 1
                buf.append(" ")
            elif c.tag == "br":
                flush()
            else:
                rec(c)
    rec(node)
    flush()
    return lines


def split_eurlex(src, log):
    raw = (RAW / log["files"]["html"]).read_text(encoding="utf-8")
    tb = TreeBuilder()
    tb.feed(raw)
    slug = src["slug"]
    by_id = {n.attrs["id"]: n for n in find_all(tb.root, lambda n: "id" in n.attrs)}
    chunks, warnings = [], []
    title_node = next(find_all(tb.root, lambda n: n.attrs.get("class") == "eli-main-title"), None)
    title = " ".join(node_lines(title_node)) if title_node else "Reglamento (UE) 2016/679"

    pbl = by_id.get("pbl_1")
    if pbl is not None:
        pre = node_lines(pbl, skip=lambda n: n.attrs.get("id", "").startswith("rct_"))
        chunks.append({"id": f"{slug}#preambulo", "unit": "Preámbulo (vistos)", "heading": "",
                       "path": "", "text": "\n".join(pre)})
    for n in find_all(tb.root, lambda n: re.fullmatch(r"rct_\d+", n.attrs.get("id", ""))):
        k = n.attrs["id"].split("_")[1]
        lines = node_lines(n)
        if lines and re.fullmatch(r"\(\d+\)", lines[0]):
            lines = lines[1:]
        txt = "\n".join(lines)
        txt = re.sub(r"^\(\d+\)\s*", "", txt)
        chunks.append({"id": f"{slug}#cons-{k}", "unit": f"Considerando {k}", "heading": "",
                       "path": "Considerandos", "text": txt})

    def heading_of(div):
        parts = []
        for c in div.children:
            if isinstance(c, Node) and c.tag == "p" and "oj-ti-section-1" in c.attrs.get("class", ""):
                parts.append(" ".join(node_lines(c)))
            if isinstance(c, Node) and c.attrs.get("class") == "eli-title":
                parts.append(" ".join(node_lines(c)))
        return ". ".join(parts)

    for art in find_all(tb.root, lambda n: re.fullmatch(r"art_\d+", n.attrs.get("id", ""))):
        num = art.attrs["id"].split("_")[1]
        unit = heading = ""
        for c in art.children:
            if isinstance(c, Node):
                cls = c.attrs.get("class", "")
                if cls == "oj-ti-art":
                    unit = " ".join(node_lines(c))
                elif cls == "eli-title":
                    heading = " ".join(node_lines(c))
        body = node_lines(art, skip=lambda n: n.attrs.get("class") in ("oj-ti-art", "eli-title"))
        path, p = [], art.parent
        while p is not None and p.tag != "root":
            pid = p.attrs.get("id", "")
            if re.match(r"^cpt_[^.]+(\.sct_\d+)?$", pid):
                path.insert(0, heading_of(p))
            p = p.parent
        chunks.append({"id": f"{slug}#art-{num}", "unit": unit or f"Artículo {num}", "heading": heading,
                       "path": " > ".join(x for x in path if x), "text": "\n".join(body)})
    title = re.sub(r"\s*\(Texto pertinente a efectos del EEE\)\s*$", "", title)
    info = {"title": title.rstrip("."), "language": "es",
            "url": f"https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:{src['celex']}",
            "consolidated_as_of": None,
            "source_note": ("EUR-Lex, texto publicado en el DOUE L 119 de 4.5.2016 (versión original, "
                            "sin integrar la corrección de errores del DOUE L 127 de 23.5.2018). "
                            "Considerandos como chunks individuales; notas al pie y firma omitidas.")}
    return info, chunks, warnings


# ---------------------------------------------------------------- main

SPLITTERS = {"boe": split_boe, "pjc": split_pjc, "eurlex": split_eurlex}




def dedupe(chunks, warnings):
    """Drop repealed stubs that collide with a live unit of the same number (e.g. renumbered
    LGS arts. 106-113), then suffix any remaining duplicate ids."""
    by_id = {}
    for c in chunks:
        by_id.setdefault(c["id"], []).append(c)
    drop = set()
    for cid, group in by_id.items():
        if len(group) > 1:
            live = [c for c in group if not STUB_RX.match(c["text"].strip())]
            if live and len(live) < len(group):
                for c in group:
                    if c not in live:
                        drop.add(id(c))
                warnings.append(f"dropped {len(group) - len(live)} repealed stub(s) for {cid}")
    chunks[:] = [c for c in chunks if id(c) not in drop]
    seen = {}
    for c in chunks:
        base = c["id"]
        if base in seen:
            seen[base] += 1
            c["id"] = f"{base}-{seen[base]}"
            warnings.append(f"duplicate id {base} -> {c['id']}")
        else:
            seen[base] = 1


def main():
    args = sys.argv[1:]
    only = set(args[args.index("--only") + 1].split(",")) if "--only" in args else None
    OUT.mkdir(parents=True, exist_ok=True)
    log = json.loads((RAW / "fetch_log.json").read_text(encoding="utf-8"))
    index_path = OUT / "index.json"
    index = {e["slug"]: e for e in json.loads(index_path.read_text(encoding="utf-8"))} if index_path.exists() else {}
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    for src in registry:
        slug = src["slug"]
        if only and slug not in only:
            continue
        entry = log.get(slug)
        if not entry or not entry.get("ok"):
            print(f"{slug}: not fetched ({entry.get('error') if entry else 'missing'})")
            index.pop(slug, None)
            continue
        info, chunks, warnings = SPLITTERS[src["source"]](src, entry)
        dedupe(chunks, warnings)
        doc = {"slug": slug, "title": info["title"], "short": src["short"],
               "jurisdiction": src["jurisdiction"], "language": info["language"], "url": info["url"],
               "consolidated_as_of": info["consolidated_as_of"], "fetched": entry["fetched"],
               "temario": src["temario"], "source_note": info.get("source_note", ""), "chunks": chunks}
        (OUT / f"{slug}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
        index[slug] = {"slug": slug, "title": info["title"], "short": src["short"], "url": info["url"],
                       "language": info["language"], "jurisdiction": src["jurisdiction"],
                       "consolidated_as_of": info["consolidated_as_of"], "n_chunks": len(chunks),
                       "temario": src["temario"]}
        print(f"{slug}: {len(chunks)} chunks" + (f"  [{len(warnings)} warnings]" if warnings else ""))
        for w in warnings[:15]:
            print("   !", w)
    order = [s["slug"] for s in registry]
    out = [index[s] for s in order if s in index]
    index_path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
