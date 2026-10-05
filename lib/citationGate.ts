import { SUBJECT_BROAD_ONLY, SUBJECT_THINKER_BOOKS, type SubjectKey } from '@/lib/subjectConfig';
import { fixSentenceSpacing } from '@/lib/textSpacing';

/**
 * Citation auditing at sentence granularity, so answers can stream.
 *
 * /api/chat used to hold the whole answer until it was finished: a streamed
 * token cannot be recalled, and the audit below deletes thinker citations it
 * cannot substantiate, so the answer was buffered, audited, passed through a
 * second model as a citation verifier, and only then sent in one piece. The
 * reader watched a blank screen for the full generation.
 *
 * history-optional made the same trade first and then undid it. Its verifier
 * call had no timeout and hung functions into the 60-second limit, so it was
 * switched off; what remained was local string matching whose rules are all
 * scoped to one sentence, and holding a whole answer for a per-sentence check
 * costs 30-60 seconds for nothing. This file is that site's gate, keyed by
 * subject: no sentence reaches the client before it has been audited, and
 * each is released as soon as it is complete. The verifier is gone with the
 * buffer; the passages are cited inline, and the reader can open each one.
 */

const CLAIM_VERB =
  /argues|notes|writes|states|claimed|asserts|observes|emphasises|emphasizes|points out|concludes|suggests|contends|maintains/;

const BRACKET = /\([A-Z][a-zA-Z.\s]+?,\s*[^)]+?\)/;

/**
 * Inline RAG citations: the claim is already tied to a retrieved passage. The
 * prompt asks for [Source #N], and models write [Source N] about as often.
 */
const SOURCE_CITATION = /\bSources?\s*#?\s*\d+/;

/**
 * Audits one sentence against one subject's lists.
 *
 * Returns the sentence to emit, or null to drop it entirely.
 *
 * A sentence carrying a `Source #N` citation is passed through: it is grounded
 * in a passage that was actually retrieved. The decision is per sentence, so
 * one cited claim does not wave through the unsourced ones beside it.
 */
export function auditSentence(sentence: string, subject: SubjectKey): string | null {
  if (SOURCE_CITATION.test(sentence)) return sentence;

  // Rule A — a thinker the corpus covers only in outline, carrying a specific
  // claim. The whole sentence goes: unlike a misattributed title, there is no
  // underlying fact to preserve once the attribution is invented.
  for (const name of SUBJECT_BROAD_ONLY[subject] ?? []) {
    if (sentence.includes(name) && (CLAIM_VERB.test(sentence) || BRACKET.test(sentence))) {
      return null;
    }
  }

  // Rule B — a whitelisted thinker cited against a book that is not theirs.
  // Only the bracket is removed; the claim itself may well be true, just
  // wrongly sourced.
  let cleaned = sentence;
  for (const [thinker, books] of Object.entries(SUBJECT_THINKER_BOOKS[subject] ?? {})) {
    if (!cleaned.includes(thinker)) continue;
    for (const bracket of cleaned.match(/\([^)]+\)/g) ?? []) {
      if (/^\(\d{4}\)$/.test(bracket.trim())) continue;      // a bare year
      if (!/[a-zA-Z]{4,}/.test(bracket)) continue;            // not a title
      const lower = bracket.toLowerCase();
      const verified = books.some((b) => lower.includes(b.slice(0, 10).toLowerCase()));
      if (!verified) {
        // With the space before it, so "Durkheim (Wrong Title) studied"
        // closes up instead of keeping two spaces.
        cleaned = cleaned.split(` ${bracket}`).join('').split(bracket).join('').replace(/\s+([.,;])/g, '$1');
      }
    }
  }

  return cleaned;
}

/**
 * Abbreviations whose full stop does not end a sentence. Single letters are
 * handled separately, which covers initials and also e.g. / i.e. / B.C. / A.D.
 */
