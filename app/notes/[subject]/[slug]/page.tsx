import { NOTE_SUBJECTS, notesForSubject, getNote, getNoteNeighbours } from '@/lib/notes';
import NoteReader from './NoteReader';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * One page per note, under its own subject. This used to be the cartesian
 * product of every slug and every subject — 790 pages, of which 632 served a
 * real note under a subject it does not belong to, each with a title claiming
 * it was that subject's note.
 */
export function generateStaticParams() {
  return NOTE_SUBJECTS.flatMap(subject =>
    notesForSubject(subject).map(n => ({ subject, slug: n.slug }))
  );
}

export async function generateMetadata(
  { params }: { params: Promise<{ subject: string; slug: string }> }
): Promise<Metadata> {
  const { subject, slug } = await params;
  const note = getNote(subject, slug);
  if (!note) return {};
  const subjectLabel = subject.charAt(0).toUpperCase() + subject.slice(1);
  return {
    title: `${note.title} UPSC ${subjectLabel} Optional Notes | Distilled Crux`,
    description: `${note.description}. Detailed notes for UPSC ${subjectLabel} Optional, Paper ${note.paper} ${note.section}.`,
    alternates: { canonical: `https://distilledcrux.com/notes/${subject}/${slug}` },
  };
}

export default async function NotePage(
  { params }: { params: Promise<{ subject: string; slug: string }> }
) {
  const { subject, slug } = await params;
  // The pairing is checked, not just the slug: a sociology note requested under
  // /notes/geography/ is a 404, not a page.
  const note = getNote(subject, slug);
  if (!note) notFound();

  const { prev, next } = getNoteNeighbours(subject, slug);

  let initialContent = '';

  try {
    // Try Supabase note_overrides first (admin-edited content)
    const { createServerClient } = await import('@/lib/supabase');
    const db = createServerClient();
    const { data } = await db.from('note_overrides').select('content').eq('slug', slug).maybeSingle();
    if (data?.content) {
      initialContent = data.content;
    } else {
      // Fallback to the bundled note body for this subject
      const { getNoteContent } = await import('@/lib/noteContent');
      initialContent = await getNoteContent(subject, slug);
    }
  } catch {
    try {
      const { getNoteContent } = await import('@/lib/noteContent');
      initialContent = await getNoteContent(subject, slug);
    } catch {}
  }

  // JSON-LD
  const articleSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `https://distilledcrux.com/notes/${subject}/${slug}#article`,
        headline: `${note.title} UPSC ${subject} Optional Notes`,
        description: note.description,
        url: `https://distilledcrux.com/notes/${subject}/${slug}`,
        isPartOf: { '@id': 'https://distilledcrux.com/#website' },
        publisher: { '@type': 'Organization', name: 'Distilled Crux', url: 'https://distilledcrux.com' },
        inLanguage: 'en-IN',
        educationalLevel: 'competitive-exam',
        learningResourceType: 'study notes',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://distilledcrux.com' },
          { '@type': 'ListItem', position: 2, name: 'Notes', item: 'https://distilledcrux.com/notes' },
          { '@type': 'ListItem', position: 3, name: subject, item: `https://distilledcrux.com/notes/${subject}` },
          { '@type': 'ListItem', position: 4, name: note.title, item: `https://distilledcrux.com/notes/${subject}/${slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <NoteReader
        slug={slug}
        subject={subject}
        initialContent={initialContent}
        note={{
          title: note.title,
          section: note.section,
          paper: note.paper,
          description: note.description,
          subtopics: note.subtopics,
        }}
        prev={prev}
        next={next}
      />
    </>
  );
}
