import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { PLANS, amountAllowed, isPlanId } from '@/lib/plans';
import { FREE_BALANCE_CAP_PAISE, FRIEND_DISCOUNT_PAISE, REFERRAL_PLAN, REFERRAL_REWARD_PAISE, isRefCode } from '@/lib/referral';
import { paymentFees } from '@/lib/referralServer';

/**
 * Confirms a Razorpay payment and grants the subscription.
 *
 * The signature only proves that this order id and payment id were produced by
 * Razorpay together. It says nothing about WHAT was bought, so anything that
 * decides entitlement has to come from the order we created, never from the
 * request body. Previously `plan` and `optional` were read straight off the
 * body, so a ₹49 daily payment could be posted back as `plan: 'yearly'` and
 * granted 365 days.
 */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

type OrderNotes = {
  firebase_uid?: string;
  plan?: string;
  optional?: string;
  /** The offer the order was priced under, written by create-order. */
  offer?: string;
  /** The invite code the buyer came with, when it earned them the friend's discount. */
  ref?: string;
  /** Paise off for coming through a friend's link, written by create-order. */
  friend_discount?: string;
  /** Paise of the buyer's own invite balance taken off, written by create-order. */
  balance_spend?: string;
};

/** A whole number of paise from the notes, or null if it is not one. */
const notePaise = (v: string | undefined): number | null => {
  if (v === undefined) return 0;
  return /^\d{1,7}$/.test(v) ? Number(v) : null;
};

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-user-token');
  const user = await verifyFirebaseToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 });
  }

  // 1. The signature proves Razorpay issued this pair.
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const provided = Buffer.from(String(razorpay_signature));
  const expected = Buffer.from(expectedSig);
  const signatureOk =
    provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!signatureOk) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServerClient();

  // 2. Replay guard. A valid signature stays valid forever, so without this the
  //    same one could be posted repeatedly to keep resetting the expiry.
  const { data: seen } = await supabase
    .from('subscriptions')
    .select('firebase_uid')
    .eq('razorpay_payment_id', razorpay_payment_id)
    .maybeSingle();
  if (seen) {
    return NextResponse.json({ error: 'Payment already processed' }, { status: 409 });
  }

  // 3. What was actually bought, from the order we created.
  let notes: OrderNotes;
  let orderAmount: number;
  let orderStatus: string;
  try {
    const order = await razorpay.orders.fetch(razorpay_order_id);
    notes = (order.notes ?? {}) as OrderNotes;
    orderAmount = Number(order.amount);
    orderStatus = String(order.status);
  } catch (e) {
    console.error('Razorpay order fetch failed:', e);
    return NextResponse.json({ error: 'Could not verify order' }, { status: 502 });
  }

  // 4. The order must belong to the caller, or one user could claim another's.
  if (notes.firebase_uid !== user.uid) {
    return NextResponse.json({ error: 'Order does not belong to this account' }, { status: 403 });
  }

  const plan = notes.plan ?? '';
  const optional = notes.optional ?? '';

  if (!isPlanId(plan) || !optional) {
    return NextResponse.json({ error: 'Order is missing plan details' }, { status: 400 });
  }
  const days = PLANS[plan].days;

  // 5. The order must be paid, for the amount that plan costs: its list price,
  //    or the sale price of the offer the order was made under, less what the
  //    order route took off a yearly plan for an invite.
  if (orderStatus !== 'paid') {
    return NextResponse.json({ error: 'Order is not paid' }, { status: 402 });
  }
  const friendDiscount = notePaise(notes.friend_discount);
  const balanceSpend = notePaise(notes.balance_spend);
  const offsOk = friendDiscount !== null && balanceSpend !== null
    && (friendDiscount === 0 || (friendDiscount === FRIEND_DISCOUNT_PAISE && isRefCode(notes.ref)))
    && (plan === REFERRAL_PLAN || (friendDiscount === 0 && balanceSpend === 0));
  if (!offsOk || !amountAllowed(plan, orderAmount + (friendDiscount ?? 0) + (balanceSpend ?? 0), notes.offer)) {
    console.error('Amount mismatch', { razorpay_order_id, orderAmount, listAmount: PLANS[plan].amountPaise, offer: notes.offer ?? null, plan });
    return NextResponse.json({ error: 'Amount does not match the plan' }, { status: 400 });
  }

  // 6. Renewing early should add to the remaining time, not discard it.
  const { data: current } = await supabase
    .from('subscriptions')
    .select('expires_at')
    .eq('firebase_uid', user.uid)
    .eq('optional', optional)
    .maybeSingle();

  const now = Date.now();
  const currentExpiry = current?.expires_at ? new Date(current.expires_at).getTime() : 0;
  const base = Math.max(now, currentExpiry);
  const expiresAt = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('subscriptions').upsert({
    firebase_uid: user.uid,
    email: user.email ?? '',
    plan,
    optional,
    status: 'active',
    expires_at: expiresAt,
    razorpay_order_id,
    razorpay_payment_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'firebase_uid,optional' });

  if (error) {
    console.error('Subscription upsert error:', error);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  // 7. The purchase, with what Razorpay kept: a yearly one sets the buyer's
  //    invite earning cap. Then the invite money moves. None of this can fail
  //    the purchase: the reader has paid for their plan whatever happens here.
  const fees = await paymentFees(razorpay, razorpay_payment_id, orderAmount);
  const { error: purchaseErr } = await supabase.from('plan_purchases').insert({
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id,
    firebase_uid: user.uid,
    plan,
    optional,
    amount_paise: orderAmount,
    fee_paise: fees.fee,
    tax_paise: fees.tax,
    balance_paise: balanceSpend ?? 0,
    friend_discount_paise: friendDiscount ?? 0,
  });
  if (purchaseErr) console.error('[verify] purchase record failed:', purchaseErr.message);

  if (balanceSpend) {
    const { error: spendErr } = await supabase.rpc('spend_referral_balance', {
      p_uid: user.uid, p_order_id: razorpay_order_id, p_amount_paise: balanceSpend,
    });
    if (spendErr) console.error('[verify] balance spend failed:', spendErr.message);
  }

  if (friendDiscount) {
    const { data: refRes, error: refErr } = await supabase.rpc('credit_referral', {
      p_code: String(notes.ref),
      p_order_id: razorpay_order_id,
      p_buyer_uid: user.uid,
      p_buyer_optional: optional,
      p_reward_paise: REFERRAL_REWARD_PAISE,
      p_free_cap_paise: FREE_BALANCE_CAP_PAISE,
    });
    if (refErr) console.error('[verify] referral credit failed:', refErr.message);
    else if (refRes?.result !== 'applied') console.log('[verify] referral not credited:', refRes?.result);
  }

  return NextResponse.json({ success: true, plan, optional, expiresAt });
}
