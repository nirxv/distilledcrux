import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { PRELIMS_LIVE } from '@/lib/features';

/** Every /prelims page is a 404 until there is a question bank behind it; see lib/features.ts. */
export default function PrelimsLayout({ children }: { children: ReactNode }) {
  if (!PRELIMS_LIVE) notFound();
  return children;
}
