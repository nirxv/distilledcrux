/**
 * Note bodies, one module per subject.
 *
 * These four files hold 4.6MB of prose between them. The barrel used to import
 * all four statically and spread them into one flat object, so rendering a
 * single sociology note pulled polsci, anthropology and geography into the same
 * chunk: 4.6MB of string literals parsed to serve 25KB of it. Subject is part
 * of the route, so the module is chosen at call time instead and only the one
 * subject's file is ever loaded.
 *
 * pub-admin has note metadata but no bodies yet, so it resolves to empty
 * exactly as it did when it was missing from the flat merge.
 */
const loaders: Record<string, () => Promise<Record<string, string>>> = {
  sociology: () => import('./sociology').then(m => m.sociologyNoteContent),
  anthropology: () => import('./anthropology').then(m => m.anthropologyNoteContent),
  polsci: () => import('./polsci').then(m => m.polsciNoteContent),
  geography: () => import('./geography').then(m => m.geographyNoteContent),
};

export async function getNoteContent(subject: string, slug: string): Promise<string> {
  const load = loaders[subject];
  if (!load) return '';
  try {
    return (await load())[slug] ?? '';
  } catch {
    return '';
  }
}
