import type { Metadata } from 'next';
import Link from 'next/link';
import { allNotes } from '@/lib/notes';

export const metadata: Metadata = {
  title: 'Optional Notes — UPSC Mains Preparation | Distilled Crux',
  description: 'Comprehensive free notes for UPSC Optional subjects — Sociology, Anthropology, Political Science, Geography and Public Administration. Topic-wise structured for Mains.',
  alternates: { canonical: 'https://distilledcrux.com/notes' },
};

const SUBJECTS = [
  {
    slug: 'sociology',
    name: 'Sociology',
    sub: 'Fundamentals · Indian Society · Social Change',
    paper1: 'Fundamentals of Sociology',
    paper2: 'Indian Society: Structure and Change',
    color: '#4361ee',
    icon: '🧩',
    available: true,
  },
  {
    slug: 'anthropology',
    name: 'Anthropology',
    sub: 'Physical · Social · Applied',
    paper1: 'Physical & Biological Anthropology',
    paper2: 'Indian Anthropology & Tribal Studies',
    color: '#2dd4bf',
    icon: '🧬',
    available: false,
  },
  {
    slug: 'polsci',
    name: 'Political Science',
    sub: 'Theory · IR · Comparative Politics',
    paper1: 'Political Theory & Indian Polity',
    paper2: 'Comparative Politics & IR',
    color: '#f87171',
    icon: '⚖️',
    available: false,
  },
  {
    slug: 'geography',
    name: 'Geography',
    sub: 'Physical · Human · Economic',
    paper1: 'Physical Geography',
    paper2: 'Human & Economic Geography',
    color: '#4ade80',
    icon: '🌍',
    available: false,
  },
  {
    slug: 'pub-admin',
    name: 'Public Administration',
    sub: 'Theory · Indian Administration',
    paper1: 'Administrative Theory',
    paper2: 'Indian Administration',
    color: '#fb923c',
    icon: '📋',
    available: false,
  },
];

export default function NotesPage() {
  const sociologyCount = allNotes.length;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
      <div style={{ color: 'var(--text3)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
        Distilled Crux
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>
        Notes
      </h1>
      <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '2.5rem' }}>
        Topic-wise structured notes · Paper I & II · Free for all aspirants
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {SUBJECTS.map(({ slug, name, sub, color, icon, available }) => {
          const count = slug === 'sociology' ? sociologyCount : 0;
          const card = (
            <div style={{
              background: 'var(--bg2)',
              border: `1px solid ${available ? 'var(--border2)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '1.5rem',
              borderLeft: `3px solid ${available ? color : 'var(--border2)'}`,
              transition: 'background 0.15s, border-color 0.15s',
              opacity: available ? 1 : 0.5,
              cursor: available ? 'pointer' : 'default',
              position: 'relative' as const,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{name}</div>
              </div>
              <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: available ? '0.75rem' : 0 }}>{sub}</div>
              {available && (
                <div style={{ color: color, fontSize: '0.78rem', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
                  {count} topics →
                </div>
              )}
              {!available && (
                <div style={{
                  fontSize: '0.65rem', fontFamily: 'var(--font-ui)',
                  color: 'var(--text3)', background: 'var(--bg3)',
                  border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 3,
                  display: 'inline-block', marginTop: '0.5rem',
                }}>Coming soon</div>
              )}
            </div>
          );
          return available
            ? <Link key={slug} href={`/notes/${slug}`} style={{ textDecoration: 'none' }}>{card}</Link>
            : <div key={slug}>{card}</div>;
        })}
      </div>
    </div>
  );
}
