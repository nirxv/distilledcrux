'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOptional } from '@/components/useOptional';
import { routeSlugForOptional } from '@/lib/optionals';
import { suggestions, nextSuggestion, graphemes } from '@/lib/chatSuggestions';
import type { SubjectKey } from '@/lib/subjectConfig';

const SUBJECTS: SubjectKey[] = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'];

/**
 * The chat's input, on the home page: type a question and it opens in the
 * AI chat, already asked. Until the reader types, it suggests one, typed out
 * the way the chat page does it; Esc or the key hint takes the suggestion.
 *
 * A reader with an optional is shown that optional's questions; anyone else
 * a mix from all five, each sent to its own subject's chat. A subject's own
 * page passes `subject`, which wins over both.
 */
export default function HomeAsk({ subject }: { subject?: SubjectKey } = {}) {
  const router = useRouter();
  const optional = useOptional();
  const own = subject ?? (routeSlugForOptional(optional) as SubjectKey | null);
  const [value, setValue] = useState('');
  const [hint, setHint] = useState(0);
  const [typed, setTyped] = useState({ text: '', n: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const pool = useMemo(() => {
    if (own) return suggestions(own, false).map((q) => ({ q, subject: own }));
    // Round-robin across the optionals, so the mix never runs one subject.
    const lists = SUBJECTS.map((s) => suggestions(s, false).slice(0, 8).map((q) => ({ q, subject: s })));
    const out: { q: string; subject: SubjectKey }[] = [];
    for (let i = 0; i < 8; i++) for (const l of lists) if (l[i]) out.push(l[i]);
    return out;
  }, [own]);

  // Drawn after mount, so the server's HTML and the first render agree.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setHint(Math.floor(Math.random() * pool.length));
  }, [pool.length]);

  const current = pool[hint % pool.length];
  const suggestion = value ? '' : current?.q ?? '';

  // Typed at a person's pace, then left for a few seconds before the next.
  useEffect(() => {
    if (!suggestion) return;
    const chars = graphemes(suggestion);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = window.setTimeout(() => setTyped({ text: suggestion, n: chars.length }), 0);
      const next = window.setTimeout(() => setHint((h) => nextSuggestion(h % pool.length, pool.length)), 6000);
      return () => { window.clearTimeout(id); window.clearTimeout(next); };
    }
    let n = 0;
    let id = 0;
    const pause = (c: string) => 55 + Math.random() * 45 + (c === ' ' ? 40 : 0);
    const step = () => {
      n += 1;
      setTyped({ text: suggestion, n });
      if (n < chars.length) id = window.setTimeout(step, pause(chars[n - 1]));
      else id = window.setTimeout(() => setHint((h) => nextSuggestion(h % pool.length, pool.length)), 3800);
    };
    id = window.setTimeout(step, 400);
    return () => window.clearTimeout(id);
  }, [suggestion, pool.length]);

  const chars = graphemes(suggestion);
  const ghost = typed.text === suggestion ? chars.slice(0, typed.n).join('') : '';
  const typing = typed.text !== suggestion || typed.n < chars.length;

  const send = (q: string, subject: SubjectKey | null) => {
    const text = q.trim();
    if (!text) return;
    router.push(`/chat?q=${encodeURIComponent(text)}${subject ? `&subject=${subject}` : ''}`);
  };

  const take = () => { if (current) { setValue(current.q); inputRef.current?.focus(); } };

  return (
    <form
      className={`ha${value.trim() ? ' lit' : ''}`}
      onSubmit={(e) => { e.preventDefault(); send(value, value === current?.q ? current.subject : own); }}
    >
      <style dangerouslySetInnerHTML={{ __html: HA_CSS }} />
      <svg className="ha-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <div className="ha-field">
        {!value && (
          <div className="ha-ghost" aria-hidden="true">
            <span className="ha-ghost-text">{ghost}</span>
            <span className={`ha-caret${typing ? ' typing' : ''}`} />
          </div>
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' && !value) { e.preventDefault(); take(); } }}
          aria-label="Ask the AI a question from your syllabus"
          aria-describedby="ha-desc"
          enterKeyHint="send"
        />
        <span id="ha-desc" className="ha-sr">{current ? `Suggestion: ${current.q}. Press Escape to use it.` : ''}</span>
      </div>
      {!value && current && <button type="button" className="ha-esc" onClick={take} tabIndex={-1} title="Use this suggestion (Esc)">esc</button>}
      <button type="submit" className={`ha-send${value.trim() ? ' ready' : ''}`} aria-label="Ask" disabled={!value.trim()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
      </button>
    </form>
  );
}

const HA_CSS = `
.ha {
  width: 100%; display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  background: var(--ds-card); border: 2px solid var(--border2); border-radius: var(--radius-xl);
  box-shadow: var(--elev-2); transition: border-color 0.2s, box-shadow 0.2s; text-align: left;
}
.ha:focus-within, .ha.lit { border-color: color-mix(in srgb, var(--accent) 70%, transparent); box-shadow: 0 0 0 4px var(--accent-glow), var(--elev-2); }
.ha-icon { color: var(--text3); flex-shrink: 0; }
.ha-field { position: relative; flex: 1; min-width: 0; display: flex; }
.ha-field input { width: 100%; height: 44px; border: none; outline: none; background: none; color: var(--text); font-size: 1.02rem; }
.ha-ghost { position: absolute; inset: 0; display: flex; align-items: center; pointer-events: none; color: var(--text3); font-size: 1.02rem; white-space: nowrap; overflow: hidden; }
.ha-ghost-text { overflow: hidden; text-overflow: ellipsis; }
.ha-caret { flex-shrink: 0; width: 2px; height: 1.25em; margin-left: 2px; background: var(--accent); border-radius: 1px; animation: haCaret 1.05s steps(1) infinite; }
.ha-caret.typing { animation: none; }
.ha-field:focus-within .ha-caret { display: none; }
.ha-field input:not(:focus) { caret-color: transparent; }
@keyframes haCaret { 50% { opacity: 0; } }
.ha-esc { flex-shrink: 0; padding: 2px var(--space-2); border-radius: var(--radius-xs); border: 1px solid var(--border2); background: var(--ds-soft); color: var(--text3); font-family: var(--font-ui); font-size: 0.72rem; cursor: pointer; }
.ha-esc:hover { color: var(--accent-text); border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.ha-send {
  width: 44px; height: 44px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-lg); border: 1px solid var(--border2); background: var(--ds-card); color: var(--text3); cursor: not-allowed;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.ha-send.ready { background: var(--accent); border-color: var(--accent); color: var(--accent-on); cursor: pointer; }
.ha-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (hover: none) { .ha-esc { display: none; } }
@media (prefers-reduced-motion: reduce) { .ha-caret { animation: none; } }
`;
