#!/usr/bin/env node
/**
 * Write the translated card sides into Supabase.
 *
 *   node scripts/seed-flashcards-hi.mjs            # dry run, counts only
 *   node scripts/seed-flashcards-hi.mjs --write
 *
 * Reads lib/flashcardsHi/<subject>.json (written by cards-assemble) and updates
 * public.flashcards through psql, using DATABASE_URL from the environment.
 * The Postgres route avoids the Supabase JS client, which needs a native
 * WebSocket on Node 22+ and throws on Node 20.
 *
 * Requires supabase/migrations/011_flashcards_hindi.sql to have been applied.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const write = process.argv.includes('--write');
const ROOT = process.cwd();
const DIR = join(ROOT, 'lib', 'flashcardsHi');

if (!existsSync(DIR)) {
  console.error('no lib/flashcardsHi yet');
  process.exit(1);
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const rows = ['id,front_hi,back_hi'];
let total = 0;
for (const f of files) {
  const bank = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  for (const [id, t] of Object.entries(bank)) {
    rows.push([id, t.front, t.back].map(esc).join(','));
    total++;
  }
  console.log(`${f}: ${Object.keys(bank).length}`);
}
console.log(`total cards with Hindi: ${total}`);

if (!write) {
  console.log('dry run; pass --write to update Supabase');
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required with --write (node --env-file=.env.local)');
  process.exit(1);
}

const csv = join('/tmp', `flashcards_hi_${process.pid}.csv`);
writeFileSync(csv, rows.join('\n') + '\n');

const sql = `
begin;
create temp table hi_cards (id text primary key, front_hi text, back_hi text) on commit drop;
\\copy hi_cards from '${csv}' with (format csv, header true)
update public.flashcards f
set front_hi = h.front_hi, back_hi = h.back_hi
from hi_cards h
where f.id = h.id;
commit;
`;

const res = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'inherit' });
try { unlinkSync(csv); } catch { /* best effort */ }
if (res.status !== 0) process.exit(res.status ?? 1);
console.log('done');
