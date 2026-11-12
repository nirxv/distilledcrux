import { AwsClient } from 'aws4fetch';

/**
 * Five-minute signed URLs for topper copy PDFs.
 *
 * The PDFs sit in a private R2 bucket. Nothing about it is public: no
 * development URL, no custom domain. A copy can only be read through a URL
 * signed here, and the open route signs one only after it has decided the
 * reader may have the copy (lib/toppers/access.ts). A signed URL carries its
 * own expiry, so one copied out of the browser stops working within minutes.
 *
 * Ported from the history site with one change: there, missing credentials
 * fell back to the bucket's public URL so a deploy ahead of configuration kept
 * the feature up. Here there is no public URL to fall back to, and the module
 * fails closed: no credentials, no PDF, and the route says the copies are
 * unavailable rather than serving them unsigned.
 *
 * Only the read key is configured on Vercel. Uploads use a separate write key
 * that stays on the machine that runs scripts/toppers/publish.mjs.
 */

const TTL_SECONDS = 300;

function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function r2Configured(): boolean {
  return config() !== null;
}

/**
 * Local copies for testing a build on this machine before the bucket exists:
 * the pipeline's own folder of cut PDFs, served by /api/toppers/dev-file. Never
 * on Vercel, whatever the environment says, so a stray variable cannot turn a
 * deployment into an open file server.
 */
export function devFilesDir(): string | null {
  if (process.env.VERCEL) return null;
  return process.env.TOPPER_DEV_DIR || null;
}

/** A URL for `key` that expires in five minutes, or null when storage is not configured. */
export async function signedPdfUrl(key: string): Promise<string | null> {
  const cfg = config();
  if (!cfg) {
    if (devFilesDir()) return `/api/toppers/dev-file?key=${encodeURIComponent(key)}`;
    console.error('[toppers/r2] credentials not set; refusing to serve copies');
    return null;
  }
  // Each path segment is encoded on its own: slashes in a key separate real path segments.
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  try {
    const client = new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      service: 's3',
      region: 'auto',
    });
    const url = new URL(`https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${encodedKey}`);
    url.searchParams.set('X-Amz-Expires', String(TTL_SECONDS));
    const signed = await client.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
    return signed.url;
  } catch (err) {
    console.error('[toppers/r2] signing failed:', err);
    return null;
  }
}
