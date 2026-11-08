import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { getOrCreateRefCode } from '@/lib/referralServer';

/**
 * The signed-in reader's invite code, and how many friends have bought
 * through it. Asked for only when the invite page opens.
 */
export async function GET(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient();
  const code = await getOrCreateRefCode(db, user.uid);
  if (!code) return NextResponse.json({ error: 'Could not make your invite link. Try again.' }, { status: 500 });

  const { data } = await db.from('referrals').select('referrer_days').eq('referrer_uid', user.uid);
  const rows = data ?? [];
  return NextResponse.json(
    { code, joined: rows.length, daysEarned: rows.reduce((n, r) => n + (r.referrer_days ?? 0), 0) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
