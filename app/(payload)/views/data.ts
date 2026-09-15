import 'server-only';
import { createServerClient } from '@/lib/supabase';

export { relative, truncate } from './format';

/**
 * These tables belong to the app, not to Payload, so they are read directly
 * rather than through Payload's local API. Payload's own auth gates every view
 * that uses this module, so the service client is the right level.
 * Nothing here writes.
 */
export type Loaded<T> = { rows: T[]; error: string | null };

export async function readTable<T>(
  table: string,
  columns = '*',
  orderBy?: { column: string; ascending?: boolean },
  limit = 500,
): Promise<Loaded<T>> {
  try {
    const db = createServerClient();
    let q = db.from(table).select(columns).limit(limit);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? false });
    const { data, error } = await q;
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as T[], error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : 'unknown error' };
  }
}

/** How many of these rows carry a timestamp inside the last `ms`. */
export const since = (rows: Record<string, unknown>[], ms: number, column = 'created_at') =>
  rows.filter(r => {
    const v = r[column];
    return typeof v === 'string' && Date.parse(v) > Date.now() - ms;
  }).length;

export const SUBJECT_LABEL: Record<string, string> = {
  sociology: 'Sociology',
  anthropology: 'Anthropology',
  polsci: 'PSIR',
  geography: 'Geography',
  'pub-admin': 'Public Administration',
  'political-science': 'PSIR',
  'public-administration': 'Public Administration',
};

/** Profiles store the long form ('political-science'); everything else the short. */
export const normaliseSubject = (s: string | null | undefined) =>
  s === 'political-science' ? 'polsci' : s === 'public-administration' ? 'pub-admin' : (s ?? '');
