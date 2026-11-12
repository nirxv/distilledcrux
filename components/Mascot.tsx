import Image, { type StaticImageData } from 'next/image';
import owlArt from '@/public/mascot/owl.svg';
import owlReadingArt from '@/public/mascot/owl-reading.svg';
import owlCelebrateArt from '@/public/mascot/owl-celebrate.svg';

/**
 * The site's mascot: the owl, in the poses drawn so far.
 *
 *   peek       through a magnifying glass; the "what are we looking for" pose
 *   reading    over an open book; for waiting and working states
 *   celebrate  wings out, confetti; for finishing something worth marking
 *
 * The artwork is static SVG in public/mascot with its own fixed colours: the
 * white sticker edge is what lets it sit on the dark ground and on paper
 * alike, so it does not take theme tokens. Its small animations (a blink, the
 * eyes following a line of text) live inside the SVG and respect
 * prefers-reduced-motion there.
 */
export type MascotPose = 'peek' | 'reading' | 'celebrate';

/**
 * Imported rather than linked as /mascot/..., so each file is served from a
 * hashed address the browser keeps; a public/ file is checked with the server
 * on every page view, and each check counts against Vercel's CDN requests.
 */
const ART: Record<MascotPose, { src: StaticImageData; w: number; h: number }> = {
  peek:    { src: owlArt,         w: 180, h: 170 },
  reading: { src: owlReadingArt, w: 150, h: 130 },
  celebrate: { src: owlCelebrateArt, w: 200, h: 196 },
};

export default function Mascot({
  pose = 'peek',
  width = 120,
  alt = '',
  className,
  preload,
}: {
  pose?: MascotPose;
  /** Rendered width in px; the height follows the artwork's proportions. */
  width?: number;
  /** Empty by default: the owl is decoration beside text that says the same. */
  alt?: string;
  className?: string;
  /** Fetch ahead of the page's other images, for an owl seen on arrival. */
  preload?: boolean;
}) {
  const art = ART[pose];
  return (
    <Image
      src={art.src}
      alt={alt}
      width={width}
      height={Math.round((width * art.h) / art.w)}
      className={className}
      preload={preload}
    />
  );
}
