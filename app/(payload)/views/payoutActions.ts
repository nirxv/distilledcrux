'use server';
import config from '@payload-config';
import { getPayload } from 'payload';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';

/**
 * Settles a cash-out request from the Payouts view: 'paid' once the money has
 * been sent from the user's own UPI app, or 'cancelled', which puts it back in
 * the reader's balance (migration 012).
 *
 * A server action is its own endpoint, not covered by the view's guard, so it
 * checks for a signed-in CMS user itself before touching anything.
 */
export async function settlePayout(form: FormData): Promise<void> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!user) throw new Error('Not signed in to the CMS');

  const id = String(form.get('id') ?? '');
  const status = String(form.get('status') ?? '');
  const note = String(form.get('note') ?? '').slice(0, 200);
  if (!/^[0-9a-f-]{36}$/.test(id) || (status !== 'paid' && status !== 'cancelled')) throw new Error('Bad payout request');

  const { data, error } = await createServerClient().rpc('settle_referral_payout', { p_id: id, p_status: status, p_note: note });
  if (error) throw new Error(error.message);
  if (data?.result !== status) console.warn('[payouts] not settled:', data?.result);
  revalidatePath('/cms/payouts');
}
