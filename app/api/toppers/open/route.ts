import { NextRequest, NextResponse } from 'next/server';
import { noStore } from '@/lib/cacheHeaders';
import { copyKey, FREE_TOPPER_LIMIT, isTopperSubject } from '@/lib/toppers';
import { resolveReader, spendOpen } from '@/lib/toppers/access';
import { signedPdfUrl } from '@/lib/toppers/r2';

/**
 * Opens one topper copy.
 *
 *   POST /api/toppers/open   { subject: string, id: string }
 *
 *   200 { url, used, limit, unlimited }   a five-minute signed URL to the PDF
 *   401 { error: 'login_required' }       no account on the request
 *   403 { error: 'limit_reached', used, limit }
 *   404 { error: 'not_found' }            no such copy in this optional
 *   503 { error: ... }                    the allowance or the storage is unreachable
 *
 * A subscriber to the copy's optional is not metered. Anyone else spends one
 * of their five free opens on a copy they have not opened before, and nothing
 * on one they have. The id is checked against the copy list before anything is
 * charged, so a made-up id costs nothing and returns 404.
 */
export async function POST(req: NextRequest) {
  let body: { subject?: unknown; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore });
  }
  const { subject, id } = body;
  if (!isTopperSubject(subject) || typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore });
  }

  try {
    const key = await copyKey(subject, id);
    if (!key) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });

    const reader = await resolveReader(req, subject);
    if (!reader.uid) {
      return NextResponse.json({ error: 'login_required', limit: FREE_TOPPER_LIMIT }, { status: 401, headers: noStore });
    }

    let used = 0;
    if (!reader.unlimited) {
      const outcome = await spendOpen(reader, subject, id);
      if (outcome.degraded) return NextResponse.json({ error: 'unlocks_unavailable' }, { status: 503, headers: noStore });
      if (!outcome.granted) {
        return NextResponse.json(
          { error: 'limit_reached', used: outcome.used, limit: FREE_TOPPER_LIMIT },
          { status: 403, headers: noStore },
        );
      }
      used = outcome.used;
    }

    const url = await signedPdfUrl(key);
    if (!url) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503, headers: noStore });
    return NextResponse.json({ url, used, limit: FREE_TOPPER_LIMIT, unlimited: reader.unlimited }, { headers: noStore });
  } catch (e) {
    console.error('[api/toppers/open]', e);
    return NextResponse.json({ error: 'toppers_unavailable' }, { status: 503, headers: noStore });
  }
}
