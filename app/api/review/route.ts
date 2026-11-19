import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rateLimit';
import { isOptionalId } from '@/lib/optionals';

/**
 * Reviews and suggestions from signed-in readers (components/ReviewPrompt).
 *   GET   whether this reader has sent one already, so the prompt is not
 *         shown again on another device, and whether they keep coming back
 *         (`ready`), so it is shown only to readers who do
 *   POST  saves one to the reviews table (supabase/migrations/015_reviews.sql)
 * Nothing here is shown on the site by itself: a review reaches a page only
 * by hand. The form tells readers a review may be shown on the site.
 */

/** Page views across the reader's browsers, and days between first and latest visit. */
const READY_PAGES = 20;
const READY_RETURN_DAYS = 3;

const ATTEMPTS = new Set(['1', '2', '3', '4', '5+', 'none']);
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export async function GET(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createServerClient();
  // user_sessions has one row per browser: visit_count is its page views,
  // session_start its first visit and last_active its latest.
  const [{ count }, { data: rows }] = await Promise.all([
    db.from('reviews').select('id', { count: 'exact', head: true }).eq('uid', user.uid),
    db.from('user_sessions').select('visit_count, session_start, last_active').eq('firebase_uid', user.uid),
  ]);
  let pages = 0, first = Infinity, last = 0;
  for (const r of rows ?? []) {
    pages += r.visit_count ?? 0;
    const f = Date.parse(r.session_start ?? ''), l = Date.parse(r.last_active ?? '');
    if (f < first) first = f;
    if (l > last) last = l;
  }
  const ready = pages >= READY_PAGES && last - first >= READY_RETURN_DAYS * 864e5;
  return NextResponse.json({ done: (count ?? 0) > 0, ready }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Sign in to send a review.' }, { status: 401 });

  const { allowed } = await checkRateLimit(`review:${user.uid}`, { limit: 3, windowSeconds: 3600 });
  if (!allowed) return NextResponse.json({ error: 'Too many submissions. Please wait a moment.' }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const review = clean(body.review, 2000);
  const suggestions = clean(body.suggestions, 2000);
  const name = clean(body.name, 80) || user.name || '';
  const about = clean(body.about, 120);
  const attempt = ATTEMPTS.has(body.attempt) ? body.attempt : null;
  const optional = isOptionalId(body.optional) ? body.optional : null;
  const page = clean(body.page, 200);

  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  if (words(review) < 5 && words(suggestions) < 5) return NextResponse.json({ error: 'Missing review' }, { status: 400 });

  const { error } = await createServerClient().from('reviews').insert({
    uid: user.uid, email: user.email ?? null, name, optional, attempt, about: about || null,
    review: review || null, suggestions: suggestions || null, page: page || null,
  });
  if (error) return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
