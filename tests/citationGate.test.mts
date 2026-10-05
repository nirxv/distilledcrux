import { auditSentence, createSentenceGate } from '../lib/citationGate';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
};
const soc = (t: string) => auditSentence(t, 'sociology');

console.log('\nauditSentence');
eq('plain prose passes through',
  soc('Caste has shown remarkable resilience in modern India.'),
  'Caste has shown remarkable resilience in modern India.');

eq('Rule A drops a broad-only thinker with a claim verb',
  soc('Sorokin argues that mobility always follows the business cycle.'),
  null);

eq('a broad-only thinker WITHOUT a claim verb survives',
  soc('Sorokin is known for his work on social mobility.'),
  'Sorokin is known for his work on social mobility.');

eq('a Source #N sentence is exempt even with a broad-only name',
  soc('Sorokin argues mobility is channelled through institutions [Source #2].'),
  'Sorokin argues mobility is channelled through institutions [Source #2].');

eq('[Source N] without the # counts as a citation too',
  soc('Sorokin argues mobility is channelled through institutions [Source 2].'),
  'Sorokin argues mobility is channelled through institutions [Source 2].');

eq('the lists are per subject: a sociology name is not checked in geography',
  auditSentence('Sorokin argues something.', 'geography'),
  'Sorokin argues something.');

eq('Rule B removes a book wrongly given to a whitelisted thinker',
  soc('Durkheim (The Wealth of Nations) studied the division of labour.'),
  'Durkheim studied the division of labour.');

eq("Rule B keeps the thinker's own book",
  soc('Durkheim (Suicide, 1897) classified four types of suicide.'),
  'Durkheim (Suicide, 1897) classified four types of suicide.');

eq('a bare year bracket is left alone',
  soc('Srinivas revisited this (1966).'),
  'Srinivas revisited this (1966).');

eq('initials do not split the name apart',
  soc('P.A. Sorokin argues mobility has no direction.'),
  null);

eq('a Hindi स्रोत #N citation is exempt too',
  soc('Sorokin argues mobility is channelled through institutions [स्रोत #2].'),
  'Sorokin argues mobility is channelled through institutions [स्रोत #2].');

console.log('\ncreateSentenceGate');
{
  const out: string[] = [];
  const g = createSentenceGate(t => out.push(t), 'sociology');
  'Caste is a closed system. Class is open.'.split('').forEach(c => g.push(c));
  g.flush();
  eq('emits per sentence, not per token', out.length, 2);
  eq('content preserved in order', out.join(''), 'Caste is a closed system. Class is open.');
}
{
  const out: string[] = [];
  const g = createSentenceGate(t => out.push(t), 'sociology');
  g.push('Good sentence one. ');
  eq('sentence released before the stream ends', out.length, 1);
  g.push('Sorokin argues something invented. ');
  eq('condemned sentence never emitted', out.length, 1);
  g.push('Final good sentence.');
  g.flush();
  eq('later good sentence still emitted', out.length, 2);
}
{
  // The naive [.!?] split would emit "P." and "A." before the claim that
  // condemns the sentence had even arrived.
  const out: string[] = [];
  const g = createSentenceGate(t => out.push(t), 'sociology');
  'P.A. Sorokin argues something invented. Real sentence follows.'
    .split('').forEach(c => g.push(c));
  g.flush();
  eq('no fragment of a condemned sentence escapes', out.join('').includes('P.'), false);
  eq('the following sentence survives', out.join('').trim(), 'Real sentence follows.');
}
{
  const out: string[] = [];
  const g = createSentenceGate(t => out.push(t), 'sociology');
  g.push('Sentence with e.g. an abbreviation inside it. Next one.');
  g.flush();
  eq('abbreviation does not split a sentence', out.length, 2);
}
{
  const out: string[] = [];
  const g = createSentenceGate(t => out.push(t), 'sociology');
  g.push('Complete sentence here. And this one was cut off mid');
  g.flush();
  eq('truncated tail dropped', out.join(''), 'Complete sentence here.');
}
{
  const out: string[] = [];
  const g = createSentenceGate(t => out.push(t), 'sociology');
  g.push('Nothing at all');
  g.flush();
  eq('emitted() reports zero when all dropped', g.emitted(), 0);
}
{
  // Hindi ends its sentences with a danda, not a full stop.
  const out: string[] = [];
  const g = createSentenceGate(t => out.push(t), 'sociology');
  'संस्कृतीकरण एक प्रक्रिया है। निम्न जातियाँ उच्च जातियों की प्रथाएँ अपनाती हैं।'.split('').forEach(c => g.push(c));
  eq('a Hindi sentence is released at its danda', out.length, 1);
  g.flush();
  eq('a Hindi answer is not dropped at the end', out.join(''), 'संस्कृतीकरण एक प्रक्रिया है। निम्न जातियाँ उच्च जातियों की प्रथाएँ अपनाती हैं।');
}
console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
