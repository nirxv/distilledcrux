import { parseMentorSections } from '../lib/chatMentor';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
};

console.log('\nparseMentorSections');

eq('plain markers split into sections',
  parseMentorSections('##DIAGNOSIS##\n**Trap:** x\n##END##\n\n##BLUEPRINTS##\n**A — Chronological** ⟶ y\n##END##\n\nWhich blueprint?'),
  [
    { type: 'DIAGNOSIS', content: '**Trap:** x' },
    { type: 'BLUEPRINTS', content: '**A — Chronological** ⟶ y' },
    { type: 'TEXT', content: 'Which blueprint?' },
  ]);

eq('bold-wrapped markers leave no stray asterisks or text between cards',
  parseMentorSections('**##DIAGNOSIS##**\n**Best structure:** blend\n**##END##**\n\n**##BLUEPRINTS##**\n**A — Chronological** ⟶ y\n**##END##**'),
  [
    { type: 'DIAGNOSIS', content: '**Best structure:** blend' },
    { type: 'BLUEPRINTS', content: '**A — Chronological** ⟶ y' },
  ]);

eq('asterisks split from the marker onto their own lines are dropped',
  parseMentorSections('##DIAGNOSIS##\n**Trap:** x\n**\n##END##\n**\n\n**\n##BLUEPRINTS##\n**\n**A** y\n##END##'),
  [
    { type: 'DIAGNOSIS', content: '**Trap:** x' },
    { type: 'BLUEPRINTS', content: '**A** y' },
  ]);

eq('bold inside a section is untouched',
  parseMentorSections('##DIAGNOSIS##\n**Trap:** **Treating Bhakti as monolithic**\n##END##'),
  [{ type: 'DIAGNOSIS', content: '**Trap:** **Treating Bhakti as monolithic**' }]);

eq('an answer with no markers is one text section',
  parseMentorSections('Just an answer.'),
  [{ type: 'TEXT', content: 'Just an answer.' }]);

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nall passed');
