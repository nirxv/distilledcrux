/**
 * Identifies a file by its leading bytes rather than its declared type.
 *
 * `File.type` in a multipart upload is the Content-Type the caller wrote into
 * the request. It is their claim about the file, not a fact about it, and
 * nothing stops a client sending arbitrary bytes labelled application/pdf.
 *
 * That matters most where the bytes are kept and served back: /api/pyq-answers
 * stores uploads in public storage, so a spoofed type meant anything at all
 * could be hosted there behind a PDF label.
 */

export type SniffedType = 'pdf' | 'jpeg' | 'png' | 'webp' | 'gif' | null;

/** Byte signatures, longest first so a prefix never shadows a longer match. */
const SIGNATURES: { type: Exclude<SniffedType, null>; bytes: number[]; offset?: number }[] = [
  { type: 'png',  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP" after "RIFF" + size
  { type: 'gif',  bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: 'pdf',  bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },      // "%PDF-"
  { type: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
];

export function sniffFileType(input: ArrayBuffer | Uint8Array): SniffedType {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  for (const { type, bytes: sig, offset = 0 } of SIGNATURES) {
    if (bytes.length < offset + sig.length) continue;
    if (sig.every((b, i) => bytes[offset + i] === b)) return type;
  }
  return null;
}

/**
 * A PDF may carry a byte-order mark or stray whitespace before %PDF-; readers
 * accept that and so should we, but only a short run of it.
 */
export function isPdf(input: ArrayBuffer | Uint8Array): boolean {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (sniffFileType(bytes) === 'pdf') return true;
  const window = bytes.subarray(0, 1024);
  for (let i = 1; i <= window.length - 5; i++) {
    if (window[i] === 0x25 && window[i + 1] === 0x50 && window[i + 2] === 0x44 &&
        window[i + 3] === 0x46 && window[i + 4] === 0x2d) return true;
  }
  return false;
}
