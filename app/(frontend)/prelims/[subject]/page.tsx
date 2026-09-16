'use client';
import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

/* ─── Subject config ──────────────────────────────────────────── */
const SUBJECTS: Record<string, {
  name: string; sub: string; color: string; icon: string;
  topics: string[]; years: string[];
}> = {
  history: {
    name: 'History & Culture', sub: 'Ancient, Medieval, Modern & Art', color: '#e8b86d', icon: '🏛️',
    topics: ['Ancient India', 'Medieval India', 'Modern India', 'Art & Culture', 'Post-Independence', 'World History', 'Other'],
    years: ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'],
  },
  polity: {
    name: 'Polity & Governance', sub: 'Constitution, Institutions & Policies', color: '#4361ee', icon: '⚖️',
    topics: ['Constitution', 'Fundamental Rights', 'Parliament', 'Executive', 'Judiciary', 'Federalism', 'Local Government', 'Constitutional Bodies', 'Governance', 'Other'],
    years: ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'],
  },
  geography: {
    name: 'Geography', sub: 'Physical, Human, Economic & Maps', color: '#4ade80', icon: '🌍',
    topics: ['Geomorphology', 'Climatology', 'Oceanography', 'Biogeography', 'Agriculture', 'Resources', 'Industry', 'Population', 'India Geography', 'Maps', 'Other'],
    years: ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'],
  },
  economy: {
    name: 'Economy', sub: 'Concepts, Budgets, Schemes & Data', color: '#2dd4bf', icon: '📊',
    topics: ['Basic Concepts', 'Planning', 'Budget & Fiscal Policy', 'Monetary Policy', 'Agriculture Economy', 'Industry', 'Trade', 'Schemes & Programmes', 'Banking', 'Other'],
    years: ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'],
  },
  environment: {
    name: 'Environment & Ecology', sub: 'Biodiversity, Climate & Current Affairs', color: '#86efac', icon: '🌿',
    topics: ['Ecology Basics', 'Biodiversity', 'Climate Change', 'Pollution', 'Protected Areas', 'International Agreements', 'Acts & Policies', 'Other'],
    years: ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'],
  },
  science: {
    name: 'Science & Technology', sub: 'Physics, Chemistry, Biology & Space', color: '#f87171', icon: '🔬',
    topics: ['Physics', 'Chemistry', 'Biology', 'Space & ISRO', 'Defence Technology', 'IT & Computers', 'Health & Disease', 'Emerging Tech', 'Other'],
    years: ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'],
  },
  current: {
    name: 'Current Affairs', sub: 'Monthly digests, Schemes & Reports', color: '#c084fc', icon: '📰',
    topics: ['National', 'International', 'Schemes & Programmes', 'Awards & Honours', 'Reports & Indices', 'Books & Authors', 'Sports', 'Other'],
    years: ['2022','2023','2024'],
  },
  csat: {
    name: 'CSAT Paper II', sub: 'Reading, Reasoning & Basic Numeracy', color: '#fb923c', icon: '🧮',
    topics: ['Reading Comprehension', 'Data Interpretation', 'Number System', 'Ratio & Proportion', 'Algebra', 'Logical Reasoning', 'Analytical Reasoning', 'Decision Making', 'Other'],
    years: ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'],
  },
};

const DIFF_LABELS = ['Easy', 'Medium', 'Hard'];

/* ─── Placeholder MCQ type ────────────────────────────────────── */
interface MCQ {
  id: string;
  year: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explanation: string;
}

