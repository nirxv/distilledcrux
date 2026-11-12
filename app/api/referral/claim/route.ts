import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { isRefCode } from '@/lib/referral';

/**
 * Saves the invite code a signed-in reader arrived with to their account, so
 * the friend's discount follows them to any device (components/RefCapture
 * calls this once per account and code). The first code saved wins, and a
 * reader's own code is refused. Checkout still checks the rest.
 *
 *   POST /api/referral/claim   { ref: 'ABC234' }   ->   { saved }
 */
export async function POST(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ref } = await req.json().catch(() => ({}));
  if (!isRefCode(ref)) return NextResponse.json({ saved: false }, { status: 400 });
  const code = String(ref).toUpperCase();

  const db = createServerClient();
  const { data: owner } = await db.from('referral_codes').select('firebase_uid').eq('code', code).maybeSingle();
  if (!owner?.firebase_uid || owner.firebase_uid === user.uid) return NextResponse.json({ saved: false });

  const { error } = await db.from('referral_claims').insert({ firebase_uid: user.uid, code });
  if (error && error.code !== '23505') {
    console.error('[referral/claim]', error.message);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
  return NextResponse.json({ saved: !error });
}
