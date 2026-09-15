import { NextRequest, NextResponse } from 'next/server';

/**
 * Keeps the CMS from being discoverable.
 *
 * Every path below 404s unless the request carries a valid ?key= or the
 * cookie that a valid key drops. This is not the thing protecting the data:
 * Payload's own auth does that, and these routes already refuse an
 * unauthenticated caller. This only stops the panel from announcing itself to
 * anyone who tries /cms.
 *
 * The cookie is load-bearing, not a convenience. The key can only appear on
 * the first request: Payload's client navigations and its /cms-api fetches
 * carry no query string, so gating on ?key= alone would 404 the panel's own
 * traffic and it could never log in.
 *
 * The list is explicit rather than a prefix test, because a prefix test is
 * easy to get wrong as paths are renamed.
 *
 * This is proxy.ts, not middleware.ts: Next 16 deprecated the middleware file
 * convention and renamed it, function included.
 */
const GATED = ['/cms', '/cms-api'];
const GATE_COOKIE = 'cms_gate';
const GATE_MAX_AGE = 60 * 60 * 8;

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isGated = GATED.some(p => pathname === p || pathname.startsWith(`${p}/`));
  if (!isGated) return NextResponse.next();

  const hasCookie = Boolean(req.cookies.get(GATE_COOKIE)?.value);
  const expected = process.env.ADMIN_SECRET_KEY;

  // Without the variable nothing can ever match, so the panel 404s for
  // everyone including whoever holds the key. That is the right way to fail,
  // but it is indistinguishable from a wrong key at the door, so say which it
  // is in the log. Deliberately not deduped behind a module flag: proxy code
  // may be deployed to the CDN and must not rely on globals persisting.
  if (!expected) {
    console.error(
      '[proxy] ADMIN_SECRET_KEY is not set, so /cms is unreachable in this deploy.');
  }

  const keyIsValid = Boolean(expected) && req.nextUrl.searchParams.get('key') === expected;

  if (!hasCookie && !keyIsValid) {
    // A bare 404, with no body and no header naming what is here.
    return new NextResponse(null, { status: 404 });
  }

  if (keyIsValid && !hasCookie) {
    // Redirect to the same path without the key rather than serving it in
    // place. The cookie carries the gate from here on, so the key has done its
    // job, and leaving it in the address bar is how it leaks: it sits in
    // browser history, in the back button, and in any screenshot of the
    // window. Two working keys were burned that way before this existed.
    const clean = req.nextUrl.clone();
    clean.searchParams.delete('key');
    const res = NextResponse.redirect(clean);
    res.cookies.set(GATE_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: GATE_MAX_AGE,
    });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  // Only the CMS. Everything else on the site is public and should not pay for
  // a middleware hop.
  matcher: ['/cms/:path*', '/cms', '/cms-api/:path*', '/cms-api'],
};
