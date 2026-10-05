'use client';
import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { auth, signInWithGoogle } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import SidebarNotes from '@/components/SidebarNotes';
import Mascot from '@/components/Mascot';
import { rememberNote } from '@/lib/lastNote';

const SUBJECT_NAME: Record<string, string> = {
  sociology: 'Sociology', anthropology: 'Anthropology', polsci: 'PSIR', geography: 'Geography', 'pub-admin': 'Public Administration',
};

// Below this width the sidebar floats over the note instead of sitting beside it.
const FLOATING_QUERY = '(max-width: 1024px)';
const subscribeWidth = (cb: () => void) => {
  const mq = window.matchMedia(FLOATING_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

/** Minutes to read a note at an unhurried 200 words a minute. */
function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ── Current section ──────────────────────────────────────────
/**
 * The section being read: the last heading that has passed under the navbar.
 * An observer only hears about headings crossing its band, so a jump (End, a
 * tick on the rail) skipped them all and left the old one lit.
 */
function useActiveHeading(entries: { id: string }[]) {
  const [activeId, setActiveId] = useState('');
  useEffect(() => {
    if (!entries.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Looked up each time: highlighting re-renders the note, and a heading
      // held from before is detached and reports a top of 0.
      let id = entries[0].id;
      for (const { id: hid } of entries) {
        const el = document.getElementById(hid);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 130) id = hid; else break;
      }
      setActiveId(id);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [entries]);
  return activeId;
}

// ── Reading progress ─────────────────────────────────────────
/** A thin bar under the navbar that fills as the reader goes down the note. */
function ReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);
  return <div className="nr-progress" aria-hidden="true"><span style={{ transform: `scaleX(${pct})` }} /></div>;
}

// ── Scroll-direction hook ────────────────────────────────────
// ── Inject IDs into headings for TOC ────────────────────────
function injectHeadingIds(html: string): string {
  let h2count = 0;
  let h3count = 0;
  return html
    .replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_, attrs, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();
      const id = `toc-${h2count++}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
      return `<h2${attrs} id="${id}">${inner}</h2>`;
    })
    .replace(/<h3([^>]*)>([\s\S]*?)<\/h3>/gi, (_, attrs, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();
      const id = `toc-${h3count++}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
      return `<h3${attrs} id="${id}">${inner}</h3>`;
    });
}

type Highlight = { id: string; text: string; color: 'yellow' | 'green' | 'red' | 'blue' };

const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Gold',  color: '#c9a84c' },
  { id: 'green',  label: 'Mint',  color: '#4cad7a' },
  { id: 'red',    label: 'Rose',  color: '#c94c4c' },
  { id: 'blue',   label: 'Sky',   color: '#4c8bc9' },
];

// ── Note Search Hook ──────────────────────────────────────────
const MARK_CLASS = 'nsr-mark';
const CLONE_ID   = 'nsr-clone';

