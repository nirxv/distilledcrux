"""Batches for checking every register row against the book corpus (VERIFY-BRIEF.md).

For each row of register/<optional>.csv, find the passages of that optional's books
most likely to state it: BM25 over book_chunks_v2 with the row's names and its
thinker's, kept to passages that write one of the row's names and, for a dated row,
its year (or, for an undated work or concept, its thinker's surname). Passages tagged
with the row's id come first.

    python3 scripts/rag/make_verify_batches.py                 -> work/verify/v01.txt ... + index.json
    python3 scripts/rag/make_verify_batches.py --rows a,b,c    -> work/verify2/ (second pass, wider context)
"""
from __future__ import annotations

import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from qdrant_io import WORK, qdrant
from sparse import query_vector

HERE = Path(__file__).resolve().parent
REG = HERE / "register"
SUBJECTS = ["sociology", "anthropology", "polsci", "geography", "pub-admin"]
PER_BATCH = 30
WINDOW = 1400


def fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def names(r: dict) -> list[str]:
    out = [r["name"], *[a for a in r["aliases"].split("|") if a.strip()]]
    return sorted({fold(a.strip()) for a in out if len(re.sub(r"[^A-Za-z]", "", a)) >= 4}, key=len, reverse=True)


def years(r: dict) -> list[int]:
    out = []
    for f in ("start", "end"):
        v = r[f].strip()
        if v and not v.upper().endswith(("BCE", "BC")):
            out.append(int(v.split("-")[0]))
    return out


def window(text: str, pats: list[re.Pattern]) -> str:
    """The passage, cut around its first match when it is long."""
    if len(text) <= WINDOW:
        return text
    pos = min((m.start() for p in pats if (m := p.search(text))), default=0)
    lo = max(0, pos - WINDOW // 2)
    return ("…" if lo else "") + text[lo:lo + WINDOW] + ("…" if lo + WINDOW < len(text) else "")


def claims(r: dict, by_id: dict) -> str:
    t = by_id.get(r["thinker"])
    if r["kind"] == "thinker":
        return f"life: {r['start'] or '?'}–{r['end'] or '?'}" if r["start"] else "(no dates in the row; check the name only)"
    if r["kind"] in ("work", "concept"):
        parts = [f"by: {t['name']}" if t else "by: (no thinker)"]
        if r["start"]:
            parts.append(f"{'published' if r['kind'] == 'work' else 'introduced'}: {r['start']}")
        return "; ".join(parts)
    return f"date: {r['start']}" + (f" to {r['end']}" if r["end"] else "")


def main() -> None:
    only = set(sys.argv[sys.argv.index("--rows") + 1].split(",")) if "--rows" in sys.argv else None
    second = only is not None
    per_row = 8 if second else 5
    passages = {}
    for line in open(WORK / "passages.jsonl", encoding="utf-8"):
        p = json.loads(line)
        passages[p["id"]] = p
    tagged: dict[tuple[str, str], list[int]] = defaultdict(list)
    for f in (WORK / "tags").glob("b*.jsonl"):
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.strip():
                t = json.loads(line)
                s = passages.get(t["id"], {}).get("subject")
                for ref in t["r"]:
                    tagged[(s, ref)].append(t["id"])

    rows = []
    for s in SUBJECTS:
        reg = list(csv.DictReader(open(REG / f"{s}.csv", encoding="utf-8")))
        by_id = {r["id"]: r for r in reg}
        for r in reg:
            if only is None or f"{s}:{r['id']}" in only or r["id"] in only:
                rows.append((s, r, by_id))

    def bm25(item):
        s, r, by_id = item
        t = by_id.get(r["thinker"])
        text = " ".join([r["name"], r["aliases"].replace("|", " "), t["name"] if t else "", r["start"][:4]])
        body = {"query": query_vector(text), "using": "bm25", "limit": 80, "with_payload": False,
                "filter": {"must": [{"key": "subject", "match": {"value": s}}]}}
        return [p["id"] for p in qdrant("POST", "/collections/book_chunks_v2/points/query", body)["result"]["points"]]

    with ThreadPoolExecutor(max_workers=4) as pool:
        ranked = list(pool.map(bm25, rows))

    out_dir = WORK / ("verify2" if second else "verify")
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("v*.txt"):
        old.unlink()
    blocks, meta, keys = [], {}, []
    for (s, r, by_id), hits in zip(rows, ranked):
        key = f"{s}:{r['id']}"
        t = by_id.get(r["thinker"])
        name_pats = [re.compile(rf"(?<![a-z]){re.escape(n)}(?![a-z])") for n in names(r)]
        ys = years(r)
        year_pats = [re.compile(rf"(?<![\d]){y}(?![\d])") for y in ys]
        surname = fold(t["name"]).split()[-1] if t else ""
        def ok(pid: int) -> bool:
            txt = fold(passages[pid]["text"])
            if not any(p.search(txt) for p in name_pats):
                return False
            if ys:
                return any(p.search(txt) for p in year_pats)
            return not surname or surname in txt
        cands = list(dict.fromkeys(tagged.get((s, r["id"]), []) + hits))
        picks, books = [], defaultdict(int)
        for pid in cands:
            if pid not in passages or not ok(pid):
                continue
            b = passages[pid]["book_title"]
            if books[b] >= 2:
                continue
            books[b] += 1
            picks.append(pid)
            if len(picks) >= per_row:
                break
        lines = [f"### ROW {key}",
                 f"kind: {r['kind']} | name: {r['name']}" + (f" | also: {r['aliases']}" if r["aliases"] else ""),
                 f"claims: {claims(r, by_id)}; precision {r['precision']}; tolerance {r['tolerance_years'] or 0} years",
                 f"summary: {r['summary']}" + (f" | note: {r['note']}" if r["note"] else "")]
        if not picks:
            lines.append("(no passage in the corpus names this row with its year or thinker)")
        texts = {}
        for pid in picks:
            text = passages[pid]["text"]
            prev = passages.get(pid - 1)
            if second and prev and prev["book_title"] == passages[pid]["book_title"]:
                text = prev["text"][-900:] + " " + text   # the passage before, as context
            else:
                text = window(text, [re.compile(re.escape(n), re.I) for n in names(r)[:3]])
            texts[str(pid)] = text
            flat = re.sub(r"\s+", " ", text)
            lines.append(f"[P{pid}] {passages[pid]['book_title']}: {flat}")
        blocks.append("\n".join(lines))
        meta[key] = texts
        keys.append(key)

    index_out = {}
    for i in range(0, len(blocks), PER_BATCH):
        vid = f"v{i // PER_BATCH + 1:02d}"
        (out_dir / f"{vid}.txt").write_text("\n\n".join(blocks[i:i + PER_BATCH]) + "\n", encoding="utf-8")
        index_out[vid] = keys[i:i + PER_BATCH]
    (out_dir / "index.json").write_text(json.dumps(index_out, indent=1), encoding="utf-8")
    (out_dir / "passages.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    none = sum(1 for m in meta.values() if not m)
    print(f"{len(rows)} rows in {len(index_out)} batches; {none} rows with no candidate passage")


if __name__ == "__main__":
    main()
