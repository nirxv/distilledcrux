'use client';

/**
 * The site's name in the bottom right corner of a card.
 *
 * A screenshot of a model answer or an evaluation should say where it came
 * from. Running the name around all four edges said it far too loudly, so it
 * is one mark in the corner, in the same mono the card labels use, sized down
 * and faded until it reads as a maker's mark rather than as content.
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
          font-family: var(--font-mono); font-size: 0.5rem; font-weight: 500;
          letter-spacing: 0.18em; text-transform: uppercase; line-height: 1;
          color: color-mix(in srgb, var(--text) 22%, transparent);
          pointer-events: none; user-select: none; -webkit-user-select: none;
        }
      `}</style>
      <span className="bmark" aria-hidden="true">distilledcrux.com</span>
    </>
  );
}
