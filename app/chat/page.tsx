'use client';
import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { SubjectKey } from '@/lib/subjectConfig';
import {
  SUGGESTED_QUESTIONS,
  SUBJECT_DISPLAY,
  SUBJECT_BOOKS,
} from '@/lib/subjectConfig';

// ── Types ─────────────────────────────────────────────────────
type Message = {
  role: 'user' | 'assistant';
  content: string;
  sources?: { book_title: string; content: string }[];
};

type ChatHistoryEntry = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

// ── Chat history persistence (localStorage) ───────────────────
const CHAT_HISTORY_KEY = 'pp_chat_history_v1';
const CHAT_HISTORY_MAX = 50;

function loadChatHistory(): ChatHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveChatHistoryList(list: ChatHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(list.slice(0, CHAT_HISTORY_MAX))); }
  catch { /* quota */ }
}

function makeChatTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  const base = (firstUser?.content || 'New chat').trim().replace(/\s+/g, ' ');
  return base.length > 60 ? base.slice(0, 60) + '…' : base;
}

// ── Source passage display ────────────────────────────────────
function cleanChunk(text: string): string {
  return text
    .replace(/indira gandhi national open university[\s\S]{0,600}/gi, '')
    .replace(/expert committee[\s\S]{0,600}/gi, '')
    .replace(/check your progress[\s\S]{0,400}/gi, '')
    .replace(/answers to check your progress[\s\S]{0,400}/gi, '')
    .replace(/suggested readings[\s\S]{0,400}/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\.{4,}/g, '')
    .replace(/_{4,}/g, '')
    .replace(/\s{3,}/g, ' ')
    .trim();
}

