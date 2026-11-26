#!/usr/bin/env node
/**
 * Slice a flashcard deck for translation.
 *
 *   node scripts/i18n/cards-extract.mjs sociology 0 40
 *
 * Decks live outside the repo (written by the card pipeline):
 *   ~/Desktop/dc-design/flashcards-<subject>/cards.json
 * Override with DC_DECKS=/path.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DECKS = {
  sociology: 'flashcards-sociology',
  anthropology: 'flashcards-anthropology',
  polsci: 'flashcards-psir',
  geography: 'flashcards-geography',
  'pub-admin': 'flashcards-pubadmin',
};

const [subject, a, b] = process.argv.slice(2);
if (!subject || !DECKS[subject] || a === undefined) {
  console.error(`usage: node scripts/i18n/cards-extract.mjs <${Object.keys(DECKS).join('|')}> <offset> <count>`);
  process.exit(1);
}

const ROOT = process.cwd();
const base = process.env.DC_DECKS || join(homedir(), 'Desktop', 'dc-design');
const deck = JSON.parse(readFileSync(join(base, DECKS[subject], 'cards.json'), 'utf8'));
const cards = Array.isArray(deck) ? deck : deck.cards;

const offset = Math.max(0, Number(a) || 0);
const count = Math.min(60, Math.max(1, Number(b) || 40));
const slice = cards.slice(offset, offset + count).map((c) => ({
  id: c.id,
  front: c.front,
  back: c.back,
}));

const dir = join(ROOT, 'scripts', 'i18n', 'work', 'cards', 'en');
mkdirSync(dir, { recursive: true });
const out = join(dir, `${subject}-${String(offset).padStart(4, '0')}-${count}.json`);
writeFileSync(out, JSON.stringify(slice, null, 1) + '\n', 'utf8');
console.log(out);
console.log(`cards: ${slice.length} (offset ${offset}, deck total ${cards.length})`);
