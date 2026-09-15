import type { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * Fixed-window rate limiting, in Postgres.
 *
 * The limiters used to be in-memory Maps. Every serverless invocation gets its
 * own, so a caller spread across instances was never counted together and the
 * limit did not actually apply. One of them also evicted by deleting an
 * arbitrary key once it held 10,000 entries, which quietly cleared whoever
 * happened to be first.
 *
 * The counting lives in a single SQL statement (see
 * supabase/migrations/001_rate_limits.sql) so two instances arriving at once
 * cannot both read the same count and both decide they are under the limit.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
  /** True when the check could not run and the request was let through. */
  degraded: boolean;
};

/** Left-most x-forwarded-for entry is the caller on Vercel. */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Counts one hit against `key` and says whether it is allowed.
 *
 * Fails OPEN by default: if Postgres is unreachable the request is allowed and
 * `degraded` is set. A limiter that takes the whole product down when the
 * database blips is worse than one that briefly stops limiting, but the caller
 * should log it, because a permanently degraded limiter is not a limiter.
 *
 * Pass `failClosed` where the limiter is the only ceiling on something
 * expensive or irreversible, such as an unauthenticated write into paid
 * storage. There a database outage must not turn the endpoint into an open one.
 */
export async function checkRateLimit(
  key: string,
  { windowSeconds, limit, failClosed = false }:
    { windowSeconds: number; limit: number; failClosed?: boolean },
): Promise<RateLimitResult> {
  const onFailure = (): RateLimitResult =>
    ({ allowed: !failClosed, remaining: 0, resetAt: null, degraded: true });

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc('bump_rate_limit', {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    });

    if (error || !data?.[0]) {
      console.error(
        `[rateLimit] check failed, ${failClosed ? 'rejecting' : 'allowing through'}:`,
        error?.message ?? 'no row');
      return onFailure();
    }

    const row = data[0] as { allowed: boolean; remaining: number; reset_at: string };
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt: row.reset_at ? new Date(row.reset_at) : null,
      degraded: false,
    };
  } catch (e) {
    console.error(
      `[rateLimit] check threw, ${failClosed ? 'rejecting' : 'allowing through'}:`, e);
    return onFailure();
  }
}

/** Standard headers, so a client can back off instead of hammering. */
export function rateLimitHeaders(r: RateLimitResult, limit: number): Record<string, string> {
  const h: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(r.remaining),
  };
  if (r.resetAt) {
    h['X-RateLimit-Reset'] = String(Math.floor(r.resetAt.getTime() / 1000));
    if (!r.allowed) {
      h['Retry-After'] = String(Math.max(1, Math.ceil((r.resetAt.getTime() - Date.now()) / 1000)));
    }
  }
  return h;
}
