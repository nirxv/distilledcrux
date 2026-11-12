'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import TopperPassOffer from './TopperPassOffer';

/**
 * One topper copy's handwritten pages, with zoom. The viewer page shows one;
 * Compare shows two side by side.
 *
 * Opening asks /api/toppers/open, which decides whether this reader may have
 * the copy and, if so, returns a five-minute signed URL to the PDF. The pages
 * are drawn with the site's own pdf.js (as on /evaluate), not a CDN copy, and
 * with eval off, which the site's CSP requires.
 *
 * Give it a `key` of the copy id: a new copy is a new instance.
 */

type Opened = { url: string; used: number; unlimited: boolean };
type Outcome =
  | { kind: 'ok'; opened: Opened }
  | { kind: 'login' }
  | { kind: 'limit'; used: number; limit: number }
  | { kind: 'error' };

// One request per copy per reader, even when React runs an effect twice in
// development: for a free reader, the first open of a copy spends one of their
// five, and while a second open of it would be free, it is still a wasted
// signature and a second PDF download.
const inflight = new Map<string, Promise<Outcome>>();

function openCopy(subject: string, id: string, uid: string): Promise<Outcome> {
  const k = `${uid}:${subject}:${id}`;
  let p = inflight.get(k);
  if (!p) {
    p = (async (): Promise<Outcome> => {
      try {
        const token = (await auth.currentUser?.getIdToken()) ?? '';
        const r = await fetch('/api/toppers/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-token': token },
          body: JSON.stringify({ subject, id }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.url) return { kind: 'ok', opened: { url: d.url, used: d.used ?? 0, unlimited: d.unlimited === true } };
        if (r.status === 401) return { kind: 'login' };
        if (r.status === 403 && d.error === 'limit_reached') return { kind: 'limit', used: d.used ?? 0, limit: d.limit ?? 5 };
        return { kind: 'error' };
      } catch {
        return { kind: 'error' };
      }
    })();
    // A signed URL lasts five minutes; let a later visit ask again.
    p.finally(() => setTimeout(() => inflight.delete(k), 60_000));
    inflight.set(k, p);
  }
  return p;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfDoc = any;

let pdfjsReady: Promise<any> | null = null;
function loadPdfjs() {
  pdfjsReady ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return lib;
  });
  return pdfjsReady;
}

