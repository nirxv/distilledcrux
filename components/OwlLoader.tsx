import Mascot from '@/components/Mascot';

/**
 * The site's loading state: the owl, reading, bobbing gently over a shadow
 * that breathes with it. It replaces the "Loading…" lines and animated dots
 * that each page used to draw for itself.
 *
 *   page     fills the space a page would take (a post, the chat page)
 *   section  a list or panel that is still arriving
 *   small    a tight spot: a card, a heatmap, a comment thread
 *
 * A caption goes under the owl only where the wait has something to say
 * (what is being made, roughly how long); a plain load shows the owl alone.
 *
 * The label is for screen readers; the owl carries the meaning on screen,
 * and the region is a polite live region so the wait is announced once. The
 * motion stops under prefers-reduced-motion (the eyes' glance inside the SVG
 * stops there too).
 */
export default function OwlLoader({
  size = 'section',
  label,
  caption,
}: {
  size?: 'page' | 'section' | 'small';
  label?: string;
  caption?: string;
}) {
  const width = size === 'page' ? 120 : size === 'section' ? 88 : 52;
  return (
    <div className={`owl-loader owl-loader-${size}`} role="status" aria-live="polite">
      <style>{OWL_LOADER_CSS}</style>
      <div className="owl-loader-bob">
        <Mascot pose="reading" width={width} className="owl-loader-owl" />
      </div>
      <span className="owl-loader-shadow" aria-hidden="true" style={{ width: Math.round(width * 0.6) }} />
      {caption && <span className="owl-loader-caption" aria-hidden="true">{caption}</span>}
      <span className="owl-loader-sr">{label ?? caption ?? 'Loading'}</span>
    </div>
  );
}

const OWL_LOADER_CSS = `
.owl-loader { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.owl-loader-page { min-height: 60vh; }
.owl-loader-section { padding: var(--space-10) 0; }
.owl-loader-small { padding: var(--space-3) 0; }
.owl-loader-owl { display: block; height: auto; }
.owl-loader-bob { animation: owlLoaderBob 1.6s ease-in-out infinite; }
.owl-loader-shadow {
  display: block; height: 6px; margin-top: var(--space-1); border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--text) 14%, transparent);
  animation: owlLoaderShadow 1.6s ease-in-out infinite;
}
.owl-loader-small .owl-loader-shadow { height: 4px; }
.owl-loader-caption { margin-top: var(--space-3); font-size: 0.82rem; line-height: 1.5; color: var(--text3); text-align: center; }
.owl-loader-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes owlLoaderBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes owlLoaderShadow { 0%, 100% { transform: scaleX(1); opacity: 1; } 50% { transform: scaleX(0.8); opacity: 0.6; } }
@media (prefers-reduced-motion: reduce) { .owl-loader-bob, .owl-loader-shadow { animation: none; } }
`;
