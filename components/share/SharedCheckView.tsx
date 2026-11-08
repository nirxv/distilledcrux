'use client';
import Link from 'next/link';
import InvitedNote from '@/components/InvitedNote';
import { routeSlugForOptional } from '@/lib/optionals';
import type { ShareCard } from '@/lib/shareCard';

const SECTION_NAME = { introduction: 'Introduction', body: 'Body', conclusion: 'Conclusion', presentation: 'Presentation' } as const;

function scoreTone(pct: number) {
  if (pct >= 0.7) return 'var(--success-text)';
  if (pct >= 0.5) return 'var(--warning-text)';
  return 'var(--danger-text)';
}

/** The public card for a shared answer check. The question and feedback stay in the language they were marked in. */
export default function SharedCheckView({ check }: { check: ShareCard & { date: string } }) {
  const pct = check.outOf ? check.marks / check.outOf : 0;
  const slug = routeSlugForOptional(check.optional);
  const tint = slug ? { ['--t' as string]: `var(--tint-${slug})`, ['--w' as string]: `var(--wash-${slug})` } : undefined;

  return (
    <div className="shc-page ds" style={tint}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ds-container shc-wrap">
        <p className="shc-eyebrow">Answer check · UPSC {check.subject} optional</p>

        <article className="shc-card ds-card">
          <div className="shc-q">
            <span>Question · {check.outOf} marks</span>
            <p lang={check.lang}>{check.question}</p>
          </div>

          <div className="shc-grid">
            <div className="shc-score">
              <div className="shc-num" style={{ color: scoreTone(pct) }}>{check.marks}<span>/ {check.outOf}</span></div>
              <div className="shc-bar"><span style={{ width: `${Math.min(100, pct * 100)}%`, background: scoreTone(pct) }} /></div>
              {check.sections.length > 0 && (
                <div className="shc-secs">
                  {check.sections.map((s) => {
                    const p = s.outOf ? s.awarded / s.outOf : 0;
                    return (
                      <div key={s.key} className="shc-sec">
                        <div className="shc-sec-top"><span>{SECTION_NAME[s.key]}</span><span>{s.awarded} / {s.outOf}</span></div>
                        <div className="shc-sec-bar"><span style={{ width: `${Math.min(100, p * 100)}%`, background: scoreTone(p) }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="shc-notes" lang={check.lang}>
              {check.worked.length > 0 && (
                <section>
                  <h2>What worked</h2>
                  <ul>{check.worked.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </section>
              )}
              {check.improve.length > 0 && (
                <section>
                  <h2>To improve</h2>
                  <ul>{check.improve.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </section>
              )}
              <p className="shc-private">The answer itself is not shown.</p>
            </div>
          </div>
        </article>

        <aside className="shc-cta ds-card-soft">
          <h2>Get your own answer checked</h2>
          <p>Photograph a handwritten answer and get marks for each part, with feedback on what to add. Sign in, and your first check is free.</p>
          <InvitedNote className="shc-invited" />
          <div className="shc-cta-btns">
            <Link href="/evaluate" className="ds-btn ds-btn-solid">Check an answer</Link>
            <Link href="/pricing" className="ds-btn ds-btn-line">See the plans</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.shc-wrap { max-width: 860px; padding-top: var(--space-10); padding-bottom: var(--space-12); }
.shc-eyebrow { margin: 0 0 var(--space-4); font-family: var(--font-ui); font-size: 0.8rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--t, var(--text3)); }
.shc-card { padding: var(--space-6); }
.shc-q span { font-family: var(--font-ui); font-size: 0.8rem; color: var(--text3); }
.shc-q p { margin: var(--space-2) 0 0; font-size: 1.12rem; line-height: 1.6; color: var(--text); }
.shc-grid { display: grid; grid-template-columns: 240px 1fr; gap: var(--space-8); margin-top: var(--space-6); padding-top: var(--space-6); border-top: 1px solid var(--border); }
.shc-num { font-family: var(--font-body); font-weight: 800; font-size: 3.4rem; line-height: 1; letter-spacing: -0.03em; }
.shc-num span { margin-left: 6px; font-size: 1.3rem; font-weight: 600; color: var(--text3); }
.shc-bar, .shc-sec-bar { height: 8px; margin-top: var(--space-3); border-radius: var(--radius-full); background: var(--bg2); overflow: hidden; }
.shc-sec-bar { height: 6px; margin-top: 6px; }
.shc-bar span, .shc-sec-bar span { display: block; height: 100%; border-radius: inherit; }
.shc-secs { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-6); }
.shc-sec-top { display: flex; justify-content: space-between; font-family: var(--font-ui); font-size: 0.84rem; color: var(--text2); }
.shc-notes section + section { margin-top: var(--space-5); }
.shc-notes h2 { margin: 0 0 var(--space-2); font-family: var(--font-ui); font-size: 0.86rem; font-weight: 700; color: var(--text); }
.shc-notes ul { margin: 0; padding-left: 1.1em; display: flex; flex-direction: column; gap: var(--space-2); }
.shc-notes li { font-size: 0.98rem; line-height: 1.6; color: var(--text2); }
.shc-private { margin: var(--space-5) 0 0; font-family: var(--font-ui); font-size: 0.8rem; color: var(--text3); }
.shc-cta { margin-top: var(--space-6); padding: var(--space-6); }
.shc-cta h2 { margin: 0; font-size: 1.3rem; color: var(--text); }
.shc-cta p { margin: var(--space-2) 0 0; line-height: 1.6; color: var(--text2); }
.shc-cta .shc-invited { font-family: var(--font-ui); font-size: 0.88rem; color: var(--premium-text); }
.shc-cta-btns { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-5); }
@media (max-width: 720px) {
  .shc-wrap { padding-top: var(--space-6); }
  .shc-card, .shc-cta { padding: var(--space-5); }
  .shc-grid { grid-template-columns: 1fr; gap: var(--space-6); }
  .shc-cta-btns .ds-btn { flex: 1 1 100%; justify-content: center; }
}
`;
