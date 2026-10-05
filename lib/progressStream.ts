/**
 * Reads the progress stream /api/evaluate and /api/read-answer send when asked
 * for it (x-eval-stages, x-ocr-stages): newline-delimited JSON, one {"type":"stage"}
 * line per finished step, then one {"type":"result"} line carrying the status
 * and body the plain response would have had.
 *
 * A response that is not a stream (an older deployment, or an error returned
 * before the stream began) is read as plain JSON, so callers handle one shape.
 */
export type StageEvent = { id?: string } & Record<string, unknown>;

export async function readProgress(
  res: Response,
  onStage: (event: StageEvent) => void,
): Promise<{ status: number; body: unknown }> {
  if (!(res.headers.get('content-type') ?? '').includes('ndjson') || !res.body) {
    const raw = await res.text();
    let body: unknown = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { /* not JSON; the status says what happened */ }
    return { status: res.status, body };
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let result: { status: number; body: unknown } | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg: { type?: string; status?: number; body?: unknown } & StageEvent;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.type === 'stage') onStage(msg);
      else if (msg.type === 'result') result = { status: Number(msg.status) || 500, body: msg.body };
    }
  }
  if (!result) throw new Error('The connection closed before the work finished. Please try again.');
  return result;
}
