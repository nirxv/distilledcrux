'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/* ─── CSS ─────────────────────────────────────────────────────── */
const CSS = `
@keyframes quiz-bar { from { width: 100%; } to { width: 0%; } }
@keyframes quiz-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.qz-wrap { min-height: 100vh; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 80px 1.5rem 80px; }

/* ── Intro screen ── */
.qz-intro { max-width: 520px; width: 100%; text-align: center; animation: quiz-fade 0.25s ease; }
.qz-intro-icon { font-size: 2.5rem; margin-bottom: 1.5rem; }
.qz-intro-h { font-family: var(--font-body); font-size: clamp(2rem, 5vw, 3rem); font-weight: 700; letter-spacing: -0.035em; color: var(--text); line-height: 1.08; margin-bottom: 0.75rem; }
.qz-intro-h em { font-style: italic; color: var(--gold); }
.qz-intro-sub { font-family: var(--font-ui); font-size: 0.9rem; color: var(--text2); line-height: 1.7; margin-bottom: 2rem; }
.qz-start-btn { font-family: var(--font-ui); font-size: 0.92rem; font-weight: 600; background: var(--text); color: var(--bg); padding: 13px 36px; border-radius: 6px; border: none; cursor: pointer; transition: opacity 0.15s; letter-spacing: 0.01em; }
.qz-start-btn:hover { opacity: 0.85; }

/* ── Quiz screen ── */
.qz-screen { max-width: 640px; width: 100%; animation: quiz-fade 0.2s ease; }

/* Progress bar */
.qz-progress-bar-wrap { height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; margin-bottom: 1.75rem; }
.qz-progress-bar-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s ease; }

/* Timer */
.qz-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.qz-qnum { font-family: var(--font-mono); font-size: 0.65rem; color: var(--text3); letter-spacing: 0.1em; }
.qz-timer { font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.06em; padding: 3px 10px; border-radius: 4px; border: 1px solid var(--border); transition: color 0.3s, border-color 0.3s; }
.qz-timer.ok   { color: var(--text3); border-color: var(--border); }
.qz-timer.warn { color: #fbbf24; border-color: rgba(251,191,36,0.3); }
.qz-timer.red  { color: #f87171; border-color: rgba(248,113,113,0.3); }

/* Timer strip */
.qz-timer-strip-wrap { height: 2px; background: var(--border); border-radius: 2px; margin-bottom: 1.25rem; overflow: hidden; }
.qz-timer-strip { height: 100%; border-radius: 2px; background: var(--accent); }

/* Question card */
.qz-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 1.75rem; }
.qz-question { font-family: var(--font-body); font-size: 0.96rem; color: var(--text); line-height: 1.72; margin-bottom: 1.25rem; }
.qz-options { display: flex; flex-direction: column; gap: 6px; }
.qz-opt {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px;
  border-radius: 7px; border: 1px solid var(--border); background: var(--bg);
  cursor: pointer; transition: all 0.13s; font-family: var(--font-ui); font-size: 0.82rem;
  color: var(--text2); text-align: left; width: 100%;
}
.qz-opt:hover:not(:disabled) { border-color: var(--border2); background: var(--bg3); color: var(--text); }
.qz-opt.correct { border-color: rgba(74,222,128,0.4); background: rgba(74,222,128,0.07); color: #4ade80; }
.qz-opt.wrong   { border-color: rgba(248,113,113,0.35); background: rgba(248,113,113,0.07); color: #f87171; }
.qz-opt.neutral { opacity: 0.4; cursor: default; }
.qz-opt-key { font-family: var(--font-mono); font-size: 0.62rem; font-weight: 700; flex-shrink: 0; padding-top: 1px; }

/* Explanation */
.qz-expl { font-family: var(--font-ui); font-size: 0.8rem; color: var(--text2); line-height: 1.65; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; margin-top: 10px; animation: quiz-fade 0.2s ease; }
.qz-expl strong { color: var(--text); }

/* Next button */
.qz-next { margin-top: 1.25rem; width: 100%; font-family: var(--font-ui); font-size: 0.88rem; font-weight: 600; background: var(--text); color: var(--bg); padding: 12px; border-radius: 7px; border: none; cursor: pointer; transition: opacity 0.15s; letter-spacing: 0.01em; }
.qz-next:hover { opacity: 0.85; }

/* ── Results screen ── */
.qz-results { max-width: 560px; width: 100%; text-align: center; animation: quiz-fade 0.25s ease; }
.qz-score-ring {
  width: 100px; height: 100px; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: var(--bg2); border: 2px solid var(--border); margin: 0 auto 1.75rem;
}
.qz-score-num { font-family: var(--font-body); font-size: 2rem; font-weight: 700; letter-spacing: -0.04em; color: var(--text); line-height: 1; }
.qz-score-den { font-family: var(--font-mono); font-size: 0.65rem; color: var(--text3); letter-spacing: 0.06em; }
.qz-results-h { font-family: var(--font-body); font-size: clamp(1.5rem, 4vw, 2.4rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 0.5rem; }
.qz-results-h em { font-style: italic; color: var(--gold); }
.qz-results-sub { font-family: var(--font-ui); font-size: 0.88rem; color: var(--text2); margin-bottom: 2rem; }

.qz-review { display: flex; flex-direction: column; gap: 6px; text-align: left; margin-bottom: 2rem; }
.qz-review-row {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px;
  border-radius: 7px; border: 1px solid var(--border); background: var(--bg2);
  font-family: var(--font-ui); font-size: 0.78rem; color: var(--text2);
}
.qz-review-row.c { border-color: rgba(74,222,128,0.25); }
.qz-review-row.w { border-color: rgba(248,113,113,0.25); }
.qz-review-row.s { border-color: var(--border); opacity: 0.55; }
.qz-review-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
.qz-review-dot.c { background: #4ade80; }
.qz-review-dot.w { background: #f87171; }
.qz-review-dot.s { background: var(--text3); }

.qz-results-actions { display: flex; align-items: center; gap: 1rem; justify-content: center; flex-wrap: wrap; }
.qz-retake-btn { font-family: var(--font-ui); font-size: 0.88rem; font-weight: 600; background: var(--text); color: var(--bg); padding: 11px 28px; border-radius: 6px; border: none; cursor: pointer; transition: opacity 0.15s; }
.qz-retake-btn:hover { opacity: 0.85; }
.qz-back-link { font-family: var(--font-ui); font-size: 0.85rem; color: var(--text3); text-decoration: none; transition: color 0.15s; }
.qz-back-link:hover { color: var(--text); }

/* Time per question display */
.qz-stat-row { display: flex; gap: 1.25rem; justify-content: center; margin-bottom: 1.75rem; }
.qz-stat { text-align: center; }
.qz-stat-val { font-family: var(--font-body); font-size: 1.4rem; font-weight: 700; color: var(--text); letter-spacing: -0.03em; line-height: 1; margin-bottom: 3px; }
.qz-stat-label { font-family: var(--font-ui); font-size: 0.65rem; color: var(--text3); letter-spacing: 0.05em; text-transform: uppercase; }
`;

