/**
 * Applies scripts/pyq/questionFixes.json to the five PYQ files in public/data.
 *
 * The questions came from scanned UPSC papers (2016 on) and from web pages
 * (2000-2015), and both left debris in the text that has been live since:
 *
 *   "...institutional anc political 5 economic arrangements ... different * classes"   margin marks
 *   "...Comment. 15 :: Section - B :: Q.5. A"                                           marks and headings glued on
 *   "ervices as a privileged elite. Hence, ..."                                          cut off mid-word
 *   "compare the perspective of m.n.srinivas & s.c. dube 30 mks"                       typed web copy
 *
 * Each entry was read against the question and, where it changes words, the
 * paper itself. The file has three parts:
 *
 *   fixes  question text, { from, to }. Applies only while the question still
 *          reads exactly as `from`, so it cannot overwrite a question that has
 *          changed since. A `to` of null drops the row: an instruction line,
 *          scan garbage, a duplicate, or a question not in the paper it was
 *          filed under.
 *   set    any other field, { field: [from, to] }, on the same terms.
 *   order  papers whose rows are re-sorted by question number and part, for
 *          papers rebuilt from the official paper, where rows moved slot.
 *   add    questions that sat inside another row or were missing, each placed
 *          straight after the row named by `after`, or before the one named by
 *          `before` when it opens its paper (several at one row keep their
 *          order), so they sort where the paper has them.
 *
 * Ids are never renumbered, so attempts saved against the remaining questions
 * stay attached to them. Running it again changes nothing.
 *
 * Run: npx tsx scripts/pyq/fixQuestions.mts
 */
import fs from 'node:fs';

type Row = { id: number; question: string } & Record<string, unknown>;
type Fix = { from: string; to: string | null };
type Add = { id: number; after?: number; before?: number } & Record<string, unknown>;

const FILES: Record<string, string> = {
  sociology: 'public/data/sociology-pyqs.json',
  anthropology: 'public/data/anthropology-pyqs.json',
  polsci: 'public/data/psir-pyqs.json',
  geography: 'public/data/geography-pyqs.json',
  'pub-admin': 'public/data/pubad-pyqs.json',
};

const spec = JSON.parse(fs.readFileSync('scripts/pyq/questionFixes.json', 'utf8')) as {
  fixes: Record<string, Record<string, Fix>>;
  set: Record<string, Record<string, Record<string, [unknown, unknown]>>>;
  add: Record<string, Add[]>;
  order?: Record<string, [string, string][]>;
};

/** "Q4" or "4", and "c", as a sortable pair. */
const slot = (r: Row) => [Number(String(r.question_no ?? '').replace(/\D/g, '')) || 0, String(r.subpart ?? '')] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

for (const [subject, file] of Object.entries(FILES)) {
  let rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Row[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const n = { text: 0, dropped: 0, set: 0, added: 0, already: 0 };

  const drop = new Set<number>();
  for (const [key, f] of Object.entries(spec.fixes[subject] ?? {})) {
    const row = byId.get(Number(key));
    if (!row) {
      // A dropped row stays dropped.
      if (f.to === null) { n.already++; continue; }
      throw new Error(`${subject} ${key} is not in ${file}`);
    }
    if (f.to !== null && row.question === f.to) { n.already++; continue; }
    if (row.question !== f.from) throw new Error(`${subject} ${key}: the question reads neither as the fix's "from" nor its "to"`);
    if (f.to === null) { drop.add(row.id); n.dropped++; }
    else { row.question = f.to; n.text++; }
  }

  for (const [key, fields] of Object.entries(spec.set[subject] ?? {})) {
    const row = byId.get(Number(key));
    if (!row) throw new Error(`${subject} ${key} is not in ${file}`);
    for (const [field, [from, to]] of Object.entries(fields)) {
      if (same(row[field], to)) { n.already++; continue; }
      if (!same(row[field], from)) throw new Error(`${subject} ${key}: ${field} is neither ${JSON.stringify(from)} nor ${JSON.stringify(to)}`);
      row[field] = to;
      n.set++;
    }
  }

  if (drop.size) rows = rows.filter((r) => !drop.has(r.id));

  // Added rows take their neighbour's shape, so every row in a file has the
  // same fields in the same order.
  const after = new Map<number, Row[]>();
  const before = new Map<number, Row[]>();
  for (const a of spec.add[subject] ?? []) {
    const existing = byId.get(a.id);
    const { after: at0, before: bt, ...fields } = a;
    const at = (at0 ?? bt)!;
    if (existing) {
      if (!Object.entries(fields).every(([k, v]) => same(existing[k], v))) throw new Error(`${subject} ${a.id} exists and differs from the row to add`);
      n.already++;
      continue;
    }
    const neighbour = byId.get(at);
    if (!neighbour || drop.has(at)) throw new Error(`${subject} ${a.id}: row ${at} to place it after is not in ${file}`);
    const extra = Object.keys(fields).filter((k) => !(k in neighbour));
    if (extra.length) throw new Error(`${subject} ${a.id}: fields ${extra.join(', ')} are not used in ${file}`);
    const row = Object.fromEntries(Object.keys(neighbour).map((k) => [k, k in fields ? fields[k] : (k === 'section' ? '' : null)])) as Row;
    const into = at0 !== undefined ? after : before;
    into.set(at, [...(into.get(at) ?? []), row]);
    n.added++;
  }
  if (after.size || before.size) rows = rows.flatMap((r) => [...(before.get(r.id) ?? []), r, ...(after.get(r.id) ?? [])]);

  // Re-sort a rebuilt paper in place: its rows keep the positions the paper
  // held in the file, filled in question order.
  for (const [year, paper] of spec.order?.[subject] ?? []) {
    const at = rows.flatMap((r, i) => (r.year === year && r.paper === paper ? [i] : []));
    const sorted = at.map((i) => rows[i]).sort((a, b) => {
      const [qa, pa] = slot(a), [qb, pb] = slot(b);
      return qa - qb || pa.localeCompare(pb);
    });
    at.forEach((i, k) => { rows[i] = sorted[k]; });
  }

  // The files are written as Python's json.dump(indent=1) left them, which
  // JSON.stringify reproduces byte for byte, so a diff shows only the changes.
  fs.writeFileSync(file, JSON.stringify(rows, null, 1));
  console.log(`  ${subject}: text ${n.text}, dropped ${n.dropped}, fields ${n.set}, added ${n.added}, already applied ${n.already}`);
}
