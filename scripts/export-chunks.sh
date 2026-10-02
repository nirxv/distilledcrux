#!/usr/bin/env bash
# Export book_chunks (content + embedding) out of Postgres as JSONL.
#
#   bash scripts/export-chunks.sh [outfile]
#
# The existing 1024-dimension embeddings are exported as-is, so moving to
# Qdrant costs nothing in Voyage credits and changes no retrieval quality.
# Only re-embed if you separately decide you want smaller vectors.
#
# The default output sits beside the repo, not in it: the file runs to
# hundreds of megabytes and nothing in .gitignore would keep it out of a
# commit.
#
# The instance this reads from is small and can run out of disk IO, so the
# export is deliberately defensive: small keyset-paginated batches, a
# statement timeout so a stalled batch fails instead of hanging forever,
# retries with backoff, and resume from the last id already written. Interrupting it and re-running is safe.
set -uo pipefail
cd "$(dirname "$0")/.."

OUT=${1:-../dc-migrate/book_chunks.jsonl}
BATCH=${BATCH:-250}
MAX_RETRIES=${MAX_RETRIES:-5}
# The instance is flapping rather than uniformly slow: it answers in under a
# second for short windows, then refuses connections entirely. So a batch
# should fail fast and be retried soon, not block for minutes -- the aim is to
# be knocking often enough to land inside the next healthy window.
STATEMENT_TIMEOUT_MS=${STATEMENT_TIMEOUT_MS:-30000}
CONNECT_TIMEOUT=${CONNECT_TIMEOUT:-10}
RETRY_WAIT=${RETRY_WAIT:-5}
MAX_RETRY_WAIT=${MAX_RETRY_WAIT:-30}

DB=$(grep -m1 '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')
[ -n "$DB" ] || { echo "DATABASE_URL not found in .env.local" >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"
touch "$OUT"

# A batch that cannot finish quickly is one the instance cannot serve right
# now; failing fast frees us to try again during the next healthy window.
export PGOPTIONS="-c statement_timeout=$STATEMENT_TIMEOUT_MS"
export PGCONNECT_TIMEOUT="$CONNECT_TIMEOUT"

# Resume: json_build_object always writes "id" first, so the last line's id is
# the high-water mark.
last=0
if [ -s "$OUT" ]; then
  last=$(tail -n 1 "$OUT" | sed -E 's/^\{"id"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/')
  case "$last" in
    ''|*[!0-9]*) echo "Could not read a resume id from the last line of $OUT." >&2
                 echo "Delete the file to start over, or fix its final line." >&2
                 exit 1 ;;
  esac
  echo "resuming after id $last ($(wc -l < "$OUT" | tr -d ' ') rows already exported)"
fi

total=$(wc -l < "$OUT" | tr -d ' ')
while :; do
  sql="select json_build_object(
         'id', id,
         'content', content,
         'book_title', book_title,
         'author', author,
         'subject', subject,
         'embedding', embedding::text
       )::text
       from book_chunks
       where id > $last and embedding is not null
       order by id
       limit $BATCH"

  attempt=1
  rows=""
  while [ "$attempt" -le "$MAX_RETRIES" ]; do
    # -t tuples only, -A unaligned: one JSON object per line. json_build_object
    # escapes newlines inside content, so a chunk never spans two lines.
    if rows=$(psql "$DB" -X -q -t -A -v ON_ERROR_STOP=1 -c "$sql" 2>/dev/null); then
      break
    fi
    # Capped, not growing: the healthy windows arrive at random, so backing
    # off ever further just means missing more of them.
    wait=$((attempt * RETRY_WAIT))
    [ "$wait" -gt "$MAX_RETRY_WAIT" ] && wait=$MAX_RETRY_WAIT
    echo "  batch after id $last failed (attempt $attempt/$MAX_RETRIES), retrying in ${wait}s" >&2
    sleep "$wait"
    attempt=$((attempt + 1))
    rows=""
  done

  if [ "$attempt" -gt "$MAX_RETRIES" ]; then
    echo "Giving up after $MAX_RETRIES attempts at id > $last. Re-run to resume." >&2
    exit 1
  fi

  # Blank output means no rows past the high-water mark: we are done.
  [ -n "$rows" ] || break

  printf '%s\n' "$rows" >> "$OUT"
  count=$(printf '%s\n' "$rows" | wc -l | tr -d ' ')
  total=$((total + count))
  last=$(printf '%s\n' "$rows" | tail -n 1 | sed -E 's/^\{"id"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/')
  echo "exported $total rows (through id $last)"

  [ "$count" -lt "$BATCH" ] && break
done

echo "done: $total rows in $OUT"
