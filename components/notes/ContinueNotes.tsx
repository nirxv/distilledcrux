'use client';
import Link from 'next/link';
import { useOptional } from '@/components/useOptional';
import { labelForOptional, routeSlugForOptional } from '@/lib/optionals';

/** For a reader who has picked an optional: straight back to its notes. */
export default function ContinueNotes() {
  const optional = useOptional();
  const slug = routeSlugForOptional(optional);
  const label = labelForOptional(optional);
  if (!slug || !label) return null;
  return (
    <Link href={`/notes/${slug}`} className="nl-continue" style={{ ['--t' as string]: `var(--tint-${slug})`, ['--w' as string]: `var(--wash-${slug})` }}>
      <span className="nl-continue-text">Carry on with your <b>{label}</b> notes</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </Link>
  );
}
