import type { Metadata } from 'next';
import Link from 'next/link';
import { paper1Notes, paper2Notes } from '@/lib/notes';

export const metadata: Metadata = {
  title: 'Sociology Optional Notes — UPSC Mains Paper I & II | Distilled Crux',
  description: 'Comprehensive free notes for UPSC Sociology Optional covering all Paper I and Paper II topics — sociological thinkers, Indian society, social change and more.',
  alternates: { canonical: 'https://distilledcrux.com/notes/sociology' },
};

const COLOR = '#4361ee';

const SECTIONS_P1 = [
  { label: 'Fundamentals of Sociology', value: 'Fundamentals of Sociology' },
  { label: 'Sociological Thinkers', value: 'Sociological Thinkers' },
];

const SECTIONS_P2 = [
  { label: 'Indian Society: Structure', value: 'Indian Society: Structure' },
  { label: 'Social Changes in India', value: 'Social Changes in India' },
];

export default function SociologyNotesPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>

      {/* Breadcrumb */}
      <div style={{ color: 'var(--text3)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Link href="/notes" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Notes</Link>
        <span>·</span>
        <span>Sociology</span>
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>
        Sociology Optional
      </h1>
      <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '3rem' }}>
        {paper1Notes.length + paper2Notes.length} topics · Paper I & II · Free for all aspirants
      </p>

      {/* Paper I */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{
            fontSize: '0.65rem', fontFamily: 'var(--font-ui)', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: COLOR, background: 'rgba(67,97,238,0.1)',
            border: '1px solid rgba(67,97,238,0.25)', padding: '3px 10px', borderRadius: 4,
          }}>Paper I</span>
          <span style={{ color: 'var(--text2)', fontSize: '0.88rem', fontFamily: 'var(--font-ui)' }}>Fundamentals of Sociology</span>
        </div>

        {SECTIONS_P1.map(({ label, value }) => {
          const notes = paper1Notes.filter(n => n.section === value);
          if (!notes.length) return null;
          return (
            <div key={value} style={{ marginBottom: '2rem' }}>
              <div style={{
                fontSize: '0.7rem', fontFamily: 'var(--font-ui)', fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text3)', marginBottom: '0.75rem',
              }}>{label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {notes.map((note, i) => (
                  <Link key={note.slug} href={`/notes/sociology/${note.slug}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '1rem 1.25rem',
                      borderLeft: `3px solid ${COLOR}`,
                      display: 'flex', alignItems: 'flex-start', gap: '1rem',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}>
                      <span style={{
                        fontSize: '0.62rem', fontFamily: 'var(--font-ui)', color: 'var(--text3)',
                        background: 'var(--bg3)', border: '1px solid var(--border)',
                        padding: '2px 7px', borderRadius: 3, flexShrink: 0, marginTop: '2px',
                      }}>
                        {String(note.topic).padStart(2, '0')}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text)', fontSize: '0.93rem', fontWeight: 600, marginBottom: '0.25rem' }}>{note.title}</div>
                        <div style={{ color: 'var(--text3)', fontSize: '0.78rem', lineHeight: 1.5 }}>{note.description}</div>
                        {note.subtopics && (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' as const, marginTop: '0.5rem' }}>
                            {note.subtopics.map(st => (
                              <span key={st} style={{
                                fontSize: '0.65rem', fontFamily: 'var(--font-ui)',
                                color: 'var(--text3)', background: 'var(--bg)',
                                border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 3,
                              }}>{st}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Paper II */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{
            fontSize: '0.65rem', fontFamily: 'var(--font-ui)', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#2dd4bf', background: 'rgba(45,212,191,0.08)',
            border: '1px solid rgba(45,212,191,0.22)', padding: '3px 10px', borderRadius: 4,
          }}>Paper II</span>
          <span style={{ color: 'var(--text2)', fontSize: '0.88rem', fontFamily: 'var(--font-ui)' }}>Indian Society: Structure and Change</span>
        </div>

        {SECTIONS_P2.map(({ label, value }) => {
          const notes = paper2Notes.filter(n => n.section === value);
          if (!notes.length) return null;
          return (
            <div key={value} style={{ marginBottom: '2rem' }}>
              <div style={{
                fontSize: '0.7rem', fontFamily: 'var(--font-ui)', fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text3)', marginBottom: '0.75rem',
              }}>{label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {notes.map(note => (
                  <Link key={note.slug} href={`/notes/sociology/${note.slug}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '1rem 1.25rem',
                      borderLeft: '3px solid #2dd4bf',
                      display: 'flex', alignItems: 'flex-start', gap: '1rem',
                      transition: 'background 0.15s',
                    }}>
                      <span style={{
                        fontSize: '0.62rem', fontFamily: 'var(--font-ui)', color: 'var(--text3)',
                        background: 'var(--bg3)', border: '1px solid var(--border)',
                        padding: '2px 7px', borderRadius: 3, flexShrink: 0, marginTop: '2px',
                      }}>
                        {String(note.topic).padStart(2, '0')}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text)', fontSize: '0.93rem', fontWeight: 600, marginBottom: '0.25rem' }}>{note.title}</div>
                        <div style={{ color: 'var(--text3)', fontSize: '0.78rem', lineHeight: 1.5 }}>{note.description}</div>
                        {note.subtopics && (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' as const, marginTop: '0.5rem' }}>
                            {note.subtopics.map(st => (
                              <span key={st} style={{
                                fontSize: '0.65rem', fontFamily: 'var(--font-ui)',
                                color: 'var(--text3)', background: 'var(--bg)',
                                border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 3,
                              }}>{st}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
