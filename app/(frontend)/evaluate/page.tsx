'use client';
import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Mascot from '@/components/Mascot';
import EvalProgress, { ReadProgress, applyEvalStage, applyReadStage, type EvalStages, type ReadStages } from '@/components/EvalProgress';
import { readProgress } from '@/lib/progressStream';
import { labelForOptional, routeSlugForOptional } from '@/lib/optionals';
import { isPdf, toAnswerPages } from '@/lib/answerImages';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SectionMark { awarded: number; out_of: number; reasoning: string }
interface Thinker     { name: string; work?: string; argument: string }
interface Evaluation {
  demand_of_question:  string[]
  introduction:        { what_was_written: string; strengths: string[]; weaknesses: string[]; analysis: string; suggestions: string[] }
  body:                { strengths: string[]; weaknesses: string[]; suggestions: string[] }
  conclusion:          { what_was_written: string; strengths: string[]; analysis: string; suggestions: string[] }
  thinkers_to_cite:    Thinker[]
  model_answer:        { introduction: string; body: string[]; conclusion: string }
  overall_feedback:    string
  section_marks:       { introduction: SectionMark; body: SectionMark; conclusion: SectionMark; presentation: SectionMark }
  marks:               number
  marks_out_of:        number
  word_count:          number
  word_count_rating:   'short' | 'appropriate' | 'long'
}

// An image is sent to the server as-is, so it must fit the server's per-file
// ceiling. A PDF never leaves the browser: it is rasterised to JPEG pages
// first, so only the source file is bounded here.
const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const MAX_PDF_SIZE = 20 * 1024 * 1024
const MARKS_OPTIONS = ['10', '15', '20']

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

function scoreTone(pct: number) {
  if (pct >= 0.7) return 'var(--success-text)'
  if (pct >= 0.5) return 'var(--warning-text)'
  return 'var(--danger-text)'
}

const WORD_RATING: Record<Evaluation['word_count_rating'], string> = {
  short: 'on the short side',
  appropriate: 'about the right length',
  long: 'on the long side',
}

function MarksPicker({ marks, setMarks }: { marks: string; setMarks: (m: string) => void }) {
  return (
    <div className="ev-marks" role="radiogroup" aria-label="Marks">
      {MARKS_OPTIONS.map(m => (
        <button key={m} type="button" role="radio" aria-checked={marks === m}
          className={`ev-mark${marks === m ? ' on' : ''}`} onClick={() => setMarks(m)}>
          {m} marks
        </button>
      ))}
    </div>
  )
}

function Points({ items, tone, empty }: { items?: string[]; tone: 'good' | 'fix'; empty: string }) {
  const list = items ?? []
  return (
    <ul className={`ev-points ${tone}`}>
      {list.length ? list.map((s, i) => <li key={i}>{s}</li>) : <li className="none">{empty}</li>}
    </ul>
  )
}

function SectionCard({ label, mark, data }: {
  label: string
  mark?: SectionMark
  data: { what_was_written?: string; strengths?: string[]; weaknesses?: string[]; analysis?: string; suggestions?: string[] }
}) {
  const hasPoints = (data.strengths?.length ?? 0) > 0 || (data.weaknesses?.length ?? 0) > 0
  return (
    <section className="ev-block">
      <div className="ev-block-head">
        <h2>{label}</h2>
        {mark && <span className="ev-block-mark">{mark.awarded} / {mark.out_of}</span>}
      </div>
      {data.what_was_written && <blockquote className="ev-quote">{data.what_was_written}</blockquote>}
      {hasPoints && (
        <div className="ev-cols">
          <div>
            <h3 className="ev-col-title good">What worked</h3>
            <Points items={data.strengths} tone="good" empty="Nothing stood out here yet." />
          </div>
          <div>
            <h3 className="ev-col-title fix">What to fix</h3>
            <Points items={data.weaknesses} tone="fix" empty="Nothing to fix here." />
          </div>
        </div>
      )}
      {data.analysis && <p className="ev-analysis">{data.analysis}</p>}
      {(data.suggestions ?? []).length > 0 && (
        <div className="ev-tries">
          <h3 className="ev-col-title">Try this next time</h3>
          {(data.suggestions ?? []).map((s, i) => <p key={i} className="ev-try">{s}</p>)}
        </div>
      )}
    </section>
  )
}

const UploadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
)
const PdfIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
)

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EvaluatePage() {
  const router = useRouter()
  const [user, setUser]               = useState<User | null>(null)
  const [optionalId, setOptionalId]   = useState<string | null>(null)   // from user_profiles (raw)
  const [profileLoading, setProfileLoading] = useState(true)
  const [files, setFiles]             = useState<File[]>([])
  const [previews, setPreviews]       = useState<string[]>([])
  // The pages as they were read: PDFs rendered, photos shrunk. Marking sends
  // these rather than the originals, which could be a 20MB PDF.
  const [pageImages, setPageImages]   = useState<File[]>([])
  const [question, setQuestion]       = useState('')
  const [marks, setMarks]             = useState('15')
  const [drag, setDrag]               = useState(false)
  const [loading, setLoading]         = useState(false)
  const [evalStages, setEvalStages]   = useState<EvalStages>({})
  const [evalStartedAt, setEvalStartedAt] = useState(0)
  const [result, setResult]           = useState<Evaluation | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const [transcript, setTranscript]   = useState('')
  const [ocrLoading, setOcrLoading]   = useState(false)
  const [readStages, setReadStages]   = useState<ReadStages>({})
  const [readStartedAt, setReadStartedAt] = useState(0)
  const [showTranscript, setShowTranscript] = useState(false)

  // Every PYQ page links here as /evaluate?question=...&marks=..., but nothing
  // read those params, so the question and marks were silently dropped and the
  // student had to retype the question they had just clicked on.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('question')
    if (q) setQuestion(q)
    const m = params.get('marks')
    if (m && (MARKS_OPTIONS as readonly string[]).includes(m)) setMarks(m)
  }, [])

  // Auth + fetch optional from profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) { setProfileLoading(false); return }
      try {
        const token = await u.getIdToken()
        const res = await fetch('/api/user-profile', { headers: { 'x-user-token': token } })
        const data = await res.json()
        setOptionalId(data.optional ?? null)
      } catch { /* ignore */ }
      finally { setProfileLoading(false) }
    })
    return () => unsub()
  }, [])

  // Each new screen starts at its top.
  useEffect(() => { window.scrollTo(0, 0) }, [showTranscript, result, limitReached])

  // Sign-in, then back here with the question and marks still filled in.
  const goSignIn = () => {
    const params = new URLSearchParams()
    if (question.trim()) params.set('question', question.trim())
    params.set('marks', marks)
    router.push(`/login?next=${encodeURIComponent(`/evaluate?${params}`)}`)
  }

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter(f =>
      isPdf(f) ? f.size <= MAX_PDF_SIZE : f.type.startsWith('image/') && f.size <= MAX_IMAGE_SIZE
    )
    if (valid.length < newFiles.length) {
      setError('Some files were skipped. Photos must be under 8 MB and PDFs under 20 MB.')
    } else {
      setError(null)
    }
    if (!valid.length) return
    setFiles(prev => [...prev, ...valid].slice(0, 10))
    valid.forEach(f => {
      if (isPdf(f)) {
        setPreviews(prev => [...prev, '__pdf__'].slice(0, 10))
      } else {
        const reader = new FileReader()
        reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string].slice(0, 10))
        reader.readAsDataURL(f)
      }
    })
  }, [])

  const subjectId = routeSlugForOptional(optionalId)

  const handleReadAnswer = async () => {
    if (!files.length) return
    if (!user) { goSignIn(); return }
    setOcrLoading(true)
    setTranscript('')
    setError(null)
    setReadStartedAt(Date.now())
    setReadStages({ preparing: { files: files.length, pdf: files.some(isPdf) }, askQuestion: !question.trim() })

    try {
      // PDFs become page images; photos are shrunk to a size the route accepts.
      const compressed = await toAnswerPages(files)
      if (!compressed.length) {
        setError('No readable files found. Upload JPG or PNG photos, or a PDF.')
        return
      }
      setPageImages(compressed)
      setReadStages(s => ({ ...s, prepared: { pages: compressed.length } }))

      const fd = new FormData()
      compressed.forEach((f, i) => fd.append('files', f, `page-${i + 1}.jpg`))
      // The route checks the subscription against the optional on the
      // profile; the subject goes along for routes that want it named.
      if (subjectId) fd.append('subject', subjectId)
      if (question.trim()) fd.append('hasQuestion', '1')

      const tok = await user.getIdToken()
      const res = await fetch('/api/read-answer', { method: 'POST', headers: { 'x-user-token': tok, 'x-ocr-stages': '1' }, body: fd })
      const { status, body } = await readProgress(res, e => setReadStages(s => applyReadStage(s, e)))
      const data = (body ?? {}) as { error?: string; question?: string; transcript?: string }

      if (status >= 400) {
        if (data.error === 'limit_reached') { setLimitReached(true); return }
        console.error('read-answer failed:', status, data)
        // The review screen still opens, so the answer can be typed instead.
        setError(`${data.error ?? 'We could not read the answer sheet.'} You can type or paste your answer below instead.`)
        setShowTranscript(true)
        return
      }

      if (!question.trim() && data.question) {
        setQuestion(data.question)
        // A sheet headed "(15 marks)" is marked out of 15 without being told.
        const m = data.question.match(/\b(10|15|20)\s*marks?\b/i)
        if (m) setMarks(m[1])
      }
      setTranscript(data.transcript ?? '')
      setShowTranscript(true)
    } catch (e) {
      console.error('read-answer exception:', e)
      setError('The connection dropped while reading. You can type or paste your answer below instead.')
      setShowTranscript(true)
    } finally {
      setOcrLoading(false)
    }
  }

  const removeFile = (i: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const handleSubmit = async () => {
    if (!user) { goSignIn(); return }
    if (!question.trim()) { setError('Add the question first.'); return }
    if (!transcript.trim() && !pageImages.length && !files.length) { setError('Upload your answer, or type it in, first.'); return }
    if (!subjectId) {
      setError('We could not tell which optional you take. Finish setting up your profile, or refresh the page.')
      return
    }
    setError(null); setResult(null); setLoading(true)
    setEvalStages({}); setEvalStartedAt(Date.now())

    try {
      const token = await user.getIdToken()
      const fd = new FormData()
      const evalFiles = pageImages.length ? pageImages : files.filter(f => !isPdf(f))
      evalFiles.forEach((f, i) => fd.append('files', f, `page-${i + 1}.jpg`))
      fd.append('question', question.trim())
      fd.append('marks', marks)
      fd.append('subject', subjectId)
      fd.append('lang', 'en')
      if (transcript.trim()) fd.append('extractedText', transcript.trim())

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'x-user-token': token, 'x-eval-stages': '1' },
        body: fd,
      })
      const { status, body } = await readProgress(res, e => setEvalStages(s => applyEvalStage(s, e)))
      const data = body as (Evaluation & { error?: string }) | null

      if (status >= 400 || !data) {
        if (data?.error === 'limit_reached') { setLimitReached(true); return }
        setError(data?.error ?? 'The evaluation failed. Please try again.')
        return
      }
      setResult(data)
    } catch {
      setError('The connection dropped while marking. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setResult(null); setFiles([]); setPreviews([]); setPageImages([]); setQuestion('')
    setError(null); setLimitReached(false); setTranscript(''); setShowTranscript(false)
  }

  const subjectLabel = labelForOptional(optionalId)
  const signedOut = !profileLoading && !user
  const pct = result ? result.marks / result.marks_out_of : 0
  const tint = subjectId ? { ['--t' as string]: `var(--tint-${subjectId})`, ['--w' as string]: `var(--wash-${subjectId})` } : undefined

  const pagesStrip = previews.length > 0 && (
    <div className="ev-thumbs">
      {previews.map((src, i) => (
        <div key={i} className="ev-thumb">
          {src === '__pdf__'
            ? <div className="ev-thumb-pdf"><PdfIcon /><span>{files[i]?.name ?? 'PDF'}</span></div>
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={src} alt={`Page ${i + 1}`} />}
          <span className="ev-thumb-n">{i + 1}</span>
          {!showTranscript && (
            <button type="button" className="ev-thumb-rm" onClick={() => removeFile(i)} aria-label={`Remove page ${i + 1}`}>×</button>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ev ds" style={tint}>

        {ocrLoading && <ReadProgress stages={readStages} startedAt={readStartedAt} />}
        {loading && <EvalProgress stages={evalStages} startedAt={evalStartedAt} />}

        {/* ── Limit reached ── */}
        {limitReached ? (
          <div className="ds-container">
            <div className="ev-limit">
              <Mascot pose="peek" width={120} />
              <h1 className="ev-limit-title">You&apos;ve used your free evaluation</h1>
              <p>Premium marks every answer you write, and opens model answers and the chat&apos;s book, mentor and brainstorm modes.</p>
              <div className="ev-limit-actions">
                <Link href="/pricing" className="ds-btn ds-btn-solid">See plans</Link>
                <button type="button" className="ds-btn ds-btn-line" onClick={reset}>Back</button>
              </div>
            </div>
          </div>

        /* ── Results ── */
        ) : result ? (
          <div className="ds-container ev-results">
            <div className="ev-qbar">
              <span>Question{result.marks_out_of ? ` · ${result.marks_out_of} marks` : ''}</span>
              <p>{question}</p>
            </div>

            <div className="ev-res-grid">
              <aside className="ev-score">
                <div className="ev-score-card">
                  <div className="ev-score-num" style={{ color: scoreTone(pct) }}>
                    {result.marks}<span>/ {result.marks_out_of}</span>
                  </div>
                  <div className="ev-score-pct">{Math.round(pct * 100)}% of the marks</div>
                  <div className="ev-score-bar"><span style={{ width: `${Math.min(100, pct * 100)}%`, background: scoreTone(pct) }} /></div>

                  <div className="ev-sections">
                    {(['introduction', 'body', 'conclusion', 'presentation'] as const).map(k => {
                      const s = result.section_marks[k]
                      const p = s.out_of ? s.awarded / s.out_of : 0
                      return (
                        <div key={k} className="ev-sec">
                          <div className="ev-sec-top">
                            <span className="ev-sec-name">{k}</span>
                            <span className="ev-sec-score">{s.awarded} / {s.out_of}</span>
                          </div>
                          <div className="ev-sec-bar"><span style={{ width: `${Math.min(100, p * 100)}%`, background: scoreTone(p) }} /></div>
                          {s.reasoning && <p className="ev-sec-why">{s.reasoning}</p>}
                        </div>
                      )
                    })}
                  </div>

                  <div className="ev-score-actions">
                    <Link href={`/chat?q=${encodeURIComponent(question)}${subjectId ? `&subject=${subjectId}` : ''}`} className="ds-btn ds-btn-solid">
                      Ask the AI for a model answer
                    </Link>
                    <button type="button" className="ds-btn ds-btn-line" onClick={reset}>Check another answer</button>
                  </div>
                </div>
              </aside>

              <div className="ev-feedback">
                <section className="ev-block ev-overall">
                  <h2>Overall</h2>
                  <p>{result.overall_feedback}</p>
                  {result.word_count > 0 && (
                    <span className={`ev-wc ${result.word_count_rating}`}>
                      {result.word_count} words, {WORD_RATING[result.word_count_rating] ?? result.word_count_rating}
                    </span>
                  )}
                </section>

                {result.demand_of_question?.length > 0 && (
                  <section className="ev-block">
                    <h2>What the question asks for</h2>
                    <ul className="ev-demand">
                      {result.demand_of_question.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </section>
                )}

                <SectionCard label="Introduction" mark={result.section_marks.introduction} data={result.introduction} />
                <SectionCard label="Body" mark={result.section_marks.body} data={result.body} />
                <SectionCard label="Conclusion" mark={result.section_marks.conclusion} data={result.conclusion} />

                {result.thinkers_to_cite?.length > 0 && (
                  <section className="ev-block">
                    <h2>Thinkers you could cite</h2>
                    <div className="ev-thinkers">
                      {result.thinkers_to_cite.map((t, i) => (
                        <div key={i} className="ev-thinker">
                          <div className="ev-thinker-name">{t.name}</div>
                          {t.work && <div className="ev-thinker-work">{t.work}</div>}
                          <p>{t.argument}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>

        /* ── Review what was read ── */
        ) : showTranscript ? (
          <div className="ds-container ev-grid ev-top">
            <section className="ev-card">
              <h1 className="ev-card-title">Check what we read</h1>
              <p className="ev-card-lede">This text is what gets marked. Read it through once and fix any name, date or term the reader got wrong.</p>

              {error && <div className="ev-err" role="alert">{error}</div>}

              <label className="ev-field">
                <span className="ev-label">Question</span>
                <textarea className="ev-input" value={question} onChange={e => setQuestion(e.target.value)}
                  placeholder="Type or paste the question" rows={3} />
              </label>

              <div className="ev-field">
                <span className="ev-label">Marks</span>
                <MarksPicker marks={marks} setMarks={setMarks} />
              </div>

              <label className="ev-field">
                <span className="ev-label-row">
                  <span className="ev-label">Your answer</span>
                  <span className="ev-count">{countWords(transcript)} words</span>
                </span>
                <textarea className="ev-input ev-tall" value={transcript} onChange={e => setTranscript(e.target.value)}
                  placeholder="Your answer as we read it appears here. You can also type or paste it." />
              </label>

              <div className="ev-actions">
                <button type="button" className="ds-btn ds-btn-line"
                  onClick={() => { setShowTranscript(false); setTranscript(''); setFiles([]); setPreviews([]); setPageImages([]); setError(null) }}>
                  Upload again
                </button>
                <button type="button" className="ds-btn ds-btn-solid ev-go" onClick={handleSubmit}
                  disabled={loading || profileLoading || !question.trim()}>
                  {profileLoading ? 'One moment…' : 'Mark my answer'}
                </button>
              </div>
            </section>

            <aside className="ev-aside">
              {previews.length > 0 && (
                <div className="ev-side">
                  <h2>Your pages</h2>
                  {pagesStrip}
                </div>
              )}
              <div className="ev-side">
                <h2>What to check</h2>
                <p>Names are where handwriting readers slip most, so look at every thinker and scholar first. Then dates and numbers, whose digits can swap, and terms particular to {subjectLabel ?? 'your optional'}.</p>
              </div>
            </aside>
          </div>

        /* ── Upload ── */
        ) : (
          <>
            <header className="ev-hero">
              <div className="ds-container">
                <h1 className="ds-h1 ev-h1">Get your answer checked</h1>
                <p className="ds-lede ev-lede">
                  Upload a photo or PDF of a handwritten answer. You get marks for each part, what worked, what to fix, and the thinkers it could have cited.
                </p>
                {subjectLabel && <span className="ev-subject"><span />Marked as {subjectLabel} optional</span>}
              </div>
            </header>

            <div className="ds-container ev-grid">
              <section className="ev-card">
                <label className="ev-field">
                  <span className="ev-label">Question</span>
                  <textarea className="ev-input" value={question} onChange={e => setQuestion(e.target.value)} rows={3}
                    placeholder="Type or paste the question. Leave it empty and we'll read it off the top of your page." />
                </label>

                <div className="ev-field">
                  <span className="ev-label">Marks</span>
                  <MarksPicker marks={marks} setMarks={setMarks} />
                </div>

                {signedOut ? (
                  <div className="ev-signin">
                    <Mascot pose="peek" width={84} />
                    <div className="ev-signin-text">
                      <strong>Sign in to have your answer checked</strong>
                      <span>Your first evaluation is free.</span>
                    </div>
                    <button type="button" className="ds-btn ds-btn-solid" onClick={goSignIn}>Sign in</button>
                  </div>
                ) : (
                  <>
                    <div className="ev-field">
                      <span className="ev-label">Your answer</span>
                      <label
                        className={`ev-drop${drag ? ' drag' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDrag(true) }}
                        onDragLeave={() => setDrag(false)}
                        onDrop={onDrop}
                      >
                        <span className="ev-drop-icon"><UploadIcon /></span>
                        <span className="ev-drop-title">Drop your pages here, or <u>choose files</u></span>
                        <span className="ev-drop-sub">Photos or a PDF, up to 10 pages</span>
                        <input type="file" accept="image/*,application/pdf" multiple className="ev-drop-input"
                          onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                      </label>
                    </div>

                    {pagesStrip}
                    {error && <div className="ev-err" role="alert">{error}</div>}

                    <button type="button" className="ds-btn ds-btn-solid ev-go ev-go-full" onClick={handleReadAnswer} disabled={!files.length || ocrLoading}>
                      Read my answer
                    </button>
                  </>
                )}
              </section>

              <aside className="ev-aside">
                <div className="ev-side">
                  <h2>How it works</h2>
                  <ol className="ev-how">
                    <li><span>1</span><div><strong>Upload your pages</strong><p>Photos or a scanned PDF, up to 10 pages.</p></div></li>
                    <li><span>2</span><div><strong>Check what we read</strong><p>We transcribe the handwriting, and you fix anything it got wrong.</p></div></li>
                    <li><span>3</span><div><strong>Get it marked</strong><p>Marks for the introduction, body, conclusion and presentation, with feedback on each.</p></div></li>
                  </ol>
                </div>
                <div className="ev-side">
                  <h2>For a clean read</h2>
                  <p>Shoot in daylight from straight above, one page to a photo, with the whole page in frame. Blur and shadows are where names get misread.</p>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
.ev { background: var(--bg); min-height: var(--page-min-h); padding-bottom: clamp(48px, 9vh, 96px); }
.ev-hero { padding: clamp(28px, 5vh, 56px) 0 clamp(20px, 3vh, 32px); background: linear-gradient(180deg, color-mix(in srgb, var(--accent-dim) 60%, var(--bg)) 0%, var(--bg) 100%); }
.ev-h1 { font-size: clamp(2rem, 4.4vw, 3rem); margin: 0 0 var(--space-2); }
.ev-lede { max-width: 640px; }
.ev-subject { display: inline-flex; align-items: center; gap: 8px; margin-top: var(--space-4); padding: 5px 14px 5px 12px; border-radius: var(--radius-full); background: var(--ds-card); border: 1px solid var(--border); font-size: 0.86rem; font-weight: 600; color: var(--text2); }
.ev-subject span { width: 8px; height: 8px; border-radius: 50%; background: var(--t, var(--accent)); }

.ev-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--space-6); align-items: start; }
.ev-top { padding-top: clamp(24px, 4vh, 40px); }
.ev-card { padding: var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-1); min-width: 0; }
.ev-card-title { margin: 0 0 var(--space-2); font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; }
.ev-card-lede { margin: 0 0 var(--space-5); color: var(--text2); line-height: 1.6; }

.ev-field { display: block; margin-bottom: var(--space-5); }
.ev-label { display: block; margin-bottom: var(--space-2); font-size: 0.92rem; font-weight: 700; color: var(--text); }
.ev-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
.ev-count { font-size: 0.84rem; color: var(--text3); font-variant-numeric: tabular-nums; }
.ev-input { width: 100%; box-sizing: border-box; resize: vertical; padding: var(--space-3) var(--space-4); background: var(--bg); border: 1.5px solid var(--border2); border-radius: var(--radius-lg); color: var(--text); font: inherit; font-size: 0.98rem; line-height: 1.6; outline: none; transition: border-color 0.15s, box-shadow 0.15s; white-space: pre-wrap; }
.ev-input:focus { border-color: color-mix(in srgb, var(--accent) 65%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.ev-input::placeholder { color: var(--text3); }
.ev-tall { min-height: 340px; }

.ev-marks { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); }
.ev-mark { padding: 8px 18px; border: none; border-radius: var(--radius-full); background: none; color: var(--text2); font: inherit; font-size: 0.92rem; font-weight: 700; cursor: pointer; transition: background 0.18s, color 0.18s, box-shadow 0.18s; }
.ev-mark.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }

.ev-drop { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: var(--space-8) var(--space-4); border: 1.5px dashed var(--border3); border-radius: var(--radius-xl); background: var(--bg); text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.ev-drop:hover, .ev-drop.drag { border-color: var(--accent); background: var(--accent-dim); }
.ev-drop:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.ev-drop-icon { width: 48px; height: 48px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: var(--space-2); border-radius: 14px; background: var(--accent-dim); color: var(--accent-text); }
.ev-drop-title { font-size: 1rem; font-weight: 600; color: var(--text); }
.ev-drop-title u { color: var(--accent-text); text-underline-offset: 3px; }
.ev-drop-sub { font-size: 0.88rem; color: var(--text3); }
.ev-drop-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

.ev-thumbs { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: calc(-1 * var(--space-2)) 0 var(--space-5); }
.ev-thumb { position: relative; width: 76px; height: 96px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border2); background: var(--ds-soft); }
.ev-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ev-thumb-pdf { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 6px; color: var(--text3); }
.ev-thumb-pdf span { max-width: 100%; font-size: 0.66rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ev-thumb-n { position: absolute; left: 5px; bottom: 5px; min-width: 18px; padding: 0 5px; border-radius: var(--radius-full); background: color-mix(in srgb, var(--bg) 85%, transparent); font-size: 0.7rem; font-weight: 700; text-align: center; color: var(--text); }
.ev-thumb-rm { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 50%; background: color-mix(in srgb, var(--bg) 85%, transparent); color: var(--text); font-size: 0.95rem; line-height: 1; cursor: pointer; }
.ev-side .ev-thumbs { margin: 0; }
.ev-side .ev-thumb { width: 64px; height: 82px; }

.ev-err { margin: 0 0 var(--space-4); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--danger-wash); border: 1px solid color-mix(in srgb, var(--danger-text) 30%, transparent); color: var(--danger-text); font-size: 0.92rem; line-height: 1.5; }
.ev-go { min-height: 50px; padding: 0 var(--space-6); font-size: 1rem; }
.ev-go-full { width: 100%; }
.ev-go:disabled { opacity: 0.5; cursor: not-allowed; }
.ev-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.ev-actions .ds-btn-line { min-height: 50px; flex-shrink: 0; }
.ev-actions .ev-go { flex: 1; min-width: 220px; }

.ev-signin { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-4) var(--space-5); border-radius: var(--radius-xl); background: var(--accent-dim); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent); }
.ev-signin-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.ev-signin-text strong { font-size: 1.02rem; color: var(--text); }
.ev-signin-text span { font-size: 0.92rem; color: var(--text2); }

.ev-aside { display: flex; flex-direction: column; gap: var(--space-4); position: sticky; top: 84px; }
.ev-side { padding: var(--space-5); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.ev-side h2 { margin: 0 0 var(--space-3); font-size: 1rem; font-weight: 800; }
.ev-side p { margin: 0; font-size: 0.92rem; line-height: 1.6; color: var(--text2); }
.ev-how { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-4); }
.ev-how li { display: flex; gap: var(--space-3); }
.ev-how li > span { width: 26px; height: 26px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--accent-dim); color: var(--accent-text); font-size: 0.82rem; font-weight: 800; }
.ev-how strong { display: block; font-size: 0.94rem; margin-bottom: 2px; }
.ev-how p { font-size: 0.88rem; }

/* Results */
.ev-results { padding-top: clamp(24px, 4vh, 40px); }
.ev-qbar { margin-bottom: var(--space-5); padding: var(--space-4) var(--space-5); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.ev-qbar span { display: block; margin-bottom: 4px; font-size: 0.84rem; font-weight: 600; color: var(--text3); }
.ev-qbar p { margin: 0; font-size: 1.08rem; font-weight: 600; line-height: 1.55; }
.ev-res-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: var(--space-6); align-items: start; }
.ev-score { grid-column: 2; grid-row: 1; position: sticky; top: 84px; }
.ev-feedback { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.ev-score-card { padding: var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-1); }
.ev-score-num { font-size: 3.6rem; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
.ev-score-num span { margin-left: 6px; font-size: 1.4rem; font-weight: 600; letter-spacing: 0; color: var(--text3); }
.ev-score-pct { margin-top: var(--space-2); font-size: 0.92rem; color: var(--text2); }
.ev-score-bar, .ev-sec-bar { height: 6px; margin-top: var(--space-3); border-radius: var(--radius-full); background: var(--ds-soft); overflow: hidden; }
.ev-score-bar span, .ev-sec-bar span { display: block; height: 100%; border-radius: inherit; transition: width 0.8s ease; }
.ev-sections { display: flex; flex-direction: column; gap: var(--space-4); margin-top: var(--space-5); padding-top: var(--space-5); border-top: 1px solid var(--border); }
.ev-sec-top { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
.ev-sec-name { font-weight: 700; text-transform: capitalize; }
.ev-sec-score { font-weight: 700; font-variant-numeric: tabular-nums; }
.ev-sec-bar { height: 4px; margin-top: 6px; }
.ev-sec-why { margin: 6px 0 0; font-size: 0.84rem; line-height: 1.5; color: var(--text3); }
.ev-score-actions { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-6); }
.ev-score-actions .ds-btn { width: 100%; justify-content: center; min-height: 46px; }

.ev-block { padding: var(--space-5) var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.ev-block h2 { margin: 0 0 var(--space-3); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.01em; }
.ev-block-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
.ev-block-mark { padding: 2px 10px; border-radius: var(--radius-full); background: var(--ds-soft); font-size: 0.86rem; font-weight: 700; color: var(--text2); font-variant-numeric: tabular-nums; }
.ev-overall p { margin: 0; font-size: 1rem; line-height: 1.75; }
.ev-wc { display: inline-block; margin-top: var(--space-3); padding: 3px 12px; border-radius: var(--radius-full); font-size: 0.86rem; font-weight: 600; }
.ev-wc.short { background: var(--danger-wash); color: var(--danger-text); }
.ev-wc.appropriate { background: var(--success-wash); color: var(--success-text); }
.ev-wc.long { background: var(--warning-wash); color: var(--warning-text); }
.ev-demand { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 6px; list-style: disc; }
.ev-demand li { line-height: 1.6; color: var(--text); }
.ev-demand li::marker { color: var(--accent); }
.ev-quote { margin: 0 0 var(--space-4); padding: var(--space-3) var(--space-4); border-left: 3px solid var(--border3); background: var(--ds-soft); border-radius: 0 var(--radius-md) var(--radius-md) 0; font-style: italic; line-height: 1.65; color: var(--text2); }
.ev-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-5); }
.ev-col-title { margin: 0 0 var(--space-2); font-size: 0.92rem; font-weight: 700; color: var(--text); }
.ev-col-title.good { color: var(--success-text); }
.ev-col-title.fix { color: var(--danger-text); }
.ev-points { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.ev-points li { position: relative; padding-left: 16px; line-height: 1.6; font-size: 0.95rem; }
.ev-points li::before { content: ''; position: absolute; left: 0; top: 0.62em; width: 6px; height: 6px; border-radius: 50%; }
.ev-points.good li::before { background: var(--success-text); }
.ev-points.fix li::before { background: var(--danger-text); }
.ev-points li.none { color: var(--text3); }
.ev-points li.none::before { background: var(--border3); }
.ev-analysis { margin: var(--space-4) 0 0; line-height: 1.7; color: var(--text2); }
.ev-tries { margin-top: var(--space-4); }
.ev-try { margin: 0 0 var(--space-2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: var(--accent-dim); line-height: 1.6; font-size: 0.95rem; }
.ev-thinkers { display: flex; flex-direction: column; gap: var(--space-3); }
.ev-thinker { padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg); }
.ev-thinker-name { font-weight: 700; }
.ev-thinker-work { margin-top: 2px; font-size: 0.86rem; color: var(--text3); }
.ev-thinker p { margin: 6px 0 0; line-height: 1.6; color: var(--text2); }

.ev-limit { max-width: 520px; margin: clamp(32px, 8vh, 80px) auto 0; padding: var(--space-8) var(--space-6); text-align: center; background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-1); display: flex; flex-direction: column; align-items: center; }
.ev-limit-title { margin: var(--space-4) 0 var(--space-2); font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; }
.ev-limit p { margin: 0 0 var(--space-5); color: var(--text2); line-height: 1.6; }
.ev-limit-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: center; }

@media (max-width: 960px) {
  .ev-grid, .ev-res-grid { grid-template-columns: minmax(0, 1fr); }
  .ev-aside, .ev-score { position: static; }
  .ev-score { grid-column: 1; grid-row: 1; }
  .ev-feedback { grid-column: 1; grid-row: 2; }
}
@media (max-width: 640px) {
  .ev-card { padding: var(--space-5) var(--space-4); }
  .ev-marks { display: flex; }
  .ev-mark { flex: 1; padding: 8px 6px; }
  .ev-drop { padding: var(--space-6) var(--space-3); }
  .ev-tall { min-height: 260px; }
  .ev-actions { flex-direction: column-reverse; }
  .ev-actions .ds-btn { width: 100%; justify-content: center; }
  .ev-signin { flex-direction: column; text-align: center; }
  .ev-signin .ds-btn { width: 100%; justify-content: center; }
  .ev-block { padding: var(--space-4); }
  .ev-cols { grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
  .ev-score-card { padding: var(--space-5) var(--space-4); }
  .ev-score-num { font-size: 3rem; }
  .ev-qbar p { font-size: 1rem; }
}
@media (prefers-reduced-motion: reduce) { .ev-score-bar span, .ev-sec-bar span { transition: none; } }
`
