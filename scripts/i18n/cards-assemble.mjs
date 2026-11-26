#!/usr/bin/env node
/**
 * Merge translated flashcard batches into lib/flashcardsHi/<subject>.json.
 *
 *   node scripts/i18n/cards-assemble.mjs [subject]
 *
 * Shape: { "<card id>": { "front": "...", "back": "..." } }
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SUBJECTS = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'];
const only = process.argv[2];
if (only && !SUBJECTS.includes(only)) {
  console.error(`unknown subject: ${only}`);
  process.exit(1);
}

const DIR = join(ROOT, 'scripts', 'i18n', 'work', 'cards', 'hi');
const OUT = join(ROOT, 'lib', 'flashcardsHi');
mkdirSync(OUT, { recursive: true });

for (const subject of SUBJECTS) {
  if (only && subject !== only) continue;
  const files = existsSync(DIR)
    ? readdirSync(DIR).filter((f) => f.startsWith(`${subject}-`) && f.endsWith('.json'))
    : [];
  const bank = {};
  for (const f of files) Object.assign(bank, JSON.parse(readFileSync(join(DIR, f), 'utf8')));
  if (!Object.keys(bank).length) continue;
  writeFileSync(join(OUT, `${subject}.json`), JSON.stringify(bank, null, 1) + '\n', 'utf8');
  console.log(`${subject}: ${Object.keys(bank).length} cards -> lib/flashcardsHi/${subject}.json`);
}
