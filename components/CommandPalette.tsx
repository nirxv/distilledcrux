'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { allNotes, type SubjectNote } from '@/lib/notes';
import SubjectIcon from '@/components/SubjectIcon';

/**
 * ⌘K: jump to any note, page or tool by typing a few letters, or hand the
 * words to the AI chat. Loaded the first time it is opened (see Navbar), so
 * the note index costs nothing until a reader wants it.
 */

type Item = {
  key: string;
  label: string;
  hint?: string;
  href: string;
  group: 'Ask' | 'Go to' | 'Notes';
  icon?: React.ReactNode;
};

const SUBJECT_NAME: Record<string, string> = {
  sociology: 'Sociology', anthropology: 'Anthropology', polsci: 'PSIR', geography: 'Geography', 'pub-admin': 'Public Administration',
};

// /test takes the profile spelling of an optional, not the route slug.
const PROFILE_SPELLING: Record<string, string> = {
  sociology: 'sociology', anthropology: 'anthropology', polsci: 'political-science', geography: 'geography', 'pub-admin': 'public-administration',
};

const Glyph = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const G = {
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  notes: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z',
  pyq: 'M9 4h6v3H9zM9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15M9 12h6M9 16h4',
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  test: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  dash: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  plans: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  home: 'M3 11l9-8 9 8M5 9.5V20h14V9.5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
};

function pages(subject: string | null): Item[] {
  const s = subject;
  const list: Item[] = [
    { key: 'chat', label: 'AI Chat', hint: 'Ask anything from the syllabus', href: '/chat', group: 'Go to', icon: <Glyph d={G.chat} /> },
    ...(s ? [
      { key: 'notes', label: `${SUBJECT_NAME[s]} notes`, hint: 'Every topic in the syllabus', href: `/notes/${s}`, group: 'Go to' as const, icon: <Glyph d={G.notes} /> },
      { key: 'pyqs', label: `${SUBJECT_NAME[s]} PYQs`, hint: 'Past questions, topic by topic', href: `/${s}/pyqs`, group: 'Go to' as const, icon: <Glyph d={G.pyq} /> },
    ] : [
      { key: 'notes', label: 'Notes', hint: 'Pick an optional', href: '/notes', group: 'Go to' as const, icon: <Glyph d={G.notes} /> },
    ]),
    { key: 'evaluate', label: 'Evaluate an answer', hint: 'Upload a handwritten answer', href: '/evaluate', group: 'Go to', icon: <Glyph d={G.pen} /> },
    { key: 'tests', label: 'Tests', hint: 'Practice tests', href: s ? `/test?optional=${PROFILE_SPELLING[s]}` : '/test', group: 'Go to', icon: <Glyph d={G.test} /> },
    ...(s === 'geography' ? [{ key: 'maps', label: 'Map practice', hint: 'Every map question', href: '/geography/mapping', group: 'Go to' as const, icon: <Glyph d={G.map} /> }] : []),
    { key: 'dashboard', label: 'Dashboard', href: '/dashboard', group: 'Go to', icon: <Glyph d={G.dash} /> },
    { key: 'optionals', label: 'All optionals', href: '/#optionals', group: 'Go to', icon: <Glyph d={G.grid} /> },
    { key: 'pricing', label: 'Plans and pricing', href: '/pricing', group: 'Go to', icon: <Glyph d={G.plans} /> },
    { key: 'home', label: 'Home', href: '/', group: 'Go to', icon: <Glyph d={G.home} /> },
  ];
  // Every optional's PYQs, for a reader who has not picked one.
  if (!s) {
    for (const [id, name] of Object.entries(SUBJECT_NAME)) {
      list.push({ key: `pyqs-${id}`, label: `${name} PYQs`, href: `/${id}/pyqs`, group: 'Go to', icon: <SubjectIcon id={id} size={16} /> });
    }
  }
  return list;
}

/** How well a note matches: title first, then its subtopics, then its description. */
function noteScore(n: SubjectNote, q: string): number {
  const t = n.title.toLowerCase();
  if (t.startsWith(q)) return 100;
  if (t.includes(q)) return 80;
  if ((n.subtopics ?? []).some((s) => s.toLowerCase().includes(q))) return 60;
  if (n.description.toLowerCase().includes(q)) return 30;
  return 0;
}

