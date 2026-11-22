import { qdrant } from '@/lib/vectorStore';
import type { SubjectKey } from '@/lib/subjectConfig';
import { planQuery, type QueryPlan } from './plan';
import { factsFor, type Fact } from './register';
import { queryVector } from './sparse';

/**
 * Book-passage retrieval for the chat and answer evaluation.
 *
 * What it replaced embedded the question as written, took each book's best
 * three passages, kept those over a cosine floor of 0.45 and, when fewer than
 * three cleared it, used all of them anyway. Exam directives ("critically
 * examine") pulled in passages about examinations, a passage that mentioned a
 * thinker in passing could beat one that explained the concept, and a weak
 * match was shown to the model as evidence.
 *
 * Here, each passage of book_chunks_v2 carries its optional, the syllabus
 * units it teaches, the register's thinkers, works and concepts it discusses
 * and a one-line note naming them (scripts/rag/build_collection.py). A
 * question is planned first (plan.ts), then:
 *
 *   1. one hybrid search in Qdrant, the dense vector and a BM25 keyword
 *      vector fused by rank, kept to the optional and a minimum OCR quality,
 *      and first to passages tagged with the plan's units or register rows
 *      (passages not yet tagged stay in);
 *   2. Voyage's reranker scores the top candidates against the question,
 *      reading each passage with its heading and note;
 *   3. passages under the relevance cut-off are dropped. Fewer than two left:
 *      one retry without the plan's preference. Never pads out with passages
 *      that failed the cut-off.
 */

export const COLLECTION = process.env.RAG_COLLECTION ?? 'book_chunks_v2';
const PAYLOAD = ['text', 'book_title', 'author', 'header', 'context', 'subject', 'units', 'refs', 'tagged'];
const PER_SEARCH = 40;
const CANDIDATES = 30;
const MIN_OCR = 0.6;
/** Voyage rerank-2.5 relevance below which a passage is not evidence. Calibrated in scripts/rag/rag_eval.ts. */
const RERANK_MIN = 0.35;
/** Added to the rerank score of a passage tagged with a row the question names. */
const REF_BOOST = 0.05;
const MIN_RESULTS = 2;

export type RagHit = {
  id: number | string;
  text: string;
  book_title: string;
  author: string;
  /** "Ritzer — Sociological Theory | Sociology | Max Weber" */
  header: string;
  /** One sentence naming the thinker, concept or case the passage is about. */
  context: string;
  subject: SubjectKey;
  units: string[];
  refs: string[];
  /** False until the passage's batch is tagged: it then has no units, rows or note. */
  tagged: boolean;
  score: number;
};

export type Retrieval = {
  plan: QueryPlan;
  hits: RagHit[];
  /** Register rows for the plan, for the answering model and the fact check. */
  facts: Fact[];
  /** 'strict' | 'relaxed' | 'failed' */
  stage: string;
  ms: number;
};

