import { NextRequest, NextResponse } from 'next/server';
import { getNoteContent } from '@/lib/noteContent';
import { getNoteHiContent } from '@/lib/noteContentHi';
import { createServerClient } from '@/lib/supabase';
import { cachePublic } from '@/lib/cacheHeaders';

/**
 * Note body for one slug in one language.
 *
 * The page prerenders the English body; when the reader has Hindi on, the
 * reader fetches the same note here instead of downloading the whole Hindi
 * corpus. English keeps the admin override behaviour: an override is an edit
 * of the English text, and applying it to Hindi would show English to readers
 * who asked for Hindi.
 */

const SLUG = /^[a-z0-9-]{1,90}$/;
const SUBJECTS = new Set(['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin']);

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const subject = p.get('subject') ?? '';
  const slug = p.get('slug') ?? '';
  const lang = p.get('lang') === 'hi' ? 'hi' : 'en';

  if (!SUBJECTS.has(subject) || !SLUG.test(slug)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  if (lang === 'hi') {
    const html = await getNoteHiContent(subject, slug);
    return NextResponse.json({ html }, { headers: cachePublic(86400) });
  }

  let html = '';
  try {
    const db = createServerClient();
    const { data } = await db.from('note_overrides').select('content').eq('slug', slug).maybeSingle();
    if (data?.content) html = data.content;
  } catch {
    // Overrides are optional; the bundled note is the fallback.
  }
  if (!html) html = await getNoteContent(subject, slug);

  return NextResponse.json({ html }, { headers: cachePublic(3600) });
}
