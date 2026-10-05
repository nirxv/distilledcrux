'use client';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useOptional } from '@/components/useOptional';
import { routeSlugForOptional, labelForOptional } from '@/lib/optionals';

/**
 * The hero's buttons, which change with who is reading. The page itself is
 * static; this reads the cached optional on arrival and corrects itself once
 * sign-in settles.
 */

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

/** The hero's two buttons: start, or carry on with your optional. */
export function HeroActions() {
  const { user } = useAuth();
  const optional = useOptional();
  const slug = routeSlugForOptional(optional);
  const label = labelForOptional(optional);

  if (slug && label) {
    return (
      <div className="hm-actions">
        <Link href={`/notes/${slug}`} className="ds-btn ds-btn-solid ds-btn-lg">Continue with {label}<Arrow /></Link>
        <Link href="/dashboard" className="ds-btn ds-btn-ghost">Your dashboard</Link>
      </div>
    );
  }
  return (
    <div className="hm-actions">
      <Link href={user ? '/onboarding' : '/login'} className="ds-btn ds-btn-solid ds-btn-lg">Start studying, it’s free<Arrow /></Link>
      <Link href="#optionals" className="ds-btn ds-btn-ghost">Pick your optional first</Link>
    </div>
  );
}
