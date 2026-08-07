import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      visitor_id,
      firebase_uid,
      page,
      referrer,
      device,
      os,
      browser,
      is_new_session,
    } = body;

    if (!visitor_id) return NextResponse.json({ ok: false }, { status: 400 });

    const sb = createServerClient();
    const now = new Date().toISOString();

    if (is_new_session) {
      // Geo lookup from IP
      let country: string | null = null;
      let city: string | null = null;
      try {
        const ip =
          req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
          req.headers.get('x-real-ip') ||
          null;
        if (ip && ip !== '::1' && ip !== '127.0.0.1') {
          const geo = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,status`, {
            signal: AbortSignal.timeout(2000),
          }).then(r => r.json());
          if (geo.status === 'success') {
            country = geo.country ?? null;
            city = geo.city ?? null;
          }
        }
      } catch {
        // geo is best-effort, never block the insert
      }

      await sb.from('user_sessions').insert({
        visitor_id,
        firebase_uid: firebase_uid || null,
        visited_at: now,
        session_start: now,
        last_active: now,
        entry_page: page,
        last_page: page,
        pages_visited: [page],
        referrer: referrer || null,
        device: device || null,
        os: os || null,
        browser: browser || null,
        is_bounce: true,
        visit_count: 1,
        session_duration_secs: 0,
        country,
        city,
      });
    } else {
      // Existing session — fetch and update
      const { data: existing } = await sb
        .from('user_sessions')
        .select('id, pages_visited, session_start, visit_count')
        .eq('visitor_id', visitor_id)
        .order('session_start', { ascending: false })
        .limit(1)
        .single();

      if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

      const pages: string[] = existing.pages_visited ?? [];
      if (!pages.includes(page)) pages.push(page);

      const startTime = new Date(existing.session_start).getTime();
      const duration = Math.round((Date.now() - startTime) / 1000);

      await sb
        .from('user_sessions')
        .update({
          last_active: now,
          last_page: page,
          pages_visited: pages,
          is_bounce: pages.length <= 1,
          session_duration_secs: duration,
          visit_count: existing.visit_count + 1,
          firebase_uid: firebase_uid || null,
        })
        .eq('id', existing.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[track-session]', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
