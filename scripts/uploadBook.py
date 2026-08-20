"""
Upload + embed book chunks for distilledcrux using Voyage AI (voyage-4-lite, 1024 dims)

Usage:
  python3 scripts/uploadBook.py upload ./books/file.pdf "Book Title" "Author Name" sociology
  python3 scripts/uploadBook.py upload ./books/file.txt "Book Title" "Author Name" anthropology

Subjects: sociology | anthropology | geography | polsci | pub-admin

Requires env vars:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY   (or SUPABASE_SECRET_KEY)
  VOYAGE_API_KEY
"""

import os
import sys
import time
import re
from pathlib import Path

import voyageai
from supabase import create_client

# ── Load .env.local ───────────────────────────────────────────
def load_env_local():
    # Search: script dir → project root (up to 3 levels)
    candidates = [Path(__file__).parent, Path(__file__).parent.parent, Path.cwd()]
    for base in candidates:
        env_file = base / ".env.local"
        if env_file.exists():
            print(f"Loading env from: {env_file}")
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key not in os.environ:  # don't override already-set env vars
                    os.environ[key] = val
            return
    print("Warning: .env.local not found — using system env vars")

load_env_local()

# ── Config ────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_SECRET_KEY")
    or ""
)
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY", "")

MODEL      = "voyage-4-lite"
BATCH_SIZE = 64       # Voyage rate-limit safe
CHUNK_SIZE = 250      # words per chunk
OVERLAP    = 50       # word overlap between chunks

if not SUPABASE_URL or not SUPABASE_KEY or not VOYAGE_API_KEY:
    print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
vc = voyageai.Client(api_key=VOYAGE_API_KEY)


# ── Text extraction ───────────────────────────────────────────
def extract_text(file_path: str) -> str:
    if file_path.endswith(".txt"):
        raw = open(file_path, encoding="utf-8", errors="ignore").read()
        return (
            raw.replace("\r\n", "\n")
               .replace("\f", "\n")
               .replace("-\n", "")
        )
    else:
        # PDF via pymupdf (fitz) — better text extraction than pypdf
        try:
            import fitz  # pymupdf
        except ImportError:
            print("Install pymupdf: pip install pymupdf")
            sys.exit(1)
        doc = fitz.open(file_path)
        pages = []
        for page in doc:
            t = page.get_text() or ""
            pages.append(t)
        doc.close()
        raw = "\n".join(pages)
        # Clean common PDF artifacts
        raw = re.sub(r"^\s*\d+\s*$", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"-\n", "", raw)
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        raw = re.sub(r" {3,}", " ", raw)
        return raw.strip()


# ── Chunking ──────────────────────────────────────────────────
def chunk_text(text: str, chunk_size=CHUNK_SIZE, overlap=OVERLAP) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_size])
        if len(chunk.strip()) > 50:
            chunks.append(chunk.strip())
        i += chunk_size - overlap
    return chunks


# ── Voyage embed with retry ───────────────────────────────────
def embed_batch(texts: list[str], max_retries=5) -> list[list[float]]:
    for attempt in range(max_retries):
        try:
            result = vc.embed(texts, model=MODEL, input_type="document")
            return result.embeddings
        except Exception as e:
            wait = 20 * (attempt + 1)
            print(f"  Voyage error: {e} — retrying in {wait}s (attempt {attempt+1}/{max_retries})")
            time.sleep(wait)
    raise Exception("embed_batch: max retries exceeded")


# ── Upload ────────────────────────────────────────────────────
def upload_book(file_path: str, book_title: str, author: str, subject: str):
    print(f"\nReading: {book_title}")
    text = extract_text(file_path)
    chunks = chunk_text(text)
    print(f"Total chunks: {len(chunks)}")

    total    = len(chunks)
    uploaded = 0
    errors   = 0

    for i in range(0, total, BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        try:
            embeddings = embed_batch(batch)
            rows = [
                {
                    "content":    batch[j],
                    "embedding":  embeddings[j],
                    "book_title": book_title,
                    "author":     author,
                    "subject":    subject,
                }
                for j in range(len(batch))
            ]
            sb.table("book_chunks").insert(rows).execute()
            uploaded += len(batch)
            pct = uploaded / total * 100
            print(f"  [{pct:5.1f}%] {uploaded}/{total} chunks uploaded")
        except Exception as e:
            errors += len(batch)
            print(f"  ERROR on batch {i // BATCH_SIZE}: {e}")

        time.sleep(0.3)

    print(f"\nDone: {uploaded} uploaded, {errors} errors")


# ── CLI ───────────────────────────────────────────────────────
VALID_SUBJECTS = {"sociology", "anthropology", "geography", "polsci", "pub-admin"}

if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) >= 1 and args[0] == "upload":
        if len(args) != 5:
            print("Usage: python3 scripts/uploadBook.py upload <file> <title> <author> <subject>")
            print(f"Subjects: {' | '.join(VALID_SUBJECTS)}")
            sys.exit(1)
        _, file_path, book_title, author, subject = args
        if subject not in VALID_SUBJECTS:
            print(f"Invalid subject '{subject}'. Choose from: {', '.join(VALID_SUBJECTS)}")
            sys.exit(1)
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            sys.exit(1)
        upload_book(file_path, book_title, author, subject)
    else:
        print(__doc__)
