import type { ReactNode } from 'react';
import Mascot, { type MascotPose } from '@/components/Mascot';

/**
 * The frame for sign-in and onboarding: artwork on the left, the step on the
 * right, as in the entry and onboarding screens of the design. The artwork is
 * the owl on a wash of the site's own colours, tinted by the optional the
 * reader has picked once there is one, with rings behind it. On a phone the
 * artwork becomes a band across the top.
 */
export default function SplitShell({
  pose = 'peek',
  tint,
  steps,
  step = 0,
  children,
}: {
  pose?: MascotPose;
  /** The picked optional's route slug, for its tint and wash. */
  tint?: string | null;
  /** How many steps the flow has, for the bars above it. Omit for a single screen. */
  steps?: number;
  step?: number;
  children: ReactNode;
}) {
  const vars = tint
    ? { ['--sp-t' as string]: `var(--tint-${tint})`, ['--sp-w' as string]: `var(--wash-${tint})` }
    : undefined;
  return (
    <div className="sp ds" style={vars}>
      <style dangerouslySetInnerHTML={{ __html: SP_CSS }} />
      <div className="sp-art" aria-hidden="true">
        <div className="sp-art-owl"><Mascot pose={pose} width={240} preload /></div>
      </div>
      <div className="sp-main">
        {steps && steps > 1 && (
          <ol className="sp-steps" aria-label={`Step ${step + 1} of ${steps}`}>
            {Array.from({ length: steps }, (_, i) => <li key={i} className={i <= step ? 'on' : ''} />)}
          </ol>
        )}
        <div className="sp-body">{children}</div>
      </div>
    </div>
  );
}

const SP_CSS = `
.sp {
  --sp-t: var(--accent);
  --sp-w: var(--accent-wash);
  min-height: calc(100dvh - 60px);
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--bg);
}
/* The artwork's right edge folds in to a point, the design's chevron cut. */
.sp-art {
  position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  clip-path: polygon(0 0, 100% 0, 91% 50%, 100% 100%, 0 100%);
  background: radial-gradient(ellipse 120% 120% at 100% 100%,
    color-mix(in srgb, var(--sp-w) 60%, var(--bg)) 0%,
    color-mix(in srgb, var(--accent-wash) 85%, var(--bg)) 34%,
    color-mix(in srgb, var(--wash-sociology) 85%, var(--bg)) 62%,
    color-mix(in srgb, var(--premium-wash) 90%, var(--bg)) 100%);
  transition: background 0.3s;
}
[data-theme="dark"] .sp-art {
  background: radial-gradient(ellipse 120% 120% at 100% 100%,
    color-mix(in srgb, var(--sp-w) 70%, var(--bg)) 0%,
    color-mix(in srgb, var(--accent-wash) 55%, var(--bg)) 34%,
    color-mix(in srgb, var(--wash-sociology) 50%, var(--bg)) 62%,
    color-mix(in srgb, var(--premium-wash) 55%, var(--bg)) 100%);
}
.sp-art-owl { position: relative; isolation: isolate; margin-right: 9%; }
.sp-art-owl img { display: block; width: clamp(150px, 22vw, 260px); height: auto; }
.sp-art-owl::before {
  content: ''; position: absolute; z-index: -1; left: 50%; top: 50%;
  width: 900px; height: 900px; transform: translate(-50%, -50%);
  background: repeating-radial-gradient(circle, transparent 0 59px, color-mix(in srgb, var(--sp-t) 30%, transparent) 59px 60px);
  -webkit-mask: radial-gradient(circle, black 15%, transparent 62%);
  mask: radial-gradient(circle, black 15%, transparent 62%);
}
.sp-main { display: flex; flex-direction: column; padding: var(--space-8) clamp(24px, 6vw, 96px); }
.sp-steps { list-style: none; margin: 0 auto; padding: 0; width: min(440px, 100%); display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: var(--space-2); }
.sp-steps li { height: 3px; border-radius: 2px; background: var(--border2); transition: background 0.2s; }
.sp-steps li.on { background: var(--accent); }
.sp-body { flex: 1; display: flex; flex-direction: column; justify-content: center; width: min(440px, 100%); margin: 0 auto; padding: var(--space-8) 0; }

/* Shared by the screens that use the shell. */
.sp-title { margin: 0; font-size: clamp(1.5rem, 2.6vw, 1.875rem); font-weight: 700; line-height: 1.25; letter-spacing: -0.02em; text-align: center; color: var(--text); }
.sp-lede { margin: var(--space-2) auto 0; max-width: 400px; font-size: 0.95rem; line-height: 1.55; text-align: center; color: var(--text2); }
.sp-content { margin-top: var(--space-8); }
.sp-nav { display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-8); }
.sp-nav .sp-right { margin-left: auto; display: flex; gap: var(--space-3); }
.sp-nav .ds-btn { border-radius: var(--radius-md); min-height: 40px; font-size: 0.875rem; }

@media (max-width: 860px) {
  .sp { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; }
  .sp-art { clip-path: none; height: clamp(170px, 26vh, 240px); }
  .sp-art-owl { margin-right: 0; }
  .sp-art-owl img { width: clamp(110px, 30vw, 150px); }
  .sp-main { padding: var(--space-5) var(--space-4) var(--space-6); }
  .sp-body { justify-content: flex-start; padding: var(--space-6) 0 var(--space-2); }
  .sp-content { margin-top: var(--space-6); }
}
@media (prefers-reduced-motion: reduce) { .sp-art, .sp-steps li { transition: none; } }
`;
