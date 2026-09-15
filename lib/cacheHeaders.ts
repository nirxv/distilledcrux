/**
 * Cache-Control policies for API responses.
 *
 * Every route handler is dynamic by default in the App Router, so Next.js
 * sends `public, max-age=0, must-revalidate` unless told otherwise — meaning
 * every request for data that changes a few times a week ran a fresh database
 * query. These policies put that traffic on Vercel's edge instead.
 *
 * The trap this exists to make hard to fall into: the CDN keys on the URL and
 * the Vary header, NOT on arbitrary request headers. A route that returns more
 * data to an admin than to the public must therefore never return a `public`
 * policy on the admin variant — the admin's response would be cached under the
 * same key and served to whoever asks next. Those routes use `noStore`.
 */

/**
 * Cacheable at the edge, revalidated by the browser.
 *
 * `max-age=0` keeps the browser honest, so a reader never sees minutes-old
 * data in their own tab, while `s-maxage` lets the CDN absorb the load.
 * `stale-while-revalidate` serves the old copy during the refresh, so no
 * request ever waits on the origin once the entry is warm.
 */
export function cachePublic(sMaxAgeSeconds: number, swrSeconds = sMaxAgeSeconds * 10) {
  return {
    'Cache-Control':
      `public, max-age=0, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${swrSeconds}`,
  };
}

/** For anything whose content depends on who is asking. */
export const noStore = { 'Cache-Control': 'private, no-store' };
