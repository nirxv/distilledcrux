'use client';
import { useState } from 'react';
import TodayPractice from '@/components/TodayPractice';
import SubjectIcon from '@/components/SubjectIcon';
import { useOptional } from '@/components/useOptional';
import { routeSlugForOptional } from '@/lib/optionals';
import type { DailyQuestion } from '@/lib/dailyQuestions';
import type { PyqSubject } from '@/lib/pyqs';

/**
 * The home page's daily answer writing: today's five for each optional, on
 * tabs, open at the reader's own optional once it is known.
 */
export default function DailyAnswer({ sets, names, day }: {
  sets: { subject: PyqSubject; questions: DailyQuestion[] }[];
  names: Record<PyqSubject, string>;
  day: string;
}) {
  const mine = routeSlugForOptional(useOptional()) as PyqSubject | null;
  const [picked, setPicked] = useState<PyqSubject | null>(null);
  const subject = picked ?? (mine && sets.some((s) => s.subject === mine) ? mine : sets[0].subject);
  const set = sets.find((s) => s.subject === subject) ?? sets[0];

  return (
    <div className="da">
      <style>{DA_CSS}</style>
      <div className="da-tabs" role="tablist" aria-label="Optional">
        {sets.map((s) => (
          <button key={s.subject} type="button" role="tab" aria-selected={s.subject === subject}
            className={`da-tab${s.subject === subject ? ' on' : ''}`} style={{ ['--t' as string]: `var(--tint-${s.subject})`, ['--w' as string]: `var(--wash-${s.subject})` }}
            onClick={() => setPicked(s.subject)}>
            <SubjectIcon id={s.subject} size={16} />
            {names[s.subject]}
          </button>
        ))}
      </div>
      <TodayPractice key={set.subject} subject={set.subject} questions={set.questions} day={day} />
    </div>
  );
}

const DA_CSS = `
.da-tabs { display: flex; gap: var(--space-2); margin-bottom: var(--space-3); overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.da-tabs::-webkit-scrollbar { display: none; }
.da-tab { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 var(--space-4); border: 1.5px solid var(--border2); border-radius: var(--radius-full); background: var(--ds-card); color: var(--text2); font: inherit; font-size: 0.9rem; font-weight: 700; white-space: nowrap; cursor: pointer; }
.da-tab:hover { color: var(--text); border-color: color-mix(in srgb, var(--t) 45%, transparent); }
.da-tab.on { border-color: var(--t); background: var(--w); color: var(--t); }
.da-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
