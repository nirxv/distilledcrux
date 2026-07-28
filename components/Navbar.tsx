'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };

  const isActive = (href: string) => pathname === href;

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 60,
      background: 'rgba(5,5,8,0.85)',
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
          {[
            { href: '/', label: 'Home' },
            { href: '/dashboard', label: 'Dashboard' },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{
              color: isActive(item.href) ? 'var(--text)' : 'var(--text3)',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-ui)',
              fontWeight: 500,
              padding: '0.4rem 0.75rem',
              borderRadius: 8,
              transition: 'color 0.15s',
            }}>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loading ? null : user ? (
            <>
              <span style={{
                color: 'var(--text3)', fontSize: '0.8rem',
                fontFamily: 'var(--font-ui)',
                maxWidth: 140, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.email}
              </span>
              <button onClick={handleSignOut} style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border2)',
                color: 'var(--text2)',
                cursor: 'pointer',
                padding: '0.4rem 0.9rem',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontFamily: 'var(--font-ui)',
                fontWeight: 500,
                transition: 'all 0.15s',
              }}>
                Sign out
              </button>
            </>
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