const ABBREVIATIONS = new Set([
  'etc', 'cf', 'vs', 'dr', 'mr', 'mrs', 'ms', 'prof', 'no', 'vol', 'ed', 'eds',
  'trans', 'ch', 'pp', 'fig', 'ibid', 'al', 'st', 'approx', 'circa',
]);

/**
 * What ends a sentence. The danda is how a Hindi answer ends almost every
 * sentence; without it a Hindi answer never completed one, was held back
 * whole, and was then dropped at the end as a cut-off tail.
 */
const TERMINATORS = '.!?।';

/**
 * Index just past the end of the first complete sentence in `text`, or -1.
 *
 * Splitting naively on [.!?] is wrong here in a way that defeats the audit:
 * scholars go by their initials — M.N. Srinivas, A.R. Desai, S.C. Dube — so
 * "M.N. Srinivas argues X." fragments into "M.", "N." and
 * " Srinivas argues X.". Rule A only sees the last fragment, and in a
 * streaming gate the first two would already have been emitted.
 *
 * `atEnd` allows a terminator with nothing after it, which is only known to be
 * a real boundary once the model has finished.
 */
function sentenceEnd(text: string, atEnd: boolean): number {
  for (let i = 0; i < text.length; i++) {
    if (!TERMINATORS.includes(text[i])) continue;

    // Absorb repeated terminators ("?!") and any closing quote or bracket.
    let j = i;
    while (j + 1 < text.length && TERMINATORS.includes(text[j + 1])) j++;
    while (j + 1 < text.length && `"'»)]`.includes(text[j + 1])) j++;

    const after = j + 1;
    const followedBySpace = after < text.length && /\s/.test(text[after]);
    // Mid-stream, only whitespace proves the sentence actually ended; more
    // text may still be coming for this one.
    if (!followedBySpace && !(atEnd && after >= text.length)) continue;

    if (text[i] === '.') {
      const before = text.slice(0, i);
      // A single letter before the stop is an initial: M. / N. / e.g. / B.C.
      // The preceding character may itself be a full stop — in "M.N." the N is
      // an initial too, and missing that splits the name in half.
      if (/(?:^|[\s(.])[A-Za-z]$/.test(before)) continue;
      const word = (before.match(/([A-Za-z]+)$/) ?? [])[1];
      if (word && ABBREVIATIONS.has(word.toLowerCase())) continue;
    }

    return after;
  }
  return -1;
}

export type SentenceGate = {
  /** Feed a token chunk. Emits every sentence that completes. */
  push: (chunk: string) => void;
  /** Call once the model is done. Emits a clean tail, drops a truncated one. */
  flush: () => void;
  /** Total characters actually emitted, for the empty-answer fallback. */
  emitted: () => number;
};

export function createSentenceGate(send: (text: string) => void, subject: SubjectKey): SentenceGate {
  let pending = '';
  let emittedChars = 0;

  const emit = (sentence: string) => {
    const audited = auditSentence(sentence, subject);
    if (audited === null) return;               // Rule A dropped it
    const text = fixSentenceSpacing(audited);
    if (!text) return;
    emittedChars += text.length;
    send(text);
  };

  return {
    push(chunk: string) {
      pending += chunk;
      // Only ever release on a sentence terminator. Flushing on a newline
      // would be more responsive but unsound: "**Sorokin**" alone looks
      // clean, and the claim verb that would condemn it arrives later.
      for (;;) {
        const end = sentenceEnd(pending, false);
        if (end === -1) break;
        emit(pending.slice(0, end));
        pending = pending.slice(end);
      }
    },

    flush() {
      const tail = pending;
      pending = '';
      if (!tail.trim()) return;
      // No terminator means the model was cut off mid-sentence, and a
      // half-sentence is worse than none.
      if (sentenceEnd(tail, true) === -1) return;
      emit(tail);
    },

    emitted: () => emittedChars,
  };
}