/* ─── CSS ─────────────────────────────────────────────────────── */
const CSS = `
.mcq-wrap { min-height: 100vh; padding: 80px 0 96px; background: var(--bg); }
.mcq-inner {
  max-width: 1200px; margin: 0 auto; padding: 0 2rem;
  display: grid; grid-template-columns: 220px 1fr; gap: 2rem; align-items: start;
}

/* Sidebar */
.mcq-sidebar {
  position: sticky; top: 80px;
  background: var(--bg2); border: 1px solid var(--border); border-radius: 12px;
  padding: 18px; display: flex; flex-direction: column; gap: 18px;
  max-height: calc(100vh - 100px); overflow-y: auto;
}
.mcq-sidebar::-webkit-scrollbar { width: 3px; }
.mcq-sidebar::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
.mcq-sidebar-title {
  font-family: var(--font-mono); font-size: 0.55rem;
  letter-spacing: 0.28em; text-transform: uppercase; color: var(--text3); margin-bottom: 7px;
}
.mcq-filter-group { display: flex; flex-direction: column; gap: 3px; }
.mcq-filter-btn {
  padding: 6px 10px; border-radius: 5px; border: 1px solid transparent;
  background: transparent; color: var(--text3); font-family: var(--font-mono);
  font-size: 0.68rem; cursor: pointer; text-align: left; transition: all 0.13s;
  letter-spacing: 0.02em;
}
.mcq-filter-btn:hover { color: var(--text2); background: var(--bg3); }
.mcq-filter-btn.active { background: var(--bg3); border-color: var(--border); color: var(--text); }
.mcq-filter-btn.active-accent { background: rgba(67,97,238,0.08); border-color: rgba(67,97,238,0.25); color: var(--accent3); }

/* Header */
.mcq-head { margin-bottom: 20px; }
.mcq-breadcrumb {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--font-ui); font-size: 0.72rem; color: var(--text3);
  margin-bottom: 1.25rem;
}
.mcq-breadcrumb a { color: var(--text3); text-decoration: none; transition: color 0.15s; }
.mcq-breadcrumb a:hover { color: var(--text); }
.mcq-head-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.mcq-title { font-family: var(--font-body); font-size: 1.4rem; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
.mcq-count { font-family: var(--font-mono); font-size: 0.62rem; color: var(--text3); letter-spacing: 0.1em; }
.mcq-search {
  width: 100%; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
  padding: 10px 14px; color: var(--text); font-family: var(--font-ui); font-size: 0.86rem;
  outline: none; transition: border-color 0.18s;
}
.mcq-search:focus { border-color: var(--border2); }
.mcq-search::placeholder { color: var(--text3); }

/* Cards */
.mcq-cards { display: flex; flex-direction: column; gap: 8px; }
.mcq-card {
  background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;
  padding: 16px 18px; transition: all 0.16s;
}
.mcq-card:hover { border-color: var(--border2); background: var(--bg3); }
.mcq-card.revealed { border-color: var(--border2); }

.mcq-card-top { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; flex-wrap: wrap; }
.mcq-year-tag {
  font-family: var(--font-mono); font-size: 0.6rem; padding: 2px 8px; border-radius: 3px;
  background: rgba(67,97,238,0.08); border: 1px solid rgba(67,97,238,0.2); color: var(--accent3);
}
.mcq-topic-tag { font-family: var(--font-mono); font-size: 0.6rem; color: var(--text3); }
.mcq-diff-easy  { margin-left: auto; font-family: var(--font-mono); font-size: 0.58rem; padding: 2px 8px; border-radius: 3px; background: rgba(74,222,128,0.06); border: 1px solid rgba(74,222,128,0.15); color: #4ade80; }
.mcq-diff-medium{ margin-left: auto; font-family: var(--font-mono); font-size: 0.58rem; padding: 2px 8px; border-radius: 3px; background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.15); color: #fbbf24; }
.mcq-diff-hard  { margin-left: auto; font-family: var(--font-mono); font-size: 0.58rem; padding: 2px 8px; border-radius: 3px; background: rgba(248,113,113,0.06); border: 1px solid rgba(248,113,113,0.15); color: #f87171; }

.mcq-question { font-family: var(--font-body); font-size: 0.9rem; color: var(--text); line-height: 1.7; margin-bottom: 11px; }

.mcq-options { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
.mcq-option {
  display: flex; align-items: flex-start; gap: 9px; padding: 8px 12px;
  border-radius: 6px; border: 1px solid var(--border); background: var(--bg);
  cursor: pointer; transition: all 0.13s; font-family: var(--font-ui); font-size: 0.8rem;
  color: var(--text2); text-align: left;
}
.mcq-option:hover { border-color: var(--border2); background: var(--bg3); color: var(--text); }
.mcq-option.correct { border-color: rgba(74,222,128,0.4); background: rgba(74,222,128,0.06); color: #4ade80; }
.mcq-option.wrong   { border-color: rgba(248,113,113,0.35); background: rgba(248,113,113,0.06); color: #f87171; }
.mcq-option.neutral { opacity: 0.45; cursor: default; }
.mcq-option-key {
  font-family: var(--font-mono); font-size: 0.62rem; font-weight: 700;
  flex-shrink: 0; padding-top: 1px; letter-spacing: 0.04em;
}

.mcq-explanation {
  font-family: var(--font-ui); font-size: 0.78rem; color: var(--text2);
  line-height: 1.65; padding: 10px 12px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  margin-top: 4px; animation: fade-up 0.2s ease;
}
.mcq-explanation strong { color: var(--text); font-weight: 600; }

.mcq-card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
.mcq-skip-btn {
  padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border);
  background: transparent; color: var(--text3); font-family: var(--font-mono);
  font-size: 0.6rem; letter-spacing: 0.05em; cursor: pointer; transition: all 0.13s;
}
.mcq-skip-btn:hover { border-color: var(--border2); color: var(--text2); }

.mcq-empty { text-align: center; padding: 80px 20px; color: var(--text3); font-family: var(--font-ui); font-size: 0.88rem; }

/* Quiz CTA strip */
.mcq-quiz-cta {
  display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
  padding: 1rem 1.25rem; margin-bottom: 20px;
  background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;
}
.mcq-quiz-cta-text { font-family: var(--font-ui); font-size: 0.82rem; color: var(--text2); line-height: 1.5; }
.mcq-quiz-cta-text strong { color: var(--text); font-weight: 600; }
.mcq-quiz-link {
  font-family: var(--font-ui); font-size: 0.8rem; font-weight: 600;
  color: var(--bg); background: var(--text); padding: 7px 16px; border-radius: 5px;
  text-decoration: none; flex-shrink: 0; transition: opacity 0.15s; white-space: nowrap;
}
.mcq-quiz-link:hover { opacity: 0.85; }

@media (max-width: 768px) {
  .mcq-inner { grid-template-columns: 1fr; }
  .mcq-sidebar { position: static; max-height: none; }
}
`;

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

