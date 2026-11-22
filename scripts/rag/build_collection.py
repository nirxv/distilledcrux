"""Build the tagged collection (book_chunks_v2) from the live one plus the tagging output.

For every passage loaded:
  - the dense vector is copied from book_chunks (no re-embedding, no API spend)
  - a BM25 keyword vector is built from heading + context + text (sparse.py)
  - the payload gains the syllabus units, register ids (thinkers, works, concepts,
    events), the one-line context, a heading and an OCR-quality score, all indexed
    for filtering

The live collection is never written to. The site reads book_chunks_v2 by default
(lib/rag/retrieve.ts) and goes back to the old search when RAG_COLLECTION=off.

To keep the free cluster's memory flat, v2 keeps its full vectors on disk and an
int8 copy in RAM for search: a quarter of book_chunks' footprint.

    python3 scripts/rag/build_collection.py --provisional      # tagged batches + every other passage, untagged
    python3 scripts/rag/build_collection.py --batches b210 b211
    python3 scripts/rag/build_collection.py --provisional --skip-existing   # only what changed since the last run
    python3 scripts/rag/build_collection.py --recreate          # drop and rebuild v2 first
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from check_tags import check
from qdrant_io import WORK, qdrant
from sparse import doc_vector, tokens

HERE = Path(__file__).resolve().parent
SOURCE, TARGET = "book_chunks", "book_chunks_v2"
SUBJECT_SHORT = {"sociology": "Sociology", "anthropology": "Anthropology", "polsci": "PSIR",
                 "geography": "Geography", "pub-admin": "Public Administration"}
INDEXES = {"book_title": "keyword", "subject": "keyword", "units": "keyword", "refs": "keyword",
           "ocr_quality": "float", "tagged": "bool"}

_GOOD_TOKEN = re.compile(
    r"[(\[\"'‘“]*"
    r"(?:(?:[^\W\d_]\.){2,5}"                                    # initials: M.N. / A.R.
    r"|[^\W\d_]+(?:['’\-–—/][^\W\d_]+)*(?:['’]s)?"              # words, hyphenated, possessive
    r"|\d[\d,.]*(?:[-–—/]\d[\d,.]*)?(?:st|nd|rd|th|s)?"           # 1893, 1,00,000, 1793–94, 1920s
    r"|&|[-–—]{1,2})"
    r"[.,;:!?)\]\"'’”]*")


def ocr_quality(text: str) -> float:
    """Share of tokens that look like real words or numbers (0..1). Garbled OCR scores low."""
    toks = text.split()
    if not toks:
        return 0.0
    good = 0
    for t in toks:
        if not _GOOD_TOKEN.fullmatch(t):
            continue
        core = t.strip("()[]\"'‘“’”.,;:!?")
        if re.search(r"[a-z][A-Z]", core) or re.search(r"\d[^\W\d_]|[^\W\d_]\d", core):
            continue  # mid-word capitals ("unacceptaWe") or digits inside words ("1mporta")
        if (len(core) == 1 and core.isalpha() and core not in {"a", "A", "I"}
                and not (core.isupper() and t.rstrip("),;:").endswith("."))):   # "M. N. Srinivas" is fine
            continue  # stray single letters are typical OCR debris
        good += 1
    return round(good / len(toks), 3)


def ensure_collection(recreate: bool) -> None:
    names = {c["name"] for c in qdrant("GET", "/collections")["result"]["collections"]}
    if TARGET in names and recreate:
        qdrant("DELETE", f"/collections/{TARGET}")
        names.discard(TARGET)
        print(f"dropped {TARGET}")
    if TARGET not in names:
        qdrant("PUT", f"/collections/{TARGET}", {
            "vectors": {"dense": {"size": 1024, "distance": "Cosine", "on_disk": True}},
            "sparse_vectors": {"bm25": {"modifier": "idf", "index": {"on_disk": True}}},
            "quantization_config": {"scalar": {"type": "int8", "quantile": 0.99, "always_ram": True}},
            "on_disk_payload": True,
        })
        for field, schema in INDEXES.items():
            qdrant("PUT", f"/collections/{TARGET}/index?wait=true", {"field_name": field, "field_schema": schema})
        print(f"created {TARGET} with indexes on {', '.join(INDEXES)}")


def load_tags(batches: list[str], index: dict) -> dict[int, dict]:
    tags: dict[int, dict] = {}
    for bid in batches:
        path = WORK / "tags" / f"{bid}.jsonl"
        if not path.exists():
            continue
        problems = check(bid, index[bid], path)
        if problems:
            print(f"  skip {bid}: {len(problems)} problems (run check_tags.py {bid})")
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                tags[r["id"]] = r
    return tags


def point_fields(p: dict, t: dict, avgdl: float, unit_title: dict) -> tuple[dict, dict]:
    """The payload and BM25 vector of a passage with its tags."""
    subj = SUBJECT_SHORT.get(p["subject"], p["subject"])
    unit_names = [unit_title[u] for u in t["u"] if u in unit_title]
    header = " | ".join([p["book_title"], subj] + ([", ".join(unit_names)] if unit_names else []))
    payload = {"text": p["text"], "book_title": p["book_title"], "author": p["author"],
               "subject": p["subject"], "units": t["u"], "refs": t["r"], "context": t["c"],
               "header": header, "ocr_quality": ocr_quality(p["text"]), "tagged": not t.get("provisional")}
    return payload, doc_vector(f"{header} {t['c']} {p['text']}", avgdl)


def update_tags(ids: list[int], passages: dict, tags: dict, avgdl: float, unit_title: dict, workers: int) -> None:
    have, offset = {}, None
    while True:
        body = {"limit": 1000, "with_payload": ["tagged", "context"], "with_vector": False}
        if offset is not None:
            body["offset"] = offset
        res = qdrant("POST", f"/collections/{TARGET}/points/scroll", body)["result"]
        have.update({p["id"]: (p["payload"].get("tagged", False), p["payload"].get("context", "")) for p in res["points"]})
        offset = res.get("next_page_offset")
        if offset is None:
            break
    todo = [i for i in ids if not tags[i].get("provisional") and i in have
            and (not have[i][0] or have[i][1] != tags[i]["c"])]
    missing = [i for i in ids if i not in have]
    print(f"{len(todo)} tagged passages to update; {len(missing)} not in {TARGET} (run without --tags-only for those)")

    def send(part: list[int]) -> int:
        ops, vecs = [], []
        for pid in part:
            payload, sparse = point_fields(passages[pid], tags[pid], avgdl, unit_title)
            del payload["text"]   # already there
            ops.append({"set_payload": {"payload": payload, "points": [pid]}})
            vecs.append({"id": pid, "vector": {"bm25": sparse}})
        ops.append({"update_vectors": {"points": vecs}})
        qdrant("POST", f"/collections/{TARGET}/points/batch?wait=true", {"operations": ops})
        return len(part)

    done = 0
    parts = [todo[i:i + 64] for i in range(0, len(todo), 64)]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for n in pool.map(send, parts):
            done += n
            if done % 1280 < 64 or done == len(todo):
                print(f"  updated {done}/{len(todo)}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--batches", nargs="*")
    ap.add_argument("--recreate", action="store_true")
    ap.add_argument("--provisional", action="store_true",
                    help="also load untagged passages, with their book's optional and no units or register ids")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--local-vectors", help="a JSONL of {id, embedding} rows (the Supabase export) to read "
                    "vectors from instead of downloading them; ids it lacks are fetched from the source")
    ap.add_argument("--tags-only", action="store_true",
                    help="for points already in the target, send only the new payload and BM25 vector of newly "
                         "tagged passages (no dense vectors: a quarter of the traffic)")
    ap.add_argument("--skip-existing", action="store_true",
                    help="leave points already in the target with the same tagged state alone")
    args = ap.parse_args()

    index_path = WORK / "batches" / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    batches = args.batches or sorted(index)
    tags = load_tags(batches, index)
    units = json.loads((HERE / "register" / "units.json").read_text(encoding="utf-8"))
    unit_title = {u["slug"]: u["title"] for subj in units.values() for u in subj}

    passages = {}
    for line in open(WORK / "passages.jsonl", encoding="utf-8"):
        r = json.loads(line)
        if r["id"] in tags:
            passages[r["id"]] = r
        elif args.provisional:
            tags[r["id"]] = {"id": r["id"], "u": [], "r": [], "c": "", "provisional": True}
            passages[r["id"]] = r
    if not passages:
        raise SystemExit("no valid tagged batches (use --provisional to load untagged passages)")
    print(f"{sum(1 for t in tags.values() if not t.get('provisional'))} tagged, "
          f"{sum(1 for t in tags.values() if t.get('provisional'))} provisional passages")

    # avgdl must describe the whole corpus, not just the batches in this run, or the
    # BM25 weights of an incremental build would not match those of a full one.
    lengths = []
    for line in open(WORK / "passages.jsonl", encoding="utf-8"):
        lengths.append(len(tokens(json.loads(line)["text"])) + 40)   # + heading and context, roughly
    avgdl = statistics.mean(lengths)

    ensure_collection(args.recreate)
    ids = sorted(passages)
    if args.tags_only:
        update_tags(ids, passages, tags, avgdl, unit_title, args.workers)
        return
    if args.skip_existing:
        have, offset = {}, None
        while True:
            body = {"limit": 1000, "with_payload": ["tagged"], "with_vector": False}
            if offset is not None:
                body["offset"] = offset
            res = qdrant("POST", f"/collections/{TARGET}/points/scroll", body)["result"]
            have.update({p["id"]: p["payload"].get("tagged", True) for p in res["points"]})
            offset = res.get("next_page_offset")
            if offset is None:
                break
        ids = [i for i in ids if have.get(i) != (not tags[i].get("provisional"))]
        print(f"{len(ids)} points to write ({len(have)} already in {TARGET})")

    # Downloading a vector costs ~13 KB a point; a local copy of the same embeddings
    # (checked equal, cosine 1.0) saves most of that. Only byte offsets are held in memory.
    offsets: dict[int, int] = {}
    if args.local_vectors:
        with open(args.local_vectors, "rb") as fh:
            pos = 0
            for line in fh:
                m = re.match(rb'\{"id"\s*:\s*(\d+)', line)
                if m:
                    offsets[int(m.group(1))] = pos
                pos += len(line)
        print(f"{len(offsets)} vectors available locally; {sum(1 for i in ids if i not in offsets)} to download")

    def local(part: list[int]) -> dict[int, list[float]]:
        out = {}
        with open(args.local_vectors, "rb") as fh:
            for pid in part:
                if pid in offsets:
                    fh.seek(offsets[pid])
                    r = json.loads(fh.readline())
                    emb = r["embedding"]
                    out[pid] = json.loads(emb) if isinstance(emb, str) else emb
        return out

    def write(part: list[int]) -> int:
        vectors = local(part) if offsets else {}
        missing = [pid for pid in part if pid not in vectors]
        # Vectors are fetched 16 at a time: larger responses kept arriving truncated.
        for j in range(0, len(missing), 16):
            got = qdrant("POST", f"/collections/{SOURCE}/points",
                         {"ids": missing[j:j + 16], "with_vector": True, "with_payload": False})
            vectors.update({p["id"]: p["vector"] for p in got["result"]})
        points = []
        for pid in part:
            p, t = passages[pid], tags[pid]
            vec = vectors.get(pid)
            if vec is None:
                print(f"  {pid}: no vector in {SOURCE}, skipped")
                continue
            if isinstance(vec, dict):   # a named vector in the source
                vec = next(iter(vec.values()))
            subj = SUBJECT_SHORT.get(p["subject"], p["subject"])
            unit_names = [unit_title[u] for u in t["u"] if u in unit_title]
            header = " | ".join([p["book_title"], subj] + ([", ".join(unit_names)] if unit_names else []))
            points.append({
                "id": pid,
                "vector": {"dense": vec, "bm25": doc_vector(f"{header} {t['c']} {p['text']}", avgdl)},
                "payload": {
                    "text": p["text"], "book_title": p["book_title"], "author": p["author"],
                    "subject": p["subject"], "units": t["u"], "refs": t["r"], "context": t["c"],
                    "header": header, "ocr_quality": ocr_quality(p["text"]),
                    "tagged": not t.get("provisional"),
                },
            })
        if points:
            qdrant("PUT", f"/collections/{TARGET}/points?wait=true", {"points": points})
        return len(points)

    done = 0
    parts = [ids[i:i + 64] for i in range(0, len(ids), 64)]
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for n in pool.map(write, parts):
            done += n
            if done % 1280 < 64 or done == len(ids):
                print(f"  upserted {done}/{len(ids)}", flush=True)
    info = qdrant("GET", f"/collections/{TARGET}")["result"]
    print(f"{TARGET}: {info.get('points_count')} points, status {info['status']}")


if __name__ == "__main__":
    main()
