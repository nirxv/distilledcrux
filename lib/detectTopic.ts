import { notesForSubject } from './notes';
import type { SubjectKey } from './subjectConfig';

/**
 * Words that sit in note titles without saying which topic a question is on.
 * "Indian Society: Structure" should not claim every question that mentions
 * India, nor "Sociology: The Discipline" every question that says sociology.
 */
const GENERIC = new Set([
  'sociology', 'sociological', 'society', 'social', 'anthropology', 'anthropological',
  'political', 'politics', 'theory', 'theories', 'india', 'indian', 'public',
  'administration', 'administrative', 'geography', 'geographical', 'world',
  'concepts', 'approaches', 'nature', 'scope', 'system', 'systems', 'study',
  'studies', 'introduction', 'modern', 'contemporary', 'issues', 'relations',
  'government', 'development',
]);

const words = (text: string) =>
  text.toLowerCase().split(/[^a-z\u00c0-\u024f]+/).filter((w) => w.length > 4 && !GENERIC.has(w));

/**
 * The notes topic a question is about, within one subject, or null when
 * nothing in it points anywhere in particular.
 *
 * Scored the way history-optional scores it — a distinctive title word counts
 * 2, a subtopic named in full counts 3, and one title word is enough — plus 1
 * for each distinctive word of a subtopic, so "What did Simon mean by bounded
 * rationality?" finds the note whose subtopic is "Simon's Bounded
 * Rationality" without quoting it exactly. Words are matched whole, so
 * "caste" does not find "broadcaster".
 */
export function detectTopic(question: string, subject: SubjectKey): { slug: string; title: string } | null {
  const q = question.toLowerCase();
  const has = new Set(q.split(/[^a-z\u00c0-\u024f]+/));

  let best: { slug: string; title: string } | null = null;
  let bestScore = 0;

  for (const note of notesForSubject(subject)) {
    let score = 0;
    for (const w of new Set(words(note.title))) if (has.has(w)) score += 2;
    for (const sub of note.subtopics ?? []) {
      const phrase = sub.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim();
      if (phrase.length > 3 && q.includes(phrase)) score += 3;
    }
    for (const w of new Set((note.subtopics ?? []).flatMap(words))) if (has.has(w)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = { slug: note.slug, title: note.title };
    }
  }

  return bestScore >= 2 ? best : null;
}