export default function CommandPalette({ open, onClose, subject }: { open: boolean; onClose: () => void; subject: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setQuery('');
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    document.body.style.overflow = 'hidden';
    return () => { window.clearTimeout(id); document.body.style.overflow = ''; };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const all = pages(subject);
    if (!q) {
      // Nothing typed: the tools, then a few of this optional's notes.
      const starters = subject ? allNotes.filter((n) => n.subject === subject).slice(0, 4) : [];
      return [...all.slice(0, 7), ...starters.map(noteItem)];
    }
    const pageHits = all.filter((p) => p.label.toLowerCase().includes(q) || p.hint?.toLowerCase().includes(q));
    const noteHits = allNotes
      .map((n) => ({ n, score: noteScore(n, q) + (n.subject === subject ? 15 : 0) }))
      .filter((x) => x.score > 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => noteItem(x.n));
    const ask: Item = {
      key: 'ask',
      label: `Ask the AI: “${query.trim()}”`,
      hint: subject ? `${SUBJECT_NAME[subject]} chat` : 'AI chat',
      href: `/chat?q=${encodeURIComponent(query.trim())}${subject ? `&subject=${subject}` : ''}`,
      group: 'Ask',
      icon: <Glyph d={G.chat} />,
    };
    // A question reads as one ("why", "explain", a question mark): asking leads.
    const looksLikeQuestion = /\?|^(why|how|what|explain|discuss|compare|examine|critically|who|when|is|does|did)\b/.test(q);
    return looksLikeQuestion || (!pageHits.length && !noteHits.length)
      ? [ask, ...noteHits, ...pageHits]
      : [...noteHits, ...pageHits, ask];
  }, [query, subject]);

  function noteItem(n: SubjectNote): Item {
    return {
      key: `note-${n.slug}`,
      label: n.title,
      hint: `${SUBJECT_NAME[n.subject]} · ${n.section}`,
      href: `/notes/${n.subject}/${n.slug}`,
      group: 'Notes',
      icon: <SubjectIcon id={n.subject} size={16} />,
    };
  }

  // Keep the active row in view as the arrows move it.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    router.push(item.href);
  };

  if (!open) return null;

  let lastGroup = '';
  return (
    <div className="cp-scrim ds" onMouseDown={onClose}>
      <style dangerouslySetInnerHTML={{ __html: CP_CSS }} />
      <div className="cp" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cp-input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            ref={inputRef}
            // Focused as it appears, so keys typed straight after ⌘K land.
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); go(items[active]); }
              else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            placeholder="Search, or ask the AI…"
            aria-label="Search"
            aria-activedescendant={items[active] ? `cp-${items[active].key}` : undefined}
            role="combobox"
            aria-expanded="true"
            aria-controls="cp-list"
          />
          <kbd onClick={onClose}>esc</kbd>
        </div>
        <div className="cp-list" id="cp-list" role="listbox" ref={listRef}>
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.key}>
                {head && <div className="cp-group">{head}</div>}
                <button
                  id={`cp-${it.key}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  className={`cp-item${i === active ? ' on' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(it)}
                >
                  <span className="cp-icon">{it.icon}</span>
                  <span className="cp-text">
                    <span className="cp-label">{it.label}</span>
                    {it.hint && <span className="cp-hint">{it.hint}</span>}
                  </span>
                  {i === active && <span className="cp-enter" aria-hidden="true">↵</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="cp-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
          <span><kbd>↵</kbd> to open</span>
          <span><kbd>esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}

const CP_CSS = `
.cp-scrim {
  position: fixed; inset: 0; z-index: 2000;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; justify-content: center; align-items: flex-start;
  padding: 12vh var(--space-4) var(--space-4);
  animation: cpFade 0.12s ease-out;
}
.cp {
  width: 100%; max-width: 620px; max-height: min(560px, 76vh);
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-xl);
  box-shadow: var(--elev-3);
  animation: cpRise 0.14s ease-out;
}
.cp-input { flex-shrink: 0; display: flex; align-items: center; gap: var(--space-3); padding: 0 var(--space-4); height: 56px; border-bottom: 1px solid var(--border); color: var(--text3); }
.cp-input input { flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: none; color: var(--text); font-size: 1.02rem; }
.cp-input input::placeholder { color: var(--text3); }
.cp kbd {
  font-family: var(--font-ui); font-size: 0.7rem; color: var(--text3);
  padding: 1px 6px; border: 1px solid var(--border2); border-radius: var(--radius-xs); background: var(--ds-soft);
}
.cp-input kbd { cursor: pointer; }
.cp-list { flex: 1; min-height: 0; overflow-y: auto; padding: var(--space-2); overscroll-behavior: contain; }
.cp-group { font-family: var(--font-ui); font-size: 0.74rem; font-weight: 600; color: var(--text3); padding: var(--space-3) var(--space-2) var(--space-1); }
.cp-item {
  width: 100%; display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2); border: none; background: none; border-radius: var(--radius-md);
  color: var(--text); text-align: left; cursor: pointer;
}
.cp-item.on { background: var(--accent-dim); }
.cp-icon { width: 30px; height: 30px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-md); background: var(--ds-soft); color: var(--text2); border: 1px solid var(--border); }
.cp-item.on .cp-icon { color: var(--accent-text); border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
.cp-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cp-label { font-size: 0.94rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-hint { font-family: var(--font-ui); font-size: 0.76rem; color: var(--text3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-enter { color: var(--accent-text); font-family: var(--font-ui); font-size: 0.85rem; }
.cp-foot { flex-shrink: 0; display: flex; gap: var(--space-4); padding: var(--space-2) var(--space-4); border-top: 1px solid var(--border); font-family: var(--font-ui); font-size: 0.74rem; color: var(--text3); }
.cp-foot kbd { margin-right: 3px; }
@keyframes cpFade { from { opacity: 0; } }
@keyframes cpRise { from { opacity: 0; transform: translateY(6px) scale(0.99); } }
@media (max-width: 640px) {
  .cp-scrim { padding: var(--space-3); align-items: flex-start; }
  .cp { max-height: 82vh; }
  .cp-foot { display: none; }
}
@media (hover: none) { .cp-foot, .cp-input kbd { display: none; } }
@media (prefers-reduced-motion: reduce) { .cp-scrim, .cp { animation: none; } }
`;
