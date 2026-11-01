import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { pyqCountForOptional } from '@/lib/pyqCounts';
import { isPyqSubject, loadPyqs } from '@/lib/pyqs';
import { dailyQuestions } from '@/lib/dailyQuestions';
import { notesForSubject } from '@/lib/notes';
import { routeSlugForOptional } from '@/lib/optionals';

/**
 * What the dashboard needs to report coverage: each topic's question ids, by
 * paper. Ids rather than questions, so this stays a few kilobytes.
 */
async function pyqIndex(slug: string | null) {
  if (!slug || !isPyqSubject(slug)) return null;
  const { questions, topics } = await loadPyqs(slug);
  return topics.map((t) => ({
    name: t.name,
    p1: questions.filter((q) => q.topic === t.name && q.paper === 'Paper I').map((q) => q.id),
    p2: questions.filter((q) => q.topic === t.name && q.paper === 'Paper II').map((q) => q.id),
  }));
}

/**
 * Today's question for the dashboard: the first of the optional's daily five
 * (lib/dailyQuestions), so the dashboard and the daily set agree. It used to
 * be its own pick, by UTC day, from the same pool.
 */
async function questionOfTheDay(slug: string | null) {
  if (!slug || !isPyqSubject(slug)) return null;
  return (await dailyQuestions(slug))[0] ?? null;
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
  const [pyqCount, todayQuestion, pyqTopics] = await Promise.all([
    pyqCountForOptional(optional),
    questionOfTheDay(slug).catch(() => null),
    pyqIndex(slug).catch(() => null),
  ]);
  const notes = slug ? notesForSubject(slug) : [];
  const notesCount = notes.length;
  // The syllabus in order, for what is done and what comes next.
  const syllabus = notes.map((n) => ({ slug: n.slug, title: n.title, paper: n.paper, topic: n.topic }));

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
    syllabus,
    pyqTopics,
  });
}
