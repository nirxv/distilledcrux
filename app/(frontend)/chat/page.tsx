'use client';
import { sanitizeHtml as sanitize } from '@/lib/sanitizeHtml';
import { Fragment, useState, useRef, useEffect, Suspense, useCallback, useMemo } from 'react';
import { preload } from 'react-dom';
import { marked } from 'marked';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { fixSentenceSpacing } from '@/lib/textSpacing';
import { notesForSubject } from '@/lib/notes';
import { detectTopic } from '@/lib/detectTopic';
import { compose, formatFor, EMPTY_START, SCHOLARS, type StartState } from '@/lib/chatStart';
import { SUBJECT_BOOKS, SUBJECT_DISPLAY, type SubjectKey } from '@/lib/subjectConfig';
import { CHAT_TOPIC_PYQS_LIVE, FLASHCARDS_LIVE, SYLLABUS_TRACKER_LIVE } from '@/lib/features';
import { topicKey, useSyllabusTracker } from '@/hooks/useSyllabusTracker';
import { takeStages, type StageEvent } from '@/lib/chatStream';
import { suggestions, nextSuggestion, graphemes } from '@/lib/chatSuggestions';
import ChatSidebar from '@/components/chat/ChatSidebar';
import StartFlow, { loadRelated, type Related, type RelatedPyq } from '@/components/chat/StartFlow';
import ThinkingSteps, { ResearchTrace, NO_PROGRESS, type Progress, type Trace } from '@/components/chat/ThinkingSteps';
import SidePanel, { type PanelContent, type Source } from '@/components/chat/SidePanel';
import WorthKnowing from '@/components/chat/WorthKnowing';
import Mascot from '@/components/Mascot';
import OwlLoader from '@/components/OwlLoader';
import { parseMentorSections } from '@/lib/chatMentor';
import { linkifyCitations } from '@/lib/chatCitations';
import { useChatAccess } from '@/hooks/useChatAccess';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  isMentor?: boolean;
  /** Set when the answer was asked for as a Mains answer. */
  format?: 'mains';
  /** The follow-up the server suggested after this answer. */
  next?: string;
  /** The research steps behind this answer and how long they took. */
  trace?: Trace;
};

type ChatHistoryEntry = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  /** The optional the chat was held in. Chats saved before the redesign lack it. */
  subject?: SubjectKey;
};

type Style = 'concise' | 'elaborative' | 'mains';

const CHAT_HISTORY_KEY = 'pp_chat_history_v1';
const CHAT_HISTORY_MAX = 50;
// ?c=<chat id>: which conversation is open, so Back from a link in an answer
// (flashcards, PYQs, notes) reopens it instead of an empty chat.
const CHAT_PARAM = 'c';
// Where the reader was in that conversation, for the same return trip.
const CHAT_SCROLL_KEY = 'pp_chat_scroll';
// The past-questions panel, when a question in it was opened, to reopen on Back.
const CHAT_PANEL_KEY = 'pp_chat_panel';
const SOURCES_MARKER = '\n__SOURCES__';
const NEXT_MARKER = '\n__NEXT__';
const SUBJECTS: SubjectKey[] = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'];
// /api/user-profile stores the optional a subscription is sold under.
const SUBJECT_BY_OPTIONAL: Record<string, SubjectKey> = {
  sociology: 'sociology',
  anthropology: 'anthropology',
  geography: 'geography',
  'political-science': 'polsci',
  'public-administration': 'pub-admin',
};
// Saved by the chat before the redesign when the free messages ran out.
const LIMIT_MARKER = '__LIMIT_REACHED__';

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
}

function loadChatHistory(): ChatHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveChatHistoryList(list: ChatHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(list.slice(0, CHAT_HISTORY_MAX)));
  } catch {}
}

function makeChatTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  const base = (firstUser?.content || 'New chat').trim().replace(/\s+/g, ' ');
  return base.length > 60 ? base.slice(0, 60) + '…' : base;
}

/**
 * The conversation proper starts at the first question. Chats saved before
 * the redesign open with a greeting from the assistant, which the new start
 * screen replaces, so it is neither shown nor sent back to the model. Nor is
 * the marker the old page saved in place of an answer once the free messages
 * ran out.
 */
function threadOf(messages: Message[]): Message[] {
  const first = messages.findIndex(m => m.role === 'user');
  return first === -1 ? [] : messages.slice(first).filter(m => m.content !== LIMIT_MARKER);
}

function cleanChunk(text: string): string {
  return text
    .replace(/indira gandhi national open university[\s\S]{0,600}/gi, '')
    .replace(/expert committee[\s\S]{0,600}/gi, '')
    .replace(/school of social sciences[\s\S]{0,300}/gi, '')
    .replace(/check your progress[\s\S]{0,400}/gi, '')
    .replace(/answers to check your progress[\s\S]{0,400}/gi, '')
    .replace(/instructional video[\s\S]{0,300}/gi, '')
    .replace(/suggested readings[\s\S]{0,400}/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\.{4,}/g, '')
    .replace(/_{4,}/g, '')
    .replace(/\s{3,}/g, ' ')
    .trim();
}

async function downloadAnswerAsPDF(markdownText: string, questionText?: string) {
  const slug = (questionText ?? markdownText).slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') || 'response';
  const res = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdownText, questionText }),
  });
  if (!res.ok) throw new Error('PDF generation failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = slug + ' (distilledcrux.com).pdf';
  a.click();
  URL.revokeObjectURL(url);
}

function DownloadPDFButton({ content, question, langHi }: { content: string; question?: string; langHi: boolean }) {
  const [downloading, setDownloading] = useState(false);
  const handleClick = async () => {
    setDownloading(true);
    try { await downloadAnswerAsPDF(content, question); }
    catch (e) { console.error(e); alert('PDF generation failed.'); }
    finally { setDownloading(false); }
  };
  return (
    <button onClick={handleClick} disabled={downloading} className="ch-btn ch-btn-line ch-btn-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
      {downloading ? (langHi ? 'बन रहा है…' : 'Preparing…') : (langHi ? 'PDF सहेजें' : 'Save PDF')}
    </button>
  );
}

// ── Answer formatting ─────────────────────────────────────────────────────────