function SourcePassages({ sources }: { sources: { book_title: string; content: string }[] }) {
  const [expanded, setExpanded] = useState(false);
  const cleaned = sources.map((s) => ({ ...s, content: cleanChunk(s.content) })).filter((s) => s.content.length > 80);
  if (cleaned.length === 0) return null;
  return (
    <div style={{ margin: '0.75rem 0 0.25rem', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)', overflow: 'hidden', background: 'var(--bg2, #111)' }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ padding: '0.5rem 0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(99,102,241,0.08)', borderBottom: expanded ? '1px solid rgba(99,102,241,0.15)' : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem' }}>📖</span>
          <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Source Passages · {cleaned.length} found
          </span>
        </div>
        <span style={{ fontSize: '0.6rem', color: '#6366f1' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && cleaned.map((s, si) => (
        <div key={si} style={{ padding: '0.75rem 0.9rem', borderTop: si > 0 ? '1px solid rgba(99,102,241,0.1)' : 'none' }}>
          <div style={{ display: 'inline-block', fontSize: '0.6rem', fontFamily: 'monospace', color: '#a5b4fc', background: 'rgba(99,102,241,0.15)', borderRadius: 4, padding: '0.15rem 0.5rem', marginBottom: '0.5rem' }}>
            {s.book_title}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text2, #aaa)', lineHeight: 1.75 }}>
            {s.content.split(/(?<=[.?!])\s+/).filter((t) => t.trim().length > 20).slice(0, 6).map((sentence, i) => (
              <span key={i}>{sentence.trim()} </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main chat component ───────────────────────────────────────
function ChatContent() {
  const searchParams = useSearchParams();
  const validSubjects: SubjectKey[] = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'];
  const rawSubject = searchParams.get('subject');
  const [subject, setSubject] = useState<SubjectKey>(
    validSubjects.includes(rawSubject as SubjectKey) ? rawSubject as SubjectKey : 'sociology'
  );

  // Auto-detect subject from user's saved optional if no ?subject= param
  useEffect(() => {
    if (rawSubject) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // only fire once
      const t = user ? await user.getIdToken() : '';
      fetch('/api/user-profile', {
        headers: t ? { 'x-user-token': t } : {},
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.optional) {
            // Map API values to SubjectKey
            const optionalMap: Record<string, SubjectKey> = {
              'sociology': 'sociology',
              'anthropology': 'anthropology',
              'geography': 'geography',
              'political-science': 'polsci',
              'public-administration': 'pub-admin',
              'history': 'sociology', // fallback
            };
            const mapped = optionalMap[data.optional];
            if (mapped) setSubject(mapped);
          }
        })
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const subjectDisplay = SUBJECT_DISPLAY[subject];
  // Update greeting when subject changes (e.g. after auto-detect)
  // Re-set greeting when subject auto-detected
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: initialTopic
        ? `Hello! I'm your **${SUBJECT_DISPLAY[subject]} Optional AI**. You selected the topic: **${initialTopic}**. Let\'s dive in — what would you like to explore first?`
        : `Hello! I'm your **${SUBJECT_DISPLAY[subject]} Optional AI**.\n\nI can help with:\n\n• **Concept explanations** — deep dives into any topic\n• **Answer structuring** — UPSC-style frameworks\n• **PYQ analysis** — model answers and key points\n• **Thinkers** — citing the right scholar in the right context\n• **Brainstorm mode** — essay plans and argument maps\n\nWhat would you like to explore?`,
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);


  const initialTopic = searchParams.get('topic') || '';
  const initialQ = searchParams.get('q') || '';
  const langHi = searchParams.get('lang') === 'hi';

  const greeting = initialTopic
    ? `Hello! You're studying **${initialTopic}**. Ask me anything — concepts, answer structures, thinkers, or model answers.`
    : `Hello! I'm your **${subjectDisplay} Optional AI**.\n\nI can help with:\n\n• **Concept explanations** — deep dives into any topic\n• **Answer structuring** — UPSC-style frameworks\n• **PYQ analysis** — model answers and key points\n• **Thinkers** — citing the right scholar in the right context\n• **Brainstorm mode** — essay plans and argument maps\n\nWhat would you like to explore?`;

  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: greeting }]);
  const [input, setInput] = useState(initialQ);
  const [loading, setLoading] = useState(false);

  // Modes
  const [bookMode, setBookMode] = useState(false);
  const [bookTitle, setBookTitle] = useState<string>('all');
  const [brainstormMode, setBrainstormMode] = useState(false);
  const [responseStyle, setResponseStyle] = useState<'concise' | 'elaborative'>('concise');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);

  // UI state
  const [booksPopoverOpen, setBooksPopoverOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<ChatHistoryEntry[]>([]);
  const [citationModal, setCitationModal] = useState<{ book_title: string; content: string }[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [chatId, setChatId] = useState<string>(() => typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now()));
  const hasUserMessageRef = useRef(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastAiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const suggestedEn = SUGGESTED_QUESTIONS[subject]?.en ?? [];
  const suggestedHi = SUGGESTED_QUESTIONS[subject]?.hi ?? [];
  const bookGroups = SUBJECT_BOOKS[subject] ?? [];

  // Auth gate
  const [authChecked, setAuthChecked] = useState(false);

  // Usage gate (simple — wired to Supabase usage_tracking same as history-optional)
  const [usageFree, setUsageFree] = useState<number | null>(null); // null = loading
  const [fingerprint, setFingerprint] = useState('');
  const [userToken, setUserToken] = useState('');
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    // Get fingerprint from cookie/localStorage (set by middleware or FP lib)
    const fp = document.cookie.match(/fp=([^;]+)/)?.[1] ?? localStorage.getItem('fp') ?? '';
    setFingerprint(fp);
    // Auth check — redirect to login if not signed in
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setAuthChecked(true);
      if (user) {
        const token = await user.getIdToken();
        setUserToken(token);
      } else {
        window.location.href = '/login?redirect=/chat';
      }
    });
    setUsageFree(0); // allow until server confirms limit
    setHistoryList(loadChatHistory());
    return () => unsubscribe();
  }, []);

  // Blank screen while Firebase resolves auth state
  // (moved below all hooks to comply with Rules of Hooks)
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (loading && last?.role === 'assistant') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (last?.role === 'assistant' && messages.length > 1) {
      setTimeout(() => lastAiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (loading) return;
    if (messages.some((m) => m.role === 'user')) hasUserMessageRef.current = true;
    if (!hasUserMessageRef.current) return;
    const entry: ChatHistoryEntry = { id: chatId, title: makeChatTitle(messages), messages, updatedAt: Date.now() };
    setHistoryList((prev) => {
      const updated = [entry, ...prev.filter((c) => c.id !== chatId)].slice(0, CHAT_HISTORY_MAX);
      saveChatHistoryList(updated);
      return updated;
    });
  }, [messages, loading, chatId]);

  const handlePdfUpload = useCallback((file: File) => {
    if (!file || file.type !== 'application/pdf') { alert('Please upload a valid PDF file.'); return; }
    if (file.size > 20 * 1024 * 1024) { alert('PDF too large. Max 20MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      setPdfBase64(base64);
      setPdfFile(file);
      setPdfName(file.name);
      setMessages((prev) => [...prev, { role: 'assistant', content: `PDF uploaded: **${file.name}**\n\nYou can now:\n• Ask me to explain any concept from this PDF\n• Request model answers for questions in it\n• Discuss its contents in detail` }]);
    };
    reader.readAsDataURL(file);
  }, []);

  const startNewChat = useCallback(() => {
    setChatId(typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now()));
    hasUserMessageRef.current = false;
    setMessages([{ role: 'assistant', content: greeting }]);
    setInput('');
    setPdfFile(null); setPdfBase64(null); setPdfName(null);
    setBrainstormMode(false);
    setHistoryOpen(false);
  }, [greeting]);

  const loadHistoryEntry = useCallback((entry: ChatHistoryEntry) => {
    setChatId(entry.id);
    hasUserMessageRef.current = entry.messages.some((m) => m.role === 'user');
    setMessages(entry.messages);
    setInput('');
    setHistoryOpen(false);
  }, []);

  const deleteHistoryEntry = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setHistoryList((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveChatHistoryList(updated);
      return updated;
    });
    if (id === chatId) startNewChat();
  }, [chatId, startNewChat]);

  // All hooks above — safe to early-return now
  if (!authChecked) return null;

  const sendMessage = async (text?: string) => {
    const q = text || input;
    if (!q.trim() || loading) return;
    if (q.length > 10000) { alert('Message too long. Max 10000 characters.'); return; }

    const userMsg: Message = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    if (inputRef.current) inputRef.current.style.height = 'auto';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-token': userToken,
          'x-fingerprint': fingerprint,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          subject,
          bookMode,
          bookTitle: bookTitle === 'all' ? undefined : bookTitle,
          pdf_base64: pdfBase64 ?? undefined,
          pdf_name: pdfName ?? undefined,
          lang: langHi ? 'hi' : 'en',
          responseStyle: brainstormMode ? undefined : responseStyle,
          brainstormMode,
          mentorMode: false, // add later when mentor mode UI is built
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (err.error === 'limit_reached') {
          setMessages((prev) => [...prev, { role: 'assistant', content: '__LIMIT_REACHED__' }]);
          setLoading(false); return;
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
        setLoading(false); return;
      }

      const reader = response.body!.getReader();
      const dec = new TextDecoder();
      let full = '';
      let sources: { book_title: string; content: string }[] = [];
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        full += chunk;
        const SOURCES_MARKER = '\n__SOURCES__';
        const srcIdx = full.indexOf(SOURCES_MARKER);
        if (srcIdx !== -1) {
          try { sources = JSON.parse(full.slice(srcIdx + SOURCES_MARKER.length)); } catch { /* ignore */ }
          full = full.slice(0, srcIdx);
        }
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: full, sources };
          return updated;
        });
      }
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: full, sources };
        return updated;
      });
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Message formatting ────────────────────────────────────────
  function linkifyCitations(html: string, sourcesCount: number): string {
    if (!sourcesCount) return html;
    return html.replace(/\b(Sources?)\s*#?\s*(\d+(?:\s*(?:,|and|&)\s*\d+)*)\b/gi, (match, _label, numList) => {
      const nums = Array.from(numList.matchAll(/\d+/g)).map((m: RegExpMatchArray) => parseInt(m[0], 10));
      const valid = nums.filter((n) => n >= 1 && n <= sourcesCount);
      if (valid.length === 0) return match;
      return `<span class="pp-citation" data-citation="${valid.join(',')}">${match}</span>`;
    });
  }

  function formatTable(text: string): string {
    const lines = text.split('\n');
    let result = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.includes('|') && line.trim().startsWith('|')) {
        const nextLine = lines[i + 1] || '';
        if (nextLine.match(/^[|\s\-:]+$/)) {
          const headers = line.split('|').filter((c) => c.trim()).map((c) => `<th>${c.trim()}</th>`).join('');
          let rows = '';
          i += 2;
          while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
            const cols = lines[i].split('|').filter((c) => c.trim()).map((c) => `<td>${c.trim()}</td>`).join('');
            rows += `<tr>${cols}</tr>`;
            i++;
          }
          result += `<div class="pp-table-wrap"><table class="pp-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
          continue;
        }
      }
      result += lines[i] + '\n';
      i++;
    }
    return result;
  }

  function formatMessage(text: string, sourcesCount = 0) {
    text = formatTable(text);
    text = text.replace(/^-{3,}$/gm, '___HR___');
    text = text.replace(/^#{1,2} (.+)$/gm, (_: string, t: string) => `___H1___${t}___END___`);
    text = text.replace(/^### (.+)$/gm, (_: string, t: string) => `___H2___${t}___END___`);
    text = text.replace(/^#{4,6} (.+)$/gm, (_: string, t: string) => `___H3___${t}___END___`);
    text = text.replace(/^ *\d+[.)]\s+(.+)$/gm, (_: string, t: string) => `___BULLET___${t}___END___`);
    text = text.replace(/^ *[-*•–—]\s+\*\*([^*]+?)\*\*:?\s*$/gm, (_: string, t: string) => `___H3___${t}___END___`);
    text = text.replace(/^ *[-*•–—]\s+(.+)$/gm, (_: string, t: string) => `___BULLET___${t}___END___`);
    text = text.replace(/^\s*\*\*([^*]+)\*\*\s*$/gm, (_: string, t: string) => `___H3___${t}___END___`);
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/___HR___/g, '<div class="pp-hr"></div>');
    text = text.replace(/___H1___(.+?)___END___/g, (_: string, t: string) => `<div class="pp-h1">${t}</div>`);
    text = text.replace(/___H2___(.+?)___END___/g, (_: string, t: string) => `<div class="pp-h2">${t.replace(/^#+\s*/, '')}</div>`);
    text = text.replace(/___H3___(.+?)___END___/g, (_: string, t: string) => `<div class="pp-h3">${t}</div>`);
    text = text.replace(/___BULLET___(.+?)___END___/g, (_: string, t: string) => `<div class="pp-bullet"><span class="pp-bullet-dot"></span><span>${t}</span></div>`);
    text = text.replace(/\n\n/g, '<div class="pp-gap"></div>');
    text = text.replace(/\n/g, '<br/>');
    text = text.replace(/<div class="pp-bullet"><span class="pp-bullet-dot"><\/span><span><strong>([^<]+)<\/strong>:?\s*<\/span><\/div>/g, (_: string, t: string) => `<div class="pp-h3">${t}</div>`);
    text = linkifyCitations(text, sourcesCount);
    return text;
  }

  function sanitize(html: string) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  }

  const activeModeLabel = brainstormMode ? '💡 Brainstorm'
    : pdfFile ? '📄 PDF'
    : bookMode ? '📚 Books'
    : responseStyle === 'elaborative' ? '📖 Elaborative'
    : '⚡ Concise';

  return (
    <>
      <style>{`
        .pp-wrap {
          display: flex; flex-direction: column;
          height: calc(100dvh - 60px);
          background: var(--bg, #050508);
          overflow: hidden;
        }
        .pp-msgs {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          padding: 1rem 0.85rem 0.5rem;
        }
        .pp-msgs-inner { max-width: 720px; margin: 0 auto; }

        .pp-footer {
          flex-shrink: 0;
          background: var(--bg, #050508);
          border-top: 1px solid var(--border, #1a1a2e);
          padding: 0.55rem 0.75rem 0.7rem;
          padding-bottom: max(0.7rem, env(safe-area-inset-bottom));
        }

        /* mode strip */
        .pp-mode-strip {
          display: flex; align-items: center; gap: 0.3rem;
          overflow-x: auto; -webkit-overflow-scrolling: touch;
          scrollbar-width: none; margin-bottom: 0.45rem; padding-bottom: 2px;
        }
        .pp-mode-strip::-webkit-scrollbar { display: none; }
        .pp-mode-pill {
          display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
          font-size: 0.65rem; font-family: monospace;
          padding: 4px 10px; border-radius: 20px;
          border: 1px solid var(--border, #1a1a2e);
          background: transparent; color: var(--text3, #555);
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .pp-mode-pill.active { border-color: rgba(99,102,241,0.6); background: rgba(99,102,241,0.15); color: #a5b4fc; }

        /* input */
        .pp-input-row {
          display: flex; align-items: flex-end; gap: 0.4rem;
          background: var(--bg2, #0d0d1a); border: 1px solid var(--border, #1a1a2e);
          border-radius: 24px; padding: 0.4rem 0.45rem 0.4rem 0.9rem;
          transition: border-color 0.18s;
        }
        .pp-input-row:focus-within { border-color: rgba(59,130,246,0.45); box-shadow: 0 0 0 3px rgba(59,130,246,0.08); }
        .pp-textarea {
          flex: 1; background: transparent; border: none; outline: none;
          resize: none; color: var(--text, #e8e8f0);
          font-family: inherit; font-size: 0.88rem; line-height: 1.5;
          padding: 0.3rem 0; min-height: 36px; max-height: 180px;
        }
        .pp-textarea::placeholder { color: var(--text3, #555); }
        .pp-send-btn {
          width: 34px; height: 34px; border-radius: 50%; border: none;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.18s; font-size: 15px;
        }
        .pp-send-btn.active { background: linear-gradient(135deg, #1d4ed8, #3b82f6); color: #fff; }
        .pp-send-btn.inactive { background: var(--bg3, #111); color: var(--text3, #555); cursor: not-allowed; }

        /* messages */
        .pp-msg-row { margin-bottom: 1.1rem; display: flex; flex-direction: column; }
        .pp-msg-row.user { align-items: flex-end; }
        .pp-msg-row.assistant { align-items: flex-start; }

        .pp-bubble-user {
          max-width: 82%;
          background: linear-gradient(135deg, rgba(29,78,216,0.18), rgba(59,130,246,0.09));
          border: 1px solid rgba(59,130,246,0.22);
          border-radius: 18px 18px 4px 18px;
          padding: 0.7rem 1rem; color: var(--text, #e8e8f0);
          font-size: 0.88rem; line-height: 1.6; word-break: break-word;
        }
        .pp-bubble-ai {
          max-width: 97%;
          background: var(--bg2, #0d0d1a);
          border: 1px solid var(--border, #1a1a2e);
          border-radius: 4px 18px 18px 18px;
          padding: 1rem 1.1rem 0.85rem;
          color: var(--text, #e8e8f0);
          font-size: 0.88rem; line-height: 1.8; position: relative;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4); word-break: break-word;
        }
        .pp-bubble-ai::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #3b82f6 0%, rgba(59,130,246,0.2) 55%, transparent 100%);
          border-radius: 4px 18px 0 0;
        }

        /* formatting */
        .pp-h1 { font-size: 0.97rem; font-weight: 700; color: #fff; margin: 1.2rem 0 0.5rem; padding: 0.45rem 0.8rem 0.45rem 0.85rem; background: linear-gradient(135deg, rgba(37,99,235,0.2), rgba(59,130,246,0.04)); border-left: 3px solid #3b82f6; border-radius: 0 8px 8px 0; line-height: 1.4; }
        .pp-h1:first-child { margin-top: 0; }
        .pp-h2 { font-size: 0.9rem; font-weight: 700; color: #fbbf24; margin: 1.1rem 0 0.35rem; padding-left: 0.55rem; border-left: 2.5px solid #f59e0b; line-height: 1.4; }
        .pp-h3 { font-size: 0.87rem; font-weight: 700; color: #4ade80; margin: 0.9rem 0 0.25rem; padding-left: 0.5rem; border-left: 2px solid #22c55e; line-height: 1.4; }
        .pp-bullet { display: flex; align-items: flex-start; gap: 0.6rem; margin: 0.1rem 0; padding: 0.35rem 0.5rem 0.35rem 0.35rem; border-radius: 6px; color: var(--text, #e8e8f0); }
        .pp-bullet-dot { width: 6px; height: 6px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #60a5fa); box-shadow: 0 0 6px rgba(59,130,246,0.5); flex-shrink: 0; margin-top: 0.55rem; }
        .pp-bullet span:last-child { flex: 1; line-height: 1.72; }
        .pp-bullet strong { color: var(--text, #e8e8f0); font-weight: 700; }
        .pp-gap { height: 0.55rem; }
        .pp-hr { height: 1px; background: linear-gradient(90deg, rgba(59,130,246,0.2), transparent); margin: 0.9rem 0; }
        .pp-bubble-ai strong { color: var(--text, #e8e8f0); font-weight: 700; }
        .pp-bubble-ai em { color: var(--text2, #aaa); font-style: italic; }

        /* tables */
        .pp-table-wrap { overflow-x: auto; margin: 0.8rem 0; border-radius: 8px; border: 1px solid rgba(59,130,246,0.15); }
        .pp-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .pp-table th { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.2); padding: 7px 10px; text-align: left; color: #f1f5f9; font-weight: 600; }
        .pp-table td { border: 1px solid rgba(0,0,0,0.07); padding: 6px 10px; color: #c8d3e0; vertical-align: top; }

        /* citations */
        .pp-citation { color: #818cf8; cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-decoration-color: rgba(129,140,248,0.5); text-underline-offset: 2px; }
        .pp-citation:hover { color: #a5b4fc; }

        /* meta */
        .pp-meta { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.3rem; padding: 0 4px; }
        .pp-meta.user { flex-direction: row-reverse; }
        .pp-meta-label { color: var(--text3, #555); font-size: 0.62rem; letter-spacing: 0.08em; font-family: monospace; }
        .pp-ai-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.6rem; letter-spacing: 0.1em; font-family: monospace; color: rgba(59,130,246,0.6); }
        .pp-ai-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(59,130,246,0.6); box-shadow: 0 0 5px rgba(59,130,246,0.5); }

        /* typing */
        .pp-typing { display: flex; align-items: center; gap: 0.55rem; padding: 0.65rem 0.9rem; margin-bottom: 0.75rem; background: var(--bg2, #0d0d1a); border: 1px solid var(--border, #1a1a2e); border-radius: 4px 14px 14px 14px; width: fit-content; }
        .pp-typing-dots { display: flex; gap: 4px; }
        .pp-typing-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(59,130,246,0.45); animation: ppDotPulse 1.3s ease infinite; }
        .pp-typing-dot:nth-child(2) { animation-delay: 0.16s; }
        .pp-typing-dot:nth-child(3) { animation-delay: 0.32s; }
        @keyframes ppDotPulse { 0%,100% { opacity:0.2; transform:scale(0.72); } 50% { opacity:1; transform:scale(1.12); } }
        .pp-typing-text { font-size: 0.65rem; color: var(--text3, #555); letter-spacing: 0.07em; font-family: monospace; }

        /* suggested */
        .pp-suggested-label { font-family: monospace; font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3, #555); margin-bottom: 0.7rem; display: flex; align-items: center; gap: 0.5rem; }
        .pp-suggested-label::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, var(--border, #1a1a2e), transparent); }
        .pp-suggested-grid { display: flex; flex-direction: column; gap: 0.4rem; }
        .pp-suggested-btn { background: var(--bg2, #0d0d1a); border: 1px solid var(--border, #1a1a2e); border-radius: 12px; padding: 0.65rem 0.9rem; text-align: left; color: var(--text2, #aaa); cursor: pointer; font-size: 0.82rem; line-height: 1.45; width: 100%; transition: all 0.18s; }
        .pp-suggested-btn:hover { border-color: rgba(59,130,246,0.3); color: var(--text, #e8e8f0); background: rgba(29,78,216,0.08); }

        /* pdf strip */
        .pp-pdf-strip { display: flex; align-items: center; gap: 0.4rem; font-size: 0.65rem; font-family: monospace; color: #a5b4fc; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); border-radius: 8px; padding: 0.25rem 0.6rem; margin-bottom: 0.45rem; }
        .pp-pdf-strip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
        .pp-pdf-strip-close { cursor: pointer; opacity: 0.6; flex-shrink: 0; font-size: 0.75rem; }

        /* books sheet */
        .pp-books-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 899; backdrop-filter: blur(2px); }
        .pp-books-sheet { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg2, #0d0d1a); border-top: 1px solid rgba(139,92,246,0.3); border-radius: 20px 20px 0 0; padding: 1rem 1rem 1.5rem; padding-bottom: max(1.5rem, env(safe-area-inset-bottom)); z-index: 900; max-height: 60vh; overflow-y: auto; }
        .pp-books-handle { width: 36px; height: 4px; background: var(--border, #1a1a2e); border-radius: 2px; margin: 0 auto 1rem; }
        .pp-books-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
        .pp-books-title { font-size: 0.85rem; font-weight: 600; color: var(--text, #e8e8f0); }
        .pp-books-toggle { width: 40px; height: 23px; border-radius: 12px; border: none; cursor: pointer; position: relative; transition: all 0.25s; }
        .pp-books-toggle.on { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
        .pp-books-toggle.off { background: rgba(99,102,241,0.2); }
        .pp-books-toggle-dot { position: absolute; top: 3px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: left 0.25s; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
        .pp-books-select { width: 100%; font-size: 0.75rem; background: var(--bg3, #111); color: var(--text, #e8e8f0); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; padding: 0.45rem 0.6rem; cursor: pointer; outline: none; font-family: monospace; margin-top: 0.5rem; }
        .pp-books-group-label { font-size: 0.65rem; color: var(--text3, #555); font-family: monospace; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.4rem 0 0.2rem; }

        /* mode sheet */
        .pp-mode-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 800; }
        .pp-mode-sheet { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg2, #0d0d1a); border-top: 1px solid var(--border, #1a1a2e); border-radius: 20px 20px 0 0; padding: 1rem 1rem 1.5rem; padding-bottom: max(1.5rem, env(safe-area-inset-bottom)); z-index: 801; }
        .pp-mode-handle { width: 36px; height: 4px; background: var(--border, #1a1a2e); border-radius: 2px; margin: 0 auto 1rem; }
        .pp-mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; }
        .pp-mode-btn { display: flex; flex-direction: column; align-items: flex-start; background: var(--bg3, #111); border: 1px solid var(--border, #1a1a2e); border-radius: 12px; padding: 0.75rem 0.85rem; cursor: pointer; text-align: left; transition: all 0.15s; }
        .pp-mode-btn:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.08); }
        .pp-mode-btn.active { border-color: rgba(99,102,241,0.55); background: rgba(99,102,241,0.14); }
        .pp-mode-icon { font-size: 1.25rem; margin-bottom: 0.35rem; }
        .pp-mode-label { font-size: 0.78rem; font-weight: 600; color: var(--text, #e8e8f0); }
        .pp-mode-desc { font-size: 0.65rem; color: var(--text3, #555); margin-top: 0.15rem; line-height: 1.4; }

        /* history */
        .pp-hist-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 998; }
        .pp-hist-panel { position: fixed; top: 0; left: 0; bottom: 0; width: 290px; max-width: 85vw; background: var(--bg2, #0d0d1a); border-right: 1px solid var(--border, #1a1a2e); z-index: 999; display: flex; flex-direction: column; box-shadow: 8px 0 40px rgba(0,0,0,0.5); }
        .pp-hist-head { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.1rem; border-bottom: 1px solid var(--border, #1a1a2e); }
        .pp-hist-title { font-size: 0.85rem; font-weight: 600; color: var(--text, #e8e8f0); }
        .pp-hist-close { background: none; border: none; color: var(--text3, #555); font-size: 1.1rem; cursor: pointer; }
        .pp-hist-new { margin: 0.75rem 1rem 0.5rem; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, rgba(29,78,216,0.22), rgba(59,130,246,0.1)); border: 1px solid rgba(59,130,246,0.3); color: #dbe6ff; padding: 0.5rem; border-radius: 9px; cursor: pointer; font-size: 0.78rem; }
        .pp-hist-list { flex: 1; overflow-y: auto; padding: 0.4rem 0.6rem 1rem; }
        .pp-hist-empty { color: var(--text3, #555); font-size: 0.78rem; text-align: center; padding: 2rem 1rem; line-height: 1.6; }
        .pp-hist-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 0.6rem 0.65rem; border-radius: 9px; cursor: pointer; margin-bottom: 3px; transition: background 0.15s; }
        .pp-hist-item:hover { background: rgba(59,130,246,0.08); }
        .pp-hist-item.active { background: rgba(59,130,246,0.14); border: 1px solid rgba(59,130,246,0.28); }
        .pp-hist-item-title { font-size: 0.77rem; color: var(--text2, #aaa); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .pp-hist-item-date { font-size: 0.6rem; color: var(--text3, #555); margin-top: 3px; font-family: monospace; }
        .pp-hist-item-del { background: none; border: none; color: var(--text3, #555); cursor: pointer; font-size: 0.85rem; flex-shrink: 0; padding: 2px 4px; opacity: 0.6; }
        .pp-hist-item-del:hover { opacity: 1; color: #f87171; }

        /* citation modal */
        .pp-cite-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .pp-cite-modal { background: var(--bg, #050508); border: 1px solid rgba(99,102,241,0.4); border-radius: 16px; padding: 1.25rem; max-width: 480px; width: 100%; max-height: 75vh; overflow-y: auto; }

        /* drag overlay */
        .pp-drag-overlay { position: fixed; inset: 0; z-index: 900; background: rgba(99,102,241,0.07); border: 2px dashed rgba(99,102,241,0.4); display: flex; align-items: center; justify-content: center; pointer-events: none; }

        /* desktop toolbar */
        .pp-toolbar { display: none; }
        .pp-style-toggle { display: none; }

        @media (min-width: 900px) {
          .pp-wrap { flex-direction: row; }
          .pp-msgs { flex: 1; min-width: 0; overflow-y: auto; padding: 1rem 1.5rem 2rem; }
          .pp-msgs-inner { max-width: 760px; margin: 0 auto; }
          .pp-footer { width: 380px; flex-shrink: 0; border-top: none; border-left: 1px solid var(--border, #1a1a2e); display: flex; flex-direction: column; justify-content: flex-end; padding: 1.25rem 1.25rem 1.25rem 0.75rem; }
          .pp-mode-strip { display: none; }
          .pp-toolbar { display: flex; align-items: center; gap: 0.32rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
          .pp-style-toggle { display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.5rem; }
          .pp-input-area-wrap { background: var(--bg2, #0d0d1a); border: 1px solid var(--border, #1a1a2e); border-radius: 16px; padding: 0.7rem 0.75rem 0.8rem; box-shadow: 0 8px 28px rgba(0,0,0,0.4); }
          .pp-suggested-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; }
        }
        .pp-input-area-wrap { background: transparent; border: none; padding: 0; box-shadow: none; }

        /* desktop tool buttons */
        .pp-tool-btn { display: inline-flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.08); color: var(--text2, #aaa); cursor: pointer; padding: 0.32rem 0.55rem; border-radius: 7px; font-size: 0.66rem; font-family: monospace; font-weight: 500; transition: all 0.15s; white-space: nowrap; }
        .pp-tool-btn:hover { border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.07); }
        .pp-tool-btn.active { background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.6); color: #a5b4fc; }
        .pp-tool-divider { width: 1px; height: 16px; background: var(--border, #1a1a2e); margin: 0 0.1rem; flex-shrink: 0; }

        /* books popover */
        .pp-books-popover { position: absolute; bottom: calc(100% + 8px); left: 0; width: 260px; max-width: 80vw; background: var(--bg2, #0d0d1a); border: 1px solid rgba(139,92,246,0.4); border-radius: 14px; padding: 0.75rem; box-shadow: 0 12px 40px rgba(0,0,0,0.3); z-index: 60; }
      `}</style>

      <div
        className="pp-wrap"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handlePdfUpload(f); }}
      >
        {dragOver && (
          <div className="pp-drag-overlay">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'rgba(139,143,255,0.9)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Drop PDF here
            </div>
          </div>
        )}

        {/* History sidebar */}
        {historyOpen && (
          <>
            <div className="pp-hist-overlay" onClick={() => setHistoryOpen(false)} />
            <div className="pp-hist-panel">
              <div className="pp-hist-head">
                <span className="pp-hist-title">Chat History</span>
                <button className="pp-hist-close" onClick={() => setHistoryOpen(false)}>✕</button>
              </div>
              <button className="pp-hist-new" onClick={startNewChat}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Chat
              </button>
              <div className="pp-hist-list">
                {historyList.length === 0 ? (
                  <div className="pp-hist-empty">No saved chats yet.<br />Start a conversation.</div>
                ) : (
                  historyList.sort((a, b) => b.updatedAt - a.updatedAt).map((entry) => (
                    <div key={entry.id} className={`pp-hist-item ${entry.id === chatId ? 'active' : ''}`} onClick={() => loadHistoryEntry(entry)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pp-hist-item-title">{entry.title}</div>
                        <div className="pp-hist-item-date">{new Date(entry.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                      </div>
                      <button className="pp-hist-item-del" onClick={(e) => deleteHistoryEntry(entry.id, e)}>✕</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* Books sheet (mobile) */}
        {booksPopoverOpen && (
          <>
            <div className="pp-books-overlay" onClick={() => setBooksPopoverOpen(false)} />
            <div className="pp-books-sheet">
              <div className="pp-books-handle" />
              <div className="pp-books-row">
                <span className="pp-books-title">📚 Chat with Books</span>
                <button className={`pp-books-toggle ${bookMode ? 'on' : 'off'}`} onClick={() => setBookMode((b) => !b)}>
                  <span className="pp-books-toggle-dot" style={{ left: bookMode ? 20 : 3 }} />
                </button>
              </div>
              {bookMode && (
                <select value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} className="pp-books-select">
                  <option value="all">📖 All Books</option>
                  {bookGroups.map((g) => (
                    <optgroup key={g.group} label={`── ${g.group} ──`}>
                      {g.books.map((b) => (
                        <option key={b.value} value={b.value}>{b.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>
          </>
        )}

        {/* Mode sheet (mobile) */}
        {modeSheetOpen && (
          <>
            <div className="pp-mode-overlay" onClick={() => setModeSheetOpen(false)} />
            <div className="pp-mode-sheet">
              <div className="pp-mode-handle" />
              <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text3, #555)', marginBottom: '0.75rem' }}>Select Mode</div>
              <div className="pp-mode-grid">
                <button className={`pp-mode-btn ${responseStyle === 'concise' && !brainstormMode ? 'active' : ''}`}
                  onClick={() => { setResponseStyle('concise'); setBrainstormMode(false); setModeSheetOpen(false); }}>
                  <span className="pp-mode-icon">⚡</span>
                  <span className="pp-mode-label">Concise</span>
                  <span className="pp-mode-desc">Bullet-point answers, fast</span>
                </button>
                <button className={`pp-mode-btn ${responseStyle === 'elaborative' && !brainstormMode ? 'active' : ''}`}
                  onClick={() => { setResponseStyle('elaborative'); setBrainstormMode(false); setModeSheetOpen(false); }}>
                  <span className="pp-mode-icon">📖</span>
                  <span className="pp-mode-label">Elaborative</span>
                  <span className="pp-mode-desc">Deep prose, full analysis</span>
                </button>
                <button className={`pp-mode-btn ${brainstormMode ? 'active' : ''}`}
                  onClick={() => { setBrainstormMode((b) => !b); setModeSheetOpen(false); }}>
                  <span className="pp-mode-icon">💡</span>
                  <span className="pp-mode-label">Brainstorm</span>
                  <span className="pp-mode-desc">Essay plans & argument maps</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Citation modal */}
        {citationModal && (
          <div className="pp-cite-modal-bg" onClick={() => setCitationModal(null)}>
            <div className="pp-cite-modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>📖 Cited Passage{citationModal.length > 1 ? 's' : ''}</span>
                <button onClick={() => setCitationModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text3, #555)', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
              </div>
              {citationModal.map((s, si) => (
                <div key={si} style={{ marginBottom: si < citationModal.length - 1 ? '1rem' : 0, paddingBottom: si < citationModal.length - 1 ? '1rem' : 0, borderBottom: si < citationModal.length - 1 ? '1px solid rgba(99,102,241,0.12)' : 'none' }}>
                  <div style={{ display: 'inline-block', fontSize: '0.6rem', fontFamily: 'monospace', color: '#a5b4fc', background: 'rgba(99,102,241,0.15)', borderRadius: 4, padding: '0.15rem 0.5rem', marginBottom: '0.5rem' }}>{s.book_title}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text2, #aaa)', lineHeight: 1.75 }}>{cleanChunk(s.content) || 'Passage text unavailable.'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages ── */}
        <div className="pp-msgs">
          <div className="pp-msgs-inner">
            {messages.map((msg, i) => (
              <div key={i} className={`pp-msg-row ${msg.role}`} ref={msg.role === 'assistant' && i === messages.length - 1 ? lastAiRef : null}>
                <div className={msg.role === 'user' ? 'pp-bubble-user' : 'pp-bubble-ai'}>
                  {msg.role === 'user' ? (
                    <span>{msg.content}</span>
                  ) : msg.content === '__LIMIT_REACHED__' ? (
                    <div style={{ padding: '0.5rem 0' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.4rem' }}>You&apos;ve used your 3 free messages.</div>
                      <div style={{ fontSize: '0.83rem', color: 'var(--text3)', marginBottom: '1rem' }}>Upgrade to Distilled Crux Pro for unlimited access to all subjects.</div>
                      <a href="/pricing" style={{
                        display: 'inline-block',
                        background: 'var(--accent)',
                        color: '#fff',
                        textDecoration: 'none',
                        padding: '0.5rem 1.25rem',
                        borderRadius: 8,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-ui)',
                      }}>Upgrade to Pro →</a>
                    </div>
                  ) : msg.content === '' ? (
                    <span style={{ opacity: 0.4, fontFamily: 'monospace', fontSize: '0.8rem' }}>●●●</span>
                  ) : loading && i === messages.length - 1 ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitize(formatMessage(msg.content)) }} />
                  ) : (
                    <div
                      onClick={(e) => {
                        const target = (e.target as HTMLElement).closest('[data-citation]') as HTMLElement | null;
                        if (target && msg.sources) {
                          const indices = target.getAttribute('data-citation')!.split(',').map(Number);
                          const picked = indices.map((n) => msg.sources![n - 1]).filter(Boolean);
                          if (picked.length) setCitationModal(picked);
                        }
                      }}
                      dangerouslySetInnerHTML={{ __html: sanitize(formatMessage(msg.content, msg.sources?.length ?? 0)) }}
                    />
                  )}
                </div>
                {msg.sources && msg.sources.length > 0 && <SourcePassages sources={msg.sources} />}
                <div className={`pp-meta ${msg.role}`}>
                  {msg.role === 'assistant' ? (
                    <span className="pp-ai-badge"><span className="pp-ai-dot" />AI</span>
                  ) : (
                    <span className="pp-meta-label">You</span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="pp-typing">
                <div className="pp-typing-dots">
                  <div className="pp-typing-dot" /><div className="pp-typing-dot" /><div className="pp-typing-dot" />
                </div>
                <span className="pp-typing-text">Thinking…</span>
              </div>
            )}

            {messages.length <= 1 && (
              <div style={{ marginTop: '1.25rem' }}>
                <div className="pp-suggested-label">Try asking</div>
                <div className="pp-suggested-grid">
                  {(langHi ? suggestedHi : suggestedEn).map((q, i) => (
                    <button key={i} className="pp-suggested-btn" onClick={() => sendMessage(q)}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} style={{ height: 8 }} />
          </div>
        </div>

        {/* ── Input footer ── */}
        <div className="pp-footer">
          <div className="pp-input-area-wrap">
            {/* Desktop toolbar */}
            <div className="pp-toolbar">
              <button className="pp-tool-btn" onClick={() => setHistoryOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                History
              </button>
              <button className="pp-tool-btn" onClick={startNewChat}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New
              </button>
              <div className="pp-tool-divider" />
              <button
                className={`pp-tool-btn ${pdfFile ? 'active' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {pdfFile ? <>{pdfName} <span onClick={(e) => { e.stopPropagation(); setPdfFile(null); setPdfBase64(null); setPdfName(null); }} style={{ marginLeft: 4, opacity: 0.6, fontWeight: 'bold', cursor: 'pointer' }}>✕</span></> : 'PDF'}
              </button>
              <button className={`pp-tool-btn ${brainstormMode ? 'active' : ''}`} onClick={() => setBrainstormMode((b) => !b)}>
                💡 Brainstorm
              </button>
              <div style={{ position: 'relative' }}>
                <button className={`pp-tool-btn ${bookMode ? 'active' : ''}`} onClick={() => setBooksPopoverOpen((o) => !o)}>
                  📚 Books
                </button>
                {booksPopoverOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setBooksPopoverOpen(false)} />
                    <div className="pp-books-popover" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text2, #aaa)', fontWeight: 600 }}>Chat with Books</span>
                        <button className={`pp-books-toggle ${bookMode ? 'on' : 'off'}`} onClick={() => setBookMode((b) => !b)}>
                          <span className="pp-books-toggle-dot" style={{ left: bookMode ? 20 : 4 }} />
                        </button>
                      </div>
                      {bookMode && (
                        <select value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} className="pp-books-select">
                          <option value="all">📖 All Books</option>
                          {bookGroups.map((g) => (
                            <optgroup key={g.group} label={`── ${g.group} ──`}>
                              {g.books.map((b) => (
                                <option key={b.value} value={b.value}>{b.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Style toggle (desktop) */}
            {!brainstormMode && (
              <div className="pp-style-toggle">
                <span style={{ fontSize: '0.6rem', color: 'var(--text3, #555)', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Style</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--border, #1a1a2e)' }}>—</span>
                {(['concise', 'elaborative'] as const).map((s) => (
                  <button key={s} onClick={() => setResponseStyle(s)} style={{
                    fontSize: '0.68rem', fontFamily: 'monospace', letterSpacing: '0.04em',
                    padding: '3px 12px', borderRadius: 20,
                    border: responseStyle === s ? `1px solid ${s === 'concise' ? '#3b82f6' : '#8b5cf6'}` : '1px solid var(--border, #1a1a2e)',
                    background: responseStyle === s ? (s === 'concise' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)') : 'transparent',
                    color: responseStyle === s ? (s === 'concise' ? '#60a5fa' : '#a78bfa') : 'var(--text3, #555)',
                    cursor: 'pointer', transition: 'all 0.15s', fontWeight: responseStyle === s ? 600 : 400,
                  }}>
                    {s === 'concise' ? '⚡' : '📖'} {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* PDF strip */}
            {pdfFile && (
              <div className="pp-pdf-strip">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span className="pp-pdf-strip-name">{pdfName}</span>
                <span className="pp-pdf-strip-close" onClick={() => { setPdfFile(null); setPdfBase64(null); setPdfName(null); }}>✕</span>
              </div>
            )}

            {/* Mode pills (mobile) */}
            <div className="pp-mode-strip">
              <button className="pp-mode-pill" onClick={() => setHistoryOpen(true)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                History
              </button>
              <button className="pp-mode-pill" onClick={startNewChat}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New
              </button>
              <span style={{ width: 1, height: 14, background: 'var(--border, #1a1a2e)', flexShrink: 0, alignSelf: 'center' }} />
              <button className={`pp-mode-pill ${brainstormMode ? 'active' : ''}`} onClick={() => setModeSheetOpen(true)}>
                {activeModeLabel}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <button className={`pp-mode-pill ${bookMode ? 'active' : ''}`} onClick={() => setBooksPopoverOpen((o) => !o)}>
                📚 Books
              </button>
              <button className={`pp-mode-pill ${pdfFile ? 'active' : ''}`} onClick={() => fileInputRef.current?.click()}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PDF
              </button>
            </div>

            {/* Input row */}
            <div className="pp-input-row">
              <input
                ref={fileInputRef as React.RefObject<HTMLInputElement>}
                type="file" accept="application/pdf" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); (e.target as HTMLInputElement).value = ''; }}
              />
              <textarea
                ref={inputRef}
                className="pp-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={brainstormMode ? `Brainstorm a ${subjectDisplay} topic or question…` : pdfFile ? 'Ask about the PDF…' : `Ask me anything about ${subjectDisplay}…`}
                rows={1}
                onInput={(e) => {
                  const ta = e.currentTarget;
                  ta.style.height = 'auto';
                  ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
                }}
              />
              <button
                className={`pp-send-btn ${input.trim() && !loading ? 'active' : 'inactive'}`}
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
              >
                ↑
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '0.3rem', fontFamily: 'monospace', fontSize: '0.58rem', letterSpacing: '0.07em', color: 'var(--text3, #555)' }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--text2, #aaa)' }}>Loading…</div>}>
      <ChatContent />
    </Suspense>
  );
}