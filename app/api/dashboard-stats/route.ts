import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-user-token');
  const user = await verifyFirebaseToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();

  const [profileRes, usageRes] = await Promise.all([
    supabase.from('user_profiles').select('optional, created_at').eq('firebase_uid', user.uid).single(),
    supabase.from('usage_tracking').select('chat_count, updated_at').eq('firebase_uid', user.uid).single(),
  ]);

  const optional = profileRes.data?.optional ?? null;
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
      .single();

    isPremium = !!subRes.data;
    plan = subRes.data?.plan ?? null;
    expiresAt = subRes.data?.expires_at ?? null;
  }

  const daysSinceJoin = joinedAt
    ? Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return NextResponse.json({
    optional,
    chatCount,
    lastActive,
    isPremium,
    plan,
    expiresAt,
    joinedAt,
    daysSinceJoin,
  });
}
