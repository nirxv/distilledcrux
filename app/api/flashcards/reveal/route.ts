import { NextRequest, NextResponse } from 'next/server';
import { listBacks, listCards } from '@/lib/flashcardStore';
import { noStore } from '@/lib/cacheHeaders';
import { FREE_FLASHCARD_LIMIT, isFlashcardSubject } from '@/lib/flashcardMeta';
import { readUnlocks, resolveReader, spendUnlocks } from '@/lib/flashcardAccess';

/**
 * Flashcard answers. Ported from the history site.
 *
 *   POST /api/flashcards/reveal
 *   { subject: string, ids: string[], spend?: boolean }
 *
 * `spend` is the difference between looking and opening:
 *
 *   spend: false   Return the answers this reader has already unlocked, and
 *                  nothing else. The study page prefetches cards ahead of the
 *                  reader, and that window must not charge for cards they
 *                  have not chosen to open.
 *
 *   spend: true    Claim allowance for the one card the reader just turned.
 *
 *   GET /api/flashcards/reveal?subject=sociology
 *     The reader's allowance, without asking for any card.
 *
 * Subscribers to the deck's optional are not metered. Everyone else shares one
 * allowance of a hundred answers across all five decks.
 */

/** Ids per request. Matches the deck hook's prefetch batch. */
const MAX_IDS = 60;
/** A deliberate spend is the one card just turned; more is a client bug. */
const MAX_SPEND_IDS = 1;

export async function POST(req: NextRequest) {
  let body: { subject?: unknown; ids?: unknown; spend?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore });
  }

  const subject = body.subject;
  if (!isFlashcardSubject(subject)) {
    return NextResponse.json({ error: 'unknown_subject' }, { status: 400, headers: noStore });
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, MAX_IDS)
    : [];
  const spend = body.spend === true;
  if (spend && ids.length > MAX_SPEND_IDS) {
    return NextResponse.json({ error: 'too_many_to_spend' }, { status: 400, headers: noStore });
  }

  try {
    const reader = await resolveReader(req, subject);

    if (reader.unlimited) {
      const cards = await listBacks(subject, ids);
      return NextResponse.json(
        { cards, locked: [], used: 0, limit: FREE_FLASHCARD_LIMIT, unlimited: true },
        { headers: noStore },
      );
    }

    // 401 rather than an empty grant: the request cannot be attributed to
    // anyone yet, which is not the same as a spent allowance.
    if (!reader.uid) {
      return NextResponse.json(
        { error: 'login_required', requiresLogin: true, cards: [], locked: ids, used: 0, limit: FREE_FLASHCARD_LIMIT, unlimited: false },
        { status: 401, headers: noStore },
      );
    }

    // Only cards from this deck may be spent on or served. Ids from another
    // deck would otherwise cost the reader an unlock and return nothing.
    const inDeck = ids.length
      ? new Set((await listCards({ subject, ids, limit: MAX_IDS })).cards.map((c) => c.id))
      : new Set<string>();
    const own = ids.filter((id) => inDeck.has(id));
    if (!own.length) {
      // Asking the store about no ids returns every unlock the reader holds,
      // which is the count's job, not this one's.
      const { used, degraded } = await readUnlocks(reader, []);
      if (degraded) return NextResponse.json({ error: 'unlocks_unavailable' }, { status: 503, headers: noStore });
      return NextResponse.json(
        { cards: [], locked: ids, used, limit: FREE_FLASHCARD_LIMIT, unlimited: false },
        { headers: noStore },
      );
    }
    const outcome = spend ? await spendUnlocks(reader, own) : await readUnlocks(reader, own);

    // Degraded means the allowance could not be read, so nothing was granted.
    // Saying so stops the page telling a reader they are out of free answers.
    if (outcome.degraded) {
      return NextResponse.json({ error: 'unlocks_unavailable' }, { status: 503, headers: noStore });
    }

    const cards = await listBacks(subject, outcome.granted);
    return NextResponse.json(
      { cards, locked: outcome.locked, used: outcome.used, limit: FREE_FLASHCARD_LIMIT, unlimited: false },
      { headers: noStore },
    );
  } catch (e) {
    console.error('[api/flashcards/reveal]', e);
    return NextResponse.json({ error: 'flashcards_unavailable' }, { status: 503, headers: noStore });
  }
}

export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get('subject');
  if (!isFlashcardSubject(subject)) {
    return NextResponse.json({ error: 'unknown_subject' }, { status: 400, headers: noStore });
  }
  try {
    const reader = await resolveReader(req, subject);
    if (reader.unlimited) {
      return NextResponse.json({ used: 0, limit: FREE_FLASHCARD_LIMIT, unlimited: true }, { headers: noStore });
    }
    if (!reader.uid) {
      return NextResponse.json(
        { used: 0, limit: FREE_FLASHCARD_LIMIT, unlimited: false, requiresLogin: true },
        { headers: noStore },
      );
    }
    const { used, degraded } = await readUnlocks(reader, []);
    if (degraded) return NextResponse.json({ error: 'unlocks_unavailable' }, { status: 503, headers: noStore });
    return NextResponse.json({ used, limit: FREE_FLASHCARD_LIMIT, unlimited: false }, { headers: noStore });
  } catch (e) {
    console.error('[api/flashcards/reveal] status', e);
    return NextResponse.json({ error: 'flashcards_unavailable' }, { status: 503, headers: noStore });
  }
}
