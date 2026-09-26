'use client';

/**
 * A card's four edges, printed with the site's own name.
 *
 * It is a watermark, and the point is the screenshot: a model answer or an
 * evaluation that travels through a WhatsApp group carries where it came from
 * on every side, however it is cropped. The type is the same mono the card
 * labels use, sized down and faded, so it reads as a frame and not as content.
 *
 * Drop it anywhere inside a card that is a positioning origin; it takes no
 * children, because the rails are positioned against that card rather than
 * wrapped around anything. The rails sit inside the card's own padding, which
 * is why nothing has to be relaid out to make room. The vertical ones lean on writing-mode rather than
 * a rotation: the glyphs turn with the line, and the strip needs no knowledge
 * of the card's height to line up. Each holds far more repetitions than can
 * fit, and overflow clips the rest, which is what lets one component sit on a
 * card of any size.
 */

const WORD = 'distilledcrux.com';
/** Enough to run the long edge of a full-page card; the rest is clipped. */
const RAIL = Array(60).fill(WORD).join(' · ');

export default function BrandFrame() {
  return (
    <>
      <style>{`
        .bframe-edge {
          position: absolute; overflow: hidden; white-space: nowrap;
          font-family: var(--font-mono); font-size: 0.48rem; font-weight: 500;
          letter-spacing: 0.22em;
          color: color-mix(in srgb, var(--text) 20%, transparent);
          pointer-events: none; user-select: none; -webkit-user-select: none;
        }
        .bframe-top    { top: 6px; left: 12px; right: 12px; }
        .bframe-bottom { bottom: 6px; left: 12px; right: 12px; }
        .bframe-left   { left: 6px; top: 12px; bottom: 12px; writing-mode: vertical-rl; }
        .bframe-right  { right: 6px; top: 12px; bottom: 12px; writing-mode: vertical-rl; }
      `}</style>
      <span className="bframe-edge bframe-top" aria-hidden="true">{RAIL}</span>
      <span className="bframe-edge bframe-bottom" aria-hidden="true">{RAIL}</span>
      <span className="bframe-edge bframe-left" aria-hidden="true">{RAIL}</span>
      <span className="bframe-edge bframe-right" aria-hidden="true">{RAIL}</span>
    </>
  );
}
