import { takeStages } from '../lib/chatStream';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
};

console.log('\ntakeStages');

eq('nothing yet is undecided',
  takeStages(''), { events: [], rest: '', pending: true });

eq('stage lines come off the front, the answer stays',
  takeStages('__STAGE__{"id":"search","book":null}\n__STAGE__{"id":"write"}\nThe Mauryas'),
  { events: [{ id: 'search', book: null }, { id: 'write' }], rest: 'The Mauryas', pending: false });

eq('a stage line cut mid-way waits for the rest',
  takeStages('__STAGE__{"id":"found","pass'),
  { events: [], rest: '__STAGE__{"id":"found","pass', pending: true });

eq('a cut inside the marker itself waits too',
  takeStages('__STA'), { events: [], rest: '__STA', pending: true });

eq('an answer from an old server has no stages and is not held',
  takeStages('Ashoka was'), { events: [], rest: 'Ashoka was', pending: false });

eq('an answer that merely starts with underscores is not held for ever',
  takeStages('__init__ is a Python name'), { events: [], rest: '__init__ is a Python name', pending: false });

eq('a malformed stage line is dropped, never shown',
  takeStages('__STAGE__{oops\nText'), { events: [], rest: 'Text', pending: false });

eq('stages then nothing else yet is undecided',
  takeStages('__STAGE__{"id":"write"}\n'), { events: [{ id: 'write' }], rest: '', pending: true });

console.log(fails ? `\n${fails} failing\n` : '\nall passing\n');
process.exit(fails ? 1 : 0);
