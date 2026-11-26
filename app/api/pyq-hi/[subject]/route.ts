import { NextResponse } from 'next/server';
import { PYQ_TOPICS_HI } from '@/lib/pyqHi/topics';
import { cachePublic } from '@/lib/cacheHeaders';

/**
 * The Hindi question bank for one subject.
 *
 * One static route per subject, built at deploy and served straight from the
 * edge: no function runs, no module is parsed per request, and the whole bank
 * is a single cache entry. English traffic never touches it.
 */

const SUBJECTS = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'] as const;
type Subject = (typeof SUBJECTS)[number];

const LOADERS: Record<Subject, () => Promise<Record<string, string>>> = {
  sociology: () => import('@/lib/pyqHi/sociology').then((m) => m.pyqHi),
  anthropology: () => import('@/lib/pyqHi/anthropology').then((m) => m.pyqHi),
  polsci: () => import('@/lib/pyqHi/polsci').then((m) => m.pyqHi),
  geography: () => import('@/lib/pyqHi/geography').then((m) => m.pyqHi),
  'pub-admin': () => import('@/lib/pyqHi/pub-admin').then((m) => m.pyqHi),
};

export const dynamic = 'force-static';

export function generateStaticParams() {
  return SUBJECTS.map((subject) => ({ subject }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ subject: string }> },
) {
  const { subject } = await params;
  if (!SUBJECTS.includes(subject as Subject)) {
    return NextResponse.json({ error: 'unknown subject' }, { status: 404 });
  }
  const q = await LOADERS[subject as Subject]();
  return NextResponse.json(
    { q, topics: PYQ_TOPICS_HI[subject] ?? {} },
    { headers: cachePublic(86400) },
  );
}
