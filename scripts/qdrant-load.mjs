/**
 * Create the Qdrant collection and load the exported chunks into it.
 *
 *   node scripts/qdrant-load.mjs [infile]
 *
 * Needs QDRANT_URL and QDRANT_API_KEY in .env.local. Upserts are keyed on the
 * original Postgres id, so re-running after an interruption is safe and
 * simply overwrites the points it already wrote.
 *
 * The JSONL is streamed rather than read whole: a hundred thousand chunks
 * with their 1024-dimension embeddings is comfortably larger than memory.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const INFILE = process.argv[2] ?? path.join(ROOT, '../dc-migrate/book_chunks.jsonl');
const BATCH = Number(process.env.BATCH ?? 128);

function loadEnv() {
  const text = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const URL_BASE = (env.QDRANT_URL ?? process.env.QDRANT_URL ?? '').replace(/\/$/, '');
const API_KEY = env.QDRANT_API_KEY ?? process.env.QDRANT_API_KEY;
const COLLECTION = env.QDRANT_COLLECTION ?? process.env.QDRANT_COLLECTION ?? 'book_chunks';

if (!URL_BASE || !API_KEY) {
  console.error('Set QDRANT_URL and QDRANT_API_KEY in .env.local first.');
  process.exit(1);
}

async function qdrant(method, path, body) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'api-key': API_KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Qdrant ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// Peek at the first record so the collection is created with the dimension
// the data actually has, rather than one hardcoded here that could drift.
async function firstRecord() {
  const rl = createInterface({ input: createReadStream(INFILE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    rl.close();
    return JSON.parse(line);
  }
  throw new Error(`${INFILE} is empty -- run scripts/export-chunks.sh first.`);
}

function toVector(record) {
  // Postgres rendered the vector as '[0.1,0.2,...]', which is already valid
  // JSON, so this needs no bespoke parser.
  return typeof record.embedding === 'string' ? JSON.parse(record.embedding) : record.embedding;
}

async function ensureCollection(dim) {
  const existing = await fetch(`${URL_BASE}/collections/${COLLECTION}`, {
    headers: { 'api-key': API_KEY },
  });

  if (existing.ok) {
    console.log(`collection "${COLLECTION}" already exists, upserting into it`);
  } else {
    // Cosine, to match what pgvector's <=> operator was doing. Keeping the
    // same metric means the callers' 0.45 similarity floor still means the
    // same thing.
    //
    // Payloads go to disk: they are only read for the dozen hits a query
    // returns, and on a 1 GB free cluster the RAM is better spent on vectors.
    //
    // The indexing threshold is lowered from Qdrant Cloud's 10 MB default.
    // Below it a segment is searched by brute force rather than HNSW, and a
    // corpus this size can leave a whole segment just under the line.
    await qdrant('PUT', `/collections/${COLLECTION}`, {
      vectors: { size: dim, distance: 'Cosine' },
      on_disk_payload: true,
      optimizers_config: { indexing_threshold: 1000 },
    });
    console.log(`created collection "${COLLECTION}" (${dim} dimensions, cosine)`);
  }

  // group_by and the single-book filter read book_title, every all-books
  // search is scoped to one optional by subject, and every search leaves out
  // points marked junk. Qdrant Cloud refuses to filter on a field that has no
  // index, so all three need one before the first query, even while no point
  // carries `junk` yet.
  const indexes = { book_title: 'keyword', subject: 'keyword', junk: 'bool' };
  for (const [field, schema] of Object.entries(indexes)) {
    await qdrant('PUT', `/collections/${COLLECTION}/index?wait=true`, {
      field_name: field,
      field_schema: schema,
    }).catch((e) => console.warn(`payload index on ${field}: ${e.message}`));
  }
}

async function main() {
  const sample = await firstRecord();
  const dim = toVector(sample).length;
  await ensureCollection(dim);

  const rl = createInterface({ input: createReadStream(INFILE), crlfDelay: Infinity });
  let batch = [];
  let sent = 0;

  const flush = async () => {
    if (!batch.length) return;
    await qdrant('PUT', `/collections/${COLLECTION}/points?wait=true`, { points: batch });
    sent += batch.length;
    batch = [];
    process.stdout.write(`\ruploaded ${sent} points`);
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    const vector = toVector(record);
    if (vector.length !== dim) {
      throw new Error(`id ${record.id} has ${vector.length} dimensions, expected ${dim}`);
    }
    batch.push({
      id: Number(record.id),
      vector,
      payload: {
        content: record.content ?? '',
        book_title: record.book_title ?? 'Unknown',
        author: record.author ?? 'Unknown',
        subject: record.subject ?? '',
      },
    });
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  const info = await qdrant('POST', `/collections/${COLLECTION}/points/count`, { exact: true });
  console.log(`\ndone: ${sent} uploaded, collection now holds ${info.result?.count ?? '?'} points`);
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
