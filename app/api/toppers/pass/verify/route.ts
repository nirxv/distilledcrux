import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { noStore } from '@/lib/cacheHeaders';
import { TOPPER_PASS, isTopperSubject } from '@/lib/toppers/meta';

/**
 * Grants a topper pass for a completed payment.
 *
 *   POST /api/toppers/pass/verify   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * The signature only proves Razorpay issued this order and payment together.
 * Who the pass is for, which optional and the price all come from the order
 * this site created (/api/toppers/pass/order), never from the request, and the
 * order must be paid in full. grant_topper_pass (migration 011) applies a
 * payment once: posting the same success back again returns the expiry it
 * gave the first time and adds nothing.
 */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

function signatureMatches(orderId: string, paymentId: string, signature: string): boolean {
  const expected = Buffer.from(crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update(`${orderId}|${paymentId}`).digest('hex'));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export async function POST(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json().catch(() => ({}));
  if (typeof razorpay_order_id !== 'string' || typeof razorpay_payment_id !== 'string' || typeof razorpay_signature !== 'string') {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400, headers: noStore });
  }
  if (!signatureMatches(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400, headers: noStore });
  }

  let notes: Record<string, unknown>;
  let amount: number;
  let status: string;
  try {
    const order = await razorpay.orders.fetch(razorpay_order_id);
    notes = (order.notes ?? {}) as Record<string, unknown>;
    amount = Number(order.amount);
    status = String(order.status);
  } catch (e) {
    console.error('[api/toppers/pass/verify] order fetch failed:', e);
    return NextResponse.json({ error: 'Could not verify order' }, { status: 502, headers: noStore });
  }

  if (notes.firebase_uid !== user.uid) {
    return NextResponse.json({ error: 'Order does not belong to this account' }, { status: 403, headers: noStore });
  }
  const subject = notes.subject;
  if (notes.kind !== 'topper_pass' || !isTopperSubject(subject)) {
    return NextResponse.json({ error: 'This order is not a topper pass' }, { status: 400, headers: noStore });
  }
  if (status !== 'paid') {
    return NextResponse.json({ error: 'Order is not paid' }, { status: 402, headers: noStore });
  }
  if (amount !== TOPPER_PASS.amountPaise) {
    console.error('[api/toppers/pass/verify] amount mismatch', { razorpay_order_id, amount });
    return NextResponse.json({ error: 'Amount does not match the pass' }, { status: 400, headers: noStore });
  }

  const { data, error } = await createServerClient().rpc('grant_topper_pass', {
    p_uid: user.uid,
    p_subject: subject,
    p_payment_id: razorpay_payment_id,
    p_order_id: razorpay_order_id,
    p_amount: amount,
    p_email: user.email ?? '',
    p_days: TOPPER_PASS.days,
  });
  if (error) {
    console.error('[api/toppers/pass/verify] grant failed:', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500, headers: noStore });
  }
  const row = (Array.isArray(data) ? data[0] : data) as { out_status: string; out_expires_at: string } | undefined;
  return NextResponse.json(
    { success: true, subject, expiresAt: row?.out_expires_at ?? null, alreadyProcessed: row?.out_status === 'already_applied' },
    { headers: noStore },
  );
}
