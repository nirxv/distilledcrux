import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const PLAN_AMOUNTS: Record<string, { amount: number; days: number; label: string }> = {
  daily:     { amount: 4900,   days: 1,   label: 'Daily Plan' },
  sixmonth:  { amount: 199900, days: 180, label: '6 Month Plan' },
  yearly:    { amount: 299900, days: 365, label: 'Yearly Plan' },
};

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-user-token');
  const user = await verifyFirebaseToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan } = await req.json();
  const planData = PLAN_AMOUNTS[plan];
  if (!planData) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  try {
    const order = await razorpay.orders.create({
      amount: planData.amount,
      currency: 'INR',
      receipt: `pp_${user.uid.slice(0, 8)}_${Date.now()}`,
      notes: {
        firebase_uid: user.uid,
        email: user.email ?? '',
        plan,
        days: String(planData.days),
      },
    });
    return NextResponse.json({
      orderId: order.id,
      amount: planData.amount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      label: planData.label,
    });
  } catch (e) {
    console.error('Razorpay order error:', e);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
