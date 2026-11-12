import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/**
 * next/link that never prefetches. Every page imports this in place of
 * next/link.
 *
 * By default each <Link> in view prefetches its page, and on Vercel's Hobby
 * plan every request counts against the free CDN allowance. On 2026-11-13 one
 * load of the PYQ list made 73 requests, 37 of them navbar prefetches, and
 * scrolling the list prefetched one more page per question. Prefetching on
 * hover was tried too: it costs about six requests a link, against one for a
 * plain click, and a mouse crossing the navbar hovers half of it.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} prefetch={false} />;
}