async function voyage<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`https://api.voyageai.com/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Voyage ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

async function embedQueries(texts: string[], signal?: AbortSignal): Promise<number[][]> {
  const d = await voyage<{ data: { index: number; embedding: number[] }[] }>(
    'embeddings', { model: 'voyage-4-lite', input: texts, input_type: 'query' }, signal);
  return d.data.sort((a, b) => a.index - b.index).map((x) => x.embedding);
}

type Filter = Record<string, unknown>;

function buildFilter(plan: QueryPlan, subject: SubjectKey, mode: 'strict' | 'relaxed', bookTitle?: string | null): Filter {
  const must: Filter[] = [{ key: 'ocr_quality', range: { gte: MIN_OCR } }];
  // A chosen book already fixes the optional.
  must.push(bookTitle ? { key: 'book_title', match: { value: bookTitle } } : { key: 'subject', match: { value: subject } });
  const refs = plan.facts.map((f) => f.id);
  if (mode === 'strict' && (plan.units.length || refs.length)) {
    // Only passages known to be about something else are left out: those not
    // yet tagged, and those tagged with no unit (outside the syllabus units,
    // much of Giddens), stay in.
    const should: Filter[] = [{ key: 'tagged', match: { value: false } }, { is_empty: { key: 'units' } }];
    if (plan.units.length) should.push({ key: 'units', match: { any: plan.units } });
    if (refs.length) should.push({ key: 'refs', match: { any: refs } });
    must.push({ should });
  }
  return { must };
}

type Point = { id: number | string; payload: Record<string, unknown> };

async function hybridSearch(dense: number[], keywords: string, filter: Filter, signal?: AbortSignal): Promise<Point[]> {
  const sparse = queryVector(keywords);
  const prefetch: Filter[] = [{ query: dense, using: 'dense', filter, limit: PER_SEARCH }];
  if (sparse.indices.length) prefetch.push({ query: sparse, using: 'bm25', filter, limit: PER_SEARCH });
  const data = await qdrant(`/collections/${COLLECTION}/points/query`, {
    prefetch, query: { fusion: 'rrf' }, limit: CANDIDATES, with_payload: PAYLOAD,
  }, signal);
  return ((data.result as { points?: Point[] } | undefined)?.points) ?? [];
}

function toHit(p: Point, score: number): RagHit {
  const pl = p.payload;
  return {
    id: p.id,
    text: String(pl.text ?? ''),
    book_title: String(pl.book_title ?? 'Unknown'),
    author: String(pl.author ?? 'Unknown'),
    header: String(pl.header ?? pl.book_title ?? ''),
    context: String(pl.context ?? ''),
    subject: pl.subject as SubjectKey,
    units: (pl.units as string[]) ?? [],
    refs: (pl.refs as string[]) ?? [],
    tagged: pl.tagged !== false,
    score,
  };
}

async function rankCandidates(question: string, plan: QueryPlan, pool: Point[], topK: number, signal?: AbortSignal): Promise<RagHit[]> {
  if (!pool.length) return [];
  const named = new Set(plan.facts.map((f) => f.id));
  const boost = (p: Point) => ((p.payload.refs as string[] | undefined) ?? []).some((r) => named.has(r)) ? REF_BOOST : 0;
  try {
    const docs = pool.map((p) => `${p.payload.header ?? ''}\n${p.payload.context ?? ''}\n${p.payload.text ?? ''}`.slice(0, 2500));
    const r = await voyage<{ data: { index: number; relevance_score: number }[] }>(
      'rerank', { model: 'rerank-2.5', query: question, documents: docs }, signal);
    return r.data
      .map((x) => toHit(pool[x.index], x.relevance_score + boost(pool[x.index])))
      .filter((h) => h.score >= RERANK_MIN)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch (e) {
    // Without the reranker there is no relevance score to cut on; the filters
    // already did the main work, so keep the fused order.
    console.error('[rag] rerank failed, using fused order:', (e as Error).message);
    return pool.slice(0, topK).map((p, i) => toHit(p, 1 - i / pool.length + boost(p)));
  }
}

/** No more than `perBook` passages from one book, unless the others leave room. */
function spreadBooks(hits: RagHit[], topK: number, perBook: number): RagHit[] {
  const out: RagHit[] = [], spill: RagHit[] = [], count = new Map<string, number>();
  for (const h of hits) {
    const n = count.get(h.book_title) ?? 0;
    if (n < perBook) { out.push(h); count.set(h.book_title, n + 1); } else spill.push(h);
  }
  return [...out, ...spill].slice(0, topK).sort((a, b) => b.score - a.score);
}

/**
 * Passages for `question` from one optional's books (or one chosen book),
 * best first, each at least RERANK_MIN relevant. May be empty: no passage is
 * better than a wrong one.
 */
export async function retrieve(
  question: string,
  opts: { subject: SubjectKey; bookTitle?: string | null; topK?: number; signal?: AbortSignal },
): Promise<Retrieval> {
  const t0 = Date.now();
  const { subject, bookTitle = null, topK = 6, signal } = opts;
  const [qVec] = await embedQueries([question], signal);
  const plan = planQuery(question, qVec, subject);
  const facts = factsFor(plan.facts, plan.units, subject);
  // The cleaned question needs its own vector only when cleaning changed it.
  const dense = plan.cleaned !== question ? (await embedQueries([plan.cleaned], signal))[0] : qVec;

  const modes: ('strict' | 'relaxed')[] = plan.units.length || plan.facts.length ? ['strict', 'relaxed'] : ['relaxed'];
  let hits: RagHit[] = [];
  let stage = 'failed';
  for (const mode of modes) {
    const pool = await hybridSearch(dense, plan.keywords, buildFilter(plan, subject, mode, bookTitle), signal);
    // More than topK are ranked so that the book spread has something to choose from.
    const ranked = await rankCandidates(question, plan, pool, topK * 2, signal);
    hits = bookTitle ? ranked.slice(0, topK) : spreadBooks(ranked, topK, 2);
    stage = mode;
    if (hits.length >= MIN_RESULTS) break;
  }
  return { plan, hits, facts, stage, ms: Date.now() - t0 };
}
