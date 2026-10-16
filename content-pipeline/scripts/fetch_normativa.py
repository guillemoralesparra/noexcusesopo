"""Download official legal texts listed in scripts/normativa_sources.json.

Usage: python -I scripts/fetch_normativa.py [--only slug1,slug2] [--force]

Sources:
  boe    -> BOE open data API (consolidated text XML + metadata XML)
  pjc    -> Portal Juridic de Catalunya (ELI page + documentPJC JSON, Catalan, consolidated)
  eurlex -> EUR-Lex HTML (Spanish)

Raw files land in raw/normativa/ and are treated as untrusted data (parsed only).
"""
import json
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "scripts" / "normativa_sources.json"
RAW = ROOT / "raw" / "normativa"
DELAY = 2.0
UA = "Mozilla/5.0 (compatible; ICS-oposicio-corpus/1.0; personal study use)"

BOE_API = "https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/{id}/{part}"
PJC_DOC = "https://portaldogc.gencat.cat/eadop-rest/api/pjc/documentPJC"
PJC_AFF = "https://portaldogc.gencat.cat/eadop-rest/api/pjc/getDocumentAffectations"
EURLEX = "https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:{celex}"


# portaldogc.gencat.cat only negotiates ciphers that OpenSSL 3 rejects at the default
# security level; lower it to SECLEVEL=1 for that host only (certificates still verified).
LEGACY_CTX = ssl.create_default_context()
LEGACY_CTX.set_ciphers("DEFAULT:@SECLEVEL=1")
LEGACY_HOSTS = {"portaldogc.gencat.cat"}


def http(url, data=None, accept=None):
    headers = {"User-Agent": UA}
    if accept:
        headers["Accept"] = accept
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
    req = urllib.request.Request(url, data=body, headers=headers)
    ctx = LEGACY_CTX if urllib.parse.urlparse(url).hostname in LEGACY_HOSTS else None
    with urllib.request.urlopen(req, timeout=90, context=ctx) as r:
        content = r.read()
    time.sleep(DELAY)
    return content


def hidden(html, name):
    m = re.search(r'id="%s"[^>]*value="([^"]*)"' % re.escape(name), html)
    return m.group(1) if m else None


def fetch_boe(src):
    out = {}
    for part in ("metadatos", "texto"):
        content = http(BOE_API.format(id=src["boe_id"], part=part), accept="application/xml")
        if b"<code>200</code>" not in content[:400]:
            raise RuntimeError(f"BOE API {part} returned non-200 status: {content[:300]!r}")
        p = RAW / f"{src['slug']}.boe-{part}.xml"
        p.write_bytes(content)
        out[part] = p.name
    return out


def fetch_pjc(src):
    page = http(src["eli"]).decode("utf-8", "replace")
    (RAW / f"{src['slug']}.eli.html").write_text(page, encoding="utf-8")
    doc_id = hidden(page, "documentIdRequest")
    validity = hidden(page, "validityRequest")
    trace = hidden(page, "traceabilityRequest") or "02"
    if not doc_id or not validity:
        raise RuntimeError("could not find documentId/validity in ELI page")
    content = http(PJC_DOC, data={"documentId": doc_id, "validity": validity,
                                  "traceabilityStandard": trace, "language": "ca"})
    data = json.loads(content.decode("utf-8"))
    # Consolidated norms come as a structured tree (bodyDocument); norms that were never
    # modified only have the published text as one HTML string (textDocument).
    if data.get("bodyDocument"):
        mode = "structured"
    elif data.get("textDocument"):
        mode = "published-html"
    else:
        raise RuntimeError("documentPJC returned neither bodyDocument nor textDocument")
    p = RAW / f"{src['slug']}.pjc-document.json"
    p.write_bytes(content)
    aff = http(PJC_AFF, data={"documentId": doc_id, "validity": validity,
                              "traceabilityStandard": trace, "language": "ca"})
    pa = RAW / f"{src['slug']}.pjc-affectations.json"
    pa.write_bytes(aff)
    return {"eli_page": f"{src['slug']}.eli.html", "document": p.name, "affectations": pa.name,
            "mode": mode, "documentId": doc_id, "validity": validity, "traceability": trace}


def fetch_eurlex(src):
    content = http(EURLEX.format(celex=src["celex"]))
    if b"eli-subdivision" not in content:
        raise RuntimeError("EUR-Lex page has no ELI subdivisions (blocked or changed format?)")
    p = RAW / f"{src['slug']}.eurlex.html"
    p.write_bytes(content)
    return {"html": p.name}


FETCHERS = {"boe": fetch_boe, "pjc": fetch_pjc, "eurlex": fetch_eurlex}


def main():
    args = sys.argv[1:]
    only = None
    if "--only" in args:
        only = set(args[args.index("--only") + 1].split(","))
    force = "--force" in args
    RAW.mkdir(parents=True, exist_ok=True)
    log_path = RAW / "fetch_log.json"
    log = json.loads(log_path.read_text(encoding="utf-8")) if log_path.exists() else {}
    for src in json.loads(REGISTRY.read_text(encoding="utf-8")):
        slug = src["slug"]
        if only and slug not in only:
            continue
        if not force and log.get(slug, {}).get("ok"):
            print(f"skip {slug} (already fetched)")
            continue
        print(f"fetch {slug} [{src['source']}] ...", flush=True)
        try:
            files = FETCHERS[src["source"]](src)
            log[slug] = {"ok": True, "fetched": time.strftime("%Y-%m-%d"), "files": files}
            print(f"  ok {files}")
        except Exception as e:  # report and continue with the next norm
            log[slug] = {"ok": False, "fetched": time.strftime("%Y-%m-%d"), "error": f"{type(e).__name__}: {e}"}
            print(f"  FAILED {e}")
        log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
