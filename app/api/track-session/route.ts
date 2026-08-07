import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

const BOT_UA = /bot|crawler|spider|crawling|googlebot|bingbot|ahrefsbot|semrushbot|mj12bot|dotbot|rogerbot|facebookexternalhit|python|curl|wget|axios|node-fetch|go-http-client|java|ruby|scrapy/i;

// In-memory rate limiter (per visitor_id, 3 req / 10s)
const rateLimitStore = new Map<string, number[]>();
function isRateLimited(visitor_id: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitStore.get(visitor_id) ?? []).filter(t => now - t < 10_000);
  if (timestamps.length >= 3) return true;
  timestamps.push(now);
  rateLimitStore.set(visitor_id, timestamps);
  if (rateLimitStore.size > 10_000) rateLimitStore.delete(rateLimitStore.keys().next().value as string);
  return false;
}

function parseCountry(req: NextRequest) {
  const country = req.headers.get('x-vercel-ip-country') ?? null;
  const city = req.headers.get('x-vercel-ip-city')
    ? decodeURIComponent(req.headers.get('x-vercel-ip-city')!)
    : null;
  return { country, city };
}

// ---------------------------------------------------------------------------
// PATCH — heartbeat (keeps last_active + duration fresh)
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent') ?? '';
    if (BOT_UA.test(ua)) return NextResponse.json({ ok: false, reason: 'bot' });

    const { visitor_id } = await req.json();
    if (!visitor_id) return NextResponse.json({ ok: false });

    const sb = createServerClient();
    const { data: existing } = await sb
      .from('user_sessions')
      .select('id, session_start')
      .eq('visitor_id', visitor_id)
      .order('session_start', { ascending: false })
      .limit(1)
      .single();

    if (!existing) return NextResponse.json({ ok: false });

    const now = new Date();
    const start = existing.session_start ? new Date(existing.session_start) : now;
    const duration = Math.floor((now.getTime() - start.getTime()) / 1000);

    await sb
      .from('user_sessions')
      .update({ last_active: now.toISOString(), session_duration_secs: duration })
      .eq('id', existing.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

// ---------------------------------------------------------------------------
// POST — page navigation ping (insert or update)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent') ?? '';
    if (BOT_UA.test(ua)) return NextResponse.json({ ok: false, reason: 'bot' });

    const { visitor_id, firebase_uid, page, referrer, device, os, browser, is_first_visit } = await req.json();
    if (!visitor_id) return NextResponse.json({ ok: false, reason: 'no visitor_id' });

    if (isRateLimited(visitor_id)) return NextResponse.json({ ok: false, reason: 'rate_limited' });

    const sb = createServerClient();
    const { country, city } = parseCountry(req);
    const now = new Date().toISOString();

    const { data: existing, error: selErr } = await sb
      .from('user_sessions')
      .select('id, visit_count, pages_visited, session_start')
      .eq('visitor_id', visitor_id)
      .order('session_start', { ascending: false })
      .limit(1)
      .single();

    if (selErr && selErr.code !== 'PGRST116') {
      return NextResponse.json({ ok: false, reason: selErr.message });
    }

    if (existing) {
      const pages: string[] = existing.pages_visited ?? [];
      if (!pages.includes(page)) pages.push(page);
      const start = existing.session_start ? new Date(existing.session_start) : new Date();
      const duration = Math.floor((Date.now() - start.getTime()) / 1000);

      await sb
        .from('user_sessions')
        .update({
          visit_count: (existing.visit_count ?? 1) + 1,
          visited_at: now,
          last_active: now,
          last_page: page,
          pages_visited: pages,
          session_duration_secs: duration,
          is_bounce: pages.length <= 1,
          ...(firebase_uid && { firebase_uid }),
          ...(device && { device }),
          ...(os && { os }),
          ...(browser && { browser }),
          ...(country && { country }),
          ...(city && { city }),
        })
        .eq('id', existing.id);
    } else {
      await sb.from('user_sessions').insert({
        visitor_id,
        firebase_uid: firebase_uid || null,
        visit_count: 1,
        visited_at: now,
        session_start: now,
        last_active: now,
        entry_page: page,
        last_page: page,
        pages_visited: [page],
        referrer: referrer || 'direct',
        device: device || 'unknown',
        os: os || 'unknown',
        browser: browser || 'unknown',
        country,
        city,
        is_bounce: true,
        session_duration_secs: 0,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e.message });
  }
}
