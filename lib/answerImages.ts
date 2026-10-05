/**
 * Answer sheets as the marking routes want them: PDFs rendered to page
 * images, photos shrunk. Shared by the evaluate page and the test series,
 * which each carried their own copy (the test series' without the setting
 * that keeps pdf.js inside the site's CSP).
 */

export const isPdf = (f: File) => f.type === 'application/pdf';

/**
 * A page shrunk to 1600px wide JPEG before it is sent. A phone photo is
 * several megabytes and a request over the host's body limit never reached
 * the route; 1600px keeps handwriting legible to the reader model.
 */
export async function compressImage(file: File, maxWidth = 1600, quality = 0.82): Promise<File> {
  if (isPdf(file)) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file),
        'image/jpeg', quality,
      );
    };
    // A format the browser cannot draw (HEIC in most) goes as it is.
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/** Up to ten pages of a PDF as JPEG files, rendered in the browser. */
export async function convertPdfToImages(file: File): Promise<File[]> {
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.toString();
  const arrayBuffer = await file.arrayBuffer();
  // isEvalSupported is what makes pdf.js want 'unsafe-eval' in the CSP. It
  // only enables a font-rendering fast path, and these pages are rasterised
  // to JPEG for an OCR model, so turning it off costs nothing here.
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
  const imageFiles: File[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 }); // 2x = ~150dpi equivalent
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas } as Parameters<typeof page.render>[0]).promise;
    const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92));
    imageFiles.push(new File([blob], `page-${i}.jpg`, { type: 'image/jpeg' }));
  }
  return imageFiles;
}

/** Every file as page images, PDFs rendered and photos shrunk, in order. */
export async function toAnswerPages(files: File[]): Promise<File[]> {
  const pages: File[] = [];
  for (const f of files) {
    if (isPdf(f)) pages.push(...await convertPdfToImages(f));
    else if (f.type.startsWith('image/')) pages.push(f);
  }
  return Promise.all(pages.map(f => compressImage(f)));
}
