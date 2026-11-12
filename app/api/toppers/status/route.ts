import { NextRequest, NextResponse } from 'next/server';
import { noStore } from '@/lib/cacheHeaders';
import { FREE_TOPPER_LIMIT, isTopperSubject } from '@/lib/toppers/meta';
import { readStatus, resolveReader } from '@/lib/toppers/access';

/**
 * The reader's topper copy allowance, without spending any of it.
 *
 *   GET /api/toppers/status?subject=sociology
 *   { opened: string[], used, limit, unlimited, via, passUntil, own, requiresLogin? }
 *
 * `via` says what opens every copy, a 'subscription' or a 'pass', and
 * `passUntil` when a pass runs out. `own` is the optional on the reader's
 * profile as a route slug: only copies of that optional open past the free
 * five, so the pages offer the pass there and explain elsewhere.
 *
 * `opened` is the copies in this optional already opened, which the lists mark
 * as free to open again. It reads the same rows the open route spends, so the
 * count a reader is shown is the count the server applies.
 */
export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get('subject');
  if (!isTopperSubject(subject)) return NextResponse.json({ error: 'unknown_subject' }, { status: 400, headers: noStore });
  try {
    const reader = await resolveReader(req, subject);
    if (!reader.uid) {
      return NextResponse.json({ opened: [], used: 0, limit: FREE_TOPPER_LIMIT, unlimited: false, requiresLogin: true }, { headers: noStore });
    }
    const status = await readStatus(reader, subject);
    if (status.degraded) return NextResponse.json({ error: 'unlocks_unavailable' }, { status: 503, headers: noStore });
    return NextResponse.json(
      { opened: status.opened, used: status.used, limit: status.limit, unlimited: reader.unlimited, via: reader.via, passUntil: reader.passUntil, own: reader.own },
      { headers: noStore },
    );
  } catch (e) {
    console.error('[api/toppers/status]', e);
    return NextResponse.json({ error: 'toppers_unavailable' }, { status: 503, headers: noStore });
  }
}
