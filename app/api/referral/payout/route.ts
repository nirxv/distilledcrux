import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { isUpiId } from '@/lib/referral';

/**
 * Asks for the reader's whole invite balance to be sent to a UPI id. The
 * database decides whether a milestone is open (migration 012); the money
 * leaves the balance at once and the user pays it by hand from the admin.
 *
 *   POST /api/referral/payout   { upi: 'name@bank' }
 */
const REFUSED: Record<string, string> = {
  no_window: 'Cash-out opens once you have bought a yearly plan.',
  pending: 'Your last request is still being paid.',
  not_yet: 'Cash-out opens at your next milestone.',
  empty: 'There is nothing in your balance to cash out.',
};

export async function POST(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { upi } = await req.json().catch(() => ({}));
  if (!isUpiId(upi)) return NextResponse.json({ error: 'Enter a UPI id like name@bank.' }, { status: 400 });

  const { data, error } = await createServerClient().rpc('request_referral_payout', {
    p_uid: user.uid,
    p_email: user.email ?? '',
    p_upi: String(upi).trim(),
  });
  if (error) {
    console.error('[referral/payout]', error.message);
    return NextResponse.json({ error: 'Could not send the request. Try again.' }, { status: 500 });
  }
  if (data?.result !== 'requested') {
    return NextResponse.json({ error: REFUSED[data?.result] ?? 'Cash-out is not open right now.' }, { status: 409 });
  }
  return NextResponse.json({ requested: true, amountPaise: data.amount_paise }, { headers: { 'Cache-Control': 'no-store' } });
}
