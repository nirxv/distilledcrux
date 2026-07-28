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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load saved theme
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initial = saved ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut(auth);
    router.push('/');
  };

  const isActive = (href: string) => pathname === href;

  const NAV_LINKS = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/prelims', label: 'Prelims' },
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 60,
      background: theme === 'dark' ? 'rgba(5,5,8,0.85)' : 'rgba(248,248,252,0.88)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 1.5rem',
    }}>
      <div style={{
        maxWidth: 1100, width: '100%', margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.15rem', fontWeight: 700,
            color: 'var(--text)', letterSpacing: '-0.02em',
          }}>
            Prep<span style={{ color: 'var(--accent)' }}>Pandit</span>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {NAV_LINKS.map((item) => (
            <Link key={item.href} href={item.href} style={{
              color: isActive(item.href) ? 'var(--text)' : 'var(--text3)',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-ui)',
              fontWeight: isActive(item.href) ? 600 : 500,
              padding: '0.4rem 0.75rem',
              borderRadius: 8,
              background: isActive(item.href) ? 'var(--bg3)' : 'transparent',
              transition: 'color 0.15s, background 0.15s',
            }}>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right side: theme toggle + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

          {/* Dark/Light toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border2)',
              borderRadius: 8,
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Auth section */}
          {loading ? null : user ? (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              {/* Avatar button */}
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                style={{
                  background: 'none',
                  border: '2px solid var(--border2)',
                  borderRadius: '50%',
                  width: 36, height: 36,
                  padding: 0,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'border-color 0.15s',
                }}
              >
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{
                    width: 32, height: 32,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 700,
                  }}>
                    {(user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--bg2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 12,
                  padding: '0.5rem',
                  minWidth: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  zIndex: 200,
                }}>
                  {/* User info */}
                  <div style={{
                    padding: '0.6rem 0.75rem 0.75rem',
                    borderBottom: '1px solid var(--border)',
                    marginBottom: '0.4rem',
                  }}>
                    <div style={{
                      color: 'var(--text)',
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      marginBottom: 2,
                    }}>
                      {user.displayName ?? 'User'}
                    </div>
                    <div style={{
                      color: 'var(--text3)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.75rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {user.email}
                    </div>
                  </div>

                  {/* Change optional */}
                  <button
                    onClick={() => { setDropdownOpen(false); router.push('/onboarding'); }}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderRadius: 8,
                      padding: '0.55rem 0.75rem',
                      color: 'var(--text2)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.83rem',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <span>🔄</span> Change Optional
                  </button>

                  {/* Sign out */}
                  <button
                    onClick={handleSignOut}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderRadius: 8,
                      padding: '0.55rem 0.75rem',
                      color: 'var(--red)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.83rem',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--red-dim)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <span>👋</span> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" style={{
              background: 'var(--accent)',
              color: '#fff',
              textDecoration: 'none',
              padding: '0.4rem 1rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontFamily: 'var(--font-ui)',
              fontWeight: 600,
              transition: 'opacity 0.15s',
            }}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}