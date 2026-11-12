import type { SupabaseClient } from '@supabase/supabase-js';
import type Razorpay from 'razorpay';
import {
  FALLBACK_FEE_RATE, FALLBACK_GST_RATE, FRIEND_DISCOUNT_PAISE, cashoutMilestones, isRefCode, newRefCode, normalisePhone, windowCapPaise,
} from '@/lib/referral';

/**
 * The reader's invite code, made the first time they ask for it. A clash on
 * the random code is retried; a clash on the uid means a parallel request made
 * one first, so that one is read back.
 */
export async function getOrCreateRefCode(db: SupabaseClient, uid: string): Promise<string | null> {
  const { data: existing } = await db.from('referral_codes').select('code').eq('firebase_uid', uid).maybeSingle();
  if (existing?.code) return existing.code;

  for (let i = 0; i < 4; i++) {
    const code = newRefCode();
    const { error } = await db.from('referral_codes').insert({ code, firebase_uid: uid });
    if (!error) return code;
    if (error.code !== '23505') {
      console.error('[referral] code insert failed:', error.message);
      return null;
    }
    const { data: raced } = await db.from('referral_codes').select('code').eq('firebase_uid', uid).maybeSingle();
    if (raced?.code) return raced.code;
  }
  return null;
}

/** The reader's balance in paise: the sum of their ledger. A failed read is no balance. */
export async function referralBalance(db: SupabaseClient, uid: string): Promise<number> {
  const { data, error } = await db.from('referral_ledger').select('amount_paise').eq('firebase_uid', uid);
  if (error) {
    console.error('[referral] balance read failed:', error.message);
    return 0;
  }
  return (data ?? []).reduce((sum, r) => sum + (r.amount_paise ?? 0), 0);
}

/**
 * Whether this buyer's yearly order gets the friend's ₹100 off, given the code
 * they arrived with: the code is someone else's, they have never been
 * referred, and they have never bought a yearly plan here. Checked again,
 * in effect, when the referral is recorded: a friend counts once.
 */
export async function friendDiscountFor(db: SupabaseClient, uid: string, ref: unknown): Promise<{ code: string; paise: number } | null> {
  if (!isRefCode(ref)) return null;
  const code = String(ref).toUpperCase();

  const [owner, referred, purchases, legacy] = await Promise.all([
    db.from('referral_codes').select('firebase_uid').eq('code', code).maybeSingle(),
    db.from('referrals').select('id').eq('referred_uid', uid).limit(1),
    db.from('plan_purchases').select('payment_id').eq('firebase_uid', uid).eq('plan', 'yearly').limit(1),
    // Yearly plans bought before plan_purchases existed.
    db.from('subscriptions').select('firebase_uid').eq('firebase_uid', uid).eq('plan', 'yearly').not('razorpay_payment_id', 'is', null).limit(1),
  ]);
  if (owner.error || referred.error || purchases.error || legacy.error) {
    console.error('[referral] discount check failed');
    return null;
  }
  if (!owner.data?.firebase_uid || owner.data.firebase_uid === uid) return null;
  if ((referred.data ?? []).length || (purchases.data ?? []).length || (legacy.data ?? []).length) return null;
  return { code, paise: FRIEND_DISCOUNT_PAISE };
}

/**
 * What Razorpay kept from a payment: its fee and the GST on it, in paise. A
 * captured payment reports both, and a fee of zero is real: UPI payments under
 * ₹2,000 carry none. Only when the payment is not captured yet, or the fetch
 * fails, are they worked out at the published rates.
 */
export async function paymentFees(razorpay: Razorpay, paymentId: string, amountPaise: number): Promise<{ fee: number; tax: number; estimated: boolean }> {
  try {
    const p = await razorpay.payments.fetch(paymentId) as { status?: string; fee?: number | null; tax?: number | null };
    if (p.status === 'captured' && typeof p.fee === 'number') {
      // Razorpay's fee figure includes the GST, which it also reports apart.
      const tax = typeof p.tax === 'number' ? p.tax : 0;
      return { fee: p.fee - tax, tax, estimated: false };
    }
  } catch (e) {
    console.error('[referral] payment fetch failed:', e instanceof Error ? e.message : e);
  }
  const fee = Math.round(amountPaise * FALLBACK_FEE_RATE);
  return { fee, tax: Math.round(fee * FALLBACK_GST_RATE), estimated: true };
}

