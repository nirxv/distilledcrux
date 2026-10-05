'use client';
import { useState } from 'react';
import Mascot from '@/components/Mascot';
import { list } from '@/lib/chatStart';

/**
 * What the server has actually done so far, from the __STAGE__ lines at the
 * head of the /api/chat stream. Nothing here advances on a timer: a step is
 * ticked when the server says it is finished, so the list never claims work
 * that has not happened.
 */
export type Progress = {
  accepted: boolean;
  search?: { book: string | null };
  found?: { passages: number; books: string[] };
  pdf?: { name: string | null };
  writing: boolean;
};

export const NO_PROGRESS: Progress = { accepted: false, writing: false };

const Done = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ch-step-done"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.8 2.8L16.5 9.5" /></svg>
);
const Spin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="ch-step-spin"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>
);

function bookList(books: string[], langHi: boolean): string {
  if (books.length <= 2) return list(books);
  const more = books.length - 2;
  return `${books.slice(0, 2).join(', ')} ${langHi ? `और ${more} अन्य` : `and ${more} more`}`;
}

type Row = { key: string; text: string; done: boolean };

function stepRows(progress: Progress, langHi: boolean): Row[] {
  const rows: Row[] = [];

  rows.push({
    key: 'read',
    text: langHi ? 'आपका प्रश्न पढ़ रहा हूँ' : 'Reading your question',
    done: progress.accepted,
  });

  if (progress.search) {
    const f = progress.found;
    rows.push({
      key: 'search',
      text: f
        ? f.passages > 0
          ? (langHi
              ? `${bookList(f.books, true)} में ${f.passages} अंश मिले`
              : `Found ${f.passages} passage${f.passages === 1 ? '' : 's'} in ${bookList(f.books, false)}`)
          : (langHi
              ? 'पुस्तकों में सीधा अंश नहीं मिला, पाठ्यक्रम से उत्तर दे रहा हूँ'
              : 'No close passage in the books, answering from the syllabus')
        : progress.search.book
          ? (langHi ? `${progress.search.book} में खोज रहा हूँ` : `Searching ${progress.search.book}`)
          : (langHi ? 'संदर्भ पुस्तकों में खोज रहा हूँ' : 'Searching the reference books'),
      done: Boolean(f),
    });
  }

  if (progress.pdf) {
    rows.push({
      key: 'pdf',
      text: langHi ? 'आपकी PDF पढ़ रहा हूँ' : `Reading ${progress.pdf.name ?? 'your PDF'}`,
      done: progress.writing,
    });
  }

  if (progress.accepted) {
    rows.push({ key: 'write', text: langHi ? 'उत्तर लिख रहा हूँ' : 'Writing your answer', done: false });
  }

  return rows;
}

export default function ThinkingSteps({ progress, langHi }: { progress: Progress; langHi: boolean }) {
  const rows = stepRows(progress, langHi);

  // Only the first unfinished step spins; anything after it is not shown yet.
  const firstOpen = rows.findIndex((r) => !r.done);
  const visible = firstOpen === -1 ? rows : rows.slice(0, firstOpen + 1);

  return (
    <div className="ch-thinking" role="status" aria-live="polite">
      <Mascot pose="reading" width={72} className="ch-thinking-owl" />
      <ul className="ch-steps">
        {visible.map((r, i) => (
          <li key={r.key} className={r.done ? 'done' : 'active'}>
            {r.done ? <Done /> : i === visible.length - 1 ? <Spin /> : <Done />}
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What the server did before it started writing, and how long that took. */
export type Trace = { progress: Progress; ms: number };

/**
 * Once the answer is on screen the working steps fold into one quiet line,
 * "Researched 7s", that opens to show them again.
 */
export function ResearchTrace({ trace, langHi }: { trace: Trace; langHi: boolean }) {
  const [open, setOpen] = useState(false);
  const rows = stepRows({ ...trace.progress, writing: true }, langHi).filter((r) => r.key !== 'write');
  const secs = Math.max(1, Math.round(trace.ms / 1000));
  return (
    <div className="ch-trace">
      <button type="button" className="ch-trace-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{langHi ? `${secs} सेकंड में शोध किया` : `Researched ${secs}s`}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={open ? 'ch-trace-chev open' : 'ch-trace-chev'} aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      {open && (
        <ul className="ch-steps ch-trace-steps">
          {rows.map((r) => (
            <li key={r.key} className="done"><Done /><span>{r.text}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
