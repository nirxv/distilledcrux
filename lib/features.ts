/**
 * Features that are built but not yet live.
 *
 * Topper answer copies are promised in three places — the pricing cards, the
 * login page's feature list and a card on every PYQ page — and none of them has
 * anything behind it yet. The markup is kept rather than deleted so the feature
 * can be turned back on in one edit once real copies are close; until then the
 * site should not advertise it at all.
 */
export const TOPPER_COPIES_LIVE = false;

/**
 * Parts of the chat page that are built and waiting on data this site does
 * not have yet. The chat came over from historyoptional.xyz, where each of
 * these has something behind it; here each would point at nothing.
 *
 * - Topic PYQs: the past questions filed under a notes topic. The PYQ files
 *   tag questions with their own topic names, which match the notes for only
 *   part of the bank (a small part in Sociology and Geography), so a topic's
 *   list would be mostly empty or wrong. Gates "Answer a past question", the
 *   mentor start (which begins from a past question), the PYQ line in
 *   Worth knowing and the PYQ follow-up.
 * - Flashcards: there are no flashcards on this site yet. Gates the card
 *   count in Worth knowing and the Flashcards link in the chat sidebar.
 * - Syllabus tracker: now live (see below). Gates the coverage ring in the
 *   sidebar and "Mark it done".
 */
export const CHAT_TOPIC_PYQS_LIVE = false;
export const FLASHCARDS_LIVE = false;
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
