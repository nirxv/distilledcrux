import { mergePyq, mergeSyllabus } from '../lib/progressMerge';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
};

console.log('mergeSyllabus');
eq('unions two devices', mergeSyllabus(
  { completed: { 'sociology/karl-marx': true }, completionDates: { 'sociology/karl-marx': '2026-09-01' } },
  { completed: { 'sociology/max-weber': true }, completionDates: { 'sociology/max-weber': '2026-09-02' } },
), { completed: { 'sociology/karl-marx': true, 'sociology/max-weber': true }, completionDates: { 'sociology/karl-marx': '2026-09-01', 'sociology/max-weber': '2026-09-02' } });
eq('keeps the earlier completion date', mergeSyllabus(
  { completed: { 'sociology/karl-marx': true }, completionDates: { 'sociology/karl-marx': '2026-09-05' } },
  { completed: { 'sociology/karl-marx': true }, completionDates: { 'sociology/karl-marx': '2026-08-01' } },
).completionDates, { 'sociology/karl-marx': '2026-08-01' });
eq('false does not count as done', mergeSyllabus({ completed: { 'sociology/karl-marx': false } }, undefined), { completed: {}, completionDates: {} });
eq('ticks without a date survive', mergeSyllabus({ completed: { 'geography/oceanography': true } }, {}), { completed: { 'geography/oceanography': true }, completionDates: {} });
eq('keys without a subject are dropped', mergeSyllabus({ completed: { 'karl-marx': true, 'pub-admin/public-policy': true } }, null).completed, { 'pub-admin/public-policy': true });
eq('junk on both sides', mergeSyllabus('nonsense', [1, 2, 3]), { completed: {}, completionDates: {} });
eq('both empty', mergeSyllabus(undefined, undefined), { completed: {}, completionDates: {} });

console.log('mergePyq');
eq('unions two devices', mergePyq({ 'sociology:1067': '2026-09-01' }, { 'anthropology:2': '2026-09-02' }), { 'sociology:1067': '2026-09-01', 'anthropology:2': '2026-09-02' });
eq('the same id in two subjects stays two marks', Object.keys(mergePyq({ 'anthropology:2': 'a' }, { 'pub-admin:2': 'b' })).length, 2);
eq('keeps the earlier date', mergePyq({ 'polsci:41': '2026-09-09' }, { 'polsci:41': '2026-09-01' }), { 'polsci:41': '2026-09-01' });
eq('an undated mark takes the dated one', mergePyq({ 'polsci:41': '' }, { 'polsci:41': '2026-09-01' }), { 'polsci:41': '2026-09-01' });
eq('bare ids and junk keys are dropped', mergePyq({ '41': 'x', 'sociology:abc': 'y', 'geography:441': 'z' }, null), { 'geography:441': 'z' });
eq('a non-string date becomes empty', mergePyq({ 'geography:441': 12 }, undefined), { 'geography:441': '' });
eq('arrays are not a document', mergePyq([1, 2], ['a']), {});

if (fails) { console.log(`\n${fails} failing`); process.exit(1); }
console.log('\nall passing');
