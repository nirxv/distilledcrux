#!/usr/bin/env node
/**
 * Coverage of the Hindi PYQ bank against the English source.
 *
 *   node scripts/i18n/pyq-coverage.mjs
 *   node scripts/i18n/pyq-coverage.mjs --strict
 *
 * Lists missing questions as id ranges, which is how batch-boundary tails get
 * caught (a 40-question slice at the end of a bank leaves the remainder out).
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SOURCES = {
  sociology: 'sociology-pyqs',
  anthropology: 'anthropology-pyqs',
  polsci: 'psir-pyqs',
  geography: 'geography-pyqs',
  'pub-admin': 'pubad-pyqs',
};
const HI = join(ROOT, 'scripts', 'i18n', 'work', 'pyq', 'hi');

const strict = process.argv.includes('--strict');
let totalMissing = 0;

for (const [subject, file] of Object.entries(SOURCES)) {
  const rows = JSON.parse(readFileSync(join(ROOT, 'public', 'data', `${file}.json`), 'utf8'));
  const source = rows.map((r) => String(r.id));
  const hi = {};
  if (existsSync(HI)) {
    for (const f of readdirSync(HI)) {
      if (!f.startsWith(`${subject}-`) || !f.endsWith('.json')) continue;
      Object.assign(hi, JSON.parse(readFileSync(join(HI, f), 'utf8')));
    }
  }
  const missing = source.filter((id) => hi[id] === undefined);
  totalMissing += missing.length;
  const pct = ((source.length - missing.length) / source.length) * 100;

  // Collapse missing ids into ranges for a readable report.
  const nums = missing.map(Number).sort((a, b) => a - b);
  const ranges = [];
  for (const n of nums) {
    const last = ranges[ranges.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else ranges.push([n, n]);
  }
  const shown = ranges.slice(0, 4).map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');

  console.log(
    `${subject.padEnd(11)} ${String(source.length - missing.length).padStart(4)}/${String(source.length).padEnd(4)} ` +
      `${pct.toFixed(1).padStart(5)}%` +
      (missing.length ? `   missing: ${shown}${ranges.length > 4 ? ` …+${ranges.length - 4} ranges` : ''}` : ''),
  );
}

if (totalMissing) {
  console.log(`\n${totalMissing} question(s) still untranslated.`);
  if (strict) process.exit(1);
} else {
  console.log('\nAll PYQs translated.');
}
