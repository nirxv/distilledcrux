'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import type { User } from 'firebase/auth';
import { geoMapData, GeoMapEntry } from '@/lib/geoMapData';
import SubjectIcon from '@/components/SubjectIcon';
import OwlLoader from '@/components/OwlLoader';
import { toAnswerPages } from '@/lib/answerImages';
import { clearRefreshSafe, useRefreshSafe } from '@/hooks/useRefreshSafe';

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

/** One numbered question: short notes (Q1, Q5) or three sub-parts. */
interface QBlockData {
  qNum: number;
  compulsory: boolean;
  shortNotes: boolean;
  questions: PYQ[];
}

interface RubricState {
  intro: number;
  body: number;
  conc: number;
  pres: number;
}

// ─── Subject meta ─────────────────────────────────────────────────────────────

const SUBJECTS: Record<SubjectId, { label: string; optional: string; dataFile: string }> = {
  sociology:    { label: 'Sociology',             optional: 'sociology',             dataFile: '/data/sociology-pyqs.json' },
  anthropology: { label: 'Anthropology',          optional: 'anthropology',          dataFile: '/data/anthropology-pyqs.json' },
  polsci:       { label: 'PSIR',                  optional: 'political-science',     dataFile: '/data/psir-pyqs.json' },
  geography:    { label: 'Geography',             optional: 'geography',             dataFile: '/data/geography-pyqs.json' },
  'pub-admin':  { label: 'Public Administration', optional: 'public-administration', dataFile: '/data/pubad-pyqs.json' },
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

// ─── Building a paper ─────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The UPSC optional paper: Q1 and Q5 compulsory, each five short notes of
 * ten marks (Geography Paper II's Q1 carries the map instead of two of
 * them); every other question three parts, 20 + 20 + 10. A sectional test is
 * Section A alone.
 *
 * One set of used ids runs across the whole paper. Each block used to keep
 * its own, so the same question could turn up twice; Q5 was built like an
 * ordinary question though the paper called it compulsory; and with the map,
 * Q1 came to 60 marks.
 */
function buildPaper(pool: PYQ[], mode: TestMode, withMap: boolean): QBlockData[] {
  const used = new Set<number>();
  const take = (marks: number, n: number) => {
    const picked = shuffle(pool.filter(q => q.marks === marks && !used.has(q.id))).slice(0, n);
    picked.forEach(q => used.add(q.id));
    return picked;
  };
  const notes = (qNum: number, count: number): QBlockData => ({ qNum, compulsory: true, shortNotes: true, questions: take(10, count) });
  const parts = (qNum: number): QBlockData => ({ qNum, compulsory: false, shortNotes: false, questions: [...take(20, 2), ...take(10, 1)] });

  const sectionA = [notes(1, withMap ? 3 : 5), parts(2), parts(3), parts(4)];
  if (mode === 'sectional') return sectionA;
  return [...sectionA, notes(5, 5), parts(6), parts(7), parts(8)];
}

// ─── Timer ────────────────────────────────────────────────────────────────────

/**
 * Counts down to a fixed end time rather than ticking a number down once a
 * second. A refresh mid-test restores the same deadline, so the clock carries
 * on from where it was instead of restarting at the full time, and a tab the
 * browser throttled in the background still shows the true time left.
 * endedAt freezes it on submit, for the time-used figure in the results.
 */
function useTimer(totalSec: number, deadline: number | null, endedAt: number | null, onEnd: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; });
  const running = deadline !== null && endedAt === null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  const rem = deadline === null ? totalSec : Math.max(0, Math.ceil((deadline - (endedAt ?? now)) / 1000));
  useEffect(() => { if (running && rem === 0) onEndRef.current(); }, [running, rem]);
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  return { rem, display: fmt(rem) };
}

// ─── Self-marking ─────────────────────────────────────────────────────────────

