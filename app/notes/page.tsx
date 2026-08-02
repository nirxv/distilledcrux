import type { Metadata } from 'next';
import Link from 'next/link';
import { allNotes as socioNotes } from '@/lib/notes';
import { allAnthroNotes } from '@/lib/notes/anthropology';
import { allNotes as polsciNotes } from '@/lib/notes/polsci';
import { allNotes as geoNotes } from '@/lib/notes/geography';
import { allNotes as pubAdminNotes } from '@/lib/notes/pub-admin';

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
    color: '#4361ee',
    icon: '🧩',
    count: socioNotes.length,
  },
  {
    slug: 'anthropology',
    name: 'Anthropology',
    sub: 'Physical · Social · Applied',
    color: '#2dd4bf',
    icon: '🧬',
    count: allAnthroNotes.length,
  },
  {
    slug: 'polsci',
    name: 'Political Science',
    sub: 'Theory · IR · Comparative Politics',
    color: '#f87171',
    icon: '⚖️',
    count: polsciNotes.length,
  },
  {
    slug: 'geography',
    name: 'Geography',
    sub: 'Physical · Human · Economic',
    color: '#4ade80',
    icon: '🌍',
    count: geoNotes.length,
  },
  {
    slug: 'pub-admin',
    name: 'Public Administration',
    sub: 'Theory · Indian Administration',
    color: '#fb923c',
    icon: '📋',
    count: pubAdminNotes.length,
  },
];

export default function NotesPage() {
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
        {SUBJECTS.map(({ slug, name, sub, color, icon, count }) => (
          <Link key={slug} href={`/notes/${slug}`} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderRadius: 10,
              padding: '1.5rem',
              borderLeft: `3px solid ${color}`,
              transition: 'background 0.15s, border-color 0.15s',
              cursor: 'pointer',
              position: 'relative' as const,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{name}</div>
              </div>
              <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{sub}</div>
              <div style={{ color: color, fontSize: '0.78rem', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
                {count} topics →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
