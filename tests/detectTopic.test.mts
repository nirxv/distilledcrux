import { detectTopic } from '../lib/detectTopic';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
};

console.log('\ndetectTopic');
eq('a thinker named in the question', detectTopic('What did Durkheim mean by anomie?', 'sociology')?.slug, 'emile-durkheim');
eq('a subtopic named in full', detectTopic('Explain historical materialism with examples', 'sociology')?.slug, 'karl-marx');
eq('subtopic words without the exact phrase', detectTopic('What did Simon mean by bounded rationality?', 'pub-admin')?.title, 'Administrative Behaviour');
eq('the subject name alone points nowhere', detectTopic('Why study sociology at all?', 'sociology'), null);
eq('India alone points nowhere', detectTopic('What is happening in India today?', 'sociology'), null);
eq('words match whole, not inside others', detectTopic('Is the broadcaster biased?', 'sociology'), null);
eq('only the given subject is searched', detectTopic('What did Durkheim mean by anomie?', 'geography'), null);

console.log(fails ? `\n${fails} failing\n` : '\nall passing\n');
process.exit(fails ? 1 : 0);