/* ─── Placeholder questions (10 mixed subjects) ─────────────────
   Replace these with a real data fetch from Supabase or a JSON file.
   Shape: { id, subject, topic, question, options[4], answer(0-3), explanation }
─────────────────────────────────────────────────────────────────── */
const QUIZ_QUESTIONS = [
  { id: 'q1', subject: 'Polity', topic: 'Constitution', question: 'Which Schedule of the Indian Constitution contains the Oath of Office for the President of India?', options: ['Second Schedule', 'Third Schedule', 'Fourth Schedule', 'Fifth Schedule'] as [string,string,string,string], answer: 1 as const, explanation: 'The Third Schedule contains the oaths and affirmations for constitutional offices.' },
  { id: 'q2', subject: 'History', topic: 'Modern India', question: 'The Permanent Settlement of 1793 was introduced by which Governor-General?', options: ['Warren Hastings', 'Lord Cornwallis', 'Lord Wellesley', 'Lord Dalhousie'] as [string,string,string,string], answer: 1 as const, explanation: 'Lord Cornwallis introduced the Permanent Settlement, fixing land revenue permanently with zamindars in Bengal.' },
  { id: 'q3', subject: 'Geography', topic: 'Physical Geography', question: 'The \'rain shadow\' effect refers to which phenomenon?', options: ['Rainfall caused by urban heat islands', 'Dry region on the leeward side of a mountain range', 'Seasonal rainfall in coastal areas', 'Rainfall due to orographic uplift on windward slopes'] as [string,string,string,string], answer: 1 as const, explanation: 'A rain shadow is an area of dry land on the leeward (downwind) side of a mountain range.' },
  { id: 'q4', subject: 'Economy', topic: 'Basic Concepts', question: 'Which of the following is NOT a component of India\'s Gross National Product (GNP)?', options: ['Income earned by Indian citizens abroad', 'Value of goods produced by Indian-owned firms overseas', 'Income of foreign nationals working in India', 'Private consumption expenditure within India'] as [string,string,string,string], answer: 2 as const, explanation: 'GNP includes income earned by nationals regardless of location, but excludes income of foreigners in India that is counted in GDP, not GNP.' },
  { id: 'q5', subject: 'Environment', topic: 'Biodiversity', question: 'Project Tiger was launched in India in which year?', options: ['1968', '1973', '1980', '1985'] as [string,string,string,string], answer: 1 as const, explanation: 'Project Tiger was launched in 1973 under Prime Minister Indira Gandhi to protect the Bengal tiger.' },
  { id: 'q6', subject: 'Science', topic: 'Health & Disease', question: 'Which of the following diseases is caused by a deficiency of Vitamin C?', options: ['Rickets', 'Beriberi', 'Scurvy', 'Pellagra'] as [string,string,string,string], answer: 2 as const, explanation: 'Scurvy is caused by Vitamin C (ascorbic acid) deficiency. Rickets = Vit D, Beriberi = Vit B1, Pellagra = Niacin.' },
  { id: 'q7', subject: 'Polity', topic: 'Parliament', question: 'Which article of the Indian Constitution provides for the joint sitting of both Houses of Parliament?', options: ['Article 107', 'Article 108', 'Article 110', 'Article 112'] as [string,string,string,string], answer: 1 as const, explanation: 'Article 108 provides for a joint sitting of both Houses of Parliament to resolve a deadlock on a bill.' },
  { id: 'q8', subject: 'History', topic: 'Ancient India', question: 'The \'Arthashastra\' is attributed to which ancient Indian scholar?', options: ['Patanjali', 'Charaka', 'Kautilya', 'Aryabhata'] as [string,string,string,string], answer: 2 as const, explanation: 'The Arthashastra, a treatise on statecraft and economic policy, is attributed to Kautilya (also known as Chanakya or Vishnugupta).' },
  { id: 'q9', subject: 'Economy', topic: 'Banking', question: 'The Monetary Policy Committee (MPC) of India is chaired by whom?', options: ['Finance Minister of India', 'Deputy Governor of RBI (in charge of monetary policy)', 'Governor of the Reserve Bank of India', 'Chief Economic Adviser to the Government'] as [string,string,string,string], answer: 2 as const, explanation: 'The MPC is chaired by the Governor of the Reserve Bank of India, with six members total.' },
  { id: 'q10', subject: 'Environment', topic: 'Climate Change', question: 'The Paris Agreement (2015) aims to limit global temperature rise to well below how many degrees Celsius above pre-industrial levels?', options: ['1.0°C', '1.5°C', '2.0°C', '2.5°C'] as [string,string,string,string], answer: 2 as const, explanation: 'The Paris Agreement aims to limit warming to well below 2°C above pre-industrial levels, with efforts to limit it to 1.5°C.' },
];

