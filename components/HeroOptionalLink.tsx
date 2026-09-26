'use client';
import Link from 'next/link';
import { useOptional } from '@/components/useOptional';
import { routeSlugForOptional, labelForOptional } from '@/lib/optionals';

/**
 * The hero's second button.
 *
 * "Pick your optional" is an invitation, and it kept inviting readers who had
 * already accepted: someone signed in with Anthropology was still being asked
 * to choose one. Once there is an optional the button names it and goes
 * straight to that subject's notes instead of back down to the picker.
 */
export default function HeroOptionalLink() {
  const optional = useOptional();
  const slug = routeSlugForOptional(optional);
  const label = labelForOptional(optional);

  const href = slug ? `/notes/${slug}` : '#optionals';

  return (
    <Link href={href} className="lp-btn-ghost">
      {label ?? 'Pick your optional'}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2l5 5-5 5M2 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </Link>
  );
}
