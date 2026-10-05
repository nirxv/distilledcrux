import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { hasActiveSubscription, optionalForSubject } from '@/lib/entitlements';
import { resolveUsageIdentity, readUsage } from '@/lib/usageIdentity';
import { noStore } from '@/lib/cacheHeaders';

/** Kept in step with CHAT_FREE_LIMIT in ../route.ts. */
const CHAT_FREE_LIMIT = 3;

/**
 * What the chat page needs before the first message: whether the reader is
 * signed in, subscribed to this optional, and how many free messages are
 * left. It draws "Free messages remaining", the premium marks and the gates
 * from this, and /api/chat enforces the same rules whatever the page shows.
 *
 *   GET /api/chat/usage?subject=sociology   (x-user-token: <Firebase ID token>)
 *
 * The answer depends on who is asking, so it is never cached.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('x-user-token') ?? '';
  const user = token ? await verifyFirebaseToken(token) : null;
  if (!user) {
    return NextResponse.json({ signedIn: false, subscribed: false, used: 0, limit: CHAT_FREE_LIMIT }, { headers: noStore });
  }

  const subject = req.nextUrl.searchParams.get('subject');
  const subscribed = await hasActiveSubscription(createServerClient(), user.uid, optionalForSubject(subject));
  const used = subscribed ? 0 : await readUsage(resolveUsageIdentity(req, user.uid), 'chat_count');

  return NextResponse.json({ signedIn: true, subscribed, used, limit: CHAT_FREE_LIMIT }, { headers: noStore });
}
