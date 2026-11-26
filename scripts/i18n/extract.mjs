#!/usr/bin/env node
/**
 * Pull one English note body out of lib/noteContent/<subject>.ts and write it
 * to scripts/i18n/work/en/<subject>/<slug>.html, so a translator works on
 * plain HTML instead of a TS template literal.
 *
 *   node scripts/i18n/extract.mjs sociology karl-marx
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const [subject, slug] = process.argv.slice(2);
if (!subject || !slug) {
  console.error('usage: node scripts/i18n/extract.mjs <subject> <slug>');
  process.exit(1);
}

const ROOT = process.cwd();
const SRC = join(ROOT, 'lib', 'noteContent', `${subject}.ts`);
let source;
try {
  source = readFileSync(SRC, 'utf8');
} catch {
  console.error(`no such subject file: ${SRC}`);
  process.exit(1);
}

const re = new RegExp("^\\s+'" + slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':\\s*`([\\s\\S]*?)`\\s*,?\\s*$", 'm');
const match = source.match(re);
if (!match) {
  console.error(`slug not found: ${slug} (in ${subject})`);
  const keys = [...source.matchAll(/^\s+'([^']+)':\s*`/gm)].map((m) => m[1]);
  console.error('available:', keys.join(', '));
  process.exit(1);
}

const out = join(ROOT, 'scripts', 'i18n', 'work', 'en', subject, `${slug}.html`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, match[1].trim() + '\n', 'utf8');
console.log(out);
console.log(`chars: ${match[1].trim().length}`);