const TIME_PER_Q = 60; // seconds
const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

type Phase = 'intro' | 'quiz' | 'results';

export default function PrelimsQuizPage() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(QUIZ_QUESTIONS.length).fill(null));
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [startTime, setStartTime] = useState<number>(0);
  const [totalTime, setTotalTime] = useState(0);

  const current = QUIZ_QUESTIONS[qIndex];
  const picked = answers[qIndex];
  const revealed = picked != null;

  // Countdown timer per question
  useEffect(() => {
    if (phase !== 'quiz' || revealed) return;
    if (timeLeft <= 0) {
      // auto-skip
      setAnswers(prev => { const a = [...prev]; a[qIndex] = -1; return a; });
      return;
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, revealed, timeLeft, qIndex]);

  const startQuiz = useCallback(() => {
    setPhase('quiz');
    setQIndex(0);
    setAnswers(Array(QUIZ_QUESTIONS.length).fill(null));
    setTimeLeft(TIME_PER_Q);
    setStartTime(Date.now());
  }, []);

  const chooseOption = useCallback((idx: number) => {
    if (revealed) return;
    setAnswers(prev => { const a = [...prev]; a[qIndex] = idx; return a; });
  }, [revealed, qIndex]);

  const goNext = useCallback(() => {
    if (qIndex < QUIZ_QUESTIONS.length - 1) {
      setQIndex(i => i + 1);
      setTimeLeft(TIME_PER_Q);
    } else {
      setTotalTime(Math.round((Date.now() - startTime) / 1000));
      setPhase('results');
    }
  }, [qIndex, startTime]);

  const correct = answers.filter((a, i) => a === QUIZ_QUESTIONS[i].answer).length;
  const skipped = answers.filter(a => a === null || a === -1).length;

  const timerClass = timeLeft > 30 ? 'ok' : timeLeft > 10 ? 'warn' : 'red';
  const timerPct = (timeLeft / TIME_PER_Q) * 100;

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="qz-wrap">

        {/* ── Intro ── */}
        {phase === 'intro' && (
          <div className="qz-intro">
            <div className="qz-intro-icon">⚡</div>
            <h1 className="qz-intro-h">Daily Quiz.<br /><em>10 questions.</em></h1>
            <p className="qz-intro-sub">
              Mixed subjects Polity, History, Geography, Economy, Environment, Science.
              60 seconds per question. Explanations revealed after each answer.
            </p>
            <button className="qz-start-btn" onClick={startQuiz}>Start Quiz →</button>
          </div>
        )}

        {/* ── Quiz ── */}
        {phase === 'quiz' && (
          <div className="qz-screen">
            {/* Overall progress */}
            <div className="qz-progress-bar-wrap">
              <div className="qz-progress-bar-fill" style={{ width: `${((qIndex + (revealed ? 1 : 0)) / QUIZ_QUESTIONS.length) * 100}%` }} />
            </div>

            <div className="qz-meta">
              <span className="qz-qnum">Question {qIndex + 1} of {QUIZ_QUESTIONS.length} · {current.subject}</span>
              <span className={`qz-timer ${timerClass}`}>{fmtTime(timeLeft)}</span>
            </div>

            {/* Per-question timer strip */}
            <div className="qz-timer-strip-wrap">
              <div className="qz-timer-strip" style={{
                width: `${timerPct}%`,
                background: timerClass === 'ok' ? 'var(--accent)' : timerClass === 'warn' ? '#fbbf24' : '#f87171',
                transition: 'width 1s linear, background 0.3s',
              }} />
            </div>

            <div className="qz-card">
              <div className="qz-question">{current.question}</div>
              <div className="qz-options">
                {current.options.map((opt, idx) => {
                  let cls = 'qz-opt';
                  if (revealed) {
                    if (idx === current.answer) cls += ' correct';
                    else if (idx === picked) cls += ' wrong';
                    else cls += ' neutral';
                  }
                  return (
                    <button key={idx} className={cls} onClick={() => chooseOption(idx)} disabled={revealed}>
                      <span className="qz-opt-key">{OPTION_KEYS[idx]}</span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div className="qz-expl">
                  <strong>{(picked === current.answer) ? '✓ Correct.' : picked === -1 ? '⏱ Time up.' : '✗ Incorrect.'}</strong>{' '}
                  {current.explanation}
                </div>
              )}
            </div>

            {revealed && (
              <button className="qz-next" onClick={goNext}>
                {qIndex < QUIZ_QUESTIONS.length - 1 ? 'Next Question →' : 'See Results →'}
              </button>
            )}
          </div>
        )}

        {/* ── Results ── */}
        {phase === 'results' && (
          <div className="qz-results">
            <div className="qz-score-ring">
              <div className="qz-score-num">{correct}</div>
              <div className="qz-score-den">/ {QUIZ_QUESTIONS.length}</div>
            </div>

            <h2 className="qz-results-h">
              {correct >= 8 ? (<>Excellent<br /><em>performance.</em></>) :
               correct >= 6 ? (<>Good.<br /><em>Keep pushing.</em></>) :
               (<>Needs more<br /><em>practice.</em></>)}
            </h2>
            <p className="qz-results-sub">
              {correct} correct · {QUIZ_QUESTIONS.length - correct - skipped} wrong · {skipped} skipped
            </p>

            <div className="qz-stat-row">
              <div className="qz-stat">
                <div className="qz-stat-val">{correct}</div>
                <div className="qz-stat-label">Correct</div>
              </div>
              <div className="qz-stat">
                <div className="qz-stat-val">{QUIZ_QUESTIONS.length - correct - Math.max(0,skipped)}</div>
                <div className="qz-stat-label">Wrong</div>
              </div>
              <div className="qz-stat">
                <div className="qz-stat-val">{fmtTime(totalTime)}</div>
                <div className="qz-stat-label">Time Taken</div>
              </div>
              <div className="qz-stat">
                <div className="qz-stat-val">{Math.round((correct / QUIZ_QUESTIONS.length) * 100)}%</div>
                <div className="qz-stat-label">Accuracy</div>
              </div>
            </div>

            {/* Review */}
            <div className="qz-review">
              {QUIZ_QUESTIONS.map((q, i) => {
                const ans = answers[i];
                const isCorrect = ans === q.answer;
                const isSkip = ans === null || ans === -1;
                const cls = isSkip ? 's' : isCorrect ? 'c' : 'w';
                return (
                  <div key={q.id} className={`qz-review-row ${cls}`}>
                    <div className={`qz-review-dot ${cls}`} />
                    <div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text)', marginBottom: 2 }}>
                        {i + 1}. {q.question.slice(0, 80)}{q.question.length > 80 ? '…' : ''}
                      </div>
                      {!isSkip && !isCorrect && (
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--text3)' }}>
                          Correct: {q.options[q.answer]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="qz-results-actions">
              <button className="qz-retake-btn" onClick={startQuiz}>Retake Quiz</button>
              <Link href="/prelims" className="qz-back-link">← Back to Prelims</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
