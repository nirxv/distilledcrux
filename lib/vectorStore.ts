/**
 * Book-passage vector search, served from Qdrant instead of Postgres.
 *
 * book_chunks held roughly 39,000 passages with 1024-dimension embeddings and
 * a 326 MB IVFFlat index: about 600 MB on a free Supabase project whose limit
 * is 500 MB, on an instance with far less RAM than that. Worse, the all-books
 * search could not use the index at all -- match_book_chunks_diverse ranked
 * every chunk of the subject with a window function, so each chat message
 * read the whole subject's embeddings from disk. That is the pattern that
 * drains a small instance's disk IO budget and then takes down everything on
 * it, auth and subscription lookups included. Moving the corpus out leaves
 * Postgres serving only the small application tables it is sized for.
 *
 * Talking to the REST API directly rather than through @qdrant/js-client-rest
 * keeps this to zero new dependencies, which matters because the same code
 * runs inside Vercel functions.
 */

import type { SubjectKey } from '@/lib/subjectConfig';

const COLLECTION = process.env.QDRANT_COLLECTION ?? 'book_chunks';

export type BookChunk = {
  id: string | number;
  content: string;
  book_title: string;
  author: string;
  similarity: number;
};

type QdrantHit = {
  id: string | number;
  score?: number;
  payload?: Record<string, unknown>;
};

function endpoint(path: string): string {
  const base = process.env.QDRANT_URL;
  if (!base) throw new Error('QDRANT_URL is not set');
  return `${base.replace(/\/$/, '')}${path}`;
}

async function qdrant(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ result?: Record<string, unknown> }> {
  const key = process.env.QDRANT_API_KEY;
  if (!key) throw new Error('QDRANT_API_KEY is not set');

  const res = await fetch(endpoint(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    // The body carries Qdrant's actual complaint; without it a 400 here is
    // indistinguishable from a 500.
    throw new Error(`Qdrant ${path} returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Each point carries `content`, the passage exactly as it was embedded. Once a
 * passage has been cleaned of OCR debris it also carries `text`, which is
 * served in preference; the vector stays valid because cleaning changes no
 * meaning. Points that are not prose at all (index pages, bibliographies,
 * tables of contents) are marked `junk: true` and searches leave them out.
 * Until the cleaning pass runs no point has either field, and both the
 * fallback and the filter are no-ops.
 */
const PAYLOAD = ['text', 'content', 'book_title', 'author'];
const NOT_JUNK = [{ key: 'junk', match: { value: true } }];

function toChunk(hit: QdrantHit): BookChunk {
  const payload = hit.payload ?? {};
  return {
    id: hit.id,
    content: String(payload.text ?? payload.content ?? ''),
    book_title: String(payload.book_title ?? 'Unknown'),
    author: String(payload.author ?? 'Unknown'),
    // With Cosine distance Qdrant scores hits as cosine similarity, the same
    // 0-1 scale `1 - (embedding <=> query_embedding)` produced in SQL, so the
    // chat route's 0.45 floor carries across unchanged.
    similarity: typeof hit.score === 'number' ? hit.score : 0,
  };
}

/**
 * The best `perBook` passages from each of the subject's books, most similar
 * first. Replaces match_book_chunks_diverse, which returned the same set in
 * the same order.
 */
export async function searchDiverse(
  embedding: number[],
  subject: SubjectKey,
  opts: { perBook?: number; maxBooks?: number; signal?: AbortSignal } = {},
): Promise<BookChunk[]> {
  // 12 books covers every optional's full shelf with room to grow; the SQL
  // version had no cap because it ranked every book of the subject anyway.
  const { perBook = 3, maxBooks = 12, signal } = opts;

  const data = await qdrant(
    `/collections/${COLLECTION}/points/query/groups`,
    {
      query: embedding,
      group_by: 'book_title',
      group_size: perBook,
      // `limit` counts groups, not hits.
      limit: maxBooks,
      filter: {
        must: [{ key: 'subject', match: { value: subject } }],
        must_not: NOT_JUNK,
      },
      with_payload: PAYLOAD,
    },
    signal,
  );

  const groups = (data.result?.groups ?? []) as { hits?: QdrantHit[] }[];
  return groups
    .flatMap((group) => (group.hits ?? []).map(toChunk))
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * The best passages from one book. Replaces match_book_chunks.
 */
export async function searchBook(
  embedding: number[],
  bookTitle: string,
  opts: { limit?: number; signal?: AbortSignal } = {},
): Promise<BookChunk[]> {
  const { limit = 12, signal } = opts;

  const data = await qdrant(
    `/collections/${COLLECTION}/points/query`,
    {
      query: embedding,
      filter: {
        must: [{ key: 'book_title', match: { value: bookTitle } }],
        must_not: NOT_JUNK,
      },
      limit,
      with_payload: PAYLOAD,
    },
    signal,
  );

  const points = (data.result?.points ?? []) as QdrantHit[];
  return points.map(toChunk);
}
