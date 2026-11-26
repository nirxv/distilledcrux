#!/usr/bin/env node
/**
 * Hindi coverage across the site's content.
 *
 * Reads the English sources and the Hindi files and reports, per subject, how
 * many notes, PYQs, flashcards and topper questions have a Hindi version. Used
 * while translating, and later in CI with --strict so a new note cannot ship
 * without its Hindi twin.
 *
 *   node scripts/i18n/coverage.mjs
 *   node scripts/i18n/coverage.mjs --strict
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SUBJECTS = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'];
const PYQ_FILES = {
  sociology: 'sociology-pyqs',
  anthropology: 'anthropology-pyqs',
  polsci: 'psir-pyqs',
  geography: 'geography-pyqs',
  'pub-admin': 'pubad-pyqs',
};

const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : '');

/** Keys of a `slug: \`…\`` map, in file order. */
const keysOf = (src) =>
  [...src.matchAll(/^\s+'([^']+)':\s*`/gm)].map((m) => m[1]);

/** Char sizes of a `slug: \`…\`` map. */
const sizesOf = (src) =>
  Object.fromEntries(
    [...src.matchAll(/^\s+'([^']+)':\s*`([\s\S]*?)`\s*,?\s*$/gm)].map((m) => [m[1], m[2].length]),
  );

const bar = (done, total, width = 22) => {
  const filled = total ? Math.round((done / total) * width) : width;
  return '█'.repeat(filled) + '░'.repeat(width - filled);
};
const pct = (done, total) => (total ? `${Math.round((done / total) * 100)}%` : '—');
const n = (x) => x.toLocaleString('en-IN');

let strictFailures = 0;
const rows = [];

for (const subject of SUBJECTS) {
  const enSrc = read(`lib/noteContent/${subject}.ts`);
  const hiSrc = read(`lib/noteContentHi/${subject}.ts`);
  const en = sizesOf(enSrc);
  const hi = sizesOf(hiSrc);
  const doneKeys = Object.keys(en).filter((k) => hi[k]);
  const doneChars = doneKeys.reduce((sum, k) => sum + en[k], 0);
  const totalChars = Object.values(en).reduce((a, b) => a + b, 0);

  if (Object.keys(en).length === 0) continue;

  rows.push({
    kind: 'notes',
    subject,
    done: doneKeys.length,
    total: Object.keys(en).length,
    extra: `${n(doneChars)} / ${n(totalChars)} chars`,
    missing: Object.keys(en).filter((k) => !hi[k]),
  });
}

// PYQs + flashcards + topper questions are counted when their files exist.
const have = (p) => existsSync(join(ROOT, p));

const pyqHi = have('lib/pyqHi/index.ts') ? 'present' : 'not started';
const cardsHi = have('supabase/migrations/011_flashcards_hindi.sql') ? 'schema only' : 'not started';
const topperHi = have('lib/topperQuestionsHi.ts') ? 'present' : 'not started';
const uiHi = have('lib/i18n/LangContext.tsx') ? 'started' : 'not started';

console.log('\nHindi coverage — Distilled Crux\n');

let notesDone = 0;
let notesTotal = 0;
for (const subject of SUBJECTS) {
  const r = rows.find((x) => x.subject === subject);
  if (!r) continue;
  notesDone += r.done;
  notesTotal += r.total;
  console.log(
    `${subject.padEnd(11)} ${bar(r.done, r.total)}  ${String(r.done).padStart(3)}/${String(r.total).padEnd(3)} ` +
      `${pct(r.done, r.total).padStart(4)}   ${r.extra}`,
  );
  if (r.missing.length) {
    console.log(`            missing: ${r.missing.slice(0, 6).join(', ')}${r.missing.length > 6 ? ` …+${r.missing.length - 6}` : ''}`);
  }
  if (process.argv.includes('--strict') && r.missing.length) strictFailures += r.missing.length;
}
console.log(`\n${''.padEnd(11)} ${bar(notesDone, notesTotal)}  ${notesDone}/${notesTotal} ${pct(notesDone, notesTotal)}   notes`);
console.log(`PYQs            ${pyqHi}`);
console.log(`flashcards      ${cardsHi}`);
console.log(`topper Qs       ${topperHi}`);
console.log(`UI strings      ${uiHi}\n`);

if (process.argv.includes('--strict') && strictFailures) {
  console.error(`${strictFailures} note(s) without a Hindi version.`);
  process.exit(1);
}
