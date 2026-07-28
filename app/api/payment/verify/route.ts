import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';

const PLAN_DAYS: Record<string, number> = {
  daily: 1, sixmonth: 180, yearly: 365,
};

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-user-token');
  const user = await verifyFirebaseToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = await req.json();

  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');

  if (expectedSig !== razorpay_signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const days = PLAN_DAYS[plan] ?? 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServerClient();

  // Upsert subscription
  const { error } = await supabase.from('subscriptions').upsert({
    firebase_uid: user.uid,
    email: user.email ?? '',
    plan,
    status: 'active',
    expires_at: expiresAt,
    razorpay_order_id,
    razorpay_payment_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'firebase_uid' });

  if (error) {
    console.error('Subscription upsert error:', error);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  return NextResponse.json({ success: true, expiresAt });
}
