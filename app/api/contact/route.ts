import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

/**
 * The contact form. Anyone can post, so the ceiling is per IP.
 *
 * Topic is checked against the list the form offers rather than accepted as
 * free text: it is a select, so anything else came from somewhere other than
 * the form, and a fixed set keeps the CMS view groupable.
 */
const TOPICS = [
  'Technical Issue',
  'Subscription / Payment',
  'Refund Request',
  'Feature Request',
  'Content Feedback',
  'Other',
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export async function POST(req: NextRequest) {
  const { allowed } = await checkRateLimit(`contact:${clientIp(req)}`, {
    limit: 3,
    windowSeconds: 60,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many messages. Please wait a moment.' },
      { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const name = text(body.name, 100);
  const email = text(body.email, 200);
  const topic = text(body.topic, 60);
  const message = text(body.message, 4000);

  if (!name || !email || !topic || !message) {
    return NextResponse.json({ error: 'Please fill in every field.' }, { status: 400 });
  }
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: 'That email address does not look right.' }, { status: 400 });
  }
  if (!TOPICS.includes(topic)) {
    return NextResponse.json({ error: 'Unknown topic.' }, { status: 400 });
  }

  const db = createServerClient();
  const { error } = await db
    .from('contact_submissions')
    .insert({ name, email, topic, message });

  if (error) {
    console.error('[contact] insert failed:', error.message);
    return NextResponse.json({ error: 'Could not send your message.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
