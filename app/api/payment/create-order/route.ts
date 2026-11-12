import { NextRequest, NextResponse } from 'next/server';
import { PLANS, PLAN_ORDER, priceNow, type PlanId } from '@/lib/plans';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { FREE_BALANCE_CAP_PAISE, REFERRAL_PLAN, REFERRAL_REWARD_PAISE } from '@/lib/referral';
import { friendDiscountFor, referralBalance } from '@/lib/referralServer';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// Amounts live in lib/plans, which the pricing page and the refund policy also
// read, so a price cannot be changed in one place and stale in another.
const PLAN_AMOUNTS: Record<string, { amount: number; days: number; label: string }> =
  Object.fromEntries(
    PLAN_ORDER.map((id) => [id, {
      amount: PLANS[id].amountPaise,
      days: PLANS[id].days,
      label: PLANS[id].orderLabel,
    }]),
  );

const OPTIONAL_LABELS: Record<string, string> = {
  sociology:               'Sociology',
  anthropology:            'Anthropology',
  geography:               'Geography',
  'political-science':     'PSIR',
  'public-administration': 'Public Administration',
};

function optionalDisplayName(optional: string): string {
  return OPTIONAL_LABELS[optional] ?? optional;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-user-token');
  const user = await verifyFirebaseToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan, optional, ref, useBalance } = await req.json();

  const planData = PLAN_AMOUNTS[plan];
  if (!planData) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const validOptionals = Object.keys(OPTIONAL_LABELS);
  if (!optional || !validOptionals.includes(optional)) {
    return NextResponse.json({ error: 'Invalid optional subject' }, { status: 400 });
  }

  const optLabel = optionalDisplayName(optional);

  // The price now, which is the sale price while an offer runs. The offer's id
  // goes into the notes, so verify accepts this amount for this order even if
  // it is paid after the offer ends.
  const { amountPaise: pricePaise, offer } = priceNow(plan as PlanId);

  // A yearly order can come down twice: ₹100 off for a friend's first yearly
  // plan through someone's link, and the reader's own invite balance unless
  // they switched it off. Both are worked out here from the database, never
  // taken from the request, and written into the notes, which verify checks.
  let friend: { code: string; paise: number } | null = null;
  let balanceSpend = 0;
  if (plan === REFERRAL_PLAN) {
    const db = createServerClient();
    friend = await friendDiscountFor(db, user.uid, ref);
    if (useBalance !== false) {
      const balance = await referralBalance(db, user.uid);
      balanceSpend = Math.max(0, Math.min(balance, pricePaise - (friend?.paise ?? 0)));
    }
  }
  const amountPaise = pricePaise - (friend?.paise ?? 0) - balanceSpend;

  // The balance covers it all: nothing to charge, so no Razorpay order. The
  // plan is granted here, in one transaction with taking the money out.
  if (amountPaise === 0) {
    const db = createServerClient();
    const orderId = `bal_${crypto.randomUUID()}`;
    const { data: granted, error: grantErr } = await db.rpc('grant_plan_from_balance', {
      p_uid: user.uid,
      p_email: user.email ?? '',
      p_optional: optional,
      p_plan: plan,
      p_days: planData.days,
      p_spend_paise: balanceSpend,
      p_friend_discount_paise: friend?.paise ?? 0,
      p_order_id: orderId,
    });
    if (grantErr || granted?.result !== 'granted') {
      console.error('[create-order] balance grant failed:', grantErr?.message ?? granted?.result);
      return NextResponse.json({ error: 'Your balance changed. Refresh the page and try again.' }, { status: 409 });
    }
    if (friend) {
      const { error: refErr } = await db.rpc('credit_referral', {
        p_code: friend.code,
        p_order_id: orderId,
        p_buyer_uid: user.uid,
        p_buyer_optional: optional,
        p_reward_paise: REFERRAL_REWARD_PAISE,
        p_free_cap_paise: FREE_BALANCE_CAP_PAISE,
      });
      if (refErr) console.error('[create-order] referral credit failed:', refErr.message);
    }
    return NextResponse.json({ granted: true, plan, optional, expiresAt: granted.expires_at });
  }

  try {
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `dc_${user.uid.slice(0, 8)}_${Date.now()}`,
      notes: {
        firebase_uid: user.uid,
        email: user.email ?? '',
        plan,
        optional,
        days: String(planData.days),
        ...(offer ? { offer: offer.id } : {}),
        ...(friend ? { ref: friend.code, friend_discount: String(friend.paise) } : {}),
        ...(balanceSpend > 0 ? { balance_spend: String(balanceSpend) } : {}),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      description: `${optLabel} — ${planData.label}`,
      optional,
    });
  } catch (e) {
    console.error('Razorpay order error:', e);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
