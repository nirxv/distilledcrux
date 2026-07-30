'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import questions from '@/public/data/sociology-pyqs.json';

const CSS = `
.pyq-wrap{min-height:100vh;padding:80px 0 96px;background:var(--bg);}
.pyq-inner{max-width:1200px;margin:0 auto;padding:0 2rem;display:grid;grid-template-columns:240px 1fr;gap:2rem;align-items:start;}
.pyq-sidebar{position:sticky;top:80px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:20px;height:calc(100vh - 100px);overflow-y:auto;}
.pyq-sidebar::-webkit-scrollbar{width:3px;}.pyq-sidebar::-webkit-scrollbar-thumb{background:#222;border-radius:2px;}
.pyq-sidebar-title{font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.28em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;}
.pyq-filter-group{display:flex;flex-direction:column;gap:4px;}
.pyq-filter-btn{padding:7px 12px;border-radius:5px;border:1px solid transparent;background:transparent;color:var(--text3);font-family:var(--font-mono);font-size:0.7rem;cursor:pointer;text-align:left;transition:all 0.15s;letter-spacing:0.03em;}
.pyq-filter-btn:hover{color:var(--text2);background:var(--bg3);}
.pyq-filter-btn.active{background:var(--bg3);border-color:var(--border);color:var(--text);}
.pyq-filter-btn.active-accent{background:rgba(59,130,246,0.08);border-color:rgba(59,130,246,0.25);color:#60a5fa;}
.pyq-head{margin-bottom:24px;}
.pyq-head-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.pyq-title{font-family:var(--font-body);font-size:1.5rem;font-weight:700;color:var(--text);letter-spacing:-0.02em;}
.pyq-count{font-family:var(--font-mono);font-size:0.65rem;color:var(--text3);letter-spacing:0.1em;}
.pyq-search{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:11px 16px;color:var(--text);font-family:var(--font-ui);font-size:0.88rem;outline:none;transition:border-color 0.2s;}
.pyq-search:focus{border-color:var(--border2);}
.pyq-search::placeholder{color:var(--text3);}
.pyq-cards{display:flex;flex-direction:column;gap:8px;}
.pyq-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px 20px;transition:all 0.18s;}
.pyq-card:hover{border-color:var(--border2);background:var(--bg3);}
.pyq-card-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
.pyq-year{font-family:var(--font-mono);font-size:0.62rem;padding:2px 9px;border-radius:3px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.18);color:#60a5fa;}
.pyq-year-empty{font-family:var(--font-mono);font-size:0.62rem;padding:2px 9px;border-radius:3px;background:var(--bg3);border:1px solid var(--border);color:var(--text3);}
.pyq-paper{font-family:var(--font-mono);font-size:0.6rem;color:var(--text2);}
.pyq-section{font-family:var(--font-mono);font-size:0.6rem;color:var(--text2);}
.pyq-marks{margin-left:auto;font-family:var(--font-mono);font-size:0.62rem;padding:2px 9px;border-radius:3px;}
.m10{background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.15);color:#4ade80;}
.m15{background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);color:#fbbf24;}
.m20{background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.15);color:#f87171;}
.m0{background:#141414;border:1px solid #1e1e1e;color:#333;}
.pyq-question{font-family:var(--font-body);font-size:0.93rem;color:var(--text);line-height:1.7;margin-bottom:12px;}
.pyq-card-bottom{display:flex;align-items:center;justify-content:space-between;}
.pyq-topic{font-family:var(--font-mono);font-size:0.58rem;color:var(--text2);letter-spacing:0.04em;}
.pyq-attempt{padding:5px 14px;border-radius:4px;border:1px solid rgba(59,130,246,0.2);background:rgba(59,130,246,0.05);color:#60a5fa;font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.06em;cursor:pointer;transition:all 0.15s;}
.pyq-attempt:hover{background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.35);}
.pyq-empty{text-align:center;padding:80px 20px;color:var(--text3);font-family:var(--font-ui);font-size:0.88rem;}
@media(max-width:768px){.pyq-inner{grid-template-columns:1fr;}.pyq-sidebar{position:static;max-height:none;}}
`;

const TOPICS = ["Sociology as Science","Social Research Methods","Sociological Thinkers","Social Stratification","Social Mobility","Social Movements","Religion and Society","Politics and Society","Economy and Society","Family and Marriage","Education and Society","Social Change","Indian Society","Indian Villages","Tribal Society","Caste System","Agrarian Structure","Industry and Labour","Weaker Sections","Social Movements in India","Other"];
const YEARS = ["2013","2014","2015","2016","2017","2018","2019","2020","2021","2022","2023"];

