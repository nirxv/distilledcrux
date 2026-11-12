import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from '@/components/Link';
import TopperCompare from '@/components/toppers/TopperCompare';
import { TOPPER_COMPARE_CSS, TOPPER_PASS_CSS, TOPPER_PDF_CSS } from '@/components/toppers/styles';
import { PYQ_SUBJECT_NAME } from '@/lib/pyqs';
import { comparableCopies, copiesForPyq, getCopy, isTopperSubject } from '@/lib/toppers';

/**
 * Two toppers' answers to the same question, side by side.
 *
 *   /<optional>/topper-copies/compare?a=<copy>&b=<copy>
 *   /<optional>/topper-copies/compare?pyq=<id>     the two best-ranked copies that answer a PYQ
 *
 * Either pane can be switched to any other copy of the same printed question
 * or of a UPSC question the first copy answers.
 */

type Params = { optional: string };
type Search = { a?: string; b?: string; pyq?: string };

export const metadata: Metadata = {
  title: 'Compare topper copies',
  robots: { index: false },
};

export default async function ComparePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { optional } = await params;
  const sp = await searchParams;
  if (!isTopperSubject(optional)) notFound();

  if (sp.pyq && !sp.a) {
    const forPyq = await copiesForPyq(optional, Number(sp.pyq));
    // Two different toppers: one person can answer a PYQ in two tests.
    const second = forPyq.find((c) => c.topper !== forPyq[0]?.topper);
    if (!second) notFound();
    redirect(`/${optional}/topper-copies/compare?a=${forPyq[0].id}&b=${second.id}`);
  }

  const a = sp.a ? await getCopy(optional, sp.a) : null;
  if (!a) notFound();
  const others = await comparableCopies(optional, a);
  if (!others.length) redirect(`/${optional}/topper-copies/${a.id}`);
  const b = (sp.b && others.find((o) => o.id === sp.b)) || others[0];
  const name = PYQ_SUBJECT_NAME[optional];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS + TOPPER_COMPARE_CSS + TOPPER_PDF_CSS + TOPPER_PASS_CSS }} />
      <div className="tcp ds" style={{ ['--t' as string]: `var(--tint-${optional})`, ['--w' as string]: `var(--wash-${optional})` }}>
        <div className="ds-container tcp-wide">
          <Link href={`/${optional}/topper-copies`} className="ds-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            {name} topper copies
          </Link>
          <h1 className="tcp-title">Two toppers, one question</h1>
          <TopperCompare subject={optional} pool={[a, ...others]} a={a.id} b={b.id} />
        </div>
      </div>
    </>
  );
}

const PAGE_CSS = `
.tcp { background: var(--bg); min-height: var(--page-min-h); padding: clamp(20px, 3.5vh, 36px) 0 clamp(48px, 9vh, 96px); }
.tcp-wide { max-width: 1440px; }
.tcp-title { margin: var(--space-3) 0 var(--space-4); font-size: clamp(1.4rem, 3vw, 1.9rem); font-weight: 800; letter-spacing: -0.02em; }
`;