function formatTable(text: string): string {
  const lines = text.split('\n');
  let result = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes('|') && line.trim().startsWith('|')) {
      const nextLine = lines[i + 1] || '';
      if (nextLine.match(/^[|\s\-:]+$/)) {
        const headers = line.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
        let rows = '';
        i += 2;
        while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
          const cols = lines[i].split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
          rows += `<tr>${cols}</tr>`;
          i++;
        }
        result += `<div class="chat-table-wrap"><table class="chat-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
        continue;
      }
    }
    result += lines[i] + '\n';
    i++;
  }
  return result;
}


function formatMessage(text: string, sources: Source[] = []) {
  // Also applied server-side; repeated here so answers already saved in
  // history render correctly without a re-generation.
  text = fixSentenceSpacing(text);
  text = formatTable(text);
  text = text.replace(/^-{3,}$/gm, '___HR___');
  // A line of bare asterisks is bold the model opened and never closed.
  text = text.replace(/^[ \t]*\*{1,2}[ \t]*$/gm, '').replace(/\n{3,}/g, '\n\n');
  text = text.replace(/^#{1,2} (.+)$/gm, (_: string, t: string) => `___H1___${t}___END___`);
  text = text.replace(/^### (.+)$/gm, (_: string, t: string) => `___H2___${t}___END___`);
  text = text.replace(/^#{4,6} (.+)$/gm, (_: string, t: string) => `___H3___${t}___END___`);
  text = text.replace(/^ *\d+[.)]\s+(.+)$/gm, (_: string, t: string) => `___BULLET___${t}___END___`);
  text = text.replace(/^ *[-*•–—]\s+\*\*([^*\n]+?)\*\*:?[ \t]*$/gm, (_: string, t: string) => `___H3___${t}___END___`);
  text = text.replace(/^ *[-*•–—]\s+(.+)$/gm, (_: string, t: string) => `___BULLET___${t}___END___`);
  // [^*\n], not [^*]: a heading is one line. Across lines, `**`, blank line,
  // `**` matched with the blank line as the title, and the markers it left
  // could not be closed by the single-line replacements below.
  text = text.replace(/^[ \t]*\*\*([^*\n]+)\*\*[ \t]*$/gm, (_: string, t: string) => `___H3___${t}___END___`);
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/___HR___/g, '<div class="chat-hr"></div>');
  text = text.replace(/___H1___(.+?)___END___/g, (_: string, t: string) => `<div class="chat-msg-h1">${t}</div>`);
  text = text.replace(/___H2___(.+?)___END___/g, (_: string, t: string) => `<div class="chat-msg-h2">${t.replace(/^#+\s*/, '')}</div>`);
  text = text.replace(/___H3___(.+?)___END___/g, (_: string, t: string) => `<div class="chat-msg-h3">${t}</div>`);
  text = text.replace(/___BULLET___(.+?)___END___/g, (_: string, t: string) => `<div class="chat-bullet"><span class="chat-bullet-dot"></span><span>${t}</span></div>`);
  text = text.replace(/\n\n/g, '<div class="chat-para-gap"></div>');
  text = text.replace(/\n/g, '<br/>');
  text = text.replace(/<div class="chat-bullet"><span class="chat-bullet-dot"><\/span><span><strong>([^<]+)<\/strong>:?\s*<\/span><\/div>/g, (_: string, t: string) => `<div class="chat-msg-h3">${t}</div>`);
  text = text.replace(/<\/div><div class="chat-para-gap"><\/div><div class="chat-bullet">/g, '</div><div class="chat-bullet">');
  text = text.replace(/(<div class="chat-msg-h[123]">[^<]+<\/div>)<div class="chat-para-gap"><\/div>(<div class="chat-bullet">)/g, '$1$2');
  text = linkifyCitations(text, sources);
  return text;
}

const MENTOR_SECTIONS: Record<string, { label: string; icon: string; color: string }> = {
  DIRECTIVE:   { label: 'Directive Rule',       icon: '🔍', color: 'var(--warning-text)' },
  DIAGNOSIS:   { label: 'Demand Diagnosis',     icon: '📋', color: 'var(--accent)' },
  BLUEPRINTS:  { label: 'Four Blueprints',      icon: '🗺️', color: 'var(--info-text)' },
  MODELANSWER: { label: 'Model Answer',         icon: '📝', color: 'var(--success-text)' },
  EVALUATION:  { label: 'Evaluation',           icon: '⚖️', color: 'var(--accent)' },
  STRENGTHS:   { label: 'Strengths',            icon: '✅', color: 'var(--success-text)' },
  CORRECTIONS: { label: 'Corrections',          icon: '🔧', color: 'var(--danger-text)' },
  IMPROVED:    { label: 'Improved Answer',      icon: '✨', color: 'var(--success-text)' },
  MCQ:         { label: 'Question',             icon: '❓', color: 'var(--info-text)' },
  MCQANSWER:   { label: 'Answer & Explanation', icon: '💡', color: 'var(--warning-text)' },
};

const BLUEPRINT_COLOR: Record<string, string> = {
  A: 'var(--warning-text)', B: 'var(--accent)', C: 'var(--success-text)', D: 'var(--info-text)',
};

function MentorBubble({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const sections = parseMentorSections(content);
  const renderContent = (text: string, sectionType?: string) => {
    if (sectionType === 'BLUEPRINTS') {
      const lines = text.split('\n').filter(l => l.trim());
      const optionLines = lines.filter(l => /^\*\*[A-D]/.test(l.trim()));
      const otherLines = lines.filter(l => !/^\*\*[A-D]/.test(l.trim()));
      return (
        <div className="ch-mentor-blueprints">
          {otherLines.length > 0 && <div dangerouslySetInnerHTML={{ __html: sanitize(marked.parse(otherLines.join('\n'), { breaks: true }) as string) }} />}
          {optionLines.map((line, idx) => {
            const letter = line.trim().replace(/^\*\*([A-D]).*/, '$1');
            const color = BLUEPRINT_COLOR[letter] ?? 'var(--text3)';
            return (
              <div key={idx} className="ch-mentor-option" style={{ borderLeftColor: color, background: `color-mix(in srgb, ${color} 7%, transparent)` }}>
                <div dangerouslySetInnerHTML={{ __html: sanitize(marked.parse(line.trim(), { breaks: true }) as string) }} />
              </div>
            );
          })}
        </div>
      );
    }
    return <div dangerouslySetInnerHTML={{ __html: sanitize(formatMessage(text)) }} />;
  };
  return (
    <div className="ch-mentor">
      <div className="ch-mentor-tag">
        <span>🎓 Mentor</span>
        {isStreaming && <span className="ch-mentor-live">generating…</span>}
      </div>
      {sections.map((sec, i) => {
        if (sec.type === 'TEXT') {
          return sec.content ? <div key={i} className="ch-answer-text" dangerouslySetInnerHTML={{ __html: sanitize(formatMessage(sec.content)) }} /> : null;
        }
        const cfg = MENTOR_SECTIONS[sec.type];
        if (!cfg) return <div key={i}>{renderContent(sec.content)}</div>;
        return (
          <div key={i} className="ch-mentor-section" style={{ borderColor: `color-mix(in srgb, ${cfg.color} 28%, transparent)`, background: `color-mix(in srgb, ${cfg.color} 5%, transparent)` }}>
            <div className="ch-mentor-section-head" style={{ color: cfg.color }}><span>{cfg.icon}</span>{cfg.label}</div>
            <div className="ch-answer-text">{renderContent(sec.content, sec.type)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Pieces under an answer ────────────────────────────────────────────────────

function SourcesCard({ sources, active, langHi, onOpen }: { sources: Source[]; active: boolean; langHi: boolean; onOpen: () => void }) {
  const books = [...new Set(sources.map(s => s.book_title))];
  const shown = books.slice(0, 2).join(', ') + (books.length > 2 ? (langHi ? ` और ${books.length - 2} अन्य` : ` and ${books.length - 2} more`) : '');
  return (
    <button className={`ch-sources-card${active ? ' on' : ''}`} onClick={onOpen}>
      <span className="ch-sources-thumb" aria-hidden="true">
        <svg viewBox="0 0 64 48" width="64" height="48">
          <rect x="6" y="10" width="10" height="34" rx="2" fill="var(--ch-tint-1)" />
          <rect x="18" y="4" width="11" height="40" rx="2" fill="var(--accent)" />
          <rect x="31" y="8" width="9" height="36" rx="2" fill="var(--ch-tint-2)" />
          <rect x="42" y="6" width="11" height="38" rx="2" transform="rotate(8 47 25)" fill="var(--premium-text)" />
          <rect x="2" y="44" width="60" height="2" rx="1" fill="var(--border3)" />
        </svg>
      </span>
      <span className="ch-sources-text">
        <strong>{langHi ? `${sources.length} पुस्तक अंश` : `${sources.length} book passage${sources.length === 1 ? '' : 's'}`}</strong>
        <span>{langHi ? `${shown} से` : `from ${shown}`}</span>
      </span>
      <span className="ch-sources-go" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </span>
    </button>
  );
}

function FollowUps({ slug, asked, wasMains, langHi, subject, onSend }: {
  slug: string | null;
  asked: string[];
  wasMains: boolean;
  langHi: boolean;
  subject: SubjectKey;
  onSend: (text: string, format?: 'mains') => void;
}) {
  const [related, setRelated] = useState<Related | null>(null);
  useEffect(() => {
    if (!slug) return;
    let live = true;
    loadRelated(slug).then(r => { if (live) setRelated(r); });
    return () => { live = false; };
  }, [slug]);

  // A real past question on the topic, one the reader has not asked yet.
  const pyq = CHAT_TOPIC_PYQS_LIVE ? related?.pyqs.find(q => !asked.some(a => a.includes(q.question.slice(0, 60)))) : undefined;
  const items: { key: string; label: string; go: () => void }[] = [];
  if (!wasMains) {
    const text = langHi ? 'इसे मुख्य परीक्षा के उत्तर में बदलें' : 'Turn this into a Mains answer';
    items.push({ key: 'mains', label: text, go: () => onSend(text, 'mains') });
  }
  {
    const who = SCHOLARS[subject];
    const label = langHi ? `${who.hi} के मत जोड़ें` : `Add what ${who.en} argue`;
    const text = langHi ? `इस पर ${who.hi} के मत जोड़ें, और बताएँ कौन-सा मत किसका है।` : `Add what ${who.en} argue about this, and who holds each view.`;
    items.push({ key: 'scholars', label, go: () => onSend(text) });
  }
  if (pyq) {
    items.push({
      key: 'pyq',
      label: langHi ? `इस पर ${pyq.year} का PYQ हल करें` : `Try the ${pyq.year} PYQ on this`,
      go: () => onSend(`Answer this PYQ (${pyq.year}, ${pyq.marks} marks): ${pyq.question}`, 'mains'),
    });
  } else {
    const label = langHi ? 'इसे और सरल भाषा में समझाएँ' : 'Explain it more simply';
    const text = langHi ? 'इसे और सरल भाषा में समझाएँ, जैसे मैं यह विषय पहली बार पढ़ रहा हूँ।' : 'Explain this more simply, as if I am meeting the topic for the first time.';
    items.push({ key: 'simple', label, go: () => onSend(text) });
  }

  return (
    <div className="ch-follow">
      {items.map(it => (
        <button key={it.key} className="ch-follow-btn" onClick={it.go}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4v7a4 4 0 0 0 4 4h10M15 11l4 4-4 4" /></svg>
          {it.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Sign in first, or the free messages are used up. Both lead off the page:
 * to sign-in, which brings the reader back here with the question, or to the
 * plans.
 */
function AccessModal({ kind, langHi, loginHref, onClose }: {
  kind: 'login' | 'limit';
  langHi: boolean;
  loginHref: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const login = kind === 'login';
  return (
    <div className="ch-modal-scrim" onClick={onClose}>
      <div className="ch-modal" role="dialog" aria-modal="true" aria-labelledby="ch-access-title" onClick={e => e.stopPropagation()}>
        <Mascot pose="peek" width={96} />
        <div id="ch-access-title" className="ch-modal-title">
          {login
            ? (langHi ? 'चैट के लिए साइन इन करें' : 'Sign in to start chatting')
            : (langHi ? 'आपकी 3 निःशुल्क चैट पूरी हो गईं' : "You've used your 3 free chats")}
        </div>
        <p>
          {login
            ? (langHi ? 'निःशुल्क खाते में 3 संदेश मिलते हैं। लौटने पर आपका प्रश्न यहीं मिलेगा।' : 'A free account comes with 3 messages. Your question will be waiting when you get back.')
            : (langHi ? 'असीमित चैट और मूल्यांकन, मेंटर मोड, पुस्तकों से चैट और PDF।' : 'Unlimited chats and evaluations, Mentor mode, Chat with books and PDFs.')}
        </p>
        <Link className="ch-btn ch-btn-solid ch-btn-wide" href={login ? loginHref : '/pricing'}>
          {login ? (langHi ? 'साइन इन करें' : 'Sign in') : (langHi ? 'प्लान देखें' : 'See plans')}
        </Link>
        <button className="ch-link-btn" onClick={onClose}>{langHi ? 'बाद में' : 'Maybe later'}</button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function ChatContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialTopic = searchParams.get('topic') || '';
  const rawSubject = searchParams.get('subject') as SubjectKey | null;
  const langHi = searchParams.get('lang') === 'hi';
  // ?subject= when a page links here; otherwise the reader's own optional,
  // read from their profile once sign-in has settled.
  const [subject, setSubject] = useState<SubjectKey>(rawSubject && SUBJECTS.includes(rawSubject) ? rawSubject : 'sociology');
  // Set once the subject has been settled for this visit, by the URL or by
  // reopening a saved chat, so the profile lookup does not overrule it.
  const subjectSetRef = useRef(Boolean(rawSubject && SUBJECTS.includes(rawSubject)));
  // Notes pages link here with ?topic=<note title>; a known title starts the
  // guided flow on that topic.
  const topicNote = useMemo(
    () => (initialTopic ? notesForSubject(subject).find(n => n.title.toLowerCase() === initialTopic.toLowerCase()) ?? null : null),
    [initialTopic, subject],
  );
  // The reading owl is only drawn once a question is sent; fetched then, it
  // arrived a beat after the checklist it sits beside.
  preload('/mascot/owl-reading.svg', { as: 'image' });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress>(NO_PROGRESS);

  const [bookMode, setBookMode] = useState(false);
  const [bookTitle, setBookTitle] = useState<string>('all');
  const [mentorMode, setMentorMode] = useState(false);
  const [brainstormMode, setBrainstormMode] = useState(false);
  const [responseStyle, setResponseStyle] = useState<Style>('concise');
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showBookPaywall, setShowBookPaywall] = useState(false);

  const [chatId, setChatId] = useState<string>(() => newId());
  const [historyList, setHistoryList] = useState<ChatHistoryEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [panel, setPanel] = useState<{ content: PanelContent; owner: number | null } | null>(null);
  const [start, setStart] = useState<StartState>(() => (topicNote ? { ...EMPTY_START, topics: [topicNote.slug] } : EMPTY_START));
  const [flowOpen, setFlowOpen] = useState(true);
  const [flowKey, setFlowKey] = useState(0);
  const [flashDue, setFlashDue] = useState(0);
  // Which suggested question the empty input shows. Drawn on the client after
  // mount, not during render, so the server's HTML and the first client render
  // agree; drawn again whenever the input empties.
  const [hint, setHint] = useState(0);

  const hasUserMessageRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAiRef = useRef<HTMLDivElement>(null);
  // Set when a conversation is reopened from the URL; the thread effect
  // returns to this scroll position instead of jumping to the last question.
  const restoreScrollRef = useRef<number | null>(null);
  // Whether this turn's question has been saved while its answer streams.
  const savedTurnRef = useRef(false);
  // The panel list's scroll position, handed to SidePanel once on Back.
  const panelTopRef = useRef<number | null>(null);
  const takePanelTop = useCallback(() => { const top = panelTopRef.current; panelTopRef.current = null; return top; }, []);
  // Until the mount has read ?c=, the URL is not ours to rewrite.
  const [chatRestored, setChatRestored] = useState(false);

  const { user, access, canChat, incrementChat } = useChatAccess(subject);
  // Syllabus ticks, for the coverage card and "Mark it done" (lib/features.ts).
  const tracker = useSyllabusTracker();

  // Signing in is required to use the chat, as it always has been here: a
  // signed-out visitor goes to the login page, which brings them back to
  // this address, question and all.
  useEffect(() => {
    if (user !== null) return;
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }, [user]);
  const usageLoading = access.loading;
  const subscribed = access.subscribed;
  const [modal, setModal] = useState<'login' | 'limit' | null>(null);
  const showLoginModal = () => setModal('login');
  const showChatLimitModal = () => setModal('limit');

  // The reader's own optional, when no link named one.
  useEffect(() => {
    if (!user || subjectSetRef.current) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/user-profile', { headers: { 'x-user-token': await user.getIdToken() } });
        const mapped = SUBJECT_BY_OPTIONAL[(await res.json())?.optional];
        if (live && mapped && !subjectSetRef.current) setSubject(mapped);
      } catch { /* the default subject stays */ }
    })();
    return () => { live = false; };
  }, [user]);

  const thread = useMemo(() => threadOf(messages), [messages]);
  const empty = thread.length === 0;

  // Follow a streaming answer; once it lands, bring its first line into view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || thread.length === 0) return;
    if (restoreScrollRef.current !== null) {
      el.scrollTop = restoreScrollRef.current;
      restoreScrollRef.current = null;
      return;
    }
    const last = thread[thread.length - 1];
    if (loading || last?.role !== 'assistant') {
      el.scrollTop = el.scrollHeight;
      return;
    }
    // Land on the question the answer is for, so both are in view.
    const questions = el.querySelectorAll<HTMLElement>('.ch-user');
    const target = questions[questions.length - 1] ?? lastAiRef.current;
    if (target) el.scrollTo({ top: Math.max(0, target.offsetTop - 24), behavior: 'smooth' });
  }, [thread, loading]);

  // The flow and the follow-ups write into the input from code, which fires
  // no input event, so the height is fitted whenever the text changes.
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  const hintPool = suggestions(subject, langHi);
  // Before the first message the input suggests an opening question from the
  // list. After it, the suggestion is the follow-up written for the last
  // answer; an older answer saved without one leaves a plain placeholder.
  const lastMsg = thread[thread.length - 1];
  const followUp = !empty && !loading && lastMsg?.role === 'assistant' ? lastMsg.next ?? null : null;
  const suggestion = empty ? hintPool[hint % hintPool.length] : followUp ?? '';
  const newHint = useCallback(() => setHint(h => nextSuggestion(h % hintPool.length, hintPool.length)), [hintPool.length]);

  // On arrival, and when the language changes the list.
  useEffect(() => { newHint(); }, [newHint]);

  // The suggestion types itself into the placeholder. Every state update
  // happens in a timer, and a count belonging to an earlier suggestion reads
  // as nothing typed, so a new suggestion starts from blank without a reset.
  const [typed, setTyped] = useState<{ text: string; n: number }>({ text: '', n: 0 });
  useEffect(() => {
    const chars = graphemes(suggestion);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = window.setTimeout(() => setTyped({ text: suggestion, n: chars.length }), 0);
      return () => window.clearTimeout(id);
    }
    // At a typist's pace rather than a machine's: about 90 ms a character,
    // uneven, with a breath after each word and a longer one after a comma.
    let n = 0;
    let id = 0;
    const pause = (c: string) => 70 + Math.random() * 50 + (c === ' ' ? 60 : 0) + (/[,;:]/.test(c) ? 220 : 0);
    const step = () => {
      n += 1;
      setTyped({ text: suggestion, n });
      if (n < chars.length) id = window.setTimeout(step, pause(chars[n - 1]));
    };
    id = window.setTimeout(step, 500);
    return () => window.clearTimeout(id);
  }, [suggestion]);
  const hintChars = graphemes(suggestion);
  const typedHint = typed.text === suggestion ? hintChars.slice(0, typed.n).join('') : '';
  const hintTyping = typed.text !== suggestion || typed.n < hintChars.length;

  // Opens a saved conversation. One that ends on a question was cut off
  // mid-answer, by a refresh or a closed tab, so the question goes back in
  // the box to send again rather than sitting there unanswered.
  const resumeEntry = (entry: ChatHistoryEntry) => {
    const last = entry.messages[entry.messages.length - 1];
    const cutOff = last?.role === 'user';
    const msgs = cutOff ? entry.messages.slice(0, -1) : entry.messages;
    setChatId(entry.id);
    hasUserMessageRef.current = msgs.some(m => m.role === 'user');
    setMessages(msgs);
    if (cutOff) setInput(last.content);
    // A follow-up belongs to the optional the chat was held in.
    if (entry.subject) { subjectSetRef.current = true; setSubject(entry.subject); }
  };

  useEffect(() => {
    const list = loadChatHistory();
    setHistoryList(list);
    // Leaving for a link in an answer unmounts this page, and Back mounts a
    // fresh one; the open conversation lived only in state, so readers came
    // back to an empty chat. ?c= names it, and it is reopened from history.
    const openId = new URLSearchParams(window.location.search).get(CHAT_PARAM);
    const entry = openId ? list.find(c => c.id === openId) : undefined;
    if (entry) {
      resumeEntry(entry);
      try {
        const saved = JSON.parse(sessionStorage.getItem(CHAT_SCROLL_KEY) ?? 'null') as { id?: string; top?: number } | null;
        if (saved?.id === entry.id && typeof saved.top === 'number') restoreScrollRef.current = saved.top;
      } catch { /* landing on the last question is the fallback */ }
      try {
        const saved = JSON.parse(sessionStorage.getItem(CHAT_PANEL_KEY) ?? 'null') as
          { id?: string; panel?: { content: PanelContent; owner: number | null }; top?: number } | null;
        if (saved?.id === entry.id && saved.panel?.content.kind === 'pyqs') {
          setPanel(saved.panel);
          panelTopRef.current = typeof saved.top === 'number' ? saved.top : null;
        }
      } catch { /* the panel stays shut */ }
    }
    // One trip only: a later Back from somewhere else should not reopen it.
    try { sessionStorage.removeItem(CHAT_PANEL_KEY); } catch { /* private mode */ }
    setChatRestored(true);
    if (FLASHCARDS_LIVE) {
      try {
        const sr = JSON.parse(localStorage.getItem('pp_flashcards_v1') ?? '{}') as Record<string, { nextDue?: string }>;
        const now = new Date().toISOString();
        setFlashDue(Object.values(sr).filter(e => e?.nextDue && e.nextDue <= now).length);
      } catch { /* the badge is a nicety */ }
    }
  }, []);

  // Saved as soon as a question is sent, not only once its answer lands: a
  // refresh mid-answer used to lose the question as well, and the chat with
  // it. While the answer streams, the chat is saved once, without the reply
  // being written, rather than again on every chunk.
  useEffect(() => {
    if (messages.some(m => m.role === 'user')) hasUserMessageRef.current = true;
    if (!hasUserMessageRef.current) return;
    if (loading) {
      if (savedTurnRef.current) return;
      savedTurnRef.current = true;
    } else {
      savedTurnRef.current = false;
    }
    const kept = loading && messages[messages.length - 1]?.role === 'assistant' ? messages.slice(0, -1) : messages;
    const entry: ChatHistoryEntry = { id: chatId, title: makeChatTitle(kept), messages: kept, updatedAt: Date.now(), subject };
    setHistoryList(prev => {
      const withoutCurrent = prev.filter(c => c.id !== chatId);
      const updated = [entry, ...withoutCurrent].slice(0, CHAT_HISTORY_MAX);
      saveChatHistoryList(updated);
      return updated;
    });
  }, [messages, loading, chatId, subject]);

  // Keep ?c= naming the open conversation once it has a question in it, and
  // drop it for a fresh chat. ?q= and ?topic= only seed a new chat, so they go
  // once it has started. Replace, not push: switching chats is not a step
  // Back should undo.
  const hasConversation = messages.some(m => m.role === 'user');
  useEffect(() => {
    if (!chatRestored) return;
    const url = new URL(window.location.href);
    if (hasConversation) {
      if (url.searchParams.get(CHAT_PARAM) === chatId && !url.searchParams.has('q') && !url.searchParams.has('topic')) return;
      url.searchParams.delete('q');
      url.searchParams.delete('topic');
      url.searchParams.set(CHAT_PARAM, chatId);
    } else {
      if (!url.searchParams.has(CHAT_PARAM)) return;
      url.searchParams.delete(CHAT_PARAM);
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [chatRestored, hasConversation, chatId]);

  // Remember the thread's scroll position as the reader moves, since by the
  // time a link click unmounts the page the element is already gone.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const save = () => {
      if (!hasUserMessageRef.current) return;
      try { sessionStorage.setItem(CHAT_SCROLL_KEY, JSON.stringify({ id: chatId, top: Math.round(el.scrollTop) })); } catch { /* private mode */ }
    };
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [chatId]);

  const clearPdf = () => { setPdfBase64(null); setPdfName(null); };

  const handlePdfUpload = useCallback((file: File) => {
    if (!file || file.type !== 'application/pdf') { alert('Please upload a valid PDF file.'); return; }
    if (file.size > 20 * 1024 * 1024) { alert('PDF too large. Max 20MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      setPdfBase64(base64);
      setPdfName(file.name);
      inputRef.current?.focus();
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfUpload(file);
  }, [handlePdfUpload]);

  const resetStart = () => {
    setStart(EMPTY_START);
    setFlowKey(k => k + 1);
    setFlowOpen(true);
  };

  const startNewChat = () => {
    setChatId(newId());
    hasUserMessageRef.current = false;
    setMessages([]);
    setInput('');
    newHint();
    clearPdf();
    setBrainstormMode(false);
    setPanel(null);
    setSidebarOpen(false);
    resetStart();
  };

  const openChat = (id: string) => {
    const entry = historyList.find(c => c.id === id);
    if (!entry) return;
    setInput('');
    resumeEntry(entry);
    setPanel(null);
    setSidebarOpen(false);
  };

  const deleteChat = (id: string) => {
    setHistoryList(prev => {
      const updated = prev.filter(c => c.id !== id);
      saveChatHistoryList(updated);
      return updated;
    });
    if (id === chatId) startNewChat();
  };

  const onBooks = () => {
    if (usageLoading) return;
    if (!subscribed) { setShowBookPaywall(true); return; }
    setBookMode(b => !b);
    setSidebarOpen(false);
  };

  const onFlowChange = (next: StartState) => {
    // The mentor path is the PYQ path answered by the mentor, so picking it
    // switches the mode on, and leaving it switches the mode back off.
    if (next.goal === 'mentor' && start.goal !== 'mentor') { setMentorMode(true); setBrainstormMode(false); }
    if (next.goal !== 'mentor' && start.goal === 'mentor') setMentorMode(false);
    setStart(next);
    setInput(compose(next, subject));
  };

  const sendMessage = async (text?: string, opts: { format?: 'mains' } = {}) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    if (q.length > 10000) { alert('Message too long. Max 10000 characters.'); return; }
    if (usageLoading) return;
    if (!access.signedIn) { showLoginModal(); return; }
    if (!canChat) { showChatLimitModal(); return; }

    // A question written by the start flow carries that flow's format, as long
    // as the reader has not rewritten it since.
    const fromFlow = text === undefined && empty && start.goal !== null && q === compose(start, subject).trim();
    const format = opts.format ?? (fromFlow ? formatFor(start) : undefined) ?? (responseStyle === 'mains' ? 'mains' : undefined);
    const mentor = mentorMode && subscribed;
    const brainstorm = brainstormMode && subscribed;

    const userMsg: Message = { role: 'user', content: q };
    const history = [...thread, userMsg];
    // The answer's placeholder goes in with the question, so the owl and
    // "Reading your question" appear on the tap. Added only once the response
    // started, it left the token fetch, auth and quota check as a blank second.
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', isMentor: mentor, format }]);
    setInput('');
    newHint();
    setLoading(true);
    setProgress(NO_PROGRESS);
    const askedAt = Date.now();
    setFlowOpen(false);
    setToolsOpen(false);

    // Refused before anything was spent: put the question back where it was.
    const restore = () => { setMessages(prev => prev.slice(0, -2)); setInput(q); };
    // An error takes the placeholder's place if nothing has been written into
    // it yet, and follows the partial answer if something has.
    const fail = () => setMessages(prev => {
      const last = prev[prev.length - 1];
      const error: Message = { role: 'assistant', content: 'Something went wrong. Please try again.' };
      return last?.role === 'assistant' && !last.content ? [...prev.slice(0, -1), error] : [...prev, error];
    });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-token': (auth.currentUser ? await auth.currentUser.getIdToken() : null) ?? '',
        },
        body: JSON.stringify({
          ...(pdfBase64 ? { pdf_base64: pdfBase64, pdf_name: pdfName } : {}),
          messages: history.map(m => ({ role: m.role, content: m.content })),
          subject,
          lang: langHi ? 'hi' : 'en',
          bookMode,
          bookTitle: bookTitle === 'all' ? undefined : bookTitle,
          mentorMode: mentor,
          brainstormMode: brainstorm,
          responseStyle: mentor || brainstorm ? undefined : (responseStyle === 'mains' ? 'concise' : responseStyle),
          format,
          stages: true,
        }),
      });
      if (response.status === 401) { restore(); showLoginModal(); return; }
      if (response.status === 403) {
        const err = await response.json().catch(() => ({}));
        restore();
        if (err?.error === 'premium_required') setShowBookPaywall(true); else showChatLimitModal();
        return;
      }
      if (!response.ok || !response.body) { fail(); return; }

      // Kept here as well as in state: the finished answer carries the
      // steps with it, to show as "Researched 7s" after the live list goes.
      let prog: Progress = { accepted: true, writing: false };
      let trace: Trace | undefined;
      setProgress(prog);

      const apply = (e: StageEvent) => {
        switch (e.id) {
          case 'search': prog = { ...prog, search: { book: e.book } }; break;
          case 'found':  prog = { ...prog, found: { passages: e.passages, books: e.books } }; break;
          case 'pdf':    prog = { ...prog, pdf: { name: e.name } }; break;
          case 'write':  prog = { ...prog, writing: true }; break;
        }
        setProgress(prog);
      };

      let head = '';
      let started = false;
      let full = '';
      let sources: Source[] = [];
      let next: string | undefined;
      const render = () => {
        let display = full;
        const idx = full.indexOf(SOURCES_MARKER);
        if (idx !== -1) {
          // The list arrives last and may be split across reads; keep the
          // answer text clean and take the list once it parses.
          try { sources = JSON.parse(full.slice(idx + SOURCES_MARKER.length)); } catch { /* not all here yet */ }
          display = full.slice(0, idx);
        }
        // The suggested follow-up comes just before the sources.
        const n = display.indexOf(NEXT_MARKER);
        if (n !== -1) {
          try { next = JSON.parse(display.slice(n + NEXT_MARKER.length)); } catch { /* not all here yet */ }
          display = display.slice(0, n);
        }
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: display, sources, isMentor: mentor, format, next, trace };
          return updated;
        });
      };

      const reader = response.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        if (!started) {
          const r = takeStages(head + chunk);
          r.events.forEach(apply);
          if (r.pending) { head = r.rest; continue; }
          started = true;
          trace = { progress: prog, ms: Date.now() - askedAt };
          head = '';
          full += r.rest;
        } else {
          full += chunk;
        }
        render();
      }
      if (!started) full += head;
      render();
      if (!subscribed) incrementChat();
    } catch {
      fail();
    } finally {
      setLoading(false);
      setProgress(NO_PROGRESS);
    }
  };

  const getPrecedingQuestion = (idx: number): string | undefined => {
    for (let i = idx - 1; i >= 0; i--) if (thread[i].role === 'user') return thread[i].content;
    return undefined;
  };

  const openSources = (owner: number, sources: Source[], focus?: number[]) =>
    setPanel({ owner, content: { kind: 'sources', sources, focus } });

  const showPyqs = (owner: number, r: Related) =>
    setPanel({ owner, content: { kind: 'pyqs', title: r.topic.title, pyqs: r.pyqs } });

  const answerPyq = (q: RelatedPyq) => {
    setPanel(null);
    sendMessage(`Answer this PYQ (${q.year}, ${q.marks} marks): ${q.question}`, { format: 'mains' });
  };

  // How much of this optional's syllabus is ticked off, for the sidebar card.
  const syllabusDone = tracker.countCompleted(notesForSubject(subject).map(n => topicKey(subject, n.slug)));
  const remaining = Math.max(0, access.limit - access.used);
  const who = SCHOLARS[subject];
  const askedSoFar = thread.filter(m => m.role === 'user').map(m => m.content);
  const lastIdx = thread.length - 1;

  const styleLabel: Record<Style, string> = {
    concise: langHi ? 'संक्षिप्त नोट्स' : 'Quick notes',
    elaborative: langHi ? 'विस्तृत' : 'Detailed',
    mains: langHi ? 'मुख्य परीक्षा उत्तर' : 'Mains answer',
  };
  const styleDesc: Record<Style, string> = {
    concise: langHi ? 'बिंदुओं में, जल्दी' : 'Points, quickly',
    elaborative: langHi ? 'पूरा गद्य, हर पहलू' : 'Full prose, every angle',
    mains: langHi ? 'भूमिका, शीर्षकों में बिंदु, निष्कर्ष' : 'Intro, headed points, conclusion',
  };

  // With a PDF attached the input asks about the PDF, as a plain placeholder.
  // Otherwise it suggests a question, typed out with a cursor in an overlay
  // (a placeholder attribute cannot draw one), and Esc takes it up.
  const showGhost = !pdfName && !input && !loading && suggestion !== '';
  const canTakeHint = showGhost;
  const placeholder = pdfName
    ? (langHi ? 'PDF के बारे में पूछें, आदर्श उत्तर माँगें…' : 'Ask about the PDF, request model answers…')
    : showGhost ? '' : (langHi ? 'आगे का प्रश्न पूछें…' : 'Ask a follow-up…');
  const takeHint = () => { setInput(suggestion); inputRef.current?.focus(); };

  const premiumMark = !subscribed && <span className="ch-premium">✦</span>;

  const tools = toolsOpen && (
    <>
      <div className="ch-menu-scrim" onClick={() => setToolsOpen(false)} />
      <div className="ch-menu" role="menu">
        <div className="ch-menu-label">{langHi ? 'उत्तर की शैली' : 'Answer style'}</div>
        {(['concise', 'elaborative', 'mains'] as Style[]).map(s => (
          <button
            key={s}
            role="menuitemradio"
            aria-checked={responseStyle === s}
            className={`ch-menu-item${responseStyle === s ? ' on' : ''}`}
            disabled={mentorMode || brainstormMode}
            onClick={() => { setResponseStyle(s); setToolsOpen(false); }}
          >
            <span className="ch-menu-radio" />
            <span className="ch-menu-text"><strong>{styleLabel[s]}</strong><span>{styleDesc[s]}</span></span>
          </button>
        ))}
        {(mentorMode || brainstormMode) && (
          <div className="ch-menu-note">{langHi ? 'मेंटर और ब्रेनस्टॉर्म अपना ढाँचा ख़ुद चुनते हैं।' : 'Mentor and Brainstorm use their own format.'}</div>
        )}

        <div className="ch-menu-label">{langHi ? 'मोड' : 'Modes'}</div>
        <button
          role="menuitemcheckbox"
          aria-checked={mentorMode && subscribed}
          className={`ch-menu-item${mentorMode && subscribed ? ' on' : ''}`}
          onClick={() => {
            if (usageLoading) return;
            if (!subscribed) { setToolsOpen(false); setShowBookPaywall(true); return; }
            setMentorMode(m => !m); setBrainstormMode(false);
          }}
        >
          <span className="ch-menu-check" />
          <span className="ch-menu-text"><strong>{langHi ? 'मेंटर' : 'Mentor'}{premiumMark}</strong><span>{langHi ? 'परीक्षक की तरह जाँच और सुधार' : 'Examiner-style diagnosis and fixes'}</span></span>
        </button>
        <button
          role="menuitemcheckbox"
          aria-checked={brainstormMode && subscribed}
          className={`ch-menu-item${brainstormMode && subscribed ? ' on' : ''}`}
          onClick={() => {
            if (usageLoading) return;
            if (!subscribed) { setToolsOpen(false); setShowBookPaywall(true); return; }
            setBrainstormMode(b => !b); setMentorMode(false);
          }}
        >
          <span className="ch-menu-check" />
          <span className="ch-menu-text"><strong>{langHi ? 'ब्रेनस्टॉर्म' : 'Brainstorm'}{premiumMark}</strong><span>{langHi ? 'योजना के लिए तर्क, कोण और मत' : `Angles, arguments and ${who.en} to plan with`}</span></span>
        </button>

        <div className="ch-menu-label">{langHi ? 'स्रोत' : 'Sources'}</div>
        <button
          role="menuitemcheckbox"
          aria-checked={bookMode && subscribed}
          className={`ch-menu-item${bookMode && subscribed ? ' on' : ''}`}
          onClick={() => { setToolsOpen(false); onBooks(); }}
        >
          <span className="ch-menu-check" />
          <span className="ch-menu-text"><strong>{langHi ? 'पुस्तकों से चैट' : 'Chat with books'}{premiumMark}</strong><span>{langHi ? 'मानक पुस्तकों पर आधारित उत्तर' : 'Answers grounded in the standard books'}</span></span>
        </button>
        <button
          role="menuitem"
          className={`ch-menu-item${pdfName ? ' on' : ''}`}
          onClick={() => { setToolsOpen(false); if (!subscribed) { setShowBookPaywall(true); return; } fileInputRef.current?.click(); }}
        >
          <span className="ch-menu-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5" /></svg>
          </span>
          <span className="ch-menu-text"><strong>{langHi ? 'PDF अपलोड करें' : 'Upload a PDF'}{premiumMark}</strong><span>{langHi ? 'या PDF को यहाँ खींचकर छोड़ें' : 'Or drop one anywhere on the page'}</span></span>
        </button>
      </div>
    </>
  );

  const tags: React.ReactNode[] = [];
  if (bookMode && subscribed) {
    tags.push(
      <span key="books" className="ch-tag">
        📚
        <select value={bookTitle} onChange={e => setBookTitle(e.target.value)} aria-label={langHi ? 'पुस्तक चुनें' : 'Choose a book'}>
          <option value="all">{langHi ? 'सभी पुस्तकें' : 'All books'}</option>
          {(SUBJECT_BOOKS[subject] ?? []).map(group => (
            <Fragment key={group.group}>
              <option disabled>{`── ${group.group} ──`}</option>
              {group.books.map(b => (
                <option key={b.value} value={b.value} disabled={b.soon}>{b.soon ? `${b.label} (coming soon)` : b.label}</option>
              ))}
            </Fragment>
          ))}
        </select>
        <button onClick={() => setBookMode(false)} aria-label={langHi ? 'हटाएँ' : 'Remove'}>✕</button>
      </span>,
    );
  }
  if (mentorMode && subscribed) tags.push(<span key="mentor" className="ch-tag">🎓 {langHi ? 'मेंटर' : 'Mentor'}<button onClick={() => setMentorMode(false)} aria-label="Remove">✕</button></span>);
  if (brainstormMode && subscribed) tags.push(<span key="brain" className="ch-tag">💡 {langHi ? 'ब्रेनस्टॉर्म' : 'Brainstorm'}<button onClick={() => setBrainstormMode(false)} aria-label="Remove">✕</button></span>);
  if (responseStyle !== 'concise' && !mentorMode && !brainstormMode) tags.push(<span key="style" className="ch-tag">{styleLabel[responseStyle]}<button onClick={() => setResponseStyle('concise')} aria-label="Remove">✕</button></span>);
  if (pdfName) tags.push(<span key="pdf" className="ch-tag ch-tag-pdf">📄 <span className="ch-tag-name">{pdfName}</span><button onClick={clearPdf} aria-label="Remove">✕</button></span>);

  const composer = (
    <div className="ch-composer">
      {tags.length > 0 && <div className="ch-tags">{tags}</div>}
      <div className={`ch-input${input.trim() ? ' lit' : ''}`}>
        <span className="ch-input-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = ''; }}
        />
        <div className="ch-field">
        {showGhost && (
          <span id="ch-hint-desc" className="ch-sr">
            {langHi ? `सुझाव: ${suggestion}। लेने के लिए Esc दबाएँ।` : `Suggestion: ${suggestion}. Press Escape to use it.`}
          </span>
        )}
        {showGhost && (
          <div className="ch-ghost" aria-hidden="true">
            <span className="ch-ghost-text">{typedHint}</span>
            <span className={`ch-caret${hintTyping ? ' typing' : ''}`} />
          </div>
        )}
        <textarea
          ref={inputRef}
          className={`ch-textarea${showGhost ? ' ghosted' : ''}`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); return; }
            if (e.key === 'Escape') {
              if (toolsOpen) { e.stopPropagation(); setToolsOpen(false); return; }
              // Kept from the side panel's Escape handler, which would
              // otherwise close the panel on the same key press.
              if (canTakeHint) { e.preventDefault(); e.stopPropagation(); takeHint(); }
            }
          }}
          placeholder={placeholder}
          aria-label={langHi ? 'अपना प्रश्न लिखें' : 'Your question'}
          aria-describedby={showGhost ? 'ch-hint-desc' : undefined}
          rows={1}
        />
        </div>
        {canTakeHint && (
          <button className="ch-esc" onClick={takeHint} title={langHi ? 'यह सुझाव लें (Esc)' : 'Use this suggestion (Esc)'} tabIndex={-1}>
            esc
          </button>
        )}
        <div className="ch-tools">
          <button
            className={`ch-icon-btn${toolsOpen ? ' on' : ''}`}
            onClick={() => setToolsOpen(o => !o)}
            aria-label={langHi ? 'शैली और उपकरण' : 'Answer style and tools'}
            aria-expanded={toolsOpen}
            aria-haspopup="menu"
            title={langHi ? 'शैली और उपकरण' : 'Answer style and tools'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
          </button>
          {tools}
        </div>
        <button
          className={`ch-send${input.trim() && !loading ? ' ready' : ''}`}
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          aria-label={langHi ? 'भेजें' : 'Send'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
        </button>
      </div>
      <div className="ch-usage" aria-live="polite">
        {usageLoading ? ' '
          : subscribed ? (langHi ? '✦ असीमित संदेश' : '✦ Unlimited messages')
          : !access.signedIn ? (langHi ? 'साइन इन करें और 3 निःशुल्क संदेश पाएँ' : 'Sign in for 3 free messages')
          : remaining === 0 ? <span className="ch-usage-out">{langHi ? 'निःशुल्क संदेश समाप्त · असीमित के लिए सदस्यता लें' : 'Free messages used · subscribe for unlimited'}</span>
          : <>{langHi ? 'निःशुल्क संदेश बाकी:' : 'Free messages remaining:'} <strong>{remaining}</strong></>}
      </div>
    </div>
  );

  const panelOwnerSources = (i: number) => panel?.owner === i && panel.content.kind === 'sources';

  // Nothing to show until sign-in has settled, and nothing at all while a
  // signed-out visitor is on the way to the login page.
  if (!user) return <OwlLoader size="page" label="Loading the chat" />;

  return (
    <>
      <style>{CHAT_CSS}</style>
      <div
        className={`ch-wrap${panel ? ' has-panel' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
        onDrop={handleDrop}
      >
        {modal && (
          <AccessModal
            kind={modal}
            langHi={langHi}
            loginHref={`/login?next=${encodeURIComponent(`/chat?subject=${subject}${input.trim() ? `&q=${encodeURIComponent(input.trim())}` : ''}`)}`}
            onClose={() => setModal(null)}
          />
        )}

        {dragOver && (
          <div className="ch-drop">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            {langHi ? 'PDF यहाँ छोड़ें' : 'Drop PDF here'}
          </div>
        )}

        {sidebarOpen && <div className="ch-scrim" onClick={() => setSidebarOpen(false)} />}
        <aside className={`ch-side${sidebarOpen ? ' open' : ''}`} aria-label={langHi ? 'चैट' : 'Chats'}>
          <ChatSidebar
            langHi={langHi}
            subject={subject}
            chats={historyList.map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, subject: c.subject ?? subject }))}
            activeId={chatId}
            onOpen={openChat}
            onDelete={deleteChat}
            onNewChat={startNewChat}
            bookMode={bookMode && subscribed}
            onBooks={onBooks}
            syllabusDone={syllabusDone}
            syllabusTotal={notesForSubject(subject).length}
            flashDue={flashDue}
          />
        </aside>

        <main className="ch-main">
          <div className="ch-mobilebar">
            <button className="ch-icon-btn" onClick={() => setSidebarOpen(true)} aria-label={langHi ? 'चैट खोलें' : 'Open chats'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
            </button>
            <span className="ch-mobilebar-title">{langHi ? `AI ${SUBJECT_DISPLAY[subject]} सहायक` : `AI ${SUBJECT_DISPLAY[subject]} Assistant`}</span>
            <button className="ch-icon-btn" onClick={startNewChat} aria-label={langHi ? 'नई चैट' : 'New chat'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>

          <div className="ch-scroll" ref={scrollRef}>
            {empty ? (
              <div className="ch-start">
                <Mascot pose="peek" width={160} className="ch-start-owl" preload />
                <h1>{langHi ? 'आज हम क्या पढ़ रहे हैं?' : 'What are we studying today?'}</h1>
                <p>
                  {topicNote
                    ? (langHi
                        ? `आप ${topicNote.title} पढ़ रहे हैं। इस पर कुछ भी पूछें, या नीचे टैप करें और प्रश्न मैं लिख दूँगा।`
                        : `You're on ${topicNote.title}. Ask anything about it, or tap below and I'll write the question for you.`)
                    : (langHi
                        ? `पाठ्यक्रम से कुछ भी पूछें: कोई अवधारणा, तुलना, ${who.hi} के मत, पिछले वर्ष का प्रश्न। या नीचे टैप करें और प्रश्न मैं लिख दूँगा।`
                        : `Ask anything from the syllabus: a concept, a comparison, what ${who.en} argue, a past question, or tap below and I’ll write it for you.`)}
                </p>
                {flowOpen ? (
                  <StartFlow
                    key={`${subject}-${flowKey}`}
                    langHi={langHi}
                    subject={subject}
                    state={start}
                    onChange={onFlowChange}
                    subscribed={subscribed}
                    onPremium={() => setShowBookPaywall(true)}
                    onDone={() => { setFlowOpen(false); inputRef.current?.focus(); }}
                  />
                ) : (
                  <button className="ch-link-btn ch-restart" onClick={() => { resetStart(); setInput(''); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                    {langHi ? 'टैप करके नया प्रश्न बनाएँ' : 'Build another question with taps'}
                  </button>
                )}
                {composer}
              </div>
            ) : (
              <div className="ch-thread">
                {thread.map((msg, i) => {
                  if (msg.role === 'user') {
                    return <div key={i} className="ch-user"><span>{msg.content}</span></div>;
                  }
                  const isLast = i === lastIdx;
                  const streaming = loading && isLast;
                  if (streaming && msg.content === '') {
                    return <div key={i} ref={lastAiRef}><ThinkingSteps progress={progress} langHi={langHi} /></div>;
                  }
                  const question = getPrecedingQuestion(i);
                  const slug = !streaming && isLast && question ? detectTopic(question, subject)?.slug ?? null : null;
                  const sources = msg.sources ?? [];
                  return (
                    <div key={i} className="ch-ai" ref={isLast ? lastAiRef : null}>
                      {msg.trace && <ResearchTrace trace={msg.trace} langHi={langHi} />}
                      {msg.isMentor ? (
                        <MentorBubble content={msg.content} isStreaming={streaming} />
                      ) : streaming ? (
                        <div className="ch-answer-text" dangerouslySetInnerHTML={{ __html: sanitize(marked.parse(msg.content, { breaks: true }) as string) }} />
                      ) : (
                        <div
                          className="ch-answer-text"
                          onClick={(e) => {
                            const target = (e.target as HTMLElement).closest('[data-citation]') as HTMLElement | null;
                            if (target && sources.length) {
                              const focus = target.getAttribute('data-citation')!.split(',').map(Number);
                              openSources(i, sources, focus);
                            }
                          }}
                          dangerouslySetInnerHTML={{ __html: sanitize(formatMessage(msg.content, sources)) }}
                        />
                      )}
                      {!streaming && (
                        <div className="ch-ai-actions">
                          <DownloadPDFButton content={msg.content} question={question} langHi={langHi} />
                        </div>
                      )}
                      {!streaming && sources.length > 0 && (
                        <SourcesCard sources={sources} active={panelOwnerSources(i)} langHi={langHi} onOpen={() => openSources(i, sources)} />
                      )}
                      {slug && (
                        <WorthKnowing
                          key={`worth-${slug}`}
                          slug={slug}
                          langHi={langHi}
                          done={!SYLLABUS_TRACKER_LIVE || !tracker.ready || tracker.isCompleted(topicKey(subject, slug))}
                          onMarkDone={() => tracker.toggle(topicKey(subject, slug))}
                          onShowPyqs={r => showPyqs(i, r)}
                        />
                      )}
                      {!streaming && isLast && (
                        <FollowUps
                          key={`follow-${slug ?? 'none'}`}
                          slug={slug}
                          asked={askedSoFar}
                          wasMains={msg.format === 'mains'}
                          langHi={langHi}
                          subject={subject}
                          onSend={(text, format) => sendMessage(text, { format })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!empty && <div className="ch-dock">{composer}</div>}
        </main>

        {panel && (
          <>
            <div className="ch-panel-scrim" onClick={() => setPanel(null)} />
            <aside className="ch-panel" aria-label={langHi ? 'विवरण' : 'Details'}>
              <SidePanel
                content={panel.content}
                subject={subject}
                langHi={langHi}
                onClose={() => setPanel(null)}
                onAnswer={answerPyq}
                clean={cleanChunk}
                onOpenPyq={(top) => {
                  try { sessionStorage.setItem(CHAT_PANEL_KEY, JSON.stringify({ id: chatId, panel, top: Math.round(top) })); } catch { /* private mode */ }
                }}
                takeRestoreTop={takePanelTop}
              />
            </aside>
          </>
        )}

        {showBookPaywall && !usageLoading && (
          <div className="ch-modal-scrim" onClick={() => setShowBookPaywall(false)}>
            <div className="ch-modal" onClick={e => e.stopPropagation()}>
              <Mascot pose="peek" width={96} />
              <div className="ch-modal-title">{langHi ? 'प्रीमियम सुविधा' : 'A premium feature'}</div>
              <p>
                {langHi
                  ? 'पुस्तकों से चैट, मेंटर मोड और PDF, सब मानक पुस्तकों और परीक्षक की नज़र पर आधारित हैं।'
                  : `Chat with books, Mentor mode and PDFs draw on the standard ${SUBJECT_DISPLAY[subject]} books and an examiner’s eye.`}
              </p>
              <Link className="ch-btn ch-btn-solid ch-btn-wide" href="/pricing">
                {langHi ? 'प्रीमियम लें' : 'Unlock Premium'}
              </Link>
              <button className="ch-link-btn" onClick={() => setShowBookPaywall(false)}>{langHi ? 'बाद में' : 'Maybe later'}</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<OwlLoader size="page" label="Loading the chat" />}>
      <ChatContent />
    </Suspense>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
//
// Every colour is a theme token, so the page follows the site's dark and light
// setting: the neutral ground, the accent for what is primary, selected or a
// link, and gold only where something is premium.
//
// The page and this stylesheet come from historyoptional.xyz. That site's
// radius scale is tighter than this one's and its secondary text is grey
// where this site's is full contrast, so .ch-wrap sets history-optional's
// values for its own subtree; the rest of the site is untouched.

const CHAT_CSS = `
/* The chat is a full-screen app. With the footer below it the window could
   scroll, which slid the sidebar under the fixed navbar, so the footer is
   hidden here. This stylesheet only exists on /chat. */
.ds-footer { display: none !important; }
/* The layout's wrapper keeps a 100vh floor for ordinary pages; under the chat
   it added scroll on phones, where 100vh is taller than the visible window. */
div:has(> #main-layout) { min-height: 0 !important; }

.ch-wrap {
  /* Sans-serif, like the rest of the site: everything here that asks for
     the body font gets Inter. */
  --font-body: var(--font-ui);
  --ch-ground: var(--bg);
  --ch-card: var(--bg-raised);
  --ch-soft: color-mix(in srgb, var(--text) 3%, var(--bg-raised));
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 14px;
  --radius-pill: 20px;
  --text2: #c4c4c4;
  --text3: #858585;
  --ch-tint-1: #7ba64a;
  --ch-tint-2: #9782c9;
  --ch-tint-3: #48a8a5;
  --ch-tint-4: #c686ae;
  display: flex;
  gap: var(--space-4);
  /* <main> is padded exactly the navbar's 60px. */
  height: calc(100dvh - 60px);
  padding: 0 var(--space-4) var(--space-4);
  background: var(--ch-ground);
  font-family: var(--font-body);
  color: var(--text);
  position: relative;
  overflow: hidden;
}
[data-theme="light"] .ch-wrap {
  --text2: #3d3d3d;
  --text3: #6b6b6b;
  --ch-tint-1: #516d31;
  --ch-tint-2: #7457b7;
  --ch-tint-3: #2f6e6c;
  --ch-tint-4: #99487b;
}
.ch-wrap button, .ch-wrap input, .ch-wrap textarea, .ch-wrap select { font-family: var(--font-body); }

/* ── Buttons ── */
.ch-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  min-height: 40px; padding: 0 var(--space-4);
  border-radius: var(--radius-md); border: 1px solid transparent;
  font-size: 0.86rem; font-weight: 600; cursor: pointer; text-decoration: none;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  white-space: nowrap;
}
.ch-btn-solid { background: var(--accent); color: var(--accent-on); }
.ch-btn-solid:hover { background: color-mix(in srgb, var(--accent) 88%, var(--text)); }
.ch-btn-line { background: var(--ch-card); color: var(--text); border-color: var(--border2); }
.ch-btn-line:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); color: var(--accent-text); }
.ch-btn-line.on { border-color: var(--accent); color: var(--accent-text); background: var(--accent-dim); }
.ch-btn-sm { min-height: 32px; padding: 0 var(--space-3); font-size: 0.8rem; font-weight: 500; }
.ch-btn-wide { width: 100%; }
.ch-btn:disabled { opacity: 0.5; cursor: wait; }
.ch-link-btn {
  background: none; border: none; padding: var(--space-1) 0; cursor: pointer;
  color: var(--accent-text); font-size: 0.84rem; display: inline-flex; align-items: center; gap: var(--space-2);
}
.ch-link-btn:hover { color: var(--accent-text); }
.ch-icon-btn {
  width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm); border: none; background: none; color: var(--text3); cursor: pointer;
}
.ch-icon-btn:hover { color: var(--text); background: var(--ch-soft); }
.ch-icon-btn.on { color: var(--accent-text); background: var(--accent-dim); }
.ch-premium { color: var(--premium-text); margin-left: var(--space-1); font-size: 0.8em; }

/* ── Sidebar ── */
.ch-side { width: 280px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0; }
.ch-side-inner { display: flex; flex-direction: column; gap: var(--space-3); height: 100%; min-height: 0; padding-top: var(--space-4); overflow-y: auto; scrollbar-width: thin; }
.ch-side-search {
  display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0;
  height: 44px; padding: 0 var(--space-3);
  background: var(--ch-card); border: 1px solid var(--border2); border-radius: var(--radius-md);
  color: var(--text3);
}
.ch-side-search input { flex: 1; min-width: 0; border: none; background: none; outline: none; color: var(--text); font-size: 0.88rem; }
.ch-side-search input::placeholder { color: var(--text3); }
.ch-side-search:focus-within { border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
.ch-side-actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); flex-shrink: 0; }
/* Everything but the chat list keeps its full size; when the column runs
   short, the list scrolls instead of the search box being squashed. */
.ch-side-rule, .ch-side-label, .ch-side-nav, .ch-side-card { flex-shrink: 0; }
.ch-side-actions .ch-btn { padding: 0 var(--space-2); font-size: 0.82rem; }
.ch-side-rule { border-top: 1px dashed var(--border2); }
.ch-side-chats { flex: 1 1 auto; min-height: 140px; overflow-y: auto; margin: 0 calc(-1 * var(--space-2)); padding: 0 var(--space-2); }
.ch-side-label { font-size: 0.8rem; color: var(--text3); margin: var(--space-1) 0 var(--space-2); }
.ch-side-empty { font-size: 0.82rem; color: var(--text3); line-height: 1.6; padding: var(--space-2) 0; }
.ch-side-group { margin-bottom: var(--space-1); }
.ch-side-group-head {
  width: 100%; display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2); border: none; background: none; border-radius: var(--radius-sm);
  color: var(--text); cursor: pointer; text-align: left;
}
.ch-side-group-head:hover { background: var(--ch-soft); }
.ch-side-group-icon { display: inline-flex; }
.ch-side-group-title { flex: 1; min-width: 0; font-size: 0.86rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-side-group-count { font-size: 0.72rem; color: var(--text3); }
.ch-side-chev { display: inline-flex; color: var(--text3); transition: transform 0.15s; }
.ch-side-chev.open { transform: rotate(180deg); }
.ch-side-group-items { margin: var(--space-1) 0 var(--space-2) var(--space-4); padding-left: var(--space-2); border-left: 1px dashed var(--border2); }
.ch-side-chat {
  position: relative; padding: var(--space-2) var(--space-6) var(--space-2) var(--space-3);
  border-radius: var(--radius-md); border: 1px solid transparent; cursor: pointer;
}
.ch-side-chat:hover { background: var(--ch-soft); }
.ch-side-chat.active { background: var(--accent-dim); border-color: color-mix(in srgb, var(--accent) 28%, transparent); }
.ch-side-chat-title { font-size: 0.82rem; line-height: 1.45; color: var(--text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ch-side-chat-date { font-size: 0.72rem; color: var(--text3); margin-top: var(--space-1); }
.ch-side-chat-del {
  position: absolute; top: var(--space-2); right: var(--space-2);
  width: 20px; height: 20px; display: none; align-items: center; justify-content: center;
  border: none; background: none; color: var(--text3); cursor: pointer; border-radius: var(--radius-xs);
}
.ch-side-chat:hover .ch-side-chat-del, .ch-side-chat:focus-within .ch-side-chat-del { display: inline-flex; }
.ch-side-chat-del:hover { color: var(--danger-text); background: var(--ch-soft); }
.ch-side-nav { display: flex; flex-direction: column; }
.ch-side-nav a {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2); border-radius: var(--radius-sm);
  color: var(--text); text-decoration: none; font-size: 0.9rem;
}
.ch-side-nav a:hover { background: var(--ch-soft); }
.ch-side-nav a svg { color: var(--text2); }
.ch-side-badge {
  margin-left: auto; min-width: 22px; height: 22px; padding: 0 var(--space-1);
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: var(--radius-sm); background: var(--accent-dim);
  font-size: 0.74rem; color: var(--accent-text);
}
.ch-side-card {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-2xl);
  padding: var(--space-4);
}
.ch-ring { position: relative; width: 64px; height: 64px; margin-bottom: var(--space-3); }
.ch-ring span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 600; }
.ch-side-card-title { font-size: 0.92rem; font-weight: 700; margin-bottom: var(--space-1); }
.ch-side-card-text { font-size: 0.8rem; line-height: 1.55; color: var(--text2); }
.ch-side-card-link { display: inline-block; margin-top: var(--space-3); font-size: 0.84rem; font-weight: 600; color: var(--accent-text); text-decoration: none; }
.ch-side-card-link:hover { text-decoration: underline; }

/* ── Main panel ── */
.ch-main {
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  background: var(--ch-card); border: 1px solid var(--border); border-radius: var(--radius-xl);
  margin-top: var(--space-4); overflow: hidden; position: relative;
}
.ch-mobilebar { display: none; }
.ch-scroll { flex: 1; min-height: 0; overflow-y: auto; position: relative; overscroll-behavior: contain; }
.ch-side-inner, .ch-panel-body, .ch-pyq-list, .ch-menu { overscroll-behavior: contain; }

/* ── Start screen ── */
.ch-start {
  height: 100%; max-width: 760px; margin: 0 auto;
  display: flex; flex-direction: column; align-items: center;
  padding: clamp(12px, 3vh, 40px) var(--space-6) 0;
  text-align: center;
}
/* Centred with auto margins rather than justify-content, because auto margins
   fall back to zero when the content is taller than the panel; centring would
   push the top of it out of reach. */
.ch-start > :first-child { margin-top: auto; }
.ch-start > :last-child { margin-bottom: auto; }
/* Sized off the window height, so the whole start screen fits a laptop
   screen on first load instead of opening half-scrolled. */
.ch-start-owl { width: auto; height: clamp(64px, 13vh, 150px); margin-bottom: clamp(4px, 1vh, 16px); flex-shrink: 0; }
.ch-start h1 { font-family: var(--font-body); font-size: clamp(1.45rem, 3.8vh, 2rem); font-weight: 700; letter-spacing: -0.01em; line-height: 1.25; margin: 0 0 clamp(4px, 1vh, 12px); color: var(--text); }
.ch-start > p { font-size: clamp(0.88rem, 2.1vh, 1.02rem); line-height: 1.65; color: var(--text2); max-width: 620px; margin: 0 0 clamp(8px, 2.5vh, 32px); }
.ch-restart { margin-bottom: var(--space-4); }
/* When the screen runs short the card is what gives way: its list scrolls
   inside it, down to one visible row, and Previous, Next and the input stay
   on screen. */
.ch-flow .ch-chips, .ch-flow .ch-pyq-list { flex: 0 1 auto; min-height: 42px; overflow-y: auto; overscroll-behavior: contain; }
/* The topic list and the PYQs are the long ones; they keep at least three
   rows of chips, or a question and a half, in view. */
.ch-flow .ch-chips.long, .ch-flow .ch-pyq-list { min-height: 120px; }
.ch-flow-head, .ch-tabs, .ch-flow-nav { flex-shrink: 0; }
.ch-start > h1, .ch-start > p, .ch-start > .ch-composer, .ch-restart { flex-shrink: 0; }
/* The owl and the introduction hold still while the flow is used; only the
   card's list gives way on a short window. */
.ch-start > p { flex-shrink: 0; }
/* The flow can grow taller than the panel (a topic list, a page of PYQs);
   the input stays pinned in reach while it scrolls. */
.ch-start > .ch-composer {
  position: sticky; bottom: 0; z-index: 2;
  padding: var(--space-2) 0 clamp(8px, 2vh, 32px);
  background: linear-gradient(to top, var(--ch-card) 85%, transparent);
}

/* ── Guided flow ── */
.ch-flow {
  width: 100%; text-align: left;
  display: flex; flex-direction: column; min-height: 0;
  background: var(--ch-soft); border: 1px solid var(--border); border-radius: var(--radius-xl);
  padding: clamp(10px, 2vh, 20px) var(--space-5);
  margin-bottom: var(--space-1);
}
.ch-flow-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: clamp(6px, 1.4vh, 16px); }
.ch-flow-q { font-size: 0.94rem; color: var(--text); }
.ch-flow-count { font-size: 0.76rem; color: var(--text3); }
.ch-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.ch-chip {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-1) var(--space-3); min-height: 34px;
  background: var(--ch-card); color: var(--text);
  border: 1px solid var(--border2); border-radius: var(--radius-sm);
  font-size: 0.86rem; cursor: pointer; text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.ch-chip:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.ch-chip.on { background: var(--accent-dim); color: var(--accent-text); border-color: var(--accent); }
