import data from './register.json';
import type { SubjectKey } from '@/lib/subjectConfig';

/**
 * Each optional's key-facts register: its core thinkers (with birth and death
 * years), their major works (with first publication years), the concepts the
 * books credit to them, and the few dated events the optional has (the 73rd
 * Amendment, the Minnowbrook conferences, the Mandal Commission).
 *
 * It does three jobs at chat time: it tells the search which thinkers and
 * concepts a question names, it gives the answering model facts to use instead
 * of its memory, and it checks the finished answer for works or concepts put
 * in the wrong thinker's hands and for wrong years (factCheck.ts).
 *
 * The source is scripts/rag/register/<optional>.csv. Edit it, then run
 * `python3 scripts/rag/build_runtime_data.py` to rewrite register.json and the
 * unit vectors. A row's `verified` column names the books that state it; the
 * fact check reports against unverified rows only as warnings.
 */

export type FactKind = 'thinker' | 'work' | 'concept' | 'event';
type Ymd = [number, number | null, number | null];

export type Fact = {
  id: string;
  subject: SubjectKey;
  kind: FactKind;
  units: string[];
  name: string;
  aliases: string[];
  /** For a work or concept, the id of its thinker's row in the same optional. */
  thinker: string;
  start: Ymd | null;
  end: Ymd | null;
  y0: number | null;
  y1: number | null;
  precision: 'day' | 'month' | 'year' | 'circa' | 'contested';
  tolerance: number;
  summary: string;
  note: string;
  verified: string;
  display: string;
};

export const FACTS = (data as { facts: Fact[] }).facts;

const key = (subject: string, id: string) => `${subject}:${id}`;
const BY_KEY = new Map(FACTS.map((f) => [key(f.subject, f.id), f]));

export function fact(subject: SubjectKey, id: string): Fact | undefined {
  return BY_KEY.get(key(subject, id));
}

/** The thinker a work or concept belongs to. */
export function thinkerOf(f: Fact): Fact | undefined {
  return f.thinker ? fact(f.subject, f.thinker) : undefined;
}

/** One line for the answering model: name, kind, dates, whose it is, and what it says. */
export function groundingLine(f: Fact): string {
  const t = thinkerOf(f);
  const dated = f.display ? ` (${f.display})` : '';
  const head =
    f.kind === 'thinker' ? `${f.name}${dated} — thinker.`
    : f.kind === 'work' ? `${f.name}${dated} — work by ${t?.name ?? 'unknown'}.`
    : f.kind === 'concept' ? `${f.name} — concept${t ? ` associated with ${t.name}` : ''}${f.display ? `, introduced ${f.display}` : ''}.`
    : `${f.display ? `${f.display} — ` : ''}${f.name}.`;
  return [head, f.summary, f.note ? `(Note: ${f.note})` : ''].filter(Boolean).join(' ');
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Accents off, so "Émile" and "Emile" compare equal. */
export const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** A regex alternation of the row's name and aliases (accents folded), longest first. */
export function namePattern(f: Fact): string {
  return [f.name, ...f.aliases]
    .map((a) => fold(a.trim()))
    .filter((a) => a.replace(/[^A-Za-z]/g, '').length >= 4)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|');
}

type Alias = { re: RegExp; ids: string[] };

/**
 * Every name and alias of four or more letters, per optional, with the rows
 * it names. A thinker's short name ("Marx", "Mead", "Mayo") matches only as
 * written, with a capital, so the word "mayo" or "mead" in prose does not
 * count, and so does a one-word work title; concept names and longer titles
 * match in any case. Accents are folded on
 * both sides: "Emile Durkheim" finds "Émile Durkheim".
 */
const ALIASES: Map<SubjectKey, Alias[]> = (() => {
  const per = new Map<SubjectKey, Map<string, { cased: boolean; ids: Set<string> }>>();
  for (const f of FACTS) {
    if (!per.has(f.subject)) per.set(f.subject, new Map());
    const m = per.get(f.subject)!;
    for (const a of [f.name, ...f.aliases]) {
      const name = fold(a.trim());
      if (name.replace(/[^A-Za-z]/g, '').length < 4) continue;
      // A one-word title ("Suicide") is a book only when capitalised.
      const cased = (f.kind === 'thinker' && name.length < 7) || (f.kind === 'work' && !/\s/.test(name));
      const k = cased ? name : name.toLowerCase();
      if (!m.has(k)) m.set(k, { cased, ids: new Set() });
      m.get(k)!.ids.add(f.id);
    }
  }
  const out = new Map<SubjectKey, Alias[]>();
  for (const [s, m] of per) {
    out.set(s, [...m].map(([k, v]) => ({
      re: new RegExp(`(?<![A-Za-z])${escape(k)}(?![A-Za-z])`, v.cased ? '' : 'i'),
      ids: [...v.ids],
    })));
  }
  return out;
})();

/** Rows of `subject` whose name or alias appears in the text. */
export function factsNamedIn(text: string, subject: SubjectKey): Fact[] {
  const t = fold(text);
  const ids = new Set<string>();
  for (const a of ALIASES.get(subject) ?? []) if (a.re.test(t)) a.ids.forEach((id) => ids.add(id));
  return [...ids].map((id) => fact(subject, id)!).filter(Boolean);
}

/** Rows named in the text by a name or alias no other row shares: safe to check against. */
export function uniqueFactsNamedIn(text: string, subject: SubjectKey): Fact[] {
  const t = fold(text);
  const ids = new Set<string>();
  for (const a of ALIASES.get(subject) ?? []) if (a.ids.length === 1 && a.re.test(t)) ids.add(a.ids[0]);
  return [...ids].map((id) => fact(subject, id)!).filter(Boolean);
}

/**
 * Rows to show the answering model: those the question names first (with the
 * thinker of a named work or concept, and a named thinker's works and
 * concepts), then other rows of the planned units.
 */
export function factsFor(named: Fact[], units: string[], subject: SubjectKey, limit = 24): Fact[] {
  const picked = new Map<string, Fact>();
  const add = (f?: Fact) => { if (f && !picked.has(f.id)) picked.set(f.id, f); };
  for (const f of named) {
    add(f);
    add(thinkerOf(f));
  }
  for (const f of named.filter((x) => x.kind === 'thinker')) {
    FACTS.filter((x) => x.subject === subject && x.thinker === f.id).forEach(add);
  }
  if (units.length) {
    const want = new Set(units);
    const inUnits = FACTS.filter((f) => f.subject === subject && f.units.some((u) => want.has(u)));
    // Thinkers and concepts before works and events: they are what answers cite most.
    const order: Record<FactKind, number> = { thinker: 0, concept: 1, work: 2, event: 3 };
    inUnits.sort((a, b) => order[a.kind] - order[b.kind]).forEach(add);
  }
  return [...picked.values()].slice(0, limit);
}
