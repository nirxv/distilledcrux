/**
 * BM25 query vectors for the keyword half of the hybrid search.
 *
 * The documents' side was built by scripts/rag/sparse.py when book_chunks_v2
 * was loaded. Qdrant applies the inverse document frequency itself (the sparse
 * vector uses its `idf` modifier), so a query is just 1 per distinct term. The
 * tokenizer and the hash here must stay identical to sparse.py, or query terms
 * will not land on the documents' indices.
 */

const STOP = new Set(`a an the of and or in on at to for from by with as is was were be been are it its this that these those
which who whom whose what when where why how not no but if then than so such into over under after before during
about against between through their there they them he she his her we you our your i also had has have do did`.split(/\s+/));

export function tokens(text: string): string[] {
  const ascii = (text || '').normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toLowerCase();
  return (ascii.match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w));
}

/** 32-bit FNV-1a over the word's UTF-8 bytes; the words are ASCII by now. */
export function fnv1a(word: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function queryVector(text: string): { indices: number[]; values: number[] } {
  const indices = [...new Set(tokens(text).map(fnv1a))].sort((a, b) => a - b);
  return { indices, values: indices.map(() => 1) };
}