.ch-chip-box {
  width: 18px; height: 18px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--border3); border-radius: var(--radius-xs); color: var(--accent-on);
}
.ch-chip.on .ch-chip-box { background: var(--accent); border-color: var(--accent); }
.ch-chip-premium { color: var(--premium-text); font-size: 0.8em; }
.ch-tabs { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-bottom: var(--space-3); border-bottom: 1px solid var(--border); }
.ch-tab {
  position: relative; padding: var(--space-2) var(--space-3); margin-bottom: -1px;
  border: none; border-bottom: 2px solid transparent; background: none;
  color: var(--text3); font-size: 0.84rem; cursor: pointer;
}
.ch-tab:hover { color: var(--text); }
.ch-tab.on { color: var(--accent-text); font-weight: 600; border-bottom-color: var(--accent); }
.ch-tab-dot { display: inline-block; width: 6px; height: 6px; border-radius: var(--radius-circle); background: var(--accent); margin-left: var(--space-1); vertical-align: middle; }
.ch-flow-nav { display: flex; align-items: center; justify-content: space-between; margin-top: clamp(6px, 1.4vh, 16px); }
.ch-prev { background: none; border: none; display: inline-flex; align-items: center; gap: var(--space-2); color: var(--text2); font-size: 0.9rem; cursor: pointer; padding: var(--space-2); }
.ch-prev:hover { color: var(--accent-text); }
.ch-next {
  display: inline-flex; align-items: center; gap: var(--space-2);
  min-height: 38px; padding: 0 var(--space-4);
  background: var(--ch-card); color: var(--text);
  border: 1px solid var(--border2); border-radius: var(--radius-md);
  font-size: 0.9rem; font-weight: 600; cursor: pointer;
}
.ch-next:not(:disabled) { color: var(--accent-text); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.ch-next:hover:not(:disabled) { background: var(--accent-dim); border-color: var(--accent); }
.ch-next:disabled { opacity: 0.45; cursor: not-allowed; }
.ch-flow-empty { font-size: 0.88rem; color: var(--text2); line-height: 1.6; }
.ch-pyq-list { display: flex; flex-direction: column; gap: var(--space-2); overflow-y: auto; padding-right: var(--space-1); }
.ch-pyq {
  display: flex; flex-direction: column; gap: var(--space-1); text-align: left;
  padding: var(--space-3); background: var(--ch-card); color: var(--text);
  border: 1px solid var(--border2); border-radius: var(--radius-md); cursor: pointer;
}
.ch-pyq:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.ch-pyq.on { border-color: var(--accent); background: var(--accent-dim); box-shadow: inset 0 0 0 1px var(--accent); }
.ch-pyq-meta { font-size: 0.74rem; color: var(--text3); }
.ch-pyq-text { font-size: 0.86rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
@media (max-height: 800px) {
  .ch-pyq { padding: var(--space-2) var(--space-3); gap: 2px; }
  .ch-pyq-text { -webkit-line-clamp: 2; }
}
.ch-pyq-skel { height: 64px; border-radius: var(--radius-md); background: var(--ch-card); border: 1px solid var(--border); animation: chPulse 1.2s ease-in-out infinite; }
@keyframes chPulse { 50% { opacity: 0.55; } }

/* ── Composer ── */
.ch-composer { width: 100%; text-align: left; }
.ch-tags { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-2); }
.ch-tag {
  display: inline-flex; align-items: center; gap: var(--space-2); max-width: 100%;
  padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
  background: var(--accent-dim); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: var(--radius-pill);
  font-size: 0.8rem; color: var(--accent-text);
}
.ch-tag select { border: none; background: none; color: var(--accent-text); font-size: 0.8rem; max-width: 220px; cursor: pointer; outline: none; }
.ch-tag button { border: none; background: none; color: var(--text3); cursor: pointer; font-size: 0.72rem; padding: 0 var(--space-1); }
.ch-tag button:hover { color: var(--text); }
.ch-tag-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.ch-input {
  display: flex; align-items: flex-end; gap: var(--space-2);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  background: var(--ch-card); border: 2px solid var(--border); border-radius: var(--radius-xl);
  box-shadow: var(--elev-2);
  transition: border-color 0.2s;
}
.ch-input:focus-within, .ch-input.lit {
  border-color: color-mix(in srgb, var(--accent) 70%, transparent);
  box-shadow: 0 0 0 4px var(--accent-glow), var(--elev-2);
}
.ch-input-icon { color: var(--text3); display: inline-flex; padding-bottom: var(--space-2); }
.ch-textarea {
  flex: 1; min-width: 0; border: none; outline: none; resize: none; background: none;
  color: var(--text); font-size: 1rem; line-height: 1.55;
  padding: var(--space-1) 0; min-height: 36px; max-height: 200px;
}
.ch-textarea::placeholder { color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ch-field { position: relative; flex: 1; min-width: 0; display: flex; }
.ch-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.ch-field .ch-textarea { width: 100%; }
/* The suggestion overlay sits exactly where typed text would, so the cursor
   drawn after it is where the reader's own text will begin. The real caret is
   hidden while it shows, or there would be two. */
.ch-ghost {
  position: absolute; inset: 0; pointer-events: none;
  padding: var(--space-1) 0; font-size: 1rem; line-height: 1.55; color: var(--text3);
  display: flex; align-items: flex-start; white-space: nowrap; overflow: hidden;
}
.ch-ghost-text { overflow: hidden; text-overflow: ellipsis; }
.ch-caret {
  flex-shrink: 0; width: 2px; height: 1.2em; margin: 0.18em 0 0 2px;
  background: var(--accent); border-radius: 1px;
  animation: chCaret 1.05s steps(1) infinite;
}
.ch-caret.typing { animation: none; }
/* The drawn cursor is there to draw the eye to an idle box. Once the reader
   is in the box it has done its job and goes, and the box's own cursor takes
   over at the start of the line, where their typing will begin. */
.ch-field:focus-within .ch-caret { display: none; }
@keyframes chCaret { 50% { opacity: 0; } }
.ch-textarea.ghosted:not(:focus) { caret-color: transparent; }
.ch-tools { position: relative; }
.ch-esc {
  align-self: center; flex-shrink: 0;
  padding: 2px var(--space-2); border-radius: var(--radius-xs);
  border: 1px solid var(--border2); background: var(--ch-soft);
  color: var(--text3); font-size: 0.72rem; line-height: 1.4; cursor: pointer;
}
.ch-esc:hover { color: var(--accent-text); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
/* No Escape key on a phone keyboard; the hint would only be a small button. */
@media (hover: none) { .ch-esc { display: none; } }
.ch-send {
  width: 36px; height: 36px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--ch-card); color: var(--text3);
  border: 1px solid var(--border2); border-radius: var(--radius-md); cursor: not-allowed;
  transition: background 0.15s, color 0.15s;
}
.ch-send.ready { background: var(--accent); color: var(--accent-on); border-color: var(--accent); cursor: pointer; }
.ch-usage { font-size: 0.78rem; color: var(--text3); margin-top: var(--space-1); }
.ch-usage strong { color: var(--text); }
.ch-usage-out { color: var(--danger-text); }

/* ── Tools menu ── */
.ch-menu-scrim { position: fixed; inset: 0; z-index: 40; }
.ch-menu {
  position: absolute; right: 0; bottom: calc(100% + var(--space-3)); z-index: 41;
  width: 300px; max-height: min(520px, 70vh); overflow-y: auto;
  background: var(--ch-card); border: 1px solid var(--border2); border-radius: var(--radius-xl);
  box-shadow: var(--elev-3); padding: var(--space-2);
}
.ch-menu-label { font-size: 0.74rem; color: var(--text3); padding: var(--space-3) var(--space-2) var(--space-1); }
.ch-menu-note { font-size: 0.74rem; color: var(--text3); padding: 0 var(--space-2) var(--space-1); }
.ch-menu-item {
  width: 100%; display: flex; align-items: flex-start; gap: var(--space-3);
  padding: var(--space-2); border: none; background: none; border-radius: var(--radius-md);
  color: var(--text); text-align: left; cursor: pointer;
}
.ch-menu-item:hover:not(:disabled) { background: var(--ch-soft); }
.ch-menu-item:disabled { opacity: 0.45; cursor: not-allowed; }
.ch-menu-text { display: flex; flex-direction: column; gap: 2px; }
.ch-menu-text strong { font-size: 0.86rem; font-weight: 600; }
.ch-menu-text span { font-size: 0.76rem; color: var(--text3); line-height: 1.4; }
.ch-menu-radio, .ch-menu-check {
  width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px;
  border: 1.5px solid var(--border3);
}
.ch-menu-radio { border-radius: var(--radius-circle); }
.ch-menu-check { border-radius: var(--radius-xs); }
.ch-menu-item.on .ch-menu-radio { border: 5px solid var(--accent); }
.ch-menu-item.on .ch-menu-check { background: var(--accent); border-color: var(--accent); box-shadow: inset 0 0 0 3px var(--ch-card); }
.ch-menu-item.on .ch-menu-text strong { color: var(--accent-text); }
.ch-menu-icon { display: inline-flex; color: var(--text2); margin-top: 1px; }

/* ── Conversation ── */
.ch-thread { max-width: 780px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-6); }
.ch-dock { padding: var(--space-3) var(--space-6) var(--space-4); max-width: 780px; width: 100%; margin: 0 auto; }
.ch-user { display: flex; justify-content: flex-end; margin-bottom: var(--space-8); }
.ch-user span {
  max-width: min(480px, 85%);
  /* The reader's own words sit on the accent wash, so a thread reads at a
     glance as question, answer, question. */
  background: var(--accent-wash); color: var(--text);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4); font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; word-break: break-word;
}
.ch-ai { margin-bottom: var(--space-10); }
.ch-answer-text { font-size: 0.98rem; line-height: 1.8; color: var(--text); word-break: break-word; }
.ch-answer-text p { margin: 0 0 var(--space-3); }
.ch-answer-text strong { font-weight: 700; }
.ch-answer-text em { color: var(--text2); }
.ch-answer-text br + br { display: none; }
/* A <br> straight after a heading or bullet block draws an empty line. */
.ch-answer-text div + br { display: none; }
.chat-msg-h1 { font-size: 1.12rem; font-weight: 700; margin: var(--space-6) 0 var(--space-2); line-height: 1.4; }
.chat-msg-h1:first-child, .chat-msg-h2:first-child, .chat-msg-h3:first-child { margin-top: 0; }
.chat-msg-h2 { font-size: 1.04rem; font-weight: 700; margin: var(--space-5) 0 var(--space-2); line-height: 1.4; }
.chat-msg-h3 {
  font-size: 0.98rem; font-weight: 700; margin: var(--space-5) 0 var(--space-1); line-height: 1.45;
  padding-left: var(--space-3); border-left: 3px solid var(--accent);
}
.chat-bullet { display: flex; align-items: flex-start; gap: var(--space-3); margin: var(--space-1) 0; }
.chat-bullet-dot { width: 6px; height: 6px; border-radius: var(--radius-circle); background: var(--text3); flex-shrink: 0; margin-top: 0.72em; }
.chat-bullet span:last-child { flex: 1; }
.chat-para-gap { height: var(--space-3); }
.chat-hr { height: 1px; background: var(--border); margin: var(--space-5) 0; }
.chat-table-wrap { overflow-x: auto; margin: var(--space-4) 0; border: 1px solid var(--border); border-radius: var(--radius-md); }
.chat-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.chat-table th { background: var(--ch-soft); padding: var(--space-2) var(--space-3); text-align: left; font-weight: 700; border-bottom: 1px solid var(--border); }
.chat-table td { padding: var(--space-2) var(--space-3); border-top: 1px solid var(--border); color: var(--text2); vertical-align: top; }
.chat-citation { color: var(--accent-text); cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
/* A citation: a quiet chip after the claim naming the author, +N for more books.
   Scoped under .ch-answer-text to outrank .ch-wrap button, which sets the body serif. */
.ch-answer-text .chat-cite { display: inline-flex; align-items: center; gap: 0.4em; margin-left: 0.35em; padding: 0.2em 0.6em; vertical-align: 0.1em; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--text2); font-family: var(--font-mono); font-size: 0.66em; font-weight: 500; line-height: 1.35; white-space: nowrap; cursor: pointer; transition: color 0.15s, border-color 0.15s, background 0.15s; }
.ch-answer-text .chat-cite::before { content: ''; width: 1.05em; height: 1.05em; flex: none; background: currentColor; opacity: 0.75; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5'/%3E%3Cpath d='M4 19.5A2.5 2.5 0 0 1 6.5 17H19'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5'/%3E%3Cpath d='M4 19.5A2.5 2.5 0 0 1 6.5 17H19'/%3E%3C/svg%3E") center / contain no-repeat; }
.chat-cite-more { color: var(--text3); }
.ch-answer-text .chat-cite:hover, .ch-answer-text .chat-cite:focus-visible { color: var(--accent-text); border-color: color-mix(in srgb, var(--accent) 40%, transparent); background: var(--accent-wash); outline: none; }
.ch-answer-text .chat-cite:hover .chat-cite-more, .ch-answer-text .chat-cite:focus-visible .chat-cite-more { color: inherit; opacity: 0.7; }
.ch-ai-actions { display: flex; gap: var(--space-2); margin-top: var(--space-4); }

/* Mentor answers keep their sections, in the page's tokens. */
.ch-mentor { display: flex; flex-direction: column; gap: var(--space-3); }
.ch-mentor-tag { display: flex; align-items: center; gap: var(--space-2); font-size: 0.78rem; }
.ch-mentor-tag > span:first-child { padding: 2px var(--space-2); border-radius: var(--radius-pill); background: var(--premium-wash); color: var(--premium-text); border: 1px solid color-mix(in srgb, var(--premium-text) 30%, transparent); }
.ch-mentor-live { color: var(--text3); }
.ch-mentor-section { border: 1px solid; border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); }
.ch-mentor-section-head { display: flex; align-items: center; gap: var(--space-2); font-size: 0.8rem; font-weight: 700; margin-bottom: var(--space-2); }
.ch-mentor-blueprints { display: flex; flex-direction: column; gap: var(--space-2); }
.ch-mentor-option { border-left: 3px solid; border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); }

