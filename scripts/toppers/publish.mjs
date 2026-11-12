/**
 * Uploads topper copy PDFs to the private R2 bucket.
 *
 *   node scripts/toppers/publish.mjs sociology          upload what is missing, then check every key
 *   node scripts/toppers/publish.mjs sociology --check  only check
 *
 * Reads lib/toppers/<subject>.json (scripts/toppers/build-data.py) for each
 * copy's key and its PDF under ~/Desktop/topper-state-dc/<subject>/. Uses the
 * write key, R2_WRITE_ACCESS_KEY_ID and R2_WRITE_SECRET_ACCESS_KEY in
 * .env.local, which never goes to Vercel; the site only has the read key.
 *
 * Resumable: an object already there with the same size is skipped, so a run
 * cut short is finished by running it again. Ends by HEAD-checking every key,
 * so a copy the site lists but the bucket lacks is caught here and not by a
 * reader.
 */
import { AwsClient } from 'aws4fetch';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const subject = process.argv[2] ?? 'sociology';
const checkOnly = process.argv.includes('--check');
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=["']?([^"'\n]*)/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
for (const k of ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_WRITE_ACCESS_KEY_ID', 'R2_WRITE_SECRET_ACCESS_KEY']) {
  if (!env[k]) { console.error(`${k} is missing from .env.local`); process.exit(1); }
}
const client = new AwsClient({ accessKeyId: env.R2_WRITE_ACCESS_KEY_ID, secretAccessKey: env.R2_WRITE_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
const base = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`;
const urlFor = (key) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
const stateDir = path.join(os.homedir(), 'Desktop', 'topper-state-dc', subject);
const { copies } = JSON.parse(fs.readFileSync(`lib/toppers/${subject}.json`, 'utf8'));

async function head(key) {
  const r = await client.fetch(urlFor(key), { method: 'HEAD' });
  return r.ok ? Number(r.headers.get('content-length')) : null;
}

async function put(c) {
  const file = path.join(stateDir, c.file);
  const body = fs.readFileSync(file);
  if ((await head(c.key)) === body.length) return 'skipped';
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await client.fetch(urlFor(c.key), { method: 'PUT', body, headers: { 'Content-Type': 'application/pdf' } });
    if (r.ok) return 'uploaded';
    if (attempt === 4) throw new Error(`${c.key}: ${r.status} ${await r.text()}`);
    await new Promise((res) => setTimeout(res, 1000 * attempt));
  }
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

if (!checkOnly) {
  let done = 0;
  const results = await pool(copies, 6, async (c) => {
    const r = await put(c);
    if (++done % 50 === 0) console.log(`  ${done}/${copies.length}`);
    return r;
  });
  console.log(`uploaded ${results.filter((r) => r === 'uploaded').length}, already there ${results.filter((r) => r === 'skipped').length}`);
}

const sizes = await pool(copies, 8, (c) => head(c.key));
const missing = copies.filter((_, i) => sizes[i] === null);
const wrong = copies.filter((c, i) => sizes[i] !== null && sizes[i] !== fs.statSync(path.join(stateDir, c.file)).size);
console.log(`checked ${copies.length}: ${missing.length} missing, ${wrong.length} with the wrong size`);
for (const c of [...missing, ...wrong].slice(0, 20)) console.log(`  ${c.key}`);
process.exit(missing.length || wrong.length ? 1 : 0);
