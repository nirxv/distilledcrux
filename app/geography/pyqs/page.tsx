'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import questions from '@/public/data/geography-pyqs.json';

/* ─── Geography accent: dark green in light mode, lime-green in dark mode ─── */
const CSS = `
/* Accent tokens — overridden per theme */
.pyq-wrap{min-height:100vh;padding:80px 0 96px;background:var(--bg);}
.pyq-inner{max-width:860px;margin:0 auto;padding:0 2rem;}

.pyq-filter-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px;}
.pyq-filter-select{
  appearance:none;-webkit-appearance:none;
  background:var(--bg2);border:1px solid var(--border);border-radius:7px;
  padding:7px 30px 7px 12px;color:var(--text2);
  font-family:var(--font-mono);font-size:0.7rem;cursor:pointer;outline:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 10px center;
  transition:border-color 0.15s,color 0.15s;min-width:100px;
}
.pyq-filter-select:focus{border-color:var(--border2);}
.pyq-filter-select.has-value{
  border-color:var(--geo-border2);color:var(--geo);background-color:var(--geo-bg-sel);
}
.pyq-filter-reset{
  padding:7px 12px;border-radius:7px;border:1px solid var(--border);background:var(--bg2);
  color:var(--text3);font-family:var(--font-mono);font-size:0.68rem;
  cursor:pointer;transition:all 0.15s;white-space:nowrap;
}
.pyq-filter-reset:hover{border-color:var(--border2);color:var(--text);}

.pyq-head{margin-bottom:20px;}
.pyq-head-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.pyq-title{font-family:var(--font-body);font-size:1.5rem;font-weight:700;color:var(--text);letter-spacing:-0.02em;}
.pyq-count{font-family:var(--font-mono);font-size:0.65rem;color:var(--text3);letter-spacing:0.1em;}
.pyq-search{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:11px 16px;color:var(--text);font-family:var(--font-ui);font-size:0.88rem;outline:none;transition:border-color 0.2s;margin-bottom:12px;}
.pyq-search:focus{border-color:var(--geo-border2);}
.pyq-search::placeholder{color:var(--text3);}

.pyq-cards{display:flex;flex-direction:column;gap:8px;}
.pyq-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px 20px;transition:all 0.18s;cursor:pointer;}
.pyq-card:hover{border-color:var(--geo-border);background:var(--bg3);}
.pyq-card-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;}

.pyq-year{font-family:var(--font-mono);font-size:0.62rem;padding:2px 9px;border-radius:3px;background:var(--geo-dim);border:1px solid var(--geo-border);color:var(--geo);}
.pyq-paper{font-family:var(--font-mono);font-size:0.6rem;color:var(--text2);}
.pyq-section{font-family:var(--font-mono);font-size:0.6rem;color:var(--text2);}
.pyq-marks{margin-left:auto;font-family:var(--font-mono);font-size:0.62rem;padding:2px 9px;border-radius:3px;}
.m10{background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.15);color:#4ade80;}
.m15{background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);color:#fbbf24;}
.m20{background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.15);color:#f87171;}
.m0{background:transparent;border:none;color:var(--text3);}
[data-theme="light"] .m10{background:rgba(21,128,61,0.07);border-color:rgba(21,128,61,0.22);color:#15803d;}

.pyq-question{font-family:var(--font-body);font-size:0.93rem;color:var(--text);line-height:1.7;margin-bottom:12px;}
.pyq-card-bottom{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.pyq-topic{font-family:var(--font-mono);font-size:0.58rem;color:var(--geo);letter-spacing:0.04em;opacity:0.8;}
.pyq-attempt{padding:5px 14px;border-radius:4px;border:1px solid var(--geo-border);background:var(--geo-dim);color:var(--geo);font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.06em;cursor:pointer;transition:all 0.15s;}
.pyq-attempt:hover{background:var(--geo-bg-sel);border-color:var(--geo-border2);}
.pyq-view{padding:5px 14px;border-radius:4px;border:1px solid rgba(129,140,248,0.2);background:rgba(129,140,248,0.05);color:#818cf8;font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.06em;cursor:pointer;transition:all 0.15s;}
.pyq-view:hover{background:rgba(129,140,248,0.1);border-color:rgba(129,140,248,0.35);}
[data-theme="light"] .pyq-view{border-color:rgba(67,97,238,0.2);background:rgba(67,97,238,0.04);color:#4361ee;}
[data-theme="light"] .pyq-view:hover{background:rgba(67,97,238,0.08);border-color:rgba(67,97,238,0.35);}

.pyq-empty{text-align:center;padding:80px 20px;color:var(--text3);font-family:var(--font-ui);font-size:0.88rem;}

@media(max-width:600px){
  .pyq-inner{padding:0 1rem;}
  .pyq-filter-bar{gap:6px;}
  .pyq-filter-select{font-size:0.68rem;padding:6px 26px 6px 10px;min-width:unset;flex:1 1 calc(50% - 3px);}
  .pyq-filter-reset{flex:1 1 100%;}
  .pyq-title{font-size:1.25rem;}
  .pyq-card{padding:14px 16px;}
  .pyq-card-bottom{flex-direction:column;align-items:flex-start;}
}
`;

