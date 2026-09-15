import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import Razorpay from 'razorpay';
import crypto from 'crypto';

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

// Server-side truth. Must stay in step with PLAN_AMOUNTS in create-order.
const PLAN_DAYS: Record<string, number> = { daily: 1, sixmonth: 180, yearly: 365 };
const PLAN_AMOUNTS: Record<string, number> = { daily: 4900, sixmonth: 199900, yearly: 299900 };

type OrderNotes = {
  firebase_uid?: string;
  plan?: string;
  optional?: string;
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
  const days = PLAN_DAYS[plan];
  const expectedAmount = PLAN_AMOUNTS[plan];

  if (!days || !expectedAmount || !optional) {
    return NextResponse.json({ error: 'Order is missing plan details' }, { status: 400 });
  }

  // 5. The order must be paid, for the amount that plan costs.
  if (orderStatus !== 'paid') {
    return NextResponse.json({ error: 'Order is not paid' }, { status: 402 });
  }
  if (orderAmount !== expectedAmount) {
    console.error('Amount mismatch', { razorpay_order_id, orderAmount, expectedAmount, plan });
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

  return NextResponse.json({ success: true, plan, optional, expiresAt });
}
