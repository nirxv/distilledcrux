'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { allNotes, getNoteBySlug } from '@/lib/notes';
import { auth, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

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
        <span style={{ fontSize: '0.65rem', color: 'var(--text3)', opacity: 0.55, fontFamily: 'var(--font-ui)' }}>{open ? '▲ hide' : '▼ show'}</span>
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
                {entry.level === 2 ? `${h2i}. ` : '– '}{entry.text}
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}

// ── Main NoteReader ───────────────────────────────────────────
export default function NoteReader({ slug, subject, initialContent = '' }: { slug: string; subject: string; initialContent?: string }) {
  const note = getNoteBySlug(slug);
  const noteContentRef = useRef<HTMLDivElement>(null);
  const noteSearch = useNoteSearch(noteContentRef);

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedColor, setSelectedColor] = useState<'yellow'|'green'|'red'|'blue'>('yellow');
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [annotationMode, setAnnotationMode] = useState<'highlight'|null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const allN = allNotes;
  const idx  = allN.findIndex(n => n.slug === slug);
  const prev = idx > 0 ? allN[idx - 1] : null;
  const next = idx < allN.length - 1 ? allN[idx + 1] : null;

  const processedContent = injectHeadingIds(initialContent);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); });
    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error(e); }
  };

  // Persist highlights to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pp-hl-${slug}`);
      if (saved) setHighlights(JSON.parse(saved));
    } catch {}
  }, [slug]);

  useEffect(() => {
    try { localStorage.setItem(`pp-hl-${slug}`, JSON.stringify(highlights)); } catch {}
  }, [highlights, slug]);

  const handleMouseUp = useCallback(() => {
    if (annotationMode !== 'highlight') return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setShowToolbar(false); return; }
    const text = sel.toString().trim();
    if (!text) { setShowToolbar(false); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setToolbarPos({ x: rect.left + rect.width / 2 + window.scrollX, y: rect.top + window.scrollY - 50 });
    setShowToolbar(true);
  }, [annotationMode]);

  const applyHighlight = useCallback((color: 'yellow'|'green'|'red'|'blue') => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text) return;
    setHighlights(prev => [...prev, { id: Date.now().toString(), text, color }]);
    sel.removeAllRanges();
    setShowToolbar(false);
  }, []);

  // Apply highlights to rendered HTML
  const applyHighlightsToContent = useCallback((html: string) => {
    let result = html;
    highlights.forEach(h => {
      const colorMap = { yellow: 'rgba(201,168,76,0.35)', green: 'rgba(76,173,122,0.35)', red: 'rgba(201,76,76,0.35)', blue: 'rgba(76,139,201,0.35)' };
      const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), `<mark style="background:${colorMap[h.color]};border-radius:2px;padding:0 1px;">${h.text}</mark>`);
    });
    return result;
  }, [highlights]);

  const displayContent = applyHighlightsToContent(processedContent);

  if (!note) {
    return (
      <div style={{ maxWidth: 760, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--text3)', fontSize: '0.9rem' }}>Note not found.</div>
        <Link href={`/notes/${subject}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.85rem' }}>← Back to {subject}</Link>
      </div>
    );
  }

  const subjectColor = subject === 'sociology' ? '#4361ee' : 'var(--accent)';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 5rem' }}>
      {/* ── Note CSS ── */}
      <style>{`
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
        .note-content table { display: block; width: 100%; max-width: 100%; border-collapse: collapse; margin: 1.75rem 0; font-size: 0.875rem; border-radius: 6px; border: 1px solid var(--border2); overflow-x: auto; }
        .note-content table > * { display: table; width: 100%; }
        .note-content th { background: var(--bg3); color: var(--gold); padding: 0.7rem 1rem; text-align: left; font-family: var(--font-ui); font-size: 0.78rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; border: 1px solid var(--border2); }
        .note-content td { padding: 0.6rem 1rem; border: 1px solid var(--border); color: var(--text); vertical-align: top; line-height: 1.65; }
        .note-content tr:nth-child(even) td { background: var(--bg2); }
        .note-content hr { border: none; border-top: 1px solid var(--border2); margin: 2.5rem 0; }
        .note-content mark { background: rgba(201,168,76,0.28); border-radius: 2px; padding: 0 1px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: '1.5rem 2rem 1rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 100, backdropFilter: 'blur(10px)' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontFamily: 'var(--font-ui)', color: 'var(--text3)', marginBottom: '0.6rem' }}>
          <Link href="/notes" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Notes</Link>
          <span>·</span>
          <Link href={`/notes/${subject}`} style={{ color: 'var(--text3)', textDecoration: 'none', textTransform: 'capitalize' }}>{subject}</Link>
          <span>·</span>
          <span style={{ color: 'var(--text2)' }}>{note.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: subjectColor, background: `${subjectColor}18`, border: `1px solid ${subjectColor}30`, padding: '2px 8px', borderRadius: 3 }}>
              Paper {note.paper}
            </span>
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-ui)', color: 'var(--text3)' }}>{note.section}</span>
          </div>

          {/* Toolbar actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Highlight toggle */}
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

            {/* Ask AI */}
            <Link href={`/chat?topic=${encodeURIComponent(note.title)}&subject=${subject}`} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(67,97,238,0.08)', border: '1px solid rgba(67,97,238,0.22)',
              color: 'rgba(123,147,247,0.9)', padding: '0.28rem 0.65rem',
              borderRadius: 5, textDecoration: 'none',
              fontSize: '0.72rem', fontFamily: 'var(--font-mono)',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Ask AI
            </Link>

            {/* Auth */}
            {!authLoading && (
              user ? (
                <button onClick={() => firebaseSignOut(auth)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text3)', padding: '0.28rem 0.65rem', borderRadius: 5, cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'var(--font-ui)' }}>
                  Sign out
                </button>
              ) : (
                <button onClick={handleSignIn} style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '0.28rem 0.75rem', borderRadius: 5, cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
                  Sign in
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Highlight color picker (when in highlight mode) ── */}
      {annotationMode === 'highlight' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.04)' }}>
          <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-ui)', color: 'var(--text3)', marginRight: '0.25rem' }}>Color:</span>
          {HIGHLIGHT_COLORS.map(c => (
            <button key={c.id} onClick={() => setSelectedColor(c.id as typeof selectedColor)} style={{
              width: 18, height: 18, borderRadius: '50%', background: c.color, border: selectedColor === c.id ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
              outline: selectedColor === c.id ? `2px solid ${c.color}` : 'none', outlineOffset: '1px', cursor: 'pointer', transition: 'transform 0.12s',
            }} title={c.label} />
          ))}
          {highlights.length > 0 && (
            <button onClick={() => { if (confirm('Clear all highlights?')) setHighlights([]); }} style={{ marginLeft: '0.75rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text3)', cursor: 'pointer', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Float highlight toolbar ── */}
      {showToolbar && (
        <div style={{ position: 'absolute', left: toolbarPos.x, top: toolbarPos.y, transform: 'translateX(-50%)', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '6px 8px', display: 'flex', gap: '5px', alignItems: 'center', zIndex: 200, boxShadow: '0 12px 40px rgba(0,0,0,0.7)' }}>
          {HIGHLIGHT_COLORS.map(c => (
            <button key={c.id} onClick={() => applyHighlight(c.id as typeof selectedColor)} title={c.label} style={{ width: 20, height: 20, borderRadius: '50%', background: c.color, border: '2px solid transparent', cursor: 'pointer', transition: 'transform 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.25)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            />
          ))}
          <div style={{ width: 1, height: 16, background: 'var(--border2)', margin: '0 2px' }} />
          <button onClick={() => setShowToolbar(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ padding: '2.5rem 2rem', position: 'relative' }} onMouseUp={handleMouseUp}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* Title */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {note.title}
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.88rem', fontFamily: 'var(--font-ui)', marginBottom: '2rem', lineHeight: 1.6 }}>
            {note.description}
          </p>

          {/* Subtopics */}
          {note.subtopics && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' as const, marginBottom: '2rem' }}>
              {note.subtopics.map(st => (
                <span key={st} style={{ fontSize: '0.7rem', fontFamily: 'var(--font-ui)', color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: 20 }}>{st}</span>
              ))}
            </div>
          )}

          {/* TOC */}
          {processedContent && <TableOfContents contentHtml={processedContent} />}

          {/* Note body */}
          <div style={{ position: 'relative' }}>
            <div ref={noteContentRef} className="note-content"
              dangerouslySetInnerHTML={{ __html: displayContent || '<p style="color:var(--text3);font-family:var(--font-ui);font-size:0.9rem;">Content coming soon. Check back shortly.</p>' }}
              style={!user && !authLoading && displayContent ? { maxHeight: '140vh', overflow: 'hidden', pointerEvents: 'none', userSelect: 'none' } : undefined}
            />

            {/* Sign-in gate (only if there's actual content) */}
            {!user && !authLoading && displayContent && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '2.5rem', paddingTop: '6rem', background: 'linear-gradient(to bottom, transparent 0%, var(--bg) 38%)', pointerEvents: 'auto' }}>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem 2rem', textAlign: 'center', maxWidth: 360 }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>🔒</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem', marginBottom: '0.4rem' }}>Sign in to continue reading</div>
                  <div style={{ color: 'var(--text3)', fontSize: '0.78rem', marginBottom: '1.1rem', lineHeight: 1.5 }}>Free account — full notes, highlights & progress tracking.</div>
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
                  <span key={st} style={{ display: 'inline-block', padding: '0.35rem 0.85rem', fontSize: '0.78rem', color: 'var(--text2)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, fontFamily: 'var(--font-ui)' }}>
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
        <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, background: 'rgba(10,14,26,0.97)', border: '1px solid rgba(67,97,238,0.45)', borderRadius: 12, boxShadow: '0 0 0 1px rgba(67,97,238,0.1), 0 12px 48px rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', minWidth: 300, backdropFilter: 'blur(20px)' }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ color: 'rgba(99,152,255,0.7)', flexShrink: 0 }}>
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="M14.5 14.5L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input autoFocus value={noteSearch.query} onChange={e => noteSearch.setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') noteSearch.jump(e.shiftKey ? -1 : 1); if (e.key === 'Escape') noteSearch.close(); }}
            placeholder="Find in note…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e8eaf6', fontSize: '0.9rem', fontFamily: 'var(--font-body)', minWidth: 0 }}
          />
          {noteSearch.total > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(99,152,255,0.8)', whiteSpace: 'nowrap', flexShrink: 0, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(59,130,246,0.2)' }}>
              {noteSearch.current} / {noteSearch.total}
            </span>
          )}
          {noteSearch.query.length >= 2 && noteSearch.total === 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>no match</span>
          )}
          <div style={{ display: 'flex', gap: 2, borderLeft: '1px solid rgba(59,130,246,0.2)', paddingLeft: 8, marginLeft: 2 }}>
            <button onClick={() => noteSearch.jump(-1)} disabled={noteSearch.total === 0} style={{ background: noteSearch.total > 0 ? 'rgba(59,130,246,0.1)' : 'transparent', border: `1px solid ${noteSearch.total > 0 ? 'rgba(59,130,246,0.25)' : 'transparent'}`, borderRadius: 6, color: noteSearch.total > 0 ? '#60a5fa' : 'var(--text3)', cursor: noteSearch.total > 0 ? 'pointer' : 'default', padding: '3px 8px', fontSize: '0.78rem', lineHeight: 1 }}>↑</button>
            <button onClick={() => noteSearch.jump(1)} disabled={noteSearch.total === 0} style={{ background: noteSearch.total > 0 ? 'rgba(59,130,246,0.1)' : 'transparent', border: `1px solid ${noteSearch.total > 0 ? 'rgba(59,130,246,0.25)' : 'transparent'}`, borderRadius: 6, color: noteSearch.total > 0 ? '#60a5fa' : 'var(--text3)', cursor: noteSearch.total > 0 ? 'pointer' : 'default', padding: '3px 8px', fontSize: '0.78rem', lineHeight: 1 }}>↓</button>
          </div>
          <button onClick={noteSearch.close} style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,238,0.2)', borderRadius: 6, color: '#60a5fa', cursor: 'pointer', padding: '3px 9px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', marginLeft: 2 }}>esc</button>
        </div>
      )}

      {/* ── Search trigger ── */}
      {!noteSearch.open && (
        <button onClick={() => noteSearch.setOpen(true)} title="Find in note (⌘F)" style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9998, background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(67,97,238,0.3)', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, color: '#60a5fa', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', boxShadow: '0 4px 20px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2"/><path d="M14.5 14.5L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Find
          <span style={{ opacity: 0.45, fontSize: '0.62rem', background: 'rgba(59,130,246,0.1)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(59,130,246,0.2)' }}>⌘F</span>
        </button>
      )}
    </div>
  );
}