/* ─── Seed MCQs for empty state (placeholder until real data exists) ─ */
function makeSeedMCQs(subject: string, color: string, topics: string[]): MCQ[] {
  const samples: Omit<MCQ, 'id' | 'topic' | 'difficulty'>[] = [
    {
      year: '2023',
      question: 'Which of the following statements is/are correct regarding this subject area? (1) Statement one is a commonly tested fact. (2) Statement two is often misunderstood by aspirants.',
      options: ['1 only', '2 only', 'Both 1 and 2', 'Neither 1 nor 2'],
      answer: 2,
      explanation: 'Both statements are correct. Statement 1 covers the core concept while Statement 2 addresses the common misconception. Add your real MCQ data to <code>public/data/prelims-{subject}.json</code> this card is a placeholder.',
    },
    {
      year: '2022',
      question: 'Consider the following pairs: (1) Term A Definition X (2) Term B Definition Y (3) Term C Definition Z. Which of the pairs given above is/are correctly matched?',
      options: ['1 and 2 only', '2 and 3 only', '1 and 3 only', '1, 2 and 3'],
      answer: 0,
      explanation: 'Only pairs 1 and 2 are correctly matched. This "match the pairs" format is extremely common in UPSC Prelims. Load your real question bank from <code>public/data/prelims-{subject}.json</code>.',
    },
    {
      year: '2021',
      question: 'With reference to this topic, which of the following is NOT correct?',
      options: ['Option A a true statement about the topic', 'Option B another true statement', 'Option C the incorrect statement which is the answer', 'Option D also a true statement'],
      answer: 2,
      explanation: 'Option C is incorrect. The "which is NOT correct" variant is a classic UPSC trap. This is a placeholder replace with <code>public/data/prelims-{subject}.json</code>.',
    },
  ];
  return samples.map((s, i) => ({
    ...s,
    id: `seed-${subject}-${i}`,
    topic: topics[i % topics.length],
    difficulty: (['Easy', 'Medium', 'Hard'] as const)[i % 3],
  }));
}