export type ReferralSummary = {
  code: string;
  friends: number;
  balancePaise: number;
  /** The current earning window, from the latest yearly purchase. Null before the first. */
  window: null | {
    capPaise: number;
    earnedPaise: number;
    openedAt: string;
    milestones: { atPaise: number; reached: boolean; used: boolean }[];
  };
  /** A cash-out can be asked for now. */
  canCashOut: boolean;
  pending: null | { amountPaise: number; requestedAt: string; upi: string };
  lastUpi: string | null;
  /** The mobile number to offer on the cash-out form: the last one given, or the profile's. */
  defaultPhone: string | null;
  history: { kind: string; amountPaise: number; at: string }[];
};

type Ledger = { kind: string; amount_paise: number; window_payment_id: string | null; created_at: string };
type Payout = { amount_paise: number; upi_id: string; phone: string; status: string; window_payment_id: string; requested_at: string };

/** Everything the invite page shows, read in one go. The rules match migration 012. */
export async function referralSummary(db: SupabaseClient, uid: string, code: string): Promise<ReferralSummary> {
  const [friends, ledger, win, payouts, profile] = await Promise.all([
    db.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_uid', uid),
    db.from('referral_ledger').select('kind, amount_paise, window_payment_id, created_at').eq('firebase_uid', uid).order('created_at', { ascending: false }),
    db.from('plan_purchases').select('payment_id, amount_paise, fee_paise, tax_paise, created_at').eq('firebase_uid', uid).eq('plan', 'yearly').order('created_at', { ascending: false }).limit(1),
    db.from('referral_payouts').select('amount_paise, upi_id, phone, status, window_payment_id, requested_at').eq('firebase_uid', uid).order('requested_at', { ascending: false }),
    db.from('user_profiles').select('phone').eq('firebase_uid', uid).maybeSingle(),
  ]);
  const rows = (ledger.data ?? []) as Ledger[];
  const outs = (payouts.data ?? []) as Payout[];
  const balancePaise = rows.reduce((s, r) => s + r.amount_paise, 0);
  const pendingRow = outs.find((p) => p.status === 'requested') ?? null;

  let window: ReferralSummary['window'] = null;
  let canCashOut = false;
  const w = win.data?.[0];
  if (w) {
    const capPaise = windowCapPaise(w.amount_paise, w.fee_paise, w.tax_paise);
    const earnedPaise = rows.filter((r) => r.kind === 'earn' && r.window_payment_id === w.payment_id).reduce((s, r) => s + r.amount_paise, 0);
    const used = outs.filter((p) => p.window_payment_id === w.payment_id && p.status !== 'cancelled').length;
    const marks = cashoutMilestones(capPaise);
    const reached = marks.filter((m) => m <= earnedPaise).length;
    window = {
      capPaise,
      earnedPaise,
      openedAt: w.created_at,
      milestones: marks.map((m, i) => ({ atPaise: m, reached: m <= earnedPaise, used: i < used })),
    };
    canCashOut = capPaise > 0 && !pendingRow && reached > used && balancePaise > 0;
  }

  return {
    code,
    friends: friends.count ?? 0,
    balancePaise,
    window,
    canCashOut,
    pending: pendingRow ? { amountPaise: pendingRow.amount_paise, requestedAt: pendingRow.requested_at, upi: pendingRow.upi_id } : null,
    lastUpi: outs[0]?.upi_id ?? null,
    defaultPhone: normalisePhone(outs[0]?.phone) ?? normalisePhone(profile.data?.phone) ?? null,
    history: rows.slice(0, 30).map((r) => ({ kind: r.kind, amountPaise: r.amount_paise, at: r.created_at })),
  };
}
