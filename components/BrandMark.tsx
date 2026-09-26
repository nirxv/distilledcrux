'use client';

/**
 * The site's name in the bottom right corner of a card.
 *
 * A screenshot of a model answer or an evaluation should say where it came
 * from. Running the name around all four edges said it far too loudly, so it
 * is one mark in the corner, in the same mono the card labels use. Faded, but
 * only so far: at 22% of the text colour it had disappeared into the card
 * altogether, which is no use to a screenshot. It reads as a maker's mark
 * rather than as content, and it is legible.
 *
 * It takes no children: it positions itself against the nearest card that is a
 * positioning origin, so adding it anywhere is one line. aria-hidden and
 * unselectable, because a watermark has no business in a screen reader or in
 * text copied out of a card.
 */
export default function BrandMark() {
  return (
    <>
      <style>{`
        .bmark {
          position: absolute; right: 0.9rem; bottom: 0.7rem;
          font-family: var(--font-mono); font-size: 0.6rem; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase; line-height: 1;
          color: color-mix(in srgb, var(--text) 45%, transparent);
          pointer-events: none; user-select: none; -webkit-user-select: none;
        }
        /* Black on a white card carries less at the same alpha than white on a
           dark one, so the light ground takes a little more. */
        [data-theme="light"] .bmark { color: color-mix(in srgb, var(--text) 55%, transparent); }
      `}</style>
      <span className="bmark" aria-hidden="true">distilledcrux.com</span>
    </>
  );
}
