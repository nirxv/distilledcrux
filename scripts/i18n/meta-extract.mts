/**
 * Dump the note catalogue (titles, descriptions, subtopics, sections) for
 * translation.
 *
 *   npx tsx scripts/i18n/meta-extract.mts
 *
 * Writes scripts/i18n/work/meta/en/<subject>.json.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { allNotes, NOTE_SUBJECTS } from '../../lib/notes/index';

const ROOT = process.cwd();
const dir = join(ROOT, 'scripts', 'i18n', 'work', 'meta', 'en');
mkdirSync(dir, { recursive: true });

for (const subject of NOTE_SUBJECTS) {
  const notes = allNotes.filter((n) => n.subject === subject);
  const sections = [...new Set(notes.map((n) => n.section))];
  const payload = {
    sections,
    notes: notes.map((n) => ({
      slug: n.slug,
      title: n.title,
      description: n.description,
      subtopics: n.subtopics ?? [],
    })),
  };
  const out = join(dir, `${subject}.json`);
  writeFileSync(out, JSON.stringify(payload, null, 1) + '\n', 'utf8');
  console.log(`${subject}: ${notes.length} notes, ${sections.length} sections -> ${out}`);
}
