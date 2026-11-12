import { TOPPER_SUBJECTS } from '@/lib/toppers/meta';

/**
 * Topper answer copies: live from November 2026, one optional at a time as
 * each gets enough copies (TOPPER_SUBJECTS in lib/toppers/meta.ts). True once
 * any optional has them; gates the pricing row, the free-tier lines on the
 * login and pricing pages, and the terms.
 */
export const TOPPER_COPIES_LIVE = TOPPER_SUBJECTS.length > 0;

/**
 * Parts of the chat page that came over from historyoptional.xyz.
 *
 * - Topic PYQs: the past questions filed under a notes topic. Live from step
 *   8, once every question was placed on the notes topic it is answered from
 *   (lib/pyqNotes.json, served by /api/chat/related). Gates "Answer a past
 *   question", the mentor start (which begins from a past question), the PYQ
 *   line in Worth knowing and the PYQ follow-up.
 * - Flashcards: live from October 2026, one deck per optional at
 *   /<subject>/flashcards. Gates the card count in Worth knowing and the
 *   Flashcards link in the chat sidebar.
 * - Syllabus tracker: live (see below). Gates the coverage ring in the
 *   sidebar and "Mark it done".
 */
export const CHAT_TOPIC_PYQS_LIVE = true;
export const FLASHCARDS_LIVE = true;
// On from step 7: topics are ticked off on the note reader and in the chat,
// kept per device and synced to the account (hooks/useSyllabusTracker,
// components/ProgressSync).
export const SYLLABUS_TRACKER_LIVE = true;

/**
 * Prelims practice. The three pages under /prelims advertise a 10,000-question
 * bank, 25 years of explained papers and a weakness radar, and show three
 * placeholder questions whose explanations tell the developer where to put the
 * real data. Nothing on the site links there; until there is a question bank,
 * every /prelims URL is a 404. The pages are kept for when there is.
 */
export const PRELIMS_LIVE = false;
