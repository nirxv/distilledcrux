'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { auth, signInWithGoogle } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import SidebarNotes from '@/components/SidebarNotes';
import BrandFrame from '@/components/BrandFrame';

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
  const [activeId, setActiveId] = useState('');
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

  useEffect(() => {
    if (!entries.length) return;
    const observer = new IntersectionObserver(obs => {
      const visible = obs.filter(e => e.isIntersecting);
      if (visible.length > 0) setActiveId(visible[0].target.id);
    }, { rootMargin: '-60px 0px -60% 0px', threshold: 0 });
    entries.forEach(({ id }) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [entries]);

  if (!entries.length) return null;
  let h2i = 0;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: open ? '1rem 1.25rem' : '0.6rem 1.25rem', marginBottom: '2rem', maxWidth: 760, transition: 'padding 0.2s' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.15rem 0', marginBottom: open ? '0.75rem' : 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text3)', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            <path d="M2 4.5L7 9.5L12 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Table of Contents
        </span>
        <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text3)', opacity: 0.55, fontFamily: 'var(--font-ui)' }}>{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && (
        <nav>
          {entries.map(entry => {
            if (entry.level === 2) h2i++;
            const isActive = activeId === entry.id;
            return (
              <a key={entry.id} href={'#' + entry.id}
                onClick={e => {
                  e.preventDefault();
                  const el = document.getElementById(entry.id);
                  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
                }}
                style={{ display: 'block', padding: entry.level === 2 ? '0.28rem 0' : '0.22rem 0', fontSize: entry.level === 2 ? '0.82rem' : '0.76rem', color: isActive ? 'var(--accent)' : entry.level === 2 ? 'var(--text2)' : 'var(--text3)', textDecoration: 'none', borderLeft: entry.level === 3 ? '2px solid var(--border2)' : 'none', marginLeft: entry.level === 3 ? '0.5rem' : 0, paddingLeft: entry.level === 3 ? '0.75rem' : 0, fontFamily: 'var(--font-ui)', fontWeight: entry.level === 2 ? 500 : 400, lineHeight: 1.5 }}
              >
                {entry.level === 2 ? `${h2i}. ` : '- '}{entry.text}
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
  const [activeId, setActiveId] = useState('');

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
    if (!entries.length) return;
    const obs = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting);
      if (vis.length) setActiveId(vis[0].target.id);
    }, { rootMargin: '-60px 0px -60% 0px' });
    entries.forEach(({ id }) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [entries]);

  if (!entries.length) return null;
  return (
    <>
      <div className="sb-section-label as-heading"><span>Contents</span></div>
      <nav className="sb-toc">
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
  const [activeId, setActiveId] = useState('');
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

  useEffect(() => {
    if (!entries.length) return;
    const obs = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting);
      if (vis.length) setActiveId(vis[0].target.id);
    }, { rootMargin: '-60px 0px -60% 0px' });
    entries.forEach(({ id }) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [entries]);

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

  // Open on a desktop, closed on a phone, where 240px of sidebar would
  // leave nothing for the note itself.
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 1024 : true);

  // Below 1024px the sidebar floats over the note, which makes it a modal in
  // every way except history. Back was the instinctive way to dismiss it and
  // nothing was on the stack for it, so Back left the note altogether.
  // Opening pushes an entry; Back pops that entry and only closes the panel.
  const sidebarEntry = useRef(false);
  const floating = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches;

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

  const subjectColor = subject === 'sociology' ? '#4361ee'
    : subject === 'geography' ? 'var(--geo)'
    : 'var(--accent)';

  return (
    <div className={'nr-shell' + (sidebarOpen ? ' with-sidebar' : '')}>
      {/* ── Note CSS ── */}
      <style>{`
        /* Highlights. The user-agent style for mark sets a black text colour,
           and only the background was being overridden, so on the dark ground a
           highlighted sentence became dark text on a dark wash. Colour is
           inherited from the prose instead, and each theme gets its own alpha:
           a tint that reads as a highlight on white reads as mud on near-black.
           Dark is the default ground, as everywhere else here. */
        .note-content mark.pp-hl {
          color: inherit; border-radius: 2px; padding: 0 1px;
          -webkit-box-decoration-break: clone; box-decoration-break: clone;
        }
        .note-content mark.pp-hl-yellow { background: rgba(201,168,76,0.30); }
        .note-content mark.pp-hl-green  { background: rgba(76,173,122,0.30); }
        .note-content mark.pp-hl-red    { background: rgba(201,76,76,0.32); }
        .note-content mark.pp-hl-blue   { background: rgba(76,139,201,0.32); }
        [data-theme="light"] .note-content mark.pp-hl-yellow { background: rgba(201,168,76,0.42); }
        [data-theme="light"] .note-content mark.pp-hl-green  { background: rgba(76,173,122,0.36); }
        [data-theme="light"] .note-content mark.pp-hl-red    { background: rgba(201,76,76,0.30); }
        [data-theme="light"] .note-content mark.pp-hl-blue   { background: rgba(76,139,201,0.32); }
        .note-content h1 { font-family: var(--font-display); font-size: 1.9rem; font-weight: 700; color: var(--text); margin: 2rem 0 1rem; line-height: 1.3; letter-spacing: -0.02em; border-bottom: 2px solid ${subjectColor}; padding-bottom: 0.5rem; }
        .note-content h2 { font-family: var(--font-display); font-size: 1.3rem; font-weight: 600; color: var(--gold); margin: 2.5rem 0 0.75rem; position: relative; padding-left: 0.85rem; border-left: 3px solid var(--gold); }
        .note-content h3 { font-family: var(--font-display); font-size: 1.05rem; font-weight: 600; color: ${subjectColor}; margin: 1.5rem 0 0.5rem; padding-left: 0.6rem; border-left: 2px solid ${subjectColor}; }
        .note-content h4 { font-size: 0.78rem; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.1em; margin: 1.25rem 0 0.4rem; }
        .note-content p  { margin-bottom: 0.9rem; color: var(--text); line-height: 1.85; font-size: 1rem; }
        .note-content ul, .note-content ol { margin: 0.5rem 0 1rem 1.5rem; }
        .note-content li { margin-bottom: 0.5rem; color: var(--text); line-height: 1.75; font-size: 1rem; }
        .note-content li::marker { color: ${subjectColor}; }
        .note-content ul ul { margin-top: 0.3rem; margin-bottom: 0.3rem; }
        .note-content ul ul li::marker { color: var(--gold); }
        .note-content strong { color: var(--text); font-weight: 700; }
        .note-content em { color: var(--text2); font-style: italic; }
        .note-content blockquote { border-left: 3px solid var(--gold); padding: 0.85rem 1.25rem; margin: 1.5rem 0; background: rgba(232,184,109,0.06); border-radius: 0 8px 8px 0; font-style: italic; color: var(--text2); }
        .note-content table { display: block; width: 100%; max-width: 100%; border-collapse: collapse; margin: 1.75rem 0; font-size: 0.875rem; font-weight: 500; border-radius: 6px; border: 1px solid var(--border2); overflow-x: auto; }
        .note-content table > * { display: table; width: 100%; }
        .note-content th { background: var(--bg3); color: var(--gold); padding: 0.7rem 1rem; text-align: left; font-family: var(--font-ui); font-size: 0.78rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; border: 1px solid var(--border2); }
        .note-content td { padding: 0.6rem 1rem; border: 1px solid var(--border); color: var(--text); vertical-align: top; line-height: 1.65; }
        .note-content tr:nth-child(even) td { background: var(--bg2); }
        .note-content hr { border: none; border-top: 1px solid var(--border2); margin: 2.5rem 0; }
        .note-content mark { background: rgba(201,168,76,0.28); color: inherit; border-radius: 2px; padding: 0 1px; }


          /* ── Shell ────────────────────────────────────────────────
             A two column reader: a sidebar that collapses to nothing and a
             main column that takes the width back. Centred as a pair, so the
             note does not jump sideways when the sidebar is toggled. */
          /* Full width, so the sidebar sits against the edge of the window
             rather than inside a centred box with a gutter to its left. The
             measure is set on the note itself, further in. */
          .nr-shell {
            display: flex; align-items: flex-start; gap: 0;
            width: 100%; margin: 0; padding: 0 0 5rem;
          }
          .nr-main { flex: 1; min-width: 0; }

          /* One sticky block from under the navbar to the foot of the
             window. It used to stretch to the full page height with the
             inner column sticky inside it, which clipped the top of the
             sidebar against its own background as the page moved. */
          .nr-sidebar {
            width: 0; min-width: 0; flex-shrink: 0;
            position: sticky; top: 60px; height: calc(100vh - 60px);
            overflow: hidden; background: var(--bg2);
            border-right: 1px solid transparent;
            transition: width 0.25s cubic-bezier(0.4,0,0.2,1),
                        min-width 0.25s cubic-bezier(0.4,0,0.2,1),
                        border-color 0.25s;
          }
          .nr-shell.with-sidebar .nr-sidebar {
            width: 240px; min-width: 240px; border-right-color: var(--border);
          }
          .nr-sidebar-inner {
            height: 100%; overflow-y: auto; overscroll-behavior: contain;
            padding: 1.25rem 1rem 2.5rem; width: 240px;
          }
          .nr-sidebar-inner::-webkit-scrollbar { width: 3px; }
          .nr-sidebar-inner::-webkit-scrollbar-track { background: transparent; }
          .nr-sidebar-inner::-webkit-scrollbar-thumb { background: var(--accent-dim); border-radius: 2px; }

          /* Backdrop only exists where the sidebar floats; on a desktop the
             sidebar takes width from the note and there is nothing to dim. */
          .nr-backdrop { display: none; }

          .nr-sb-close {
            display: none; position: absolute; top: 0.6rem; right: 0.6rem; z-index: 2;
            background: var(--bg3); border: 1px solid var(--border);
            border-radius: 6px; color: var(--text2); cursor: pointer;
            padding: 5px; line-height: 0;
          }
          .nr-sb-toggle {
            display: inline-flex; align-items: center; gap: 5px;
            background: var(--bg2); border: 1px solid var(--border); border-radius: 6px;
            color: var(--text2); cursor: pointer; padding: 0.25rem 0.55rem;
            font-family: var(--font-ui); font-size: 0.7rem; font-weight: 500;
            transition: border-color 0.15s, color 0.15s;
          }
          .nr-sb-toggle:hover { border-color: var(--border2); color: var(--text); }

          /* Below 1024px the sidebar floats over the note instead of taking
             width from it, and a tap outside the toggle closes it again. */
          @media (max-width: 1024px) {
            .nr-sidebar {
              position: fixed; top: 60px; left: 0; z-index: 120;
              height: calc(100vh - 60px); width: 0;
              box-shadow: none; border-right: 1px solid transparent;
            }
            .nr-shell.with-sidebar .nr-sidebar {
              width: 264px; min-width: 264px;
              box-shadow: 8px 0 32px rgba(0,0,0,0.28);
            }
            .nr-sidebar-inner { position: static; max-height: 100%; width: 264px; padding-top: 2.6rem; }
            .nr-sb-close { display: block; }
            .nr-shell.with-sidebar .nr-backdrop {
              display: block; position: fixed; inset: 0; z-index: 110;
              background: rgba(0,0,0,0.45);
              -webkit-tap-highlight-color: transparent;
            }
          }

          /* ── Sidebar contents ── */
          .sb-toc { display: block; margin-bottom: 0.4rem; }
          .sb-toc-link {
            display: block; width: 100%; text-align: left; background: none;
            border: none; border-left: 2px solid transparent; cursor: pointer;
            padding: 0.26rem 0.4rem; border-radius: 0 5px 5px 0;
            font-family: var(--font-ui); font-size: 0.76rem; line-height: 1.45;
            color: var(--text2); transition: background 0.15s, color 0.15s, border-left-color 0.15s;
          }
          .sb-toc-link.sub { font-size: 0.71rem; color: var(--text3); padding-left: 1rem; }
          /* The rail panel on the right tints with the subject's colour; the
             sidebar was hovering to a flat grey, so the two halves of the same
             contents list did not look related. color-mix keeps the wash
             translucent, which is what lets one value sit on both grounds. */
          .sb-toc-link:hover {
            background: color-mix(in srgb, ${subjectColor} 14%, transparent);
            border-left-color: color-mix(in srgb, ${subjectColor} 45%, transparent);
            color: var(--text);
          }
          .sb-toc-link.on {
            color: ${subjectColor}; border-left-color: ${subjectColor};
            background: color-mix(in srgb, ${subjectColor} 10%, transparent);
          }

          /* ── Sidebar head ──
             Where the reader is, before what is in the note. */
          .sb-head { padding-bottom: 0.9rem; margin-bottom: 0.2rem; border-bottom: 1px solid var(--border); }
          .sb-chip {
            display: inline-flex; align-items: center; gap: 6px;
            background: var(--bg3); border: 1px solid var(--border);
            border-radius: 20px; padding: 3px 9px 3px 7px;
            font-family: var(--font-mono); font-size: 0.55rem; font-weight: 500;
            letter-spacing: 0.12em; text-transform: uppercase; color: var(--text3);
          }
          .sb-chip-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
          .sb-title {
            font-family: var(--font-display); font-size: 0.95rem; font-weight: 700;
            color: var(--text); line-height: 1.3; letter-spacing: -0.01em;
            margin: 0.6rem 0 0.25rem;
          }
          .sb-sub {
            font-family: var(--font-ui); font-size: 0.7rem; font-weight: 500;
            color: var(--text3); margin: 0; line-height: 1.4;
          }

          /* A label with a rule running off it, so the sections read as
             separated without needing a box around each. */
          .sb-section-label::after {
            content: ''; flex: 1; height: 1px;
            background: linear-gradient(90deg, var(--border2), transparent);
          }

          /* ── Contents ── */
          .sb-toc-link { display: flex; align-items: flex-start; gap: 7px; }
          .sb-toc-dot {
            width: 4px; height: 4px; border-radius: 50%; flex-shrink: 0;
            margin-top: 0.45rem; background: var(--border2); transition: background 0.15s;
          }
          .sb-toc-link.sub .sb-toc-dot { width: 3px; height: 3px; }
          .sb-toc-link:hover .sb-toc-dot { background: ${subjectColor}; }
          .sb-toc-link.on .sb-toc-dot { background: ${subjectColor}; box-shadow: 0 0 5px ${subjectColor}; }

          /* ── Related ── */
          .sb-related { display: flex; flex-direction: column; gap: 0.35rem; }
          .sb-rel {
            display: block; text-decoration: none; background: var(--bg3);
            border: 1px solid var(--border); border-radius: 8px;
            padding: 0.45rem 0.6rem; transition: border-color 0.15s, transform 0.15s;
          }
          .sb-rel:hover {
            background: color-mix(in srgb, ${subjectColor} 12%, var(--bg3));
            border-color: color-mix(in srgb, ${subjectColor} 38%, transparent);
            transform: translateX(2px);
          }
          .sb-rel-dir {
            display: block; font-family: var(--font-mono); font-size: 0.52rem;
            letter-spacing: 0.14em; text-transform: uppercase; color: var(--text3);
            margin-bottom: 2px;
          }
          .sb-rel-title {
            display: block; font-family: var(--font-ui); font-size: 0.74rem;
            font-weight: 500; color: var(--text2); line-height: 1.35;
          }
          .sb-rel:hover .sb-rel-title { color: var(--text); }

          /* ── Scroll rail ──────────────────────────────────────────
             Hidden below 1024px: at the edge of a touch screen this competes
             with the scroll gesture, and a 2px tick is smaller than a
             fingertip. */
          .nr-rail { display: none; }
          @media (min-width: 1024px) { .nr-rail { display: block; } }
          .nr-rail-track {
            position: fixed; right: 0; top: 96px; width: 14px; z-index: 90;
            background: var(--bg2); border-left: 1px solid var(--border);
          }
          .nr-rail-tick {
            position: absolute; padding: 0; border: none; border-radius: 2px;
            cursor: pointer; transition: background 0.2s, box-shadow 0.2s, transform 0.15s;
          }
          .nr-rail-tick:hover { transform: scaleX(1.6); }
          .nr-rail-thumb {
            position: absolute; left: 3px; width: 8px; border: none; border-radius: 6px;
            cursor: pointer; padding: 0; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 3px; transition: box-shadow 0.2s;
          }
          .nr-rail-thumb span { width: 4px; height: 1px; background: rgba(255,255,255,0.7); border-radius: 1px; }

          /* ── Rail panel ── */
          @keyframes nrPanelIn {
            from { opacity: 0; transform: translateX(12px) scale(0.97); }
            to   { opacity: 1; transform: translateX(0) scale(1); }
          }
          .nr-rail-panel {
            position: fixed; right: 22px; top: 88px; width: 280px; z-index: 91;
            background: var(--bg2); border: 1px solid var(--border2); border-radius: 12px;
            overflow: hidden; box-shadow: 0 8px 48px rgba(0,0,0,0.35);
            animation: nrPanelIn 0.18s cubic-bezier(0.4,0,0.2,1);
          }
          .nr-rail-panel-head {
            display: flex; align-items: center; gap: 8px;
            padding: 0.8rem 1rem 0.7rem; background: var(--bg3);
            border-bottom: 1px solid var(--border);
          }
          .nr-rail-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
          .nr-rail-panel-title {
            flex: 1; font-size: 0.6rem; font-family: var(--font-mono);
            letter-spacing: 0.18em; text-transform: uppercase;
          }
          .nr-rail-close {
            background: none; border: none; color: var(--text3); cursor: pointer;
            padding: 2px; display: flex; line-height: 0;
          }
          .nr-rail-close:hover { color: var(--text); }
          .nr-rail-progress { height: 2px; background: var(--bg3); }
          .nr-rail-progress div { height: 100%; transition: width 0.1s; }
          .nr-rail-list { max-height: calc(100vh - 230px); overflow-y: auto; padding: 0.4rem 0; }
          /* Find bar. Every colour comes from a token so the control follows the
             theme; the old hard-coded slate left it dark on a light page. */
          .nr-find-panel {
            position: fixed; bottom: 28px; right: 28px; z-index: 9999;
            background: var(--bg2);
            border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
            border-radius: 12px; padding: 10px 12px; min-width: 300px;
            display: flex; align-items: center; gap: 8px;
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent),
                        0 12px 48px rgba(0,0,0,0.8),
                        0 0 24px color-mix(in srgb, var(--accent) 8%, transparent);
          }
          .nr-find-count {
            font-family: var(--font-mono); font-size: 0.68rem; white-space: nowrap; flex-shrink: 0;
            color: color-mix(in srgb, var(--accent) 80%, transparent);
            background: var(--accent-dim); padding: 2px 8px; border-radius: 4px;
            border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
          }
          .nr-find-none {
            font-family: var(--font-mono); font-size: 0.68rem; color: var(--red);
            white-space: nowrap; flex-shrink: 0;
          }
          .nr-find-nav {
            display: flex; gap: 2px; padding-left: 8px; margin-left: 2px;
            border-left: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
          }
          .nr-find-step {
            background: var(--accent-dim); border-radius: 6px; cursor: pointer;
            border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
            color: var(--accent); padding: 3px 8px; font-size: 0.78rem; line-height: 1;
            transition: all 0.15s;
          }
          .nr-find-step:disabled { background: transparent; border-color: transparent; color: var(--text3); cursor: default; }
          .nr-find-esc {
            background: var(--accent-dim); border-radius: 6px; cursor: pointer;
            border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
            color: var(--accent); padding: 3px 9px; font-size: 0.68rem;
            font-family: var(--font-mono); margin-left: 2px; transition: all 0.15s;
          }
          .nr-find-fab {
            position: fixed; bottom: 28px; right: 28px; z-index: 9998;
            background: var(--bg2);
            border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
            border-radius: 10px; padding: 9px 14px; cursor: pointer;
            display: flex; align-items: center; gap: 7px;
            color: var(--accent); font-size: 0.75rem;
            font-family: var(--font-mono); letter-spacing: 0.04em;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          .nr-find-fab:hover {
            border-color: color-mix(in srgb, var(--accent) 60%, transparent);
            box-shadow: 0 6px 26px rgba(0,0,0,0.7);
          }
          .nr-find-kbd {
            opacity: 0.45; font-size: 0.62rem; padding: 1px 5px; border-radius: 3px;
            background: var(--accent-dim);
            border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
          }
          /* A shadow tuned for a dark ground turns into a smudge on white. */
          [data-theme="light"] .nr-find-panel {
            box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent),
                        0 12px 40px rgba(15,23,42,0.16),
                        0 0 24px color-mix(in srgb, var(--accent) 6%, transparent);
          }
          [data-theme="light"] .nr-find-fab { box-shadow: 0 4px 16px rgba(15,23,42,0.13); }
          [data-theme="light"] .nr-find-fab:hover { box-shadow: 0 6px 22px rgba(15,23,42,0.18); }
          .nr-rail-link {
            width: 100%; display: flex; align-items: center; gap: 8px;
            background: none; border: none; border-left: 2px solid transparent;
            cursor: pointer; text-align: left; padding: 0.5rem 1rem;
            color: var(--text); font-family: var(--font-ui); font-size: 0.8rem; font-weight: 500;
            transition: background 0.15s, color 0.15s;
          }
          .nr-rail-link.sub {
            padding: 0.4rem 1rem 0.4rem 1.7rem; font-size: 0.73rem; font-weight: 400; color: var(--text2);
          }
          .nr-rail-link:hover { background: var(--accent-dim); }
          .nr-rail-bullet { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
          .nr-rail-link.sub .nr-rail-bullet { width: 3px; height: 3px; }
          .nr-rail-text { flex: 1; line-height: 1.4; }
          .nr-rail-arrow {
            font-size: 0.65rem; opacity: 0; transform: translateX(0);
            transition: opacity 0.15s, transform 0.15s; color: var(--text3);
          }
          .nr-rail-link:hover .nr-rail-arrow { opacity: 1; transform: translateX(3px); }
          .nr-rail-foot {
            display: flex; align-items: center; justify-content: space-between;
            padding: 0.55rem 1rem; border-top: 1px solid var(--border);
            font-family: var(--font-mono); font-size: 0.58rem;
            letter-spacing: 0.1em; color: var(--text3);
          }
          .nr-rail-foot span:last-child { font-size: 0.65rem; font-weight: 600; }

          /* ── Scratch notes ── */
          .sb-section-label {
            width: 100%; display: flex; align-items: center; justify-content: space-between;
            gap: 8px; background: none; border: none; cursor: pointer; padding: 0;
            font-size: 0.6rem; font-family: var(--font-mono); text-transform: uppercase;
            letter-spacing: 0.18em; color: var(--text3); margin: 1.2rem 0 0.5rem;
          }
          .sb-section-label.as-heading { cursor: default; margin-top: 0; }
          .sb-section-label:hover { color: var(--text2); }
          .sb-note-add {
            width: 100%; display: flex; align-items: center; gap: 0.35rem; background: none;
            border: 1px dashed color-mix(in srgb, var(--accent) 30%, transparent);
            border-radius: 8px; padding: 0.5rem; font-size: 0.74rem; font-family: var(--font-ui);
            color: var(--accent); cursor: pointer; margin-bottom: 0.6rem;
            transition: background 0.15s, border-color 0.15s;
          }
          .sb-note-add:hover {
            background: var(--accent-dim);
            border-color: color-mix(in srgb, var(--accent) 55%, transparent);
            border-style: solid;
          }
          /* A warm tint and a soft edge, so a note reads as something the
             reader put there rather than as another panel of the interface. */
          .sb-note {
            background: color-mix(in srgb, var(--gold) 7%, var(--bg2));
            border: 1px solid color-mix(in srgb, var(--gold) 22%, transparent);
            border-radius: 8px; padding: 0.6rem; margin-bottom: 0.6rem;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          .sb-note:focus-within {
            border-color: color-mix(in srgb, var(--gold) 50%, transparent);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 12%, transparent);
          }
          .sb-note-title, .sb-note-body {
            width: 100%; background: none; border: none; outline: none; color: var(--text);
            font-family: var(--font-ui); padding: 0; resize: none;
          }
          .sb-note-title {
            font-size: 0.8rem; font-weight: 700; padding-bottom: 0.35rem; margin-bottom: 0.35rem;
            border-bottom: 1px solid color-mix(in srgb, var(--gold) 15%, transparent);
          }
          .sb-note-body { font-size: 0.76rem; line-height: 1.6; min-height: 2.8em; }
          .sb-note-title::placeholder, .sb-note-body::placeholder { color: var(--text3); font-weight: 400; }
          /* Housekeeping, kept out of the way until the note is used. Always
             visible on touch, where there is no hover to reveal it. */
          .sb-note-foot {
            display: flex; align-items: center; justify-content: space-between; gap: 0.35rem;
            margin-top: 0.35rem; font-family: var(--font-mono); font-size: 0.56rem;
            color: var(--text3); opacity: 0; transition: opacity 0.15s;
          }
          .sb-note:hover .sb-note-foot, .sb-note:focus-within .sb-note-foot { opacity: 1; }
          @media (hover: none) { .sb-note-foot { opacity: 1; } }
          .sb-note-foot button {
            background: none; border: none; padding: 0; font-family: inherit; font-size: inherit;
            color: var(--text3); cursor: pointer; text-transform: uppercase; letter-spacing: 0.08em;
          }
          .sb-note-foot button:hover { color: #f87171; }
          .sb-note-confirm { display: flex; gap: 0.6rem; }
          .sb-note-confirm button:first-child { color: #f87171; font-weight: 700; }
      `}</style>

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
              <span className="sb-chip-dot" style={{ background: subjectColor }} />
              {subject.replace('-', ' ')} · Paper {note.paper}
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
              <div className="sb-section-label as-heading"><span>Related</span></div>
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

      {/* ── Header ──
            One row, the way the history reader has it, rather than the three
            stacked rows it was. It scrolls away with the note rather than
            holding at the top; the sidebar is what stays. Wraps when narrow. */}
      <div style={{
        padding: '0.7rem 1.5rem', borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' as const,
      }}>
        <button type="button" className="nr-sb-toggle"
          onClick={() => (sidebarOpen ? closeSidebar() : openSidebar())}
          aria-expanded={sidebarOpen}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1.8" y="2.5" width="12.4" height="11" rx="1.6" />
            <line x1="6.3" y1="2.5" x2="6.3" y2="13.5" />
          </svg>
          <span>{sidebarOpen ? 'Hide' : 'Contents'}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--text3)', minWidth: 0 }}>
          <Link href="/notes" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Notes</Link>
          <span>·</span>
          <Link href={`/notes/${subject}`} style={{ color: 'var(--text3)', textDecoration: 'none', textTransform: 'capitalize' }}>{subject}</Link>
          <span>·</span>
          <span style={{ color: 'var(--text2)', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.title}</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: subjectColor, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px' }}>
            Paper {note.paper}
          </span>
          <span style={{ fontSize: '0.72rem', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--text3)' }}>{note.section}</span>
          <button
            onClick={() => setAnnotationMode(m => m === 'highlight' ? null : 'highlight')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: annotationMode === 'highlight' ? 'rgba(201,168,76,0.1)' : 'transparent',
              border: `1px solid ${annotationMode === 'highlight' ? 'rgba(201,168,76,0.35)' : 'var(--border)'}`,
              color: annotationMode === 'highlight' ? '#c9a84c' : 'var(--text3)',
              padding: '0.28rem 0.65rem', borderRadius: 5, cursor: 'pointer',
              fontSize: '0.72rem', fontFamily: 'var(--font-mono)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            {annotationMode === 'highlight' ? 'Highlighting' : 'Highlight'}
          </button>

          <Link href={`/chat?topic=${encodeURIComponent(note.title)}&subject=${subject}`} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(67,97,238,0.08)', border: '1px solid rgba(67,97,238,0.22)',
            color: 'rgba(123,147,247,0.9)', padding: '0.28rem 0.65rem',
            borderRadius: 5, textDecoration: 'none',
            fontSize: '0.72rem', fontWeight: 500, fontFamily: 'var(--font-mono)',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Ask AI
          </Link>
        </div>
      </div>

      {/* ── Highlight color picker (when in highlight mode) ── */}
      {annotationMode === 'highlight' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.04)' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--text3)', marginRight: '0.25rem' }}>Color:</span>
          {HIGHLIGHT_COLORS.map(c => (
            <button key={c.id} onClick={() => setSelectedColor(c.id as typeof selectedColor)} style={{
              width: 18, height: 18, borderRadius: '50%', background: c.color, border: selectedColor === c.id ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
              outline: selectedColor === c.id ? `2px solid ${c.color}` : 'none', outlineOffset: '1px', cursor: 'pointer', transition: 'transform 0.12s',
            }} title={c.label} />
          ))}
          {highlights.length > 0 && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.68rem', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--text3)' }}>
              Click a highlight to remove it.
            </span>
          )}
          {highlights.length > 0 && (
            <button onClick={() => { if (confirm('Clear all highlights?')) setHighlights([]); }} style={{ marginLeft: '0.75rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text3)', cursor: 'pointer', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Float highlight toolbar ── */}
      {showToolbar && (
        <div style={{ position: 'absolute', left: toolbarPos.x, top: toolbarPos.y, transform: 'translateX(-50%)', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '6px 8px', display: 'flex', gap: '5px', alignItems: 'center', zIndex: 200, boxShadow: '0 12px 40px rgba(0,0,0,0.7)' }}>
          {HIGHLIGHT_COLORS.map(c => (
            <button key={c.id} onMouseDown={e => e.preventDefault()} onClick={() => applyHighlight(c.id as typeof selectedColor)} title={c.label} style={{ width: 20, height: 20, borderRadius: '50%', background: c.color, border: '2px solid transparent', cursor: 'pointer', transition: 'transform 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.25)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            />
          ))}
          {selectionHighlighted && (
            <>
              <div style={{ width: 1, height: 16, background: 'var(--border2)', margin: '0 2px' }} />
              <button onMouseDown={e => e.preventDefault()} onClick={removeHighlight} title="Remove highlight"
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 20H9L4 15a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-7 7"/><path d="M6 13l6 6"/>
                </svg>
              </button>
            </>
          )}
          <div style={{ width: 1, height: 16, background: 'var(--border2)', margin: '0 2px' }} />
          <button onClick={() => setShowToolbar(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {processedContent && <ScrollRail contentHtml={processedContent} accent={subjectColor} />}

      {/* ── Content ── */}
      <div style={{ padding: '2.5rem 2rem', position: 'relative' }} onMouseUp={handleMouseUp}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* Title */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {note.title}
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.88rem', fontWeight: 500, fontFamily: 'var(--font-ui)', marginBottom: '2rem', lineHeight: 1.6 }}>
            {note.description}
          </p>

          {/* Subtopics */}
          {note.subtopics && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' as const, marginBottom: '2rem' }}>
              {note.subtopics.map(st => (
                <span key={st} style={{ fontSize: '0.7rem', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: 20 }}>{st}</span>
              ))}
            </div>
          )}


          {/* TOC */}
          {processedContent && <TableOfContents contentHtml={processedContent} />}

          {/* Note body. The padding is what the rails sit in; without it they
              would run over the prose rather than around it. */}
          <div style={{ position: 'relative', padding: '0.5rem 1.4rem', overflow: 'hidden' }}>
            <BrandFrame />
            <div ref={noteContentRef} className="note-content"
              onClick={handleContentClick}
              dangerouslySetInnerHTML={{ __html: displayContent || '<p style="color:var(--text3);font-family:var(--font-ui);font-size:0.9rem; font-weight: 500;">Content coming soon. Check back shortly.</p>' }}
              style={!user && !authLoading && displayContent ? { maxHeight: '140vh', overflow: 'hidden', pointerEvents: 'none', userSelect: 'none' } : undefined}
            />

            {/* Sign-in gate (only if there's actual content) */}
            {!user && !authLoading && displayContent && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '2.5rem', paddingTop: '6rem', background: 'linear-gradient(to bottom, transparent 0%, var(--bg) 38%)', pointerEvents: 'auto' }}>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem 2rem', textAlign: 'center', maxWidth: 360 }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>🔒</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem', marginBottom: '0.4rem' }}>Sign in to continue reading</div>
                  <div style={{ color: 'var(--text3)', fontSize: '0.78rem', fontWeight: 500, marginBottom: '1.1rem', lineHeight: 1.5 }}>Free account full notes, highlights & progress tracking.</div>
                  <button onClick={handleSignIn} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.5rem', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', width: '100%' }}>
                    Sign in free →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Related topics */}
          {note.subtopics && displayContent && (
            <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text3)', marginBottom: '0.75rem', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>Subtopics covered</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem' }}>
                {note.subtopics.map(st => (
                  <span key={st} style={{ display: 'inline-block', padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text2)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, fontFamily: 'var(--font-ui)' }}>
                    {st}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Prev / Next nav */}
          <div style={{ marginTop: '3.5rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            {prev ? (
              <Link href={`/notes/${subject}/${prev.slug}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '1rem 1.25rem', borderRadius: 10, textDecoration: 'none', background: 'var(--bg2)', border: '1px solid var(--border)', flex: 1, maxWidth: '48%', transition: 'border-color 0.15s' }}>
                <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.16em', color: `${subjectColor}80`, display: 'flex', alignItems: 'center', gap: 5 }}>← Previous</span>
                <span style={{ fontSize: '0.88rem', color: 'var(--text)', fontFamily: 'var(--font-display)', fontWeight: 600, lineHeight: 1.35 }}>{prev.title}</span>
              </Link>
            ) : <div style={{ flex: 1 }} />}
            {next ? (
              <Link href={`/notes/${subject}/${next.slug}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '1rem 1.25rem', borderRadius: 10, textDecoration: 'none', background: 'var(--bg2)', border: '1px solid var(--border)', flex: 1, maxWidth: '48%', alignItems: 'flex-end', transition: 'border-color 0.15s' }}>
                <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.16em', color: `${subjectColor}80`, display: 'flex', alignItems: 'center', gap: 5 }}>Next →</span>
                <span style={{ fontSize: '0.88rem', color: 'var(--text)', fontFamily: 'var(--font-display)', fontWeight: 600, lineHeight: 1.35, textAlign: 'right' }}>{next.title}</span>
              </Link>
            ) : <div style={{ flex: 1 }} />}
          </div>
        </div>
      </div>

      {/* ── Note search bar ── */}
      {noteSearch.open && (
        <div className="nr-find-panel">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ color: 'color-mix(in srgb, var(--accent) 70%, transparent)', flexShrink: 0 }}>
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="M14.5 14.5L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input autoFocus value={noteSearch.query} onChange={e => noteSearch.setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') noteSearch.jump(e.shiftKey ? -1 : 1); if (e.key === 'Escape') noteSearch.close(); }}
            placeholder="Find in note…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'var(--font-body)', minWidth: 0 }}
          />
          {noteSearch.total > 0 && (
            <span className="nr-find-count">{noteSearch.current} / {noteSearch.total}</span>
          )}
          {noteSearch.query.length >= 2 && noteSearch.total === 0 && (
            <span className="nr-find-none">no match</span>
          )}
          <div className="nr-find-nav">
            <button onClick={() => noteSearch.jump(-1)} disabled={noteSearch.total === 0} title="Previous (Shift+Enter)" className="nr-find-step">↑</button>
            <button onClick={() => noteSearch.jump(1)} disabled={noteSearch.total === 0} title="Next (Enter)" className="nr-find-step">↓</button>
          </div>
          <button onClick={noteSearch.close} className="nr-find-esc">esc</button>
        </div>
      )}

      {/* ── Search trigger ── */}
      {!noteSearch.open && (
        <button onClick={() => noteSearch.setOpen(true)} title="Find in note (⌘F)" className="nr-find-fab">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2"/><path d="M14.5 14.5L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Find
          <span className="nr-find-kbd">⌘F</span>
        </button>
      )}
      </div>
    </div>
  );
}
