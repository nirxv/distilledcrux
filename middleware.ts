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
 */
const GATED = ['/cms', '/cms-api'];
const GATE_COOKIE = 'cms_gate';
const GATE_MAX_AGE = 60 * 60 * 8;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isGated = GATED.some(p => pathname === p || pathname.startsWith(`${p}/`));
  if (!isGated) return NextResponse.next();

  const hasCookie = Boolean(req.cookies.get(GATE_COOKIE)?.value);
  const expected = process.env.ADMIN_SECRET_KEY;
  const keyIsValid = Boolean(expected) && req.nextUrl.searchParams.get('key') === expected;

  if (!hasCookie && !keyIsValid) {
    // A bare 404, with no body and no header naming what is here.
    return new NextResponse(null, { status: 404 });
  }

  if (keyIsValid && !hasCookie) {
    const res = NextResponse.next();
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
