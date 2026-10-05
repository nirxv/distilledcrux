import { compose, stepsFor, stepComplete, formatFor, list, goalsFor, sectionsFor, notesIn, EMPTY_START, type StartState } from '../lib/chatStart';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
};
const s = (over: Partial<StartState>): StartState => ({ ...EMPTY_START, ...over });
const soc = (st: StartState) => compose(st, 'sociology');

console.log('\nlist');
eq('one item', list(['a']), 'a');
eq('two items', list(['a', 'b']), 'a and b');
eq('three items', list(['a', 'b', 'c']), 'a, b and c');

console.log('\ncompose');
eq('nothing chosen writes nothing', soc(EMPTY_START), '');
eq('a goal alone writes nothing', soc(s({ goal: 'understand' })), '');
eq('understand a topic',
  soc(s({ goal: 'understand', topics: ['karl-marx'] })),
  'Explain Karl Marx');
eq('understand, narrowed and angled',
  soc(s({ goal: 'understand', topics: ['karl-marx'], focus: ['Alienation', 'Class Struggle'], angles: ['key concepts', "thinkers' views"] })),
  "Explain Alienation and Class Struggle (Karl Marx): key concepts and thinkers' views");
eq('a PYQ is quoted with its year and marks',
  soc(s({ goal: 'pyq', topics: ['karl-marx'], pyq: { id: 1, year: 2019, marks: 20, question: 'Discuss alienation.' } })),
  'Answer this PYQ (2019, 20 marks): Discuss alienation.');
eq('a PYQ goal writes nothing until a question is picked',
  soc(s({ goal: 'pyq', topics: ['karl-marx'] })), '');
eq('compare shows the gap while one topic is chosen',
  soc(s({ goal: 'compare', topics: ['karl-marx'] })), 'Compare Karl Marx and …');
eq('compare two topics on chosen dimensions',
  soc(s({ goal: 'compare', topics: ['karl-marx', 'max-weber'], dimensions: ['core ideas', 'method'] })),
  'Compare Karl Marx and Max Weber on core ideas and method');
eq('scholars are named for the discipline',
  compose(s({ goal: 'scholars', topics: ['karl-marx'] }), 'sociology').startsWith('What do thinkers argue about Karl Marx?'), true);
{
  const geo = sectionsFor('geography').flatMap((sec) => notesIn('geography', sec))[0];
  eq('a geography topic asks what geographers argue',
    compose(s({ goal: 'scholars', topics: [geo.slug] }), 'geography').startsWith(`What do geographers argue about ${geo.title}?`), true);
}
eq('no word counts anywhere',
  /\bwords?\b/.test([
    soc(s({ goal: 'revise', topics: ['karl-marx'], revision: 'facts' })),
    soc(s({ goal: 'revise', topics: ['karl-marx'], revision: 'summary' })),
    soc(s({ goal: 'revise', topics: ['karl-marx'], revision: 'practice' })),
    soc(s({ goal: 'understand', topics: ['karl-marx'] })),
  ].join(' ')), false);

console.log('\nsubjects');
eq('every optional has sections, each with topics',
  (['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'] as const)
    .every((sub) => sectionsFor(sub).length > 0 && sectionsFor(sub).every((sec) => notesIn(sub, sec).length > 0)), true);
eq('the past-question goals wait for topic PYQs',
  goalsFor('sociology').map((g) => g.id), ['understand', 'compare', 'scholars', 'revise']);

console.log('\nsteps');
eq('compare needs two topics', stepComplete('topic', s({ goal: 'compare', topics: ['karl-marx'] })), false);
eq('compare with two topics can go on', stepComplete('topic', s({ goal: 'compare', topics: ['karl-marx', 'max-weber'] })), true);
eq('narrowing is optional', stepComplete('focus', s({ goal: 'understand', topics: ['karl-marx'] })), true);
eq('a PYQ path ends on picking the question', stepsFor('pyq'), ['goal', 'topic', 'question']);
eq('the mentor path is the PYQ path', stepsFor('mentor'), stepsFor('pyq'));
eq('past questions go out as Mains answers', formatFor(s({ goal: 'pyq' })), 'mains');
eq('other goals keep the chosen style', formatFor(s({ goal: 'understand' })), undefined);

console.log(fails ? `\n${fails} failing\n` : '\nall passing\n');
process.exit(fails ? 1 : 0);
