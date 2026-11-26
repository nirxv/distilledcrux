#!/usr/bin/env node
/**
 * Check a translated flashcard batch.
 *
 *   node scripts/i18n/cards-validate.mjs sociology 0 40
 *
 * Hindi file: scripts/i18n/work/cards/hi/<subject>-<offset>-<count>.json
 * Shape: { "<id>": { "front": "...", "back": "..." } }
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [subject, a, b] = process.argv.slice(2);
const offset = Math.max(0, Number(a) || 0);
const count = Math.min(60, Math.max(1, Number(b) || 40));
const stem = `${subject}-${String(offset).padStart(4, '0')}-${count}`;

const ROOT = process.cwd();
const EN = join(ROOT, 'scripts', 'i18n', 'work', 'cards', 'en', `${stem}.json`);
const HI = join(ROOT, 'scripts', 'i18n', 'work', 'cards', 'hi', `${stem}.json`);
if (!existsSync(HI)) {
  console.error(`missing ${HI}`);
  process.exit(2);
}

const en = JSON.parse(readFileSync(EN, 'utf8'));
const hi = JSON.parse(readFileSync(HI, 'utf8'));
const ids = en.map((c) => c.id);
const errors = [];

const missing = ids.filter((id) => !hi[id]);
if (missing.length) errors.push(`missing ${missing.length} ids: ${missing.slice(0, 5).join(', ')}`);
const extra = Object.keys(hi).filter((id) => !ids.includes(id));
if (extra.length) errors.push(`unknown ids: ${extra.slice(0, 5).join(', ')}`);

const devaRatio = (s) => {
  const deva = (s.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  return deva / Math.max(1, deva + latin);
};

for (const c of en) {
  const t = hi[c.id];
  if (!t) continue;
  for (const side of ['front', 'back']) {
    const v = t[side];
    if (typeof v !== 'string' || !v.trim()) {
      errors.push(`${c.id}: empty ${side}`);
      continue;
    }
    if (devaRatio(v) < 0.5) errors.push(`${c.id}: ${side} not Hindi enough`);
    if (/(?:[A-Za-z][A-Za-z'’\-]*[ ,]+){4,}/.test(v.replace(/\([^)]*\)/g, ' '))) {
      errors.push(`${c.id}: English sentence left in ${side}`);
    }
  }
  // Bullets and line structure carry meaning in the answer side.
  const enBullets = (c.back.match(/•/g) || []).length;
  const hiBullets = ((hi[c.id]?.back ?? '').match(/•/g) || []).length;
  if (enBullets !== hiBullets) errors.push(`${c.id}: bullets ${hiBullets} != ${enBullets}`);
  const enLines = c.back.split('\n').filter((x) => x.trim()).length;
  const hiLines = (hi[c.id]?.back ?? '').split('\n').filter((x) => x.trim()).length;
  if (Math.abs(enLines - hiLines) > 2) errors.push(`${c.id}: answer lines ${hiLines} vs ${enLines}`);
}

console.log(`\n${subject} cards ${offset}–${offset + en.length - 1}: ${Object.keys(hi).length}/${en.length}`);
if (errors.length) {
  console.log(`FAIL (${errors.length})`);
  for (const e of errors.slice(0, 25)) console.log(`  - ${e}`);
  process.exit(1);
}
console.log('PASS\n');
