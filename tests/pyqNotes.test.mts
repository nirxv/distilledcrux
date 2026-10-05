import fs from 'node:fs';
import { notesForSubject } from '../lib/notes/index';

/**
 * lib/pyqNotes.json places every past question on a notes topic. It is a
 * reading of each question, not something derived at build time, so these
 * checks keep it in step with the two things it points into: a question added
 * to a PYQ file without a place fails here rather than silently missing from
 * the chat, and a renamed note slug fails rather than emptying its list.
 */

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got).slice(0, 400)}\n        want: ${JSON.stringify(want)}`);
};

const FILES: Record<string, string> = {
  sociology: 'public/data/sociology-pyqs.json',
  anthropology: 'public/data/anthropology-pyqs.json',
  polsci: 'public/data/psir-pyqs.json',
  geography: 'public/data/geography-pyqs.json',
  'pub-admin': 'public/data/pubad-pyqs.json',
};

const map = JSON.parse(fs.readFileSync('lib/pyqNotes.json', 'utf8')) as Record<string, { topics: Record<string, number[]>; unplaced: number[] }>;

eq('one entry per subject', Object.keys(map).sort(), Object.keys(FILES).sort());

for (const [subject, file] of Object.entries(FILES)) {
  console.log(`\n${subject}`);
  const { topics, unplaced } = map[subject];
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as { id: number; paper: string }[];
  const ids = new Set(rows.map((r) => r.id));
  const slugs = new Set(notesForSubject(subject).map((n) => n.slug));

  eq('every topic is a note of this subject', Object.keys(topics).filter((s) => !slugs.has(s)), []);
  const placed = Object.values(topics).flat();
  eq('every placed id is a question in the file', [...new Set([...placed, ...unplaced])].filter((id) => !ids.has(id)), []);
  const seen = new Set([...placed, ...unplaced]);
  eq('every question is placed or listed as unplaced', rows.filter((r) => !seen.has(r.id)).map((r) => r.id), []);
  eq('no question is both placed and unplaced', unplaced.filter((id) => placed.includes(id)), []);
  const count = new Map<number, number>();
  for (const id of placed) count.set(id, (count.get(id) ?? 0) + 1);
  eq('no question sits on more than two topics', [...count].filter(([, n]) => n > 2).map(([id]) => id), []);
  eq('no topic lists a question twice', Object.entries(topics).filter(([, l]) => new Set(l).size !== l.length).map(([s]) => s), []);
}

if (fails) { console.log(`\n${fails} failing`); process.exit(1); }
console.log('\nall passing');
