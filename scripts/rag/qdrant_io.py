"""Small Qdrant REST helpers shared by DC's corpus-grounding scripts (ported from History Optional).

Talks to the REST API with urllib, as lib/vectorStore.ts does, so nothing new has
to be installed. Credentials come from .env.local at the repo root.
"""
from __future__ import annotations

import http.client
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WORK = Path(__file__).resolve().parent / "work"


def env(name: str) -> str:
    m = re.search(rf"^{name}=[\"']?([^\"'\n]+)", (REPO / ".env.local").read_text(), re.M)
    if not m:
        raise SystemExit(f"{name} is missing from .env.local")
    return m.group(1)


def qdrant(method: str, path: str, body: dict | None = None, timeout: int = 120) -> dict:
    url = env("QDRANT_URL").rstrip("/") + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json", "api-key": env("QDRANT_API_KEY")})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            if e.code < 500 or attempt == 4:
                raise RuntimeError(f"Qdrant {method} {path} -> {e.code}: {msg}") from None
        except (urllib.error.URLError, TimeoutError, http.client.IncompleteRead, ConnectionError) as e:
            if attempt == 4:
                raise
            print(f"  qdrant retry: {e}", flush=True)
        time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")
