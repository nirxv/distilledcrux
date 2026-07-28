import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-user-token');
  const user = await verifyFirebaseToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('optional, email, created_at')
    .eq('firebase_uid', user.uid)
    .single();

  if (error || !data) return NextResponse.json({ optional: null });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-user-token');
  const user = await verifyFirebaseToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { optional } = body;

  const validOptionals = [
    'history', 'sociology', 'anthropology',
    'geography', 'political-science', 'public-administration',
  ];
  if (!validOptionals.includes(optional)) {
    return NextResponse.json({ error: 'Invalid optional' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      firebase_uid: user.uid,
      email: user.email,
      optional,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'firebase_uid' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
