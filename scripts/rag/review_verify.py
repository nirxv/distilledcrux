"""Print the verify results that need a decision by hand, with their quotes.

    python3 scripts/rag/review_verify.py                  # corrected and disputed rows
    python3 scripts/rag/review_verify.py partial          # rows the books back only in part
    python3 scripts/rag/review_verify.py unsupported      # row keys with no book support
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

from apply_verify import DECISIONS, load_results

HERE = Path(__file__).resolve().parent
SUBJECTS = ["sociology", "anthropology", "polsci", "geography", "pub-admin"]


def main() -> None:
    want = set(sys.argv[1:]) or {"corrected", "disputed"}
    results = load_results()
    titles = {}
    for line in open(HERE / "work" / "passages.jsonl", encoding="utf-8"):
        p = json.loads(line)
        titles[str(p["id"])] = p["book_title"]
    rows = {}
    for s in SUBJECTS:
        for r in csv.DictReader(open(HERE / "register" / f"{s}.csv", encoding="utf-8")):
            rows[f"{s}:{r['id']}"] = r
    if want == {"unsupported"}:
        print(" ".join(k for k in rows if k not in results or results[k]["verdict"] == "unsupported"))
        return
    for k, o in results.items():
        if o["verdict"] not in want:
            continue
        r = rows.get(k, {})
        flag = " [decided]" if k in DECISIONS else ""
        print(f"\n### {k} ({o['verdict']}, {o['_pass']}){flag}")
        print(f"row: {r.get('name')} | thinker {r.get('thinker')} | {r.get('start')}–{r.get('end')} "
              f"{r.get('precision')} ±{r.get('tolerance_years') or 0}")
        print(f"why: {o.get('why')}")
        if o.get("suggest"):
            print(f"suggest: {json.dumps(o['suggest'], ensure_ascii=False)}")
        for b in o["books"]:
            print(f"  - {titles.get(str(b['p']), '?')} [P{b['p']}] date={b.get('date')!r} who={b.get('who')!r}: {b['quote']}")


if __name__ == "__main__":
    main()
