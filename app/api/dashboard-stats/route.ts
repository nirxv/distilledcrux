import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { pyqCountForOptional } from '@/lib/pyqCounts';
import { isPyqSubject, loadPyqs } from '@/lib/pyqs';
import { notesForSubject } from '@/lib/notes';
import { routeSlugForOptional } from '@/lib/optionals';

/**
 * One past question for the day, the same for every reader of an optional on
 * a given date: from the last ten years' papers, and one with marks, so it can
 * go straight to the evaluator.
 */
async function questionOfTheDay(slug: string | null) {
  if (!slug || !isPyqSubject(slug)) return null;
  const { questions } = await loadPyqs(slug);
  const newest = Number(questions[0]?.year) || 0;
  const pool = questions.filter((q) => q.marks && [10, 15, 20].includes(q.marks) && Number(q.year) >= newest - 10);
  if (!pool.length) return null;
  const day = Math.floor(Date.now() / 86_400_000);
  const q = pool[day % pool.length];
  return { id: q.id, question: q.question, year: q.year, paper: q.paper, marks: q.marks, topic: q.topic };
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-user-token');
  const user = await verifyFirebaseToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();

  const [profileRes, usageRes] = await Promise.all([
    supabase.from('user_profiles').select('optional, phone, created_at').eq('firebase_uid', user.uid).maybeSingle(),
    supabase.from('usage_tracking').select('chat_count, eval_count, updated_at').eq('firebase_uid', user.uid).maybeSingle(),
  ]);

  const optional = profileRes.data?.optional ?? null;
  const phone = profileRes.data?.phone ?? null;
  const chatCount = usageRes.data?.chat_count ?? 0;
  const evalCount = usageRes.data?.eval_count ?? 0;
  const lastActive = usageRes.data?.updated_at ?? null;
  const joinedAt = profileRes.data?.created_at ?? null;

  let isPremium = false;
  let plan: string | null = null;
  let expiresAt: string | null = null;

  if (optional) {
    const subRes = await supabase
      .from('subscriptions')
      .select('status, expires_at, plan')
      .eq('firebase_uid', user.uid)
      .eq('optional', optional)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    isPremium = !!subRes.data;
    plan = subRes.data?.plan ?? null;
    expiresAt = subRes.data?.expires_at ?? null;
  }

  const daysSinceJoin = joinedAt
    ? Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Counted here rather than in the page: the reader only ever sees their own
  // optional's bank, and the data files have no business in the client bundle.
  const slug = routeSlugForOptional(optional);
  const [pyqCount, todayQuestion] = await Promise.all([
    pyqCountForOptional(optional),
    questionOfTheDay(slug).catch(() => null),
  ]);
  const notesCount = slug ? notesForSubject(slug).length : 0;

  return NextResponse.json({
    optional,
    phone,
    chatCount,
    evalCount,
    lastActive,
    isPremium,
    plan,
    expiresAt,
    joinedAt,
    daysSinceJoin,
    pyqCount,
    notesCount,
    todayQuestion,
  });
}
