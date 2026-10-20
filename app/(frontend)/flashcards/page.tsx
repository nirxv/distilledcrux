import { redirect } from 'next/navigation';
import { getNoteBySlug } from '@/lib/notes';
import { isFlashcardSubject } from '@/lib/flashcardMeta';
import FlashcardsRedirect from '@/components/flashcards/FlashcardsRedirect';

/**
 * /flashcards, where the chat sends a reader. A topic names its own optional,
 * so ?topic=<notes slug> goes straight to that deck. Without one, the reader's
 * own optional decides, which only the browser knows.
 */
export default async function FlashcardsIndex({ searchParams }: { searchParams: Promise<{ topic?: string | string[] }> }) {
  const { topic } = await searchParams;
  const slug = typeof topic === 'string' ? topic : '';
  const note = slug ? getNoteBySlug(slug) : undefined;
  if (note && isFlashcardSubject(note.subject)) {
    redirect(`/${note.subject}/flashcards?topic=${encodeURIComponent(note.slug)}`);
  }
  return <FlashcardsRedirect />;
}
