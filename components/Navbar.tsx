'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';
import { routeSlugForOptional, labelForOptional } from '@/lib/optionals';
import { useOptional } from '@/components/useOptional';

// The ⌘K palette carries every note's title; it is fetched the first time
// it is wanted, not with every page.
const CommandPalette = dynamic(() => import('@/components/CommandPalette'), { ssr: false });
const loadPalette = () => { void import('@/components/CommandPalette'); };

type NavLink = { href: string; label: string; accent?: boolean };

const Icon = {
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  chat: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  moon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" /></svg>,
  sun: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>,
  dash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  plans: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" /></svg>,
  swap: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>,
  out: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  arrow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const optional = useOptional();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initial = saved ?? 'light';
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // A new page closes whatever was open.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const openPalette = useCallback(() => {
    setPaletteMounted(true);
    setPaletteOpen(true);
    setMobileOpen(false);
  }, []);

  // ⌘K or Ctrl+K anywhere; "/" when the reader is not already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
      else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); openPalette(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPalette]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    setMobileOpen(false);
    await signOut(auth);
    router.push('/');
  };

  const isActive = (href: string) => {
    if (href.includes('#')) return false;
    const path = href.split('?')[0];
    return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
  };

  /**
   * Two sets of links. Before a reader has an optional the bar points at what
   * the site offers; once they have one it is their workspace for that
   * subject. Either way it stays at five or six, with the chat set apart:
   * Dashboard and Plans live in the account menu, and everything else is a
   * ⌘K away.
   */
  const slug = routeSlugForOptional(optional);
  const optionalLabel = labelForOptional(optional);
  const links: NavLink[] = slug
    ? [
        { href: `/notes/${slug}`, label: 'Notes' },
        { href: `/${slug}/pyqs`, label: 'PYQs' },
        ...(optional === 'geography' ? [{ href: '/geography/mapping', label: 'Maps' }] : []),
        // /test reads ?optional=, the profile spelling, not the route slug.
        { href: `/test?optional=${optional}`, label: 'Tests' },
        { href: '/evaluate', label: 'Evaluate' },
        { href: '/chat', label: 'AI Chat', accent: true },
      ]
    : [
        { href: '/#optionals', label: 'Optionals' },
        { href: '/evaluate', label: 'Evaluate' },
        { href: '/test', label: 'Tests' },
        { href: '/pricing', label: 'Pricing' },
        { href: '/chat', label: 'AI Chat', accent: true },
      ];

  const initial = (user?.displayName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
  const avatar = (size: number) => user?.photoURL
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" width={size} height={size} className="nb-avatar-img" />
    : <span className="nb-avatar-letter" style={{ width: size, height: size }}>{initial}</span>;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: NAV_CSS }} />
      <nav className="nb ds" aria-label="Main">
        <div className="nb-inner">
          <Link href="/" className="nb-brand" aria-label="Distilled Crux, home">
            <Image src="/mascot/owl.svg" alt="" width={30} height={28} priority />
            <span>Distilled Crux</span>
          </Link>

          <div className="nb-links">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nb-link${l.accent ? ' accent' : ''}${isActive(l.href) ? ' on' : ''}`}
                aria-current={isActive(l.href) ? 'page' : undefined}
              >
                {l.accent && Icon.chat}
                {l.label}
              </Link>
            ))}
          </div>

          <div className="nb-right">
            <button className="nb-search" onClick={openPalette} onMouseEnter={loadPalette} onFocus={loadPalette} aria-label="Search the site">
              {Icon.search}
              <span className="nb-search-text">Search notes, or ask the AI</span>
              <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
            </button>

            <button className="nb-icon nb-theme" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              {theme === 'dark' ? Icon.sun : Icon.moon}
            </button>

            {!loading && user && (
              <div ref={menuRef} className="nb-account">
                <button className="nb-avatar" onClick={() => setMenuOpen((o) => !o)} aria-label="Your account" aria-expanded={menuOpen} aria-haspopup="menu">
                  {avatar(32)}
                </button>
                {menuOpen && (
                  <div className="nb-menu" role="menu">
                    <div className="nb-menu-head">
                      <strong>{user.displayName ?? 'Your account'}</strong>
                      <span>{user.email}</span>
                      {optionalLabel && <span className="ds-tag">{optionalLabel}</span>}
                    </div>
                    <Link href="/dashboard" className="nb-menu-item" role="menuitem">{Icon.dash}Dashboard</Link>
                    <Link href="/pricing" className="nb-menu-item" role="menuitem">{Icon.plans}Plans</Link>
                    <Link href="/onboarding?change=1" className="nb-menu-item" role="menuitem">{Icon.swap}Change optional</Link>
                    <button className="nb-menu-item danger" role="menuitem" onClick={handleSignOut}>{Icon.out}Sign out</button>
                  </div>
                )}
              </div>
            )}

            {!loading && !user && (
              <Link href="/login" className="ds-btn ds-btn-solid ds-btn-sm nb-signin">Sign in</Link>
            )}

            <button
              className={`nb-icon nb-burger${mobileOpen ? ' open' : ''}`}
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      <div className={`nb-sheet ds${mobileOpen ? ' open' : ''}`} aria-hidden={!mobileOpen}>
        <button className="nb-sheet-search" onClick={openPalette}>{Icon.search}Search notes, tools, or ask the AI</button>
        <div className="nb-sheet-links">
          {[...links, ...(user ? [{ href: '/dashboard', label: 'Dashboard' }] : []), ...(slug ? [{ href: '/pricing', label: 'Plans' }] : [])].map((l) => (
            <Link key={l.href} href={l.href} className={`nb-sheet-link${isActive(l.href) ? ' on' : ''}${(l as NavLink).accent ? ' accent' : ''}`}>
              <span>{(l as NavLink).accent && Icon.chat}{l.label}</span>
              {Icon.arrow}
            </Link>
          ))}
        </div>
        <div className="nb-sheet-foot">
          {!loading && user ? (
            <>
              <div className="nb-sheet-user">
                <span className="nb-avatar">{avatar(36)}</span>
                <div>
                  <strong>{user.displayName ?? 'Your account'}</strong>
                  <span>{user.email}</span>
                </div>
              </div>
              <div className="nb-sheet-actions">
                <button className="ds-btn ds-btn-line ds-btn-sm" onClick={toggleTheme}>{theme === 'dark' ? Icon.sun : Icon.moon}{theme === 'dark' ? 'Light' : 'Dark'}</button>
                <Link className="ds-btn ds-btn-line ds-btn-sm" href="/onboarding?change=1">{Icon.swap}Optional</Link>
                <button className="ds-btn ds-btn-line ds-btn-sm nb-danger" onClick={handleSignOut}>{Icon.out}Sign out</button>
              </div>
            </>
          ) : !loading && (
            <div className="nb-sheet-actions">
              <button className="ds-btn ds-btn-line" onClick={toggleTheme}>{theme === 'dark' ? Icon.sun : Icon.moon}{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
              <Link className="ds-btn ds-btn-solid" href="/login">Sign in</Link>
            </div>
          )}
        </div>
      </div>

      {paletteMounted && (
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} subject={slug} />
      )}
    </>
  );
}

const NAV_CSS = `
.nb {
  position: fixed; top: 0; left: 0; right: 0; z-index: 102; height: 60px;
  display: flex; align-items: center; padding: 0 var(--space-5);
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: saturate(1.4) blur(12px); -webkit-backdrop-filter: saturate(1.4) blur(12px);
  border-bottom: 1px solid var(--border);
}
.nb-inner { width: 100%; max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: var(--space-4); }
.nb-brand { display: inline-flex; align-items: center; gap: var(--space-2); text-decoration: none; color: var(--text); flex-shrink: 0; }
.nb-brand span { font-family: var(--font-body); font-weight: 700; font-size: 1.06rem; letter-spacing: -0.01em; }
.nb-links { display: flex; align-items: center; gap: 2px; margin-left: var(--space-4); }
.nb-link {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: var(--radius-md);
  color: var(--text2); text-decoration: none; font-size: 0.92rem;
  transition: color 0.15s, background 0.15s;
}
.nb-link:hover { color: var(--text); background: var(--ds-soft); }
.nb-link.on { color: var(--text); font-weight: 700; }
.nb-link.accent { color: var(--accent-text); background: var(--accent-dim); margin-left: var(--space-1); }
.nb-link.accent:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.nb-link.accent.on { background: var(--accent); color: var(--accent-on); }
.nb-right { display: flex; align-items: center; gap: var(--space-2); margin-left: auto; }
.nb-search {
  display: inline-flex; align-items: center; gap: var(--space-2);
  height: 38px; padding: 0 6px 0 var(--space-3); width: clamp(200px, 22vw, 320px);
  background: var(--ds-soft); color: var(--text3);
  border: 1px solid var(--border2); border-radius: var(--radius-full);
  font-size: 0.88rem; cursor: pointer; transition: border-color 0.15s, color 0.15s;
}
.nb-search:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); color: var(--text2); }
.nb-search-text { flex: 1; min-width: 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nb-search kbd {
  font-family: var(--font-ui); font-size: 0.7rem; color: var(--text3);
  padding: 2px 7px; border: 1px solid var(--border2); border-radius: var(--radius-full); background: var(--ds-card);
}
.nb-icon {
  width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center;
  background: none; border: 1px solid transparent; border-radius: var(--radius-md); color: var(--text2); cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.nb-icon:hover { background: var(--ds-soft); color: var(--text); }
.nb-account { position: relative; }
.nb-avatar {
  width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--border2); border-radius: var(--radius-circle); background: var(--ds-card); cursor: pointer; overflow: hidden;
}
.nb-avatar-img { border-radius: var(--radius-circle); object-fit: cover; display: block; }
.nb-avatar-letter {
  display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-circle);
  background: var(--accent-dim); color: var(--accent-text); font-family: var(--font-ui); font-weight: 700; font-size: 0.85rem;
}
.nb-menu {
  position: absolute; top: calc(100% + 10px); right: 0; z-index: 200; width: 250px;
  background: var(--ds-card); border: 1px solid var(--border2); border-radius: var(--radius-xl);
  box-shadow: var(--elev-3); padding: var(--space-2);
}
.nb-menu-head { display: flex; flex-direction: column; gap: 2px; padding: var(--space-2) var(--space-2) var(--space-3); margin-bottom: var(--space-1); border-bottom: 1px solid var(--border); }
.nb-menu-head strong { font-size: 0.92rem; }
.nb-menu-head span { font-family: var(--font-ui); font-size: 0.78rem; color: var(--text3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nb-menu-head .ds-tag { align-self: flex-start; margin-top: var(--space-2); color: var(--accent-text); }
.nb-menu-item {
  width: 100%; display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2); border: none; background: none; border-radius: var(--radius-md);
  color: var(--text); font-size: 0.9rem; text-decoration: none; text-align: left; cursor: pointer;
}
.nb-menu-item svg { color: var(--text3); }
.nb-menu-item:hover { background: var(--ds-soft); }
.nb-menu-item.danger, .nb-menu-item.danger svg, .nb-danger { color: var(--danger-text); }
.nb-burger { display: none; flex-direction: column; gap: 4px; }
.nb-burger span { display: block; width: 18px; height: 1.6px; border-radius: 2px; background: var(--text); transition: transform 0.2s, opacity 0.15s; }
.nb-burger.open span:nth-child(1) { transform: translateY(5.6px) rotate(45deg); }
.nb-burger.open span:nth-child(2) { opacity: 0; }
.nb-burger.open span:nth-child(3) { transform: translateY(-5.6px) rotate(-45deg); }

.nb-sheet {
  position: fixed; inset: 60px 0 0 0; z-index: 101;
  background: var(--bg); display: flex; flex-direction: column; overflow-y: auto;
  padding: var(--space-4);
  opacity: 0; visibility: hidden; transform: translateY(-6px); pointer-events: none;
  transition: opacity 0.18s, transform 0.18s, visibility 0s linear 0.18s;
}
.nb-sheet.open { opacity: 1; visibility: visible; transform: none; pointer-events: auto; transition: opacity 0.18s, transform 0.18s; }
.nb-sheet-search {
  display: flex; align-items: center; gap: var(--space-2); width: 100%; height: 46px; padding: 0 var(--space-4);
  background: var(--ds-card); color: var(--text3); border: 1px solid var(--border2); border-radius: var(--radius-lg);
  font-size: 0.95rem; text-align: left; cursor: pointer; margin-bottom: var(--space-3);
}
.nb-sheet-links { display: flex; flex-direction: column; }
.nb-sheet-link {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-4) var(--space-2); border-bottom: 1px solid var(--border);
  color: var(--text); text-decoration: none; font-size: 1.05rem;
}
.nb-sheet-link span { display: inline-flex; align-items: center; gap: var(--space-2); }
.nb-sheet-link svg { color: var(--text3); }
.nb-sheet-link.on { font-weight: 700; }
.nb-sheet-link.accent { color: var(--accent-text); }
.nb-sheet-foot { margin-top: auto; padding-top: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
.nb-sheet-user { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--ds-card); }
.nb-sheet-user div { display: flex; flex-direction: column; min-width: 0; }
.nb-sheet-user strong { font-size: 0.95rem; }
.nb-sheet-user span { font-family: var(--font-ui); font-size: 0.78rem; color: var(--text3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nb-sheet-actions { display: flex; gap: var(--space-2); }
.nb-sheet-actions > * { flex: 1; }

@media (max-width: 1080px) {
  .nb-search { width: auto; padding: 0 var(--space-3); }
  .nb-search-text, .nb-search kbd { display: none; }
}
@media (max-width: 860px) {
  .nb-links, .nb-theme, .nb-account, .nb-signin { display: none; }
  .nb-burger { display: inline-flex; }
  .nb { padding: 0 var(--space-3); }
}
@media (min-width: 861px) { .nb-sheet { display: none; } }
@media (prefers-reduced-motion: reduce) { .nb-sheet, .nb-burger span { transition: none; } }
`;
