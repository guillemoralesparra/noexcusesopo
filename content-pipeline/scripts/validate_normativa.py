"""Validate data/sources/*.json produced by split_articles.py.

Usage: python -I scripts/validate_normativa.py
Checks: JSON parses, required fields, chunk ids unique (per file and global) and prefixed
with the slug, no empty texts, and contiguous numbering of articles / disposiciones
(gaps reported). Exit code 1 on hard errors (not on numbering gaps).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "sources"
REQ_DOC = ["slug", "title", "short", "jurisdiction", "language", "url", "consolidated_as_of",
           "fetched", "temario", "chunks"]
REQ_CHUNK = ["id", "unit", "heading", "path", "text"]
SEQ_KINDS = ["art", "da", "dt", "df", "cons"]


def gaps(nums):
    nums = sorted(set(nums))
    out = []
    for a, b in zip(nums, nums[1:]):
        if b - a > 1:
            out.append(f"{a + 1}" if b - a == 2 else f"{a + 1}-{b - 1}")
    return nums, out


def main():
    errors, report = [], []
    all_ids = {}
    index = json.loads((OUT / "index.json").read_text(encoding="utf-8"))
    idx = {e["slug"]: e for e in index}
    files = sorted(p for p in OUT.glob("*.json") if p.name != "index.json")
    for p in files:
        try:
            doc = json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            errors.append(f"{p.name}: does not parse: {e}")
            continue
        slug = doc.get("slug")
        for k in REQ_DOC:
            if k not in doc:
                errors.append(f"{p.name}: missing field {k}")
        if slug != p.stem:
            errors.append(f"{p.name}: slug mismatch {slug}")
        if slug not in idx:
            errors.append(f"{p.name}: not in index.json")
        elif idx[slug]["n_chunks"] != len(doc["chunks"]):
            errors.append(f"{p.name}: index n_chunks {idx[slug]['n_chunks']} != {len(doc['chunks'])}")
        seq = {k: [] for k in SEQ_KINDS}
        long_chunks, short_chunks = [], []
        for c in doc["chunks"]:
            for k in REQ_CHUNK:
                if k not in c:
                    errors.append(f"{p.name}: chunk {c.get('id')} missing {k}")
            cid = c["id"]
            if not cid.startswith(slug + "#"):
                errors.append(f"{p.name}: id {cid} lacks slug prefix")
            if cid in all_ids:
                errors.append(f"duplicate id {cid} ({all_ids[cid]} / {p.name})")
            all_ids[cid] = p.name
            if not c["text"].strip():
                errors.append(f"{p.name}: empty text in {cid}")
            if len(c["text"]) > 25000:
                long_chunks.append(f"{cid.split('#')[1]}({len(c['text'])})")
            if len(c["text"].strip()) < 15:
                short_chunks.append(f"{cid.split('#')[1]}:{c['text'].strip()!r}")
            m = re.fullmatch(r"(art|da|dt|df|cons)-(\d+)(-.*)?", cid.split("#", 1)[1])
            if m:
                seq[m.group(1)].append(int(m.group(2)))
        line = f"{slug}: {len(doc['chunks'])} chunks, lang={doc['language']}, as_of={doc['consolidated_as_of']}"
        details = []
        for k in SEQ_KINDS:
            if seq[k]:
                nums, g = gaps(seq[k])
                start = "" if nums[0] == 1 else f" (starts at {nums[0]})"
                details.append(f"{k} {nums[0]}..{nums[-1]}{start}" + (f" GAPS {g}" if g else ""))
        report.append(line + "\n    " + "; ".join(details))
        if long_chunks:
            report.append(f"    long chunks: {long_chunks}")
        if short_chunks:
            report.append(f"    short chunks ({len(short_chunks)}): {short_chunks[:8]}")
    for s in idx:
        if not (OUT / f"{s}.json").exists():
            errors.append(f"index.json lists {s} but file is missing")
    print("\n".join(report))
    print(f"\n{len(files)} files, {len(all_ids)} chunks total")
    if errors:
        print(f"\n{len(errors)} ERRORS:")
        print("\n".join("  " + e for e in errors))
        sys.exit(1)
    print("OK: no hard errors")


if __name__ == "__main__":
    main()
