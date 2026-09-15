import { paper1Notes as socP1, paper2Notes as socP2 } from './sociology';
import { paper1Notes as anthP1, paper2Notes as anthP2 } from './anthropology';
import { paper1Notes as polP1, paper2Notes as polP2 } from './polsci';
import { paper1Notes as geoP1, paper2Notes as geoP2 } from './geography';
import { paper1Notes as paP1, paper2Notes as paP2 } from './pub-admin';

export type { Note } from './sociology';

/**
 * Every subject declares the same note shape but none of them carried which
 * subject they belonged to. Nothing could therefore check that a slug and a
 * subject went together, which is why the note route used to prerender the
 * cartesian product of both: 790 pages, 632 of them a real note served under
 * the wrong subject with a title claiming otherwise.
 *
 * The subject is attached here rather than repeated on 158 objects, so it
 * cannot drift and there is one place to add the next subject.
 */
export const NOTE_SUBJECTS = [
  'sociology',
  'anthropology',
  'polsci',
  'geography',
  'pub-admin',
] as const;

export type NoteSubject = (typeof NOTE_SUBJECTS)[number];

type BaseNote = {
  slug: string;
  title: string;
  paper: 1 | 2;
  section: string;
  topic: number;
  subtopics?: string[];
  description: string;
};

export type SubjectNote = BaseNote & { subject: NoteSubject };

const tag = (subject: NoteSubject, notes: BaseNote[]): SubjectNote[] =>
  notes.map((n) => ({ ...n, subject }));

const BY_SUBJECT: Record<NoteSubject, SubjectNote[]> = {
  sociology:    tag('sociology', [...socP1, ...socP2]),
  anthropology: tag('anthropology', [...anthP1, ...anthP2]),
  polsci:       tag('polsci', [...polP1, ...polP2]),
  geography:    tag('geography', [...geoP1, ...geoP2]),
  'pub-admin':  tag('pub-admin', [...paP1, ...paP2]),
};

export const allNotes: SubjectNote[] = NOTE_SUBJECTS.flatMap((s) => BY_SUBJECT[s]);

export function isNoteSubject(value: string): value is NoteSubject {
  return (NOTE_SUBJECTS as readonly string[]).includes(value);
}

/** Notes for one subject, in reading order. Empty for an unknown subject. */
export function notesForSubject(subject: string): SubjectNote[] {
  return isNoteSubject(subject) ? BY_SUBJECT[subject] : [];
}

/**
 * A note only if it really belongs to that subject. Callers should treat null
 * as a 404 rather than falling back to a slug lookup across every subject.
 */
export function getNote(subject: string, slug: string): SubjectNote | null {
  return notesForSubject(subject).find((n) => n.slug === slug) ?? null;
}

/** What comes before and after a note within its own subject. */
export function getNoteNeighbours(subject: string, slug: string): {
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
} {
  const notes = notesForSubject(subject);
  const i = notes.findIndex((n) => n.slug === slug);
  if (i === -1) return { prev: null, next: null };
  const at = (j: number) =>
    notes[j] ? { slug: notes[j].slug, title: notes[j].title } : null;
  return { prev: at(i - 1), next: at(i + 1) };
}

/**
 * Slug lookup that ignores the subject. Kept for callers that genuinely only
 * have a slug; prefer getNote(subject, slug), which cannot return a note from
 * a different subject.
 */
export function getNoteBySlug(slug: string): SubjectNote | undefined {
  return allNotes.find((n) => n.slug === slug);
}