const TOPICS = [
  "Geomorphology","Climatology","Oceanography","Biogeography",
  "Environmental Geography","Geographical Thought & Methods",
  "Population & Settlement","Economic Geography","Agriculture","Industries",
  "Transport & Trade","Disasters & Hazards",
  "India — Physical","India — Climate","India — Agriculture & Resources",
  "India — Industries & Economy","India — Population & Urbanization",
  "India — Transport & Regional Development",
];

const YEARS = ["2025","2024","2023","2022","2021","2020","2019","2018","2017","2016","2015","2014","2013"];

export default function GeographyPYQsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [paper, setPaper] = useState('');
  const [topic, setTopic] = useState('');
  const [marks, setMarks] = useState('');

  const filtered = useMemo(() => {
    return (questions as any[]).filter(q => {
      if (year && q.year !== year) return false;
      if (paper && q.paper !== paper) return false;
      if (topic && q.topic !== topic) return false;
      if (marks && q.marks !== Number(marks)) return false;
      if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [year, paper, topic, marks, search]);

  const handleAttempt = (e: React.MouseEvent, q: any) => {
    e.stopPropagation();
    const p = new URLSearchParams({ question: q.question, marks: String(q.marks || 20) });
    router.push(`/evaluate?${p.toString()}`);
  };

  const mClass = (m: number) => m === 10 ? 'm10' : m === 15 ? 'm15' : m === 20 ? 'm20' : 'm0';
  const hasFilters = year || paper || topic || marks;
  const resetAll = () => { setYear(''); setPaper(''); setTopic(''); setMarks(''); setSearch(''); };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pyq-wrap">
        <div className="pyq-inner">
          <div className="pyq-head">
            <div className="pyq-head-top">
              <h1 className="pyq-title">Geography PYQs</h1>
              <span className="pyq-count">{filtered.length} / {(questions as any[]).length} QUESTIONS</span>
            </div>
            <input
              className="pyq-search"
              placeholder="Search questions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="pyq-filter-bar">
              <select className={`pyq-filter-select${year ? ' has-value' : ''}`} value={year} onChange={e => setYear(e.target.value)}>
                <option value="">All Years</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className={`pyq-filter-select${paper ? ' has-value' : ''}`} value={paper} onChange={e => setPaper(e.target.value)}>
                <option value="">All Papers</option>
                <option value="Paper I">Paper I</option>
                <option value="Paper II">Paper II</option>
              </select>
              <select className={`pyq-filter-select${marks ? ' has-value' : ''}`} value={marks} onChange={e => setMarks(e.target.value)}>
                <option value="">All Marks</option>
                <option value="10">10 M</option>
                <option value="15">15 M</option>
                <option value="20">20 M</option>
              </select>
              <select className={`pyq-filter-select${topic ? ' has-value' : ''}`} value={topic} onChange={e => setTopic(e.target.value)} style={{ flex: '2 1 200px' }}>
                <option value="">All Topics</option>
                {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {hasFilters && (
                <button className="pyq-filter-reset" onClick={resetAll}>✕ Reset</button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="pyq-empty">No questions found.</div>
          ) : (
            <div className="pyq-cards">
              {filtered.map((q: any) => (
                <div key={q.id} className="pyq-card" onClick={() => router.push(`/geography/pyqs/${q.id}`)}>
                  <div className="pyq-card-top">
                    <span className="pyq-year">{q.year}</span>
                    <span className="pyq-paper">{q.paper}</span>
                    {q.section && <span className="pyq-section">· {q.section}</span>}
                    <span className={`pyq-marks ${mClass(q.marks)}`}>{q.marks > 0 ? `${q.marks}M` : '—'}</span>
                  </div>
                  <div className="pyq-question">{q.question}</div>
                  <div className="pyq-card-bottom">
                    <span className="pyq-topic">{q.topic}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="pyq-attempt" onClick={e => handleAttempt(e, q)}>Attempt →</button>
                      <button className="pyq-view" onClick={e => { e.stopPropagation(); router.push(`/geography/pyqs/${q.id}`); }}>View →</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
