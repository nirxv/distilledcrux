import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { getOrCreateRefCode, referralSummary } from '@/lib/referralServer';

/**
 * The signed-in reader's invite code, balance, earning window and cash-out
 * state (lib/referralServer). Asked for only when the invite page opens.
 */
export async function GET(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient();
  const code = await getOrCreateRefCode(db, user.uid);
  if (!code) return NextResponse.json({ error: 'Could not make your invite link. Try again.' }, { status: 500 });

  return NextResponse.json(await referralSummary(db, user.uid, code), { headers: { 'Cache-Control': 'no-store' } });
}