/* ─── Component ───────────────────────────────────────────────── */
export default function PrelimsSubjectPage() {
  const params = useParams();
  const slug = (params?.subject as string) ?? 'history';
  const cfg = SUBJECTS[slug] ?? SUBJECTS['history'];

  // Seed data replace with: import questions from '@/public/data/prelims-{slug}.json';
  const allQuestions: MCQ[] = useMemo(() => makeSeedMCQs(slug, cfg.color, cfg.topics), [slug, cfg]);

  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState<string | null>(null);
  const [filterTopic, setFilterTopic] = useState<string | null>(null);
  const [filterDiff, setFilterDiff] = useState<string | null>(null);

  // Per-card state: null = unattempted, number = chosen index
  const [chosen, setChosen] = useState<Record<string, number | null>>({});

  const filtered = useMemo(() => allQuestions.filter(q => {
    if (filterYear && q.year !== filterYear) return false;
    if (filterTopic && q.topic !== filterTopic) return false;
    if (filterDiff && q.difficulty !== filterDiff) return false;
    if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [allQuestions, filterYear, filterTopic, filterDiff, search]);

  const handleChoose = useCallback((id: string, idx: number) => {
    setChosen(prev => prev[id] != null ? prev : { ...prev, [id]: idx });
  }, []);

  const diffClass = (d: string) => d === 'Easy' ? 'mcq-diff-easy' : d === 'Medium' ? 'mcq-diff-medium' : 'mcq-diff-hard';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mcq-wrap">
        <div className="mcq-inner">

          {/* ── Sidebar ── */}
          <div className="mcq-sidebar">
            <div>
              <div className="mcq-sidebar-title">Year</div>
              <div className="mcq-filter-group">
                <button className={`mcq-filter-btn${!filterYear ? ' active' : ''}`} onClick={() => setFilterYear(null)}>All Years</button>
                {cfg.years.map(y => (
                  <button key={y} className={`mcq-filter-btn${filterYear === y ? ' active-accent' : ''}`} onClick={() => setFilterYear(filterYear === y ? null : y)}>{y}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="mcq-sidebar-title">Difficulty</div>
              <div className="mcq-filter-group">
                <button className={`mcq-filter-btn${!filterDiff ? ' active' : ''}`} onClick={() => setFilterDiff(null)}>All</button>
                {DIFF_LABELS.map(d => (
                  <button key={d} className={`mcq-filter-btn${filterDiff === d ? ' active-accent' : ''}`} onClick={() => setFilterDiff(filterDiff === d ? null : d)}>{d}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="mcq-sidebar-title">Topic</div>
              <div className="mcq-filter-group">
                <button className={`mcq-filter-btn${!filterTopic ? ' active' : ''}`} onClick={() => setFilterTopic(null)}>All Topics</button>
                {cfg.topics.map(t => (
                  <button key={t} className={`mcq-filter-btn${filterTopic === t ? ' active-accent' : ''}`} onClick={() => setFilterTopic(filterTopic === t ? null : t)}>{t}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Main ── */}
          <div>
            <div className="mcq-head">
              <div className="mcq-breadcrumb">
                <Link href="/">Home</Link>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <Link href="/prelims">Prelims</Link>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ color: cfg.color }}>{cfg.name}</span>
              </div>
              <div className="mcq-head-top">
                <h1 className="mcq-title" style={{ color: cfg.color }}>{cfg.icon} {cfg.name}</h1>
                <span className="mcq-count">{filtered.length} MCQs</span>
              </div>
              <input
                className="mcq-search"
                placeholder="Search questions…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Daily quiz CTA */}
            <div className="mcq-quiz-cta">
              <div className="mcq-quiz-cta-text">
                <strong>Daily Quiz</strong> 10 curated {cfg.name} questions every morning. Build the habit.
              </div>
              <Link href="/prelims/quiz" className="mcq-quiz-link">Take Quiz →</Link>
            </div>

            {filtered.length === 0 ? (
              <div className="mcq-empty">No questions match your filters. Try clearing some.</div>
            ) : (
              <div className="mcq-cards">
                {filtered.map((q) => {
                  const picked = chosen[q.id] ?? null;
                  const revealed = picked != null;
                  return (
                    <div key={q.id} className={`mcq-card${revealed ? ' revealed' : ''}`}>
                      <div className="mcq-card-top">
                        {q.year && <span className="mcq-year-tag">{q.year}</span>}
                        <span className="mcq-topic-tag">{q.topic}</span>
                        <span className={diffClass(q.difficulty)}>{q.difficulty}</span>
                      </div>

                      <div className="mcq-question">{q.question}</div>

                      <div className="mcq-options">
                        {q.options.map((opt, idx) => {
                          let cls = 'mcq-option';
                          if (revealed) {
                            if (idx === q.answer) cls += ' correct';
                            else if (idx === picked) cls += ' wrong';
                            else cls += ' neutral';
                          }
                          return (
                            <button
                              key={idx}
                              className={cls}
                              onClick={() => handleChoose(q.id, idx)}
                              disabled={revealed}
                            >
                              <span className="mcq-option-key">{OPTION_KEYS[idx]}</span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      {revealed && (
                        <div
                          className="mcq-explanation"
                          dangerouslySetInnerHTML={{ __html: `<strong>${picked === q.answer ? '✓ Correct.' : '✗ Incorrect.'}</strong> ${q.explanation}` }}
                        />
                      )}

                      {!revealed && (
                        <div className="mcq-card-bottom">
                          <span />
                          <button className="mcq-skip-btn" onClick={() => handleChoose(q.id, -1 as never)}>
                            Skip →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
