import { linkifyCitations, shortSource } from '../lib/chatCitations';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
};
const sources = [
  { book_title: 'First Author — First Book', author: 'First Author' },
  { book_title: 'Second Author — Second Book', author: 'Second Author' },
  { book_title: 'Third Book', author: 'Third Author' },
];
/** The data-citation of each chip, in order. */
const chips = (html: string) => Array.from(html.matchAll(/class="chat-cite" data-citation="([^"]+)"/g), (m) => m[1]);
const run = (text: string) => linkifyCitations(text, sources);

console.log('\nEnglish');
eq('[Source #1] becomes a chip', chips(run('A claim [Source #1].')), ['1']);
eq('[Source 1, #3] is one chip for both', chips(run('A claim [Source 1, #3].')), ['1,3']);
eq('a trailing Source #2 becomes a chip', chips(run('A claim, Source #2.')), ['2']);
eq('a number past the last source stays text', run('A claim [Source #9].'), 'A claim [Source #9].');
eq('"according to Source 2" stays words', chips(run('According to Source 2, the claim holds.')), []);

console.log('\nHindi');
eq('[स्रोत #1, #2] becomes one chip', chips(run('यह एक दावा है। [स्रोत #1, #2]')), ['1,2']);
eq('[स्रोत #1 और #3] becomes one chip', chips(run('यह एक दावा है [स्रोत #1 और #3]।')), ['1,3']);
eq('Devanagari digits are read', chips(run('यह एक दावा है [स्रोत #२]।')), ['2']);
eq('a trailing स्रोत #2 before the danda becomes a chip', chips(run('यह एक दावा है, स्रोत #2।')), ['2']);
eq('the chip sits flush against the danda', /<\/button>।/.test(run('यह एक दावा है [स्रोत #2] ।')), true);
eq('"स्रोत #2 के अनुसार" keeps its words as an inline link',
  run('स्रोत #2 के अनुसार यह सही है।').includes('<span class="chat-citation" data-citation="2">स्रोत #2</span>'), true);
eq('the English marker in a Hindi answer still works', chips(run('यह एक दावा है [Source #3]।')), ['3']);

console.log('\nshortSource');
eq('author part of a title', shortSource(sources[0]), 'First Author');
eq('author field when the title has none', shortSource(sources[2]), 'Third Author');
eq('IGNOU is not an author name', shortSource({ book_title: 'Some IGNOU Course', author: 'IGNOU' }), 'Some IGNOU Course');

console.log(fails ? `\n${fails} failing\n` : '\nall passing\n');
process.exit(fails ? 1 : 0);
