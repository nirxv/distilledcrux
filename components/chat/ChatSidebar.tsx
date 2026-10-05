'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { detectTopic } from '@/lib/detectTopic';
import { getNoteBySlug } from '@/lib/notes';
import { sectionsFor } from '@/lib/chatStart';
import { FLASHCARDS_LIVE, SYLLABUS_TRACKER_LIVE } from '@/lib/features';
import type { SubjectKey } from '@/lib/subjectConfig';

export type ChatSummary = { id: string; title: string; updatedAt: number; subject: SubjectKey };

type Props = {
  langHi: boolean;
  subject: SubjectKey;
  chats: ChatSummary[];
  activeId: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  bookMode: boolean;
  onBooks: () => void;
  syllabusDone: number;
  syllabusTotal: number;
  flashDue: number;
};

/**
 * A topic's tint follows its section's place in the subject, so the sections
 * of one optional are told apart the way history-optional tells its periods
 * apart.
 */
const TINTS = ['var(--ch-tint-1)', 'var(--ch-tint-2)', 'var(--ch-tint-3)', 'var(--ch-tint-4)'];

function tintFor(subject: SubjectKey, section: string): string {
  const i = sectionsFor(subject).indexOf(section);
  return i === -1 ? 'var(--text3)' : TINTS[i % TINTS.length];
}

type Group = { key: string; title: string; tint: string; items: ChatSummary[]; latest: number };

/**
 * Chats filed under the syllabus topic they are about, the way the design
 * files searches under a goal. The topic comes from the chat's title, which
 * is its first question, read against the notes of the chat's own optional;
 * a chat that matches no topic goes under "Other".
 */
function groupChats(chats: ChatSummary[], otherLabel: string): Group[] {
  const groups = new Map<string, Group>();
  for (const c of chats) {
    const hit = detectTopic(c.title, c.subject);
    const note = hit ? getNoteBySlug(hit.slug) : undefined;
    const key = note?.slug ?? 'other';
    const g = groups.get(key) ?? {
      key,
      title: note?.title ?? otherLabel,
      tint: note ? tintFor(c.subject, note.section) : 'var(--text3)',
      items: [],
      latest: 0,
    };
    g.items.push(c);
    g.latest = Math.max(g.latest, c.updatedAt);
    groups.set(key, g);
  }
  const list = [...groups.values()];
  for (const g of list) g.items.sort((a, b) => b.updatedAt - a.updatedAt);
  // "Other" goes last whatever its date, so the named topics lead.
  return list.sort((a, b) => (a.key === 'other' ? 1 : b.key === 'other' ? -1 : b.latest - a.latest));
}

function shortDate(ms: number, langHi: boolean) {
  return new Date(ms).toLocaleDateString(langHi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });
}

const Icon = {
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  books: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M9 7h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9" /><path d="M15.5 6.5l2.9-.8a1 1 0 0 1 1.2.7l3 11a1 1 0 0 1-.7 1.2l-2.9.8a1 1 0 0 1-1.2-.7l-3-11a1 1 0 0 1 .7-1.2z" /></svg>,
  topic: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>,
  cards: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="14" height="13" rx="2" /><path d="M7 4h12a2 2 0 0 1 2 2v11" /></svg>,
  pyq: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4h6v3H9z" /><path d="M9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15" /><path d="M9 12h6M9 16h4" /></svg>,
  dash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  close: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
};

