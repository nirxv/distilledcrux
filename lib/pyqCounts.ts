/**
 * How many PYQs each optional actually has.
 *
 * The dashboard used to advertise a flat "4500+" to everyone, which is the
 * whole bank across five optionals and so overstates what any one reader can
 * open by a factor of four. Counting the subject's own file keeps the number
 * honest as questions are added, rather than leaving a hand-written figure to
 * drift.
 *
 * Server-only: these files are a megabyte between them, and none of that
 * belongs in the client bundle. Each is loaded on demand and the count is kept,
 * so a warm instance parses one file once.
 */

/** The `optional` a subscription is sold under, not the route slug. */
const LOADERS: Record<string, () => Promise<{ default: unknown[] }>> = {
  sociology: () => import('@/public/data/sociology-pyqs.json'),
  anthropology: () => import('@/public/data/anthropology-pyqs.json'),
  'political-science': () => import('@/public/data/psir-pyqs.json'),
  geography: () => import('@/public/data/geography-pyqs.json'),
  'public-administration': () => import('@/public/data/pubad-pyqs.json'),
};

const cache = new Map<string, number>();

/** The question count for one optional, or null if it has no PYQ bank yet. */
export async function pyqCountForOptional(optional: string | null): Promise<number | null> {
  if (!optional) return null;
  const cached = cache.get(optional);
  if (cached !== undefined) return cached;

  const load = LOADERS[optional];
  if (!load) return null;

  try {
    const mod = await load();
    const count = Array.isArray(mod.default) ? mod.default.length : 0;
    cache.set(optional, count);
    return count;
  } catch (e) {
    // A missing or malformed data file should cost the reader a number, not
    // the whole dashboard.
    console.error(`[pyqCounts] could not count ${optional}:`, e);
    return null;
  }
}

export type PyqPeek = { id: string; year: number; paper: string; marks: number | null; question: string };

const summaries = new Map<string, { count: number; firstYear: number | null; latest: PyqPeek[] }>();

/**
 * What a subject's page says about its PYQ bank: how many questions, how far
 * back they go, and the most recent few to show. Server-only, like the count.
 */
export async function pyqSummaryForOptional(optional: string, latest = 3): Promise<{ count: number; firstYear: number | null; latest: PyqPeek[] } | null> {
  const cached = summaries.get(optional);
  if (cached) return cached;
  const load = LOADERS[optional];
  if (!load) return null;
  try {
    const rows = (await load()).default as Record<string, unknown>[];
    const peeks: PyqPeek[] = rows
      .map((r) => ({
        id: String(r.id),
        year: Number(r.year),
        paper: String(r.paper ?? ''),
        marks: Number.isFinite(Number(r.marks)) ? Number(r.marks) : null,
        question: String(r.question ?? '').trim(),
      }))
      .filter((p) => Number.isFinite(p.year) && p.question.length > 20);
    const years = peeks.map((p) => p.year);
    const summary = {
      count: rows.length,
      firstYear: years.length ? Math.min(...years) : null,
      // Newest paper first; within it, Paper I before Paper II, in file order.
      latest: [...peeks].sort((a, b) => b.year - a.year || a.paper.localeCompare(b.paper)).slice(0, latest),
    };
    summaries.set(optional, summary);
    return summary;
  } catch (e) {
    console.error(`[pyqCounts] could not summarise ${optional}:`, e);
    return null;
  }
}