/* ── Sources card ── */
.ch-sources-card {
  width: 100%; display: flex; align-items: center; gap: var(--space-4);
  margin-top: var(--space-5); padding: var(--space-3) var(--space-4) var(--space-3) var(--space-3);
  background: var(--ch-soft); border: 1px solid var(--border); border-radius: var(--radius-lg);
  color: var(--text); text-align: left; cursor: pointer;
  transition: border-color 0.15s;
}
.ch-sources-card:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.ch-sources-card.on { border-color: var(--accent); background: var(--accent-dim); }
.ch-sources-thumb { display: inline-flex; padding: var(--space-2); background: var(--ch-card); border: 1px solid var(--border); border-radius: var(--radius-md); }
.ch-sources-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ch-sources-text strong { font-size: 0.92rem; }
.ch-sources-text span { font-size: 0.82rem; color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-sources-go { width: 32px; height: 32px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); border-radius: var(--radius-circle); color: var(--accent-text); background: var(--ch-card); }

/* ── Worth knowing ── */
.ch-worth {
  margin-top: var(--space-5); padding: var(--space-4);
  background: color-mix(in srgb, var(--accent) 5%, var(--ch-card));
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: var(--radius-lg);
}
.ch-worth-head { display: flex; align-items: center; gap: var(--space-2); font-size: 0.9rem; font-weight: 700; margin-bottom: var(--space-2); }
.ch-worth-head svg { color: var(--accent); }
.ch-worth-item { padding: var(--space-3) 0; border-top: 1px dashed color-mix(in srgb, var(--accent) 25%, transparent); }
.ch-worth-item:first-of-type { border-top: none; padding-top: var(--space-1); }
.ch-worth-item p { margin: 0 0 var(--space-2); font-size: 0.88rem; line-height: 1.6; color: var(--text); }