export default function SociologyPYQsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [year, setYear] = useState<string|null>(null);
  const [paper, setPaper] = useState<string|null>(null);
  const [topic, setTopic] = useState<string|null>(null);
  const [marks, setMarks] = useState<number|null>(null);

  const filtered = useMemo(() => {
    return (questions as any[]).filter(q => {
      if (year && q.year !== year) return false;
      if (paper && q.paper !== paper) return false;
      if (topic && q.topic !== topic) return false;
      if (marks && q.marks !== marks) return false;
      if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [year, paper, topic, marks, search]);

  const handleAttempt = (q: any) => {
    const p = new URLSearchParams({ question: q.question, marks: String(q.marks || 20) });
    router.push(`/evaluate?${p.toString()}`);
  };

  const mClass = (m: number) => m===10?'m10':m===15?'m15':m===20?'m20':'m0';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pyq-wrap">
        <div className="pyq-inner">
          <div className="pyq-sidebar">
            <div>
              <div className="pyq-sidebar-title">Year</div>
              <div className="pyq-filter-group">
                <button className={`pyq-filter-btn${!year?' active':''}`} onClick={()=>setYear(null)}>All Years</button>
                {YEARS.map(y=><button key={y} className={`pyq-filter-btn${year===y?' active-accent':''}`} onClick={()=>setYear(year===y?null:y)}>{y}</button>)}
              </div>
            </div>
            <div>
              <div className="pyq-sidebar-title">Paper</div>
              <div className="pyq-filter-group">
                <button className={`pyq-filter-btn${!paper?' active':''}`} onClick={()=>setPaper(null)}>All Papers</button>
                {['Paper I','Paper II'].map(p=><button key={p} className={`pyq-filter-btn${paper===p?' active-accent':''}`} onClick={()=>setPaper(paper===p?null:p)}>{p}</button>)}
              </div>
            </div>
            <div>
              <div className="pyq-sidebar-title">Marks</div>
              <div className="pyq-filter-group">
                <button className={`pyq-filter-btn${!marks?' active':''}`} onClick={()=>setMarks(null)}>All</button>
                {[10,15,20].map(m=><button key={m} className={`pyq-filter-btn${marks===m?' active-accent':''}`} onClick={()=>setMarks(marks===m?null:m)}>{m} Marks</button>)}
              </div>
            </div>
            <div>
              <div className="pyq-sidebar-title">Topic</div>
              <div className="pyq-filter-group">
                <button className={`pyq-filter-btn${!topic?' active':''}`} onClick={()=>setTopic(null)}>All Topics</button>
                {TOPICS.map(t=><button key={t} className={`pyq-filter-btn${topic===t?' active-accent':''}`} onClick={()=>setTopic(topic===t?null:t)}>{t}</button>)}
              </div>
            </div>
          </div>

          <div>
            <div className="pyq-head">
              <div className="pyq-head-top">
                <h1 className="pyq-title">Sociology PYQs</h1>
                <span className="pyq-count">{filtered.length} QUESTIONS</span>
              </div>
              <input className="pyq-search" placeholder="Search questions..." value={search} onChange={e=>setSearch(e.target.value)} />
            </div>

            {filtered.length===0 ? (
              <div className="pyq-empty">No questions found. Try different filters.</div>
            ) : (
              <div className="pyq-cards">
                {filtered.map((q:any)=>(
                  <div key={q.id} className="pyq-card" style={{cursor:'pointer'}} onClick={()=>router.push(`/sociology/pyqs/${q.id}`)}>
                    <div className="pyq-card-top">
                      {q.year ? <span className="pyq-year">{q.year}</span> : <span className="pyq-year-empty">—</span>}
                      {q.paper && <span className="pyq-paper">{q.paper}</span>}
                      {q.section && <span className="pyq-section">· {q.section}</span>}
                      <span className={`pyq-marks ${mClass(q.marks)}`}>{q.marks>0?`${q.marks}M`:'—'}</span>
                    </div>
                    <div className="pyq-question">{q.question}</div>
                    <div className="pyq-card-bottom">
                      <span className="pyq-topic">{q.topic}</span>
                      <div style={{display:'flex',gap:'6px'}}>
                        <button className="pyq-attempt" onClick={e=>{e.stopPropagation();handleAttempt(q)}}>Attempt →</button>
                        <button className="pyq-attempt" style={{borderColor:'rgba(67,97,238,0.2)',background:'rgba(67,97,238,0.05)',color:'#818cf8'}} onClick={e=>{e.stopPropagation();router.push(`/sociology/pyqs/${q.id}`)}}>View →</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
