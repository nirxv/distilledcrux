#!/usr/bin/env node
/**
 * Check translated note metadata for one subject.
 *
 *   node scripts/i18n/meta-validate.mjs sociology
 *
 * English: scripts/i18n/work/meta/en/<subject>.json
 * Hindi:   scripts/i18n/work/meta/hi/<subject>.json
 * Shape:   { sections: { "<en>": "हिंदी" },
 *            notes: { "<slug>": { title, description, subtopics: [] } } }
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const subject = process.argv[2];
if (!subject) {
  console.error('usage: node scripts/i18n/meta-validate.mjs <subject>');
  process.exit(1);
}

const ROOT = process.cwd();
const EN = join(ROOT, 'scripts', 'i18n', 'work', 'meta', 'en', `${subject}.json`);
const HI = join(ROOT, 'scripts', 'i18n', 'work', 'meta', 'hi', `${subject}.json`);
if (!existsSync(HI)) {
  console.error(`missing ${HI}`);
  process.exit(2);
}

const en = JSON.parse(readFileSync(EN, 'utf8'));
const hi = JSON.parse(readFileSync(HI, 'utf8'));
const errors = [];

const missingSections = en.sections.filter((s) => !hi.sections?.[s]);
if (missingSections.length) errors.push(`missing sections: ${missingSections.join(' | ')}`);

const missingNotes = en.notes.filter((n) => !hi.notes?.[n.slug]);
if (missingNotes.length) errors.push(`missing notes: ${missingNotes.slice(0, 5).map((n) => n.slug).join(', ')}${missingNotes.length > 5 ? '…' : ''}`);

const extra = Object.keys(hi.notes ?? {}).filter((s) => !en.notes.some((n) => n.slug === s));
if (extra.length) errors.push(`unknown notes: ${extra.slice(0, 5).join(', ')}`);

const devaRatio = (s) => {
  const deva = (s.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  return deva / Math.max(1, deva + latin);
};

for (const n of en.notes) {
  const t = hi.notes?.[n.slug];
  if (!t) continue;
  if (!t.title || devaRatio(t.title) < 0.3) errors.push(`${n.slug}: title not Hindi`);
  if (!t.description || devaRatio(t.description) < 0.5) errors.push(`${n.slug}: description not Hindi`);
  if (!Array.isArray(t.subtopics) || t.subtopics.length !== n.subtopics.length) {
    errors.push(`${n.slug}: subtopic count ${t.subtopics?.length ?? 0} != ${n.subtopics.length}`);
  }
}

console.log(`\n${subject}: ${en.notes.length} notes, ${en.sections.length} sections`);
if (errors.length) {
  console.log(`FAIL (${errors.length})`);
  for (const e of errors.slice(0, 20)) console.log(`  - ${e}`);
  process.exit(1);
}
console.log('PASS\n');
