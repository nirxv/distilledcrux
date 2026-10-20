import type { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { hasActiveSubscription, optionalForSubject } from '@/lib/entitlements';
import { FREE_FLASHCARD_LIMIT, type FlashcardSubject } from '@/lib/flashcardMeta';

/**
 * Who may see a flashcard's answer. Ported from the history site.
 *
 * Fronts are free. Answers are metered: a reader may open any hundred,
 * whichever hundred they pick, and after that they need a subscription to the
 * optional the deck belongs to. The quota is a set of cards rather than a
 * count, so re-opening a card already unlocked is free for good.
 *
 * An account is required before any answer is served. Every page here already
 * sits behind sign-in, but that is a client-side check and the route has to
 * hold the same line on its own.
 */

export type FlashcardReader = {
  uid: string | null;
  /** A live subscription to this deck's optional: no metering at all. */
  unlimited: boolean;
};

export async function resolveReader(req: NextRequest, subject: FlashcardSubject): Promise<FlashcardReader> {
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

  // The deck's optional is known on the server from the subject the route was
  // asked for, and listBacks only ever serves that deck, so naming another
  // subject cannot carry a subscription across decks.
  const unlimited = await hasActiveSubscription(createServerClient(), uid, optionalForSubject(subject));
  return { uid, unlimited };
}

export type UnlockOutcome = {
  /** Ids the reader may see the answer to. */
  granted: string[];
  /** Ids refused because the allowance is gone. */
  locked: string[];
  /** How many of the allowance are spent, after this call. */
  used: number;
  /** True when the database could not be reached. */
  degraded: boolean;
};

/**
 * Which of `ids` has this reader already unlocked, and how many have they
 * spent? Writes nothing, so the prefetch can ask about a whole window.
 */
export async function readUnlocks(reader: FlashcardReader, ids: string[]): Promise<UnlockOutcome> {
  if (!reader.uid) return { granted: [], locked: ids, used: 0, degraded: false };
  try {
    const { data, error } = await createServerClient().rpc('flashcard_unlock_status', {
      p_uid: reader.uid,
      p_ids: ids.length ? ids : null,
    });
    if (error) {
      console.error('[flashcardAccess] status failed:', error.message);
      return { granted: [], locked: ids, used: 0, degraded: true };
    }
    const row = (Array.isArray(data) ? data[0] : data) as { out_ids: string[] | null; out_used: number } | undefined;
    const granted = row?.out_ids ?? [];
    const owned = new Set(granted);
    return { granted, locked: ids.filter((id) => !owned.has(id)), used: row?.out_used ?? 0, degraded: false };
  } catch (e) {
    console.error('[flashcardAccess] status unreachable:', e);
    return { granted: [], locked: ids, used: 0, degraded: true };
  }
}

/**
 * Claims allowance for `ids` not already unlocked.
 *
 * Fails closed: a database outage must not make the free tier unlimited. A
 * false refusal costs a reader a paywall for a few minutes, a false grant
 * makes the paid half of the deck free.
 */
export async function spendUnlocks(reader: FlashcardReader, ids: string[]): Promise<UnlockOutcome> {
  if (!ids.length) return { granted: [], locked: [], used: 0, degraded: false };
  if (!reader.uid) return { granted: [], locked: ids, used: 0, degraded: false };
  try {
    const { data, error } = await createServerClient().rpc('unlock_flashcards', {
      p_uid: reader.uid,
      p_ids: ids,
      p_limit: FREE_FLASHCARD_LIMIT,
    });
    if (error) {
      console.error('[flashcardAccess] unlock failed:', error.message);
      return { granted: [], locked: ids, used: 0, degraded: true };
    }
    const rows = (data ?? []) as { out_card_id: string; out_granted: boolean; out_used: number }[];
    return {
      granted: rows.filter((r) => r.out_granted).map((r) => r.out_card_id),
      locked: rows.filter((r) => !r.out_granted).map((r) => r.out_card_id),
      used: rows[rows.length - 1]?.out_used ?? 0,
      degraded: false,
    };
  } catch (e) {
    console.error('[flashcardAccess] unlock unreachable:', e);
    return { granted: [], locked: ids, used: 0, degraded: true };
  }
}
