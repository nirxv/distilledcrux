'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getNoteBySlug } from '@/lib/notes';
import { loadRelated, type Related } from './StartFlow';
import { CHAT_TOPIC_PYQS_LIVE, FLASHCARDS_LIVE, SYLLABUS_TRACKER_LIVE } from '@/lib/features';

type Props = {
  slug: string;
  langHi: boolean;
  done: boolean;
  onMarkDone: () => void;
  onShowPyqs: (r: Related) => void;
};

/**
 * What the site already holds on the topic an answer was about: its past
 * questions, its flashcards, its notes, and whether the reader has ticked it
 * off. Each line is only shown when there is something real behind it, which
 * for now means the notes: the other lines wait on data switched off in
 * lib/features.ts.
 */
export default function WorthKnowing({ slug, langHi, done, onMarkDone, onShowPyqs }: Props) {
  const [related, setRelated] = useState<Related | null>(null);
  const note = getNoteBySlug(slug);

  useEffect(() => {
    let live = true;
    loadRelated(slug).then((r) => { if (live) setRelated(r); });
    return () => { live = false; };
  }, [slug]);

  if (!note) return null;
  const title = note.title;
  const pyqs = related?.pyqs ?? [];
  const cards = related?.flashcards ?? 0;
  const subs = (note.subtopics ?? []).slice(0, 3);

  const items: { key: string; text: string; action: React.ReactNode }[] = [];

  if (CHAT_TOPIC_PYQS_LIVE && pyqs.length > 0) {
    items.push({
      key: 'pyqs',
      text: langHi
        ? `UPSC ने ${title} पर ${pyqs.length} बार प्रश्न पूछा है, सबसे हाल में ${pyqs[0].year} में।`
        : `UPSC has asked about ${title} ${pyqs.length} time${pyqs.length === 1 ? '' : 's'}, most recently in ${pyqs[0].year}.`,
      action: (
        <button className="ch-btn ch-btn-line ch-btn-sm" onClick={() => related && onShowPyqs(related)}>
          {langHi ? 'वे प्रश्न दिखाएँ' : 'Show those questions'}
        </button>
      ),
    });
  }

  if (FLASHCARDS_LIVE && cards > 0) {
    items.push({
      key: 'cards',
      text: langHi
        ? `${title} पर ${cards} फ्लैशकार्ड हैं।`
        : `${cards} flashcard${cards === 1 ? '' : 's'} cover ${title}.`,
      action: (
        <Link className="ch-btn ch-btn-line ch-btn-sm" href={`/flashcards?topic=${encodeURIComponent(note.slug)}`}>
          {langHi ? 'उन्हें दोहराएँ' : 'Revise them'}
        </Link>
      ),
    });
  }

  items.push({
    key: 'notes',
    text: subs.length
      ? (langHi
          ? `${title} के नोट्स में ${subs.join(', ')} और भी बहुत कुछ है।`
          : `The notes on ${title} go through ${subs.join(', ')} and more.`)
      : (langHi ? `${title} के नोट्स पढ़ें।` : `There are notes on ${title}.`),
    action: (
      <Link className="ch-btn ch-btn-line ch-btn-sm" href={`/notes/${note.subject}/${note.slug}`}>
        {langHi ? 'नोट्स पढ़ें' : 'Read the notes'}
      </Link>
    ),
  });

  if (SYLLABUS_TRACKER_LIVE && !done) {
    items.push({
      key: 'tick',
      text: langHi
        ? `आपने ${title} को पाठ्यक्रम ट्रैकर में पूरा नहीं किया है।`
        : `${title} isn't ticked off in your syllabus tracker yet.`,
      action: (
        <button className="ch-btn ch-btn-line ch-btn-sm" onClick={onMarkDone}>
          {langHi ? 'पूरा चिह्नित करें' : 'Mark it done'}
        </button>
      ),
    });
  }

  return (
    <section className="ch-worth" aria-label={langHi ? 'जानने योग्य' : 'Worth knowing'}>
      <div className="ch-worth-head">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.9L19 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>
        {langHi ? 'जानने योग्य' : 'Worth knowing'}
      </div>
      {items.map((it) => (
        <div key={it.key} className="ch-worth-item">
          <p>{it.text}</p>
          {it.action}
        </div>
      ))}
    </section>
  );
}
