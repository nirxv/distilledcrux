'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';
import { routeSlugForOptional, labelForOptional } from '@/lib/optionals';
import { useOptional } from '@/components/useOptional';
import { TOPPER_SUBJECTS, isTopperSubject } from '@/lib/toppers/meta';
import { REFERRAL_REWARD_PAISE, formatPaise } from '@/lib/referral';
import { cacheBalance, cachedBalance } from '@/lib/referralClient';

// The ⌘K palette carries every note's title; it is fetched the first time
// it is wanted, not with every page.
const CommandPalette = dynamic(() => import('@/components/CommandPalette'), { ssr: false });
const loadPalette = () => { void import('@/components/CommandPalette'); };

type NavLink = { href: string; label: string; accent?: boolean };
/** A link in the bar that opens a short menu instead of going somewhere. */
type NavMenu = { label: string; items: { href: string; label: string; note: string; icon: ReactNode }[] };
type NavItem = NavLink | NavMenu;

const Icon = {
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  chat: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  moon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" /></svg>,
  sun: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>,
  dash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  plans: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" /></svg>,
  swap: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>,
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" /></svg>,
  gift: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" /></svg>,
  out: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  arrow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  chev: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>,
  notes: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /></svg>,
  cards: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h14v14H3zM7 6V4h14v14h-2M7 11h6M7 15h4" /></svg>,
  pyq: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4h6v3H9zM9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15M9 12h6M9 16h4" /></svg>,
  copy: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12.5c1.2-1 2.2-1 3 0s1.8 1 3 0M9 16.5c1.2-1 2.2-1 3 0" /></svg>,
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const optional = useOptional();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [menuOpen, setMenuOpen] = useState(false);
  // The invite balance, shown on every page as a nudge to share: the amount,
  // or "Earn ₹100" at nothing. Kept in the browser for half an hour.
  const [inviteBalance, setInviteBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    (async () => {
      const cached = cachedBalance(user.uid);
      if (cached !== null) { if (live) setInviteBalance(cached); return; }
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/referral/balance', { headers: { 'x-user-token': token } });
        if (!res.ok) return;
        const { balancePaise } = await res.json();
        cacheBalance(user.uid, balancePaise);
        if (live) setInviteBalance(balancePaise);
      } catch { /* no chip this time */ }
    })();
    return () => { live = false; };
  }, [user]);
  // Which bar menu is open, by its label. One at a time: Notes and PYQs are
  // both menus, and a single open flag opened them together.
  const [dropOpen, setDropOpen] = useState<string | null>(null);
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
      if (!(e.target instanceof Element && e.target.closest('.nb-drop'))) setDropOpen(null);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      setDropOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  // The phone's bottom bar floats over every page (BottomNav), so over the
  // sheet it covered the last rows, Sign out among them. The sheet has every
  // link the bar has, so the bar steps aside while it is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    document.body.classList.toggle('nb-sheet-open', mobileOpen);
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('nb-sheet-open');
    };
  }, [mobileOpen]);

  // A new page closes whatever was open.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMobileOpen(false);
    setMenuOpen(false);
    setDropOpen(null);
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
   * subject. Pricing is in both, so the plans are never more than a click
   * away. The chat is set apart, Dashboard lives in the account menu, and
   * everything else is a ⌘K away.
   *
   * Flashcards sit under Notes, as the other way of going over the same
   * topics. The phone sheet has room for every link, so there it is a flat
   * list with Flashcards straight after Notes.
   */
  const slug = routeSlugForOptional(optional);
  const optionalLabel = labelForOptional(optional);
  const links: NavItem[] = slug
    ? [
        {
          label: 'Notes',
          items: [
            { href: `/notes/${slug}`, label: 'Notes', note: 'Every topic in the syllabus', icon: Icon.notes },
            { href: `/${slug}/flashcards`, label: 'Flashcards', note: 'Revise with spaced repetition', icon: Icon.cards },
          ],
        },
        // Topper copies sit with the PYQs: they are filed by the questions they answer.
        isTopperSubject(slug)
          ? {
              label: 'PYQs',
              items: [
                { href: `/${slug}/pyqs`, label: 'Past questions', note: 'Every question UPSC has set', icon: Icon.pyq },
                { href: `/${slug}/topper-copies`, label: 'Topper copies', note: 'Handwritten answers by rankers', icon: Icon.copy },
              ],
            }
          : { href: `/${slug}/pyqs`, label: 'PYQs' },
        ...(optional === 'geography' ? [{ href: '/geography/mapping', label: 'Maps' }] : []),
        // /test reads ?optional=, the profile spelling, not the route slug.
        { href: `/test?optional=${optional}`, label: 'Tests' },
        { href: '/evaluate', label: 'Evaluate' },
        { href: '/pricing', label: 'Pricing' },
        { href: '/chat', label: 'AI Chat', accent: true },
      ]
    : [
        { href: '/#optionals', label: 'Optionals' },
        { href: '/evaluate', label: 'Evaluate' },
        { href: '/test', label: 'Tests' },
        { href: '/pricing', label: 'Pricing' },
        { href: '/chat', label: 'AI Chat', accent: true },
      ];
  const flatLinks: NavLink[] = links.flatMap((l) => ('items' in l ? l.items.map(({ href, label }) => ({ href, label })) : [l]));
  // The phone sheet lists topper copies for every reader: under the PYQs for
  // an optional that has them, and for one that has none yet, the copies there
  // are (Sociology so far), under the same plain name.
  const otherToppers: NavLink[] = slug && isTopperSubject(slug)
    ? []
    : [{ href: `/${TOPPER_SUBJECTS[0]}/topper-copies`, label: 'Topper copies' }];
  const toppersAfter = flatLinks.findIndex((l) => l.href === (slug ? `/${slug}/pyqs` : '/#optionals')) + 1;
  const sheetLinks: NavLink[] = [
    ...flatLinks.slice(0, toppersAfter),
    ...otherToppers,
    ...flatLinks.slice(toppersAfter),
    ...(user ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
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
            {links.map((l) => 'items' in l ? (
              <div key={l.label} className="nb-drop">
                <button
                  className={`nb-link nb-drop-btn${l.items.some((i) => isActive(i.href)) ? ' on' : ''}`}
                  onClick={() => setDropOpen((o) => (o === l.label ? null : l.label))}
                  aria-expanded={dropOpen === l.label}
                  aria-haspopup="menu"
                >
                  {l.label}
                  {Icon.chev}
                </button>
                {dropOpen === l.label && (
                  <div className="nb-menu nb-drop-menu" role="menu" aria-label={l.label}>
                    {l.items.map((i) => (
                      <Link
                        key={i.href}
                        href={i.href}
                        role="menuitem"
                        className={`nb-drop-item${isActive(i.href) ? ' on' : ''}`}
                        aria-current={isActive(i.href) ? 'page' : undefined}
                        onClick={() => setDropOpen(null)}
                      >
                        <span className="nb-drop-icon">{i.icon}</span>
                        <span className="nb-drop-text"><strong>{i.label}</strong><small>{i.note}</small></span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
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

            {!loading && user && inviteBalance !== null && (
              <Link href="/invite" className="nb-invite"
                aria-label={inviteBalance > 0 ? `Invite balance ${formatPaise(inviteBalance)}` : `Invite friends and earn ${formatPaise(REFERRAL_REWARD_PAISE)} each`}>
                {Icon.gift}<span>{inviteBalance > 0 ? formatPaise(inviteBalance) : `Earn ${formatPaise(REFERRAL_REWARD_PAISE)}`}</span>
              </Link>
            )}

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
                    <Link href="/invite" className="nb-menu-item" role="menuitem">{Icon.gift}Invite a friend</Link>
                    <Link href="/profile" className="nb-menu-item" role="menuitem">{Icon.user}Profile and settings</Link>
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
        {/* On phones the invite chip lives here, not in the header, so the bar stays uncluttered. */}
        {user && inviteBalance !== null && (
          <Link href="/invite" className="nb-sheet-invite">
            <span className="nb-sheet-invite-icon">{Icon.gift}</span>
            <span className="nb-sheet-invite-text">
              <strong>{inviteBalance > 0 ? `Your invite balance: ${formatPaise(inviteBalance)}` : `Invite friends, earn ${formatPaise(REFERRAL_REWARD_PAISE)} each`}</strong>
              <small>{inviteBalance > 0 ? 'Share your link to earn more' : `They pay ${formatPaise(REFERRAL_REWARD_PAISE)} less on their first yearly plan`}</small>
            </span>
            {Icon.arrow}
          </Link>
        )}
        <div className="nb-sheet-links">
          {sheetLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`nb-sheet-link${isActive(l.href) ? ' on' : ''}${l.accent ? ' accent' : ''}`}>
              <span>{l.accent && Icon.chat}{l.label}</span>
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
                <Link className="ds-btn ds-btn-line ds-btn-sm" href="/profile">{Icon.user}Profile</Link>
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
.nb-links { display: flex; align-items: center; gap: 2px; margin-left: var(--space-4); flex-shrink: 0; }
.nb-link {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: var(--radius-md);
  color: var(--text2); text-decoration: none; font-size: 0.92rem; white-space: nowrap;
  transition: color 0.15s, background 0.15s;
}
.nb-link:hover { color: var(--text); background: var(--ds-soft); }
.nb-link.on { color: var(--text); font-weight: 700; }
.nb-link.accent { color: var(--accent-text); background: var(--accent-dim); margin-left: var(--space-1); }
.nb-link.accent:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.nb-link.accent.on { background: var(--accent); color: var(--accent-on); }
.nb-drop { position: relative; }
.nb-drop-btn { border: none; background: none; font: inherit; font-size: 0.92rem; cursor: pointer; }
.nb-drop-btn svg { color: var(--text3); transition: transform 0.15s; }
.nb-drop-btn[aria-expanded="true"] { color: var(--text); background: var(--ds-soft); }
.nb-drop-btn[aria-expanded="true"] svg { transform: rotate(180deg); }
.nb-menu.nb-drop-menu { left: 0; right: auto; width: 300px; }
.nb-drop-item {
  display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2);
  border-radius: var(--radius-md); color: var(--text); text-decoration: none;
}
.nb-drop-item:hover, .nb-drop-item.on { background: var(--ds-soft); }
.nb-drop-icon {
  width: 36px; height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-md); background: var(--accent-dim); color: var(--accent-text);
}
.nb-drop-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.nb-drop-text strong { font-size: 0.92rem; }
.nb-drop-text small { font-size: 0.8rem; color: var(--text3); }
.nb-right { display: flex; align-items: center; gap: var(--space-2); margin-left: auto; min-width: 0; }
.nb-invite {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; height: 34px; padding: 0 12px;
  border-radius: var(--radius-full); background: var(--accent-dim); color: var(--accent-text);
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  font-family: var(--font-ui); font-size: 0.84rem; font-weight: 700; white-space: nowrap; text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}
.nb-invite:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.nb-invite svg { width: 15px; height: 15px; }
@media (max-width: 920px) { .nb-invite { display: none; } }
.nb-sheet-invite {
  display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; margin-bottom: var(--space-3); padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg); background: var(--accent-dim); border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--text); text-decoration: none;
}
.nb-sheet-invite-icon { flex-shrink: 0; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--ds-card); color: var(--accent-text); }
.nb-sheet-invite-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.nb-sheet-invite-text strong { font-size: 0.95rem; font-weight: 700; color: var(--accent-text); }
.nb-sheet-invite-text small { font-family: var(--font-ui); font-size: 0.8rem; line-height: 1.4; color: var(--text3); }
.nb-sheet-invite > svg { flex-shrink: 0; color: var(--accent-text); }
.nb-search {
  display: inline-flex; align-items: center; gap: var(--space-2);
  height: 38px; padding: 0 6px 0 var(--space-3); width: clamp(200px, 22vw, 320px); min-width: 0;
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
  padding: var(--space-4) var(--space-4) max(var(--space-4), env(safe-area-inset-bottom, 0px));
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
  .nb-links { margin-left: var(--space-2); }
  .nb-link { padding: 7px 9px; }
}
@media (max-width: 920px) {
  .nb-links, .nb-theme, .nb-account, .nb-signin { display: none; }
  .nb-burger { display: inline-flex; }
  .nb { padding: 0 var(--space-3); }
}
@media (min-width: 921px) { .nb-sheet { display: none; } }
@media (prefers-reduced-motion: reduce) { .nb-sheet, .nb-burger span, .nb-drop-btn svg { transition: none; } }
`;
