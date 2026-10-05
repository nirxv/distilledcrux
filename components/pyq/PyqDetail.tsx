'use client';
import { useState, useEffect, useRef, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { TOPPER_COPIES_LIVE } from '@/lib/features';
import type { Pyq } from '@/lib/pyqs';
import { listKey } from './PyqBrowser';

type AnswerEntry = {
  id: string;
  display_name: string;
  public_url: string;
  answer_number: number;
  created_at: string;
};

type Peek = { id: number; question: string } | null;

type Props = {
  subject: string;
  subjectName: string;
  pyq: Pyq;
  related: Pyq[];
  prev: Peek;
  next: Peek;
  topicCount: number;
};

/** The model's markdown, escaped first so nothing it writes becomes markup. */
function formatModelAnswer(text: string) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return sanitizeHtml(escaped
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•] (.+)$/gm, '<div class="bullet">$1</div>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>'));
}

const short = (q: string, n = 90) => (q.length > n ? `${q.slice(0, n - 1).trimEnd()}…` : q);

const Arrow = ({ back }: { back?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={back ? 'M19 12H5M11 6l-6 6 6 6' : 'M5 12h14M13 6l6 6-6 6'} />
  </svg>
);
const Lock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);

export default function PyqDetail({ subject, subjectName, pyq, related, prev, next, topicCount }: Props) {
  const router = useRouter();
  const base = `/${subject}/pyqs`;

  const [modelAnswer, setModelAnswer] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [paywalled, setPaywalled] = useState(false);

  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Premium check
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return;
      const token = await user.getIdToken();
      // Scoped to this page's subject: a subscription buys one optional, and
      // the model-answer route enforces exactly that, so an unscoped check here
      // would promise a full answer the server then refuses.
      fetch(`/api/sub-status?subject=${subject}`, { headers: { 'x-user-token': token } })
        .then(r => r.json())
        .then(d => setIsPremium(d.active === true))
        .catch(() => {});
    });
    return () => unsub();
  }, [subject]);

  // Community answers
  useEffect(() => {
    fetch(`/api/pyq-answers?pyq_id=${pyq.id}&subject=${subject}`)
      .then(r => r.json())
      .then(d => setAnswers(d.answers ?? []))
      .catch(() => {})
      .finally(() => setLoadingAnswers(false));
  }, [pyq.id, subject]);

  const generateModelAnswer = async () => {
    if (generating) return;
    setGenerating(true);
    setGenerated(false);
    setPaywalled(false);
    setModelAnswer('');
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';
    try {
      const res = await fetch('/api/model-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': token },
        body: JSON.stringify({ question: pyq.question, marks: pyq.marks ?? 10, subject, topic: pyq.topic }),
      });
      if (!res.ok) {
        // The route answers 403 for a reader without a subscription, so say
        // that rather than reporting it as a failure they could retry.
        const reason = await res.json().catch(() => null);
        if (reason?.error === 'premium_required') {
          setPaywalled(true);
        } else {
          setModelAnswer(reason?.error || 'Could not write a model answer just now. Please try again.');
        }
        setGenerating(false);
        return;
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setModelAnswer(full);
      }
      setGenerated(true);
    } catch {
      setModelAnswer('Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = async () => {
    setUploadErr(null);
    if (!file) { setUploadErr('Choose a PDF of your answer first.'); return; }
    if (!displayName.trim()) { setUploadErr('Add the name to show with it.'); return; }
    setUploading(true);
    const form = new FormData();
    form.append('pyq_id', String(pyq.id));
    form.append('subject', subject);
    form.append('display_name', displayName.trim());
    form.append('file', file);
    // The route records a signed-in uploader against the answer; it never got
    // the token, so every upload was anonymous. Signed out still works.
    const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => '') : '';
    const res = await fetch('/api/pyq-answers', { method: 'POST', body: form, headers: token ? { 'x-user-token': token } : undefined });
    const data = await res.json().catch(() => ({ error: 'Upload failed.' }));
    if (!res.ok || data.error) {
      setUploadErr(data.error ?? 'Upload failed.');
    } else {
      setAnswers(prev => [data.answer, ...prev]);
      setFile(null);
      setDisplayName('');
      if (fileRef.current) fileRef.current.value = '';
      setUploadOk(true);
      setShowUpload(false);
      setTimeout(() => setUploadOk(false), 4000);
    }
    setUploading(false);
  };

  // Back to the list as the reader left it, filters and all.
  const backToList = (e: MouseEvent) => {
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(listKey(subject)); } catch { /* storage blocked */ }
    if (saved && saved !== base) { e.preventDefault(); router.push(saved); }
  };

  const evaluateHref = `/evaluate?question=${encodeURIComponent(pyq.question)}${pyq.marks ? `&marks=${pyq.marks}` : ''}`;
  const tint = { ['--t' as string]: `var(--tint-${subject})`, ['--w' as string]: `var(--wash-${subject})` };
  const preview = !isPremium && generated;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pd ds" style={tint}>
        <div className="ds-container pd-grid">
          <div className="pd-main">
            <Link href={base} className="ds-back" onClick={backToList}>
              <Arrow back />
              {subjectName} PYQs
            </Link>

            <article className="pd-qcard">
              <div className="pd-meta">
                <span className="pd-paper">{pyq.paper}</span>
                <span>{pyq.year}</span>
                {pyq.section && <span>{pyq.section}</span>}
                {pyq.marks && <span className="pd-marks">{pyq.marks} marks</span>}
              </div>
              <h1 className="pd-question">{pyq.question}</h1>
              <div className="pd-tags">
                <Link href={`${base}?topic=${encodeURIComponent(pyq.topic)}`} className="pd-topic" title={`Every question on ${pyq.topic}`}>
                  {pyq.topic}
                </Link>
                {pyq.microtheme && pyq.microtheme.toLowerCase() !== pyq.topic.toLowerCase() && <span className="pd-micro">{pyq.microtheme}</span>}
              </div>
            </article>

            <div className="pd-actions">
              <Link href={evaluateHref} className="ds-btn ds-btn-solid">
                Write an answer
              </Link>
              <Link href={`/chat?subject=${subject}&q=${encodeURIComponent(pyq.question)}&topic=${encodeURIComponent(pyq.topic)}`} className="ds-btn ds-btn-line">
                Ask the AI how to approach it
              </Link>
              {!generated && !generating && !paywalled && (
                <button type="button" className="ds-btn ds-btn-ghost" onClick={generateModelAnswer}>
                  Show a model answer
                </button>
              )}
            </div>

            {paywalled && (
              <div className="pd-card pd-locked">
                <span className="pd-lock"><Lock /></span>
                <div>
                  <div className="pd-card-title">Model answers come with Premium</div>
                  <p>Premium writes a full answer to any question, at its word limit, with the thinkers and examples it should cite.</p>
                </div>
                <Link href="/pricing" className="ds-btn ds-btn-solid ds-btn-sm">See plans</Link>
              </div>
            )}

            {(generating || generated || modelAnswer) && (
              <section className="pd-card pd-model">
                <div className="pd-card-head">
                  <h2 className="pd-card-title">Model answer</h2>
                  <span>{pyq.marks ? `${pyq.marks} marks · ` : ''}{subjectName}</span>
                </div>

                {generating && !modelAnswer && (
                  <div className="pd-writing">
                    <span className="pd-dot" /><span className="pd-dot" /><span className="pd-dot" />
                    Writing it out
                  </div>
                )}

                {modelAnswer && (
                  <div className="pd-model-body">
                    <div
                      className={`pd-prose${preview && modelAnswer.length > 600 ? ' pd-fade' : ''}`}
                      style={{ maxHeight: preview ? '260px' : 'none', overflow: 'hidden' }}
                      dangerouslySetInnerHTML={{ __html: formatModelAnswer(preview ? modelAnswer.slice(0, 600) + '…' : modelAnswer) }}
                    />
                    {preview && (
                      <div className="pd-paywall">
                        <span className="pd-lock"><Lock /></span>
                        <p>The full answer comes with Premium.</p>
                        <Link href="/pricing" className="ds-btn ds-btn-solid ds-btn-sm">See plans</Link>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            <section className="pd-community">
              <div className="pd-sec-head">
                <h2>
                  Answers from other aspirants
                  {answers.length > 0 && <span>{answers.length}</span>}
                </h2>
                {!showUpload && (
                  <button type="button" className="ds-btn ds-btn-line ds-btn-sm" onClick={() => setShowUpload(true)}>
                    Share yours
                  </button>
                )}
              </div>

              {uploadOk && <p className="pd-ok" role="status">Thanks, your answer is up.</p>}

              {showUpload && (
                <div className="pd-card pd-upload">
                  <p className="pd-upload-intro">Upload a PDF of your handwritten or typed answer. Others writing this question will see it with your name.</p>
                  <div className="pd-upload-row">
                    <input
                      className="pd-input"
                      placeholder="Name to show"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      aria-label="Name to show with your answer"
                    />
                    <label className={`pd-file${file ? ' chosen' : ''}`}>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf"
                        onChange={e => setFile(e.target.files?.[0] ?? null)}
                      />
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                      <span>{file ? file.name : 'Choose a PDF, up to 5 MB'}</span>
                    </label>
                  </div>
                  {uploadErr && <p className="pd-err" role="alert">{uploadErr}</p>}
                  <div className="pd-upload-actions">
                    <button type="button" className="ds-btn ds-btn-solid ds-btn-sm" onClick={handleUpload} disabled={uploading}>
                      {uploading ? 'Uploading…' : 'Upload answer'}
                    </button>
                    <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => { setShowUpload(false); setUploadErr(null); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {loadingAnswers ? (
                <div className="pd-writing"><span className="pd-dot" /><span className="pd-dot" /><span className="pd-dot" /></div>
              ) : answers.length === 0 ? (
                !showUpload && <p className="pd-none">Nobody has shared an answer to this one yet.</p>
              ) : (
                <div className="pd-answers">
                  {answers.map(ans => (
                    <a key={ans.id} href={ans.public_url} target="_blank" rel="noopener noreferrer" className="pd-answer">
                      <span className="pd-answer-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                      </span>
                      <span className="pd-answer-text">
                        <span className="pd-answer-name">{ans.display_name}</span>
                        <span className="pd-answer-meta">
                          Answer {ans.answer_number} · {new Date(ans.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>

            {(prev || next) && (
              <nav className="pd-pager" aria-label="More questions">
                {prev ? (
                  <Link href={`${base}/${prev.id}`} className="pd-pager-link">
                    <span className="pd-pager-dir"><Arrow back /> Previous</span>
                    <span className="pd-pager-q">{short(prev.question, 80)}</span>
                  </Link>
                ) : <span />}
                {next ? (
                  <Link href={`${base}/${next.id}`} className="pd-pager-link next">
                    <span className="pd-pager-dir">Next <Arrow /></span>
                    <span className="pd-pager-q">{short(next.question, 80)}</span>
                  </Link>
                ) : <span />}
              </nav>
            )}
          </div>

          <aside className="pd-aside">
            {related.length > 0 && (
              <div className="pd-side">
                <h2 className="pd-side-title">More on {pyq.topic}</h2>
                <div className="pd-related">
                  {related.map(q => (
                    <Link key={q.id} href={`${base}/${q.id}`} className="pd-rel">
                      <span className="pd-rel-q">{short(q.question)}</span>
                      <span className="pd-rel-meta">{q.year} · {q.paper}{q.marks ? ` · ${q.marks} marks` : ''}</span>
                    </Link>
                  ))}
                </div>
                {topicCount > related.length + 1 && (
                  <Link href={`${base}?topic=${encodeURIComponent(pyq.topic)}`} className="pd-side-all">
                    All {topicCount} questions on this topic <Arrow />
                  </Link>
                )}
              </div>
            )}

            {/* Topper's Copy — archived until real copies are close; see lib/features.ts */}
            {TOPPER_COPIES_LIVE && (
              <div className="pd-side">
                <h2 className="pd-side-title">Topper&apos;s copy</h2>
                <p className="pd-side-text">Answer copies from toppers for this question will be added here.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

const CSS = `
.pd { background: var(--bg); min-height: var(--page-min-h); padding: clamp(20px, 3.5vh, 36px) 0 clamp(48px, 9vh, 96px); }
.pd-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--space-8); align-items: start; }
.pd-main { min-width: 0; }

.pd-qcard { margin: var(--space-4) 0 var(--space-4); padding: var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-1); }
.pd-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; font-size: 0.88rem; color: var(--text3); margin-bottom: var(--space-3); }
.pd-paper { padding: 2px 10px; border-radius: var(--radius-full); background: var(--w); color: var(--t); font-weight: 700; }
.pd-marks { margin-left: auto; padding: 2px 10px; border-radius: var(--radius-full); background: var(--ds-soft); color: var(--text2); font-weight: 600; }
.pd-question { margin: 0 0 var(--space-4); font-size: clamp(1.18rem, 2.2vw, 1.42rem); font-weight: 600; line-height: 1.5; letter-spacing: -0.01em; color: var(--text); }
.pd-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.pd-topic { padding: 4px 12px; border-radius: var(--radius-full); border: 1px solid color-mix(in srgb, var(--t) 35%, transparent); background: var(--w); color: var(--t); font-size: 0.84rem; font-weight: 600; text-decoration: none; }
.pd-topic:hover { border-color: var(--t); }
.pd-micro { font-size: 0.84rem; color: var(--text3); }

.pd-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-6); }

.pd-card { background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-5) var(--space-6); margin-bottom: var(--space-6); }
.pd-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.pd-card-head span { font-size: 0.86rem; color: var(--text3); }
.pd-card-title { margin: 0; font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em; }
.pd-locked { display: flex; align-items: center; gap: var(--space-4); }
.pd-locked p { margin: 4px 0 0; font-size: 0.92rem; line-height: 1.55; color: var(--text2); }
.pd-locked .ds-btn { margin-left: auto; flex-shrink: 0; }
.pd-lock { width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--premium-wash); color: var(--premium-text); }

.pd-model-body { position: relative; }
.pd-prose { font-size: 1rem; line-height: 1.8; color: var(--text); }
.pd-prose h3 { font-size: 1.02rem; font-weight: 700; color: var(--t); margin: 1.2rem 0 0.4rem; }
.pd-prose strong { font-weight: 700; }
.pd-prose .bullet { display: flex; gap: 10px; margin: 0.3rem 0; }
.pd-prose .bullet::before { content: ''; width: 6px; height: 6px; margin-top: 0.7em; border-radius: 50%; background: var(--t); flex-shrink: 0; }
.pd-fade { mask-image: linear-gradient(to bottom, #000 45%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, #000 45%, transparent 100%); }
.pd-paywall { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding-top: var(--space-3); text-align: center; }
.pd-paywall p { margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text); }
.pd-writing { display: flex; align-items: center; gap: 8px; padding: var(--space-3) 0; font-size: 0.92rem; color: var(--text3); }
.pd-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--t); animation: pdDot 1.2s ease-in-out infinite; }
.pd-dot:nth-child(2) { animation-delay: 0.15s; }
.pd-dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes pdDot { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }

.pd-community { padding-top: var(--space-6); border-top: 1px solid var(--border); }
.pd-sec-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); }
.pd-sec-head h2 { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-size: 1.2rem; font-weight: 800; letter-spacing: -0.01em; }
.pd-sec-head h2 span { min-width: 26px; padding: 1px 8px; border-radius: var(--radius-full); background: var(--w); color: var(--t); font-size: 0.8rem; font-weight: 700; text-align: center; }
.pd-none { margin: 0; color: var(--text3); font-size: 0.95rem; }
.pd-ok { margin: 0 0 var(--space-4); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--success-wash); color: var(--success-text); font-weight: 600; font-size: 0.92rem; }
.pd-upload { margin-bottom: var(--space-5); }
.pd-upload-intro { margin: 0 0 var(--space-4); font-size: 0.92rem; line-height: 1.55; color: var(--text2); }
.pd-upload-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: var(--space-2); }
.pd-input { height: 44px; padding: 0 var(--space-4); border: 1px solid var(--border2); border-radius: var(--radius-full); background: var(--bg); color: var(--text); font: inherit; font-size: 0.95rem; outline: none; min-width: 0; }
.pd-input:focus { border-color: color-mix(in srgb, var(--accent) 60%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.pd-file { position: relative; display: flex; align-items: center; gap: var(--space-2); height: 44px; padding: 0 var(--space-4); border: 1.5px dashed var(--border3); border-radius: var(--radius-full); color: var(--text2); font-size: 0.92rem; cursor: pointer; min-width: 0; }
.pd-file span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pd-file input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.pd-file:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.pd-file.chosen { border-style: solid; border-color: color-mix(in srgb, var(--t) 45%, transparent); color: var(--t); background: var(--w); }
.pd-err { margin: var(--space-3) 0 0; color: var(--danger-text); font-size: 0.9rem; }
.pd-upload-actions { display: flex; gap: var(--space-2); margin-top: var(--space-4); }
.pd-answers { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); }
.pd-answer { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--ds-card); text-decoration: none; transition: border-color 0.15s; min-width: 0; }
.pd-answer:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); }
.pd-answer-icon { width: 36px; height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; background: var(--w); color: var(--t); }
.pd-answer-text { display: flex; flex-direction: column; min-width: 0; }
.pd-answer-name { font-weight: 600; color: var(--text); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pd-answer-meta { font-size: 0.8rem; color: var(--text3); }

.pd-pager { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-3); margin-top: var(--space-8); }
.pd-pager-link { display: flex; flex-direction: column; gap: 6px; padding: var(--space-4) var(--space-5); border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--ds-card); text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s; }
.pd-pager-link:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); box-shadow: var(--elev-1); }
.pd-pager-link.next { text-align: right; align-items: flex-end; }
.pd-pager-dir { display: inline-flex; align-items: center; gap: 6px; font-size: 0.84rem; font-weight: 600; color: var(--t); }
.pd-pager-q { font-size: 0.92rem; line-height: 1.45; color: var(--text); }

.pd-aside { position: sticky; top: 84px; display: flex; flex-direction: column; gap: var(--space-4); padding-top: 50px; }
.pd-side { padding: var(--space-5); border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--ds-card); }
.pd-side-title { margin: 0 0 var(--space-3); font-size: 1rem; font-weight: 800; line-height: 1.35; }
.pd-side-text { margin: 0; font-size: 0.9rem; color: var(--text2); }
.pd-related { display: flex; flex-direction: column; }
.pd-rel { display: flex; flex-direction: column; gap: 4px; padding: var(--space-3) 0; border-top: 1px solid var(--border); text-decoration: none; }
.pd-rel:first-child { border-top: none; padding-top: 0; }
.pd-rel-q { font-size: 0.9rem; line-height: 1.5; color: var(--text); }
.pd-rel:hover .pd-rel-q { color: var(--t); }
.pd-rel-meta { font-size: 0.78rem; color: var(--text3); }
.pd-side-all { display: inline-flex; align-items: center; gap: 6px; margin-top: var(--space-3); font-size: 0.88rem; font-weight: 600; color: var(--accent-text); text-decoration: none; }
.pd-side-all:hover { text-decoration: underline; text-underline-offset: 3px; }

@media (max-width: 960px) {
  .pd-grid { grid-template-columns: minmax(0, 1fr); gap: var(--space-6); }
  .pd-aside { position: static; padding-top: 0; }
}
@media (max-width: 640px) {
  .pd-qcard { padding: var(--space-5) var(--space-4); }
  .pd-actions { flex-direction: column; align-items: stretch; }
  .pd-actions .ds-btn { justify-content: center; }
  .pd-card { padding: var(--space-4); }
  .pd-locked { flex-direction: column; align-items: flex-start; }
  .pd-locked .ds-btn { margin-left: 0; }
  .pd-upload-row { grid-template-columns: minmax(0, 1fr); }
  .pd-pager { grid-template-columns: minmax(0, 1fr); }
  .pd-pager-link.next { text-align: left; align-items: flex-start; }
  .pd-sec-head h2 { font-size: 1.08rem; }
}
@media (prefers-reduced-motion: reduce) { .pd-dot { animation: none; } }
`;
