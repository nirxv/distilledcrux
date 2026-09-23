'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { PYQ_SUBJECTS, type PYQ, type PyqSubject } from './subjects';

type AnswerEntry = {
  id: string;
  display_name: string;
  public_url: string;
  answer_number: number;
  created_at: string;
};

/**
 * Structural only. Every colour comes from a --pd-* variable that the subject
 * config aliases onto that subject's accent ramp, so this block is shared
 * verbatim by all four subjects instead of being copied and re-tinted.
 */
const CSS = `
  .pd-wrap { min-height:100vh; padding:80px 0 96px; background:var(--bg); }
  .pd-inner {
    max-width:1100px; margin:0 auto; padding:0 2rem;
    display:grid; grid-template-columns:1fr 300px; gap:2rem; align-items:start;
  }
  @media(max-width:768px){ .pd-inner{grid-template-columns:1fr;} .pd-sidebar{position:static!important;} }

  /* Breadcrumb */
  .pd-crumb { display:flex; align-items:center; gap:6px; font-family:var(--font-ui); font-size:0.72rem; font-weight: 500; color:var(--text3); margin-bottom:1.5rem; }
  .pd-crumb a { color:var(--text3); text-decoration:none; transition:color 0.15s; }
  .pd-crumb a:hover { color:var(--text); }

  /* Question card */
  .pd-qcard {
    background:var(--bg2); border:1px solid var(--border); border-radius:12px;
    padding:1.75rem 2rem; margin-bottom:1.5rem;
    border-left:3px solid var(--pd-accent);
  }
  .pd-badges { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:1rem; }
  .pd-badge {
    font-family:var(--font-mono); font-size:0.6rem; font-weight: 500; padding:2px 9px;
    border-radius:3px; border:1px solid var(--border); background:var(--bg3); color:var(--text3);
  }
  .pd-badge.accent { background:var(--pd-accent-dim); border-color:var(--pd-accent-border); color:var(--pd-accent); }
  .pd-badge.m10 { background:rgba(74,222,128,0.06); border-color:rgba(74,222,128,0.15); color:#4ade80; }
  .pd-badge.m15 { background:rgba(251,191,36,0.06); border-color:rgba(251,191,36,0.15); color:#fbbf24; }
  .pd-badge.m20 { background:rgba(248,113,113,0.06); border-color:rgba(248,113,113,0.15); color:#f87171; }
  [data-theme="light"] .pd-badge.m10 { background:rgba(21,128,61,0.07); border-color:rgba(21,128,61,0.22); color:#15803d; }
  [data-theme="light"] .pd-badge.m15 { background:rgba(180,83,9,0.07); border-color:rgba(180,83,9,0.22); color:#b45309; }
  [data-theme="light"] .pd-badge.m20 { background:rgba(185,28,28,0.07); border-color:rgba(185,28,28,0.22); color:#b91c1c; }
  .pd-question { font-family:var(--font-body); font-size:1.05rem; color:var(--text); line-height:1.75; }

  /* Action row */
  .pd-actions { display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:1.5rem; }
  .pd-btn-primary {
    display:inline-flex; align-items:center; gap:6px;
    font-family:var(--font-ui); font-size:0.82rem; font-weight:600;
    background:var(--pd-accent); color:var(--pd-on-accent);
    padding:8px 18px; border-radius:6px; border:none; cursor:pointer; transition:opacity 0.15s;
    text-decoration:none;
  }
  .pd-btn-primary:hover { opacity:0.88; }
  .pd-btn-ghost {
    display:inline-flex; align-items:center; gap:6px;
    font-family:var(--font-ui); font-size:0.82rem; font-weight:600;
    background:transparent; color:var(--text2);
    padding:8px 18px; border-radius:6px; border:1px solid var(--border); cursor:pointer; transition:all 0.15s;
    text-decoration:none;
  }
  .pd-btn-ghost:hover { border-color:var(--pd-accent-border); color:var(--pd-accent); background:var(--pd-accent-dim); }

  .pd-section-label {
    font-family:var(--font-mono); font-size:0.58rem; font-weight: 500; letter-spacing:0.18em;
    text-transform:uppercase; color:var(--text3); margin-bottom:1rem;
  }

  /* Model answer */
  .pd-model-card {
    background:var(--bg2); border:1px solid var(--border); border-radius:12px;
    padding:1.75rem 2rem; position:relative; overflow:hidden;
  }
  .pd-model-card::before {
    content:''; position:absolute; top:0; left:0; right:0; height:2px;
    background:linear-gradient(90deg, var(--pd-accent) 0%, var(--pd-accent-border) 60%, transparent 100%);
  }
  .pd-model-prose { font-family:var(--font-body); font-size:0.95rem; color:var(--text2); line-height:1.85; }
  .pd-model-prose h3 { font-family:var(--font-ui); font-size:0.9rem; color:var(--text); margin:1.25rem 0 0.5rem; font-weight:700; }
  .pd-model-prose strong { color:var(--text); font-weight:700; }
  .pd-model-prose .bullet { display:flex; gap:8px; margin:0.35rem 0; }
  .pd-model-prose .bullet::before { content:'·'; color:var(--pd-accent); flex-shrink:0; font-size:1rem; line-height:1.6; }
  .pd-model-blur { mask-image:linear-gradient(to bottom, #000 55%, transparent 100%); -webkit-mask-image:linear-gradient(to bottom, #000 55%, transparent 100%); }
  .pd-paywall {
    position:absolute; left:0; right:0; bottom:0;
    display:flex; flex-direction:column; align-items:center; gap:0.5rem;
    background:linear-gradient(to bottom, rgba(5,5,8,0) 0%, var(--bg) 40%);
    padding:2rem;
  }
  [data-theme="light"] .pd-paywall { background:linear-gradient(to bottom, rgba(248,248,252,0) 0%, var(--bg) 40%); }
  .pd-paywall-text { font-family:var(--font-ui); font-size:0.82rem; font-weight: 500; color:var(--text3); margin:0; }

  .pd-generating {
    display:flex; align-items:center; gap:8px; padding:1.5rem 0;
    font-family:var(--font-mono); font-size:0.72rem; font-weight: 500; color:var(--text3); letter-spacing:0.06em;
  }
  .pd-dot { width:6px; height:6px; border-radius:50%; background:var(--pd-accent);
    animation:pd-dot 1.2s ease-in-out infinite; }
  .pd-dot:nth-child(2){ animation-delay:0.15s; }
  .pd-dot:nth-child(3){ animation-delay:0.3s; }
  @keyframes pd-dot { 0%,100%{opacity:0.25;} 50%{opacity:1;} }

  /* Prev / next */
  .pd-nav { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-top:2rem; }
  .pd-nav-btn {
    display:inline-flex; align-items:center; gap:6px;
    font-family:var(--font-ui); font-size:0.78rem; font-weight: 500; color:var(--text2);
    padding:7px 14px; border:1px solid var(--border); border-radius:6px;
    text-decoration:none; transition:all 0.15s;
  }
  .pd-nav-btn:hover { border-color:var(--pd-accent-border); color:var(--pd-accent); background:var(--pd-accent-dim); }

  /* Upload */
  .pd-upload-card {
    background:var(--bg2); border:1px solid var(--border); border-radius:12px;
    padding:1.5rem; margin-bottom:1.5rem;
  }
  .pd-upload-input {
    width:100%; background:var(--bg3); border:1px solid var(--border);
    border-radius:6px; padding:0.6rem 0.8rem; color:var(--text);
    font-family:var(--font-ui); font-size:0.84rem; font-weight: 500; outline:none; box-sizing:border-box;
    margin-bottom:0.6rem;
  }
  .pd-upload-input:focus { border-color:var(--pd-accent-border2); }

  .pd-answer-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:0.75rem; }
  .pd-answer-card {
    background:var(--bg2); border:1px solid var(--border); border-radius:8px;
    padding:1rem 1.1rem; text-decoration:none; display:block; transition:background 0.15s;
  }
  .pd-answer-card:hover { background:var(--bg3); border-color:var(--pd-accent-border); }
  .pd-answer-icon { font-size:1.1rem; margin-bottom:0.4rem; }
  .pd-answer-name { font-family:var(--font-ui); font-size:0.82rem; color:var(--text); font-weight:600;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px; }
  .pd-answer-meta { font-family:var(--font-mono); font-size:0.62rem; font-weight: 500; color:var(--text3); }

  /* Sidebar */
  .pd-sidebar { position:sticky; top:90px; display:flex; flex-direction:column; gap:1rem; }
  .pd-sidebar-card {
    background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:1.25rem;
  }
  .pd-related { display:flex; flex-direction:column; gap:0.5rem; }
  .pd-related-item {
    display:block; padding:0.6rem 0.75rem; border:1px solid var(--border); border-radius:6px;
    text-decoration:none; font-family:var(--font-ui); font-size:0.78rem; font-weight: 500; color:var(--text2); line-height:1.5;
    transition:all 0.15s;
  }
  .pd-related-item:hover { border-color:var(--pd-accent-border); background:var(--pd-accent-dim); color:var(--pd-accent); }
  .pd-related-year { font-family:var(--font-mono); font-size:0.6rem; font-weight: 500; color:var(--text3); margin-top:3px; }

  .pd-empty { text-align:center; padding:3rem 1rem; color:var(--text3); font-family:var(--font-ui); font-size:0.88rem; font-weight: 500; }
  .pd-dashed { border:1px dashed var(--border); border-radius:8px; padding:2rem; text-align:center; color:var(--text3); font-family:var(--font-ui); font-size:0.82rem; font-weight: 500; }
`;

