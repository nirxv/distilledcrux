import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { createServerClient } from '@/lib/supabase';
import { tokenHash, verifyCardToken } from '@/lib/shareCard';
import { getOrCreateRefCode } from '@/lib/referralServer';
import { SITE } from '@/lib/referral';

/**
 * Publishing an answer check at /s/<share_id>, and taking it down.
 *
 * POST takes the signed card /api/evaluate returned. Only a card signed here,
 * for this reader, is accepted. Sharing the same check again returns the same
 * link. The link carries the reader's invite code, so a friend who comes in
 * through the card and buys counts as their referral.
 */
export async function POST(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { token } = await req.json().catch(() => ({}));
  const signed = verifyCardToken(token);
  if (!signed || signed.uid !== user.uid) return NextResponse.json({ error: 'This check cannot be shared.' }, { status: 400 });

  const db = createServerClient();
  const hash = tokenHash(token);
  const { data: existing } = await db.from('shared_checks').select('share_id').eq('token_hash', hash).maybeSingle();
  let shareId = existing?.share_id as string | undefined;
  if (!shareId) {
    shareId = randomBytes(8).toString('base64url');
    const { error } = await db.from('shared_checks').insert({ share_id: shareId, token_hash: hash, firebase_uid: user.uid, card: signed.card });
    if (error) return NextResponse.json({ error: 'Could not make the link. Try again.' }, { status: 500 });
  }
  const code = await getOrCreateRefCode(db, user.uid);
  return NextResponse.json({ shareId, url: `${SITE}/s/${shareId}${code ? `?ref=${code}` : ''}` });
}

export async function DELETE(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get('x-user-token'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { shareId } = await req.json().catch(() => ({}));
  if (typeof shareId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(shareId)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const db = createServerClient();
  const { error } = await db.from('shared_checks').delete().eq('share_id', shareId).eq('firebase_uid', user.uid);
  if (error) return NextResponse.json({ error: 'Could not stop sharing. Try again.' }, { status: 500 });
  revalidatePath(`/s/${shareId}`);
  return NextResponse.json({ ok: true });
}
