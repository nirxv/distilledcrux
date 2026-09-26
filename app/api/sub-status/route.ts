import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { noStore } from '@/lib/cacheHeaders';
import { optionalForSubject } from '@/lib/entitlements';

/**
 * Whether the caller is on a paid plan. The PYQ pages use it to decide whether
 * to show a full model answer or the paywalled excerpt.
 *
 * Subscriptions are per (firebase_uid, optional), so a caller that names a
 * subject is asked the only question worth asking — is this reader paid up for
 * *that* optional — rather than whether they hold any subscription at all. The
 * routes that serve the content enforce the same scope; this one exists so the
 * UI agrees with them instead of offering something the server will refuse.
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

  const subject = req.nextUrl.searchParams.get('subject') ?? req.nextUrl.searchParams.get('optional');

  const db = createServerClient();
  let query = db
    .from('subscriptions')
    .select('plan, optional, expires_at')
    .eq('firebase_uid', user.uid)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());
  if (subject) query = query.eq('optional', optionalForSubject(subject));

  const { data, error } = await query
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
