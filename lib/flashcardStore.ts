/**
 * Flashcard reads, from Postgres rather than the JavaScript bundle.
 *
 * Ported from the history site. About 1,500 cards across five optionals is
 * roughly 1 MB of text, so the page never takes the deck whole:
 *
 *   - `listIndex` returns one small record per card in a deck, enough to count
 *     what is due and fill the filters.
 *   - `listCards` returns question text only for the cards being shown.
 *   - `listBacks` returns answers, and only for a reader the reveal route has
 *     already found entitled to them.
 *
 * Fronts are read with the anon key on purpose: row level security limits it
 * to published cards, so a query that forgets the filter still cannot serve a
 * draft. The answer columns are not granted to that key at all
 * (supabase/migrations/006_flashcards.sql), which is why listBacks alone uses
 * the service key.
 */
import { createClient } from '@supabase/supabase-js';
import type { FlashCardType, FlashcardSubject } from '@/lib/flashcardMeta';

export type FlashCardFront = {
  id: string;
  subject: FlashcardSubject;
  topic: string;
  topics: string[];
  type: FlashCardType;
  front: string;
  questions: number[];
  asked: number[];
};

/** Just enough to filter and to work out what is due. */
export type FlashCardIndexEntry = Pick<FlashCardFront, 'id' | 'topic' | 'topics' | 'type'>;

/** Just the answer, for a reader who has been granted it. */
export type FlashCardBack = { id: string; back: string };

/**
 * Everything except the answer. This is the column list behind the public,
 * edge-cached route, and a cached response is served to whoever asks next.
 */
const FRONT_COLUMNS = 'id,subject,topic,topics,type,front,questions,asked';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

function privilegedClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** PostgREST caps a select at 1000 rows and truncates silently, so read in pages. */
const PAGE = 1000;

export async function listIndex(subject: FlashcardSubject): Promise<FlashCardIndexEntry[]> {
  const all: FlashCardIndexEntry[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client()
      .from('flashcards')
      .select('id,topic,topics,type')
      .eq('status', 'published')
      .eq('subject', subject)
      .order('id')
      .range(offset, offset + PAGE - 1);
    // An empty deck and a failed query are not the same thing: a caller that
    // cannot tell them apart renders "0 cards" during an outage.
    if (error) throw new Error(`flashcard index: ${error.message}`);
    const page = (data ?? []) as FlashCardIndexEntry[];
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

export async function listCards(opts: {
  subject: FlashcardSubject;
  ids?: string[];
  limit?: number;
  offset?: number;
}): Promise<{ cards: FlashCardFront[]; total: number }> {
  const { subject, ids, limit = 60, offset = 0 } = opts;
  let q = client()
    .from('flashcards')
    .select(FRONT_COLUMNS, { count: 'exact' })
    .eq('status', 'published')
    .eq('subject', subject);
  if (ids?.length) q = q.in('id', ids);
  const { data, error, count } = await q.order('id').range(offset, offset + limit - 1);
  if (error) throw new Error(`flashcards: ${error.message}`);
  return { cards: (data ?? []) as FlashCardFront[], total: count ?? 0 };
}

/**
 * The answers for a set of cards in one deck. Only ever called for ids the
 * caller has established the reader may see, and never cached publicly. The
 * status and subject filters stay even though the service key bypasses RLS:
 * they stop a draft's answer, or another deck's, from being served here.
 */
export async function listBacks(subject: FlashcardSubject, ids: string[]): Promise<FlashCardBack[]> {
  if (!ids.length) return [];
  const { data, error } = await privilegedClient()
    .from('flashcards')
    .select('id,back')
    .eq('status', 'published')
    .eq('subject', subject)
    .in('id', ids);
  if (error) throw new Error(`flashcard backs: ${error.message}`);
  return (data ?? []) as FlashCardBack[];
}

/** Published cards that serve one notes topic, or null on failure rather than 0. */
export async function countForTopic(subject: FlashcardSubject, topic: string): Promise<number | null> {
  const { count, error } = await client()
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('subject', subject)
    .contains('topics', [topic]);
  if (error) {
    console.error('[flashcardStore] topic count failed:', error.message);
    return null;
  }
  return count ?? 0;
}
