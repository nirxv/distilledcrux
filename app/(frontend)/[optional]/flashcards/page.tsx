import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Flashcards from '@/components/flashcards/Flashcards';
import { notesForSubject } from '@/lib/notes';
import { PYQ_SUBJECT_NAME } from '@/lib/pyqs';
import { FLASHCARD_SUBJECTS, isFlashcardSubject } from '@/lib/flashcardMeta';

/**
 * One optional's flashcards. The cards come from /api/flashcards; the notes'
 * titles, papers and order come from here, so the filters follow the syllabus.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return FLASHCARD_SUBJECTS.map((optional) => ({ optional }));
}

export async function generateMetadata({ params }: { params: Promise<{ optional: string }> }): Promise<Metadata> {
  const { optional } = await params;
  if (!isFlashcardSubject(optional)) return {};
  const name = PYQ_SUBJECT_NAME[optional];
  return {
    title: `${name} Optional Flashcards`,
    description: `Spaced-repetition flashcards for UPSC ${name} optional: thinkers, concepts, comparisons and the facts UPSC asks for, each linked to the past questions it helps you answer.`,
    alternates: { canonical: `https://distilledcrux.com/${optional}/flashcards` },
  };
}

export default async function FlashcardsPage({ params }: { params: Promise<{ optional: string }> }) {
  const { optional } = await params;
  if (!isFlashcardSubject(optional)) notFound();
  const notes = notesForSubject(optional).map((n) => ({ slug: n.slug, title: n.title, paper: n.paper, section: n.section }));
  return <Flashcards subject={optional} subjectName={PYQ_SUBJECT_NAME[optional]} notes={notes} />;
}
