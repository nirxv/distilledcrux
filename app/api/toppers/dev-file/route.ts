import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { noStore } from '@/lib/cacheHeaders';
import { devFilesDir } from '@/lib/toppers/r2';
import sociology from '@/lib/toppers/sociology.json';
import anthropology from '@/lib/toppers/anthropology.json';

/**
 * Serves a topper copy PDF from this machine, for testing a local build
 * before the R2 bucket exists. Answers 404 unless TOPPER_DEV_DIR is set and
 * the code is not running on Vercel (lib/toppers/r2.ts), so in production it
 * does not exist. Only keys in the copy list are served, and only from inside
 * that folder.
 */
// Keys are "<subject>/<id>.pdf"; each file sits under <TOPPER_DEV_DIR>/<subject>.
const FILES = new Map(
  [sociology, anthropology].flatMap((list) => (list.copies as { key: string; file: string }[]).map((c) => [c.key, c.file] as const)),
);

export async function GET(req: NextRequest) {
  const dir = devFilesDir();
  const key = req.nextUrl.searchParams.get('key') ?? '';
  const file = FILES.get(key);
  if (!dir || !file) return new NextResponse('Not found', { status: 404, headers: noStore });
  const root = path.resolve(dir, key.split('/')[0]);
  const full = path.resolve(root, file);
  if (!full.startsWith(root + path.sep)) return new NextResponse('Not found', { status: 404, headers: noStore });
  try {
    return new NextResponse(new Uint8Array(await readFile(full)), {
      headers: { 'Content-Type': 'application/pdf', ...noStore },
    });
  } catch {
    return new NextResponse('Not found', { status: 404, headers: noStore });
  }
}