/* ── Follow-ups ── */
.ch-follow { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); margin-top: var(--space-5); }
.ch-follow-btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--ch-card); color: var(--text);
  border: 1px solid var(--border2); border-radius: var(--radius-md);
  font-size: 0.86rem; cursor: pointer; text-align: left;
}
.ch-follow-btn svg { color: var(--text3); flex-shrink: 0; }
.ch-follow-btn:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); color: var(--accent-text); }
.ch-follow-btn:hover svg { color: var(--accent); }

/* ── Thinking ── */
.ch-thinking { display: flex; align-items: center; gap: var(--space-5); margin-bottom: var(--space-10); }
.ch-thinking-owl { width: 72px; height: auto; flex-shrink: 0; }
.ch-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.ch-steps li { display: flex; align-items: center; gap: var(--space-2); font-size: 0.9rem; color: var(--text2); }
.ch-step-done { color: var(--success-text); flex-shrink: 0; }
/* The steps, folded into one line above a finished answer. */
.ch-trace { margin-bottom: var(--space-3); }
.ch-trace .ch-trace-toggle { display: inline-flex; align-items: center; gap: var(--space-1); padding: 0; border: 0; background: none; color: var(--text3); font-family: var(--font-ui); font-size: 0.85rem; cursor: pointer; transition: color 0.15s; }
.ch-trace .ch-trace-toggle:hover, .ch-trace .ch-trace-toggle:focus-visible { color: var(--text2); outline: none; }
.ch-trace-chev { transition: transform 0.15s; }
.ch-trace-chev.open { transform: rotate(90deg); }
.ch-trace-steps { margin-top: var(--space-2); padding-left: var(--space-1); }
.ch-trace-steps li { font-family: var(--font-ui); font-size: 0.85rem; color: var(--text3); }
.ch-step-spin { color: var(--text2); flex-shrink: 0; animation: chSpin 1.1s linear infinite; }
@keyframes chSpin { to { transform: rotate(360deg); } }

