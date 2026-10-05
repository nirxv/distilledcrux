import { cleanSuggestion, nextSuggestion, graphemes, suggestions } from '../lib/chatSuggestions';
import type { SubjectKey } from '../lib/subjectConfig';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
};

console.log('\ncleanSuggestion');
eq('a clean question passes', cleanSuggestion('How did Durkheim explain the rise of anomie?'), 'How did Durkheim explain the rise of anomie?');
eq('quotes come off', cleanSuggestion('"What does Srinivas argue about the dominant caste?"'), 'What does Srinivas argue about the dominant caste?');
eq('a label comes off', cleanSuggestion('Follow-up question: Why is the joint family changing?'), 'Why is the joint family changing?');
eq('numbering comes off', cleanSuggestion('1. Why is the joint family changing?'), 'Why is the joint family changing?');
eq('only the first line is kept', cleanSuggestion('Why is the joint family changing?\nAnother one?'), 'Why is the joint family changing?');
eq('bold markers come off', cleanSuggestion('What did **Weber** mean by verstehen?'), 'What did Weber mean by verstehen?');
eq('Hindi keeps its question mark', cleanSuggestion('संयुक्त परिवार क्यों बदल रहा है?'), 'संयुक्त परिवार क्यों बदल रहा है?');
eq('a statement is refused', cleanSuggestion('You could look at the joint family next.'), null);
eq('too short is refused', cleanSuggestion('Why?'), null);
eq('too long is refused', cleanSuggestion('Why ' + 'really '.repeat(30) + 'did it happen?'), null);
eq('nothing is refused', cleanSuggestion(''), null);
eq('a non-string is refused', cleanSuggestion(undefined), null);

console.log('\nnextSuggestion');
{
  let changed = true;
  for (let i = 0; i < 500; i++) { const prev = i % 24; if (nextSuggestion(prev, 24) === prev) changed = false; }
  eq('never repeats the one just shown', changed, true);
  let inRange = true;
  for (let i = 0; i < 500; i++) { const n = nextSuggestion(i % 24, 24); if (n < 0 || n > 23) inRange = false; }
  eq('stays inside the list', inRange, true);
  eq('a list of one stays put', nextSuggestion(0, 1), 0);
}

console.log('\nsuggestions');
{
  const subjects: SubjectKey[] = ['sociology', 'anthropology', 'polsci', 'geography', 'pub-admin'];
  eq('every optional has its own English and Hindi lists',
    subjects.every((s) => suggestions(s, false).length >= 12 && suggestions(s, true).length >= 8), true);
  eq('each is a question short enough to read in the input',
    subjects.flatMap((s) => [...suggestions(s, false), ...suggestions(s, true)]).filter((q) => !q.endsWith('?') || q.length > 72), []);
}

console.log('\ngraphemes');
eq('English splits by letter', graphemes('Why?'), ['W', 'h', 'y', '?']);
eq('a Devanagari syllable stays whole', graphemes('का').length, 1);

console.log(fails ? `\n${fails} failing\n` : '\nall passing\n');
process.exit(fails ? 1 : 0);
