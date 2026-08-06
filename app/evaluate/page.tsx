'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

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

// onboarding IDs → subjects registry IDs
// user_profiles stores 'political-science' and 'public-administration'
// but subjects registry uses 'polsci' and 'pub-admin'
const OPTIONAL_ID_MAP: Record<string, string> = {
  'political-science':     'polsci',
  'public-administration': 'pub-admin',
}
const OPTIONAL_LABEL: Record<string, string> = {
  sociology:              'Sociology',
  anthropology:           'Anthropology',
  geography:              'Geography',
  'political-science':    'PSIR',
  'public-administration':'Public Administration',
  history:                'History',
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB for PDFs
const MARKS_OPTIONS = ['10', '15', '20']

// ── Auto-extract question from first image via API ───────────────────────────
async function extractQuestion(file: File): Promise<string> {
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/extract-question', { method: 'POST', body: fd })
    const data = await res.json()
    return data.question ?? ''
  } catch { return '' }
}

const CHECKPOINTS = [
  'Reading handwriting',
  'Analysing structure',
  'Evaluating arguments',
  'Scoring sections',
  'Writing model answer',
]

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@keyframes fadeUp   { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
@keyframes spin     { to   { transform: rotate(360deg) } }
@keyframes progress { from { width:0% } to { width:100% } }

.ev-page { min-height:100vh; }

.ev-header {
  max-width:1200px; margin:0 auto;
  padding: 100px 2rem 3rem;
  border-bottom: 1px solid var(--border);
  animation: fadeUp 0.3s ease;
}
.ev-kicker {
  font-family:var(--font-ui); font-size:0.65rem;
  letter-spacing:0.18em; text-transform:uppercase; color:var(--text3);
  margin-bottom:1.5rem; display:flex; align-items:center; gap:10px;
}
.ev-h1 {
  font-family:var(--font-body); font-size:clamp(2.2rem,5vw,3.8rem);
  font-weight:700; letter-spacing:-0.035em; line-height:1.02; color:var(--text);
  margin-bottom:0.75rem;
}
.ev-h1 em { font-style:italic; color:var(--accent3); }
.ev-tagline { font-family:var(--font-ui); font-size:0.88rem; color:var(--text3); line-height:1.7; }
.ev-optional-pill {
  display:inline-flex; align-items:center; gap:7px;
  margin-top:1rem; padding:5px 12px; border-radius:5px;
  background:var(--accent-dim); border:1px solid var(--accent-glow);
  font-family:var(--font-ui); font-size:0.75rem; color:var(--accent3); font-weight:600;
}
.ev-optional-dot { width:6px; height:6px; border-radius:50%; background:var(--accent3); }

/* Body 2-col */
.ev-body {
  max-width:1200px; margin:0 auto;
  display:grid; grid-template-columns:1fr 360px;
  border-bottom:1px solid var(--border);
  animation:fadeUp 0.35s ease;
}
.ev-form-col { border-right:1px solid var(--border); }

.ev-section-label {
  padding:1.5rem 2rem 1.25rem;
  font-family:var(--font-ui); font-size:0.62rem;
  letter-spacing:0.18em; text-transform:uppercase; color:var(--text3);
  display:flex; align-items:center; gap:10px;
  border-bottom:1px solid var(--border);
}

/* Upload */
.ev-upload-zone {
  margin:1.75rem 2rem;
  border:1px solid var(--border2); border-radius:8px;
  background:var(--bg2); padding:2rem; text-align:center;
  cursor:pointer; transition:border-color 0.15s, background 0.15s; position:relative;
}
.ev-upload-zone:hover, .ev-upload-zone.drag { border-color:var(--accent); background:var(--bg3); }
.ev-upload-icon {
  width:40px; height:40px; border-radius:8px;
  background:var(--bg3); border:1px solid var(--border2);
  display:flex; align-items:center; justify-content:center;
  margin:0 auto 1rem; color:var(--text3);
}
.ev-upload-title { font-family:var(--font-ui); font-size:0.88rem; color:var(--text2); margin-bottom:0.3rem; }
.ev-upload-sub   { font-family:var(--font-ui); font-size:0.75rem; color:var(--text3); }
.ev-upload-input { position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%; }

.ev-previews { display:flex; gap:0.5rem; flex-wrap:wrap; padding:0 2rem 1.5rem; }
.ev-preview-wrap { position:relative; display:inline-block; }
.ev-preview-thumb { width:72px; height:72px; border-radius:6px; object-fit:cover; border:1px solid var(--border2); }
.ev-preview-rm {
  position:absolute; top:-6px; right:-6px;
  width:18px; height:18px; border-radius:50%;
  background:var(--bg4); border:1px solid var(--border2);
  color:var(--text3); font-size:11px; cursor:pointer;
  display:flex; align-items:center; justify-content:center; transition:color 0.1s;
}
.ev-preview-rm:hover { color:var(--text); }

.ev-field { padding:0 2rem 1.5rem; }
.ev-field-label {
  font-family:var(--font-ui); font-size:0.72rem;
  letter-spacing:0.08em; text-transform:uppercase; color:var(--text3);
  margin-bottom:0.6rem; display:block;
}
.ev-textarea {
  width:100%; resize:vertical; min-height:90px;
  background:var(--bg2); border:1px solid var(--border2);
  border-radius:6px; padding:0.75rem 1rem;
  font-family:var(--font-ui); font-size:0.85rem; color:var(--text);
  line-height:1.6; outline:none; transition:border-color 0.15s; box-sizing:border-box;
}
.ev-textarea:focus { border-color:var(--border3); }
.ev-textarea::placeholder { color:var(--text3); }

.ev-marks-row {
  display:flex; border:1px solid var(--border2); border-radius:6px;
  overflow:hidden; width:fit-content;
}
.ev-marks-cell {
  padding:0.5rem 1.25rem;
  font-family:var(--font-ui); font-size:0.82rem; font-weight:600;
  color:var(--text2); cursor:pointer; border-right:1px solid var(--border2);
  transition:background 0.12s, color 0.12s; background:var(--bg2);
}
.ev-marks-cell:last-child { border-right:none; }
.ev-marks-cell:hover { background:var(--bg3); color:var(--text); }
.ev-marks-cell.active { background:var(--accent-dim); color:var(--accent3); }

.ev-submit-wrap { padding:1.5rem 2rem 2rem; }
.ev-submit {
  width:100%; padding:0.85rem;
  font-family:var(--font-ui); font-size:0.88rem; font-weight:600;
  background:var(--text); color:var(--bg);
  border:none; border-radius:7px; cursor:pointer;
  transition:opacity 0.15s; letter-spacing:0.01em;
}
.ev-submit:hover:not(:disabled) { opacity:0.88; }
.ev-submit:disabled { opacity:0.4; cursor:not-allowed; }
.ev-err {
  margin:0 2rem 1rem;
  background:rgba(248,113,113,0.07); border:1px solid rgba(248,113,113,0.2);
  border-radius:6px; padding:0.65rem 1rem;
  font-family:var(--font-ui); font-size:0.8rem; color:#f87171;
}

/* Sidebar */
.ev-sidebar { padding:0; }
.ev-sidebar-block { padding:1.75rem; border-bottom:1px solid var(--border); }
.ev-sidebar-lbl {
  font-family:var(--font-ui); font-size:0.62rem;
  letter-spacing:0.18em; text-transform:uppercase; color:var(--text3);
  margin-bottom:1.25rem; display:flex; align-items:center; gap:10px;
}
.ev-step-row { display:flex; gap:0.75rem; margin-bottom:1rem; }
.ev-step-row:last-child { margin-bottom:0; }
.ev-step-num { font-family:var(--font-ui); font-size:0.68rem; font-weight:700; color:var(--accent3); min-width:18px; }
.ev-step-text { font-family:var(--font-ui); font-size:0.8rem; color:var(--text3); line-height:1.55; }
.ev-step-text strong { color:var(--text2); font-weight:600; display:block; margin-bottom:2px; }
.ev-tip { font-family:var(--font-ui); font-size:0.8rem; color:var(--text3); line-height:1.65; }
.ev-tip strong { color:var(--text2); font-weight:600; }

/* Upgrade banner */
.ev-upgrade {
  margin:1.5rem 2rem;
  padding:1.25rem 1.5rem;
  border:1px solid var(--accent-glow); border-radius:8px;
  background:var(--accent-dim);
}
.ev-upgrade-title { font-family:var(--font-body); font-size:1rem; font-weight:700; color:var(--text); margin-bottom:0.35rem; letter-spacing:-0.01em; }
.ev-upgrade-sub { font-family:var(--font-ui); font-size:0.8rem; color:var(--text3); line-height:1.6; margin-bottom:1rem; }
.ev-upgrade-btn {
  display:inline-block; padding:0.6rem 1.25rem; border-radius:6px;
  background:var(--text); color:var(--bg);
  font-family:var(--font-ui); font-size:0.82rem; font-weight:600;
  text-decoration:none; transition:opacity 0.15s;
}
.ev-upgrade-btn:hover { opacity:0.88; }

/* Loading */
.ev-loading {
  max-width:1200px; margin:0 auto;
  padding:5rem 2rem; text-align:center;
  animation:fadeUp 0.3s ease;
}
.ev-loading-title { font-family:var(--font-body); font-size:1.6rem; font-weight:700; color:var(--text); letter-spacing:-0.02em; margin-bottom:0.5rem; }
.ev-loading-sub { font-family:var(--font-ui); font-size:0.82rem; color:var(--text3); margin-bottom:2.5rem; }
.ev-progress-track { max-width:320px; margin:0 auto 2rem; height:2px; background:var(--border2); border-radius:2px; overflow:hidden; }
.ev-progress-bar { height:100%; background:var(--accent); animation:progress linear forwards; }
.ev-checkpoints { display:flex; flex-direction:column; gap:0.6rem; max-width:240px; margin:0 auto; }
.ev-checkpoint { display:flex; align-items:center; gap:10px; font-family:var(--font-ui); font-size:0.78rem; color:var(--text3); transition:color 0.3s; }
.ev-checkpoint.done { color:var(--text2); }
.ev-checkpoint.active { color:var(--accent3); }
.ev-cp-dot { width:6px; height:6px; border-radius:50%; background:var(--border2); flex-shrink:0; transition:background 0.3s; }
.ev-checkpoint.done .ev-cp-dot   { background:var(--text3); }
.ev-checkpoint.active .ev-cp-dot { background:var(--accent3); }

/* Results */
.ev-results {
  max-width:1200px; margin:0 auto;
  display:grid; grid-template-columns:1fr 320px;
  border-bottom:1px solid var(--border);
  animation:fadeUp 0.4s ease;
}
.ev-score-col { border-left:1px solid var(--border); }
.ev-score-block { padding:1.75rem; border-bottom:1px solid var(--border); }
.ev-score-lbl {
  font-family:var(--font-ui); font-size:0.62rem;
  letter-spacing:0.18em; text-transform:uppercase; color:var(--text3);
  margin-bottom:1.25rem; display:flex; align-items:center; gap:10px;
}
.ev-score-big { font-family:var(--font-body); font-size:3.5rem; font-weight:700; letter-spacing:-0.05em; color:var(--text); line-height:1; margin-bottom:0.25rem; }
.ev-score-denom { font-family:var(--font-ui); font-size:0.82rem; color:var(--text3); }
.ev-score-bar-track { height:3px; background:var(--border2); border-radius:2px; margin-top:1rem; overflow:hidden; }
.ev-score-bar-fill { height:100%; border-radius:2px; transition:width 0.8s ease; }
.ev-ss-row { display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1.75rem; border-bottom:1px solid var(--border); font-family:var(--font-ui); font-size:0.8rem; }
.ev-ss-row:last-child { border-bottom:none; }
.ev-ss-name { color:var(--text2); }
.ev-ss-score { color:var(--text); font-weight:600; }
.ev-ss-reason { color:var(--text3); font-size:0.72rem; margin-top:2px; }
.ev-score-actions { padding:1.75rem; display:flex; flex-direction:column; gap:0.75rem; }
.ev-btn-ghost {
  padding:0.75rem; border-radius:6px; font-family:var(--font-ui); font-size:0.82rem; font-weight:600;
  background:transparent; color:var(--text2); border:1px solid var(--border2); cursor:pointer;
  transition:background 0.12s, color 0.12s; text-align:center; width:100%;
}
.ev-btn-ghost:hover { background:var(--bg2); color:var(--text); }
.ev-btn-model-answer {
  padding:0.85rem; border-radius:6px; font-family:var(--font-ui); font-size:0.88rem; font-weight:700;
  background:var(--accent-dim); color:var(--accent3); border:1px solid var(--accent-glow); cursor:pointer;
  transition:background 0.12s, color 0.12s; text-align:center; width:100%; display:block; text-decoration:none;
  letter-spacing:0.02em;
}
.ev-btn-model-answer:hover { background:var(--accent); color:#fff; }

.ev-main-col { padding:0; }
.ev-result-section { border-bottom:1px solid var(--border); padding:1.75rem 2rem; }
.ev-result-section:last-child { border-bottom:none; }
.ev-result-lbl {
  font-family:var(--font-ui); font-size:0.62rem;
  letter-spacing:0.18em; text-transform:uppercase; color:var(--text3);
  margin-bottom:1rem; display:flex; align-items:center; gap:10px;
}
.ev-demand-item { display:flex; align-items:flex-start; gap:8px; font-family:var(--font-ui); font-size:0.95rem; color:var(--text2); line-height:1.6; margin-bottom:0.4rem; }
.ev-demand-item::before { content:''; display:inline-block; width:5px; height:5px; border-radius:50%; background:var(--accent3); flex-shrink:0; margin-top:8px; }
.ev-feedback-grid { display:grid; grid-template-columns:1fr 1fr; border:1px solid var(--border); border-radius:6px; overflow:hidden; }
.ev-fb-col-label { padding:0.6rem 1rem; font-family:var(--font-ui); font-size:0.72rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; border-bottom:1px solid var(--border); }
.ev-fb-col.strengths .ev-fb-col-label { color:#4ade80; }
.ev-fb-col.weaknesses .ev-fb-col-label { color:#f87171; }
.ev-fb-col.weaknesses { border-left:1px solid var(--border); }
.ev-fb-items { padding:0.75rem 1rem; display:flex; flex-direction:column; gap:0.5rem; }
.ev-fb-item { font-family:var(--font-ui); font-size:0.92rem; color:var(--text2); line-height:1.6; display:flex; gap:7px; align-items:flex-start; }
.ev-fb-item::before { content:''; display:inline-block; width:4px; height:4px; border-radius:50%; flex-shrink:0; margin-top:8px; }
.ev-fb-col.strengths .ev-fb-item::before { background:#4ade80; }
.ev-fb-col.weaknesses .ev-fb-item::before { background:#f87171; }
.ev-suggestions { display:flex; flex-direction:column; gap:0.5rem; margin-top:1rem; }
.ev-suggestion { font-family:var(--font-ui); font-size:0.92rem; color:var(--text2); line-height:1.6; padding:0.6rem 0.9rem; background:var(--bg2); border-radius:5px; border-left:2px solid var(--accent-dim); }
.ev-overall { font-family:var(--font-ui); font-size:0.95rem; color:var(--text2); line-height:1.8; }
.ev-thinkers { display:flex; flex-direction:column; gap:0.75rem; }
.ev-thinker { padding:0.9rem 1.1rem; border:1px solid var(--border2); border-radius:6px; background:var(--bg2); border-left:2px solid var(--accent); }
.ev-thinker-name { font-family:var(--font-ui); font-size:0.95rem; font-weight:700; color:var(--text); margin-bottom:2px; }
.ev-thinker-work { font-size:0.82rem; color:var(--text3); margin-bottom:4px; }
.ev-thinker-arg  { font-size:0.92rem; color:var(--text2); line-height:1.6; }
.ev-question-bar {
  max-width:1200px; margin:0 auto;
  padding:1rem 2rem;
  border-bottom:1px solid var(--border);
  display:flex; align-items:flex-start; gap:0.75rem;
  background:var(--bg2);
}
.ev-question-bar-label {
  font-family:var(--font-ui); font-size:0.6rem;
  letter-spacing:0.18em; text-transform:uppercase; color:var(--text3);
  white-space:nowrap; padding-top:2px; flex-shrink:0;
}
.ev-question-bar-text {
  font-family:var(--font-ui); font-size:0.92rem; color:var(--text2); line-height:1.6;
}
.ev-model-answer { display:flex; flex-direction:column; gap:1rem; }
.ev-ma-part-label { font-family:var(--font-ui); font-size:0.72rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--text3); margin-bottom:0.35rem; }
.ev-ma-text { font-family:var(--font-ui); font-size:0.95rem; color:var(--text2); line-height:1.8; }
.ev-ma-body-item { display:flex; gap:8px; align-items:flex-start; font-family:var(--font-ui); font-size:0.95rem; color:var(--text2); line-height:1.7; margin-bottom:0.5rem; }
.ev-ma-body-item::before { content:''; display:inline-block; width:5px; height:5px; border-radius:50%; background:var(--accent3); flex-shrink:0; margin-top:8px; }
.ev-wc-badge { display:inline-flex; align-items:center; gap:6px; font-family:var(--font-ui); font-size:0.82rem; padding:3px 10px; border-radius:4px; margin-top:0.5rem; }
.ev-wc-badge.short       { background:rgba(248,113,113,0.1); color:#f87171; }
.ev-wc-badge.appropriate { background:rgba(74,222,128,0.1);  color:#4ade80; }
.ev-wc-badge.long        { background:rgba(251,191,36,0.1);  color:#fbbf24; }

@media(max-width:900px){
  .ev-body    { grid-template-columns:1fr; }
  .ev-form-col{ border-right:none; border-bottom:1px solid var(--border); }
  .ev-results { grid-template-columns:1fr; }
  .ev-score-col { border-left:none; border-top:1px solid var(--border); }
  .ev-feedback-grid { grid-template-columns:1fr; }
  .ev-fb-col.weaknesses { border-left:none; border-top:1px solid var(--border); }
}
@media(max-width:640px){
  .ev-header { padding:88px 1.25rem 2rem; }
  .ev-h1 { font-size:clamp(1.9rem,9vw,2.6rem); margin-bottom:0.5rem; }
  .ev-tagline { font-size:0.82rem; }
  .ev-kicker { font-size:0.6rem; }

  .ev-section-label { padding:1.25rem 1.25rem 1rem; }
  .ev-upload-zone { margin:1.25rem; padding:1.5rem 1rem; }
  .ev-previews { padding:0 1.25rem 1.25rem; }
  .ev-field { padding:0 1.25rem 1.25rem; }
  .ev-submit-wrap { padding:1.25rem 1.25rem 1.75rem; }
  .ev-err { margin:0 1.25rem 0.75rem; }

  .ev-marks-row { width:100%; }
  .ev-marks-cell { flex:1; text-align:center; padding:0.65rem 0.5rem; }

  .ev-sidebar-block { padding:1.25rem; }

  .ev-loading { padding:3rem 1.25rem; }
  .ev-loading-title { font-size:1.3rem; }

  .ev-question-bar { padding:0.75rem 1.25rem; }
  .ev-result-section { padding:1.25rem; }
  .ev-result-lbl { font-size:0.6rem; margin-bottom:0.75rem; }
  .ev-fb-col-label { padding:0.5rem 0.85rem; }
  .ev-fb-items { padding:0.6rem 0.85rem; }
  .ev-fb-item { font-size:0.88rem; }
  .ev-overall { font-size:0.92rem; }
  .ev-suggestion { font-size:0.88rem; padding:0.5rem 0.75rem; }
  .ev-thinker { padding:0.75rem 1rem; }
  .ev-thinker-name { font-size:0.92rem; }
  .ev-ma-text { font-size:0.92rem; }
  .ev-ma-body-item { font-size:0.92rem; }

  .ev-score-block { padding:1.25rem; }
  .ev-score-big { font-size:2.8rem; }
  .ev-score-lbl { padding:1.25rem 1.25rem 0.6rem; }
  .ev-ss-row { padding:0.65rem 1.25rem; font-size:0.78rem; }
  .ev-score-actions { padding:1.25rem; }
  .ev-btn-ghost { padding:0.65rem; font-size:0.8rem; }

  .ev-upgrade { margin:1.25rem; padding:1rem 1.25rem; }
}
`

function scoreColor(pct: number) {
  if (pct >= 0.7) return '#4ade80'
  if (pct >= 0.5) return '#fbbf24'
  return '#f87171'
}

function SectionCard({ label, data }: {
  label: string
  data: { what_was_written?: string; strengths: string[]; weaknesses?: string[]; analysis?: string; suggestions?: string[] }
}) {
  return (
    <div className="ev-result-section">
      <div className="ev-result-lbl">{label}</div>
      {data.what_was_written && (
        <p style={{ fontFamily:'var(--font-ui)', fontSize:'0.95rem', color:'var(--text3)', marginBottom:'1rem', fontStyle:'italic', lineHeight:1.7 }}>
          &ldquo;{data.what_was_written}&rdquo;
        </p>
      )}
      {((data.strengths?.length ?? 0) > 0 || (data.weaknesses?.length ?? 0) > 0) && (
        <div className="ev-feedback-grid" style={{ marginBottom: data.suggestions?.length ? '1rem' : 0 }}>
          <div className="ev-fb-col strengths">
            <div className="ev-fb-col-label">Strengths</div>
            <div className="ev-fb-items">
              {data.strengths.length
                ? data.strengths.map((s,i) => <div key={i} className="ev-fb-item">{s}</div>)
                : <div className="ev-fb-item" style={{color:'var(--text3)'}}>None noted</div>}
            </div>
          </div>
          <div className="ev-fb-col weaknesses">
            <div className="ev-fb-col-label">Weaknesses</div>
            <div className="ev-fb-items">
              {(data.weaknesses ?? []).length
                ? (data.weaknesses ?? []).map((w,i) => <div key={i} className="ev-fb-item">{w}</div>)
                : <div className="ev-fb-item" style={{color:'var(--text3)'}}>None noted</div>}
            </div>
          </div>
        </div>
      )}
      {data.analysis && <p style={{ fontFamily:'var(--font-ui)', fontSize:'0.95rem', color:'var(--text3)', lineHeight:1.75, marginBottom: data.suggestions?.length ? '0.75rem' : 0 }}>{data.analysis}</p>}
      {(data.suggestions ?? []).length > 0 && (
        <div className="ev-suggestions">
          {(data.suggestions ?? []).map((s,i) => <div key={i} className="ev-suggestion">{s}</div>)}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EvaluatePage() {
  const router = useRouter()
  const [user, setUser]               = useState<User | null>(null)
  const [optionalId, setOptionalId]   = useState<string | null>(null)   // from user_profiles (raw)
  const [profileLoading, setProfileLoading] = useState(true)
  const [files, setFiles]             = useState<File[]>([])
  const [previews, setPreviews]       = useState<string[]>([])
  const [question, setQuestion]       = useState('')
  const [marks, setMarks]             = useState('15')
  const [drag, setDrag]               = useState(false)
  const [loading, setLoading]         = useState(false)
  const [cpStep, setCpStep]           = useState(-1)
  const [result, setResult]           = useState<Evaluation | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const [extractingQ, setExtractingQ] = useState(false)
  const inputRef                      = useRef<HTMLInputElement>(null)
  const timerRef                      = useRef<NodeJS.Timeout | null>(null)

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

  // Checkpoint ticker during loading
  useEffect(() => {
    if (!loading) { setCpStep(-1); return }
    setCpStep(0)
    let step = 0
    timerRef.current = setInterval(() => {
      step++
      if (step < CHECKPOINTS.length) setCpStep(step)
      else clearInterval(timerRef.current!)
    }, 6000)
    return () => clearInterval(timerRef.current!)
  }, [loading])

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter(f =>
      (f.type.startsWith('image/') || f.type === 'application/pdf') && f.size < MAX_FILE_SIZE
    )
    setFiles(prev => [...prev, ...valid].slice(0, 10))
    valid.forEach(f => {
      if (f.type === 'application/pdf') {
        // Show a PDF placeholder preview
        setPreviews(prev => [...prev, '__pdf__'].slice(0, 10))
      } else {
        const reader = new FileReader()
        reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string].slice(0, 10))
        reader.readAsDataURL(f)
      }
    })
    // Auto-extract question from first image
    const firstImage = valid.find(f => f.type.startsWith('image/'))
    if (firstImage) {
      setExtractingQ(true)
      extractQuestion(firstImage).then(q => {
        if (q) setQuestion(q)
        setExtractingQ(false)
      }).catch(() => setExtractingQ(false))
    }
  }, []) // eslint-disable-line

  const removeFile = (i: number) => {
    setFiles(prev => prev.filter((_,idx) => idx !== i))
    setPreviews(prev => prev.filter((_,idx) => idx !== i))
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const handleSubmit = async () => {
    if (!user) { router.push('/login?next=/evaluate'); return }
    if (!files.length) { setError('Upload at least one image'); return }
    if (!question.trim()) { setError('Enter the question'); return }
    setError(null); setResult(null); setLoading(true)

    try {
      const token = await user.getIdToken()

      // Map onboarding ID → subjects registry ID
      if (!optionalId) {
        setError('Could not detect your optional subject. Please complete onboarding or refresh.')
        setLoading(false)
        return
      }
      const subjectId = OPTIONAL_ID_MAP[optionalId] ?? optionalId

      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      fd.append('question', question.trim())
      fd.append('marks', marks)
      fd.append('subject', subjectId)
      fd.append('lang', 'en')

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'x-user-token': token },
        body: fd,
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'limit_reached') { setLimitReached(true); return }
        setError(data.error ?? 'Evaluation failed')
        return
      }
      setResult(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setResult(null); setFiles([]); setPreviews([]); setQuestion(''); setError(null); setLimitReached(false)
  }

  const subjectLabel = optionalId ? (OPTIONAL_LABEL[optionalId] ?? optionalId) : null
  const pct = result ? result.marks / result.marks_out_of : 0

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ev-page">

        {/* Header */}
        <div className="ev-header">
          <div className="ev-kicker">AI Answer Evaluation</div>
          <h1 className="ev-h1">Upload. Get <em>evaluated.</em></h1>
          <p className="ev-tagline">Handwritten answer → marks, section-wise feedback, thinkers to cite, and a model answer.</p>
          {subjectLabel && (
            <div className="ev-optional-pill">
              <div className="ev-optional-dot" />
              {subjectLabel} Optional
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="ev-loading">
            <div className="ev-loading-title">Evaluating your answer…</div>
            <div className="ev-loading-sub">This takes 20–35 seconds</div>
            <div className="ev-progress-track">
              <div className="ev-progress-bar" style={{ animationDuration:'32s' }} />
            </div>
            <div className="ev-checkpoints">
              {CHECKPOINTS.map((cp, i) => (
                <div key={cp} className={`ev-checkpoint${i < cpStep ? ' done' : i === cpStep ? ' active' : ''}`}>
                  <div className="ev-cp-dot" />{cp}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Limit reached */}
        {limitReached && !loading && (
          <div className="ev-body" style={{ display:'block' }}>
            <div style={{ padding:'3rem 2rem', maxWidth:540 }}>
              <div className="ev-result-lbl">Free limit reached</div>
              <p style={{ fontFamily:'var(--font-body)', fontSize:'1.5rem', fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em', marginBottom:'0.5rem' }}>
                You&apos;ve used your free evaluation.
              </p>
              <p style={{ fontFamily:'var(--font-ui)', fontSize:'0.85rem', color:'var(--text3)', lineHeight:1.7, marginBottom:'1.5rem' }}>
                Upgrade to get unlimited evaluations, AI chat, PYQ bank access, and more.
              </p>
              <a href="/pricing" className="ev-upgrade-btn">See plans →</a>
              <button onClick={reset} className="ev-btn-ghost" style={{ marginTop:'1rem', padding:'0.6rem 1.25rem', width:'auto' }}>← Back</button>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
          <div className="ev-question-bar">
            <span className="ev-question-bar-label">Question</span>
            <span className="ev-question-bar-text">{question}</span>
          </div>
          <div className="ev-results">
            <div className="ev-main-col">
              <div className="ev-result-section">
                <div className="ev-result-lbl">What the question demands</div>
                {result.demand_of_question.map((d,i) => <div key={i} className="ev-demand-item">{d}</div>)}
              </div>

              <SectionCard label="Introduction" data={result.introduction} />

              <div className="ev-result-section">
                <div className="ev-result-lbl">Body</div>
                <div className="ev-feedback-grid" style={{ marginBottom: result.body.suggestions?.length ? '1rem' : 0 }}>
                  <div className="ev-fb-col strengths">
                    <div className="ev-fb-col-label">Strengths</div>
                    <div className="ev-fb-items">
                      {result.body.strengths.length
                        ? result.body.strengths.map((s,i) => <div key={i} className="ev-fb-item">{s}</div>)
                        : <div className="ev-fb-item" style={{color:'var(--text3)'}}>None noted</div>}
                    </div>
                  </div>
                  <div className="ev-fb-col weaknesses">
                    <div className="ev-fb-col-label">Weaknesses</div>
                    <div className="ev-fb-items">
                      {result.body.weaknesses.length
                        ? result.body.weaknesses.map((w,i) => <div key={i} className="ev-fb-item">{w}</div>)
                        : <div className="ev-fb-item" style={{color:'var(--text3)'}}>None noted</div>}
                    </div>
                  </div>
                </div>
                {result.body.suggestions?.length > 0 && (
                  <div className="ev-suggestions">
                    {result.body.suggestions.map((s,i) => <div key={i} className="ev-suggestion">{s}</div>)}
                  </div>
                )}
              </div>

              <SectionCard label="Conclusion" data={result.conclusion} />

              <div className="ev-result-section">
                <div className="ev-result-lbl">Overall feedback</div>
                <p className="ev-overall">{result.overall_feedback}</p>
                <div className={`ev-wc-badge ${result.word_count_rating}`}>
                  {result.word_count} words — {result.word_count_rating}
                </div>
              </div>

              {result.thinkers_to_cite?.length > 0 && (
                <div className="ev-result-section">
                  <div className="ev-result-lbl">Thinkers to cite</div>
                  <div className="ev-thinkers">
                    {result.thinkers_to_cite.map((t,i) => (
                      <div key={i} className="ev-thinker">
                        <div className="ev-thinker-name">{t.name}</div>
                        {t.work && <div className="ev-thinker-work">{t.work}</div>}
                        <div className="ev-thinker-arg">{t.argument}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}


            </div>

            <div className="ev-score-col">
              <div className="ev-score-block">
                <div className="ev-score-lbl">Score</div>
                <div className="ev-score-big" style={{ color: scoreColor(pct) }}>
                  {result.marks}
                  <span style={{ fontSize:'1.5rem', color:'var(--text3)', fontFamily:'var(--font-ui)', fontWeight:400 }}>/{result.marks_out_of}</span>
                </div>
                <div className="ev-score-denom">{Math.round(pct * 100)}% of total marks</div>
                <div className="ev-score-bar-track">
                  <div className="ev-score-bar-fill" style={{ width:`${pct*100}%`, background: scoreColor(pct) }} />
                </div>
              </div>
              <div className="ev-score-lbl" style={{ padding:'1.5rem 1.75rem 0.75rem', marginBottom:0 }}>Section breakdown</div>
              {(['introduction','body','conclusion','presentation'] as const).map(k => {
                const s = result.section_marks[k]
                return (
                  <div key={k} className="ev-ss-row">
                    <div>
                      <div className="ev-ss-name" style={{ textTransform:'capitalize' }}>{k}</div>
                      <div className="ev-ss-reason">{s.reasoning}</div>
                    </div>
                    <div className="ev-ss-score">{s.awarded}/{s.out_of}</div>
                  </div>
                )
              })}
              <div className="ev-score-actions">
                <a
                  href={`/chat?q=${encodeURIComponent(question)}`}
                  className="ev-btn-model-answer"
                >
                  Get model answer →
                </a>
                <button className="ev-btn-ghost" onClick={reset}>Evaluate another →</button>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {!loading && !result && !limitReached && (
          <div className="ev-body">
            <div className="ev-form-col">
              <div className="ev-section-label">Answer images</div>

              <div
                className={`ev-upload-zone${drag ? ' drag' : ''}`}
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
              >
                <div className="ev-upload-icon">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2v10M5 6l4-4 4 4M3 14h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="ev-upload-title">Drop images here or click to browse</div>
                <div className="ev-upload-sub">JPG, PNG, WEBP or PDF — max 20MB, up to 10 pages</div>
                <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple className="ev-upload-input"
                  onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
              </div>

              {previews.length > 0 && (
                <div className="ev-previews">
                  {previews.map((src, i) => (
                    <div key={i} className="ev-preview-wrap">
                      {src === '__pdf__'
                ? <div className="ev-preview-thumb" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg3)', fontSize:'0.65rem', color:'var(--text3)', fontFamily:'var(--font-ui)', flexDirection:'column', gap:3 }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    PDF
                  </div>
                : <img src={src} alt={`page ${i+1}`} className="ev-preview-thumb" />
              }
                      <button className="ev-preview-rm" onClick={() => removeFile(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="ev-field" style={{ borderTop:'1px solid var(--border)', paddingTop:'1.5rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:'var(--font-ui)', fontSize:'0.8rem', color:'var(--text3)', lineHeight:1.6 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
                    <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M7 6v4M7 4.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  {extractingQ
                    ? <span style={{ color:'var(--accent3)' }}>Reading question from your answer sheet…</span>
                    : files.length > 0
                      ? <span>Question auto-extracted — <span style={{ color:'var(--text2)' }}>review before submitting.</span></span>
                      : <span>Question will be auto-extracted from your answer sheet.</span>
                  }
                </div>
              </div>

              <div className="ev-field">
                <label className="ev-field-label">Marks</label>
                <div className="ev-marks-row">
                  {MARKS_OPTIONS.map(m => (
                    <div key={m} className={`ev-marks-cell${marks === m ? ' active' : ''}`} onClick={() => setMarks(m)}>
                      {m}M
                    </div>
                  ))}
                </div>
              </div>

              {error && <div className="ev-err">{error}</div>}

              <div className="ev-submit-wrap">
                <button className="ev-submit" onClick={handleSubmit} disabled={loading || profileLoading || extractingQ || files.length === 0}>
                  {profileLoading ? 'Loading…' : extractingQ ? 'Reading question…' : 'Evaluate answer →'}
                </button>
              </div>
            </div>

            <div className="ev-sidebar">
              <div className="ev-sidebar-block">
                <div className="ev-sidebar-lbl">How it works</div>
                {[
                  { n:'01', title:'Upload images', sub:'Photograph your handwritten answer — up to 10 pages.' },
                  { n:'02', title:'Add question + marks', sub:'Paste the exact question and select 10M / 15M / 20M.' },
                  { n:'03', title:'Get evaluated', sub:'Marks, section feedback, thinkers to cite, and a model answer.' },
                ].map(s => (
                  <div key={s.n} className="ev-step-row">
                    <div className="ev-step-num">{s.n}</div>
                    <div className="ev-step-text"><strong>{s.title}</strong>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="ev-sidebar-block">
                <div className="ev-sidebar-lbl">Tips</div>
                <div className="ev-tip">
                  <strong>Images or PDF.</strong> Upload JPG/PNG photos of your answer sheet, or a scanned PDF — up to 10 pages.<br/><br/>
                  <strong>Good lighting matters.</strong> Shoot in daylight, avoid shadows. Blurry images reduce accuracy.<br/><br/>
                  <strong>Question auto-fills.</strong> We try to read the question from your sheet — check and edit if needed.
                </div>
              </div>

              {!profileLoading && subjectLabel && (
                <div className="ev-sidebar-block">
                  <div className="ev-sidebar-lbl">Your optional</div>
                  <div className="ev-tip">
                    Evaluation is calibrated for <strong>{subjectLabel}</strong> — thinker roster, rubric weights, and model answers are all subject-specific.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
