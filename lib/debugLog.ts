/**
 * Trace logging for the multi-pass evaluation pipeline.
 *
 * The 22 console.log calls in app/api/evaluate ran unconditionally in
 * production. Most were harmless pass markers, but three carried content:
 * the OCR transcript of the student's handwritten answer, the model's full
 * chain-of-thought, and the generated reference answer. Student work was
 * being written to the platform log on every evaluation.
 *
 * The trace is worth keeping, so it is gated rather than deleted: on in
 * development, and in production only when EVAL_DEBUG is explicitly set.
 */
const enabled =
  process.env.EVAL_DEBUG === '1' || process.env.NODE_ENV !== 'production';

export function debug(...args: unknown[]): void {
  if (enabled) console.log(...args);
}
