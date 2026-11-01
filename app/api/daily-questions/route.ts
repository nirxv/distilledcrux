import { NextRequest, NextResponse } from 'next/server';
import { dailyQuestionsFor } from '@/lib/dailyQuestions';
import { isPyqSubject } from '@/lib/pyqs';

/**
 * One day's daily answer-writing set for one optional, for a page prerendered
 * on an earlier day. The day is in the URL and its set never changes, so the
 * CDN keeps each answer for good: about one function call per optional per
 * day per region.
 */
export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get('subject') ?? '';
  const day = req.nextUrl.searchParams.get('day') ?? '';
  if (!isPyqSubject(subject)) return NextResponse.json({ error: 'bad subject' }, { status: 400 });
  const questions = await dailyQuestionsFor(subject, day);
  if (!questions) return NextResponse.json({ error: 'bad day' }, { status: 400 });
  return NextResponse.json(
    { subject, day, questions },
    { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable' } },
  );
}
