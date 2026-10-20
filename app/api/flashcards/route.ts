import { NextRequest, NextResponse } from 'next/server';
import { listIndex, listCards } from '@/lib/flashcardStore';
import { isFlashcardSubject } from '@/lib/flashcardMeta';
import { cachePublic, noStore } from '@/lib/cacheHeaders';

/**
 * Flashcards, served instead of bundled.
 *
 *   GET /api/flashcards?subject=sociology&index=1
 *     One small record per published card in the deck: id, topic, topics and
 *     type. Enough to count what is due and build the filters.
 *
 *   GET /api/flashcards?subject=sociology&ids=a,b,c
 *     Card text WITHOUT the answer, for the cards being studied.
 *
 * The answer side is not here. It is metered, so it depends on who is asking,
 * and this route is cached publicly at the edge, where it is served to whoever
 * asks next. Answers come from POST /api/flashcards/reveal instead.
 */
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const subject = p.get('subject');
  if (!isFlashcardSubject(subject)) {
    return NextResponse.json({ error: 'unknown_subject' }, { status: 400, headers: noStore });
  }

  try {
    if (p.get('index') === '1') {
      const index = await listIndex(subject);
      // A minute, so a batch of new cards shows up promptly after it is loaded.
      return NextResponse.json({ cards: index, total: index.length }, { headers: cachePublic(60) });
    }

    const idsParam = p.get('ids');
    const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    // An unbounded limit is how one request ends up returning the whole deck.
    const limit = Math.min(Number(p.get('limit')) || 60, MAX_LIMIT);
    const offset = Math.max(Number(p.get('offset')) || 0, 0);

    const { cards, total } = await listCards({ subject, ids, limit, offset });
    return NextResponse.json({ cards, total, limit, offset }, { headers: cachePublic(60) });
  } catch (e) {
    console.error('[api/flashcards]', e);
    return NextResponse.json({ error: 'flashcards_unavailable' }, { status: 503, headers: noStore });
  }
}