/* ── Side panel ── */
.ch-panel {
  width: 420px; flex-shrink: 0; margin-top: var(--space-4);
  background: var(--ch-card); border: 1px solid var(--border); border-radius: var(--radius-xl);
  display: flex; flex-direction: column; min-height: 0; overflow: hidden;
}
.ch-panel-scrim { display: none; }
.ch-panel-inner { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.ch-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); padding: var(--space-5) var(--space-5) var(--space-4); border-bottom: 1px solid var(--border); }
.ch-panel-title { font-size: 1.12rem; font-weight: 700; }
.ch-panel-sub { font-size: 0.82rem; color: var(--text2); margin-top: var(--space-1); }
.ch-panel-body { flex: 1; min-height: 0; overflow-y: auto; padding: var(--space-4) var(--space-5) var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
.ch-source, .ch-panel-pyq { border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); scroll-margin-top: var(--space-4); }
.ch-source.on { border-color: var(--accent); background: var(--accent-dim); }
.ch-source-head { display: flex; align-items: baseline; gap: var(--space-2); flex-wrap: wrap; }
.ch-source-n { font-size: 0.74rem; color: var(--accent-text); }
.ch-source-book { font-size: 0.88rem; font-weight: 700; }
.ch-source-author { font-size: 0.78rem; color: var(--text2); margin-top: 2px; }
.ch-source p, .ch-panel-pyq p { margin: var(--space-2) 0 0; font-size: 0.86rem; line-height: 1.7; color: var(--text2); }
.ch-panel-pyq p { color: var(--text); margin-bottom: var(--space-3); }
.ch-panel-pyq { position: relative; transition: border-color 0.15s, background 0.15s; }
.ch-panel-pyq:hover { border-color: var(--accent); background: var(--accent-dim); }
.ch-panel-pyq-link { display: block; color: inherit; text-decoration: none; }
.ch-panel-pyq-link::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
.ch-panel-pyq-link:focus-visible { outline: none; }
.ch-panel-pyq-link:focus-visible::after { outline: 2px solid var(--accent); outline-offset: 2px; }
.ch-panel-pyq .ch-btn { position: relative; z-index: 1; }
.ch-panel-pyq-meta { display: flex; align-items: center; gap: var(--space-2); font-size: 0.74rem; color: var(--text3); }
.ch-panel-pyq-go { margin-left: auto; color: var(--accent-text); flex-shrink: 0; transition: transform 0.15s; }
.ch-panel-pyq:hover .ch-panel-pyq-go { transform: translateX(2px); }
.ch-panel-pyq-meta span + span::before { content: '·'; margin-right: var(--space-2); }

