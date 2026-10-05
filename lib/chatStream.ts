/**
 * The head of an /api/chat stream carries progress lines before any answer
 * text: one `__STAGE__{json}` per line, sent only when the request asked for
 * them. These split them off so the page can tick its checklist and render
 * the rest as the answer.
 */
export type StageEvent =
  | { id: 'search'; book: string | null }
  | { id: 'found'; passages: number; books: string[] }
  | { id: 'pdf'; name: string | null }
  | { id: 'write' };

const STAGE = '__STAGE__';

/**
 * Takes every complete stage line off the front of `buf`.
 *
 * `pending` means the head cannot be decided yet: a stage line has not
 * arrived in full, or what has arrived so far could still be the start of
 * one. The caller keeps `rest` and waits for more bytes rather than printing
 * half a marker into the answer.
 */
export function takeStages(buf: string): { events: StageEvent[]; rest: string; pending: boolean } {
  const events: StageEvent[] = [];
  let rest = buf;
  while (rest.startsWith(STAGE)) {
    const nl = rest.indexOf('\n');
    if (nl === -1) return { events, rest, pending: true };
    try {
      events.push(JSON.parse(rest.slice(STAGE.length, nl)) as StageEvent);
    } catch {
      // A line that does not parse is dropped, not shown: it is never answer text.
    }
    rest = rest.slice(nl + 1);
  }
  const pending = rest.length < STAGE.length && STAGE.startsWith(rest);
  return { events, rest, pending };
}
