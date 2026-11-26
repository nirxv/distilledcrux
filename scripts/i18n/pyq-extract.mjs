#!/usr/bin/env node
/**
 * Slice one subject's past questions into a batch file for translation.
 *
 *   node scripts/i18n/pyq-extract.mjs sociology 0 40
 *
 * Writes scripts/i18n/work/pyq/en/<subject>-<offset>-<count>.json with only
 * what a translator needs: id, year, paper, marks, topic, question. Topic and
 * microtheme labels are collected separately by --topics.
 *
 *   node scripts/i18n/pyq-extract.mjs sociology --topics
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const SOURCES = {
  sociology: 'sociology-pyqs',
  anthropology: 'anthropology-pyqs',
  polsci: 'psir-pyqs',
  geography: 'geography-pyqs',
  'pub-admin': 'pubad-pyqs',
};

const [subject, a, b] = process.argv.slice(2);
if (!subject || !SOURCES[subject]) {
  console.error(`usage: node scripts/i18n/pyq-extract.mjs <${Object.keys(SOURCES).join('|')}> <offset> <count> | --topics`);
  process.exit(1);
}

const ROOT = process.cwd();
const rows = JSON.parse(readFileSync(join(ROOT, 'public', 'data', `${SOURCES[subject]}.json`), 'utf8'));
const outDir = join(ROOT, 'scripts', 'i18n', 'work', 'pyq', 'en');
mkdirSync(outDir, { recursive: true });

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

if (a === '--topics') {
  const topics = [...new Set(rows.map((r) => clean(r.topic)).filter(Boolean))].sort();
  const micro = [...new Set(rows.map((r) => clean(r.microtheme)).filter(Boolean))].sort();
  const out = join(outDir, `${subject}-topics.json`);
  writeFileSync(out, JSON.stringify({ topics, microthemes: micro }, null, 1) + '\n', 'utf8');
  console.log(out);
  console.log(`topics: ${topics.length}, microthemes: ${micro.length}`);
  process.exit(0);
}

const offset = Math.max(0, Number(a) || 0);
const count = Math.min(100, Math.max(1, Number(b) || 40));
const slice = rows.slice(offset, offset + count).map((r) => ({
  id: Number(r.id),
  year: String(r.year ?? ''),
  paper: String(r.paper ?? ''),
  marks: r.marks ?? null,
  topic: clean(r.topic),
  question: clean(r.question),
}));

const out = join(outDir, `${subject}-${String(offset).padStart(4, '0')}-${count}.json`);
writeFileSync(out, JSON.stringify(slice, null, 1) + '\n', 'utf8');
console.log(out);
console.log(`questions: ${slice.length} (offset ${offset}, total ${rows.length})`);
