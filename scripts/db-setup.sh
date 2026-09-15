#!/usr/bin/env bash
#
# Applies every SQL migration in supabase/migrations, then Payload's own,
# then reports what is actually there.
#
# Needs DATABASE_URL in .env.local with a real password. The migrations are
# written to be safe to re-run: every create uses IF NOT EXISTS or OR REPLACE.
#
#   ./scripts/db-setup.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "No .env.local found." >&2; exit 1
fi

DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | sed 's/^DATABASE_URL=//')

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set in .env.local." >&2; exit 1
fi
case "$DATABASE_URL" in
  *REPLACE_WITH_DB_PASSWORD*)
    echo "DATABASE_URL still has the placeholder password." >&2
    echo "Get it from Supabase > Project Settings > Database, and URL-encode" >&2
    echo "any special characters (# becomes %23, @ becomes %40)." >&2
    exit 1;;
esac

export PGCONNECT_TIMEOUT=15

echo "── connecting"
psql "$DATABASE_URL" -tAc 'select current_database()' >/dev/null
echo "   ok"

for f in supabase/migrations/*.sql; do
  echo "── $f"
  # ON_ERROR_STOP so a failed statement is not silently skipped, and a single
  # transaction so a half-applied migration never survives.
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f "$f"
  echo "   applied"
done

echo "── payload"
# Payload manages its own migration table inside the payload schema.
npx payload migrate 2>&1 | sed 's/^/   /'

echo
echo "── what is there now"
psql "$DATABASE_URL" -X -q <<'SQL'
\pset border 2
select
  c.relname                                as table,
  c.relrowsecurity                         as rls,
  (select count(*) from pg_index i where i.indrelid = c.oid) as indexes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

select count(*) as payload_tables
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'payload' and c.relkind = 'r';
SQL
