"""Dump every non-junk passage of DC's live book_chunks collection to work/passages.jsonl.

One line per passage: {"id", "book_title", "author", "subject", "text"}, sorted by book and then by
point id. Point ids were assigned in reading order when each book was uploaded, so
neighbouring ids are neighbouring passages; the tagging step relies on that.

    python3 scripts/rag/export_passages.py
"""
from __future__ import annotations

import json
from collections import Counter

from qdrant_io import WORK, qdrant

COLLECTION = "book_chunks"


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    rows, offset = [], None
    while True:
        body = {"limit": 250, "with_payload": ["text", "content", "book_title", "author", "subject", "junk"], "with_vector": False,
                "filter": {"must_not": [{"key": "junk", "match": {"value": True}}]}}
        if offset is not None:
            body["offset"] = offset
        res = qdrant("POST", f"/collections/{COLLECTION}/points/scroll", body)["result"]
        for p in res["points"]:
            pl = p["payload"]
            text = (pl.get("text") or pl.get("content") or "").strip()
            if text:
                rows.append({"id": p["id"], "book_title": pl["book_title"], "author": pl.get("author", ""),
                             "subject": pl.get("subject", ""), "text": text})
        offset = res.get("next_page_offset")
        print(f"  {len(rows)} passages", flush=True)
        if offset is None:
            break
    rows.sort(key=lambda r: (r["book_title"], r["id"]))
    out = WORK / "passages.jsonl"
    with open(out, "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    by_book = Counter(r["book_title"] for r in rows)
    print(f"wrote {len(rows)} passages from {len(by_book)} books to {out}")


if __name__ == "__main__":
    main()