function useNoteSearch(containerRef: React.RefObject<HTMLElement | null>) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [current, setCurrent] = useState(0);
  const [total, setTotal]     = useState(0);
  const marksRef = useRef<HTMLElement[]>([]);
  const cloneRef = useRef<HTMLElement | null>(null);

  const teardown = useCallback(() => {
    document.getElementById(CLONE_ID)?.remove();
    if (containerRef.current) containerRef.current.style.display = '';
    cloneRef.current = null;
    marksRef.current = [];
  }, [containerRef]);

  const close = useCallback(() => {
    teardown();
    setOpen(false); setQuery(''); setTotal(0); setCurrent(0);
  }, [teardown]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); setOpen(o => !o || o); }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(CLONE_ID)?.remove();
    const container = containerRef.current;
    if (!container) return;
    const clone = container.cloneNode(true) as HTMLElement;
    clone.id = CLONE_ID; clone.style.cssText = container.style.cssText;
    container.parentNode?.insertBefore(clone, container.nextSibling);
    container.style.display = 'none';
    cloneRef.current = clone;
    return () => teardown();
  }, [open]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const tid = setTimeout(() => {
      const clone = cloneRef.current;
      if (!clone) return;
      clone.querySelectorAll(`mark.${MARK_CLASS}`).forEach(m => {
        m.parentNode?.replaceChild(document.createTextNode(m.textContent || ''), m);
      });
      clone.normalize();
      marksRef.current = [];
      if (!query || query.length < 2) { setTotal(0); setCurrent(0); return; }
      const q = query.toLowerCase();
      const marks: HTMLElement[] = [];
      const textNodes: Text[] = [];
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName?.toLowerCase() ?? '';
          if (['script','style','mark','textarea','input'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (!node.textContent?.toLowerCase().includes(q)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let n: Text | null;
      while ((n = walker.nextNode() as Text | null)) textNodes.push(n);
      for (const textNode of textNodes) {
        const text = textNode.textContent || '';
        const lower = text.toLowerCase();
        let idx = lower.indexOf(q);
        if (idx === -1) continue;
        const frag = document.createDocumentFragment();
        let last = 0;
        while (idx !== -1) {
          if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
          const mark = document.createElement('mark');
          mark.className = MARK_CLASS;
          mark.textContent = text.slice(idx, idx + query.length);
          mark.style.cssText = 'background:rgba(67,97,238,0.22);color:inherit;border-radius:2px;padding:0 2px;outline:1px solid rgba(67,97,238,0.4);';
          frag.appendChild(mark);
          marks.push(mark as HTMLElement);
          last = idx + query.length;
          idx = lower.indexOf(q, last);
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        textNode.parentNode?.replaceChild(frag, textNode);
      }
      marksRef.current = marks;
      setTotal(marks.length);
      if (marks.length > 0) {
        setCurrent(1);
        marks[0].style.background = 'rgba(67,97,238,0.85)';
        marks[0].style.color = '#fff';
        marks[0].style.outline = '2px solid #4361ee';
        window.scrollTo({ top: marks[0].getBoundingClientRect().top + window.scrollY - 170, behavior: 'smooth' });
      } else { setCurrent(0); }
    }, 280);
    return () => clearTimeout(tid);
  }, [query, open]);

  const jump = useCallback((dir: 1 | -1) => {
    const marks = marksRef.current;
    if (!marks.length) return;
    const prev = current - 1;
    const next = (prev + dir + marks.length) % marks.length;
    if (marks[prev]) { marks[prev].style.background = 'rgba(67,97,238,0.22)'; marks[prev].style.color = 'inherit'; marks[prev].style.outline = '1px solid rgba(67,97,238,0.4)'; }
    if (marks[next]) {
      marks[next].style.background = 'rgba(67,97,238,0.85)'; marks[next].style.color = '#fff'; marks[next].style.outline = '2px solid #4361ee';
      window.scrollTo({ top: marks[next].getBoundingClientRect().top + window.scrollY - 170, behavior: 'smooth' });
    }
    setCurrent(next + 1);
  }, [current]);

  return { open, setOpen, query, setQuery, current, total, jump, close };
}


// ── Main NoteReader ───────────────────────────────────────────
type NavLink = { slug: string; title: string } | null;

/**
 * The note, and its neighbours, come from the server. This used to import all
 * five subject indexes to work out prev/next, which shipped roughly 82KB of
 * every subject's note metadata to the browser on every note page to use one
 * subject's worth.
 */
// ── Table of Contents ─────────────────────────────────────────
function TableOfContents({ contentHtml }: { contentHtml: string }) {
  const [entries, setEntries] = useState<{ id: string; text: string; level: 2 | 3 }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml, 'text/html');
    const headings = doc.querySelectorAll('h2[id], h3[id]');
    const toc: { id: string; text: string; level: 2 | 3 }[] = [];
    headings.forEach(h => {
      const id = h.getAttribute('id') || '';
      const text = h.textContent?.trim() || '';
      if (id && text) toc.push({ id, text, level: h.tagName === 'H2' ? 2 : 3 });
    });
    setEntries(toc);
  }, [contentHtml]);

  const activeId = useActiveHeading(entries);

  if (!entries.length) return null;
  let h2i = 0;
  return (
    <div className={`nr-toc${open ? ' open' : ''}`}>
      <button type="button" className="nr-toc-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>On this page</span>
        <span className="nr-toc-count">{entries.filter(e => e.level === 2).length} sections</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nr-toc-chev" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <nav className="nr-toc-list">
          {entries.map(entry => {
            if (entry.level === 2) h2i++;
            const isActive = activeId === entry.id;
            return (
              <a key={entry.id} href={'#' + entry.id}
                className={`nr-toc-link${entry.level === 3 ? ' sub' : ''}${isActive ? ' on' : ''}`}
                onClick={e => {
                  e.preventDefault();
                  const el = document.getElementById(entry.id);
                  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
                }}
              >
                {entry.level === 2 && <span className="nr-toc-n">{h2i}</span>}
                <span>{entry.text}</span>
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}

// ── Sidebar contents ──────────────────────────────────────────
/** The same headings as the inline card, laid out for a 240px column. */
function SidebarTOC({ contentHtml, onNavigate }: { contentHtml: string; onNavigate?: () => void }) {
  const [entries, setEntries] = useState<{ id: string; text: string; level: 2 | 3 }[]>([]);

  useEffect(() => {
    const doc = new DOMParser().parseFromString(contentHtml, 'text/html');
    const out: { id: string; text: string; level: 2 | 3 }[] = [];
    doc.querySelectorAll('h2[id], h3[id]').forEach(h => {
      const id = h.getAttribute('id') || '';
      const text = h.textContent?.trim() || '';
      if (id && text) out.push({ id, text, level: h.tagName === 'H2' ? 2 : 3 });
    });
    setEntries(out);
  }, [contentHtml]);

  const activeId = useActiveHeading(entries);

  // A long list runs past the bottom of the panel; keep the current section
  // in view as the reader goes down the note.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const box = nav?.closest<HTMLElement>('.nr-sidebar-inner');
    const on = nav?.querySelector<HTMLElement>('.sb-toc-link.on');
    if (!box || !on) return;
    const b = on.getBoundingClientRect(), c = box.getBoundingClientRect();
    if (b.top < c.top + 40 || b.bottom > c.bottom - 40) box.scrollTop += b.top - c.top - c.height / 3;
  }, [activeId]);

  if (!entries.length) return null;
  return (
    <>
      <div className="sb-section-label as-heading"><span>Contents</span></div>
      <nav className="sb-toc" ref={navRef}>
        {entries.map(t => (
          <button
            key={t.id}
            type="button"
            className={'sb-toc-link' + (t.level === 3 ? ' sub' : '') + (activeId === t.id ? ' on' : '')}
            onClick={() => {
              // On a phone the panel covers the note and locks body scroll,
              // so it has to be dismissed before the jump can land. Two frames
              // lets the unlock commit first; on a desktop it is imperceptible.
              onNavigate?.();
              requestAnimationFrame(() => requestAnimationFrame(() => {
                const el = document.getElementById(t.id);
                if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
              }));
            }}
          >
            <span className="sb-toc-dot" />
            <span>{t.text}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

// ── Scroll rail ───────────────────────────────────────────────
/**
 * A reading rail down the right edge: one tick per heading, positioned where
 * that heading sits in the document, and a thumb showing how far down the
 * reader is. Clicking a tick jumps to its heading; clicking the thumb opens
 * the contents panel. Ported from the history platform.
 *
 * Hidden below 1024px, where the edge belongs to the scroll gesture and the
 * ticks would be smaller than a fingertip.
 */
function ScrollRail({ contentHtml, accent }: { contentHtml: string; accent: string }) {
  const [entries, setEntries] = useState<{ id: string; text: string; level: 2 | 3 }[]>([]);
  const [pct, setPct] = useState(0);
  const [open, setOpen] = useState(false);
  const [trackH, setTrackH] = useState(600);

  useEffect(() => {
    const doc = new DOMParser().parseFromString(contentHtml, 'text/html');
    const out: { id: string; text: string; level: 2 | 3 }[] = [];
    doc.querySelectorAll('h2[id], h3[id]').forEach(h => {
      const id = h.getAttribute('id') || '';
      const text = h.textContent?.trim() || '';
      if (id && text) out.push({ id, text, level: h.tagName === 'H2' ? 2 : 3 });
    });
    setEntries(out);
  }, [contentHtml]);

  useEffect(() => {
    const measure = () => setTrackH(window.innerHeight - 160);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    measure(); onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', measure); };
  }, []);

  const activeId = useActiveHeading(entries);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
  };

  if (!entries.length) return null;
  const THUMB = 46;
  const docH = typeof document !== 'undefined'
    ? document.documentElement.scrollHeight - window.innerHeight : 1;

  return (
    <div className="nr-rail" aria-hidden="true">
      <div className="nr-rail-track" style={{ height: trackH }}>
        {entries.map(t => {
          const el = typeof document !== 'undefined' ? document.getElementById(t.id) : null;
          const top = docH > 0 && el ? (el.offsetTop / docH) * (trackH - THUMB) : 0;
          const on = activeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className="nr-rail-tick"
              onClick={() => jump(t.id)}
              title={t.text}
              style={{
                top,
                width: t.level === 2 ? 9 : 5,
                height: t.level === 2 ? 2 : 1.5,
                left: t.level === 2 ? 2.5 : 4.5,
                background: on ? accent : `color-mix(in srgb, ${accent} ${t.level === 2 ? 45 : 22}%, transparent)`,
                boxShadow: on ? `0 0 6px ${accent}` : 'none',
              }}
            />
          );
        })}
        <button
          type="button"
          className="nr-rail-thumb"
          onClick={() => setOpen(o => !o)}
          title="Contents"
          style={{ top: pct * (trackH - THUMB), height: THUMB, background: accent,
                   boxShadow: `0 0 ${open ? 16 : 8}px color-mix(in srgb, ${accent} ${open ? 80 : 45}%, transparent)` }}
        >
          <span /><span /><span />
        </button>
      </div>

      {open && (
        <div className="nr-rail-panel" role="dialog" aria-label="Contents">
          <div className="nr-rail-panel-head">
            <span className="nr-rail-dot" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            <span className="nr-rail-panel-title" style={{ color: accent }}>On this page</span>
            <button type="button" className="nr-rail-close" onClick={() => setOpen(false)} aria-label="Close contents">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        
          <div className="nr-rail-progress">
            <div style={{ width: `${pct * 100}%`, background: accent, boxShadow: `0 0 8px ${accent}` }} />
          </div>
        
          <nav className="nr-rail-list" aria-label="Headings">
            {entries.map(t => {
              const on = activeId === t.id;
              return (
                <button key={t.id} type="button"
                  className={'nr-rail-link' + (t.level === 3 ? ' sub' : '') + (on ? ' on' : '')}
                  onClick={() => { jump(t.id); setOpen(false); }}
                  style={on ? { background: `color-mix(in srgb, ${accent} 12%, transparent)`, borderLeftColor: accent, color: accent } : undefined}>
                  <span className="nr-rail-bullet" style={{
                    background: on ? accent : `color-mix(in srgb, ${accent} ${t.level === 2 ? 40 : 25}%, transparent)`,
                    boxShadow: on ? `0 0 6px ${accent}` : 'none',
                  }} />
                  <span className="nr-rail-text">{t.text}</span>
                  <span className="nr-rail-arrow">→</span>
                </button>
              );
            })}
          </nav>
        
          <div className="nr-rail-foot">
            <span>READ</span>
            <span style={{ color: accent }}>{Math.round(pct * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NoteReader({
  slug, subject, initialContent = '', note, prev, next,
}: {
  slug: string;
  subject: string;
  initialContent?: string;
  note: {
    title: string;
    section: string;
    paper: 1 | 2;
    description: string;
    subtopics?: string[];
  };
  prev: NavLink;
  next: NavLink;
}) {
  const noteContentRef = useRef<HTMLDivElement>(null);
  const noteSearch = useNoteSearch(noteContentRef);

  // Open on a desktop, closed on a phone, where the sidebar would leave
  // nothing for the note itself. Until the reader picks, the width decides.
  // The server can't know the width, so it renders null and CSS applies the
  // default; guessing here put an open panel over the note on every phone
  // until the page hydrated, and then React threw the markup away.
  const [sidebarChoice, setSidebarOpen] = useState<boolean | null>(null);
  const wide = useSyncExternalStore(subscribeWidth, () => !window.matchMedia(FLOATING_QUERY).matches, () => null);
  const sidebarOpen = sidebarChoice ?? wide;

  // Below 1024px the sidebar floats over the note, which makes it a modal in
  // every way except history. Back was the instinctive way to dismiss it and
  // nothing was on the stack for it, so Back left the note altogether.
  // Opening pushes an entry; Back pops that entry and only closes the panel.
  const sidebarEntry = useRef(false);
  const floating = () =>
    typeof window !== 'undefined' && window.matchMedia(FLOATING_QUERY).matches;

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
    if (floating() && !sidebarEntry.current) {
      // Same URL, so popping it never moves the reader off the note.
      window.history.pushState({ nrSidebar: true }, '');
      sidebarEntry.current = true;
    }
  }, []);

  const closeSidebar = useCallback(() => {
    // Let the pop handler do the closing so the entry is always consumed,
    // otherwise it lingers and the next Back is swallowed doing nothing.
    if (sidebarEntry.current) window.history.back();
    else setSidebarOpen(false);
  }, []);

  useEffect(() => {
    const onPop = () => { sidebarEntry.current = false; setSidebarOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && floating()) closeSidebar();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
    };
  }, [closeSidebar]);

  // The note behind a floating sidebar should not scroll under it.
  useEffect(() => {
    if (!sidebarOpen || !floating()) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sidebarOpen]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedColor, setSelectedColor] = useState<'yellow'|'green'|'red'|'blue'>('yellow');
  const [showToolbar, setShowToolbar] = useState(false);
  const pendingTextRef = useRef('');
  const [selectionHighlighted, setSelectionHighlighted] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [annotationMode, setAnnotationMode] = useState<'highlight'|null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const processedContent = injectHeadingIds(initialContent);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); });
    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    try { await signInWithGoogle(); } catch (e) { console.error(e); }
  };

  // The dashboard offers to pick up here.
  useEffect(() => {
    rememberNote({ subject, slug, title: note.title, section: note.section, at: Date.now() });
  }, [subject, slug, note.title, note.section]);

  // Persist highlights to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pp-hl-${slug}`);
      if (saved) setHighlights(JSON.parse(saved));
    } catch {
      // localStorage throws in private browsing and when site data is blocked.
      // Highlights are a convenience, so the reader opens without them.
    }
  }, [slug]);

  useEffect(() => {
    try {
      localStorage.setItem(`pp-hl-${slug}`, JSON.stringify(highlights));
    } catch {
      // Same as above: storage may be unavailable or full. Nothing to recover.
    }
  }, [highlights, slug]);

  const handleMouseUp = useCallback(() => {
    if (annotationMode !== 'highlight') return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setShowToolbar(false); return; }
    const text = sel.toString().trim();
    if (!text) { setShowToolbar(false); return; }
    // Held because the click that picks a colour may have already collapsed
    // the selection by the time the handler runs.
    pendingTextRef.current = text;
    // Whether this selection lands on an existing highlight, which is what
    // decides if the toolbar offers to take one off.
    setSelectionHighlighted(highlights.some(h => h.text.includes(text) || text.includes(h.text)));
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setToolbarPos({ x: rect.left + rect.width / 2 + window.scrollX, y: rect.top + window.scrollY - 50 });
    setShowToolbar(true);
  }, [annotationMode, highlights]);

  /**
   * Pressing a colour used to read the selection back out of the document,
   * and by then there was none: mousedown on the button collapses it, so
   * every click fell out at the isCollapsed guard and nothing happened. The
   * text captured when the toolbar opened is what gets highlighted.
   */
  const applyHighlight = useCallback((color: 'yellow'|'green'|'red'|'blue') => {
    const sel = window.getSelection();
    const text = pendingTextRef.current || sel?.toString().trim() || '';
    if (!text) return;
    setHighlights(prev => [...prev, { id: Date.now().toString(), text, color }]);
    pendingTextRef.current = '';
    sel?.removeAllRanges();
    setShowToolbar(false);
  }, []);

  /** Take the highlight off whatever the selection covers. */
  const removeHighlight = useCallback(() => {
    const text = pendingTextRef.current || window.getSelection()?.toString().trim() || '';
    if (!text) return;
    setHighlights(prev => prev.filter(h => !(h.text.includes(text) || text.includes(h.text))));
    pendingTextRef.current = '';
    setSelectionHighlighted(false);
    window.getSelection()?.removeAllRanges();
    setShowToolbar(false);
  }, []);

  /**
   * Clicking a highlight while highlighting is on takes it off, which is the
   * shorter road than reselecting exactly the words that were marked. It is
   * inert while highlighting is off, so reading a note cannot rub one out by
   * accident.
   */
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    if (annotationMode !== 'highlight') return;
    const mark = (e.target as HTMLElement).closest('mark.pp-hl');
    const text = mark?.textContent?.trim();
    if (!text) return;
    setHighlights(prev => prev.filter(h => h.text !== text));
    setShowToolbar(false);
  }, [annotationMode]);

  /**
   * Paint the stored highlights back onto the rendered HTML.
   *
   * Only the text between tags is rewritten. Run over the whole string, the
   * match could just as easily land inside an attribute — highlighting the
   * word "style" or a stray number was enough to rewrite a tag and break the
   * markup for the rest of the note.
   */
  const applyHighlightsToContent = useCallback((html: string) => {
    let result = html;
    highlights.forEach(h => {
      const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const needle = new RegExp(escaped, 'g');
      // A class, not an inline colour: the wash has to follow the theme.
      const mark = `<mark class="pp-hl pp-hl-${h.color}">${h.text}</mark>`;
      result = result.replace(/>([^<]+)</g, (_m, text: string) => `>${text.replace(needle, mark)}<`);
    });
    return result;
  }, [highlights]);

  const displayContent = applyHighlightsToContent(processedContent);

  if (!note) {
    return (
      <div style={{ maxWidth: 760, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--text3)', fontSize: '0.9rem', fontWeight: 500 }}>Note not found.</div>
        <Link href={`/notes/${subject}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500 }}>← Back to {subject}</Link>
      </div>
    );
  }

  const subjectName = SUBJECT_NAME[subject] ?? subject;
  const minutes = readingMinutes(initialContent);
  const tint = { ['--t' as string]: `var(--tint-${subject})`, ['--w' as string]: `var(--wash-${subject})` };
  const gated = !user && !authLoading && Boolean(displayContent);

  return (
    <div className={'nr-shell ds' + (sidebarOpen === null ? ' sb-auto' : sidebarOpen ? ' with-sidebar' : '')} style={tint}>
      <style>{NR_CSS}</style>
      <ReadingProgress />

      {/* ── Sidebar ── */}
      {/* Tap-anywhere-else to dismiss, which the floating panel never had. */}
      <div className="nr-backdrop" onClick={closeSidebar} aria-hidden="true" />
      <aside className="nr-sidebar" aria-label="Note sidebar">
        <div className="nr-sidebar-inner">
          {/* The header toggle scrolls out of reach on a phone, so the panel
              carries its own close control. */}
          <button type="button" className="nr-sb-close" onClick={closeSidebar} aria-label="Close sidebar">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
          {/* Where the reader is: subject and paper, then the note itself. */}
          <div className="sb-head">
            <span className="sb-chip">
              <span className="sb-chip-dot" />
              {subjectName} · Paper {note.paper === 1 ? 'I' : 'II'}
            </span>
            <h2 className="sb-title">{note.title}</h2>
            <p className="sb-sub">{note.section}</p>
          </div>

          {processedContent && (
            <SidebarTOC
              contentHtml={processedContent}
              onNavigate={() => { if (floating()) closeSidebar(); }}
            />
          )}

          {(prev || next) && (
            <>
              <div className="sb-section-label as-heading"><span>Before and after</span></div>
              <nav className="sb-related">
                {prev && (
                  <Link className="sb-rel" href={`/notes/${subject}/${prev.slug}`}>
                    <span className="sb-rel-dir">Previous</span>
                    <span className="sb-rel-title">{prev.title}</span>
                  </Link>
                )}
                {next && (
                  <Link className="sb-rel" href={`/notes/${subject}/${next.slug}`}>
                    <span className="sb-rel-dir">Next</span>
                    <span className="sb-rel-title">{next.title}</span>
                  </Link>
                )}
              </nav>
            </>
          )}

          <SidebarNotes subject={subject} slug={slug} />
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="nr-main">

      {/* ── Toolbar ──
            One row. It scrolls away with the note; the sidebar is what stays. */}
      <div className="nr-bar">
        <button type="button" className={`nr-pill nr-sb-toggle${sidebarOpen ? ' on' : ''}`}
          onClick={() => (sidebarOpen ?? !floating() ? closeSidebar() : openSidebar())}
          aria-expanded={sidebarOpen ?? undefined}
          title="Show or hide the contents">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1.8" y="2.5" width="12.4" height="11" rx="1.6" />
            <line x1="6.3" y1="2.5" x2="6.3" y2="13.5" />
          </svg>
          <span>Contents</span>
        </button>

        <nav className="nr-crumbs" aria-label="Breadcrumb">
          <Link href="/notes">Notes</Link>
          <span aria-hidden="true">›</span>
          <Link href={`/notes/${subject}`}>{subjectName}</Link>
        </nav>

        <div className="nr-bar-actions">
          <button type="button"
            className={`nr-pill${annotationMode === 'highlight' ? ' on gold' : ''}`}
            onClick={() => setAnnotationMode(m => m === 'highlight' ? null : 'highlight')}
            aria-pressed={annotationMode === 'highlight'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span>{annotationMode === 'highlight' ? 'Highlighting' : 'Highlight'}</span>
          </button>
          <Link className="nr-pill accent" href={`/chat?topic=${encodeURIComponent(note.title)}&subject=${subject}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Ask the AI</span>
          </Link>
        </div>
      </div>

      {/* ── Highlight colours (when highlighting) ── */}
      {annotationMode === 'highlight' && (
        <div className="nr-hlbar">
          <span className="nr-hlbar-label">Select some text, then pick a colour.</span>
          <div className="nr-hlbar-colours">
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c.id} type="button" onClick={() => setSelectedColor(c.id as typeof selectedColor)}
                className={`nr-swatch${selectedColor === c.id ? ' on' : ''}`}
                style={{ ['--sw' as string]: c.color }} title={c.label} aria-label={c.label} />
            ))}
          </div>
          {highlights.length > 0 && <span className="nr-hlbar-note">Tap a highlight to remove it.</span>}
          {highlights.length > 0 && (
            <button type="button" className="nr-hlbar-clear" onClick={() => { if (confirm('Clear all highlights?')) setHighlights([]); }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Floating highlight toolbar ── */}
      {showToolbar && (
        <div className="nr-float" style={{ left: toolbarPos.x, top: toolbarPos.y }}>
          {HIGHLIGHT_COLORS.map(c => (
            <button key={c.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => applyHighlight(c.id as typeof selectedColor)}
              title={c.label} aria-label={`Highlight in ${c.label}`} className="nr-float-swatch" style={{ ['--sw' as string]: c.color }} />
          ))}
          {selectionHighlighted && (
            <>
              <span className="nr-float-rule" />
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={removeHighlight} title="Remove highlight" aria-label="Remove highlight" className="nr-float-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 20H9L4 15a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-7 7"/><path d="M6 13l6 6"/>
                </svg>
              </button>
            </>
          )}
          <span className="nr-float-rule" />
          <button type="button" onClick={() => setShowToolbar(false)} className="nr-float-btn" aria-label="Close">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {processedContent && <ScrollRail contentHtml={processedContent} accent="var(--t)" />}

      {/* ── Content ── */}
      <div className="nr-content" onMouseUp={handleMouseUp}>
        <article className="nr-article">
          <header className="nr-head">
            <div className="nr-meta">
              <span className="nr-paper">Paper {note.paper === 1 ? 'I' : 'II'}</span>
              <span>{note.section}</span>
              {initialContent && <span>{minutes} min read</span>}
            </div>
            <h1 className="nr-title">{note.title}</h1>
            <p className="nr-desc">{note.description}</p>
            {note.subtopics && note.subtopics.length > 0 && (
              <div className="nr-subs">
                {note.subtopics.map(st => <span key={st}>{st}</span>)}
              </div>
            )}
          </header>

          {processedContent && <TableOfContents contentHtml={processedContent} />}

          {/* Note body */}
          <div className="nr-body">
            <div ref={noteContentRef} className="note-content"
              onClick={handleContentClick}
              dangerouslySetInnerHTML={{ __html: displayContent || '<p class="nr-empty">These notes are on their way. Check back soon.</p>' }}
              style={gated ? { maxHeight: '140vh', overflow: 'hidden', pointerEvents: 'none', userSelect: 'none' } : undefined}
            />

            {/* Sign-in gate (only if there's actual content) */}
            {gated && (
              <div className="nr-gate">
                <div className="nr-gate-card">
                  <Mascot pose="reading" width={76} />
                  <div className="nr-gate-title">Sign in to keep reading</div>
                  <p>A free account opens the whole note, and keeps your highlights and notes with you.</p>
                  <button type="button" onClick={handleSignIn} className="ds-btn ds-btn-solid nr-gate-btn">Sign in free</button>
                </div>
              </div>
            )}
          </div>

          {/* A way on from the end of the note */}
          {!gated && displayContent && (
            <Link href={`/chat?topic=${encodeURIComponent(note.title)}&subject=${subject}`} className="nr-ask">
              <span className="nr-ask-text">
                <strong>Still unsure about something here?</strong>
                <span>Ask the {subjectName} AI. It answers from the standard books and shows you the page.</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          )}

          {/* Prev / Next */}
          {(prev || next) && (
            <nav className="nr-pager" aria-label="More notes">
              {prev ? (
                <Link href={`/notes/${subject}/${prev.slug}`} className="nr-pager-link">
                  <span className="nr-pager-dir">← Previous</span>
                  <span className="nr-pager-title">{prev.title}</span>
                </Link>
              ) : <span />}
              {next ? (
                <Link href={`/notes/${subject}/${next.slug}`} className="nr-pager-link next">
                  <span className="nr-pager-dir">Next →</span>
                  <span className="nr-pager-title">{next.title}</span>
                </Link>
              ) : <span />}
            </nav>
          )}
        </article>
      </div>

      {/* ── Find in note ── */}
      {noteSearch.open && (
        <div className="nr-find-panel">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: 'var(--text3)', flexShrink: 0 }}>
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="M14.5 14.5L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input autoFocus value={noteSearch.query} onChange={e => noteSearch.setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') noteSearch.jump(e.shiftKey ? -1 : 1); if (e.key === 'Escape') noteSearch.close(); }}
            placeholder="Find in this note"
            aria-label="Find in this note"
          />
          {noteSearch.total > 0 && (
            <span className="nr-find-count">{noteSearch.current} of {noteSearch.total}</span>
          )}
          {noteSearch.query.length >= 2 && noteSearch.total === 0 && (
            <span className="nr-find-none">Not found</span>
          )}
          <div className="nr-find-nav">
            <button type="button" onClick={() => noteSearch.jump(-1)} disabled={noteSearch.total === 0} title="Previous (Shift+Enter)" aria-label="Previous match" className="nr-find-step">↑</button>
            <button type="button" onClick={() => noteSearch.jump(1)} disabled={noteSearch.total === 0} title="Next (Enter)" aria-label="Next match" className="nr-find-step">↓</button>
          </div>
          <button type="button" onClick={noteSearch.close} className="nr-find-esc" aria-label="Close">✕</button>
        </div>
      )}

      {!noteSearch.open && !gated && (
        <button type="button" onClick={() => noteSearch.setOpen(true)} title="Find in this note (⌘F)" className="nr-find-fab">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2"/><path d="M14.5 14.5L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          <span>Find</span>
          <kbd>⌘F</kbd>
        </button>
      )}
      </div>
    </div>
  );
}

const NR_CSS = `
/* Highlights. The user-agent style for mark sets a black text colour, so
   colour is inherited from the prose, and each theme gets its own alpha: a
   tint that reads as a highlight on white reads as mud on near-black. */
.note-content mark.pp-hl { color: inherit; border-radius: 3px; padding: 0 1px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.note-content mark.pp-hl-yellow { background: rgba(201,168,76,0.30); }
.note-content mark.pp-hl-green  { background: rgba(76,173,122,0.30); }
.note-content mark.pp-hl-red    { background: rgba(201,76,76,0.32); }
.note-content mark.pp-hl-blue   { background: rgba(76,139,201,0.32); }
[data-theme="light"] .note-content mark.pp-hl-yellow { background: rgba(201,168,76,0.42); }
[data-theme="light"] .note-content mark.pp-hl-green  { background: rgba(76,173,122,0.36); }
[data-theme="light"] .note-content mark.pp-hl-red    { background: rgba(201,76,76,0.30); }
[data-theme="light"] .note-content mark.pp-hl-blue   { background: rgba(76,139,201,0.32); }

/* ── The note's own type ── */
.note-content { font-size: 1.06rem; line-height: 1.8; color: var(--text); overflow-wrap: break-word; }
.note-content h1 { font-size: 1.7rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; margin: 2.4rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--t); }
.note-content h2 { font-size: 1.42rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.3; margin: 2.8rem 0 0.9rem; padding-left: 14px; border-left: 4px solid var(--t); scroll-margin-top: 90px; }
.note-content h3 { font-size: 1.14rem; font-weight: 700; line-height: 1.4; color: var(--t); margin: 1.9rem 0 0.6rem; scroll-margin-top: 90px; }
.note-content h4 { font-size: 1.02rem; font-weight: 700; line-height: 1.45; color: var(--text); margin: 1.5rem 0 0.4rem; }
.note-content p { margin: 0 0 1rem; }
.note-content > :first-child { margin-top: 0; }
.note-content ul, .note-content ol { margin: 0.4rem 0 1.1rem 1.4rem; padding: 0; }
/* .ds clears list styles for its own lists; the note's are real lists. */
.note-content ul { list-style: disc; }
.note-content ol { list-style: decimal; }
.note-content ul ul { list-style: circle; }
.note-content li { margin-bottom: 0.45rem; }
.note-content li::marker { color: var(--t); }
.note-content ul ul, .note-content ol ol { margin-top: 0.3rem; margin-bottom: 0.3rem; }
.note-content strong { font-weight: 700; }
.note-content em { color: var(--text2); }
.note-content a { color: var(--accent-text); }
.note-content blockquote { margin: 1.6rem 0; padding: 1rem 1.25rem; background: var(--w); border-left: 4px solid var(--t); border-radius: 0 12px 12px 0; color: var(--text); }
.note-content blockquote p:last-child { margin-bottom: 0; }
.note-content table { display: block; width: 100%; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 1.8rem 0; font-size: 0.92rem; border: 1px solid var(--border2); border-radius: 12px; }
.note-content table > * { display: table; width: 100%; }
.note-content th { background: var(--ds-soft); padding: 0.7rem 1rem; text-align: left; font-weight: 700; border-bottom: 1px solid var(--border2); }
.note-content td { padding: 0.65rem 1rem; border-top: 1px solid var(--border); vertical-align: top; line-height: 1.65; }
.note-content tr:nth-child(even) td { background: color-mix(in srgb, var(--ds-soft) 60%, transparent); }
.note-content hr { border: none; border-top: 1px solid var(--border2); margin: 2.5rem 0; }
.note-content mark { background: rgba(201,168,76,0.28); color: inherit; border-radius: 3px; padding: 0 1px; }
.nr-empty { color: var(--text3); }

/* ── Reading progress ── */
.nr-progress { position: fixed; top: 60px; left: 0; right: 0; height: 3px; z-index: 101; pointer-events: none; }
.nr-progress span { display: block; height: 100%; background: var(--t); transform-origin: left; transition: transform 0.1s linear; }

/* ── Shell: a sidebar that collapses to nothing, and the note ── */
.nr-shell { display: flex; align-items: flex-start; width: 100%; padding: 0 0 5rem; background: var(--bg); }
.nr-main { flex: 1; min-width: 0; }
.nr-sidebar {
  width: 0; min-width: 0; flex-shrink: 0;
  position: sticky; top: 60px; height: calc(100vh - 60px);
  overflow: hidden; background: var(--ds-soft); border-right: 1px solid transparent;
  transition: width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1), border-color 0.25s;
}
.nr-shell.with-sidebar .nr-sidebar { width: 268px; min-width: 268px; border-right-color: var(--border); }
/* Before hydration, and until the reader toggles it: open beside the note on
   a desktop, closed on anything narrower. */
@media (min-width: 1025px) {
  .nr-shell.sb-auto .nr-sidebar { width: 268px; min-width: 268px; border-right-color: var(--border); }
  .nr-shell.sb-auto .nr-sb-toggle { color: var(--t); border-color: color-mix(in srgb, var(--t) 40%, transparent); background: var(--w); }
}
.nr-sidebar-inner { height: 100%; overflow-y: auto; overscroll-behavior: contain; padding: var(--space-5) var(--space-4) var(--space-10); width: 268px; }
.nr-backdrop { display: none; }
.nr-sb-close { display: none; position: absolute; top: 0.7rem; right: 0.7rem; z-index: 2; width: 32px; height: 32px; align-items: center; justify-content: center; background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-full); color: var(--text2); cursor: pointer; }
@media (max-width: 1024px) {
  .nr-sidebar { position: fixed; top: 60px; left: 0; z-index: 120; height: calc(100vh - 60px); width: 0; }
  .nr-shell.with-sidebar .nr-sidebar { width: 300px; min-width: 300px; max-width: 86vw; box-shadow: var(--elev-3); }
  .nr-sidebar-inner { width: 300px; max-width: 86vw; padding-top: 3rem; }
  .nr-sb-close { display: inline-flex; }
  .nr-shell.with-sidebar .nr-backdrop { display: block; position: fixed; inset: 0; z-index: 110; background: color-mix(in srgb, var(--bg) 55%, transparent); -webkit-tap-highlight-color: transparent; }
}

/* ── Sidebar contents ── */
.sb-head { padding-bottom: var(--space-4); margin-bottom: var(--space-2); border-bottom: 1px solid var(--border); }
.sb-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 8px; border-radius: var(--radius-full); background: var(--ds-card); border: 1px solid var(--border); font-size: 0.74rem; font-weight: 600; color: var(--text2); }
.sb-chip-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--t); flex-shrink: 0; }
.sb-title { font-size: 1.02rem; font-weight: 800; letter-spacing: -0.01em; line-height: 1.3; margin: var(--space-3) 0 var(--space-1); }
.sb-sub { font-size: 0.8rem; color: var(--text3); margin: 0; line-height: 1.4; }
.sb-section-label {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  background: none; border: none; cursor: pointer; padding: 0; margin: var(--space-5) 0 var(--space-2);
  font-size: 0.74rem; font-weight: 700; color: var(--text3);
}
.sb-section-label.as-heading { cursor: default; }
.sb-section-label:hover { color: var(--text2); }
.sb-toc { display: flex; flex-direction: column; gap: 1px; }
.sb-toc-link {
  display: flex; align-items: flex-start; gap: 8px; width: 100%; text-align: left;
  background: none; border: none; border-radius: var(--radius-md); cursor: pointer;
  padding: 6px 8px; font-size: 0.85rem; line-height: 1.4; color: var(--text2);
  transition: background 0.15s, color 0.15s;
}
.sb-toc-link.sub { font-size: 0.8rem; color: var(--text3); padding-left: 22px; }
.sb-toc-link:hover { background: var(--ds-card); color: var(--text); }
.sb-toc-link.on { background: var(--w); color: var(--t); font-weight: 600; }
.sb-toc-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; margin-top: 0.5rem; background: var(--border3); }
.sb-toc-link.sub .sb-toc-dot { width: 4px; height: 4px; }
.sb-toc-link.on .sb-toc-dot, .sb-toc-link:hover .sb-toc-dot { background: var(--t); }
.sb-related { display: flex; flex-direction: column; gap: 6px; }
.sb-rel { display: block; text-decoration: none; background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 10px; transition: border-color 0.15s; }
.sb-rel:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); }
.sb-rel-dir { display: block; font-size: 0.72rem; font-weight: 600; color: var(--text3); margin-bottom: 2px; }
.sb-rel-title { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text); line-height: 1.35; }

/* ── Scratch notes (components/SidebarNotes) ── */
.sb-note-add { width: 100%; display: flex; align-items: center; gap: 6px; background: none; border: 1.5px dashed color-mix(in srgb, var(--accent) 35%, transparent); border-radius: var(--radius-md); padding: 8px 10px; font-size: 0.84rem; color: var(--accent-text); cursor: pointer; margin-bottom: var(--space-2); transition: background 0.15s, border-color 0.15s; }
.sb-note-add:hover { background: var(--accent-dim); border-style: solid; }
.sb-note { background: color-mix(in srgb, var(--premium-text) 6%, var(--ds-card)); border: 1px solid color-mix(in srgb, var(--premium-text) 22%, transparent); border-radius: var(--radius-md); padding: 10px; margin-bottom: var(--space-2); transition: border-color 0.15s, box-shadow 0.15s; }
.sb-note:focus-within { border-color: color-mix(in srgb, var(--premium-text) 50%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--premium-text) 12%, transparent); }
.sb-note-title, .sb-note-body { width: 100%; background: none; border: none; outline: none; color: var(--text); padding: 0; resize: none; font-family: var(--font-ui); }
.sb-note-title { font-size: 0.88rem; font-weight: 700; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid color-mix(in srgb, var(--premium-text) 15%, transparent); }
.sb-note-body { font-size: 0.84rem; line-height: 1.6; min-height: 2.8em; }
.sb-note-title::placeholder, .sb-note-body::placeholder { color: var(--text3); font-weight: 400; }
.sb-note-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 6px; font-size: 0.72rem; color: var(--text3); opacity: 0; transition: opacity 0.15s; }
.sb-note:hover .sb-note-foot, .sb-note:focus-within .sb-note-foot { opacity: 1; }
@media (hover: none) { .sb-note-foot { opacity: 1; } }
.sb-note-foot button { background: none; border: none; padding: 0; font: inherit; color: var(--text3); cursor: pointer; }
.sb-note-foot button:hover { color: var(--danger-text); }
.sb-note-confirm { display: flex; gap: 10px; }
.sb-note-confirm button:first-child { color: var(--danger-text); font-weight: 700; }

/* ── Toolbar ── */
.nr-bar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2) var(--space-3); padding: var(--space-3) var(--space-6); border-bottom: 1px solid var(--border); }
.nr-pill {
  display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 var(--space-3);
  border-radius: var(--radius-full); border: 1px solid var(--border2); background: var(--ds-card);
  color: var(--text2); font-size: 0.86rem; font-weight: 600; text-decoration: none; cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.nr-pill:hover { color: var(--text); border-color: var(--border3); }
.nr-pill.on { color: var(--t); border-color: color-mix(in srgb, var(--t) 40%, transparent); background: var(--w); }
.nr-pill.on.gold { color: var(--premium-text); border-color: color-mix(in srgb, var(--premium-text) 40%, transparent); background: var(--premium-wash); }
.nr-pill.accent { color: var(--accent-text); border-color: color-mix(in srgb, var(--accent) 35%, transparent); background: var(--accent-dim); }
.nr-crumbs { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 0.86rem; color: var(--text3); }
.nr-crumbs a { color: var(--text2); text-decoration: none; white-space: nowrap; }
.nr-crumbs a:hover { color: var(--accent-text); }
.nr-bar-actions { margin-left: auto; display: flex; align-items: center; gap: var(--space-2); }

/* ── Highlight colours ── */
.nr-hlbar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2) var(--space-4); padding: var(--space-3) var(--space-6); border-bottom: 1px solid var(--border); background: var(--premium-wash); font-size: 0.86rem; color: var(--text2); }
.nr-hlbar-colours { display: flex; gap: 8px; }
.nr-swatch { width: 22px; height: 22px; border-radius: 50%; background: var(--sw); border: 2px solid var(--bg); box-shadow: 0 0 0 1px var(--border2); cursor: pointer; transition: transform 0.12s; }
.nr-swatch:hover { transform: scale(1.12); }
.nr-swatch.on { box-shadow: 0 0 0 2px var(--sw); }
.nr-hlbar-note { color: var(--text3); }
.nr-hlbar-clear { margin-left: auto; background: none; border: 1px solid var(--border2); border-radius: var(--radius-full); padding: 3px 12px; font-size: 0.8rem; color: var(--text2); cursor: pointer; }
.nr-float {
  position: absolute; transform: translateX(-50%); z-index: 200;
  display: flex; align-items: center; gap: 6px; padding: 6px 8px;
  background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-full); box-shadow: var(--elev-3);
}
.nr-float-swatch { width: 22px; height: 22px; border-radius: 50%; background: var(--sw); border: none; cursor: pointer; transition: transform 0.12s; }
.nr-float-swatch:hover { transform: scale(1.2); }
.nr-float-rule { width: 1px; height: 16px; background: var(--border2); }
.nr-float-btn { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 50%; background: none; color: var(--text3); cursor: pointer; }
.nr-float-btn:hover { color: var(--text); background: var(--ds-soft); }

/* ── The note ── */
.nr-content { padding: var(--space-8) var(--space-6) 0; }
.nr-article { max-width: 740px; margin: 0 auto; }
.nr-head { margin-bottom: var(--space-6); }
.nr-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font-size: 0.86rem; color: var(--text3); margin-bottom: var(--space-3); }
.nr-paper { padding: 2px 10px; border-radius: var(--radius-full); background: var(--w); color: var(--t); font-weight: 700; }
.nr-title { font-size: clamp(1.9rem, 4.2vw, 2.6rem); font-weight: 800; line-height: 1.15; letter-spacing: -0.03em; margin: 0 0 var(--space-3); }
.nr-desc { font-size: 1.08rem; line-height: 1.65; color: var(--text2); margin: 0 0 var(--space-4); }
.nr-subs { display: flex; flex-wrap: wrap; gap: 6px; }
.nr-subs span { padding: 3px 11px; border-radius: var(--radius-full); border: 1px solid var(--border); background: var(--ds-card); font-size: 0.8rem; color: var(--text2); }

.nr-toc { margin: 0 0 var(--space-6); border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--ds-card); overflow: hidden; }
.nr-toc-toggle { width: 100%; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border: none; background: none; cursor: pointer; font-size: 0.95rem; font-weight: 700; color: var(--text); text-align: left; }
.nr-toc-count { margin-left: auto; font-size: 0.82rem; font-weight: 500; color: var(--text3); }
.nr-toc-chev { color: var(--text3); transition: transform 0.2s; }
.nr-toc.open .nr-toc-chev { transform: rotate(180deg); }
.nr-toc-list { display: flex; flex-direction: column; gap: 1px; padding: 0 var(--space-2) var(--space-3); border-top: 1px solid var(--border); padding-top: var(--space-2); }
.nr-toc-link { display: flex; align-items: baseline; gap: 10px; padding: 6px 10px; border-radius: var(--radius-md); color: var(--text2); text-decoration: none; font-size: 0.92rem; line-height: 1.45; }
.nr-toc-link:hover { background: var(--ds-soft); color: var(--text); }
.nr-toc-link.sub { padding-left: 38px; font-size: 0.86rem; color: var(--text3); }
.nr-toc-link.on { color: var(--t); font-weight: 600; }
/* With the sidebar open beside the note, its list already does this job. */
@media (min-width: 1025px) { .nr-shell.with-sidebar .nr-toc, .nr-shell.sb-auto .nr-toc { display: none; } }
.nr-toc-n { min-width: 18px; font-size: 0.8rem; font-weight: 700; color: var(--t); }

.nr-body { position: relative; }
.nr-gate { position: absolute; bottom: 0; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; padding: 7rem 0 2.5rem; background: linear-gradient(to bottom, transparent 0%, var(--bg) 40%); pointer-events: auto; }
.nr-gate-card { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); max-width: 380px; padding: var(--space-6); text-align: center; background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-xl); box-shadow: var(--elev-3); }
.nr-gate-title { font-size: 1.15rem; font-weight: 800; }
.nr-gate-card p { margin: 0 0 var(--space-2); font-size: 0.92rem; line-height: 1.55; color: var(--text2); }
.nr-gate-btn { width: 100%; }

.nr-ask { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); margin-top: var(--space-10); padding: var(--space-4) var(--space-5); border-radius: var(--radius-xl); background: var(--accent-dim); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent); color: var(--accent-text); text-decoration: none; transition: transform 0.15s; }
.nr-ask:hover { transform: translateY(-1px); }
.nr-ask svg { flex-shrink: 0; }
.nr-ask-text { display: flex; flex-direction: column; gap: 2px; }
.nr-ask-text strong { color: var(--text); font-size: 1rem; }
.nr-ask-text span { color: var(--text2); font-size: 0.92rem; }

.nr-pager { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-6); }
.nr-pager-link { display: flex; flex-direction: column; gap: 4px; padding: var(--space-4) var(--space-5); border-radius: var(--radius-xl); border: 1px solid var(--border); background: var(--ds-card); text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s; }
.nr-pager-link:hover { border-color: color-mix(in srgb, var(--t) 45%, transparent); box-shadow: var(--elev-1); }
.nr-pager-link.next { text-align: right; align-items: flex-end; }
.nr-pager-dir { font-size: 0.82rem; font-weight: 600; color: var(--t); }
.nr-pager-title { font-size: 1rem; font-weight: 700; color: var(--text); line-height: 1.35; }

/* ── Scroll rail (desktop) ── */
.nr-rail { display: none; }
@media (min-width: 1024px) { .nr-rail { display: block; } }
.nr-rail-track { position: fixed; right: 0; top: 96px; width: 14px; z-index: 90; background: var(--ds-soft); border-left: 1px solid var(--border); }
.nr-rail-tick { position: absolute; padding: 0; border: none; border-radius: 2px; cursor: pointer; transition: background 0.2s, box-shadow 0.2s, transform 0.15s; }
.nr-rail-tick:hover { transform: scaleX(1.6); }
.nr-rail-thumb { position: absolute; left: 3px; width: 8px; border: none; border-radius: 6px; cursor: pointer; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; transition: box-shadow 0.2s; }
.nr-rail-thumb span { width: 4px; height: 1px; background: rgba(255,255,255,0.75); border-radius: 1px; }
@keyframes nrPanelIn { from { opacity: 0; transform: translateX(12px) scale(0.97); } to { opacity: 1; transform: none; } }
.nr-rail-panel { position: fixed; right: 24px; top: 88px; width: 290px; z-index: 91; background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--elev-3); animation: nrPanelIn 0.18s cubic-bezier(0.4,0,0.2,1); }
.nr-rail-panel-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px 10px; border-bottom: 1px solid var(--border); }
.nr-rail-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.nr-rail-panel-title { flex: 1; font-size: 0.86rem; font-weight: 700; }
.nr-rail-close { background: none; border: none; color: var(--text3); cursor: pointer; padding: 4px; display: flex; line-height: 0; border-radius: 50%; }
.nr-rail-close:hover { color: var(--text); background: var(--ds-soft); }
.nr-rail-progress { height: 3px; background: var(--ds-soft); }
.nr-rail-progress div { height: 100%; transition: width 0.1s; }
.nr-rail-list { max-height: calc(100vh - 230px); overflow-y: auto; padding: 6px 0; }
.nr-rail-link { width: 100%; display: flex; align-items: center; gap: 8px; background: none; border: none; border-left: 2px solid transparent; cursor: pointer; text-align: left; padding: 8px 14px; color: var(--text); font-size: 0.86rem; font-weight: 500; transition: background 0.15s, color 0.15s; }
.nr-rail-link.sub { padding: 6px 14px 6px 26px; font-size: 0.8rem; font-weight: 400; color: var(--text2); }
.nr-rail-link:hover { background: var(--ds-soft); }
.nr-rail-bullet { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.nr-rail-link.sub .nr-rail-bullet { width: 4px; height: 4px; }
.nr-rail-text { flex: 1; line-height: 1.4; }
.nr-rail-arrow { font-size: 0.75rem; opacity: 0; transition: opacity 0.15s, transform 0.15s; color: var(--text3); }
.nr-rail-link:hover .nr-rail-arrow { opacity: 1; transform: translateX(3px); }
.nr-rail-foot { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-top: 1px solid var(--border); font-size: 0.78rem; color: var(--text3); }
.nr-rail-foot span:last-child { font-weight: 700; }

/* ── Find in note ── */
.nr-find-panel {
  position: fixed; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); right: 24px; z-index: 300;
  display: flex; align-items: center; gap: 8px; min-width: 320px; max-width: calc(100vw - 32px);
  padding: 8px 8px 8px 14px; background: var(--ds-card); border: 1.5px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: var(--radius-full); box-shadow: var(--elev-3);
}
.nr-find-panel input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: var(--text); font-size: 0.95rem; }
.nr-find-count { font-size: 0.8rem; font-weight: 600; white-space: nowrap; color: var(--accent-text); background: var(--accent-dim); padding: 2px 10px; border-radius: var(--radius-full); }
.nr-find-none { font-size: 0.8rem; color: var(--danger-text); white-space: nowrap; }
.nr-find-nav { display: flex; gap: 2px; }
.nr-find-step, .nr-find-esc { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 50%; background: var(--ds-soft); color: var(--text2); cursor: pointer; font-size: 0.85rem; }
.nr-find-step:disabled { opacity: 0.4; cursor: default; }
.nr-find-fab {
  position: fixed; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); right: 24px; z-index: 299;
  display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px;
  background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-full);
  color: var(--text2); font-size: 0.86rem; font-weight: 600; cursor: pointer; box-shadow: var(--elev-2);
  transition: border-color 0.15s, color 0.15s;
}
.nr-find-fab:hover { color: var(--accent-text); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.nr-find-fab kbd { font-family: var(--font-ui); font-size: 0.72rem; color: var(--text3); padding: 1px 7px; border: 1px solid var(--border2); border-radius: var(--radius-full); }
@media (min-width: 1024px) { .nr-find-fab, .nr-find-panel { right: 34px; } }

/* ── Phones ── */
@media (max-width: 640px) {
  .nr-bar { padding: var(--space-2) var(--space-4); }
  .nr-crumbs { display: none; }
  .nr-pill span { display: none; }
  .nr-pill { width: 38px; padding: 0; justify-content: center; }
  .nr-pill.accent { width: auto; padding: 0 var(--space-3); }
  .nr-pill.accent span { display: inline; }
  .nr-hlbar { padding: var(--space-3) var(--space-4); }
  .nr-content { padding: var(--space-6) var(--space-4) 0; }
  .note-content { font-size: 1.02rem; }
  .note-content h2 { font-size: 1.28rem; }
  .nr-ask { padding: var(--space-4); }
  .nr-pager { grid-template-columns: minmax(0, 1fr); }
  .nr-pager-link.next { text-align: left; align-items: flex-start; }
  .nr-find-fab kbd { display: none; }
  .nr-find-panel { left: 16px; right: 16px; min-width: 0; }
}
@media (prefers-reduced-motion: reduce) { .nr-sidebar, .nr-progress span, .nr-ask { transition: none; } }
`;
