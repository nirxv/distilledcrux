#!/usr/bin/env node
/**
 * Check one translated note against its English source.
 *
 *   node scripts/i18n/validate-note.mjs sociology karl-marx
 *
 * Fails (exit 1) on: tag inventory mismatch, dropped/added list items, missing
 * headings or tables, visible English sentences, low Devanagari ratio, a length
 * far from the source, or leftover markdown fences. The report is written to
 * stdout so a translating agent can read it and repair the file.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [subject, slug] = process.argv.slice(2);
if (!subject || !slug) {
  console.error('usage: node scripts/i18n/validate-note.mjs <subject> <slug>');
  process.exit(1);
}

const ROOT = process.cwd();
const EN = join(ROOT, 'scripts', 'i18n', 'work', 'en', subject, `${slug}.html`);
const HI = join(ROOT, 'lib', 'noteContentHi', 'parts', subject, `${slug}.html`);

if (!existsSync(EN)) {
  console.error(`missing English extract. run: node scripts/i18n/extract.mjs ${subject} ${slug}`);
  process.exit(2);
}
if (!existsSync(HI)) {
  console.error(`missing Hindi file: ${HI}`);
  process.exit(2);
}

const en = readFileSync(EN, 'utf8');
const hi = readFileSync(HI, 'utf8');

const tagCount = (s) => {
  const out = {};
  for (const m of s.matchAll(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/g)) {
    const name = m[1].toLowerCase();
    out[name] = (out[name] || 0) + 1;
  }
  return out;
};

const errors = [];
const warnings = [];

// 1. Tag inventory.
const te = tagCount(en);
const th = tagCount(hi);
const names = new Set([...Object.keys(te), ...Object.keys(th)]);
const tagDiff = [...names].filter((n) => (te[n] || 0) !== (th[n] || 0));
if (tagDiff.length) {
  errors.push(
    'tag counts differ: ' + tagDiff.map((n) => `<${n}> en=${te[n] || 0} hi=${th[n] || 0}`).join(', '),
  );
}

// 2. Structural landmarks.
for (const tag of ['h2', 'h3', 'table', 'ul', 'ol', 'blockquote']) {
  const a = (en.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
  const b = (hi.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
  if (a !== b) errors.push(`<${tag}> count: en=${a} hi=${b}`);
}

// 3. Leftover English prose. Runs of 4+ Latin words outside attributes are the
// signal; names, book titles and abbreviations are short enough to pass.
const textOnly = hi
  .replace(/<[^>]*>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ');
// Parentheses are where the brief allows the English original to sit
// (`संस्कृतीकरण (Sanskritisation)`), so the leftover-English scan ignores them.
const proseOnly = textOnly.replace(/\([^)]*\)/g, ' ');
const latinRuns = [...proseOnly.matchAll(/(?:[A-Za-z][A-Za-z'’\-]*[ ,]+){4,}/g)]
  .map((m) => m[0].trim())
  .filter((run) => !/^(?:[A-Z][a-z]+ ){1,3}[A-Z]?$/.test(run));
if (latinRuns.length) {
  warnings.push(`possible English left: ${latinRuns.slice(0, 5).map((r) => JSON.stringify(r)).join(', ')}`);
}

// 4. Script and length.
const deva = (hi.match(/[\u0900-\u097F]/g) || []).length;
const latinLetters = (hi.match(/[A-Za-z]/g) || []).length;
const scriptRatio = deva / Math.max(1, deva + latinLetters);
if (scriptRatio < 0.7) errors.push(`Devanagari ratio too low: ${scriptRatio.toFixed(3)}`);
const lenRatio = hi.length / Math.max(1, en.length);
if (lenRatio < 0.65 || lenRatio > 1.75) errors.push(`length ratio out of range: ${lenRatio.toFixed(2)}`);

// 5. Markdown / fences / scripts.
if (/```/.test(hi)) errors.push('markdown code fence in output');
if (/<script/i.test(hi)) errors.push('<script> in output');

// 5b. English number and date words that should be Hindi.
const numberWords = textOnly.match(/\b(million|billion|trillion|percent)\b/gi);
if (numberWords) errors.push(`English number words left: ${[...new Set(numberWords.map((w) => w.toLowerCase()))].join(', ')}`);
const monthWords = textOnly.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g);
if (monthWords) errors.push(`English month names left: ${[...new Set(monthWords)].join(', ')}`);

// 5c. Institution and body names that UPSC Hindi always writes in Hindi.
// Acronyms (UN, UNSC, ECOSOC) stay in Latin and are not on this list.
const MUST_BE_HINDI = [
  'general assembly',
  'security council',
  'united nations',
  'secretary-general',
  'secretariat',
  'economic and social council',
  'international court of justice',
  'world bank',
  'international monetary fund',
  'world trade organization',
  'world health organization',
  'european union',
  'united states',
  'united kingdom',
  'general assembly',
];
const lowerProse = proseOnly.toLowerCase();
const leftInEnglish = [...new Set(MUST_BE_HINDI.filter((t) => lowerProse.includes(t)))];
if (leftInEnglish.length) errors.push(`institution names left in English: ${leftInEnglish.join(', ')}`);

// 6. Empty or suspicious placeholders.
if (/\b(TODO|TRANSLATE|\[\.\.\.\])\b/.test(hi)) errors.push('placeholder text in output');
if (textOnly.replace(/\s+/g, ' ').trim().length < 200) errors.push('output looks empty');

const fmt = (n) => n.toLocaleString('en-IN');
console.log(`\n${subject} / ${slug}`);
console.log(`  chars      en ${fmt(en.length)}  hi ${fmt(hi.length)}  (${(lenRatio * 100).toFixed(0)}%)`);
console.log(`  Devanagari ${(scriptRatio * 100).toFixed(1)}%`);
console.log(`  tags       ${Object.values(th).reduce((a, b) => a + b, 0)}`);
if (warnings.length) {
  console.log('\n  warnings');
  for (const w of warnings) console.log(`   - ${w}`);
}
if (errors.length) {
  console.log('\n  FAIL');
  for (const e of errors) console.log(`   - ${e}`);
  process.exit(1);
}
console.log('\n  PASS\n');
