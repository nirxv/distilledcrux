/**
 * Rasterizes each page of a PDF buffer to JPEG base64 strings.
 * Requires pdftoppm:  apt install poppler-utils
 *
 * Usage:
 *   const pages = await rasterizePdf(buffer);
 *   // pages = [{ base64: "...", mimeType: "image/jpeg" }, ...]
 */
import { execFile } from "child_process";
import { writeFile, readdir, readFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function rasterizePdf(
  pdfBuffer: Buffer,
  dpi = 150
): Promise<{ base64: string; mimeType: "image/jpeg" }[]> {
  const workDir = join(tmpdir(), `pdf-${Date.now()}`);
  await mkdir(workDir, { recursive: true });

  const pdfPath = join(workDir, "input.pdf");
  await writeFile(pdfPath, pdfBuffer);

  await execFileAsync("pdftoppm", [
    "-r", String(dpi),
    "-jpeg",
    pdfPath,
    join(workDir, "page"),
  ]);

  const files = (await readdir(workDir))
    .filter(f => f.startsWith("page") && f.endsWith(".jpg"))
    .sort();

  const pages = await Promise.all(
    files.map(async f => ({
      base64: (await readFile(join(workDir, f))).toString("base64"),
      mimeType: "image/jpeg" as const,
    }))
  );

  await rm(workDir, { recursive: true, force: true });
  return pages;
}
