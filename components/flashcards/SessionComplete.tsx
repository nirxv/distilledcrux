'use client';
import Mascot from '@/components/Mascot';

/**
 * Shown when a flashcard session has been worked all the way through. The
 * count known is the reader's own grades of Good or Easy, and the "come back
 * sooner" line is what spaced repetition does with the others.
 */
export default function SessionComplete({
  reviewed, recalled, dueLeft, onNext, onDone,
}: {
  reviewed: number;
  recalled: number;
  dueLeft: number;
  onNext: () => void;
  onDone: () => void;
}) {
  const missed = reviewed - recalled;
  return (
    <div className="sdone" role="status">
      <style>{SC_CSS}</style>
      <Mascot pose="celebrate" width={128} className="sdone-owl" />
      <div className="sdone-body">
        <div className="sdone-title">Session complete</div>
        <p>
          You went through all {reviewed} card{reviewed === 1 ? '' : 's'} and knew {recalled} of them.
          {missed > 0 && ` The other ${missed} will come round again sooner.`}
        </p>
        <div className="sdone-actions">
          {dueLeft > 0 && (
            <button type="button" className="ds-btn ds-btn-solid ds-btn-sm" onClick={onNext}>Start the next {dueLeft} due</button>
          )}
          <button type="button" className="ds-btn ds-btn-line ds-btn-sm" onClick={onDone}>Done for now</button>
        </div>
      </div>
    </div>
  );
}

const SC_CSS = `
.sdone {
  display: flex; align-items: center; gap: var(--space-6);
  padding: var(--space-5) var(--space-6); margin: var(--space-3) 0 var(--space-4);
  background: var(--success-wash); border: 1px solid color-mix(in srgb, var(--success-text) 30%, transparent); border-radius: var(--radius-xl);
}
.sdone-owl { height: auto; flex-shrink: 0; }
.sdone-title { font-size: 1.2rem; font-weight: 800; letter-spacing: -0.01em; color: var(--text); margin-bottom: var(--space-1); }
.sdone p { margin: 0; font-size: 0.95rem; line-height: 1.6; color: var(--text2); }
.sdone-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); }
@media (max-width: 560px) {
  .sdone { flex-direction: column; text-align: center; padding: var(--space-5) var(--space-4); gap: var(--space-3); }
  .sdone-actions { justify-content: center; }
  .sdone-owl { width: 96px; }
}
`;
