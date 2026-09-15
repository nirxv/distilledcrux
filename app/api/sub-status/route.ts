import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { noStore } from '@/lib/cacheHeaders';

/**
 * Whether the caller is on a paid plan. The PYQ pages use it to decide whether
 * to show a full model answer or the paywalled excerpt.
 *
 * Subscriptions here are per (firebase_uid, optional), and a reader who has
 * switched optionals can hold an expired row alongside a live one, so the
 * question asked is whether any subscription is live rather than which.
 *
 * The answer depends on who is asking, so it must never be cached at the edge.
 */
export async function GET(req: NextRequest) {
  // Header first. In a query parameter the token lands in access logs, browser
  // history and any proxy on the path.
  const token = req.headers.get('x-user-token') ?? req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ active: false }, { headers: noStore });

  const user = await verifyFirebaseToken(token);
  if (!user) return NextResponse.json({ active: false }, { headers: noStore });

  const db = createServerClient();
  const { data, error } = await db
    .from('subscriptions')
    .select('plan, optional, expires_at')
    .eq('firebase_uid', user.uid)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ active: false }, { headers: noStore });

  return NextResponse.json({
    active: true,
    plan: data.plan,
    optional: data.optional,
    expiresAt: data.expires_at,
  }, { headers: noStore });
}
