import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from '@/components/Link';
import SubjectIcon from '@/components/SubjectIcon';
import TopperBrowser, { type PyqRef } from '@/components/toppers/TopperBrowser';
import { TOPPER_BROWSER_CSS, TOPPER_PASS_CSS } from '@/components/toppers/styles';
import { PYQ_SUBJECT_NAME, loadPyqs } from '@/lib/pyqs';
import { TOPPER_SUBJECTS, isTopperSubject, listCopies } from '@/lib/toppers';

/**
 * One optional's topper answer copies. Browsing is open to everyone; opening a
 * copy needs an account, and after five, a subscription to the optional
 * (lib/toppers/access.ts).
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return TOPPER_SUBJECTS.map((optional) => ({ optional }));
}

export async function generateMetadata({ params }: { params: Promise<{ optional: string }> }): Promise<Metadata> {
  const { optional } = await params;
  if (!isTopperSubject(optional)) return {};
  const name = PYQ_SUBJECT_NAME[optional];
  const copies = await listCopies(optional);
  const toppers = new Set(copies.map((c) => c.topper)).size;
  return {
    title: `${name} Optional Topper Answer Copies`,
    description: `${copies.length} handwritten answers by ${toppers} UPSC ${name} rankers, question by question, linked to the past questions they answer. Compare two toppers side by side.`,
    alternates: { canonical: `https://distilledcrux.com/${optional}/topper-copies` },
  };
}

export default async function ToppersPage({ params }: { params: Promise<{ optional: string }> }) {
  const { optional } = await params;
  if (!isTopperSubject(optional)) notFound();
  const name = PYQ_SUBJECT_NAME[optional];
  const copies = await listCopies(optional);
  const { questions, topics } = await loadPyqs(optional);

  const wanted = new Set(copies.flatMap((c) => c.pyqs));
  const pyqs: Record<number, PyqRef> = {};
  for (const q of questions) if (wanted.has(q.id)) pyqs[q.id] = { id: q.id, year: q.year, paper: q.paper, question: q.question };
  const toppers = new Set(copies.map((c) => c.topper)).size;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS + TOPPER_BROWSER_CSS + TOPPER_PASS_CSS }} />
      <div className="tl ds" style={{ ['--t' as string]: `var(--tint-${optional})`, ['--w' as string]: `var(--wash-${optional})` }}>
        <section className="tl-hero">
          <div className="ds-container">
            <Link href={`/${optional}`} className="ds-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
              {name}
            </Link>
            <div className="tl-title">
              <span className="tl-icon" aria-hidden="true"><SubjectIcon id={optional} size={24} /></span>
              <h1 className="ds-h1">{name} topper copies</h1>
            </div>
            <p className="ds-lede tl-lede">
              {copies.length.toLocaleString('en-IN')} handwritten answers by {toppers} rankers, from their test series booklets.
              Each is one answer, filed under the question it answers and the UPSC questions it would answer too.
            </p>
          </div>
        </section>
        <section className="tl-body">
          <div className="ds-container">
            <TopperBrowser subject={optional} subjectName={name} copies={copies}
              topics={topics.map((t) => ({ name: t.name, paper: t.paper }))} pyqs={pyqs} />
          </div>
        </section>
      </div>
    </>
  );
}

const PAGE_CSS = `
.tl { background: var(--bg); min-height: var(--page-min-h); }
.tl-hero { padding: clamp(24px, 4vh, 44px) 0 clamp(16px, 2.5vh, 28px); background: linear-gradient(180deg, color-mix(in srgb, var(--w) 70%, var(--bg)) 0%, var(--bg) 100%); }
.tl-title { display: flex; align-items: center; gap: var(--space-3); margin: var(--space-4) 0 var(--space-2); }
.tl-title .ds-h1 { font-size: clamp(1.9rem, 4vw, 2.8rem); }
.tl-icon { width: 48px; height: 48px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; background: var(--ds-card); color: var(--t); border: 1px solid var(--border); box-shadow: var(--elev-1); }
.tl-lede { max-width: 720px; }
.tl-body { padding: var(--space-2) 0 clamp(48px, 9vh, 96px); }
`;
