/**
 * Topper answer copies: one PDF per answer, cut from toppers' test booklets.
 *
 * Server-only. The list of copies lives in this folder as one JSON file per
 * optional, built from the reading of each booklet by
 * scripts/toppers/build-data.py. It is not secret: the question, who wrote the
 * answer, their rank and the past questions it answers are what the pages
 * show. The PDFs are, and they are only ever served as a short-lived signed URL
 * after the access check in lib/toppers/access.ts, so `key` and `file` stop
 * here and are never sent to the browser.
 *
 * The copies came over from the history site's design, minus its database
 * table: there, copies were added through an admin page; here they come from a
 * pipeline run, so the file in the repository is the record and a fix is a
 * commit. Who has opened what is the only thing in the database
 * (supabase/migrations/010_topper_unlocks.sql).
 */

import { type TopperCopy, type TopperSubject } from './meta';

export * from './meta';

type StoredCopy = TopperCopy & {
  /** Where the booklet came from, e.g. "LevelUp IAS Sociology Test Series 2024, Test 01". Kept for our records, never shown. */
  source: string;
  /** R2 object key. Server-only. */
  key: string;
  /** Path of the PDF under the pipeline's state folder, for the publish script. */
  file: string;
};

const LOADERS: Record<TopperSubject, () => Promise<{ default: { copies: StoredCopy[] } }>> = {
  sociology: () => import('./sociology.json') as Promise<{ default: { copies: StoredCopy[] } }>,
  anthropology: () => import('./anthropology.json') as Promise<{ default: { copies: StoredCopy[] } }>,
};

const cache = new Map<TopperSubject, StoredCopy[]>();

async function stored(subject: TopperSubject): Promise<StoredCopy[]> {
  const hit = cache.get(subject);
  if (hit) return hit;
  const copies = (await LOADERS[subject]()).default.copies;
  cache.set(subject, copies);
  return copies;
}

function publicCopy(c: StoredCopy): TopperCopy {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key, file, source, ...rest } = c;
  return rest;
}

/** Every copy for an optional, in syllabus-file order: paper, topic, question, best rank first. */
export async function listCopies(subject: TopperSubject): Promise<TopperCopy[]> {
  return (await stored(subject)).map(publicCopy);
}

export async function getCopy(subject: TopperSubject, id: string): Promise<TopperCopy | null> {
  const c = (await stored(subject)).find((x) => x.id === id);
  return c ? publicCopy(c) : null;
}

/** The R2 key for a copy. Only the open route asks, after it has decided the reader may have it. */
export async function copyKey(subject: TopperSubject, id: string): Promise<string | null> {
  return (await stored(subject)).find((x) => x.id === id)?.key ?? null;
}

/** Copies that answer a past question, best rank first. */
export async function copiesForPyq(subject: TopperSubject, pyqId: number): Promise<TopperCopy[]> {
  return (await stored(subject))
    .filter((c) => c.pyqs.includes(pyqId))
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
    .map(publicCopy);
}

/**
 * Other toppers' answers to the same thing: the same printed test question, or
 * a past question both answer. Best rank first, one per topper.
 */
export async function comparableCopies(subject: TopperSubject, copy: TopperCopy): Promise<TopperCopy[]> {
  const pyqs = new Set(copy.pyqs);
  const out = new Map<string, StoredCopy>();
  for (const c of await stored(subject)) {
    if (c.id === copy.id || c.topper === copy.topper) continue;
    if (c.group === copy.group || c.pyqs.some((p) => pyqs.has(p))) {
      const had = out.get(c.topper);
      // The same printed question beats a shared PYQ.
      if (!had || (had.group !== copy.group && c.group === copy.group)) out.set(c.topper, c);
    }
  }
  return [...out.values()].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999)).map(publicCopy);
}
