import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Who is entitled to what, in one place.
 *
 * Two bugs lived in the copies this replaces. The `subscriptions` table has no
 * `id` column — its key is (firebase_uid, optional) — so the routes that asked
 * for `.select('id')` got a PostgREST 400 back, read the resulting null `data`
 * as "no subscription" and charged a paying reader the paywall. And the map
 * from a client subject slug to the `optional` a subscription is sold under was
 * pasted into four routes, which is how model-answer came to be missing it and
 * handed an anthropology subscriber a sociology answer.
 *
 * Entitlement is per optional, never per account: a subscription buys one
 * optional and nothing else.
 */

/**
 * Client subject slugs are not the `optional` values Razorpay and the
 * subscriptions table use; two of the five differ.
 */
const OPTIONAL_BY_SUBJECT: Record<string, string> = {
  sociology: 'sociology',
  anthropology: 'anthropology',
  polsci: 'political-science',
  geography: 'geography',
  'pub-admin': 'public-administration',
};

/**
 * The `optional` a subject slug is sold under. Values that are already an
 * optional — what /dashboard reads off the profile — pass through unchanged.
 */
export function optionalForSubject(subject: unknown, fallback = 'sociology'): string {
  const key = typeof subject === 'string' && subject ? subject : fallback;
  return OPTIONAL_BY_SUBJECT[key] ?? key;
}

/**
 * Whether this reader holds a live subscription to this optional. Selects
 * `status`, a column that exists, so a miss means no subscription rather than
 * a rejected query.
 */
export async function hasActiveSubscription(
  db: SupabaseClient,
  firebaseUid: string,
  optional: string,
): Promise<boolean> {
  const { data, error } = await db
    .from('subscriptions')
    .select('status')
    .eq('firebase_uid', firebaseUid)
    .eq('optional', optional)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    // A broken query is not an answer. Say so rather than letting it read as a
    // lapsed subscription, which is how the paywall reached paying readers.
    console.error('[entitlements] subscription lookup failed:', error.message);
    return false;
  }
  return Boolean(data);
}
