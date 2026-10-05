/**
 * Restores the space after sentence-ending punctuation.
 *
 * The model occasionally emits "coalesced.The citadel..." with no space after
 * a full stop. Nothing in our render pipeline strips it — it arrives that way
 * — so we normalise the text instead of trying to fix it downstream.
 *
 * Only fires when the punctuation is preceded by a lowercase letter, digit or
 * closing bracket/quote and followed by a capital (optionally behind a markdown
 * bold/italic marker). That deliberately leaves alone:
 *   - initials and abbreviations: "D.D. Kosambi", "R.C. Majumdar", "U.S. Army"
 *   - decimals and numbering: "1.5 metres", "Section 3.2", "No.5"
 *   - domains and paths: "distilledcrux.com/chat"
 *   - ellipses: "here...The"
 * A Devanagari danda is simpler — it always takes a following space.
 */
export function fixSentenceSpacing(text: string): string {
  return text
    .replace(/([a-z0-9)\]"'”’])([.!?])(?=\*{0,2}[A-Z“"(])/g, '$1$2 ')
    .replace(/।(?=\S)/g, '। ');
}
