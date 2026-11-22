import unitVectors from './unitVectors.json';
import { factsNamedIn, thinkerOf, type Fact } from './register';
import type { SubjectKey } from '@/lib/subjectConfig';

/**
 * Turns a student's question into a search plan without a model call.
 *
 * The question used to be embedded as written, directives and all, and the
 * nearest passages of the optional taken whatever they were about. A plan
 * says which thinkers, concepts and syllabus units the question is about, so
 * the search can prefer passages tagged with them, and adds keyword queries
 * built from the register's names.
 *
 * Signals, strongest first:
 *  1. Thinkers, works, concepts and events the question names, via the
 *     register's names and aliases (register.ts).
 *  2. The question's own embedding against each syllabus unit's embedding
 *     (lib/rag/unitVectors.json, built by scripts/rag/build_runtime_data.py),
 *     which also works for Hindi questions.
 *
 * When neither is confident the plan carries no preference, and the search
 * falls back to relevance and the reranker alone.
 */

export type QueryPlan = {
  /** Register rows the question names, with the thinkers of named works and concepts. */
  facts: Fact[];
  units: string[];
  /** The question with its exam directives removed. */
  cleaned: string;
  /** Keyword text for the BM25 half of the search: the cleaned question plus the named rows' names. */
  keywords: string;
  /** Quoted statements in the question: to be examined, not assumed. */
  claims: string[];
  /** Why each unit and row was chosen, for logs. */
  why: string[];
};

// A unit this close to the question's embedding is about the same thing.
// Checked against PYQs in scripts/rag/rag_eval.ts.
const UNIT_SIM_STRONG = 0.6;
/** Units within this distance of the best match come along with it. */
const UNIT_SIM_BAND = 0.03;
const MAX_UNITS = 3;

type Quantised = { title: string; paper: number; scale: number; q: string };

const decode = (v: Quantised): Float32Array => {
  const raw = Buffer.from(v.q, 'base64');
  const out = new Float32Array(raw.length);
  let norm = 0;
  for (let i = 0; i < raw.length; i++) {
    const x = (raw[i] > 127 ? raw[i] - 256 : raw[i]) * v.scale;
    out[i] = x;
    norm += x * x;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
};

/** Each optional's units: slug, title and unit-length embedding. */
export const UNITS: Map<SubjectKey, { slug: string; title: string; vec: Float32Array }[]> = (() => {
  const m = new Map<SubjectKey, { slug: string; title: string; vec: Float32Array }[]>();
  for (const [k, v] of Object.entries((unitVectors as { units: Record<string, Quantised> }).units)) {
    const [subject, slug] = k.split(':') as [SubjectKey, string];
    if (!m.has(subject)) m.set(subject, []);
    m.get(subject)!.push({ slug, title: v.title, vec: decode(v) });
  }
  return m;
})();

export function unitTitle(subject: SubjectKey, slug: string): string {
  return UNITS.get(subject)?.find((u) => u.slug === slug)?.title ?? slug;
}

function cosine(a: number[], b: Float32Array): number {
  let dot = 0, na = 0;
  for (let i = 0; i < b.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; }
  return dot / (Math.sqrt(na) || 1);
}

/** Exam directives and evaluative words that match unrelated passages if searched for. */
const RHETORIC = new RegExp('\\b(' + [
  'critically', 'examine', 'evaluate', 'analy[sz]e', 'assess', 'discuss', 'comment(?: upon| on)?', 'elucidate',
  'explain', 'describe', 'elaborate', 'justify', 'substantiate', 'illustrate', 'trace', 'delineate', 'enumerate',
  'highlight', 'bring out', 'account for', 'how far', 'to what extent', 'do you agree(?: with)?', 'in your opinion',
  'with suitable examples', 'give reasons', 'write (?:a )?short (?:essay|notes?) on', 'in this context',
  'marks?', 'words?',
].join('|') + ')\\b', 'gi');

export function stripRhetoric(question: string): string {
  return question
    .replace(/\(\s*\d+\s*(?:marks?|words?)\s*\)|\[\s*\d+\s*marks?\s*\]/gi, ' ')
    .replace(RHETORIC, ' ')
    .replace(/["“”‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Statements quoted in the question, five words or longer. */
function quotedClaims(question: string): string[] {
  const out: string[] = [];
  for (const m of question.matchAll(/["“]([^"”]{20,600})["”]/g)) {
    if (m[1].trim().split(/\s+/).length >= 5) out.push(m[1].trim());
  }
  // An unclosed quote, as in a pasted PYQ that lost its opening mark.
  if (!out.length) {
    const m = question.match(/^(.{20,600}?)["”]\s*(?:critically|examine|comment|discuss|evaluate|analy[sz]e|elucidate|do you agree)/i);
    if (m && m[1].trim().split(/\s+/).length >= 5) out.push(m[1].replace(/^["“]/, '').trim());
  }
  return out;
}

/**
 * @param question     the student's question as written
 * @param questionVec  its voyage-4-lite query embedding (already computed for the search)
 * @param subject      the optional the student is studying
 */
export function planQuery(question: string, questionVec: number[] | null, subject: SubjectKey): QueryPlan {
  const why: string[] = [];
  const named = factsNamedIn(question, subject);
  const facts = new Map<string, Fact>();
  for (const f of named) {
    facts.set(f.id, f);
    why.push(`${f.id}: names "${f.name}"`);
    const t = thinkerOf(f);
    if (t && !facts.has(t.id)) facts.set(t.id, t);
  }

  const units: string[] = [];
  if (questionVec) {
    const sims = (UNITS.get(subject) ?? []).map((u) => [u.slug, cosine(questionVec, u.vec)] as const)
      .sort((a, b) => b[1] - a[1]);
    const best = sims[0]?.[1] ?? 0;
    if (best >= UNIT_SIM_STRONG) {
      for (const [slug, s] of sims) {
        if (s < best - UNIT_SIM_BAND || units.length >= MAX_UNITS) break;
        units.push(slug);
        why.push(`${slug}: embedding ${s.toFixed(2)}`);
      }
    }
  }
  // A named concept or work taught in a single unit fixes that unit.
  for (const f of named) {
    if (f.kind !== 'thinker' && f.units.length === 1 && !units.includes(f.units[0]) && units.length < MAX_UNITS) {
      units.push(f.units[0]);
      why.push(`${f.units[0]}: unit of ${f.id}`);
    }
  }

  const cleaned = stripRhetoric(question) || question;
  const extra = [...facts.values()].map((f) => f.name).filter((n) => !cleaned.toLowerCase().includes(n.toLowerCase()));
  return {
    facts: [...facts.values()],
    units,
    cleaned,
    keywords: [cleaned, ...extra].join(' '),
    claims: quotedClaims(question),
    why,
  };
}
