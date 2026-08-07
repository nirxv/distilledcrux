import type { Metadata } from 'next';
import Link from 'next/link';
import { paper1Notes, paper2Notes, paper1Sections, paper2Sections } from '@/lib/notes/pub-admin';

export const metadata: Metadata = {
  title: 'Public Administration Optional Notes UPSC Mains Paper I & II | Distilled Crux',
  description: 'Comprehensive free notes for UPSC Public Administration Optional administrative theory, Indian administration, civil services, local government and more.',
  alternates: { canonical: 'https://distilledcrux.com/notes/pub-admin' },
};

const COLOR = '#fb923c';
const COLOR_BG = 'rgba(251,146,60,0.09)';
const COLOR_BORDER = 'rgba(251,146,60,0.25)';

export default function PubAdminNotesPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
      <div style={{ color: 'var(--text3)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Link href="/notes" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Notes</Link>
        <span>·</span>
        <span>Public Administration</span>
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>
        Public Administration Optional
      </h1>
      <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '3rem' }}>
        {paper1Notes.length + paper2Notes.length} topics · Paper I & II · Free for all aspirants
      </p>

      {/* Paper I */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR, background: COLOR_BG, border: `1px solid ${COLOR_BORDER}`, padding: '3px 10px', borderRadius: 4 }}>Paper I</span>
          <span style={{ color: 'var(--text2)', fontSize: '0.88rem', fontFamily: 'var(--font-ui)' }}>Administrative Theory</span>
        </div>
        {paper1Sections.map((section) => {
          const notes = paper1Notes.filter(n => n.section === section);
          if (!notes.length) return null;
          return (
            <div key={section} style={{ marginBottom: '2rem' }}>
              <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-ui)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.75rem' }}>{section}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {notes.map(note => (
                  <Link key={note.slug} href={`/notes/pub-admin/${note.slug}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem', borderLeft: `3px solid ${COLOR}`, display: 'flex', alignItems: 'flex-start', gap: '1rem', transition: 'background 0.15s' }}>
                      <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-ui)', color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 3, flexShrink: 0, marginTop: '2px' }}>{String(note.topic).padStart(2, '0')}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text)', fontSize: '0.93rem', fontWeight: 600, marginBottom: '0.25rem' }}>{note.title}</div>
                        <div style={{ color: 'var(--text3)', fontSize: '0.78rem', lineHeight: 1.5 }}>{note.description}</div>
                        {note.subtopics && (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' as const, marginTop: '0.5rem' }}>
                            {note.subtopics.map(st => (
                              <span key={st} style={{ fontSize: '0.65rem', fontFamily: 'var(--font-ui)', color: 'var(--text3)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 3 }}>{st}</span>
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
          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLOR, background: COLOR_BG, border: `1px solid ${COLOR_BORDER}`, padding: '3px 10px', borderRadius: 4 }}>Paper II</span>
          <span style={{ color: 'var(--text2)', fontSize: '0.88rem', fontFamily: 'var(--font-ui)' }}>Indian Administration</span>
        </div>
        {paper2Sections.map((section) => {
          const notes = paper2Notes.filter(n => n.section === section);
          if (!notes.length) return null;
          return (
            <div key={section} style={{ marginBottom: '2rem' }}>
              <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-ui)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.75rem' }}>{section}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {notes.map(note => (
                  <Link key={note.slug} href={`/notes/pub-admin/${note.slug}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem', borderLeft: `3px solid ${COLOR}`, display: 'flex', alignItems: 'flex-start', gap: '1rem', transition: 'background 0.15s' }}>
                      <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-ui)', color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 3, flexShrink: 0, marginTop: '2px' }}>{String(note.topic).padStart(2, '0')}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text)', fontSize: '0.93rem', fontWeight: 600, marginBottom: '0.25rem' }}>{note.title}</div>
                        <div style={{ color: 'var(--text3)', fontSize: '0.78rem', lineHeight: 1.5 }}>{note.description}</div>
                        {note.subtopics && (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' as const, marginTop: '0.5rem' }}>
                            {note.subtopics.map(st => (
                              <span key={st} style={{ fontSize: '0.65rem', fontFamily: 'var(--font-ui)', color: 'var(--text3)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 3 }}>{st}</span>
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