export default function ChatSidebar(p: Props) {
  const { langHi } = p;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const L = {
    search: langHi ? 'चैट खोजें' : 'Search chats',
    newChat: langHi ? 'नई चैट' : 'New chat',
    books: langHi ? 'पुस्तकों से चैट' : 'Chat with books',
    yourChats: langHi ? 'आपकी चैट' : 'Your chats',
    other: langHi ? 'अन्य प्रश्न' : 'Other questions',
    none: langHi ? 'अभी कोई चैट नहीं। आपकी पहली चैट यहाँ दिखेगी।' : 'No chats yet. Your first one will appear here.',
    noMatch: langHi ? 'कोई चैट नहीं मिली।' : 'No chats match that.',
    flashcards: langHi ? 'फ्लैशकार्ड' : 'Flashcards',
    pyqs: 'PYQs',
    dashboard: langHi ? 'डैशबोर्ड' : 'Dashboard',
    coverage: langHi ? 'पाठ्यक्रम कवरेज' : 'Syllabus coverage',
    update: langHi ? 'प्रगति अपडेट करें' : 'Update progress',
    del: langHi ? 'हटाएँ' : 'Delete',
  };

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? p.chats.filter((c) => c.title.toLowerCase().includes(q)) : p.chats),
    [p.chats, q],
  );
  const groups = useMemo(() => groupChats(p.chats, L.other), [p.chats, L.other]);
  const activeGroup = groups.find((g) => g.items.some((c) => c.id === p.activeId))?.key;

  const pct = p.syllabusTotal ? Math.round((p.syllabusDone / p.syllabusTotal) * 100) : 0;
  const R = 26;
  const C = 2 * Math.PI * R;

  const chatRow = (c: ChatSummary) => (
    <div
      key={c.id}
      className={`ch-side-chat${c.id === p.activeId ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => p.onOpen(c.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') p.onOpen(c.id); }}
    >
      <div className="ch-side-chat-title">{c.title}</div>
      <div className="ch-side-chat-date">{shortDate(c.updatedAt, langHi)}</div>
      <button
        className="ch-side-chat-del"
        aria-label={L.del}
        title={L.del}
        onClick={(e) => { e.stopPropagation(); p.onDelete(c.id); }}
      >
        {Icon.close}
      </button>
    </div>
  );

  return (
    <div className="ch-side-inner">
      <label className="ch-side-search">
        {Icon.search}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L.search} aria-label={L.search} />
      </label>

      <div className="ch-side-actions">
        <button className="ch-btn ch-btn-solid" onClick={p.onNewChat}>{Icon.plus}{L.newChat}</button>
        <button className={`ch-btn ch-btn-line${p.bookMode ? ' on' : ''}`} onClick={p.onBooks} aria-pressed={p.bookMode}>
          {Icon.books}{L.books}
        </button>
      </div>

      <div className="ch-side-rule" />

      <div className="ch-side-chats">
        {p.chats.length > 0 && <div className="ch-side-label">{L.yourChats}</div>}
        {p.chats.length === 0 && <div className="ch-side-empty">{L.none}</div>}
        {q ? (
          matches.length ? matches.map(chatRow) : <div className="ch-side-empty">{L.noMatch}</div>
        ) : (
          groups.map((g, i) => {
            const isOpen = open[g.key] ?? (g.key === activeGroup || (activeGroup === undefined && i === 0));
            return (
              <div key={g.key} className="ch-side-group">
                <button
                  className="ch-side-group-head"
                  onClick={() => setOpen((o) => ({ ...o, [g.key]: !isOpen }))}
                  aria-expanded={isOpen}
                >
                  <span className="ch-side-group-icon" style={{ color: g.tint }}>{Icon.topic}</span>
                  <span className="ch-side-group-title">{g.title}</span>
                  <span className="ch-side-group-count">{g.items.length}</span>
                  <span className={`ch-side-chev${isOpen ? ' open' : ''}`}>{Icon.chevron}</span>
                </button>
                {isOpen && <div className="ch-side-group-items">{g.items.map(chatRow)}</div>}
              </div>
            );
          })
        )}
      </div>

      <div className="ch-side-rule" />

      <nav className="ch-side-nav">
        {FLASHCARDS_LIVE && (
          <Link href="/flashcards">
            {Icon.cards}<span>{L.flashcards}</span>
            {p.flashDue > 0 && <span className="ch-side-badge" title={langHi ? 'दोहराने के लिए बाकी' : 'Due for review'}>{p.flashDue}</span>}
          </Link>
        )}
        <Link href={`/${p.subject}/pyqs`}>{Icon.pyq}<span>{L.pyqs}</span></Link>
        <Link href="/dashboard">{Icon.dash}<span>{L.dashboard}</span></Link>
      </nav>

      {SYLLABUS_TRACKER_LIVE && (
        <div className="ch-side-card">
          <div className="ch-ring">
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r={R} fill="none" stroke="var(--border)" strokeWidth="5" />
              <circle
                cx="32" cy="32" r={R} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 32 32)"
              />
            </svg>
            <span>{pct}%</span>
          </div>
          <div className="ch-side-card-title">{L.coverage}</div>
          <div className="ch-side-card-text">
            {langHi
              ? `${p.syllabusTotal} में से ${p.syllabusDone} विषय पूरे। जैसे-जैसे पढ़ें, टिक करते जाएँ।`
              : `${p.syllabusDone} of ${p.syllabusTotal} topics done. Tick them off as you finish each one.`}
          </div>
          <Link href="/dashboard" className="ch-side-card-link">{L.update}</Link>
        </div>
      )}

    </div>
  );
}
