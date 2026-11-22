"""BM25 keyword vectors for Qdrant's sparse index.

Documents get BM25's saturated term frequency; queries get 1 per term. The collection's
sparse vector uses Qdrant's `idf` modifier, so the inverse document frequency is applied
by Qdrant at query time and BM25 comes out of a plain dot product.

lib/rag/sparse.ts holds the query side. The two must tokenize and hash identically:
change one, change the other, and rebuild the collection.
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter

STOP = set("""a an the of and or in on at to for from by with as is was were be been are it its this that these those
which who whom whose what when where why how not no but if then than so such into over under after before during
about against between through their there they them he she his her we you our your i also had has have do did""".split())

K1, B = 1.2, 0.75


def tokens(text: str) -> list[str]:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    return [w for w in re.findall(r"[a-z0-9]+", text) if len(w) > 1 and w not in STOP]


def fnv1a(word: str) -> int:
    h = 0x811C9DC5
    for byte in word.encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def doc_vector(text: str, avgdl: float) -> dict:
    toks = tokens(text)
    dl = len(toks) or 1
    weights: dict[int, float] = {}
    for word, tf in Counter(toks).items():
        w = tf * (K1 + 1) / (tf + K1 * (1 - B + B * dl / avgdl))
        idx = fnv1a(word)
        weights[idx] = weights.get(idx, 0.0) + w
    idx = sorted(weights)
    return {"indices": idx, "values": [round(weights[i], 4) for i in idx]}


def query_vector(text: str) -> dict:
    idx = sorted({fnv1a(w) for w in tokens(text)})
    return {"indices": idx, "values": [1.0] * len(idx)}
