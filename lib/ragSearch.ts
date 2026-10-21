import { searchDiverse } from '@/lib/vectorStore';
import type { SubjectKey } from '@/lib/subjectConfig';

/**
 * Book passages for the evaluation flow, ported from history-optional.
 *
 * Evaluation never saw a book here. The route posted to /api/rag-search behind
 * a per-subject rag switch that every subject left null, and that route had
 * become a copy of the OCR route, so it could not have answered anyway. This
 * searches the same Qdrant shelf as the chat, in process, kept to the answer's
 * own optional so a Sociology answer is never checked against PSIR books.
 */

const SIMILARITY_FLOOR = 0.45;
const MAX_CHUNKS = 6;
const EMBED_TIMEOUT_MS = 8000;

async function voyageEmbed(text: string, signal: AbortSignal): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: 'voyage-4-lite', input: [text], input_type: 'query' }),
    signal,
  });
  const data = await res.json();
  if (!data.data?.[0]?.embedding) {
    throw new Error('Voyage embed failed: ' + JSON.stringify(data).slice(0, 300));
  }
  return data.data[0].embedding;
}

/**
 * Source-labelled passages for `query` from one optional's books, or '' when
 * nothing is relevant. Never throws: an evaluation without book context is
 * worth more to the student than a failed request.
 */
export async function getBookContext(query: string, subject: SubjectKey): Promise<string> {
  if (!query || query.trim().length < 4) return '';

  // One deadline for the embedding and the search, so a hung upstream cannot
  // eat the evaluation's time budget.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

  try {
    const embedding = await voyageEmbed(query, controller.signal);
    const chunks = await searchDiverse(embedding, subject, { perBook: 3, signal: controller.signal });
    if (chunks.length === 0) return '';

    // Below the floor the books simply do not cover this topic. Keep the
    // unfiltered set when filtering leaves too little to be useful.
    const filtered = chunks.filter((c) => c.similarity > SIMILARITY_FLOOR);
    const finalChunks = (filtered.length >= 3 ? filtered : chunks).slice(0, MAX_CHUNKS);

    return finalChunks
      .map((c, i) => `[Source ${i + 1} — ${c.book_title} | Author: ${c.author}]\n${c.content}`)
      .join('\n\n---\n\n');
  } catch (err) {
    console.error('[ragSearch] retrieval failed (non-fatal):', err);
    return '';
  } finally {
    clearTimeout(timer);
  }
}
