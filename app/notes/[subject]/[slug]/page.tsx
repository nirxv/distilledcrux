import { allNotes } from '@/lib/notes';
import NoteReader from './NoteReader';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Supported subjects
const SUBJECTS = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'];

export function generateStaticParams() {
  return allNotes.flatMap(n =>
    SUBJECTS.map(subject => ({ subject, slug: n.slug }))
  );
}

export async function generateMetadata(
  { params }: { params: Promise<{ subject: string; slug: string }> }
): Promise<Metadata> {
  const { subject, slug } = await params;
  const note = allNotes.find(n => n.slug === slug);
  if (!note) return {};
  const subjectLabel = subject.charAt(0).toUpperCase() + subject.slice(1);
  return {
    title: `${note.title} — UPSC ${subjectLabel} Optional Notes | Distilled Crux`,
    description: `${note.description}. Detailed notes for UPSC ${subjectLabel} Optional, Paper ${note.paper} — ${note.section}.`,
    alternates: { canonical: `https://distilledcrux.com/notes/${subject}/${slug}` },
  };
}

export default async function NotePage(
  { params }: { params: Promise<{ subject: string; slug: string }> }
) {
  const { subject, slug } = await params;
  const note = allNotes.find(n => n.slug === slug);
  if (!note) notFound();

  let initialContent = '';

  try {
    // Try Supabase note_overrides first (admin-edited content)
    const { createServerClient } = await import('@/lib/supabase');
    const db = createServerClient();
    const { data } = await db.from('note_overrides').select('content').eq('slug', slug).single();
    if (data?.content) {
      initialContent = data.content;
    } else {
      // Fallback to local noteContent store
      const { getNoteContent } = await import('@/lib/noteContent');
      initialContent = getNoteContent(slug) || '';
    }
  } catch {
    try {
      const { getNoteContent } = await import('@/lib/noteContent');
      initialContent = getNoteContent(slug) || '';
    } catch {}
  }

  // JSON-LD
  const articleSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `https://distilledcrux.com/notes/${subject}/${slug}#article`,
        headline: `${note.title} — UPSC ${subject} Optional Notes`,
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
      <NoteReader slug={slug} subject={subject} initialContent={initialContent} />
    </>
  );
}
