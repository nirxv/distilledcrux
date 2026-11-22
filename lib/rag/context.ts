import type { RagHit } from './retrieve';
import { groundingLine, type Fact } from './register';
import { unitTitle } from './plan';

/**
 * How retrieved passages and register rows are shown to the answering model.
 *
 * The first line of each block keeps the `[Source N — Title | Author: Name]`
 * shape the chat page and the citation chips already read. The second line is
 * what the old context lacked: the syllabus units the passage teaches and the
 * thinker or concept it is about, so a passage on Merton's anomie can no
 * longer pass for one on Durkheim's.
 */

export function formatPassages(hits: RagHit[]): string {
  return hits
    .map((h, i) => {
      const head = `[Source ${i + 1} — ${h.book_title} | Author: ${h.author}]`;
      // An untagged passage has nothing but its book to go on.
      if (!h.tagged || (!h.units.length && !h.context)) return `${head}\n${h.text}`;
      const units = h.units.map((u) => unitTitle(h.subject, u)).join('; ');
      const about = `About: ${[units, h.context].filter(Boolean).join('. ')}`;
      return `${head}\n${about}\n${h.text}`;
    })
    .join('\n\n---\n\n');
}

export function formatFacts(facts: Fact[]): string {
  return facts.map((f) => `- ${groundingLine(f)}`).join('\n');
}

/** What the chat page shows under an answer: book, author and the passage itself. */
export function sourcesForClient(hits: RagHit[]) {
  return hits.map((h) => ({ book_title: h.book_title, author: h.author, content: h.text }));
}
