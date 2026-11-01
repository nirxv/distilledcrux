/**
 * Today's date in Asia/Kolkata as YYYY-MM-DD: the day a daily answer-writing
 * set belongs to. Kept apart from lib/dailyQuestions so the browser can tell
 * which day it is without importing a question bank.
 */
export function istDay(now: Date = new Date()): string {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