function RubricScorer({ marks, value, onChange }: {
  marks: number;
  value?: RubricState;
  onChange: (r: RubricState) => void;
}) {
  const out = rubricOutOf(marks);
  const cur = value ?? { intro: 0, body: 0, conc: 0, pres: 0 };
  const total = rubricTotal(cur);
  const criteria = [
    { key: 'intro' as const, label: 'Introduction', desc: 'A framing and a named thinker', max: out.intro },
    { key: 'body'  as const, label: 'Body',          desc: 'Arguments, evidence, thinkers cited', max: out.body  },
    { key: 'conc'  as const, label: 'Conclusion',    desc: 'A synthesis and a clear position', max: out.conc  },
    { key: 'pres'  as const, label: 'Presentation',  desc: 'Structure, length, legibility', max: out.pres  },
  ];
  return (
    <div className="ts-rubric">
      <div className="ts-rubric-head">
        <span>Mark it yourself</span>
        <span className="ts-rubric-total">{total.toFixed(1)} / {marks}</span>
      </div>
      {criteria.map(c => (
        <label key={c.key} className="ts-rubric-row">
          <span className="ts-rubric-label">
            <strong>{c.label}</strong>
            <span>{c.desc}</span>
          </span>
          <input type="range" min={0} max={c.max} step={0.5} value={cur[c.key]}
            onChange={e => onChange({ ...cur, [c.key]: parseFloat(e.target.value) })}
            aria-label={`${c.label}, out of ${c.max}`} />
          <span className="ts-rubric-val">{cur[c.key].toFixed(1)} / {c.max}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Answer correction (Premium) ─────────────────────────────────────────────

type OcrStep = 'idle' | 'ocr' | 'transcript' | 'evaluating' | 'done' | 'error';

function AIMentorPanel({ question, marks, subjectId, isPremium, user, onSignIn }: {
  question: string; marks: number; subjectId: SubjectId;
  isPremium: boolean; user: User | null; onSignIn: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<OcrStep>('idle');
  const [images, setImages] = useState<File[]>([]);
  const [transcript, setTranscript] = useState('');
  const [evalData, setEvalData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  // A transcript or an evaluation is a paid step; a refresh should not throw
  // it away. Kept per question for the tab. Photos cannot be kept, so only a
  // finished transcript or result comes back, never a half-run upload.
  useRefreshSafe(
    `dc_test_mentor_v1:${marks}:${question.slice(0, 120)}`,
    { step: step === 'transcript' || step === 'done' ? step : 'idle' as OcrStep, transcript, evalData },
    (m) => { setStep(m.step); setTranscript(m.transcript); setEvalData(m.evalData); },
  );

  function handleUpload() {
    if (!user) { onSignIn(); return; }
    if (!isPremium) { window.location.href = '/pricing'; return; }
    fileRef.current?.click();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setStep('ocr');
    setError(''); setTranscript(''); setEvalData(null);
    try {
      const pages = await toAnswerPages(Array.from(files));
      setImages(pages);
      const token = await user?.getIdToken() ?? '';
      const fd = new FormData();
      pages.forEach((f, i) => fd.append('files', f, `page-${i + 1}.jpg`));
      const r = await fetch('/api/ocr', { method: 'POST', headers: { 'x-user-token': token }, body: fd });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || 'We could not read the page.');
      setTranscript(data.text ?? '');
      setStep('transcript');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'We could not read the page.');
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
      images.forEach((f, i) => fd.append('files', f, `page-${i + 1}.jpg`));
      fd.append('question', question);
      fd.append('marks', String(marks));
      fd.append('extractedText', transcript);
      fd.append('subject', subjectId);
      const r = await fetch('/api/evaluate', { method: 'POST', headers: { 'x-user-token': token }, body: fd });
      const data = await r.json();
      if (!r.ok || data.error) { setError(data.error === 'limit_reached' ? 'Your free evaluation is used. Premium checks every answer.' : data.error || 'The evaluation failed.'); setStep('error'); return; }
      setEvalData(data); setStep('done');
    } catch { setError('The connection dropped. Please try again.'); setStep('error'); }
  }

  const reset = () => { setStep('idle'); setImages([]); setTranscript(''); setEvalData(null); setError(''); };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = evalData as Record<string, any> | null;
  // The evaluate route names this thinkers_to_cite; the panel read the
  // history site's historians_to_cite, so no suggestion was ever shown.
  const thinkers = (d?.thinkers_to_cite ?? d?.historians_to_cite ?? []) as { name: string; work?: string; argument: string }[];

  return (
    <div className="ts-mentor">
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
      {step === 'idle' && (
        <button type="button" className={`ds-btn ds-btn-sm ${isPremium ? 'ds-btn-line' : 'ds-btn-ghost'} ts-mentor-btn`} onClick={handleUpload}>
          {isPremium ? (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>Have this answer checked</>
          ) : (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>Have it checked with Premium</>
          )}
        </button>
      )}

      {(step === 'ocr' || step === 'evaluating') && (
        <div className="ts-mentor-wait">
          <OwlLoader size="small" label={step === 'ocr' ? 'Reading your page' : 'Marking your answer'} />
          <span>{step === 'ocr' ? 'Reading your page…' : 'Marking your answer, usually under a minute…'}</span>
        </div>
      )}

      {(step === 'transcript' || (step === 'error' && transcript)) && (
        <div className="ts-mentor-card">
          {error && <p className="ts-err">{error}</p>}
          <div className="ts-mentor-title">Check what we read</div>
          <p className="ts-mentor-sub">Fix any name or date the reader got wrong; this text is what gets marked.</p>
          <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={8} className="ts-textarea" />
          <div className="ts-mentor-actions">
            <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={reset}>Upload again</button>
            <button type="button" className="ds-btn ds-btn-solid ds-btn-sm" onClick={runEval}>Mark this answer</button>
          </div>
        </div>
      )}

      {step === 'error' && !transcript && (
        <div className="ts-mentor-card">
          <p className="ts-err">{error}</p>
          <button type="button" className="ds-btn ds-btn-line ds-btn-sm" onClick={reset}>Try again</button>
        </div>
      )}

      {step === 'done' && d && (() => {
        const got = Number(d.marks ?? 0);
        const outOf = Number(d.marks_out_of ?? marks);
        const sm = d.section_marks as Record<string, { awarded: number; out_of: number }> | undefined;
        const body = d.body as { strengths?: string[]; weaknesses?: string[] } | undefined;
        const ma = d.model_answer as { introduction?: string; body?: string[]; conclusion?: string } | undefined;
        return (
          <div className="ts-mentor-card">
            <div className="ts-mentor-score">
              <div><span className="ts-score-num">{got}</span><span className="ts-score-of"> / {outOf}</span></div>
              {sm && (
                <div className="ts-score-parts">
                  {Object.entries(sm).map(([k, v]) => <span key={k}><b>{k}</b> {v.awarded}/{v.out_of}</span>)}
                </div>
              )}
            </div>
            <p className="ts-mentor-note">The number is a guide; the feedback is the useful part.</p>
            {d.overall_feedback && <p className="ts-mentor-feedback">{String(d.overall_feedback)}</p>}
            {body && (
              <div className="ts-cols">
                <div>
                  <div className="ts-col-title good">What worked</div>
                  <ul className="ts-points good">{(body.strengths ?? []).map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
                <div>
                  <div className="ts-col-title fix">What to fix</div>
                  <ul className="ts-points fix">{(body.weaknesses ?? []).map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              </div>
            )}
            {thinkers.length > 0 && (
              <div className="ts-thinkers">
                <div className="ts-col-title">Thinkers you could cite</div>
                {thinkers.map((h, i) => (
                  <div key={i} className="ts-thinker"><strong>{h.name}</strong>{h.work && <span> · {h.work}</span>}<p>{h.argument}</p></div>
                ))}
              </div>
            )}
            {ma && (ma.introduction || ma.body?.length) && (
              <details className="ts-model">
                <summary>See a model answer</summary>
                {ma.introduction && <p>{ma.introduction}</p>}
                {Array.isArray(ma.body) && ma.body.map((b, i) => <p key={i} className="ts-model-point">{b}</p>)}
                {ma.conclusion && <p>{ma.conclusion}</p>}
              </details>
            )}
            <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={reset}>Check a different answer</button>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Questions ────────────────────────────────────────────────────────────────

function QuestionCard({ q, label, isResults, rubric, onRubric, subjectId, isPremium, user, onSignIn }: {
  q: PYQ; label: string; isResults: boolean;
  rubric?: RubricState; onRubric: (r: RubricState) => void;
  subjectId: SubjectId; isPremium: boolean; user: User | null; onSignIn: () => void;
}) {
  const words = q.marks === 10 ? 150 : 250;
  return (
    <div className="ts-q">
      <div className="ts-q-top">
        <span className="ts-q-label">({label})</span>
        <span className="ts-q-marks">{q.marks} marks</span>
      </div>
      <p className="ts-q-text">{q.question}</p>
      <div className="ts-q-meta">
        <span className="ts-q-topic">{q.topic}</span>
        <span>{q.year}</span>
        {!isResults && <span>Write on paper, about {words} words</span>}
      </div>
      {isResults && (
        <>
          <RubricScorer marks={q.marks} value={rubric} onChange={onRubric} />
          <AIMentorPanel question={q.question} marks={q.marks} subjectId={subjectId} isPremium={isPremium} user={user} onSignIn={onSignIn} />
        </>
      )}
    </div>
  );
}

function MapPart({ entries, isResults, score, onScore }: {
  entries: GeoMapEntry[]; isResults: boolean; score: number; onScore: (n: number) => void;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setRevealed(prev => {
    const n = new Set(prev);
    if (n.has(i)) n.delete(i); else n.add(i);
    return n;
  });

  return (
    <div className="ts-q">
      <div className="ts-q-top">
        <span className="ts-q-label">(a)</span>
        <span className="ts-q-marks">20 marks</span>
      </div>
      <p className="ts-q-text">On the outline map of India, mark the location of the following places and write their significance in not more than 30 words each:</p>
      <div className="ts-places">
        {entries.map((e, i) => (
          <div key={i} className={`ts-place${revealed.has(i) ? ' open' : ''}`}>
            <button type="button" className="ts-place-row" onClick={() => isResults && toggle(i)} disabled={!isResults} aria-expanded={isResults ? revealed.has(i) : undefined}>
              <span className="ts-place-n">{i + 1}</span>
              <span className="ts-place-name">{e.name}</span>
              <span className="ts-place-cat">{e.category}</span>
              {isResults && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="ts-place-chev"><path d="M6 9l6 6 6-6" /></svg>}
            </button>
            {isResults && revealed.has(i) && (
              <div className="ts-place-more">
                <span>{e.lat}°N, {e.lng}°E</span>
                <p>{e.significance}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {isResults && (
        <label className="ts-map-score">
          <span>Your map mark <small>1 for each place marked right, 1 for each note</small></span>
          <input type="range" min={0} max={20} step={1} value={score} onChange={e => onScore(Number(e.target.value))} aria-label="Map mark out of 20" />
          <strong>{score} / 20</strong>
        </label>
      )}
    </div>
  );
}

function QBlock({ block, isResults, rubrics, onRubric, subjectId, isPremium, user, onSignIn, mapEntries, mapScore, onMapScore }: {
  block: QBlockData; isResults: boolean;
  rubrics: Record<number, RubricState>; onRubric: (id: number, r: RubricState) => void;
  subjectId: SubjectId; isPremium: boolean; user: User | null; onSignIn: () => void;
  mapEntries?: GeoMapEntry[]; mapScore: number; onMapScore: (n: number) => void;
}) {
  const withMap = Boolean(mapEntries && mapEntries.length);
  const totalPossible = block.questions.reduce((s, q) => s + q.marks, 0) + (withMap ? 20 : 0);
  const totalScored = block.questions.reduce((s, q) => s + (rubrics[q.id] ? rubricTotal(rubrics[q.id]) : 0), 0) + (withMap ? mapScore : 0);
  return (
    <section className="ts-block">
      <div className="ts-block-head">
        <h3>Question {block.qNum}</h3>
        {block.compulsory && <span className="ts-chip">Compulsory</span>}
        <span className="ts-block-marks">{isResults ? `${totalScored.toFixed(1)} / ${totalPossible}` : `${totalPossible} marks`}</span>
      </div>
      {block.shortNotes && (
        <p className="ts-block-lead">{withMap ? 'Answer all parts.' : 'Write short notes on the following in about 150 words each:'}</p>
      )}
      {withMap && <MapPart entries={mapEntries!} isResults={isResults} score={mapScore} onScore={onMapScore} />}
      {withMap && <p className="ts-block-lead">Write short notes on the following in about 150 words each:</p>}
      {block.questions.map((q, i) => (
        <QuestionCard key={q.id} q={q} label={String.fromCharCode((withMap ? 98 : 97) + i)}
          isResults={isResults} rubric={rubrics[q.id]} onRubric={r => onRubric(q.id, r)}
          subjectId={subjectId} isPremium={isPremium} user={user} onSignIn={onSignIn} />
      ))}
    </section>
  );
}

function PaperHeader({ subject, mode, paper, totalMins, maxMarks }: {
  subject: SubjectId; mode: TestMode; paper: PaperChoice; totalMins: number; maxMarks: number;
}) {
  const s = SUBJECTS[subject];
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const timeStr = hrs > 0 ? `${hrs} hour${hrs > 1 ? 's' : ''}${mins > 0 ? ` ${mins} minutes` : ''}` : `${totalMins} minutes`;
  const isFull = mode === 'full';
  const paperLabel = paper === 'both' ? 'Paper I and II' : paper;
  return (
    <div className="ts-paper">
      <div className="ts-paper-title">{s.label} optional · {isFull ? 'Full test' : 'Sectional test'} · {paperLabel}</div>
      <div className="ts-paper-facts">
        <span>Time allowed: <strong>{timeStr}</strong></span>
        <span>Maximum marks: <strong>{maxMarks}</strong></span>
      </div>
      <ul className="ts-paper-rules">
        {isFull ? (
          <>
            <li>There are <strong>eight</strong> questions in <strong>two sections</strong>. Attempt <strong>five</strong> in all.</li>
            <li>Questions <strong>1 and 5 are compulsory</strong>. Of the rest, attempt <strong>three</strong>, at least one from each section.</li>
          </>
        ) : (
          <>
            <li>There are <strong>four</strong> questions. Attempt <strong>three</strong> in all.</li>
            <li>Question <strong>1 is compulsory</strong>. Of the rest, attempt <strong>two</strong>.</li>
          </>
        )}
        <li>The marks for each question or part are shown against it. Keep to the word limits.</li>
      </ul>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function TestPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [isPremium, setIsPremium] = useState(false);

  const [phase, setPhase] = useState<Phase>('config');
  // Pre-select from ?optional= URL param if valid
  const urlOptional = searchParams.get('optional');
  const urlSubject = urlOptional && urlOptional in OPTIONAL_TO_SUBJECT ? OPTIONAL_TO_SUBJECT[urlOptional] : null;
  const [subject, setSubject] = useState<SubjectId>(urlSubject ?? 'sociology');
  const [paper, setPaper] = useState<PaperChoice>('Paper I');
  const [mode, setMode] = useState<TestMode>('sectional');

  const [pyqs, setPyqs] = useState<PYQ[]>([]);
  const [loading, setLoading] = useState(false);

  const [includeMapQ, setIncludeMapQ] = useState(false);
  const [mapEntries, setMapEntries] = useState<GeoMapEntry[]>([]);
  const [mapScore, setMapScore] = useState(0);

  const [blocks, setBlocks] = useState<QBlockData[]>([]);
  const [rubrics, setRubrics] = useState<Record<number, RubricState>>({});
  // The test's end time, and when it was submitted; see useTimer.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  // Set once the reader or a restored test has chosen the optional, so the
  // profile's optional, which arrives later, does not replace it.
  const subjectChosen = useRef(Boolean(urlSubject));

  // A refresh mid-test used to throw the paper away: the questions are drawn
  // at random, so they could not even be found again. The whole test is kept
  // for the tab instead, deadline included, so the clock carries on.
  useRefreshSafe(
    'dc_test_v1',
    { phase, subject, paper, mode, includeMapQ, blocks, mapEntries, mapScore, rubrics, deadline, endedAt },
    (t) => {
      setPhase(t.phase); setSubject(t.subject); setPaper(t.paper); setMode(t.mode);
      setIncludeMapQ(t.includeMapQ); setBlocks(t.blocks); setMapEntries(t.mapEntries);
      setMapScore(t.mapScore); setRubrics(t.rubrics); setDeadline(t.deadline); setEndedAt(t.endedAt);
      if (t.phase !== 'config') subjectChosen.current = true;
    },
  );

  // Sign-in, then back to this test with the same optional chosen.
  const goSignIn = useCallback(() => {
    router.push(`/login?next=${encodeURIComponent(`/test?optional=${SUBJECTS[subject].optional}`)}`);
  }, [router, subject]);

  // Profile: open on the reader's own optional
  useEffect(() => {
    if (!user || urlSubject) return;
    (async () => {
      if (subjectChosen.current) return;
      try {
        const token = await user.getIdToken();
        const r = await fetch('/api/user-profile', { headers: { 'x-user-token': token } });
        if (r.ok) {
          const d = await r.json();
          const mapped = OPTIONAL_TO_SUBJECT[d.optional as string];
          if (mapped && !subjectChosen.current) setSubject(mapped);
        }
      } catch { /* ignore */ }
    })();
  }, [user, urlSubject]);

  // Premium, for the subject on screen. This used to read `subscribed` off
  // /api/user-profile, which has never returned one, so every subscriber saw
  // the paywall. A subscription buys one optional and the evaluate route
  // checks exactly that, so the question is asked per subject.
  useEffect(() => {
    if (!user) return;
    let live = true;
    (async () => {
      try {
        const token = await user.getIdToken();
        const r = await fetch(`/api/sub-status?subject=${subject}`, { headers: { 'x-user-token': token } });
        const d = await r.json();
        if (live) setIsPremium(d.active === true);
      } catch {
        if (live) setIsPremium(false);
      }
    })();
    return () => { live = false; };
  }, [user, subject]);

  // Load PYQs when subject changes
  useEffect(() => {
    if (subject !== 'geography') setIncludeMapQ(false);
    if (phase !== 'config') return;
    setLoading(true);
    fetch(SUBJECTS[subject].dataFile)
      .then(r => r.json())
      .then(d => { setPyqs(d); setLoading(false); })
      .catch(() => { setPyqs([]); setLoading(false); });
    // Phase too: a test restored after a refresh skips the load, and the
    // setup it returns to needs this optional's questions.
  }, [subject, phase]);

  // Each phase starts at the top of the page.
  useEffect(() => { window.scrollTo(0, 0); }, [phase]);

  // Timing
  const totalMins = mode === 'full' ? 180 : 105;
  const maxMarks = mode === 'full' ? 250 : 150;
  const handleSubmit = useCallback(() => { setEndedAt(Date.now()); setPhase('results'); }, []);
  const { rem, display } = useTimer(totalMins * 60, deadline, endedAt, handleSubmit);
  const urgency = rem < 300;
  const mapAllowed = subject === 'geography' && (paper === 'Paper II' || paper === 'both');
  const withMap = includeMapQ && mapAllowed;

  function startTest() {
    if (authLoading) return;
    if (!user) { goSignIn(); return; }
    const pool = paper === 'both' ? pyqs : pyqs.filter(q => q.paper === paper);
    setBlocks(buildPaper(pool, mode, withMap));
    if (withMap) {
      const seen = new Set<string>();
      setMapEntries(shuffle(geoMapData).filter(e => {
        if (seen.has(e.name)) return false;
        seen.add(e.name); return true;
      }).slice(0, 10));
    } else {
      setMapEntries([]);
    }
    setMapScore(0);
    setRubrics({});
    setDeadline(Date.now() + totalMins * 60 * 1000);
    setEndedAt(null);
    setPhase('test');
  }

  const canStart = pyqs.length > 0 && !loading;
  const tint = { ['--t' as string]: `var(--tint-${subject})`, ['--w' as string]: `var(--wash-${subject})` };
  const onRubric = (id: number, r: RubricState) => setRubrics(p => ({ ...p, [id]: r }));

  const renderBlocks = (isResults: boolean) => {
    const sectionB = blocks.findIndex(b => b.qNum === 5);
    return blocks.map((b, i) => (
      <div key={b.qNum}>
        {mode === 'full' && (i === 0 || i === sectionB) && <h2 className={`ts-section${i === 0 ? ' first' : ''}`}>Section {i === 0 ? 'A' : 'B'}</h2>}
        <QBlock block={b} isResults={isResults} rubrics={rubrics} onRubric={onRubric}
          subjectId={subject} isPremium={isPremium} user={user} onSignIn={goSignIn}
          mapEntries={b.qNum === 1 && mapEntries.length ? mapEntries : undefined}
          mapScore={mapScore} onMapScore={setMapScore} />
      </div>
    ));
  };

  // ── CONFIG ─────────────────────────────────────────────────────────────────

  if (phase === 'config') {
    return (
      <div className="ts ds" style={tint}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <header className="ts-hero">
          <div className="ds-container">
            <h1 className="ds-h1 ts-h1">Sit a practice paper</h1>
            <p className="ds-lede ts-lede">Real past questions in the Mains format, against the clock. Write on paper, then mark yourself against the rubric, or have answers checked.</p>
          </div>
        </header>

        <div className="ds-container ts-grid">
          <section className="ts-card">
            <div className="ts-field">
              <span className="ts-label">Optional</span>
              <div className="ts-pills" role="radiogroup" aria-label="Optional">
                {(Object.keys(SUBJECTS) as SubjectId[]).map(id => (
                  <button key={id} type="button" role="radio" aria-checked={subject === id}
                    className={`ts-pill${subject === id ? ' on' : ''}`} onClick={() => { subjectChosen.current = true; setSubject(id); }}
                    style={{ ['--t' as string]: `var(--tint-${id})`, ['--w' as string]: `var(--wash-${id})` }}>
                    <SubjectIcon id={id} size={16} />{SUBJECTS[id].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ts-field">
              <span className="ts-label">Paper</span>
              <div className="ts-seg" role="radiogroup" aria-label="Paper">
                {(['Paper I', 'Paper II', 'both'] as PaperChoice[]).map(p => (
                  <button key={p} type="button" role="radio" aria-checked={paper === p}
                    className={`ts-seg-btn${paper === p ? ' on' : ''}`} onClick={() => setPaper(p)}>
                    {p === 'both' ? 'Both papers' : p}
                  </button>
                ))}
              </div>
            </div>

            <div className="ts-field">
              <span className="ts-label">Format</span>
              <div className="ts-formats" role="radiogroup" aria-label="Format">
                {([
                  { id: 'sectional' as TestMode, title: 'Sectional', facts: '1 hr 45 min · 150 marks', desc: 'Section A: four questions, attempt three.' },
                  { id: 'full' as TestMode, title: 'Full paper', facts: '3 hours · 250 marks', desc: 'Both sections: eight questions, attempt five.' },
                ]).map(m => (
                  <button key={m.id} type="button" role="radio" aria-checked={mode === m.id}
                    className={`ts-format${mode === m.id ? ' on' : ''}`} onClick={() => setMode(m.id)}>
                    <span className="ts-format-title">{m.title}</span>
                    <span className="ts-format-facts">{m.facts}</span>
                    <span className="ts-format-desc">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {mapAllowed && (
              <label className="ts-switch">
                <input type="checkbox" checked={includeMapQ} onChange={e => setIncludeMapQ(e.target.checked)} />
                <span className="ts-switch-track" aria-hidden="true" />
                <span className="ts-switch-text">
                  <strong>Include the map question</strong>
                  <span>Ten places to mark on India’s outline, 20 marks, as Question 1(a) of Paper II.</span>
                </span>
              </label>
            )}

            <button type="button" className="ds-btn ds-btn-solid ts-start" onClick={startTest} disabled={!canStart && !!user}>
              {loading ? 'Loading questions…' : !user && !authLoading ? 'Sign in to start' : 'Start the paper'}
            </button>
          </section>

          <aside className="ts-aside">
            <div className="ts-side">
              <h2>How it works</h2>
              <ol className="ts-how">
                <li><span>1</span><div><strong>Write on paper</strong><p>The questions appear with a timer. Answer by hand, as in the hall.</p></div></li>
                <li><span>2</span><div><strong>Mark it</strong><p>When time is up, or you finish, mark each answer against the rubric.</p></div></li>
                <li><span>3</span><div><strong>Have answers checked</strong><p>Upload a photo of any answer and the AI marks it. That part is Premium.</p></div></li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ── TEST ───────────────────────────────────────────────────────────────────

  if (phase === 'test') {
    const progressPct = ((totalMins * 60 - rem) / (totalMins * 60)) * 100;
    return (
      <div className="ts ds" style={tint}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="ts-bar">
          <div className="ds-container ts-bar-in">
            <span className="ts-bar-what"><SubjectIcon id={subject} size={16} />{SUBJECTS[subject].label} · {mode === 'full' ? 'Full paper' : 'Sectional'}</span>
            <span className={`ts-clock${urgency ? ' late' : ''}`} aria-live="off">{display}</span>
            <button type="button" className="ds-btn ds-btn-solid ds-btn-sm" onClick={handleSubmit}>I’m done</button>
          </div>
          <div className="ts-bar-progress"><span style={{ width: `${progressPct}%` }} className={urgency ? 'late' : ''} /></div>
        </div>
        <div className="ds-container ts-paper-wrap">
          <PaperHeader subject={subject} mode={mode} paper={paper} totalMins={totalMins} maxMarks={maxMarks} />
          {renderBlocks(false)}
          <div className="ts-end">
            <button type="button" className="ds-btn ds-btn-solid" onClick={handleSubmit}>I’m done, mark my paper</button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────────

  const allQs = blocks.flatMap(b => b.questions);
  const written = allQs.reduce((s, q) => s + (rubrics[q.id] ? rubricTotal(rubrics[q.id]) : 0), 0) + (mapEntries.length ? mapScore : 0);
  const pct = Math.round((written / maxMarks) * 100);
  const used = Math.floor((totalMins * 60 - rem) / 60);

  return (
    <div className="ts ds" style={tint}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ds-container ts-paper-wrap ts-results">
        <h1 className="ts-results-title">Mark your paper</h1>
        <p className="ts-results-lede">Mark only the questions you attempted. Slide each part of the rubric to what your answer earned{isPremium ? ', or upload a photo of it to have it checked.' : '.'}</p>

        <div className="ts-summary">
          <div>
            <span className="ts-summary-label">Your mark</span>
            <span className="ts-summary-num">{written.toFixed(1)}<small> / {maxMarks}</small></span>
          </div>
          <div>
            <span className="ts-summary-label">Time used</span>
            <span className="ts-summary-num">{used}<small> min</small></span>
          </div>
          <div className="ts-summary-bar">
            <span className="ts-summary-label">{Math.min(pct, 100)}% of the marks</span>
            <div className="ts-meter"><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
          </div>
        </div>

        {renderBlocks(true)}

        <div className="ts-end">
          <button type="button" className="ds-btn ds-btn-solid" onClick={() => { clearRefreshSafe('dc_test_v1'); setDeadline(null); setEndedAt(null); setPhase('config'); }}>Sit another paper</button>
          <Link href={`/${subject}`} className="ds-btn ds-btn-line">Back to {SUBJECTS[subject].label}</Link>
        </div>
      </div>
    </div>
  );
}

export default function TestPage() {
  return (
    <Suspense fallback={<OwlLoader size="page" label="Loading the test" />}>
      <TestPageInner />
    </Suspense>
  );
}

const CSS = `
.ts { background: var(--bg); min-height: var(--page-min-h); padding-bottom: clamp(48px, 9vh, 96px); }
.ts-hero { padding: clamp(28px, 5vh, 52px) 0 clamp(16px, 3vh, 28px); background: linear-gradient(180deg, color-mix(in srgb, var(--w) 70%, var(--bg)) 0%, var(--bg) 100%); }
.ts-h1 { font-size: clamp(2rem, 4.4vw, 3rem); margin: 0 0 var(--space-2); }
.ts-lede { max-width: 640px; }

.ts-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--space-6); align-items: start; }
.ts-card { padding: var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-1); min-width: 0; }
.ts-field { margin-bottom: var(--space-5); }
.ts-label { display: block; margin-bottom: var(--space-2); font-size: 0.92rem; font-weight: 700; }
.ts-pills { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.ts-pill { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 var(--space-4); border: 1.5px solid var(--border2); border-radius: var(--radius-full); background: var(--bg); color: var(--text); font: inherit; font-size: 0.92rem; font-weight: 600; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.ts-pill svg { color: var(--t); }
.ts-pill:hover { border-color: color-mix(in srgb, var(--t) 50%, transparent); }
.ts-pill.on { border-color: var(--t); background: var(--w); color: var(--t); }
.ts-seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); }
.ts-seg-btn { padding: 8px 18px; border: none; border-radius: var(--radius-full); background: none; color: var(--text2); font: inherit; font-size: 0.92rem; font-weight: 700; cursor: pointer; transition: background 0.18s, color 0.18s, box-shadow 0.18s; }
.ts-seg-btn.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }
.ts-formats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.ts-format { display: flex; flex-direction: column; gap: 3px; padding: var(--space-4); border: 1.5px solid var(--border2); border-radius: var(--radius-lg); background: var(--bg); color: var(--text); font: inherit; text-align: left; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.ts-format:hover { border-color: color-mix(in srgb, var(--t) 50%, transparent); }
.ts-format.on { border-color: var(--t); background: var(--w); }
.ts-format-title { font-size: 1rem; font-weight: 800; }
.ts-format.on .ts-format-title { color: var(--t); }
.ts-format-facts { font-size: 0.88rem; font-weight: 600; color: var(--text2); }
.ts-format-desc { font-size: 0.86rem; color: var(--text3); line-height: 1.5; }
.ts-pill:focus-visible, .ts-seg-btn:focus-visible, .ts-format:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.ts-switch { display: flex; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-5); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--ds-soft); cursor: pointer; }
.ts-switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.ts-switch-track { position: relative; width: 40px; height: 24px; flex-shrink: 0; margin-top: 2px; border-radius: var(--radius-full); background: var(--border3); transition: background 0.15s; }
.ts-switch-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: var(--elev-1); transition: transform 0.15s; }
.ts-switch input:checked + .ts-switch-track { background: var(--t); }
.ts-switch input:checked + .ts-switch-track::after { transform: translateX(16px); }
.ts-switch input:focus-visible + .ts-switch-track { outline: 2px solid var(--accent); outline-offset: 2px; }
.ts-switch-text { display: flex; flex-direction: column; gap: 2px; font-size: 0.9rem; color: var(--text2); line-height: 1.5; }
.ts-switch-text strong { color: var(--text); }
.ts-start { width: 100%; justify-content: center; min-height: 50px; font-size: 1rem; }
.ts-start:disabled { opacity: 0.5; cursor: not-allowed; }

.ts-aside { position: sticky; top: 84px; }
.ts-side { padding: var(--space-5); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.ts-side h2 { margin: 0 0 var(--space-3); font-size: 1rem; font-weight: 800; }
.ts-how { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-4); }
.ts-how li { display: flex; gap: var(--space-3); }
.ts-how li > span { width: 26px; height: 26px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--w); color: var(--t); font-size: 0.82rem; font-weight: 800; }
.ts-how strong { display: block; font-size: 0.94rem; margin-bottom: 2px; }
.ts-how p { margin: 0; font-size: 0.88rem; line-height: 1.55; color: var(--text2); }

/* The paper */
.ts-bar { position: sticky; top: 60px; z-index: 40; background: color-mix(in srgb, var(--bg) 94%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); }
.ts-bar-in { display: flex; align-items: center; gap: var(--space-4); padding-top: var(--space-2); padding-bottom: var(--space-2); }
.ts-bar-what { display: inline-flex; align-items: center; gap: 8px; flex: 1; min-width: 0; font-size: 0.92rem; font-weight: 600; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ts-bar-what svg { color: var(--t); flex-shrink: 0; }
.ts-clock { font-size: 1.4rem; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.ts-clock.late { color: var(--danger-text); }
.ts-bar-progress { height: 3px; background: var(--ds-soft); }
.ts-bar-progress span { display: block; height: 100%; background: var(--t); transition: width 1s linear; }
.ts-bar-progress span.late { background: var(--danger-text); }
.ts-paper-wrap { max-width: 900px; padding-top: var(--space-6); }
.ts-paper { margin-bottom: var(--space-6); padding: var(--space-5) var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.ts-paper-title { font-size: 1.15rem; font-weight: 800; text-align: center; }
.ts-paper-facts { display: flex; justify-content: center; flex-wrap: wrap; gap: var(--space-2) var(--space-6); margin: var(--space-2) 0 var(--space-4); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border); font-size: 0.92rem; color: var(--text2); }
.ts-paper-rules { margin: 0; padding-left: 1.2rem; list-style: disc; display: flex; flex-direction: column; gap: 6px; font-size: 0.94rem; line-height: 1.6; color: var(--text2); }
.ts-paper-rules strong { color: var(--text); }
.ts-section { margin: var(--space-8) 0 var(--space-3); font-size: 1.2rem; font-weight: 800; letter-spacing: -0.01em; }
.ts-section.first { margin-top: 0; }

.ts-block { margin-bottom: var(--space-5); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); overflow: hidden; }
.ts-block-head { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-5); background: var(--ds-soft); border-bottom: 1px solid var(--border); }
.ts-block-head h3 { margin: 0; font-size: 1.02rem; font-weight: 800; }
.ts-chip { padding: 2px 10px; border-radius: var(--radius-full); background: var(--w); color: var(--t); font-size: 0.78rem; font-weight: 700; }
.ts-block-marks { margin-left: auto; font-size: 0.9rem; font-weight: 700; color: var(--text2); font-variant-numeric: tabular-nums; }
.ts-block-lead { margin: var(--space-4) var(--space-5) 0; font-weight: 600; line-height: 1.55; }
.ts-q { padding: var(--space-4) var(--space-5); border-top: 1px solid var(--border); }
.ts-block-head + .ts-q { border-top: none; }
.ts-block-lead + .ts-q { border-top: none; }
.ts-q-top { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); margin-bottom: 4px; }
.ts-q-label { font-weight: 800; color: var(--t); }
.ts-q-marks { font-size: 0.86rem; font-weight: 700; color: var(--text2); white-space: nowrap; }
.ts-q-text { margin: 0 0 var(--space-2); font-size: 1.02rem; line-height: 1.65; }
.ts-q-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px var(--space-3); font-size: 0.84rem; color: var(--text3); }
.ts-q-topic { padding: 1px 10px; border-radius: var(--radius-full); background: var(--ds-soft); color: var(--text2); }
.ts-end { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); margin-top: var(--space-8); }

.ts-places { display: flex; flex-direction: column; gap: 6px; margin-top: var(--space-3); }
.ts-place { border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
.ts-place-row { width: 100%; display: flex; align-items: center; gap: var(--space-3); padding: 10px var(--space-4); border: none; background: var(--bg); color: var(--text); font: inherit; text-align: left; cursor: pointer; }
.ts-place-row:disabled { cursor: default; }
.ts-place.open .ts-place-row { background: var(--w); }
.ts-place-n { min-width: 18px; font-weight: 800; color: var(--t); }
.ts-place-name { flex: 1; min-width: 0; font-weight: 600; }
.ts-place-cat { padding: 1px 10px; border-radius: var(--radius-full); background: var(--ds-soft); font-size: 0.8rem; color: var(--text2); white-space: nowrap; }
.ts-place-chev { color: var(--text3); transition: transform 0.2s; }
.ts-place.open .ts-place-chev { transform: rotate(180deg); }
.ts-place-more { padding: var(--space-3) var(--space-4); border-top: 1px solid var(--border); font-size: 0.92rem; }
.ts-place-more span { font-size: 0.82rem; color: var(--text3); }
.ts-place-more p { margin: 4px 0 0; line-height: 1.6; color: var(--text2); }
.ts-map-score { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); margin-top: var(--space-4); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--ds-soft); }
.ts-map-score span { font-weight: 700; font-size: 0.92rem; }
.ts-map-score small { display: block; font-weight: 400; font-size: 0.8rem; color: var(--text3); }
.ts-map-score strong { font-variant-numeric: tabular-nums; }

/* Marking */
.ts-results-title { margin: 0 0 var(--space-2); font-size: clamp(1.8rem, 3.6vw, 2.4rem); font-weight: 800; letter-spacing: -0.02em; }
.ts-results-lede { margin: 0 0 var(--space-5); color: var(--text2); line-height: 1.6; max-width: 720px; }
.ts-summary { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4) var(--space-8); margin-bottom: var(--space-6); padding: var(--space-5) var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-1); }
.ts-summary > div { display: flex; flex-direction: column; gap: 2px; }
.ts-summary-label { font-size: 0.86rem; color: var(--text3); }
.ts-summary-num { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.ts-summary-num small { font-size: 1rem; font-weight: 600; color: var(--text3); }
.ts-summary-bar { flex: 1; min-width: 200px; }
.ts-meter { height: 8px; border-radius: var(--radius-full); background: var(--ds-soft); overflow: hidden; }
.ts-meter span { display: block; height: 100%; background: var(--t); border-radius: inherit; transition: width 0.6s ease; }
.ts-rubric { margin-top: var(--space-3); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--ds-soft); }
.ts-rubric-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-2); font-weight: 700; font-size: 0.92rem; }
.ts-rubric-total { font-size: 1.05rem; color: var(--t); font-variant-numeric: tabular-nums; }
.ts-rubric-row { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 70px; align-items: center; gap: var(--space-3); padding: 6px 0; }
.ts-rubric-label { display: flex; flex-direction: column; min-width: 0; }
.ts-rubric-label strong { font-size: 0.9rem; }
.ts-rubric-label span { font-size: 0.8rem; color: var(--text3); }
.ts-rubric-row input, .ts-map-score input { width: 100%; accent-color: var(--t); cursor: pointer; }
.ts-rubric-val { text-align: right; font-size: 0.86rem; font-weight: 600; color: var(--text2); font-variant-numeric: tabular-nums; }

.ts-mentor { margin-top: var(--space-3); }
.ts-mentor-btn svg { flex-shrink: 0; }
.ts-mentor-wait { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); color: var(--text2); font-size: 0.92rem; }
.ts-mentor-card { margin-top: var(--space-2); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg); }
.ts-mentor-title { font-weight: 800; }
.ts-mentor-sub { margin: 2px 0 var(--space-3); font-size: 0.88rem; color: var(--text2); }
.ts-textarea { width: 100%; box-sizing: border-box; resize: vertical; padding: var(--space-3); border: 1.5px solid var(--border2); border-radius: var(--radius-md); background: var(--ds-card); color: var(--text); font: inherit; font-size: 0.94rem; line-height: 1.6; outline: none; }
.ts-textarea:focus { border-color: color-mix(in srgb, var(--accent) 60%, transparent); }
.ts-mentor-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); }
.ts-err { margin: 0 0 var(--space-3); color: var(--danger-text); font-size: 0.9rem; }
.ts-mentor-score { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2) var(--space-5); }
.ts-score-num { font-size: 1.8rem; font-weight: 800; color: var(--t); }
.ts-score-of { color: var(--text3); font-weight: 600; }
.ts-score-parts { display: flex; flex-wrap: wrap; gap: var(--space-3); font-size: 0.86rem; color: var(--text2); }
.ts-score-parts b { text-transform: capitalize; font-weight: 600; color: var(--text); }
.ts-mentor-note { margin: 4px 0 var(--space-3); font-size: 0.84rem; color: var(--text3); }
.ts-mentor-feedback { margin: 0 0 var(--space-3); line-height: 1.65; }
.ts-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-4); margin-bottom: var(--space-3); }
.ts-col-title { margin-bottom: 4px; font-size: 0.9rem; font-weight: 700; }
.ts-col-title.good { color: var(--success-text); }
.ts-col-title.fix { color: var(--danger-text); }
.ts-points { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ts-points li { position: relative; padding-left: 14px; font-size: 0.9rem; line-height: 1.55; }
.ts-points li::before { content: ''; position: absolute; left: 0; top: 0.6em; width: 6px; height: 6px; border-radius: 50%; }
.ts-points.good li::before { background: var(--success-text); }
.ts-points.fix li::before { background: var(--danger-text); }
.ts-thinkers { margin-bottom: var(--space-3); }
.ts-thinker { margin-top: 6px; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--ds-soft); font-size: 0.9rem; }
.ts-thinker span { color: var(--text3); }
.ts-thinker p { margin: 2px 0 0; color: var(--text2); line-height: 1.55; }
.ts-model { margin-bottom: var(--space-3); }
.ts-model summary { cursor: pointer; font-weight: 700; color: var(--accent-text); }
.ts-model p { margin: var(--space-2) 0 0; line-height: 1.65; color: var(--text2); }
.ts-model-point { padding-left: var(--space-3); border-left: 2px solid var(--w); }

@media (max-width: 960px) {
  .ts-grid { grid-template-columns: minmax(0, 1fr); }
  .ts-aside { position: static; }
}
@media (max-width: 640px) {
  .ts-card { padding: var(--space-5) var(--space-4); }
  .ts-formats { grid-template-columns: minmax(0, 1fr); }
  .ts-seg { display: flex; }
  .ts-seg-btn { flex: 1; padding: 8px 6px; font-size: 0.86rem; }
  .ts-bar-what { display: none; }
  .ts-bar-in { justify-content: space-between; }
  .ts-paper { padding: var(--space-4); }
  .ts-block-head { padding: var(--space-3) var(--space-4); }
  .ts-q { padding: var(--space-4); }
  .ts-block-lead { margin: var(--space-4) var(--space-4) 0; }
  .ts-rubric-row { grid-template-columns: minmax(0, 1fr) 64px; }
  .ts-rubric-row input { grid-column: 1 / -1; grid-row: 2; }
  .ts-map-score { grid-template-columns: minmax(0, 1fr) auto; }
  .ts-map-score input { grid-column: 1 / -1; grid-row: 2; }
  .ts-cols { grid-template-columns: minmax(0, 1fr); }
  .ts-summary { padding: var(--space-4); gap: var(--space-4); }
  .ts-end .ds-btn { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .ts-bar-progress span, .ts-meter span, .ts-switch-track, .ts-switch-track::after { transition: none; } }
`;
