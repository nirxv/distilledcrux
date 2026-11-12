import type { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { hasActiveSubscription, optionalForSubject } from '@/lib/entitlements';
import { FREE_TOPPER_LIMIT, type TopperSubject } from './meta';

/**
 * Who may open a topper copy.
 *
 * Anyone signed in may open five copies, any five, across every optional.
 * After that a copy needs a subscription to the optional it belongs to: a
 * sociology subscription opens every sociology copy and nothing else, the same
 * rule as model answers and flashcards (lib/entitlements.ts).
 *
 * The allowance is a set, not a count. Opening a copy already opened is free,
 * in the viewer and in Compare alike, so a reader is never charged twice for
 * the same copy. The status the lists show and the decision the open route
 * makes read the same rows, so the "4 of 5 left" a reader sees is the
 * allowance the server applies.
 */

export type TopperReader = {
  uid: string | null;
  /** A live subscription to this optional: no metering at all. */
  unlimited: boolean;
};

export async function resolveReader(req: NextRequest, subject: TopperSubject): Promise<TopperReader> {
  const token = req.headers.get('x-user-token') ?? '';
  if (!token) return { uid: null, unlimited: false };
  let uid: string | null = null;
  try {
    const { verifyFirebaseToken } = await import('@/lib/verifyFirebaseToken');
    uid = (await verifyFirebaseToken(token))?.uid ?? null;
  } catch {
    // An unverifiable token is anonymous, not an error.
  }
  if (!uid) return { uid: null, unlimited: false };
  const unlimited = await hasActiveSubscription(createServerClient(), uid, optionalForSubject(subject));
  return { uid, unlimited };
}

export type TopperStatus = {
  /** Copies in this optional the reader has already opened, free to open again. */
  opened: string[];
  /** How many of the free allowance are spent, across all optionals. */
  used: number;
  limit: number;
  /** True when the database could not be reached. */
  degraded: boolean;
};

export async function readStatus(reader: TopperReader, subject: TopperSubject): Promise<TopperStatus> {
  const empty = { opened: [], used: 0, limit: FREE_TOPPER_LIMIT, degraded: false };
  if (!reader.uid) return empty;
  try {
    const { data, error } = await createServerClient().rpc('topper_unlock_status', { p_uid: reader.uid, p_subject: subject });
    if (error) {
      console.error('[toppers/access] status failed:', error.message);
      return { ...empty, degraded: true };
    }
    const row = (Array.isArray(data) ? data[0] : data) as { out_ids: string[] | null; out_used: number } | undefined;
    return { opened: row?.out_ids ?? [], used: row?.out_used ?? 0, limit: FREE_TOPPER_LIMIT, degraded: false };
  } catch (e) {
    console.error('[toppers/access] status unreachable:', e);
    return { ...empty, degraded: true };
  }
}

export type OpenOutcome = { granted: boolean; used: number; degraded: boolean };

/**
 * Claims one of the reader's free opens for this copy, or finds it already
 * claimed. Fails closed: an outage must not make the free tier unlimited.
 */
export async function spendOpen(reader: TopperReader, subject: TopperSubject, copyId: string): Promise<OpenOutcome> {
  if (!reader.uid) return { granted: false, used: 0, degraded: false };
  try {
    const { data, error } = await createServerClient().rpc('unlock_topper_copy', {
      p_uid: reader.uid,
      p_subject: subject,
      p_copy_id: copyId,
      p_limit: FREE_TOPPER_LIMIT,
    });
    if (error) {
      console.error('[toppers/access] unlock failed:', error.message);
      return { granted: false, used: 0, degraded: true };
    }
    const row = (Array.isArray(data) ? data[0] : data) as { out_granted: boolean; out_used: number } | undefined;
    return { granted: row?.out_granted === true, used: row?.out_used ?? 0, degraded: false };
  } catch (e) {
    console.error('[toppers/access] unlock unreachable:', e);
    return { granted: false, used: 0, degraded: true };
  }
}