/** Draws every page into `el`, one canvas each, sharp on high-density screens. */
async function drawPages(el: HTMLDivElement, pdf: PdfDoc, zoom: number, isCancelled: () => boolean) {
  // The page box, not the pages div: that one is hidden until the first draw.
  const width = Math.max(240, (el.parentElement?.clientWidth ?? 600) - 22);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const frag = document.createDocumentFragment();
  const jobs: Array<() => Promise<void>> = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const cssScale = (width / base.width) * zoom;
    const viewport = page.getViewport({ scale: cssScale * dpr });
    const canvas = document.createElement('canvas');
    canvas.className = 'tp-page';
    canvas.dataset.page = String(n);
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(base.width * cssScale)}px`;
    canvas.setAttribute('aria-label', `Page ${n} of ${pdf.numPages}`);
    canvas.setAttribute('role', 'img');
    frag.appendChild(canvas);
    jobs.push(async () => { await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise; });
  }
  if (isCancelled()) return;
  el.replaceChildren(frag);
  for (const job of jobs) {
    if (isCancelled()) return;
    await job();
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type Props = {
  subject: string;
  copyId: string;
  /** Height of the scrolling page box, e.g. '78vh'. */
  height: string;
  /** The server granted this copy: `used` is the free allowance spent after it. */
  onOpened?: (id: string, used: number, unlimited: boolean) => void;
  /** Where "Sign in" returns to. */
  next?: string;
  /**
   * Whether to open now. 'wait' while the allowance is still loading;
   * 'confirm' for a free reader who has not opened this copy, who is asked
   * before one of their free opens is spent; 'go' otherwise (a subscriber, a
   * copy already opened, or someone who will be told to sign in).
   */
  gate: 'wait' | 'confirm' | 'go';
  /** Free opens left, for the confirm line. */
  freeLeft?: number;
};

export default function TopperPdf({ subject, copyId, height, onOpened, next, gate, freeLeft }: Props) {
  const [state, setState] = useState<'auth' | 'opening' | 'drawing' | 'ready' | 'login' | 'limit' | 'error' | 'pdf-error'>('auth');
  const [confirmed, setConfirmed] = useState(false);
  const go = gate === 'go' || confirmed;
  const [limit, setLimit] = useState(5);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const boxRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PdfDoc>(null);
  const onOpenedRef = useRef(onOpened);
  useEffect(() => { onOpenedRef.current = onOpened; });

  useEffect(() => {
    if (!go) return;
    let cancelled = false;
    const unsub = auth.onAuthStateChanged(async (user) => {
      unsub();
      if (cancelled) return;
      if (!user) { setState('login'); return; }
      setState('opening');
      const out = await openCopy(subject, copyId, user.uid);
      if (cancelled) return;
      if (out.kind === 'login') { setState('login'); return; }
      if (out.kind === 'limit') { setLimit(out.limit); setState('limit'); return; }
      if (out.kind === 'error') { setState('error'); return; }
      onOpenedRef.current?.(copyId, out.opened.used, out.opened.unlimited);
      setState('drawing');
      try {
        const pdfjs = await loadPdfjs();
        // One plain GET for the whole file: copies are a few pages, and no Range
        // request means the bucket's CORS rule needs nothing beyond the origin.
        const pdf = await pdfjs.getDocument({ url: out.opened.url, isEvalSupported: false, disableRange: true, disableStream: true }).promise;
        if (cancelled || !boxRef.current) return;
        pdfRef.current = pdf;
        setPages(pdf.numPages);
        await drawPages(boxRef.current, pdf, 1, () => cancelled);
        if (!cancelled) setState('ready');
      } catch (err) {
        console.error('[TopperPdf] PDF failed:', err);
        if (!cancelled) setState('pdf-error');
      }
    });
    return () => { cancelled = true; unsub(); };
  }, [subject, copyId, go]);

  const rezoom = async (to: number) => {
    const el = boxRef.current;
    if (!el || !pdfRef.current || state !== 'ready') return;
    const ratio = el.scrollTop / Math.max(1, el.scrollHeight);
    setZoom(to);
    setState('drawing');
    await drawPages(el, pdfRef.current, to, () => false);
    el.scrollTop = ratio * el.scrollHeight;
    setState('ready');
  };

  const loginHref = `/login?next=${encodeURIComponent(next ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'))}`;
  const showBox = state === 'drawing' || state === 'ready';
  // Asking first is not a state of the open: nothing has happened yet.
  const view = gate === 'confirm' && !confirmed ? 'confirm' : state;

  return (
    <div className="tp">
      <div className="tp-bar">
        <span className="tp-count">{pages ? `${pages} ${pages === 1 ? 'page' : 'pages'}` : ' '}</span>
        <div className="tp-zoom" aria-label="Zoom">
          <button type="button" onClick={() => rezoom(Math.max(0.6, +(zoom - 0.2).toFixed(1)))} disabled={state !== 'ready' || zoom <= 0.6} aria-label="Zoom out">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => rezoom(Math.min(2.4, +(zoom + 0.2).toFixed(1)))} disabled={state !== 'ready' || zoom >= 2.4} aria-label="Zoom in">+</button>
        </div>
      </div>
      {/* Fixed height only once there are pages to scroll; a message alone gets a box its own size. */}
      <div className={`tp-box${showBox ? '' : ' msg'}`} style={showBox ? { height } : undefined}>
        <div ref={boxRef} className="tp-pages" hidden={!showBox} />
        {(view === 'auth' || view === 'opening' || view === 'drawing') && (
          <div className="tp-msg" aria-live="polite"><span className="tp-spin" aria-hidden="true" />{view === 'drawing' ? 'Drawing the pages' : 'Opening the copy'}</div>
        )}
        {view === 'confirm' && (
          <div className="tp-msg">
            <strong>Open this copy?</strong>
            <span>It uses one of your free copies{typeof freeLeft === 'number' ? `, ${freeLeft} left` : ''}. Once opened, it stays free to open again.</span>
            <button type="button" className="ds-btn ds-btn-solid ds-btn-sm" onClick={() => setConfirmed(true)}>Open this copy</button>
          </div>
        )}
        {view === 'login' && (
          <div className="tp-msg">
            <strong>Sign in to open topper copies</strong>
            <span>Your first five are free.</span>
            <Link href={loginHref} className="ds-btn ds-btn-solid ds-btn-sm">Sign in</Link>
          </div>
        )}
        {view === 'limit' && (
          <div className="tp-msg">
            <strong>You have opened your {limit} free copies</strong>
            <span>They stay open to you. To open the rest:</span>
            <TopperPassOffer subject={subject} />
          </div>
        )}
        {(view === 'error' || view === 'pdf-error') && (
          <div className="tp-msg">
            <strong>This copy would not open just now</strong>
            <span>Please try again in a minute. Nothing was used up.</span>
            <button type="button" className="ds-btn ds-btn-line ds-btn-sm" onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
