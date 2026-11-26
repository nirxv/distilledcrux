/**
 * Hindi note bodies, one module per subject.
 *
 * Same shape as lib/noteContent/index.ts: the subject is part of the route, so
 * only that subject's Hindi corpus is ever parsed, and only when a reader has
 * Hindi on. A missing note returns '' and the reader shows its empty state.
 */
const loaders: Record<string, () => Promise<Record<string, string>>> = {
  sociology: () => import('./sociology').then((m) => m.sociologyNoteContentHi),
  anthropology: () => import('./anthropology').then((m) => m.anthropologyNoteContentHi),
  polsci: () => import('./polsci').then((m) => m.polsciNoteContentHi),
  geography: () => import('./geography').then((m) => m.geographyNoteContentHi),
  'pub-admin': () => import('./pub-admin').then((m) => m.pubAdminNoteContentHi),
};

export async function getNoteHiContent(subject: string, slug: string): Promise<string> {
  const load = loaders[subject];
  if (!load) return '';
  try {
    return (await load())[slug] ?? '';
  } catch {
    return '';
  }
}

/** Whether a Hindi body exists, without shipping it. */
export function hasNoteHi(subject: string): boolean {
  return subject in loaders;
}
