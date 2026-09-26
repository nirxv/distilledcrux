import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { pyqCountForOptional } from '@/lib/pyqCounts';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-user-token');
  const user = await verifyFirebaseToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();

  const [profileRes, usageRes] = await Promise.all([
    supabase.from('user_profiles').select('optional, phone, created_at').eq('firebase_uid', user.uid).maybeSingle(),
    supabase.from('usage_tracking').select('chat_count, updated_at').eq('firebase_uid', user.uid).maybeSingle(),
  ]);

  const optional = profileRes.data?.optional ?? null;
  const phone = profileRes.data?.phone ?? null;
  const chatCount = usageRes.data?.chat_count ?? 0;
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
  const pyqCount = await pyqCountForOptional(optional);

  return NextResponse.json({
    optional,
    phone,
    chatCount,
    lastActive,
    isPremium,
    plan,
    expiresAt,
    joinedAt,
    daysSinceJoin,
    pyqCount,
  });
}
