import type { SubjectKey } from '@/lib/subjectConfig';
import { fold, namePattern, thinkerOf, uniqueFactsNamedIn, type Fact } from './register';

/**
 * Checks a finished answer against the optional's key-facts register.
 *
 * It reports what it can prove wrong and says nothing about the rest:
 *  - a work or concept put in another thinker's hands, when the sentence
 *    says so in so many words ("Weber's Division of Labour", "anomie, coined
 *    by Weber", "Weber's concept of anomie");
 *  - a year given for a work, an event or a thinker's life that does not fit
 *    the register, when the sentence names exactly one such row and gives one
 *    year (or, for a thinker, a "(1858–1917)" pair).
 * Sentences that name two works, or no thinker, are left alone. A mismatch
 * against a row nobody has verified against the books is a warning; against a
 * verified row, an error.
 */

export type FactIssue = {
  severity: 'error' | 'warning';
  kind: 'attribution' | 'year';
  sentence: string;
  said: string;
  fact: Fact;
};

const YEAR = /(?<!\d)(1[5-9]\d{2}|20[0-2]\d)(?!\d)/g;

function yearsIn(s: string): number[] {
  return [...s.matchAll(YEAR)].map((m) => Number(m[1]));
}

const fits = (y: number, f: Fact) => f.y0 !== null && y >= f.y0 - f.tolerance && y <= (f.y1 ?? f.y0) + f.tolerance;

const surname = (f: Fact) => fold(f.name).split(/\s+/).pop()!.toLowerCase();

/** Does the sentence put `item` (a work or concept) in thinker `t`'s hands? */
function attributes(sentence: string, t: Fact, item: Fact): boolean {
  const T = `(?:${namePattern(t)})`;
  const W = `["“‘']?(?:${namePattern(item)})`;
  const filler = `(?:[A-Za-z-]+\\s+){0,3}`;
  const pats = item.kind === 'work'
    ? [
        `${T}['’]s\\s+${filler}${W}`,
        `${W}["”’']?\\s*(?:\\(\\d{4}\\))?,?\\s+(?:was\\s+)?(?:written\\s+|authored\\s+|published\\s+)?by\\s+${T}`,
        `${T}\\s+(?:wrote|authored|published|penned)\\s+${filler}${W}`,
        `${T},?\\s+in\\s+(?:his|her|their)\\s+${filler}${W}`,
      ]
    : [
        `${T}['’]s\\s+(?:[A-Za-z-]+\\s+){0,2}(?:concept|theory|notion|idea|thesis|model|law)\\s+of\\s+(?:the\\s+)?${W}`,
        `${W}["”’']?,?\\s+(?:a\\s+(?:term|concept|idea)\\s+)?(?:was\\s+)?(?:coined|introduced|propounded|formulated|proposed|developed|given|first\\s+used)\\s+by\\s+${T}`,
        `${T}\\s+(?:coined|introduced|propounded|formulated|proposed|gave|first\\s+used)\\s+(?:the\\s+)?(?:term|concept|idea|notion|theory\\s+of)?\\s*${W}`,
      ];
  return pats.some((p) => new RegExp(p, 'i').test(sentence));
}

export function checkFacts(answer: string, subject: SubjectKey): FactIssue[] {
  const issues: FactIssue[] = [];
  for (const raw of answer.split(/(?<=[.!?;])\s+(?=[A-Z(*"“])|\n+/)) {
    const sentence = raw.trim();
    if (sentence.length < 12) continue;
    const s = fold(sentence);
    const named = uniqueFactsNamedIn(sentence, subject);
    const thinkers = named.filter((f) => f.kind === 'thinker');
    const works = named.filter((f) => f.kind === 'work');
    const concepts = named.filter((f) => f.kind === 'concept');
    const events = named.filter((f) => f.kind === 'event');
    const severity = (f: Fact): FactIssue['severity'] => (f.verified ? 'error' : 'warning');

    // Attribution: exactly one thinker and one work or concept, put together.
    if (thinkers.length === 1) {
      const t = thinkers[0];
      for (const item of [...(works.length === 1 ? works : []), ...(concepts.length === 1 ? concepts : [])]) {
        const owner = thinkerOf(item);
        if (!owner || owner.id === t.id) continue;
        // A note naming the other thinker means the books link them ("Merton reworked anomie").
        if (fold(item.note).toLowerCase().includes(surname(t))) continue;
        if (attributes(s, t, item)) {
          issues.push({ severity: severity(item), kind: 'attribution', sentence, said: `credits ${item.name} to ${t.name}; register has ${owner.name}`, fact: item });
        }
      }
    }

    const years = yearsIn(s);
    // A thinker's life: "Durkheim (1858–1917)".
    for (const t of thinkers) {
      const m = s.match(new RegExp(`(?:${namePattern(t)})\\s*\\(\\s*(?:b\\.\\s*)?(\\d{4})\\s*[-–—]\\s*(\\d{4})\\s*\\)`, 'i'));
      if (!m || !t.start) continue;
      const [b, d] = [Number(m[1]), Number(m[2])];
      const wrongBirth = Math.abs(b - t.start[0]) > t.tolerance;
      const wrongDeath = t.end ? Math.abs(d - t.end[0]) > t.tolerance : false;
      if (wrongBirth || wrongDeath) {
        issues.push({ severity: severity(t), kind: 'year', sentence, said: `says ${b}–${d}; register has ${t.display}`, fact: t });
      }
    }
    // One dated work or event and one year.
    const dated = [...works, ...events].filter((f) => f.y0 !== null);
    if (dated.length === 1 && years.length === 1) {
      const f = dated[0];
      const y = years[0];
      // The year may be some other named row's: a thinker's birth or death
      // year (not any year of the life), a concept's coining, an event's span.
      const other = named.some((g) => g.id !== f.id && g.y0 !== null &&
        (g.kind === 'thinker' ? g.start?.[0] === y || g.end?.[0] === y : fits(y, g)));
      if (!fits(y, f) && !other) {
        issues.push({ severity: severity(f), kind: 'year', sentence, said: `says ${y}; register has ${f.display}`, fact: f });
      }
    }
  }
  return issues;
}
