import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyFirebaseToken } from '@/lib/verifyFirebaseToken';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { cachePublic } from '@/lib/cacheHeaders';
import { isPdf } from '@/lib/fileSignature';

/**
 * Community answers on a PYQ: a PDF in public storage plus a row naming it.
 *
 * Answer ids are only unique within a subject, so both the query and the
 * storage path are keyed by (subject, pyq_id). Reading /sociology/pyqs/12
 * must not surface the answers posted on /geography/pyqs/12.
 */
const SUBJECTS = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'];
const BUCKET = 'pyq-answers';
const MAX_PDF_BYTES = 5 * 1024 * 1024;

const publicUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

export async function GET(req: NextRequest) {
  const pyqId = Number(req.nextUrl.searchParams.get('pyq_id'));
  const subject = req.nextUrl.searchParams.get('subject') ?? '';

  if (!Number.isInteger(pyqId) || pyqId <= 0) {
    return NextResponse.json({ error: 'Missing pyq_id' }, { status: 400 });
  }
  if (!SUBJECTS.includes(subject)) {
    return NextResponse.json({ error: 'Unknown subject' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('pyq_answers')
    .select('id, display_name, storage_path, answer_number, created_at')
    .eq('subject', subject)
    .eq('pyq_id', pyqId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const answers = (data ?? []).map(row => ({ ...row, public_url: publicUrl(row.storage_path) }));
  // Short window: an upload should reach other readers quickly. The uploader
  // sees theirs at once because the client appends it optimistically.
  return NextResponse.json({ answers }, { headers: cachePublic(30) });
}

export async function POST(req: NextRequest) {
  // Posting is anonymous on purpose, since answers are shared under a display
  // name rather than an account, so the ceiling is per IP. failClosed because
  // this limiter is the only thing standing between the open internet and
  // unbounded writes into paid storage.
  const { allowed } = await checkRateLimit(`pyq-upload:${clientIp(req)}`, {
    limit: 5,
    windowSeconds: 3600,
    failClosed: true,
  });
  if (!allowed) {
    return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 });
  }

  const form = await req.formData();
  const pyqId = Number(form.get('pyq_id'));
  const subject = String(form.get('subject') ?? '');
  const rawName = String(form.get('display_name') ?? '').trim();
  const file = form.get('file');

  if (!Number.isInteger(pyqId) || pyqId <= 0 || !rawName || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }
  if (!SUBJECTS.includes(subject)) {
    return NextResponse.json({ error: 'Unknown subject.' }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: 'File too large (max 5MB).' }, { status: 413 });
  }

  // file.type is the Content-Type the caller wrote into the multipart part:
  // their claim about the file, not a fact about it. These bytes are served
  // publicly afterwards, so check the actual signature.
  const bytes = await file.arrayBuffer();
  if (!isPdf(bytes)) {
    return NextResponse.json({ error: 'That file is not a PDF.' }, { status: 400 });
  }

  const db = createServerClient();

  // Optional auth: a signed-in uploader gets their uid recorded, so an answer
  // can be traced back or removed later.
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer /, '') || req.headers.get('x-user-token') || '';
  const user = token ? await verifyFirebaseToken(token).catch(() => null) : null;

  const safeName = rawName.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 30).trim() || 'User';

  const { count } = await db
    .from('pyq_answers')
    .select('id', { count: 'exact', head: true })
    .eq('subject', subject)
    .eq('pyq_id', pyqId);

  const answerNumber = (count ?? 0) + 1;
  const fileName = `${safeName.replace(/ /g, '-')}-${answerNumber}.pdf`;
  const storagePath = `${subject}/pyq-${pyqId}/${Date.now()}-${fileName}`;

  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: inserted, error: insertErr } = await db
    .from('pyq_answers')
    .insert({
      subject,
      pyq_id: pyqId,
      display_name: safeName,
      storage_path: storagePath,
      answer_number: answerNumber,
      firebase_uid: user?.uid ?? null,
    })
    .select('id, display_name, storage_path, answer_number, created_at')
    .single();

  if (insertErr) {
    // The row is what makes the file reachable, so an orphaned object is only
    // cost. Remove it rather than leave it paid for and unreferenced.
    await db.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    answer: { ...inserted, public_url: publicUrl(storagePath) },
  });
}