function marksClass(m: number) {
  return m === 10 ? 'm10' : m === 15 ? 'm15' : m === 20 ? 'm20' : '';
}

function formatModelAnswer(text: string) {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•] (.+)$/gm, '<div class="bullet">$1</div>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

const Chevron = ({ dir }: { dir: 'l' | 'r' }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d={dir === 'l' ? 'M7.5 3l-3 3 3 3' : 'M4.5 3l3 3-3 3'} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function PyqDetail({ subject, questions }: { subject: PyqSubject; questions: PYQ[] }) {
  const config = PYQ_SUBJECTS[subject];
  const { id } = useParams<{ id: string }>();
  const pyq = questions.find(q => q.id === parseInt(id));

  const [modelAnswer, setModelAnswer] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [paywalled, setPaywalled] = useState(false);

  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(true);
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
      fetch('/api/sub-status', { headers: { 'x-user-token': token } })
        .then(r => r.json())
        .then(d => setIsPremium(d.active === true))
        .catch(() => {});
    });
    return () => unsub();
  }, []);

  // Community answers
  useEffect(() => {
    if (!pyq) return;
    fetch(`/api/pyq-answers?pyq_id=${pyq.id}&subject=${subject}`)
      .then(r => r.json())
      .then(d => setAnswers(d.answers ?? []))
      .catch(() => {})
      .finally(() => setLoadingAnswers(false));
  }, [pyq?.id, subject]);

  const generateModelAnswer = async () => {
    if (!pyq || generating) return;
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
        body: JSON.stringify({ question: pyq.question, marks: pyq.marks, subject, topic: pyq.topic }),
      });
      if (!res.ok) {
        // The route answers 403 for a reader without a subscription, so say
        // that rather than reporting it as a failure they could retry.
        const reason = await res.json().catch(() => null);
        if (reason?.error === 'premium_required') {
          setPaywalled(true);
        } else {
          setModelAnswer(reason?.error || 'Could not generate an answer. Please try again.');
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
    if (!file) { setUploadErr('Select a PDF file.'); return; }
    if (!displayName.trim()) { setUploadErr('Enter your name.'); return; }
    if (!pyq) return;
    setUploading(true);
    const form = new FormData();
    form.append('pyq_id', String(pyq.id));
    form.append('subject', subject);
    form.append('display_name', displayName.trim());
    form.append('file', file);
    const res = await fetch('/api/pyq-answers', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || data.error) {
      setUploadErr(data.error ?? 'Upload failed.');
    } else {
      setAnswers(prev => [data.answer, ...prev]);
      setFile(null);
      setDisplayName('');
      if (fileRef.current) fileRef.current.value = '';
      setUploadOk(true);
      setTimeout(() => setUploadOk(false), 3500);
    }
    setUploading(false);
  };

  // Related: same topic, different question
  const related = questions.filter(q => q.topic === pyq?.topic && q.id !== pyq?.id).slice(0, 5);

  // Prev / next in full list
  const allIds = questions.map(q => q.id);
  const idx = allIds.indexOf(pyq?.id ?? -1);
  const prevId = idx > 0 ? allIds[idx - 1] : null;
  const nextId = idx < allIds.length - 1 ? allIds[idx + 1] : null;

  const base = `/${subject}/pyqs`;

  if (!pyq) return (
    <div className="pd-wrap" data-subject={subject}>
      <style dangerouslySetInnerHTML={{ __html: `.pd-wrap[data-subject="${subject}"]{${config.vars}}` + CSS }} />
      <div className="pd-empty">
        Question not found.{' '}
        <Link href={base} style={{ color: 'var(--pd-accent)' }}>← Back to PYQs</Link>
      </div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `.pd-wrap[data-subject="${subject}"]{${config.vars}}` + CSS }} />
      <div className="pd-wrap" data-subject={subject}>
        <div className="pd-inner">

          {/* ── Left column ── */}
          <div>
            {/* Breadcrumb */}
            <div className="pd-crumb">
              <Link href="/">Home</Link>
              <Chevron dir="r" />
              <Link href={base}>{config.label} PYQs</Link>
              <Chevron dir="r" />
              <span style={{ color: 'var(--text2)' }}>{pyq.topic}</span>
            </div>

            {/* Question card */}
            <div className="pd-qcard">
              <div className="pd-badges">
                <span className="pd-badge accent">{pyq.paper}</span>
                {pyq.section && <span className="pd-badge">{pyq.section}</span>}
                <span className="pd-badge accent">{pyq.year}</span>
                <span className={`pd-badge ${marksClass(pyq.marks)}`}>{pyq.marks}M</span>
                <span className="pd-badge">{pyq.topic}</span>
                {pyq.microtheme && <span className="pd-badge">{pyq.microtheme}</span>}
              </div>
              <p className="pd-question">{pyq.question}</p>
            </div>

            {/* Actions */}
            <div className="pd-actions">
              <Link href={`/chat?subject=${subject}&q=${encodeURIComponent(pyq.question)}`} className="pd-btn-primary">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Ask AI
              </Link>
              <Link href={`/evaluate?question=${encodeURIComponent(pyq.question)}&marks=${pyq.marks}`} className="pd-btn-ghost">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Submit Answer
              </Link>
              {!generated && !generating && (
                <button className="pd-btn-ghost" onClick={generateModelAnswer}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Model Answer
                </button>
              )}
            </div>

            {/* Model Answer */}
            {paywalled && (
              <div className="pd-model-card" style={{ marginBottom: '1.5rem' }}>
                <div className="pd-section-label">Model Answer</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '1.5rem 1rem', textAlign: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <p className="pd-paywall-text">
                    Model answers are part of Premium.
                  </p>
                  <Link href="/pricing" className="pd-btn-primary" style={{ fontSize: '0.8rem', fontWeight: 500, padding: '7px 16px' }}>
                    See plans →
                  </Link>
                </div>
              </div>
            )}

            {(generating || generated || modelAnswer) && (
              <div className="pd-model-card" style={{ marginBottom: '1.5rem' }}>
                <div className="pd-section-label">Model Answer · {pyq.marks} marks · {config.label} Optional</div>

                {generating && !modelAnswer && (
                  <div className="pd-generating">
                    <div className="pd-dot" /><div className="pd-dot" /><div className="pd-dot" />
                    Generating…
                  </div>
                )}

                {modelAnswer && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={`pd-model-prose${!isPremium && generated && modelAnswer.length > 600 ? ' pd-model-blur' : ''}`}
                      style={{ maxHeight: !isPremium && generated ? '260px' : 'none', overflow: 'hidden' }}
                      dangerouslySetInnerHTML={{ __html: formatModelAnswer(
                        !isPremium && generated ? modelAnswer.slice(0, 600) + '…' : modelAnswer
                      )}}
                    />
                    {!isPremium && generated && (
                      <div className="pd-paywall">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <p className="pd-paywall-text">Full model answer available on Premium</p>
                        <Link href="/pricing" className="pd-btn-primary" style={{ fontSize: '0.8rem', fontWeight: 500, padding: '7px 16px' }}>
                          Upgrade →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Submit answer */}
            <div className="pd-upload-card">
              <div className="pd-section-label">Submit Your Answer</div>
              <input
                className="pd-upload-input"
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                style={{ color: 'var(--text2)', fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.6rem', display: 'block' }}
              />
              {uploadErr && <div style={{ color: 'var(--red,#f87171)', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.5rem' }}>{uploadErr}</div>}
              {uploadOk && <div style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.5rem' }}>✓ Submitted!</div>}
              <button
                className="pd-btn-primary"
                onClick={handleUpload}
                disabled={uploading}
                style={{ opacity: uploading ? 0.6 : 1 }}
              >
                {uploading ? 'Uploading…' : 'Submit PDF'}
              </button>
            </div>

            {/* Community answers */}
            <div>
              <div className="pd-section-label">
                Community Answers{answers.length > 0 ? ` · ${answers.length}` : ''}
              </div>
              {loadingAnswers ? (
                <div className="pd-generating">
                  <div className="pd-dot" /><div className="pd-dot" /><div className="pd-dot" />
                </div>
              ) : answers.length === 0 ? (
                <div className="pd-dashed">No answers yet. Be the first to submit.</div>
              ) : (
                <div className="pd-answer-grid">
                  {answers.map(ans => (
                    <a key={ans.id} href={ans.public_url} target="_blank" rel="noopener noreferrer" className="pd-answer-card">
                      <div className="pd-answer-icon">📄</div>
                      <div className="pd-answer-name">{ans.display_name}</div>
                      <div className="pd-answer-meta">
                        Answer #{ans.answer_number} · {new Date(ans.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Prev / Next */}
            <div className="pd-nav">
              {prevId ? (
                <Link href={`${base}/${prevId}`} className="pd-nav-btn">
                  <Chevron dir="l" />
                  Prev
                </Link>
              ) : <span />}
              <Link href={base} className="pd-nav-btn">All PYQs</Link>
              {nextId ? (
                <Link href={`${base}/${nextId}`} className="pd-nav-btn">
                  Next
                  <Chevron dir="r" />
                </Link>
              ) : <span />}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="pd-sidebar">

            {/* Ask AI card */}
            <div className="pd-sidebar-card">
              <div className="pd-section-label">AI Tutor</div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text3)', lineHeight: 1.6, marginBottom: '0.85rem' }}>
                Ask the AI to explain this question, suggest an outline, cite relevant thinkers, or critique your draft answer.
              </p>
              <Link
                href={`/chat?subject=${subject}&q=${encodeURIComponent(pyq.question)}&topic=${encodeURIComponent(pyq.topic)}`}
                className="pd-btn-primary"
                style={{ width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}
              >
                Open in AI Chat →
              </Link>
            </div>

            {/* Topper's Copy */}
            <div className="pd-sidebar-card">
              <div className="pd-section-label">Topper&apos;s Copy</div>
              <div style={{
                border: '1px dashed var(--border)',
                borderRadius: '8px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: '1.4rem' }}>🏆</span>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                  Coming Soon
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text3)', lineHeight: 1.6 }}>
                  Topper&apos;s answer copies for this question will be added here. Check back soon.
                </div>
              </div>
            </div>

            {/* Related questions */}
            {related.length > 0 && (
              <div className="pd-sidebar-card">
                <div className="pd-section-label">Same Topic</div>
                <div className="pd-related">
                  {related.map(q => (
                    <Link key={q.id} href={`${base}/${q.id}`} className="pd-related-item">
                      {q.question.length > 90 ? q.question.slice(0, 90) + '…' : q.question}
                      <div className="pd-related-year">{q.year} · {q.marks}M</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="pd-sidebar-card">
              <div className="pd-section-label">Question Info</div>
              {([
                ['Year', pyq.year],
                ['Paper', pyq.paper],
                ['Marks', `${pyq.marks}M`],
                ['Topic', pyq.topic],
                pyq.section ? ['Section', pyq.section] : null,
                pyq.microtheme ? ['Microtheme', pyq.microtheme] : null,
              ].filter(Boolean) as string[][]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid var(--border)', gap: '1rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 500, color: 'var(--text3)', flexShrink: 0 }}>{k}</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text2)', textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
