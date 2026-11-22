"""Apply the textbook check to the registers, with a full audit trail.

Rule: a row is marked verified (its `verified` column names the books) only when the
books back every claim in it: the years, and for a work or concept the thinker it is
credited to. Where books give a different year or thinker, or disagree with each other,
the row was decided by hand against the quotes (review_verify.py prints them); those
decisions are in DECISIONS below, and every value there is stated by at least one book.

    python3 scripts/rag/apply_verify.py            # dry run: print what would change
    python3 scripts/rag/apply_verify.py --write    # write register/*.csv and work/register_sources.csv
                                                   # (local only: it quotes the books)
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REG = HERE / "register"
SUBJECTS = ["sociology", "anthropology", "polsci", "geography", "pub-admin"]
COLS = ["kind", "id", "unit", "name", "aliases", "thinker", "start", "end", "precision", "tolerance_years",
        "summary", "note", "verified"]

# "<optional>:<id>" -> fields to set. "note" replaces the row's note. "verify": False keeps
# the row unverified (the books settle one claim but not the other).
DECISIONS: dict[str, dict] = {
}


def short_book(title: str) -> str:
    return re.split(r"\s+[—-]\s+", title)[0].strip()


def load_results() -> dict:
    out = {}
    rank = {"unsupported": 0, "partial": 1, "confirmed": 2, "disputed": 3, "corrected": 3}
    for d in ("verify", "verify2"):
        for f in sorted((HERE / "work" / d).glob("v*.out.jsonl")):
            for line in f.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                o = json.loads(line)
                prev = out.get(o["id"])
                # The second pass only replaces a first-pass result it improves on.
                if prev is None or (d == "verify2" and rank[o["verdict"]] >= rank[prev["verdict"]]):
                    o["_pass"] = d
                    out[o["id"]] = o if prev is None or o["books"] else {**o, "books": prev["books"]}
    return out


def main() -> None:
    write = "--write" in sys.argv
    results = load_results()
    titles = {}
    for line in open(HERE / "work" / "passages.jsonl", encoding="utf-8"):
        p = json.loads(line)
        titles[str(p["id"])] = p["book_title"]
    regs = {s: list(csv.DictReader(open(REG / f"{s}.csv", encoding="utf-8"))) for s in SUBJECTS}
    keys = {f"{s}:{r['id']}" for s, rows in regs.items() for r in rows}
    unknown = set(DECISIONS) - keys
    assert not unknown, f"decisions for unknown rows: {unknown}"

    stats = {"verified": [], "partial": [], "unsupported": [], "changed": [], "undecided": []}
    for s, rows in regs.items():
        for r in rows:
            k = f"{s}:{r['id']}"
            o = results.get(k)
            books = sorted({short_book(titles.get(str(b["p"]), "")) for b in (o or {}).get("books", [])} - {""})
            r["verified"] = ""
            if k in DECISIONS:
                d = dict(DECISIONS[k])
                keep_unverified = d.pop("verify", True) is False
                before = {c: r[c] for c in COLS}
                r.update(d)
                if r["precision"] in ("year", "circa", "contested"):
                    for c in ("start", "end"):
                        if r[c] and re.match(r"^\d{4}-", r[c]):
                            r[c] = r[c][:4]
                stats["changed"].append((k, {c: (before[c], r[c]) for c in COLS if before[c] != r[c]}))
                if books and not keep_unverified:
                    r["verified"] = "books: " + "; ".join(books)
                    stats["verified"].append(k)
                else:
                    stats["partial"].append(k)
                continue
            if not o or o["verdict"] == "unsupported":
                stats["unsupported"].append(k)
            elif o["verdict"] == "confirmed":
                r["verified"] = "books: " + "; ".join(books)
                stats["verified"].append(k)
            elif o["verdict"] == "partial":
                stats["partial"].append(k)
            else:
                stats["undecided"].append(k)

    n = sum(len(v) for v in regs.values())
    print(f"{n} rows: {len(stats['verified'])} verified, {len(stats['partial'])} partly supported, "
          f"{len(stats['unsupported'])} not stated in the books; {len(stats['changed'])} rows changed by decision")
    for k, ch in stats["changed"]:
        print(f"  {k}: " + "; ".join(f"{c} {a!r} -> {b!r}" for c, (a, b) in ch.items() if c != "verified"))
    if stats["undecided"]:
        print(f"!! {len(stats['undecided'])} corrected/disputed rows without a decision (left unverified):")
        print("   " + " ".join(stats["undecided"]))
    if not write:
        return

    for s, rows in regs.items():
        with open(REG / f"{s}.csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=COLS)
            w.writeheader()
            w.writerows(rows)
    sys.path.insert(0, str(REG))
    from check_register import check
    units = json.loads((REG / "units.json").read_text())
    for s in SUBJECTS:
        problems, _ = check(s, units)
        assert not problems, (s, problems[:5])
    with open(HERE / "work" / "register_sources.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["row", "status", "book", "passage", "date", "who", "quote"])
        for s, rows in regs.items():
            for r in rows:
                k = f"{s}:{r['id']}"
                o = results.get(k)
                status = ("verified" if r["verified"] else "partly supported" if k in stats["partial"]
                          else "not stated in the books")
                if not o or not o["books"]:
                    w.writerow([k, status, "", "", "", "", ""])
                for b in (o or {}).get("books", []):
                    w.writerow([k, status, titles.get(str(b["p"]), ""), b["p"], b.get("date", ""), b.get("who", ""), b["quote"]])
    print("wrote register/*.csv and work/register_sources.csv; validation clean")


if __name__ == "__main__":
    main()
