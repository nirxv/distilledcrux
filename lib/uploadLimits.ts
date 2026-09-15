/**
 * Upload limits, in one place so the four routes that take files agree.
 *
 * Each route capped per file and capped the file count, but nothing capped the
 * total, so the declared ceiling was maxFiles × maxFileBytes — 10 × 20MB, or
 * 200MB per request. Every file is then read whole with arrayBuffer() and
 * converted with toString('base64'), which is another 1.33× copy held at the
 * same time, so peak memory was roughly 2.3× the upload. A request anywhere
 * near the declared limit exhausts the function before the model is ever called.
 *
 * The numbers below are sized to what the client actually sends: PDFs are
 * rasterised in the browser to ~150dpi JPEGs capped at 10 pages, which land
 * well inside this budget. The per-file allowance still leaves room for a
 * full-resolution phone photo.
 */
export const UPLOAD_LIMITS = {
  maxFiles: 10,
  maxFileBytes: 8 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
} as const;

export const IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
] as const;

export const IMAGE_AND_PDF_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;

const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))}MB`;

export type UploadRejection = { error: string; status: number };

/**
 * Checks count, types and both size ceilings before anything is read into
 * memory. Returns null when the upload is acceptable.
 */
export function rejectUpload(
  files: File[],
  allowedTypes: readonly string[],
  limits = UPLOAD_LIMITS,
): UploadRejection | null {
  if (!files.length) {
    return { error: 'No files provided', status: 400 };
  }
  if (files.length > limits.maxFiles) {
    return { error: `Too many files (max ${limits.maxFiles})`, status: 400 };
  }

  let total = 0;
  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      return { error: `Unsupported file type: ${file.type || 'unknown'}`, status: 400 };
    }
    if (file.size > limits.maxFileBytes) {
      return { error: `"${file.name}" is too large (max ${mb(limits.maxFileBytes)} per file)`, status: 413 };
    }
    total += file.size;
  }

  // The check that was missing. Ten files each just under the per-file limit
  // passed every previous check and still added up to far more than the
  // function can hold.
  if (total > limits.maxTotalBytes) {
    return {
      error: `Upload is too large (${mb(total)} total, max ${mb(limits.maxTotalBytes)}). Try fewer or smaller pages.`,
      status: 413,
    };
  }

  return null;
}

/** Base64 data URLs for a vision model, after the budget has been checked. */
export async function toImageContents(
  files: File[],
): Promise<{ type: 'image_url'; image_url: { url: string } }[]> {
  return Promise.all(
    files.map(async (file) => {
      const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
      return {
        type: 'image_url' as const,
        image_url: { url: `data:${file.type || 'image/jpeg'};base64,${base64}` },
      };
    }),
  );
}

/**
 * The chat route takes its PDF as a base64 string in the JSON body rather than
 * as a file, and the client resends it with every message in the conversation,
 * so it needs its own ceiling. 20MB of PDF is about 27.3MB of base64; the
 * allowance below is that, rounded up.
 */
export const MAX_PDF_BASE64_CHARS = 28 * 1024 * 1024;

/** True when a client-supplied base64 PDF is larger than the route will accept. */
export function isPdfBase64TooLarge(value: unknown): boolean {
  return typeof value === 'string' && value.length > MAX_PDF_BASE64_CHARS;
}
