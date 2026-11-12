import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import TopperCopyView from '@/components/toppers/TopperCopyView';
import { TOPPER_PDF_CSS, TOPPER_VIEW_CSS } from '@/components/toppers/styles';
import { PYQ_SUBJECT_NAME, loadPyqs } from '@/lib/pyqs';
import { comparableCopies, getCopy, isTopperSubject, rankLine } from '@/lib/toppers';

/**
 * One topper copy. The page is built the first time it is opened, as the PYQ
 * pages are; the handwritten pages come from /api/toppers/open in the browser,
 * after the access check, so nothing here is behind the paywall.
 */

type Params = { optional: string; id: string };

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { optional, id } = await params;
  if (!isTopperSubject(optional)) return {};
  const copy = await getCopy(optional, id);
  if (!copy) return {};
  const name = PYQ_SUBJECT_NAME[optional];
  const short = copy.question.length > 70 ? `${copy.question.slice(0, 67).trimEnd()}…` : copy.question;
  return {
    title: `${short} | ${copy.topper} topper copy, ${name}`,
    description: `${copy.topper}${rankLine(copy) ? ` (${rankLine(copy)})` : ''} answers “${copy.question.slice(0, 120)}” in UPSC ${name} optional, ${copy.paper}, ${copy.marks} marks. Handwritten answer copy.`,
    alternates: { canonical: `https://distilledcrux.com/${optional}/toppers/${copy.id}` },
  };
}

export default async function TopperCopyPage({ params }: { params: Promise<Params> }) {
  const { optional, id } = await params;
  if (!isTopperSubject(optional)) notFound();
  const copy = await getCopy(optional, id);
  if (!copy) notFound();
  const name = PYQ_SUBJECT_NAME[optional];
  const others = await comparableCopies(optional, copy);
  const { questions } = await loadPyqs(optional);
  const pyqs = copy.pyqs
    .map((pid) => questions.find((q) => q.id === pid))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .sort((a, b) => b.year.localeCompare(a.year))
    .map((q) => ({ id: q.id, year: q.year, paper: q.paper, question: q.question }));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS + TOPPER_VIEW_CSS + TOPPER_PDF_CSS }} />
      <div className="tvp ds" style={{ ['--t' as string]: `var(--tint-${optional})`, ['--w' as string]: `var(--wash-${optional})` }}>
        <div className="ds-container">
          <Link href={`/${optional}/toppers`} className="ds-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            {name} topper copies
          </Link>
          <TopperCopyView subject={optional} subjectName={name} copy={copy} others={others} pyqs={pyqs} />
        </div>
      </div>
    </>
  );
}

const PAGE_CSS = `
.tvp { background: var(--bg); min-height: var(--page-min-h); padding: clamp(20px, 3.5vh, 36px) 0 clamp(48px, 9vh, 96px); }
.tvp .ds-back { margin-bottom: var(--space-4); }
`;
