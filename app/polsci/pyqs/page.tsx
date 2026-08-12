'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import questions from '@/public/data/psir-pyqs.json';

const CSS = `
.pyq-wrap{min-height:100vh;padding:80px 0 96px;background:var(--bg);}
.pyq-inner{max-width:860px;margin:0 auto;padding:0 2rem;}

/* ── Dropdown filter bar ── */
.pyq-filter-bar{
  display:flex;gap:8px;flex-wrap:wrap;align-items:center;
  margin-bottom:16px;
}
.pyq-filter-select{
  appearance:none;-webkit-appearance:none;
  background:var(--bg2);
  border:1px solid var(--border);
  border-radius:7px;
  padding:7px 30px 7px 12px;
  color:var(--text2);
  font-family:var(--font-mono);font-size:0.7rem;
  cursor:pointer;outline:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat:no-repeat;
  background-position:right 10px center;
  transition:border-color 0.15s,color 0.15s;
  min-width:100px;
}
.pyq-filter-select:focus{border-color:var(--border2);}
.pyq-filter-select.has-value{
  border-color:rgba(248,113,113,0.35);
  color:#f87171;
  background-color:rgba(248,113,113,0.06);
}
.pyq-filter-reset{
  padding:7px 12px;border-radius:7px;
  border:1px solid var(--border);background:var(--bg2);
  color:var(--text3);font-family:var(--font-mono);font-size:0.68rem;
  cursor:pointer;transition:all 0.15s;white-space:nowrap;
}
.pyq-filter-reset:hover{border-color:var(--border2);color:var(--text);}

.pyq-head{margin-bottom:20px;}
.pyq-head-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.pyq-title{font-family:var(--font-body);font-size:1.5rem;font-weight:700;color:var(--text);letter-spacing:-0.02em;}
.pyq-count{font-family:var(--font-mono);font-size:0.65rem;color:var(--text3);letter-spacing:0.1em;}
.pyq-search{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:11px 16px;color:var(--text);font-family:var(--font-ui);font-size:0.88rem;outline:none;transition:border-color 0.2s;}
.pyq-search:focus{border-color:var(--border2);}
.pyq-search::placeholder{color:var(--text3);}

.pyq-cards{display:flex;flex-direction:column;gap:8px;}
.pyq-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px 20px;transition:all 0.18s;cursor:pointer;}
.pyq-card:hover{border-color:var(--border2);background:var(--bg3);}
.pyq-card-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
.pyq-year{font-family:var(--font-mono);font-size:0.62rem;padding:2px 9px;border-radius:3px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.18);color:#f87171;}
.pyq-year-empty{font-family:var(--font-mono);font-size:0.62rem;padding:2px 9px;border-radius:3px;background:var(--bg3);border:1px solid var(--border);color:var(--text3);}
.pyq-paper{font-family:var(--font-mono);font-size:0.6rem;color:var(--text2);}
.pyq-marks{margin-left:auto;font-family:var(--font-mono);font-size:0.62rem;padding:2px 9px;border-radius:3px;}
.m10{background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.15);color:#4ade80;}
.m15{background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);color:#fbbf24;}
.m16{background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);color:#fbbf24;}
.m20{background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.15);color:#f87171;}
.m0{background:transparent;border:none;color:var(--text3);}
.pyq-question{font-family:var(--font-body);font-size:0.93rem;color:var(--text);line-height:1.7;margin-bottom:12px;}
.pyq-card-bottom{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.pyq-topic{font-family:var(--font-mono);font-size:0.58rem;color:var(--text2);letter-spacing:0.04em;}
.pyq-attempt{padding:5px 14px;border-radius:4px;border:1px solid rgba(248,113,113,0.2);background:rgba(248,113,113,0.05);color:#f87171;font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.06em;cursor:pointer;transition:all 0.15s;}
.pyq-attempt:hover{background:rgba(248,113,113,0.1);border-color:rgba(248,113,113,0.35);}
.pyq-view{padding:5px 14px;border-radius:4px;border:1px solid rgba(129,140,248,0.2);background:rgba(129,140,248,0.05);color:#818cf8;font-family:var(--font-mono);font-size:0.62rem;letter-spacing:0.06em;cursor:pointer;transition:all 0.15s;}
.pyq-view:hover{background:rgba(129,140,248,0.1);border-color:rgba(129,140,248,0.35);}
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

const P1_TOPICS = [
  "Political Theory",
  "Theories of the State",
  "Justice",
  "Equality",
  "Rights",
  "Democracy",
  "Concept of Power, Hegemony, Ideology and Legitimacy",
  "Political Ideologies",
  "Indian Political Thought",
  "Western Political Thinkers",
  "Indian Nationalism",
  "Making of the Indian Constitution",
  "Salient Features of the Indian Constitution",
  "Principal Organs",
  "Grassroots Democracy",
  "Statutory Institutions and Commissions",
  "Federalism",
  "Planning and Economic Development",
  "Indian Politics — Caste, Religion and Ethnicity",
  "Party System",
  "Social Movements",
];

const P2_TOPICS = [
  "Comparative Political",
  "State in Comparative Perspective",
  "Politics of Representation and Participation",
  "Globalization",
  "Approaches to the Study of International Relations",
  "Key Concepts in International Relations",
  "Changing International Political Order",
  "Evolution of the International Economic System",
  "United Nations",
  "Regionalisation of World Politics",
  "Contemporary Global Concerns",
  "India's Foreign Policy — Changing International Order",
  "India and the Non-Alignment Movement",
  "India and South Asia",
  "India and the Global South",
  "India and the Global Centres of Power",
  "India and the UN System",
  "India and the Nuclear Question",
  "Recent Developments in Indian Foreign Policy",
];

const YEARS = ["2025","2024","2023","2022","2021","2020","2019","2018","2017","2016","2015","2014","2013"];

export default function PSIRPYQsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [year, setYear] = useState<string>('');
  const [paper, setPaper] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [marks, setMarks] = useState<string>('');

  // When paper changes, reset topic if it no longer belongs to new paper
  const handlePaperChange = (val: string) => {
    setPaper(val);
    setTopic('');
  };

  const topicOptions = paper === 'Paper I' ? P1_TOPICS : paper === 'Paper II' ? P2_TOPICS : [...P1_TOPICS, ...P2_TOPICS];

  const filtered = useMemo(() => {
    return (questions as any[]).filter(q => {
      if (year && q.year !== year) return false;
      if (paper && q.paper !== paper) return false;
      if (topic && q.topic !== topic) return false;
      if (marks && q.marks !== Number(marks)) return false;
      if (search) {
        const s = search.toLowerCase();
        return q.question.toLowerCase().includes(s) || q.topic.toLowerCase().includes(s);
      }
      return true;
    });
  }, [year, paper, topic, marks, search]);

  const handleAttempt = (e: React.MouseEvent, q: any) => {
    e.stopPropagation();
    const p = new URLSearchParams({ subject: 'polsci', question: q.question, marks: String(q.marks || 10), year: q.year });
    router.push(`/evaluate?${p.toString()}`);
  };

  const mClass = (m: number) => {
    if (m === 10) return 'm10';
    if (m === 15) return 'm15';
    if (m === 16) return 'm16';
    if (m === 20) return 'm20';
    return 'm0';
  };

  const hasFilters = year || paper || topic || marks;
  const resetAll = () => { setYear(''); setPaper(''); setTopic(''); setMarks(''); setSearch(''); };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pyq-wrap">
        <div className="pyq-inner">

          <div className="pyq-head">
            <div className="pyq-head-top">
              <h1 className="pyq-title">PSIR PYQs</h1>
              <span className="pyq-count">{filtered.length} QUESTIONS</span>
            </div>
            <input
              className="pyq-search"
              placeholder="Search questions or topics..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <div className="pyq-filter-bar">
              <select className={`pyq-filter-select${year ? ' has-value' : ''}`} value={year} onChange={e => setYear(e.target.value)}>
                <option value="">All Years</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className={`pyq-filter-select${paper ? ' has-value' : ''}`} value={paper} onChange={e => handlePaperChange(e.target.value)}>
                <option value="">All Papers</option>
                <option value="Paper I">Paper I</option>
                <option value="Paper II">Paper II</option>
              </select>
              <select className={`pyq-filter-select${marks ? ' has-value' : ''}`} value={marks} onChange={e => setMarks(e.target.value)}>
                <option value="">All Marks</option>
                <option value="10">10 Marks</option>
                <option value="15">15 Marks</option>
                <option value="20">20 Marks</option>
              </select>
              <select className={`pyq-filter-select${topic ? ' has-value' : ''}`} value={topic} onChange={e => setTopic(e.target.value)} style={{ flex: '2 1 200px' }}>
                <option value="">All Topics</option>
                {topicOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {hasFilters && (
                <button className="pyq-filter-reset" onClick={resetAll}>✕ Reset</button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="pyq-empty">No questions found. Try different filters.</div>
          ) : (
            <div className="pyq-cards">
              {filtered.map((q: any) => (
                <div key={q.id} className="pyq-card" onClick={() => router.push(`/polsci/pyqs/${q.id}`)}>
                  <div className="pyq-card-top">
                    {q.year ? <span className="pyq-year">{q.year}</span> : <span className="pyq-year-empty">—</span>}
                    {q.paper && <span className="pyq-paper">{q.paper}</span>}
                    <span className={`pyq-marks ${mClass(q.marks)}`}>{q.marks > 0 ? `${q.marks}M` : '—'}</span>
                  </div>
                  <div className="pyq-question">{q.question}</div>
                  <div className="pyq-card-bottom">
                    <span className="pyq-topic">{q.topic}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="pyq-attempt" onClick={e => handleAttempt(e, q)}>Attempt →</button>
                      <button className="pyq-view" onClick={e => { e.stopPropagation(); router.push(`/polsci/pyqs/${q.id}`); }}>View →</button>
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