/* ── Overlays ── */
.ch-drop {
  position: absolute; inset: var(--space-4); z-index: 60;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2);
  border: 2px dashed var(--accent); border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-raised)); color: var(--accent-text);
  pointer-events: none;
}
.ch-scrim { display: none; }
.ch-modal-scrim { position: fixed; inset: 0; z-index: 1000; background: color-mix(in srgb, var(--bg) 70%, transparent); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: var(--space-4); }
.ch-modal {
  width: 100%; max-width: 360px; text-align: center;
  background: var(--ch-card); border: 1px solid var(--border2); border-radius: var(--radius-xl);
  box-shadow: var(--elev-3); padding: var(--space-6);
  display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
}
.ch-modal-title { font-size: 1.15rem; font-weight: 700; }
.ch-modal p { margin: 0; font-size: 0.88rem; line-height: 1.6; color: var(--text2); }

/* ── Narrower desktops: the panel floats over the chat ── */
@media (max-width: 1279px) {
  .ch-panel {
    position: absolute; top: 0; right: var(--space-4); bottom: var(--space-4); z-index: 50;
    width: min(440px, calc(100% - var(--space-8)));
    box-shadow: var(--elev-3);
  }
  .ch-panel-scrim { display: block; position: absolute; inset: 0; z-index: 49; background: color-mix(in srgb, var(--bg) 40%, transparent); }
}

