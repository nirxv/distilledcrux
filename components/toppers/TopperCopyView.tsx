'use client';
import Link from '@/components/Link';
import { useLang } from '@/lib/i18n/LangContext';
import { rankLine, type TopperCopy } from '@/lib/toppers/meta';
import TopperPdf from './TopperPdf';
import { gateFor, useTopperStatus } from './useTopperStatus';
import type { PyqRef } from './TopperBrowser';

type Props = {
  subject: string;
  subjectName: string;
  copy: TopperCopy;
  /** Other toppers' answers to the same question, best rank first. */
  others: TopperCopy[];
  pyqs: PyqRef[];
};

/**
 * One topper copy: what was asked, who wrote it, the UPSC questions it would
 * answer, the handwritten pages, and the other toppers' answers to compare it
 * with.
 */
export default function TopperCopyView({ subject, subjectName, copy, others, pyqs }: Props) {
  const { L } = useLang();
  const allowance = useTopperStatus(subject);
  const left = Math.max(0, allowance.limit - allowance.used);

  return (
    <div className="tv-grid">
      <div className="tv-main">
        <header className="tv-head">
          <div className="tv-meta">
            <span className="tv-paper">{copy.paper}</span>
            <Link href={`/${subject}/topper-copies?topic=${encodeURIComponent(copy.topic)}`} className="tv-topic">{copy.topic}</Link>
            <span className="tv-marks">{copy.marks} {L('marks', 'अंक')}</span>
          </div>
          <h1 className="tv-q">{copy.question}</h1>
          <p className="tv-who">
            <strong>{copy.topper}</strong>
            {rankLine(copy) && <span>{rankLine(copy)}</span>}
          </p>
          {pyqs.length > 0 && (
            <div className="tv-asked">
              <span className="tv-asked-label">{pyqs.length === 1
                ? L('This answer would answer a UPSC question', 'यह उत्तर UPSC के एक प्रश्न का उत्तर देगा')
                : L(`This answer would answer ${pyqs.length} UPSC questions`, `यह उत्तर UPSC के ${pyqs.length} प्रश्नों का उत्तर देगा`)}</span>
              <ul>
                {pyqs.map((p) => (
                  <li key={p.id}>
                    <Link href={`/${subject}/pyqs/${p.id}`} prefetch={false}>
                      <span className="tv-asked-year">{p.year} · {p.paper}</span>
                      <span className="tv-asked-q">{p.question}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        <TopperPdf key={copy.id} subject={subject} copyId={copy.id} height="min(82vh, 1100px)"
          gate={gateFor(allowance, copy.id)} freeLeft={left} own={allowance.own} onOpened={allowance.noteOpened} />
      </div>

      <aside className="tv-aside">
        {others.length > 0 ? (
          <div className="tv-side">
            <h2 className="tv-side-title">{L('Other toppers on this question', 'इस प्रश्न पर अन्य टॉपर')}</h2>
            <ul className="tv-others">
              {others.map((o) => (
                <li key={o.id}>
                  <Link href={`/${subject}/topper-copies/${o.id}`} prefetch={false} className="tv-other">
                    <span className="tv-other-name">{o.topper}</span>
                    <span className="tv-other-rank">{rankLine(o)}</span>
                    {allowance.opened.has(o.id) && <span className="tv-opened">{L('Opened', 'खोला गया')}</span>}
                  </Link>
                  <Link href={`/${subject}/topper-copies/compare?a=${copy.id}&b=${o.id}`} prefetch={false} rel="nofollow" className="tv-cmp">{L('Compare', 'तुलना करें')}</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="tv-side">
            <h2 className="tv-side-title">{L('Only one topper so far', 'अभी तक केवल एक टॉपर')}</h2>
            <p className="tv-side-text">{L('No other topper&apos;s answer to this question is in the collection yet.', 'इस प्रश्न के किसी अन्य टॉपर का उत्तर अभी संग्रह में नहीं है।')}</p>
          </div>
        )}
        <div className="tv-side">
          <h2 className="tv-side-title">{L('How to read it', 'इसे कैसे पढ़ें')}</h2>
          <p className="tv-side-text">
            {L('Look at how the answer opens, how it is divided, and where the examples, thinkers and diagrams go.', 'देखें कि उत्तर की शुरुआत कैसे होती है, इसे कैसे बाँटा गया है, और उदाहरण, विचारक व आरेख कहाँ दिए गए हैं।')}
            {' '}{L('Then write your own and have it checked.', 'फिर अपना उत्तर लिखें और उसकी जाँच करवाएँ।')}
          </p>
          <Link href={`/evaluate?question=${encodeURIComponent(copy.question)}&marks=${copy.marks}`} className="ds-btn ds-btn-line ds-btn-sm">{L('Write your answer', 'अपना उत्तर लिखें')}</Link>
        </div>
        <Link href={`/${subject}/topper-copies`} className="tv-all">{L(`All ${subjectName} topper copies`, `${subjectName} के सभी टॉपर उत्तर`)}</Link>
      </aside>
    </div>
  );
}
