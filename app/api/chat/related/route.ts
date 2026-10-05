import { NextRequest, NextResponse } from 'next/server';
import { getNoteBySlug } from '@/lib/notes';
import { isPyqSubject, pyqsForNote } from '@/lib/pyqs';
import { cachePublic } from '@/lib/cacheHeaders';

/**
 * What the site already has on one notes topic, for the chat page.
 *
 *   GET /api/chat/related?slug=karl-marx
 *
 * The chat's start screen lists a topic's past questions to pick from, and an
 * answer is followed by a line saying how often UPSC has asked about it. Both
 * need the subject's PYQ file, 185 to 346 KB that has no business in the
 * browser, so the topic's questions are picked out here and only those go
 * down. Which questions belong to which topic is lib/pyqNotes.json.
 *
 * Nothing in the response depends on who is asking, so it is cached at the
 * edge; it changes only when a deploy changes the PYQ data. There are no
 * flashcards on this site yet, so that count is always null.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  const note = getNoteBySlug(slug);
  if (!note) return NextResponse.json({ error: 'unknown_topic' }, { status: 404 });

  const pyqs = isPyqSubject(note.subject) ? await pyqsForNote(note.subject, note.slug) : [];

  return NextResponse.json(
    {
      topic: { slug: note.slug, title: note.title, section: note.section, paper: note.paper },
      pyqs: pyqs.map((q) => ({ id: q.id, year: Number(q.year), marks: q.marks, question: q.question })),
      flashcards: null,
    },
    { headers: cachePublic(3600) },
  );
}
