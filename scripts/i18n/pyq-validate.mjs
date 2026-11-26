#!/usr/bin/env node
/**
 * Check one translated PYQ batch against its English slice.
 *
 *   node scripts/i18n/pyq-validate.mjs sociology 0 40
 *
 * Hindi file: scripts/i18n/work/pyq/hi/<subject>-<offset>-<count>.json
 * Shape: { "<id>": "हिंदी प्रश्न", ... }
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [subject, a, b] = process.argv.slice(2);
const offset = Math.max(0, Number(a) || 0);
const count = Math.min(100, Math.max(1, Number(b) || 40));
if (!subject) {
  console.error('usage: node scripts/i18n/pyq-validate.mjs <subject> <offset> <count>');
  process.exit(1);
}

const ROOT = process.cwd();
const stem = `${subject}-${String(offset).padStart(4, '0')}-${count}`;
const EN = join(ROOT, 'scripts', 'i18n', 'work', 'pyq', 'en', `${stem}.json`);
const HI = join(ROOT, 'scripts', 'i18n', 'work', 'pyq', 'hi', `${stem}.json`);

if (!existsSync(EN)) {
  console.error(`missing English slice: ${EN}. run pyq-extract first.`);
  process.exit(2);
}
if (!existsSync(HI)) {
  console.error(`missing Hindi file: ${HI}`);
  process.exit(2);
}

const en = JSON.parse(readFileSync(EN, 'utf8'));
const hi = JSON.parse(readFileSync(HI, 'utf8'));

const errors = [];
const ids = en.map((q) => String(q.id));
const got = Object.keys(hi);
const missing = ids.filter((id) => !got.includes(id));
const extra = got.filter((id) => !ids.includes(id));
if (missing.length) errors.push(`missing ids: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
if (extra.length) errors.push(`unknown ids: ${extra.slice(0, 10).join(', ')}${extra.length > 10 ? '…' : ''}`);

const DIRECTIVES = [
  [/^Critically (examine|analyse|analyze)/i, [/समालोचनात्मक/, /समालोचना/]],
  [/^Discuss/i, [/चर्चा/]],
  [/^Comment/i, [/टिप्पणी/]],
  [/^Elucidate/i, [/स्पष्ट/]],
  [/^Evaluate/i, [/मूल्यांकन/]],
  [/^Examine/i, [/परीक्षण/, /जाँच/, /समीक्षा/]],
  [/^Explain/i, [/व्याख्या/, /समझाइए/, /स्पष्ट/]],
  [/^Analyse|^Analyze/i, [/विश्लेषण/]],
  [/^Justify/i, [/औचित्य/, /न्यायसंगत/]],
  [/^Substantiate/i, [/पुष्टि/]],
];

let checked = 0;
for (const q of en) {
  const id = String(q.id);
  const h = hi[id];
  if (typeof h !== 'string' || !h.trim()) continue;
  checked++;

  const deva = (h.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (h.match(/[A-Za-z]/g) || []).length;
  if (deva / Math.max(1, deva + latin) < 0.45) errors.push(`#${id}: too little Devanagari`);

  const plain = h.replace(/\([^)]*\)/g, ' ');
  if (/(?:[A-Za-z][A-Za-z'’\-]*[ ,]+){4,}/.test(plain)) errors.push(`#${id}: English sentence left`);

  const enNums = (q.question.match(/\b\d+(?:\.\d+)?\b/g) || []);
  const hiNums = new Set(h.match(/\b\d+(?:\.\d+)?\b/g) || []);
  const lost = enNums.filter((n) => !hiNums.has(n));
  if (lost.length) errors.push(`#${id}: numbers lost (${lost.join(', ')})`);

  for (const [cue, wanted] of DIRECTIVES) {
    if (cue.test(q.question.trim()) && !wanted.some((re) => re.test(h))) {
      errors.push(`#${id}: directive "${q.question.trim().split(/\s+/).slice(0, 2).join(' ')}" not rendered in Hindi`);
      break;
    }
  }

  const ratio = h.length / Math.max(1, q.question.length);
  if (ratio < 0.55 || ratio > 2.0) errors.push(`#${id}: length ratio ${ratio.toFixed(2)}`);
}

console.log(`\n${subject} ${offset}–${offset + en.length - 1}: ${checked}/${en.length} translated`);
if (errors.length) {
  console.log(`FAIL (${errors.length})`);
  for (const e of errors.slice(0, 30)) console.log(`  - ${e}`);
  if (errors.length > 30) console.log(`  … ${errors.length - 30} more`);
  process.exit(1);
}
console.log('PASS\n');
