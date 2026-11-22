"""Check a verify batch's output (VERIFY-BRIEF.md) and, with --all, summarise every batch.

Beyond format, it checks that each quote is really in its passage, and that a
`confirmed` row has, for each of its claims, a book entry that states it: a year
within the row's tolerance, and a credit naming the row's thinker.

    python3 scripts/rag/check_verify.py v10
    python3 scripts/rag/check_verify.py --all
    python3 scripts/rag/check_verify.py --dir verify2 v01
"""
from __future__ import annotations

import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
REG = HERE / "register"
SUBJECTS = ["sociology", "anthropology", "polsci", "geography", "pub-admin"]
VDIR = HERE / "work" / ("verify2" if "--dir" in sys.argv and sys.argv[sys.argv.index("--dir") + 1] == "verify2" else "verify")
VERDICTS = {"confirmed", "partial", "corrected", "disputed", "unsupported"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().lower()


def load_rows() -> dict[str, dict]:
    rows = {}
    for s in SUBJECTS:
        path = REG / f"{s}.csv"
        if not path.exists():
            continue
        reg = list(csv.DictReader(open(path, encoding="utf-8")))
        by_id = {r["id"]: r for r in reg}
        for r in reg:
            rows[f"{s}:{r['id']}"] = {**r, "_thinker": by_id.get(r["thinker"])}
    return rows


def years_of(text: str) -> list[int]:
    return [int(y) for y in re.findall(r"(?<!\d)(\d{4})(?!\d)", text or "")]


def year_ok(claim: str, row_value: str, tol: int) -> bool:
    if not row_value:
        return True
    y = int(row_value.split("-")[0]) if not row_value.upper().endswith(("BCE", "BC")) else None
    return y is None or any(abs(c - y) <= tol for c in years_of(claim))


def surname(name: str) -> str:
    return norm(name).split()[-1] if name else ""


def check(vid: str, index: dict, rows: dict, passages: dict) -> list[str]:
    path = VDIR / f"{vid}.out.jsonl"
    if not path.exists():
        return ["no output file"]
    problems, seen = [], set()
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError as e:
            problems.append(f"line {n}: not JSON ({e})")
            continue
        rid = r.get("id")
        where = f"line {n} {rid}"
        if rid not in index[vid]:
            problems.append(f"{where}: id not in this batch")
            continue
        if rid in seen:
            problems.append(f"{where}: duplicate")
        seen.add(rid)
        v = r.get("verdict")
        if v not in VERDICTS:
            problems.append(f"{where}: verdict {v!r}")
            continue
        books = r.get("books")
        if not isinstance(books, list):
            problems.append(f"{where}: books must be a list")
            continue
        if v != "unsupported" and not books:
            problems.append(f"{where}: {v} needs at least one book entry")
        cands = passages.get(rid, {})
        row = rows[rid]
        tol = int(row["tolerance_years"] or 0)
        for b in books:
            p, q = str(b.get("p")), b.get("quote") or ""
            if p not in cands:
                problems.append(f"{where}: passage {p} is not one of this row's passages")
                continue
            if norm(q) not in norm(cands[p]):
                problems.append(f"{where}: quote not found word for word in P{p}: {q[:80]!r}")
            nw = len(q.split())
            if nw < 6 or nw > 50:
                problems.append(f"{where}: quote is {nw} words; give 8-40")
            if "date" not in b or "who" not in b:
                problems.append(f"{where}: P{p} needs both date and who (\"\" when the passage gives none)")
            elif not b["date"] and not b["who"]:
                problems.append(f"{where}: P{p} states neither a year nor a credit; leave it out")
        if v == "confirmed":
            dated = [b for b in books if b.get("date")]
            credited = [b for b in books if b.get("who")]
            kind, t = row["kind"], row["_thinker"]
            if row["start"] and not any(year_ok(b["date"], row["start"], tol) for b in dated):
                problems.append(f"{where}: confirmed, but no book entry gives the row's year {row['start']} (±{tol})")
            if kind == "thinker" and row["end"] and not any(year_ok(b["date"], row["end"], tol) for b in dated):
                problems.append(f"{where}: confirmed, but no book entry gives the death year {row['end']}")
            if kind in ("work", "concept") and t and not any(surname(t["name"]) in norm(b["who"]) for b in credited):
                problems.append(f"{where}: confirmed, but no book entry credits {t['name']} (who must name them)")
        if v in ("corrected", "disputed"):
            sg = r.get("suggest")
            if not isinstance(sg, dict) or not any(sg.get(k) for k in ("start", "end", "thinker", "tolerance", "precision")):
                problems.append(f"{where}: {v} needs suggest with the values the books support")
        if not (r.get("why") or "").strip():
            problems.append(f"{where}: why missing")
    for rid in index[vid]:
        if rid not in seen:
            problems.append(f"{rid}: no line")
    return problems


def main() -> int:
    if "--dir" in sys.argv:
        i = sys.argv.index("--dir")
        del sys.argv[i:i + 2]
    index = json.loads((VDIR / "index.json").read_text())
    passages = json.loads((VDIR / "passages.json").read_text())
    rows = load_rows()
    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        from collections import Counter
        done, broken, todo, counts = [], [], [], Counter()
        for vid in index:
            p = check(vid, index, rows, passages)
            if p == ["no output file"]:
                todo.append(vid)
            elif p:
                broken.append(vid)
            else:
                done.append(vid)
                for line in (VDIR / f"{vid}.out.jsonl").read_text().splitlines():
                    if line.strip():
                        counts[json.loads(line)["verdict"]] += 1
        print(f"done {len(done)}/{len(index)}; broken {len(broken)} {' '.join(broken)}; not started {len(todo)}")
        print("verdicts:", dict(counts))
        return 0 if not broken and not todo else 1
    vid = sys.argv[1] if len(sys.argv) > 1 else ""
    if vid not in index:
        print("give a batch id like v10, or --all")
        return 2
    problems = check(vid, index, rows, passages)
    for p in problems[:40]:
        print(p)
    print(f"{vid}: {len(index[vid])} rows, {len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
