/**
 * The note a reader last opened, kept on this device so the dashboard can
 * offer to pick it up again. Nothing is sent anywhere.
 */
export type LastNote = { subject: string; slug: string; title: string; section: string; at: number };

const KEY = 'dc-last-note';

export function rememberNote(note: LastNote): void {
  try { localStorage.setItem(KEY, JSON.stringify(note)); } catch { /* storage blocked: nothing to offer later */ }
}

export function readLastNote(): LastNote | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && typeof v.slug === 'string' && typeof v.subject === 'string' && typeof v.title === 'string' ? v : null;
  } catch {
    return null;
  }
}
