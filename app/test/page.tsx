'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import type { User } from 'firebase/auth';
import { geoMapData, GeoMapEntry } from '@/lib/geoMapData';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubjectId = 'sociology' | 'anthropology' | 'polsci' | 'geography' | 'pub-admin';
type PaperChoice = 'Paper I' | 'Paper II' | 'both';
type TestMode = 'sectional' | 'full';
type Phase = 'config' | 'test' | 'results';

interface PYQ {
  id: number;
  year: string;
  paper: string;
  section?: string;
  question: string;
  marks: number;
  topic: string;
  microtheme?: string;
}

interface QGroup {
  qNum: number;
  questions: PYQ[];   // sub-parts of one Q block
}

interface RubricState {
  intro: number;
  body: number;
  conc: number;
  pres: number;
}

// ─── Subject meta ─────────────────────────────────────────────────────────────

const SUBJECTS: Record<SubjectId, {
  label: string; icon: string;
  color: string; dim: string; border: string;
  thinkerTerm: string;
  dataFile: string | null;     // null = PYQ file not yet available
}> = {
  sociology: {
    label: 'Sociology', icon: 'sociology',
    color: '#4361ee', dim: 'rgba(67,97,238,0.09)', border: 'rgba(67,97,238,0.28)',
    thinkerTerm: 'thinker',
    dataFile: '/data/sociology-pyqs.json',
  },
  anthropology: {
    label: 'Anthropology', icon: 'anthropology',
    color: '#2dd4bf', dim: 'rgba(45,212,191,0.09)', border: 'rgba(45,212,191,0.28)',
    thinkerTerm: 'anthropologist',
    dataFile: '/data/anthropology-pyqs.json',
  },
  polsci: {
    label: 'PSIR', icon: 'psir',
    color: '#f87171', dim: 'rgba(248,113,113,0.09)', border: 'rgba(248,113,113,0.25)',
    thinkerTerm: 'thinker',
    dataFile: '/data/psir-pyqs.json',
  },
  geography: {
    label: 'Geography', icon: 'geography',
    color: 'var(--geo)', dim: 'var(--geo-dim)', border: 'var(--geo-border)',
    thinkerTerm: 'scholar',
    dataFile: '/data/geography-pyqs.json',
  },
  'pub-admin': {
    label: 'Pub Admin', icon: 'pubadmin',
    color: '#fb923c', dim: 'rgba(251,146,60,0.09)', border: 'rgba(251,146,60,0.25)',
    thinkerTerm: 'scholar',
    dataFile: null,
  },
};

const OPTIONAL_TO_SUBJECT: Record<string, SubjectId> = {
  sociology: 'sociology',
  anthropology: 'anthropology',
  'political-science': 'polsci',
  geography: 'geography',
  'public-administration': 'pub-admin',
};

function rubricOutOf(marks: number): { intro: number; body: number; conc: number; pres: number } {
  // 15% intro / 60% body / 15% conc / 10% pres (matches subjectConfig rubricWeights)
  const i = +(marks * 0.15).toFixed(1);
  const b = +(marks * 0.60).toFixed(1);
  const c = +(marks * 0.15).toFixed(1);
  const p = +(marks * 0.10).toFixed(1);
  return { intro: i, body: b, conc: c, pres: p };
}
function rubricTotal(r: RubricState) { return r.intro + r.body + r.conc + r.pres; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick<T>(arr: T[], n: number): T[] { return shuffle(arr).slice(0, n); }

// UPSC Sociology/Anthropology pattern:
//  Q1 compulsory: 5 × 10M short notes (50M total) or 1 × 60M essay
//  Q2-Q5: each group = 2×20M subparts  (sectional) or mix
// We'll do: sectional = 4 Qs (Q1 compulsory short-notes + Q2,Q3,Q4 each 2×20M + 1×10M)
// Full paper = 8 Qs across Paper I + Paper II

function buildCompulsoryQ(pool: PYQ[], count = 5): PYQ[] {
  // Q1: short notes (10M each); count=4 when map Q1(a) is included
  const tens = pool.filter(q => q.marks === 10);
  return pick(tens, count);
}

function buildQGroup(pool: PYQ[], qNum: number): QGroup {
  const used = new Set<number>();
  function pickUniq(marks: number, n: number): PYQ[] {
    const c = shuffle(pool.filter(q => q.marks === marks && !used.has(q.id))).slice(0, n);
    c.forEach(q => used.add(q.id));
    return c;
  }
  // Each Q: 2×20M + 1×10M = 50M
  const twenties = pickUniq(20, 2);
  const ten = pickUniq(10, 1);
  return { qNum, questions: [...twenties, ...ten].filter(Boolean) };
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function useTimer(totalSec: number, running: boolean, onEnd: () => void) {
  const [rem, setRem] = useState(totalSec);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { setRem(totalSec); }, [totalSec]);
  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => {
      setRem(p => { if (p <= 1) { clearInterval(ref.current!); onEnd(); return 0; } return p - 1; });
    }, 1000);
    return () => clearInterval(ref.current!);
  }, [running, onEnd]);
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  return { rem, display: fmt(rem) };
}

// ─── RubricScorer ─────────────────────────────────────────────────────────────