/* ── Tablet and phone: the sidebar becomes a drawer ── */
@media (max-width: 899px) {
  .ch-wrap { padding: 0; gap: 0; }
  .ch-main { margin-top: 0; border-radius: 0; border: none; border-top: 1px solid var(--border); }
  .ch-side {
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 1350;
    width: min(320px, 86vw); padding: 0 var(--space-4) var(--space-4);
    background: var(--ch-ground); border-right: 1px solid var(--border);
    transform: translateX(-100%); transition: transform 0.2s ease;
    box-shadow: var(--elev-3);
  }
  .ch-side.open { transform: none; }
  .ch-scrim { display: block; position: fixed; inset: 0; z-index: 1340; background: color-mix(in srgb, var(--bg) 55%, transparent); }
  .ch-mobilebar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border); }
  .ch-mobilebar-title { font-size: 0.9rem; font-weight: 600; }
  .ch-panel { top: 0; right: 0; bottom: 0; width: 100%; margin: 0; border-radius: 0; border: none; }
}

@media (max-width: 768px) {
  .ch-side-chats { flex: none; min-height: 0; overflow: visible; }
  .ch-side { padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px)); }
  .ch-dock { padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px)); }
  .ch-start { justify-content: flex-start; padding: var(--space-5) var(--space-4) 0; }
  /* The owl and subtitle took most of a phone's height, so the flow's list of
     choices had to scroll inside its card from the first screen. */
  .ch-start-owl { height: clamp(56px, 8vh, 80px); }
  .ch-start h1 { font-size: 1.45rem; }
  .ch-start > p { font-size: 0.9rem; line-height: 1.5; margin-bottom: var(--space-3); }
  .ch-flow { padding: var(--space-4); }
  .ch-chip { font-size: 0.82rem; min-height: 32px; padding: var(--space-1) var(--space-2); }
  .ch-textarea { max-height: 104px; }
  .ch-thread { padding: var(--space-5) var(--space-4); }
  .ch-dock { padding: var(--space-2) var(--space-3) var(--space-3); }
  .ch-menu { position: fixed; left: var(--space-3); right: var(--space-3); bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-3)); width: auto; }
  .ch-thinking { gap: var(--space-3); }
  .ch-thinking-owl { width: 56px; }
}

/* On the start screen a long question (a picked PYQ runs to several lines)
   scrolls inside the input instead of pushing the flow's buttons off the
   panel; the full text is in the picker above it anyway. */
.ch-start .ch-textarea { max-height: 104px; }
@media (max-height: 760px) {
  .ch-start .ch-textarea { max-height: 56px; }
  .ch-wrap { padding-bottom: var(--space-3); }
  .ch-main, .ch-panel { margin-top: var(--space-3); }
  .ch-start > .ch-composer { padding-bottom: var(--space-2); }
  .ch-flow { padding: var(--space-2-5) var(--space-4); }
}

/* Shorter windows: the syllabus card sits ring-beside-text, so the sidebar
   fits without scrolling on a 13-inch laptop. */
@media (max-height: 860px) and (min-width: 900px) {
  .ch-side-inner { gap: var(--space-2); padding-top: var(--space-3); }
  .ch-side-chats { min-height: 96px; }
  .ch-side-nav a { padding: 6px var(--space-2); }
  .ch-side-card { display: grid; grid-template-columns: 48px 1fr; column-gap: var(--space-3); align-items: center; padding: var(--space-3); }
  .ch-ring { width: 48px; height: 48px; margin: 0; grid-row: span 2; }
  .ch-ring svg { width: 48px; height: 48px; }
  .ch-side-card-title { margin: 0; font-size: 0.86rem; }
  .ch-side-card-text { display: none; }
  .ch-side-card-link { margin-top: 2px; font-size: 0.8rem; }
  }

@media (prefers-reduced-motion: reduce) {
  .ch-step-spin, .ch-pyq-skel, .ch-caret { animation: none; }
  .ch-side { transition: none; }
}
`;
