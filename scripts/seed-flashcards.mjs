#!/usr/bin/env node
/**
 * Loads the flashcard decks into the `flashcards` table.
 *
 *   node scripts/seed-flashcards.mjs [deck folder]
 *
 * The deck folder holds one directory per optional, each with a cards.json
 * written by the flashcard pipeline (default: ~/Desktop/dc-design). The cards
 * are not kept in this repository on purpose: the repository is public, and the
 * answers are the paid half of the deck.
 *
 * Upserts on id, so re-running after a deck is edited updates the cards in
 * place and leaves every reader's unlocks and review state intact. A card
 * removed from a deck is not deleted here: archive it in the table instead, so
 * unlocks pointing at it are not cascaded away by accident.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const DECKS = {
  sociology: 'flashcards-sociology',
  anthropology: 'flashcards-anthropology',
  polsci: 'flashcards-psir',
  geography: 'flashcards-geography',
  'pub-admin': 'flashcards-pubadmin',
};
const TYPES = new Set(['thinker', 'concept', 'comparison', 'critique', 'study', 'fact']);

const root = process.argv[2] ?? path.join(os.homedir(), 'Desktop/dc-design');
const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');

const rows = [];
for (const [subject, dir] of Object.entries(DECKS)) {
  const file = path.join(root, dir, 'cards.json');
  const { cards } = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const c of cards) {
    if (!TYPES.has(c.type)) throw new Error(`${c.id}: unknown type ${c.type}`);
    if (!c.front || !c.back) throw new Error(`${c.id}: empty side`);
    rows.push({
      id: c.id,
      subject,
      topic: c.topic,
      topics: Array.isArray(c.topics) && c.topics.length ? c.topics : [c.topic],
      type: c.type,
      front: c.front,
      back: c.back,
      questions: Array.isArray(c.questions) ? c.questions : [],
      asked: Array.isArray(c.asked) ? c.asked : [],
      status: 'published',
    });
  }
  console.log(`${subject}: ${cards.length} cards`);
}

const ids = new Set();
for (const r of rows) {
  if (ids.has(r.id)) throw new Error(`duplicate id ${r.id}`);
  ids.add(r.id);
}

for (let i = 0; i < rows.length; i += 200) {
  const batch = rows.slice(i, i + 200);
  const res = await fetch(`${url}/rest/v1/flashcards?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(batch),
  });
  if (!res.ok) throw new Error(`batch ${i / 200 + 1}: ${res.status} ${await res.text()}`);
}
console.log(`upserted ${rows.length} cards`);
