#!/usr/bin/env node
/**
 * Keep the bulk corpora out of the browser.
 *
 *   node scripts/i18n/guard.mjs
 *
 * The note bodies, the PYQ banks and the note catalogues are megabytes of
 * strings. A client component that imports one of them ships the whole corpus
 * to every reader of that page — the bug this project has paid for twice.
 * This fails the build if any 'use client' file imports one.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const FORBIDDEN = [
  /from\s+['"]@\/lib\/noteContent['"]/,
  /from\s+['"]@\/lib\/noteContentHi['"]/,
  /from\s+['"]@\/lib\/noteContentHi\//,
  /from\s+['"]@\/lib\/pyqHi['"]/,
  /from\s+['"]@\/lib\/pyqHi\//,
  /from\s+['"]@\/lib\/notesHi['"]/,
  /from\s+['"]@\/lib\/notesHi\//,
  /from\s+['"]@\/lib\/toppers['"]/,
  /from\s+['"]@\/lib\/toppers\/index['"]/,
  /from\s+['"]@\/lib\/toppers\/[^'"]+\.json['"]/,
  /import\(\s*['"]@\/lib\/noteContent/, 
  /import\(\s*['"]@\/lib\/pyqHi/, 
  /import\(\s*['"]@\/lib\/notesHi/,
];

const SKIP = new Set(['node_modules', '.next', '.git', '.kilo', 'scripts']);
const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!/\.(tsx?|mts)$/.test(entry)) continue;
    const src = readFileSync(p, 'utf8');
    if (!/^\s*['"]use client['"]/.test(src.slice(0, 200))) continue;
    for (const re of FORBIDDEN) {
      if (re.test(src)) hits.push(`${relative(ROOT, p)} imports ${re}`);
    }
  }
}

for (const dir of ['app', 'components', 'hooks', 'lib']) {
  try { walk(join(ROOT, dir)); } catch { /* absent dir is fine */ }
}

if (hits.length) {
  console.error('\nClient bundle would include a server corpus:');
  for (const h of hits) console.error(`  - ${h}`);
  console.error('\nMove the import to a server component or an API route.\n');
  process.exit(1);
}
console.log('i18n guard: no client file imports a server corpus');
