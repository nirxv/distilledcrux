/**
 * Flashcard metadata with no card data attached, so the client can name the
 * kinds of card and the five decks without importing anything heavy.
 */

export const FLASHCARD_TYPES = ['thinker', 'concept', 'comparison', 'critique', 'study', 'fact'] as const;
export type FlashCardType = (typeof FLASHCARD_TYPES)[number];

/** Notes subject slugs, which are also the route segment: /<subject>/flashcards. */
export const FLASHCARD_SUBJECTS = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'] as const;
export type FlashcardSubject = (typeof FLASHCARD_SUBJECTS)[number];

export function isFlashcardSubject(value: unknown): value is FlashcardSubject {
  return typeof value === 'string' && (FLASHCARD_SUBJECTS as readonly string[]).includes(value);
}

/** Answers anyone may open before a subscription is needed. */
export const FREE_FLASHCARD_LIMIT = 100;

/** Where spaced-repetition state is kept. The chat reads the same key for its due count. */
export const FLASHCARD_SR_KEY = 'pp_flashcards_v1';
