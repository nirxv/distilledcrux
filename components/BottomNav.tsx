'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { routeSlugForOptional } from '@/lib/optionals';
import { useOptional } from '@/components/useOptional';

/**
 * The tab bar on phones: a floating pill of four places a thumb reaches
 * without the menu, built around the reader's optional once they have one,
 * and beside it a round button for starting something, a chat, an answer
 * check or a test. Everything else is in the menu behind the burger.
 *
 * Kept off the sign-in and onboarding screens, which are a flow of their own.
 */

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
};

/** The chat page listens for this to clear itself, since a link to the page it is already on would not. */
export const NEW_CHAT_EVENT = 'dc-new-chat';

const HIDDEN_ON = ['/login', '/onboarding'];

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Icons = {
  home: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M3 10.2 12 3l9 7.2" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></svg>,
  notes: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M4 4.5C4 3.7 4.7 3 5.5 3H17l3 3v13.5c0 .8-.7 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>,
  evaluate: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="m9 11 2.5 2.5L20 5" /><path d="M21 12v6.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-13A1.5 1.5 0 0 1 4.5 4H15" /></svg>,
  chat: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  you: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" /></svg>,
  test: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2h5" /></svg>,
  plus: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
};

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const optional = useOptional();
  const slug = routeSlugForOptional(optional);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // A route change closes the menu, whichever way it happened.
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    menuRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const home = slug ? `/${slug}` : '/';
  const tabs: Tab[] = [
    { href: home, label: 'Home', icon: Icons.home, match: (p) => p === '/' || p === home },
    { href: slug ? `/notes/${slug}` : '/#optionals', label: 'Notes', icon: Icons.notes, match: (p) => p.startsWith('/notes') },
    { href: '/chat', label: 'AI Chat', icon: Icons.chat, match: (p) => p.startsWith('/chat') },
    { href: '/dashboard', label: 'Profile', icon: Icons.you, match: (p) => p.startsWith('/dashboard') || p.startsWith('/profile') },
  ];

  const newChat = () => {
    setOpen(false);
    if (pathname.startsWith('/chat')) window.dispatchEvent(new Event(NEW_CHAT_EVENT));
    else router.push('/chat');
  };

  return (
    <nav className="bn ds" aria-label="Primary">
      <style dangerouslySetInnerHTML={{ __html: BN_CSS }} />
      {open && <div className="bn-scrim" onClick={() => setOpen(false)} />}
      <div className="bn-pill">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link key={tab.label} href={tab.href} className={`bn-tab${active ? ' on' : ''}`} aria-current={active ? 'page' : undefined}>
              {tab.icon}
              <span className="bn-label">{tab.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="bn-create">
        {open && (
          <div ref={menuRef} className="bn-menu" role="menu" aria-label="Start something">
            <button type="button" className="bn-menu-item" role="menuitem" onClick={newChat}>
              <span className="bn-menu-icon">{Icons.chat}</span>
              <span><strong>New chat</strong><span>Ask anything from your optional</span></span>
            </button>
            <Link href="/evaluate" className="bn-menu-item" role="menuitem">
              <span className="bn-menu-icon">{Icons.evaluate}</span>
              <span><strong>Evaluate</strong><span>Get an answer checked</span></span>
            </Link>
            <Link href={optional ? `/test?optional=${optional}` : '/test'} className="bn-menu-item" role="menuitem">
              <span className="bn-menu-icon">{Icons.test}</span>
              <span><strong>Test paper</strong><span>A full paper against the clock</span></span>
            </Link>
          </div>
        )}
        <button
          type="button"
          className={`bn-fab${open ? ' open' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close' : 'Start something'}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          {Icons.plus}
        </button>
      </div>
    </nav>
  );
}

const BN_CSS = `
.bn { display: none; }
@media (max-width: 768px) {
  .bn {
    display: flex; align-items: flex-end; gap: var(--space-3);
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 1300;
    padding: var(--space-2) var(--space-2) max(var(--space-4), env(safe-area-inset-bottom, 0px));
    /* The page fades out under the bar instead of being cut by an edge. */
    background: linear-gradient(to bottom, color-mix(in srgb, var(--bg) 0%, transparent), var(--bg) 70%);
    pointer-events: none;
  }
  .bn-pill, .bn-create, .bn-scrim { pointer-events: auto; }
  .bn-pill {
    flex: 1; min-width: 0; display: flex; padding: var(--space-1);
    background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-full);
    box-shadow: var(--shadow-sm);
  }
  .bn-tab {
    flex: 1; min-width: 0; height: 52px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    border-radius: var(--radius-full);
    color: var(--text2); text-decoration: none; -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, color 0.15s;
  }
  .bn-label { font-family: var(--font-ui); font-size: 0.66rem; font-weight: 600; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; padding: 0 2px; }
  .bn-tab.on { color: var(--accent-text); background: var(--accent-dim); }
  .bn-tab:active { transform: scale(0.96); }
  .bn-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .bn-create { position: relative; flex-shrink: 0; }
  .bn-fab {
    width: 60px; height: 60px; display: inline-flex; align-items: center; justify-content: center;
    background: var(--accent); color: var(--accent-on);
    border: 2px solid var(--edge-light); border-radius: var(--radius-full); cursor: pointer;
    box-shadow: var(--shadow-sm), var(--shadow-raise);
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.18s, box-shadow 0.18s;
  }
  .bn-fab svg { transition: transform 0.18s; }
  /* Open: the plus turns into a cross and the button sits pressed in. */
  .bn-fab.open svg { transform: rotate(45deg); }
  .bn-fab.open { box-shadow: var(--shadow-press); }
  .bn-fab:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  .bn-scrim { position: fixed; inset: 0; background: var(--scrim-soft); }
  .bn-menu {
    position: absolute; right: 0; bottom: calc(100% + var(--space-3));
    width: min(300px, calc(100vw - 16px)); padding: var(--space-2);
    background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-2xl);
    box-shadow: var(--shadow-xl);
    animation: bnUp 0.18s cubic-bezier(0.16,1,0.3,1);
  }
  .bn-menu-item {
    width: 100%; display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-2); border: none; background: none; border-radius: var(--radius-md);
    color: var(--text); text-decoration: none; text-align: left; cursor: pointer;
  }
  .bn-menu-item:hover, .bn-menu-item:focus-visible { background: var(--ds-soft); outline: none; }
  .bn-menu-item > span:last-child { display: flex; flex-direction: column; gap: var(--space-0-5); min-width: 0; }
  .bn-menu-item strong { font-size: 0.9rem; font-weight: 600; }
  .bn-menu-item > span:last-child > span { font-size: 0.78rem; color: var(--text3); }
  .bn-menu-icon {
    width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--border2); border-radius: var(--radius-lg); color: var(--accent-text); background: var(--ds-card);
  }
}
@keyframes bnUp { from { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .bn-tab, .bn-fab, .bn-fab svg, .bn-menu { transition: none; animation: none; } }
`;
