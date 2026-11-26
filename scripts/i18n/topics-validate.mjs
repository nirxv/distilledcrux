#!/usr/bin/env node
/**
 * Check translated PYQ topic / microtheme labels for one subject.
 *
 *   node scripts/i18n/topics-validate.mjs anthropology
 *
 * English: scripts/i18n/work/pyq/en/<subject>-topics.json  { topics[], microthemes[] }
 * Hindi:   scripts/i18n/work/pyq/hi/<subject>-topics.json  { "<English>": "हिंदी" }
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const subject = process.argv[2];
if (!subject) {
  console.error('usage: node scripts/i18n/topics-validate.mjs <subject>');
  process.exit(1);
}

const ROOT = process.cwd();
const EN = join(ROOT, 'scripts', 'i18n', 'work', 'pyq', 'en', `${subject}-topics.json`);
const HI = join(ROOT, 'scripts', 'i18n', 'work', 'pyq', 'hi', `${subject}-topics.json`);

if (!existsSync(HI)) {
  console.error(`missing ${HI}`);
  process.exit(2);
}

const { topics, microthemes } = JSON.parse(readFileSync(EN, 'utf8'));
const hi = JSON.parse(readFileSync(HI, 'utf8'));
const all = [...new Set([...topics, ...microthemes])];

const missing = all.filter((k) => !hi[k] || !String(hi[k]).trim());
const extra = Object.keys(hi).filter((k) => !all.includes(k));
const errors = [];
if (missing.length) errors.push(`missing ${missing.length}: ${missing.slice(0, 6).join(' | ')}`);
if (extra.length) errors.push(`unknown keys ${extra.length}: ${extra.slice(0, 6).join(' | ')}`);

for (const k of all) {
  const v = hi[k];
  if (typeof v !== 'string') continue;
  const deva = (v.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (v.match(/[A-Za-z]/g) || []).length;
  if (deva / Math.max(1, deva + latin) < 0.5) errors.push(`"${k}": too little Devanagari`);
  if (/(?:[A-Za-z][A-Za-z'’\-]*[ ,]+){4,}/.test(v.replace(/\([^)]*\)/g, ' '))) {
    errors.push(`"${k}": English left in value`);
  }
}

console.log(`\n${subject}: ${Object.keys(hi).length}/${all.length} labels`);
if (errors.length) {
  console.log(`FAIL (${errors.length})`);
  for (const e of errors.slice(0, 20)) console.log(`  - ${e}`);
  process.exit(1);
}
console.log('PASS\n');
