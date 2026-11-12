import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { noStore } from '@/lib/cacheHeaders';
import { PYQ_SUBJECT_NAME } from '@/lib/pyqs';
import { TOPPER_PASS, isTopperSubject } from '@/lib/toppers/meta';

/**
 * Opens a Razorpay order for a topper pass: every copy in one optional for a
 * year, ₹799 paid once.
 *
 *   POST /api/toppers/pass/order   { subject: 'sociology' }
 *
 * The notes are written here, under our own key, and are what the verify
 * route trusts: who the pass is for, which optional, and that this is a
 * topper pass and not a plan (the plan verify route refuses an order without
 * a plan in its notes, so neither can be redeemed as the other).
 */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });

  const { subject } = await req.json().catch(() => ({}));
  if (!isTopperSubject(subject)) {
    return NextResponse.json({ error: 'Topper copies are not available for this optional' }, { status: 400, headers: noStore });
  }

  try {
    const order = await razorpay.orders.create({
      amount: TOPPER_PASS.amountPaise,
      currency: 'INR',
      receipt: `dctp_${user.uid.slice(0, 8)}_${Date.now()}`,
      notes: { firebase_uid: user.uid, email: user.email ?? '', kind: 'topper_pass', subject },
    });
    return NextResponse.json({
      orderId: order.id,
      amount: TOPPER_PASS.amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      description: `${PYQ_SUBJECT_NAME[subject]} topper copies, one year`,
    }, { headers: noStore });
  } catch (e) {
    console.error('[api/toppers/pass/order]', e);
    return NextResponse.json({ error: 'Could not start the payment' }, { status: 500, headers: noStore });
  }
}
