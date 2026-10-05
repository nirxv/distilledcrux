/**
 * Merging two copies of a reader's study progress (from the history site).
 *
 * Kept apart from the route so the rules can be reasoned about, and tested,
 * without a database or a request. See supabase/migrations/005_study_progress.sql
 * for why the merge unions rather than replaces, and for the un-ticking
 * limitation that choice carries.
 *
 * Keys carry the optional, because a reader can switch optionals and keep
 * their old ticks, and the five PYQ banks reuse ids: a syllabus key is
 * "sociology/karl-marx", a PYQ key is "anthropology:2".
 */

export type SyllabusDoc = {
  completed: Record<string, boolean>;
  completionDates?: Record<string, string>;
};

/** "subject:id" -> ISO date the question was marked attempted. */
export type PyqDoc = Record<string, string>;

const SYLLABUS_KEY = /^[a-z-]+\/[a-z0-9-]+$/;
const PYQ_KEY = /^[a-z-]+:\d+$/;

/** Anything stored under an unrecognised shape is treated as absent. */
function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** The earlier of two ISO dates, tolerating a missing or malformed one. */
function earliest(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

export function mergeSyllabus(a: unknown, b: unknown): SyllabusDoc {
  const ao = asObject(a);
  const bo = asObject(b);
  const aCompleted = asObject(ao.completed);
  const bCompleted = asObject(bo.completed);
  const aDates = asObject(ao.completionDates);
  const bDates = asObject(bo.completionDates);

  const completed: Record<string, boolean> = {};
  const completionDates: Record<string, string> = {};

  for (const key of new Set([...Object.keys(aCompleted), ...Object.keys(bCompleted)])) {
    if (!SYLLABUS_KEY.test(key)) continue;
    // The store writes `true` and deletes the key rather than writing `false`,
    // but a hand-edited value could hold false, which must not count.
    if (aCompleted[key] !== true && bCompleted[key] !== true) continue;
    completed[key] = true;
    // When a topic was first finished, which is what the dashboard's revision
    // prompt measures from.
    const d = earliest(
      typeof aDates[key] === 'string' ? (aDates[key] as string) : undefined,
      typeof bDates[key] === 'string' ? (bDates[key] as string) : undefined,
    );
    if (d) completionDates[key] = d;
  }

  return { completed, completionDates };
}

export function mergePyq(a: unknown, b: unknown): PyqDoc {
  const normalise = (v: unknown): PyqDoc => {
    const out: PyqDoc = {};
    for (const [k, date] of Object.entries(asObject(v))) {
      if (!PYQ_KEY.test(k)) continue;
      out[k] = typeof date === 'string' ? date : '';
    }
    return out;
  };
  const ao = normalise(a);
  const bo = normalise(b);
  const out: PyqDoc = {};
  for (const id of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    out[id] = earliest(ao[id] || undefined, bo[id] || undefined) ?? '';
  }
  return out;
}
