import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { referralBalance } from '@/lib/referralServer';

/**
 * The signed-in reader's invite balance, for the navbar's chip. The navbar
 * keeps the answer for half an hour (lib/referralClient), so this is asked
 * about once a session rather than on every page.
 */
export async function GET(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const balancePaise = Math.max(0, await referralBalance(createServerClient(), user.uid));
  return NextResponse.json({ balancePaise }, { headers: { 'Cache-Control': 'no-store' } });
}
