#!/usr/bin/env bash
# Opens the CMS with the current key, without you ever having to see or paste
# it. Reads the key from .env.local, tests it, then opens the browser.
#
#   ./scripts/cms-open.sh            # production
#   ./scripts/cms-open.sh local      # localhost:3000
set -euo pipefail
cd "$(dirname "$0")/.."

KEY=$(grep '^ADMIN_SECRET_KEY=' .env.local | sed 's/^ADMIN_SECRET_KEY=//' | tr -d '\r\n')
if [ -z "$KEY" ]; then echo "ADMIN_SECRET_KEY is not set in .env.local" >&2; exit 1; fi

if [ "${1:-}" = "local" ]; then BASE="http://localhost:3000"; else BASE="https://www.distilledcrux.com"; fi

echo "key length: ${#KEY} characters"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$BASE/cms?key=$KEY" || echo ERR)
echo "$BASE/cms -> $code"

case "$code" in
  200|307) echo "gate opens. opening your browser."; open "$BASE/cms?key=$KEY";;
  404)     echo "gate rejected the key: the value in .env.local does not match the one deployed.";;
  *)       echo "unexpected response ($code). the app itself may be down.";;
esac
