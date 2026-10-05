/**
 * Citations in a chat answer, rendered as chips. The model cites retrieved
 * passages as [Source #N]; the page turns each into a small chip naming the
 * author, which opens the passage in the side panel through data-citation.
 *
 * Kept out of the chat page so it can be tested (tests/chatCitations.test.mts).
 */

/** What a chip needs to know about a cited passage. */
export type CitedSource = { book_title: string; author?: string };

/**
 * One citation, in English or in Hindi: "Source #2", "Sources 1 and 3",
 * "Sources #1, #4", "स्रोत #2", "स्रोत #1 और #3". A Hindi answer is told to
 * keep the English marker, and mostly does, but a model writing Devanagari
 * translates the word often enough that answers already saved carry it. The
 * \b sits inside the English branch only: JavaScript's word boundary does not
 * know Devanagari letters, so it would never match before स्रोत.
 */
const CITE_CORE = String.raw`(?:\bSources?|स्रोत)\s*#?\s*\d+(?:\s*(?:,|and|और|&)\s*#?\s*\d+)*`;
// A citation the model set apart: 【Source 2】, [Sources #1, #3], (Source #2; Source #4)
const CITE_GROUP = new RegExp(String.raw`\s*[【\[(（]\s*(${CITE_CORE}(?:\s*[,;]\s*(?:(?:and|और)\s+)?${CITE_CORE})*)\s*[】\])）]`, 'gi');
// One closing a clause: "...the frontier, Source #2." The danda closes a Hindi one.
const CITE_TRAILING = new RegExp(String.raw`\s*,?\s*(${CITE_CORE})\b(?=\s*(?:[.,;:!?।]|<br|</|$))`, 'gi');
const CITE_BARE = new RegExp(String.raw`${CITE_CORE}\b`, 'gi');
// A citation that is part of the sentence ("according to Source 2") stays as
// words; turning it into an icon would leave "according to (i)".
const CITE_IN_PROSE = /\b(?:to|in|from|by|see|per|as|of|and|with|cf\.?)\s*$/i;

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/** "स्रोत #२" -> "स्रोत #2": a model writing Devanagari can number in it too. */
function westernDigits(html: string): string {
  return html.replace(/स्रोत(?:\s*#?\s*[०-९\d]+(?:\s*(?:,|और|&))?)+/g, (m) =>
    m.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d))));
}

/** "Khullar — India: A Comprehensive Geography" -> "Khullar"; a title with no author part stays whole. */
export function shortSource(s: CitedSource): string {
  const parts = s.book_title.split(/\s+[—–-]\s+/);
  if (parts.length > 1) return parts[0];
  if (s.author && !/^(unknown|ignou)$/i.test(s.author)) return s.author;
  return s.book_title;
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Citations render as a small chip after the claim instead of "[Source 2]" in
 * the running text. Hovering shows the book; clicking opens the passage in the
 * side panel, found through data-citation by the answer's click handler.
 */
export function linkifyCitations(html: string, sources: CitedSource[]): string {
  if (!sources.length) return html;
  html = westernDigits(html);
  const icons: number[][] = [];
  const numbers = (s: string) =>
    Array.from(s.matchAll(/\d+/g), m => parseInt(m[0], 10)).filter(n => n >= 1 && n <= sources.length);
  const hold = (match: string, nums: number[]) => {
    if (!nums.length) return match;
    icons.push(nums);
    return `\u0000${icons.length - 1}\u0000`;
  };

  html = html.replace(CITE_GROUP, (match, inner: string) => hold(match, numbers(inner)));
  html = html.replace(CITE_TRAILING, (match, core: string, offset: number, all: string) =>
    CITE_IN_PROSE.test(all.slice(Math.max(0, offset - 12), offset)) ? match : hold(match, numbers(core)));
  // Mid-sentence references keep the old inline link.
  html = html.replace(CITE_BARE, (match) => {
    const nums = numbers(match);
    return nums.length ? `<span class="chat-citation" data-citation="${nums.join(',')}">${match}</span>` : match;
  });

  // Back-to-back citations become one icon; an icon sits flush against the
  // punctuation that follows it.
  html = html.replace(/\u0000(\d+)\u0000(?:\s*\u0000(\d+)\u0000)+/g, (run) => {
    const ids = Array.from(run.matchAll(/\u0000(\d+)\u0000/g), m => Number(m[1]));
    icons[ids[0]] = [...new Set(ids.flatMap(id => icons[id]))].sort((a, b) => a - b);
    return `\u0000${ids[0]}\u0000`;
  });
  html = html.replace(/(\u0000\d+\u0000)\s+(?=[.,;:!?।])/g, '$1');

  return html.replace(/\u0000(\d+)\u0000/g, (_, id: string) => {
    const nums = icons[Number(id)];
    const cited = nums.map(n => sources[n - 1]);
    const names = [...new Set(cited.map(shortSource))];
    const books = [...new Set(cited.map(s => s.book_title))].join(' · ');
    const label = `${nums.length > 1 ? 'Sources' : 'Source'} ${nums.join(', ')}: ${books}`;
    const more = names.length > 1 ? `<span class="chat-cite-more">+${names.length - 1}</span>` : '';
    return `<button type="button" class="chat-cite" data-citation="${nums.join(',')}" title="${escAttr(books)}" aria-label="${escAttr(label)}"><span class="chat-cite-name">${escAttr(names[0])}</span>${more}</button>`;
  });
}