function RubricScorer({ marks, value, onChange, color }: {
  marks: number;
  value?: RubricState;
  onChange: (r: RubricState) => void;
  color: string;
}) {
  const out = rubricOutOf(marks);
  const cur = value ?? { intro: 0, body: 0, conc: 0, pres: 0 };
  const total = rubricTotal(cur);
  const pct = Math.round((total / marks) * 100);
  const criteria = [
    { key: 'intro' as const, label: 'Introduction', desc: 'Theoretical framing, named thinker', max: out.intro },
    { key: 'body'  as const, label: 'Body',          desc: 'Arguments, evidence, thinkers cited', max: out.body  },
    { key: 'conc'  as const, label: 'Conclusion',    desc: 'Synthesis, clear position',           max: out.conc  },
    { key: 'pres'  as const, label: 'Presentation',  desc: 'Structure, word count, legibility',   max: out.pres  },
  ];
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '1rem', marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', fontFamily: 'var(--font-ui)' }}>
          Self Evaluation
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700,
          color: pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)' }}>
          {total.toFixed(1)} / {marks}
        </span>
      </div>
      {criteria.map(c => (
        <div key={c.key} style={{ marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text)', fontWeight: 500 }}>{c.label}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text3)', marginLeft: '0.4rem', fontFamily: 'var(--font-ui)' }}>{c.desc}</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
              {cur[c.key].toFixed(1)}/{c.max}
            </span>
          </div>
          <div style={{ position: 'relative', height: 7, background: 'var(--bg4)', borderRadius: 4 }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 4,
              width: `${(cur[c.key] / c.max) * 100}%`,
              background: `linear-gradient(90deg, ${color}, ${color}88)`,
              transition: 'width 0.2s',
            }} />
            <input type="range" min={0} max={c.max} step={0.5} value={cur[c.key]}
              onChange={e => onChange({ ...cur, [c.key]: parseFloat(e.target.value) })}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }} />
            <div style={{
              position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
              left: `${(cur[c.key] / c.max) * 100}%`,
              width: 13, height: 13, borderRadius: '50%',
              background: color, boxShadow: `0 0 6px ${color}80`,
              border: '2px solid rgba(0,0,0,0.2)',
              pointerEvents: 'none', transition: 'left 0.2s',
            }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: '0.6rem', height: 3, background: 'var(--bg4)', borderRadius: 2 }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`,
          background: pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)',
          transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// ─── AI Mentor Panel ──────────────────────────────────────────────────────────

type OcrStep = 'idle' | 'ocr' | 'transcript' | 'evaluating' | 'done' | 'error';

async function pdfToImages(file: File): Promise<File[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const images: File[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas } as Parameters<typeof page.render>[0]).promise;
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (blob) images.push(new File([blob], `page-${i}.jpg`, { type: 'image/jpeg' }));
  }
  return images;
}

function AIMentorPanel({ question, marks, subjectId, isPremium, user }: {
  question: string; marks: number; subjectId: SubjectId;
  isPremium: boolean; user: User | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<OcrStep>('idle');
  const [ocrMsg, setOcrMsg] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [transcript, setTranscript] = useState('');
  const [evalData, setEvalData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const color = SUBJECTS[subjectId].color;

  function handleUpload() {
    if (!user) { alert('Sign in to use AI evaluation.'); return; }
    if (!isPremium) { window.location.href = '/pricing'; return; }
    fileRef.current?.click();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    let arr: File[] = [];
    for (const f of Array.from(files)) {
      if (f.type === 'application/pdf') { arr = arr.concat(await pdfToImages(f)); }
      else arr.push(f);
    }
    setImages(arr);
    setPreviews(arr.map(f => URL.createObjectURL(f)));
    setPanelOpen(true);
    setStep('ocr');
    setError(''); setTranscript(''); setEvalData(null);
    try {
      const token = await user?.getIdToken() ?? '';
      const fd = new FormData();
      arr.forEach(f => fd.append('files', f));
      setOcrMsg(`Sending ${arr.length} page${arr.length > 1 ? 's' : ''} to OCR…`);
      const r = await fetch('/api/ocr', { method: 'POST', headers: { 'x-user-token': token }, body: fd });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || 'OCR failed');
      setTranscript(data.text ?? '');
      setStep('transcript');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'OCR failed');
      setStep('error');
    }
  }

  async function runEval() {
    if (!transcript.trim()) return;
    setStep('evaluating');
    setError('');
    try {
      const token = await user?.getIdToken() ?? '';
      const fd = new FormData();
      images.forEach(f => fd.append('files', f));
      fd.append('question', question);
      fd.append('marks', String(marks));
      fd.append('extractedText', transcript);
      fd.append('subject', subjectId);
      const r = await fetch('/api/evaluate', { method: 'POST', headers: { 'x-user-token': token }, body: fd });
      const data = await r.json();
      if (!r.ok || data.error) { setError(data.error || 'Evaluation failed.'); setStep('error'); return; }
      setEvalData(data); setStep('done');
    } catch { setError('Network error. Please try again.'); setStep('error'); }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = evalData as Record<string, any> | null;

  function gaugeMood(pct: number) {
    if (pct >= 75) return { mood: 'great', color: 'var(--green)', label: 'Strong answer!' };
    if (pct >= 50) return { mood: 'ok', color: color, label: 'Decent a few gaps to close.' };
    if (pct >= 30) return { mood: 'meh', color: 'var(--gold)', label: 'Learn from mistakes keep going.' };
    return { mood: 'bad', color: 'var(--red)', label: 'Needs significant work.' };
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)} />
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={handleUpload} style={{
          display: 'flex', alignItems: 'center', gap: '0.45rem',
          background: isPremium ? `${color}18` : 'var(--bg3)',
          border: `1px solid ${color}50`, borderRadius: 6,
          padding: '0.45rem 0.9rem', color: isPremium ? color : 'var(--text3)',
          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
        }}>
          {isPremium ? <><UploadIcon /> Get the Answer Corrected</> : <><LockIcon /> Get the Answer Corrected</>}
        </button>
        {step !== 'idle' && step !== 'ocr' && step !== 'evaluating' && (
          <button onClick={() => { setStep('idle'); setImages([]); setPreviews([]); setTranscript(''); setEvalData(null); setError(''); setPanelOpen(false); }} style={{
            background: 'none', border: '1px solid var(--border2)', borderRadius: 6,
            padding: '0.35rem 0.65rem', color: 'var(--text3)', fontSize: '0.75rem', cursor: 'pointer',
          }}>Re-upload</button>
        )}
        {(step === 'done' || step === 'transcript') && (
          <button onClick={() => setPanelOpen(o => !o)} style={{
            background: 'none', border: '1px solid var(--border2)', borderRadius: 6,
            padding: '0.35rem 0.65rem', color: 'var(--text3)', fontSize: '0.75rem', cursor: 'pointer',
          }}>{panelOpen ? 'Hide' : 'Show'}</button>
        )}
      </div>

      {panelOpen && (
        <div style={{ marginTop: '0.85rem', background: `${color}06`, border: `1px solid ${color}25`, borderRadius: 10, padding: '1.25rem' }}>
          <style>{`@keyframes spin-ai { to { transform: rotate(360deg); } }`}</style>

          {(step === 'ocr' || step === 'evaluating') && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${color}30`, borderTopColor: color, borderRadius: '50%', animation: 'spin-ai 0.8s linear infinite', margin: '0 auto 0.5rem' }} />
              <div style={{ color, fontSize: '0.85rem', fontFamily: 'var(--font-ui)' }}>
                {step === 'ocr' ? ocrMsg || 'Reading your handwriting…' : 'Evaluating your answer… (~30s)'}
              </div>
            </div>
          )}

          {step === 'transcript' && (
            <div>
              {previews.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                  {previews.map((src, i) => (
                    <img key={i} src={src} alt={`Page ${i + 1}`} onClick={() => window.open(src, '_blank')}
                      style={{ height: 64, width: 'auto', borderRadius: 4, border: '1px solid var(--border)', objectFit: 'cover', cursor: 'pointer' }} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>OCR Transcript</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'var(--font-ui)' }}>Review and fix errors before evaluating</div>
                </div>
                <span style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 4, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 600, fontFamily: 'var(--font-ui)' }}><CheckIcon size={10} /> OCR Done</span>
              </div>
              <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={10}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '0.65rem 0.8rem', color: 'var(--text)', fontSize: '0.84rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.65 }} />
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={runEval} style={{ background: color, color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                  Evaluate →
                </button>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div>
              <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: '0.5rem', fontFamily: 'var(--font-ui)' }}>{error}</div>
              {transcript && (
                <div>
                  <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={6}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.75rem', color: 'var(--text)', fontSize: '0.84rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={runEval} style={{ marginTop: '0.5rem', background: color, color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                    Evaluate →
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'done' && d && ((() => {
            const marks_v = d.marks as number ?? 0;
            const out_of = d.marks_out_of as number ?? marks;
            const pct = Math.round((marks_v / out_of) * 100);
            const g = gaugeMood(pct);
            const sm = d.section_marks as Record<string, { awarded: number; out_of: number; reasoning: string }> | undefined;
            return (
              <div style={{ fontSize: '0.85rem', lineHeight: 1.7 }}>
                {/* Score strip */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '0.75rem', background: 'var(--bg3)', borderRadius: 6, marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ color: 'var(--text3)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-ui)' }}>AI Score</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color }}>
                      {marks_v} <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>/ {out_of}</span>
                    </div>
                  </div>
                  {sm && Object.entries(sm).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ color: 'var(--text3)', fontSize: '0.65rem', textTransform: 'capitalize', fontFamily: 'var(--font-ui)' }}>{k}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>{v.awarded}/{v.out_of}</div>
                    </div>
                  ))}
                </div>

                {/* Gauge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', background: 'var(--bg3)', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
                  <MoodIcon mood={g.mood} color={g.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem', fontWeight: 700, color: g.color }}>{marks_v}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)' }}>/{out_of}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text2)', fontFamily: 'var(--font-ui)' }}>{g.label}</span>
                    </div>
                    <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'linear-gradient(90deg, var(--red), var(--gold), var(--green))' }}>
                      <div style={{ position: 'absolute', top: -8, left: `${pct}%`, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid var(--text)', transform: 'translateX(-50%)' }} />
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', background: 'var(--gold-dim)', border: '1px solid rgba(232,184,109,0.25)', borderRadius: 6, padding: '0.6rem 0.8rem', marginBottom: '1rem' }}>
                  <WarnIcon />
                  <div style={{ fontSize: '0.74rem', color: 'var(--text2)', fontFamily: 'var(--font-ui)', lineHeight: 1.55 }}>
                    <strong style={{ color: 'var(--gold)' }}>AI scores are directional, not definitive.</strong>{' '}
                    Focus on the qualitative feedback below demand gaps and missing thinkers are far more useful than any number.
                  </div>
                </div>

                {d.overall_feedback && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem', fontFamily: 'var(--font-ui)' }}>Mentor Feedback</div>
                    <p style={{ color: 'var(--text2)', margin: 0, fontSize: '0.84rem' }}>{String(d.overall_feedback)}</p>
                  </div>
                )}

                {d.body && ((() => {
                  const b = d.body as { strengths?: string[]; weaknesses?: string[] };
                  return (
                    <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 6, padding: '0.6rem 0.75rem' }}>
                        <div style={{ color: 'var(--green)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem', fontFamily: 'var(--font-ui)' }}><CheckIcon size={10} /> Strengths</div>
                        {(b.strengths ?? []).map((s, i) => <div key={i} style={{ color: 'var(--text2)', marginBottom: '0.3rem', fontSize: '0.8rem', lineHeight: 1.5 }}>{s}</div>)}
                      </div>
                      <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 6, padding: '0.6rem 0.75rem' }}>
                        <div style={{ color: 'var(--red)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem', fontFamily: 'var(--font-ui)' }}><CrossIcon size={10} /> Weaknesses</div>
                        {(b.weaknesses ?? []).map((w, i) => <div key={i} style={{ color: 'var(--text2)', marginBottom: '0.3rem', fontSize: '0.8rem', lineHeight: 1.5 }}>{w}</div>)}
                      </div>
                    </div>
                  );
                })() as React.ReactNode)}

                {Array.isArray(d.historians_to_cite) && (d.historians_to_cite as unknown[]).length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color: 'var(--gold)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem', fontFamily: 'var(--font-ui)' }}>
                      {SUBJECTS[subjectId].thinkerTerm === 'anthropologist' ? 'Anthropologists to Cite' : 'Thinkers to Cite'}
                    </div>
                    {(d.historians_to_cite as { name: string; work?: string; argument: string }[]).map((h, i) => (
                      <div key={i} style={{ padding: '0.4rem 0.6rem', background: 'var(--gold-dim)', borderRadius: 4, marginBottom: '0.25rem', borderLeft: `2px solid ${color}60` }}>
                        <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{h.name}</span>
                        {h.work && <span style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: '0.8rem' }}> · {h.work}</span>}
                        <div style={{ color: 'var(--text2)', marginTop: '0.1rem', fontSize: '0.8rem' }}>{h.argument}</div>
                      </div>
                    ))}
                  </div>
                )}

                {d.model_answer && ((() => {
                  const ma = d.model_answer as { introduction?: string; body?: string[]; conclusion?: string };
                  return (
                    <details>
                      <summary style={{ color, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>View Model Answer</summary>
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg3)', borderRadius: 6 }}>
                        {ma.introduction && <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ color: 'var(--text3)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem', fontFamily: 'var(--font-ui)' }}>Introduction</div>
                          <p style={{ color: 'var(--text2)', margin: 0, fontSize: '0.84rem' }}>{ma.introduction}</p>
                        </div>}
                        {Array.isArray(ma.body) && ma.body.map((b, i) => (
                          <div key={i} style={{ paddingLeft: '0.75rem', borderLeft: `2px solid ${color}40`, marginBottom: '0.5rem', color: 'var(--text2)', fontSize: '0.84rem' }}>{b}</div>
                        ))}
                        {ma.conclusion && <div style={{ marginTop: '0.5rem' }}>
                          <div style={{ color: 'var(--text3)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem', fontFamily: 'var(--font-ui)' }}>Conclusion</div>
                          <p style={{ color: 'var(--text2)', margin: 0, fontSize: '0.84rem' }}>{ma.conclusion}</p>
                        </div>}
                      </div>
                    </details>
                  );
                })() as React.ReactNode)}
              </div>
            );
          })() as React.ReactNode)}
        </div>
      )}
    </div>
  );
}

// ─── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({ q, label, isResults, rubric, onRubric, subjectId, isPremium, user }: {
  q: PYQ; label: string; isResults: boolean;
  rubric?: RubricState; onRubric: (r: RubricState) => void;
  subjectId: SubjectId; isPremium: boolean; user: User | null;
}) {
  const { color, dim, border } = SUBJECTS[subjectId];
  const wordTarget = q.marks === 10 ? '~150' : q.marks === 20 ? '~250' : '~200';
  return (
    <div style={{ paddingBottom: '1.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', fontFamily: 'var(--font-ui)', minWidth: '1.4rem' }}>({label})</span>
          <span style={{ background: dim, color, border: `1px solid ${border}`, fontSize: '0.65rem', fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: 3 }}>{q.topic}</span>
          <span style={{ color: 'var(--text3)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>{q.year}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>[{q.marks} Marks]</span>
      </div>

      <p style={{ color: 'var(--text)', fontSize: '0.92rem', lineHeight: 1.75, marginBottom: '0.75rem', fontFamily: 'var(--font-body)' }}>{q.question}</p>

      {!isResults && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg3)', border: '1px dashed var(--border2)', borderRadius: 6, padding: '0.6rem 0.9rem', color: 'var(--text3)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)' }}>
          <span>✏️</span>
          <span>Write your answer on paper · {wordTarget} words</span>
        </div>
      )}

      {isResults && (
        <>
          <RubricScorer marks={q.marks} value={rubric} onChange={onRubric} color={color} />
          <AIMentorPanel question={q.question} marks={q.marks} subjectId={subjectId} isPremium={isPremium} user={user} />
        </>
      )}
    </div>
  );
}

// ─── Compulsory Q1 Block ──────────────────────────────────────────────────────

function CompulsoryBlock({ questions, isResults, rubrics, onRubric, subjectId, isPremium, user, mapEntries }: {
  questions: PYQ[]; isResults: boolean;
  rubrics: Record<number, RubricState>; onRubric: (id: number, r: RubricState) => void;
  subjectId: SubjectId; isPremium: boolean; user: User | null;
  mapEntries?: GeoMapEntry[];
}) {
  const { color, border } = SUBJECTS[subjectId];
  const hasMap = mapEntries && mapEntries.length > 0;
  const mapMarks = hasMap ? 20 : 0;
  const totalPossible = questions.reduce((s, q) => s + q.marks, 0) + mapMarks;
  const totalScored = isResults ? questions.reduce((s, q) => s + (rubrics[q.id] ? rubricTotal(rubrics[q.id]) : 0), 0) : 0;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>Q.1</span>
          <span style={{ fontSize: '0.68rem', color, background: `${color}18`, padding: '1px 6px', borderRadius: 3, border: `1px solid ${border}`, fontFamily: 'var(--font-ui)' }}>COMPULSORY</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>
          {isResults ? `${totalScored.toFixed(1)} / ${totalPossible} Marks` : `${totalPossible} Marks Total`}
        </span>
      </div>
      <div style={{ padding: '1.25rem' }}>
        {hasMap && (
          <MapSubBlock entries={mapEntries!} isResults={isResults} color={color} border={border} />
        )}
        <p style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.25rem', fontFamily: 'var(--font-body)' }}>
          Write short notes on the following in about <strong>150 words</strong> each:
        </p>
        {questions.map((q, i) => (
          <QuestionCard key={q.id} q={q} label={String.fromCharCode(hasMap ? 98 + i : 97 + i)}
            isResults={isResults} rubric={rubrics[q.id]} onRubric={r => onRubric(q.id, r)}
            subjectId={subjectId} isPremium={isPremium} user={user} />
        ))}
      </div>
    </div>
  );
}

// ─── Map Sub-Block — renders as (a) inside CompulsoryBlock ───────────────────

function MapSubBlock({ entries, isResults, color, border }: {
  entries: GeoMapEntry[]; isResults: boolean; color: string; border: string;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [mapScore, setMapScore] = useState(0);

  const toggle = (i: number) => setRevealed(prev => {
    const n = new Set(prev);
    n.has(i) ? n.delete(i) : n.add(i);
    return n;
  });

  return (
    <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>(a)</span>
          <span style={{ fontSize: '0.68rem', color, background: `${color}18`, padding: '1px 6px', borderRadius: 3, border: `1px solid ${border}`, fontFamily: 'var(--font-ui)' }}>MAP · PAPER II</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>
          {isResults ? `${mapScore} / 20 Marks` : '20 Marks · 10 locations × 2M'}
        </span>
      </div>

      <div style={{ padding: '1.25rem' }}>
        <p style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.25rem', fontFamily: 'var(--font-body)' }}>
          On the outline map of India provided to you, mark the location of the following places and write their significance in not more than <strong>30 words</strong> each:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
          {entries.map((e, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div
                onClick={() => isResults && toggle(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.6rem 1rem', cursor: isResults ? 'pointer' : 'default',
                  background: revealed.has(i) ? `${color}10` : 'var(--bg3)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color, fontWeight: 600, minWidth: 20 }}>{i + 1}.</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.88rem', color: 'var(--text)', fontWeight: 500, flex: 1 }}>{e.name}</span>
                <span style={{ fontSize: '0.68rem', color, background: `${color}18`, padding: '1px 6px', borderRadius: 3, border: `1px solid ${border}`, fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}>{e.category}</span>
                {isResults && (
                  <svg viewBox="0 0 12 12" fill="none" stroke="var(--text3)" strokeWidth="1.8" strokeLinecap="round"
                    style={{ width: 12, height: 12, flexShrink: 0, transform: revealed.has(i) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4"/>
                  </svg>
                )}
              </div>
              {isResults && revealed.has(i) && (
                <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-ui)', marginBottom: '0.3rem' }}>
                    Coordinates: {e.lat}°N, {e.lng}°E
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text2)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
                    {e.significance}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {isResults && (
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-ui)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Self-Evaluate: Map Score (20M total · 2M per location)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <input
                type="range" min={0} max={20} step={1} value={mapScore}
                onChange={e => setMapScore(Number(e.target.value))}
                style={{ flex: 1, minWidth: 120, accentColor: color }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color, minWidth: 50, textAlign: 'right' }}>
                {mapScore} / 20
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', fontFamily: 'var(--font-ui)', marginTop: '0.4rem' }}>
              1M correct location on map · 1M significance note (30 words)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Regular Q Block ──────────────────────────────────────────────────────────

function QBlock({ group, isResults, rubrics, onRubric, subjectId, isPremium, user }: {
  group: QGroup; isResults: boolean;
  rubrics: Record<number, RubricState>; onRubric: (id: number, r: RubricState) => void;
  subjectId: SubjectId; isPremium: boolean; user: User | null;
}) {
  const { color, border } = SUBJECTS[subjectId];
  const totalPossible = group.questions.reduce((s, q) => s + q.marks, 0);
  const totalScored = isResults ? group.questions.reduce((s, q) => s + (rubrics[q.id] ? rubricTotal(rubrics[q.id]) : 0), 0) : 0;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>Q.{group.qNum}</span>
          {group.qNum === 5 && (
            <span style={{ fontSize: '0.68rem', color, background: `${color}18`, padding: '1px 6px', borderRadius: 3, border: `1px solid ${border}`, fontFamily: 'var(--font-ui)' }}>COMPULSORY</span>
          )}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>
          {isResults ? `${totalScored.toFixed(1)} / ${totalPossible} Marks` : `${totalPossible} Marks`}
        </span>
      </div>
      <div style={{ padding: '1.25rem' }}>
        {group.questions.map((q, i) => (
          <QuestionCard key={q.id} q={q} label={String.fromCharCode(97 + i)}
            isResults={isResults} rubric={rubrics[q.id]} onRubric={r => onRubric(q.id, r)}
            subjectId={subjectId} isPremium={isPremium} user={user} />
        ))}
      </div>
    </div>
  );
}

// ─── Instructions Header ──────────────────────────────────────────────────────

function InstructionsHeader({ subject, mode, paper, totalMins, maxMarks }: {
  subject: SubjectId; mode: TestMode; paper: PaperChoice; totalMins: number; maxMarks: number;
}) {
  const s = SUBJECTS[subject];
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const timeStr = hrs > 0 ? `${hrs} Hour${hrs > 1 ? 's' : ''}${mins > 0 ? ` ${mins} Minutes` : ''}` : `${totalMins} Minutes`;
  const isFull = mode === 'full';
  const paperLabel = paper === 'both' ? 'Paper I + Paper II' : paper;
  const title = isFull
    ? `${s.label} Optional Full Test (${paperLabel})`
    : `${s.label} Optional Sectional Test (${paperLabel})`;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', marginBottom: '2rem', background: 'var(--bg2)' }}>
      <div style={{ textAlign: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text3)', marginBottom: '0.3rem', fontFamily: 'var(--font-ui)' }}>
          Distilled Crux · Practice Test Series
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem', fontFamily: 'var(--font-ui)' }}>{title}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text2)', fontFamily: 'var(--font-ui)' }}>
            <span style={{ color: 'var(--text3)' }}>Time: </span><strong>{timeStr}</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text2)', fontFamily: 'var(--font-ui)' }}>
            <span style={{ color: 'var(--text3)' }}>Maximum Marks: </span><strong>{maxMarks}</strong>
          </div>
        </div>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text2)', lineHeight: 2, fontFamily: 'var(--font-ui)' }}>
        {isFull ? (
          <>
            <div>There are <strong>EIGHT questions</strong> divided in <strong>TWO SECTIONS</strong>.</div>
            <div>Candidate has to attempt <strong>FIVE questions in all.</strong></div>
            <div>Question Nos. <strong>1 and 5 are compulsory</strong> and out of remaining, <strong>THREE are to be attempted choosing at least ONE from each Section.</strong></div>
          </>
        ) : (
          <>
            <div>There are <strong>FOUR questions</strong> in this section.</div>
            <div>Candidate has to attempt <strong>THREE questions in all.</strong></div>
            <div>Question No. <strong>1 is compulsory</strong> and out of remaining, <strong>TWO are to be attempted.</strong></div>
          </>
        )}
        <div>The number of marks carried by a question/part is indicated against it.</div>
        <div>Word limit in questions, wherever specified, should be adhered to.</div>
      </div>
    </div>
  );
}

// ─── Scroll FAB ───────────────────────────────────────────────────────────────

function ScrollFab({ color }: { color: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const q1 = document.getElementById('q1-anchor');
    if (!q1) return;
    const obs = new IntersectionObserver(([e]) => setHidden(!e.isIntersecting), { threshold: 0 });
    obs.observe(q1);
    return () => obs.disconnect();
  }, []);
  return (
    <>
      <style>{`
        @keyframes bounceY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(5px)} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 8px 2px ${color}40,0 4px 20px rgba(0,0,0,0.4)} 50%{box-shadow:0 0 18px 5px ${color}80,0 4px 20px rgba(0,0,0,0.4)} }
        .dc-fab { animation: glowPulse 2s ease-in-out infinite; transition: opacity 0.3s; }
        .dc-fab.hidden { opacity: 0 !important; pointer-events: none !important; }
      `}</style>
      <button className={`dc-fab${hidden ? ' hidden' : ''}`}
        onClick={() => window.scrollBy({ top: 500, behavior: 'smooth' })}
        style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 50, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', color, border: `1.5px solid ${color}60`, borderRadius: 999, padding: '10px 22px', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '0.82rem', fontWeight: 600 }}>
        <span>Scroll for results</span>
        <svg style={{ animation: 'bounceY 1.2s ease-in-out infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </>
  );
}


// ─── SVG Icon Components ──────────────────────────────────────────────────────

function SubjectIcon({ id, color = 'currentColor', size = 14 }: { id: string; color?: string; size?: number }) {
  const s = { width: size, height: size, display: 'inline-block', verticalAlign: 'middle', marginRight: 4, flexShrink: 0 } as React.CSSProperties;
  if (id === 'sociology') return (
    <svg viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" style={s}>
      <circle cx="5" cy="5" r="2.5"/><circle cx="11" cy="5" r="2.5"/>
      <path d="M1 13c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" strokeLinecap="round"/>
      <path d="M8 10.5c.6-.3 1.3-.5 2-.5 2.2 0 4 1.5 4 3.5" strokeLinecap="round"/>
    </svg>
  );
  if (id === 'anthropology') return (
    <svg viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" style={s}>
      <circle cx="8" cy="5" r="3"/>
      <path d="M4 14c0-2.2 1.8-4 4-4s4 1.8 4 4" strokeLinecap="round"/>
      <path d="M6 5h4M8 3v4" strokeLinecap="round"/>
    </svg>
  );
  if (id === 'psir') return (
    <svg viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" style={s}>
      <path d="M8 2v12M2 8h12" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="5.5"/>
    </svg>
  );
  if (id === 'geography') return (
    <svg viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" style={s}>
      <circle cx="8" cy="8" r="6"/>
      <path d="M2 8h12M8 2c-2 2-3 4-3 6s1 4 3 6M8 2c2 2 3 4 3 6s-1 4-3 6" strokeLinecap="round"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" style={s}>
      <rect x="2" y="6" width="12" height="8" rx="1"/>
      <path d="M5 6V4a3 3 0 0 1 6 0v2" strokeLinecap="round"/>
      <line x1="8" y1="10" x2="8" y2="12" strokeLinecap="round"/>
    </svg>
  );
}

function MoodIcon({ mood, color }: { mood: string; color: string }) {
  const s = { width: 24, height: 24, flexShrink: 0 } as React.CSSProperties;
  if (mood === 'great') return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={s}>
      <circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round"/>
      <circle cx="9" cy="10" r="1" fill={color}/><circle cx="15" cy="10" r="1" fill={color}/>
    </svg>
  );
  if (mood === 'ok') return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={s}>
      <circle cx="12" cy="12" r="9"/><line x1="9" y1="14" x2="15" y2="14" strokeLinecap="round"/>
      <circle cx="9" cy="10" r="1" fill={color}/><circle cx="15" cy="10" r="1" fill={color}/>
    </svg>
  );
  if (mood === 'meh') return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={s}>
      <circle cx="12" cy="12" r="9"/><path d="M9 15s1-1 3-1 3 1 3 1" strokeLinecap="round"/>
      <circle cx="9" cy="10" r="1" fill={color}/><circle cx="15" cy="10" r="1" fill={color}/>
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={s}>
      <circle cx="12" cy="12" r="9"/><path d="M9 16s1.5-2 3-2 3 2 3 2" strokeLinecap="round"/>
      <circle cx="9" cy="10" r="1" fill={color}/><circle cx="15" cy="10" r="1" fill={color}/>
    </svg>
  );
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle', marginRight: 3 }}>
      <polyline points="2 6 5 9 10 3"/>
    </svg>
  );
}

function CrossIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle', marginRight: 3 }}>
      <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }}>
      <path d="M10 2L2 17h16L10 2z"/>
      <line x1="10" y1="8" x2="10" y2="12"/><circle cx="10" cy="15" r="0.8" fill="var(--gold)" stroke="none"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle', marginRight: 5 }}>
      <path d="M8 10V3M5 6l3-3 3 3"/><path d="M3 13h10"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle', marginRight: 5 }}>
      <rect x="3" y="8" width="10" height="7" rx="1.5"/>
      <path d="M5 8V6a3 3 0 0 1 6 0v2"/>
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ width: 15, height: 15, flexShrink: 0 }}>
      <rect x="2" y="2" width="12" height="12" rx="1.5"/>
      <line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="9" y2="9"/>
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function TestPageInner() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);

  const [phase, setPhase] = useState<Phase>('config');
  // Pre-select from ?optional= URL param if valid
  const urlOptional = searchParams.get('optional');
  const urlSubject = urlOptional && urlOptional in OPTIONAL_TO_SUBJECT ? OPTIONAL_TO_SUBJECT[urlOptional] : null;
  const [subject, setSubject] = useState<SubjectId>(urlSubject && SUBJECTS[urlSubject].dataFile ? urlSubject : 'sociology');
  const [paper, setPaper] = useState<PaperChoice>('Paper I');
  const [mode, setMode] = useState<TestMode>('sectional');

  const [pyqs, setPyqs] = useState<PYQ[]>([]);
  const [loading, setLoading] = useState(false);

  const [includeMapQ, setIncludeMapQ] = useState(false);
  const [mapEntries, setMapEntries] = useState<GeoMapEntry[]>([]);

  const [compQ, setCompQ] = useState<PYQ[]>([]);
  const [groups, setGroups] = useState<QGroup[]>([]);

  const [rubrics, setRubrics] = useState<Record<number, RubricState>>({});
  const [timerOn, setTimerOn] = useState(false);

  const [navH, setNavH] = useState(60);

  // Auth
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await user.getIdToken();
        const r = await fetch('/api/user-profile', { headers: { 'x-user-token': token } });
        if (r.ok) {
          const d = await r.json();
          setIsPremium(!!d.subscribed);
          const mapped = OPTIONAL_TO_SUBJECT[d.optional as string];
          if (mapped && SUBJECTS[mapped].dataFile) setSubject(mapped);
        }
      } catch { /* ignore */ }
    })();
  }, [user]);

  // Nav height
  useEffect(() => {
    const nav = document.querySelector('nav, header') as HTMLElement | null;
    if (nav) setNavH(nav.offsetHeight);
  }, []);

  // Load PYQs when subject changes
  useEffect(() => {
    const meta = SUBJECTS[subject];
    if (subject !== 'geography') setIncludeMapQ(false);
    if (!meta.dataFile) { setPyqs([]); return; }
    setLoading(true);
    fetch(meta.dataFile)
      .then(r => r.json())
      .then(d => { setPyqs(d); setLoading(false); })
      .catch(() => { setPyqs([]); setLoading(false); });
  }, [subject]);

  // Timing
  const totalMins = mode === 'full' ? 180 : 105;
  const maxMarks = mode === 'full' ? 250 : 150;
  function handleSubmit() { setTimerOn(false); setPhase('results'); }
  const { rem, display } = useTimer(totalMins * 60, timerOn, handleSubmit);
  const urgency = rem < 300;

  const subMeta = SUBJECTS[subject];

  function getPool(): PYQ[] {
    if (paper === 'both') return pyqs;
    return pyqs.filter(q => q.paper === paper);
  }

  function startTest() {
    const pool = getPool();
    const q1 = buildCompulsoryQ(pool, includeMapQ && subject === 'geography' ? 4 : 5);
    const g2 = buildQGroup(pool, 2);
    const g3 = buildQGroup(pool, 3);
    const g4 = buildQGroup(pool, 4);

    setCompQ(q1);
    setGroups(mode === 'full'
      ? [g2, g3, g4, buildQGroup(pool, 5), buildQGroup(pool, 6), buildQGroup(pool, 7), buildQGroup(pool, 8)]
      : [g2, g3, g4]);

    // Pick 10 random map entries (unique names)
    if (includeMapQ && subject === 'geography') {
      const seen = new Set<string>();
      const pool10 = shuffle(geoMapData).filter(e => {
        if (seen.has(e.name)) return false;
        seen.add(e.name); return true;
      }).slice(0, 10);
      setMapEntries(pool10);
    } else {
      setMapEntries([]);
    }

    setRubrics({});
    setTimerOn(true);
    setPhase('test');
  }

  const hasData = pyqs.length > 0 && !loading;
  const canStart = hasData;

  // ── CONFIG ─────────────────────────────────────────────────────────────────

  if (phase === 'config') {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '2.5rem 1.5rem 6rem' }}>
        <style>{`
          .dc-sub-btn { transition: all 0.15s; }
          .dc-sub-btn:hover { filter: brightness(1.1); }
          .dc-mode-btn { transition: all 0.15s; }
          .dc-mode-btn:hover { border-color: var(--border3) !important; }
        `}</style>

        <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text3)', marginBottom: '0.5rem' }}>Distilled Crux · Practice</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.3rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          Start a Test
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '2.5rem', fontFamily: 'var(--font-ui)' }}>
          Questions drawn from the full PYQ bank (2013-2024). Papers follow the exact UPSC Mains format.
        </p>

        {/* Subject selector */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ color: 'var(--text3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', fontFamily: 'var(--font-ui)' }}>Optional Subject</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {(Object.entries(SUBJECTS) as [SubjectId, typeof SUBJECTS[SubjectId]][]).map(([id, s]) => {
              const active = subject === id;
              const noData = !s.dataFile;
              return (
                <button key={id} className="dc-sub-btn"
                  onClick={() => { if (!noData) setSubject(id); }}
                  style={{
                    padding: '0.5rem 1rem', borderRadius: 20, fontFamily: 'var(--font-ui)', fontSize: '0.85rem',
                    border: active ? `1.5px solid ${s.color}` : '1px solid var(--border)',
                    background: active ? s.dim : 'var(--bg2)',
                    color: active ? s.color : noData ? 'var(--text3)' : 'var(--text2)',
                    fontWeight: active ? 600 : 400,
                    cursor: noData ? 'not-allowed' : 'pointer',
                    opacity: noData ? 0.4 : 1,
                  }}>
                  <SubjectIcon id={id} color={active ? s.color : 'var(--text3)'} /> {s.label}{noData ? ' (soon)' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Paper selector */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ color: 'var(--text3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', fontFamily: 'var(--font-ui)' }}>Paper</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['Paper I', 'Paper II', 'both'] as PaperChoice[]).map(p => {
              const active = paper === p;
              return (
                <button key={p} className="dc-mode-btn"
                  onClick={() => setPaper(p)}
                  style={{
                    flex: 1, minWidth: 100, padding: '0.75rem 1rem', borderRadius: 8, fontFamily: 'var(--font-ui)', fontSize: '0.85rem', textAlign: 'left',
                    border: active ? `1.5px solid ${subMeta.color}` : '1px solid var(--border)',
                    background: active ? subMeta.dim : 'var(--bg2)',
                    color: active ? 'var(--text)' : 'var(--text2)',
                    fontWeight: active ? 600 : 400, cursor: 'pointer',
                  }}>
                  {p === 'both' ? 'Both Papers' : p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map question toggle — geography only, Paper II or both */}
        {subject === 'geography' && (paper === 'Paper II' || paper === 'both') && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ color: 'var(--text3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', fontFamily: 'var(--font-ui)' }}>Map Question</div>
            <button
              onClick={() => setIncludeMapQ(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                padding: '0.75rem 1rem', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                border: includeMapQ ? `1.5px solid ${subMeta.color}` : '1px solid var(--border)',
                background: includeMapQ ? subMeta.dim : 'var(--bg2)',
              }}>
              <div style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: includeMapQ ? `2px solid ${subMeta.color}` : '2px solid var(--border3)',
                background: includeMapQ ? subMeta.color : 'transparent',
              }}>
                {includeMapQ && (
                  <svg viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                    <polyline points="1.5 5 4 7.5 8.5 2.5"/>
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: includeMapQ ? 600 : 400, color: includeMapQ ? 'var(--text)' : 'var(--text2)', fontFamily: 'var(--font-ui)' }}>
                  Include Map Question (Q.1a · Paper II)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '0.1rem', fontFamily: 'var(--font-ui)' }}>
                  10 locations · 20 marks · self-eval rubric + significance reveal
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Mode selector */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ color: 'var(--text3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', fontFamily: 'var(--font-ui)' }}>Test Format</div>
          {([
            { id: 'sectional' as TestMode, title: 'Sectional Test', sub: '105 min · 150 marks · 4 questions', desc: 'Q1 compulsory + attempt 2 of 3 remaining. Focused practice.' },
            { id: 'full'      as TestMode, title: 'Full-Length Test', sub: '3 hours · 250 marks · 8 questions',  desc: 'Complete paper Q1 & Q5 compulsory + 3 more.' },
          ]).map(m => (
            <button key={m.id} className="dc-mode-btn"
              onClick={() => setMode(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem', width: '100%',
                padding: '0.85rem 1.1rem', borderRadius: 8, textAlign: 'left',
                border: mode === m.id ? `1.5px solid ${subMeta.color}` : '1px solid var(--border)',
                background: mode === m.id ? subMeta.dim : 'var(--bg2)',
                cursor: 'pointer', marginBottom: '0.5rem',
              }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                border: mode === m.id ? `2px solid ${subMeta.color}` : '2px solid var(--border3)',
                background: mode === m.id ? subMeta.color : 'transparent' }} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: mode === m.id ? 600 : 400, color: mode === m.id ? 'var(--text)' : 'var(--text2)', fontFamily: 'var(--font-ui)' }}>
                  {m.title}<span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 400 }}>{m.sub}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '0.1rem', fontFamily: 'var(--font-ui)' }}>{m.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Info banner */}
        <div style={{ background: 'var(--gold-dim)', border: '1px solid rgba(232,184,109,0.2)', borderRadius: 8, padding: '0.7rem 1rem', marginBottom: '1.75rem', color: 'var(--text2)', fontSize: '0.8rem', display: 'flex', gap: '0.5rem', fontFamily: 'var(--font-ui)' }}>
          <NoteIcon />
          <span>
            Q1 is always compulsory 5 short notes (10M each = 50M). Remaining questions are 2×20M + 1×10M each.
            {includeMapQ && ' · Map Q.1(a) adds 10 locations × 2M = 20M (Paper II compulsory).'}
          </span>
        </div>

        {/* Start button */}
        <button
          onClick={() => {
            if (!user) { alert('Please sign in to start a test.'); return; }
            if (!canStart) return;
            startTest();
          }}
          style={{
            background: canStart ? subMeta.color : 'var(--bg3)',
            color: canStart ? '#fff' : 'var(--text3)',
            border: 'none', borderRadius: 8, padding: '0.9rem 2.5rem',
            fontSize: '0.95rem', fontWeight: 600, cursor: canStart ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-ui)', transition: 'filter 0.15s',
          }}
          onMouseOver={e => { if (canStart) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)'; }}
          onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.filter = ''; }}
        >
          {loading ? 'Loading PYQs…' : 'Begin Test →'}
        </button>

        {!user && (
          <p style={{ marginTop: '0.75rem', color: 'var(--text3)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)' }}>
            <a href="/login" style={{ color: subMeta.color, textDecoration: 'none' }}>Sign in</a> to generate a test paper.
          </p>
        )}
      </div>
    );
  }

  // ── TEST PHASE ──────────────────────────────────────────────────────────────

  if (phase === 'test') {
    const progressPct = ((totalMins * 60 - rem) / (totalMins * 60)) * 100;
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1.5rem 6rem' }}>
        {/* Sticky timer */}
        <div style={{ position: 'sticky', top: navH, zIndex: 90, background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '0.6rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontFamily: 'var(--font-ui)' }}>
              <span style={{ color: 'var(--text3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                <SubjectIcon id={subject} color={subMeta.color} /> {subMeta.label} {mode === 'full' ? 'Full Test' : 'Sectional'}
              </span>
              <span style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>· {maxMarks}M</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: urgency ? 'var(--red)' : 'var(--text)' }}>
                {display}
              </span>
              <button onClick={handleSubmit} style={{ background: '#e05c2a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                Submit
              </button>
            </div>
          </div>
          <div style={{ height: 2, background: 'var(--border)', marginTop: '0.5rem', borderRadius: 1 }}>
            <div style={{ height: '100%', borderRadius: 1, width: `${progressPct}%`, background: urgency ? 'var(--red)' : subMeta.color, transition: 'width 1s linear, background 0.3s' }} />
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <InstructionsHeader subject={subject} mode={mode} paper={paper} totalMins={totalMins} maxMarks={maxMarks} />
        </div>

        <div id="q1-anchor">
          <CompulsoryBlock questions={compQ} isResults={false} rubrics={rubrics} onRubric={() => {}} subjectId={subject} isPremium={isPremium} user={user} mapEntries={mapEntries.length > 0 ? mapEntries : undefined} />
        </div>

        {groups.map(g => (
          <QBlock key={g.qNum} group={g} isResults={false} rubrics={rubrics} onRubric={() => {}} subjectId={subject} isPremium={isPremium} user={user} />
        ))}
      </div>
    );
  }

  // ── RESULTS PHASE ───────────────────────────────────────────────────────────

  if (phase === 'results') {
    const allQs = [...compQ, ...groups.flatMap(g => g.questions)];
    const written = allQs.reduce((s, q) => s + (rubrics[q.id] ? rubricTotal(rubrics[q.id]) : 0), 0);
    const pct = Math.round((written / maxMarks) * 100);

    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>Test Results</h1>
        <p style={{ color: 'var(--text2)', fontSize: '0.88rem', marginBottom: '2rem', fontFamily: 'var(--font-ui)' }}>
          Use the rubric sliders to self-evaluate. Premium users can upload answer images for AI Mentor evaluation.
        </p>

        <ScrollFab color={subMeta.color} />

        {/* Score card */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>Self Score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: subMeta.color }}>{written.toFixed(1)}</span>
              <span style={{ color: 'var(--text3)', fontSize: '0.88rem', fontFamily: 'var(--font-ui)' }}>/ {maxMarks}</span>
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>Time Used</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{Math.floor((totalMins * 60 - rem) / 60)}m</div>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4 }}>
              <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(pct, 100)}%`, background: pct >= 60 ? 'var(--green)' : pct >= 40 ? 'var(--gold)' : 'var(--red)', transition: 'width 1s' }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--font-ui)' }}>{pct}% of total marks</div>
          </div>
        </div>

        <div id="q1-anchor">
          <CompulsoryBlock questions={compQ} isResults={true} rubrics={rubrics} onRubric={(id, r) => setRubrics(p => ({ ...p, [id]: r }))} subjectId={subject} isPremium={isPremium} user={user} mapEntries={mapEntries.length > 0 ? mapEntries : undefined} />
        </div>

        {groups.map(g => (
          <QBlock key={g.qNum} group={g} isResults={true} rubrics={rubrics} onRubric={(id, r) => setRubrics(p => ({ ...p, [id]: r }))} subjectId={subject} isPremium={isPremium} user={user} />
        ))}

        <div style={{ textAlign: 'center', marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setPhase('config')} style={{ background: subMeta.color, color: '#fff', border: 'none', borderRadius: 8, padding: '0.85rem 2rem', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            Start Another Test
          </button>
          <button onClick={() => window.location.href = `/${subject}`} style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 2rem', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            Back to {subMeta.label}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function TestPage() {
  return (
    <Suspense fallback={null}>
      <TestPageInner />
    </Suspense>
  );
}
