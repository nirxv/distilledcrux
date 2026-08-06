'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isChat = pathname === '/chat';
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initial = saved ?? 'light';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  const handleSignOut = async () => {
    setDropdownOpen(false);
    setMobileOpen(false);
    await signOut(auth);
    router.push('/');
  };

  const isActive = (href: string) => {
    if (href.includes('#')) return false;
    return pathname === href;
  };

  const NAV_LINKS = [
    { href: '/', label: 'Home' },
    { href: '/#optionals', label: 'Optionals' },
    { href: '/#features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/evaluate', label: 'Evaluate' },
    { href: '/chat', label: 'AI Chat', accent: true },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .nav-desktop-links { display: flex; align-items: center; gap: 0.25rem; }
        .nav-hamburger { display: none; }
        .nav-mobile-overlay {
          display: none;
          position: fixed; inset: 0; z-index: 101;
          background: rgba(0,0,0,0.55);
        }
        .nav-mobile-drawer {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          z-index: 101;
          background: var(--bg-solid);
          padding-top: 60px;
          overflow-y: auto;
          display: flex; flex-direction: column;
          transform: translateY(-4px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.22s ease, transform 0.22s ease;
        }
        .nav-mobile-drawer.open {
          opacity: 1; transform: translateY(0); pointer-events: auto;
        }
        .nav-mobile-link {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 1.5rem;
          font-family: var(--font-ui); font-size: 1rem; font-weight: 500;
          color: var(--text2); text-decoration: none;
          border-bottom: 1px solid var(--border);
          transition: background 0.12s, color 0.12s;
        }
        .nav-mobile-link.active { color: var(--text); font-weight: 600; }
        .nav-mobile-link.accent {
          color: var(--accent);
          background: var(--accent-dim);
        }
        .nav-mobile-link:active { background: var(--bg3); }
        .nav-mobile-bottom {
          margin-top: auto;
          padding: 1.25rem 1.5rem;
          border-top: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 0.75rem;
        }
        .nav-mobile-user {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border);
          margin-bottom: 0.25rem;
        }
        .nav-mobile-user-info { flex: 1; min-width: 0; }
        .nav-mobile-user-name {
          font-family: var(--font-ui); font-weight: 600; font-size: 0.9rem;
          color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .nav-mobile-user-email {
          font-family: var(--font-ui); font-size: 0.75rem;
          color: var(--text3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .nav-mobile-action {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.65rem 0.85rem;
          background: var(--bg3); border: none; border-radius: 8px;
          font-family: var(--font-ui); font-size: 0.88rem; font-weight: 500;
          color: var(--text2); cursor: pointer; text-align: left; width: 100%;
          transition: background 0.12s;
          text-decoration: none;
        }
        .nav-mobile-action.danger { color: var(--red); background: var(--red-dim); }
        .nav-mobile-sign-in {
          display: block; text-align: center;
          background: var(--text); color: var(--bg);
          padding: 0.85rem; border-radius: 10px;
          font-family: var(--font-ui); font-size: 0.95rem; font-weight: 700;
          text-decoration: none;
        }
        @media (max-width: 768px) {
          .nav-desktop-links { display: none; }
          .nav-hamburger { display: flex; }
        }
      ` }} />

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: isChat && navCollapsed ? 0 : 60,
        overflow: isChat && navCollapsed ? 'hidden' : 'visible',
        background: theme === 'dark' ? 'rgba(5,5,8,1)' : 'rgba(248,248,252,1)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem',
      }}>
        <div style={{
          maxWidth: 1100, width: '100%', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.5rem',
        }}>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0, width: 200, display: 'inline-block', position: 'relative', height: '1.4em', verticalAlign: 'middle' }}>
            <span style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              fontFamily: 'var(--font-monument)', fontSize: '0.95rem', fontWeight: 900,
              letterSpacing: '0.06em', whiteSpace: 'nowrap', color: 'var(--text)',
              opacity: scrolled ? 0 : 1,
              transition: 'opacity 0.5s cubic-bezier(0.22,1,0.36,1)',
              pointerEvents: scrolled ? 'none' : 'auto',
            }}>
              DISTILLEDCRUX.COM
            </span>
            <span style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              fontFamily: 'var(--font-monument)', fontSize: '0.95rem', fontWeight: 900,
              letterSpacing: '0.06em', whiteSpace: 'nowrap', color: 'var(--text)',
              opacity: scrolled ? 1 : 0,
              transition: 'opacity 0.5s cubic-bezier(0.22,1,0.36,1)',
              pointerEvents: scrolled ? 'auto' : 'none',
            }}>DC.</span>
          </Link>

          {/* Desktop nav links */}
          <div className="nav-desktop-links">
            {NAV_LINKS.map((item) => {
              const active = isActive(item.href);
              if (item.accent) {
                return (
                  <Link key={item.href} href={item.href} style={{
                    color: active ? 'var(--bg)' : 'var(--text)',
                    textDecoration: 'none', fontSize: '0.85rem',
                    fontFamily: 'var(--font-ui)', fontWeight: 600,
                    padding: '0.4rem 0.75rem', borderRadius: 8,
                    background: active ? 'var(--text)' : 'var(--bg3)',
                    border: '1px solid var(--border2)',
                    transition: 'background 0.15s, color 0.15s',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = 'var(--bg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'var(--text)' : 'var(--bg3)'; e.currentTarget.style.color = active ? 'var(--bg)' : 'var(--text)'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {item.label}
                  </Link>
                );
              }
              return (
                <Link key={item.href} href={item.href} style={{
                  color: active ? 'var(--text)' : 'var(--text3)',
                  textDecoration: 'none', fontSize: '0.85rem',
                  fontFamily: 'var(--font-ui)', fontWeight: active ? 600 : 500,
                  padding: '0.4rem 0.75rem', borderRadius: 8,
                  background: active ? 'var(--bg3)' : 'transparent',
                  transition: 'color 0.15s, background 0.15s',
                }}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg3)'; } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent'; } }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right: theme + avatar + hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>

            {/* Theme toggle — hidden on mobile to save space */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="nav-desktop-links"
              style={{
                background: 'var(--bg3)', border: '1px solid var(--border2)',
                borderRadius: 999, width: 64, height: 32,
                display: 'flex', alignItems: 'center', padding: '0 4px',
                cursor: 'pointer', flexShrink: 0, position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 8, opacity: theme === 'light' ? 0.3 : 0.85, transition: 'opacity 0.2s' }}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill="var(--text2)" />
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', right: 8, opacity: theme === 'dark' ? 0.3 : 0.85, transition: 'opacity 0.2s' }}>
                <circle cx="12" cy="12" r="5" fill="var(--text2)" />
                <g stroke="var(--text2)" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </g>
              </svg>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--text)', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                transform: theme === 'dark' ? 'translateX(0)' : 'translateX(32px)',
                transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
                flexShrink: 0,
              }} />
            </button>

            {/* Desktop avatar dropdown */}
            {!loading && user && (
              <div ref={dropdownRef} style={{ position: 'relative' }} className="nav-desktop-links">
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  style={{
                    background: 'none', border: '2px solid var(--border2)',
                    borderRadius: '50%', width: 36, height: 36, padding: 0,
                    cursor: 'pointer', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'border-color 0.15s',
                  }}
                >
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer"
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--bg)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)', fontWeight: 700,
                    }}>
                      {(user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                    </span>
                  )}
                </button>
                {dropdownOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    background: 'var(--bg2)', border: '1px solid var(--border2)',
                    borderRadius: 12, padding: '0.5rem', minWidth: 200,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 200,
                  }}>
                    <div style={{ padding: '0.6rem 0.75rem 0.75rem', borderBottom: '1px solid var(--border)', marginBottom: '0.4rem' }}>
                      <div style={{ color: 'var(--text)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '0.85rem', marginBottom: 2 }}>
                        {user.displayName ?? 'User'}
                      </div>
                      <div style={{ color: 'var(--text3)', fontFamily: 'var(--font-ui)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </div>
                    </div>
                    <button onClick={() => { setDropdownOpen(false); router.push('/onboarding?change=1'); }}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 8, padding: '0.55rem 0.75rem', color: 'var(--text2)', fontFamily: 'var(--font-ui)', fontSize: '0.83rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.12s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                      </svg>
                      Change Optional
                    </button>
                    <button onClick={handleSignOut}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 8, padding: '0.55rem 0.75rem', color: 'var(--red)', fontFamily: 'var(--font-ui)', fontSize: '0.83rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.12s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--red-dim)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                      </svg>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Desktop sign-in */}
            {!loading && !user && (
              <Link href="/login" className="nav-desktop-links" style={{
                background: 'var(--text)', color: 'var(--bg)',
                textDecoration: 'none', padding: '0.4rem 1rem', borderRadius: 8,
                fontSize: '0.85rem', fontFamily: 'var(--font-ui)', fontWeight: 600,
                transition: 'opacity 0.15s',
              }}>
                Sign in
              </Link>
            )}

            {/* Hamburger button — mobile only */}
            <button
              className="nav-hamburger"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              style={{
                background: 'none', border: '1px solid var(--border2)',
                borderRadius: 8, width: 38, height: 38, padding: 0,
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 5, cursor: 'pointer', flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <span style={{
                display: 'block', width: 18, height: 1.5,
                background: 'var(--text)',
                transform: mobileOpen ? 'translateY(6.5px) rotate(45deg)' : 'none',
                transition: 'transform 0.22s ease',
                borderRadius: 2,
              }} />
              <span style={{
                display: 'block', width: 18, height: 1.5,
                background: 'var(--text)',
                opacity: mobileOpen ? 0 : 1,
                transition: 'opacity 0.15s',
                borderRadius: 2,
              }} />
              <span style={{
                display: 'block', width: 18, height: 1.5,
                background: 'var(--text)',
                transform: mobileOpen ? 'translateY(-6.5px) rotate(-45deg)' : 'none',
                transition: 'transform 0.22s ease',
                borderRadius: 2,
              }} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="nav-mobile-overlay" onClick={() => setMobileOpen(false)} style={{ display: 'block' }} />
      )}

      {/* Mobile drawer */}
      <div className={`nav-mobile-drawer${mobileOpen ? ' open' : ''}`}>
        {/* Nav links */}
        <div style={{ flex: 1 }}>
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-mobile-link${isActive(item.href) ? ' active' : ''}${item.accent ? ' accent' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {item.accent && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                )}
                {item.label}
              </span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          ))}
        </div>

        {/* Bottom: user info + actions */}
        <div className="nav-mobile-bottom">
          {/* Theme toggle row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)', marginBottom: '0.25rem' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--text2)' }}>
              {theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}
            </span>
            <button onClick={toggleTheme} style={{
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 999, width: 52, height: 28,
              display: 'flex', alignItems: 'center', padding: '0 3px',
              cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: 'var(--text)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                transform: theme === 'dark' ? 'translateX(0)' : 'translateX(24px)',
                transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)', flexShrink: 0,
              }} />
            </button>
          </div>

          {!loading && user ? (
            <>
              <div className="nav-mobile-user">
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
                  border: '2px solid var(--border2)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--text)',
                }}>
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: 'var(--bg)', fontSize: '0.9rem', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>
                      {(user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="nav-mobile-user-info">
                  <div className="nav-mobile-user-name">{user.displayName ?? 'User'}</div>
                  <div className="nav-mobile-user-email">{user.email}</div>
                </div>
              </div>
              <button
                className="nav-mobile-action"
                onClick={() => { setMobileOpen(false); router.push('/onboarding?change=1'); }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
                Change Optional
              </button>
              <button className="nav-mobile-action danger" onClick={handleSignOut}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                Sign out
              </button>
            </>
          ) : (
            !loading && (
              <Link href="/login" className="nav-mobile-sign-in" onClick={() => setMobileOpen(false)}>
                Sign in →
              </Link>
            )
          )}
        </div>
      </div>

      {/* Chat collapse button */}
      {isChat && (
        <button
          onClick={() => setNavCollapsed(c => !c)}
          title={navCollapsed ? 'Show navbar' : 'Hide navbar'}
          style={{
            position: 'fixed', top: navCollapsed ? 6 : 66, right: 14, zIndex: 300,
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            borderRadius: 999, width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'top 0.2s ease',
            fontSize: '0.55rem', color: 'var(--text3)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)', padding: 0,
          }}
        >
          {navCollapsed ? '▼' : '▲'}
        </button>
      )}
    </>
  );
}
