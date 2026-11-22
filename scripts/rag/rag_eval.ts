/**
 * Prints what the grounded retrieval returns for some questions: the plan, then
 * each passage with its heading, score and note. Ends with a fact-check sample.
 *
 *   npx tsx --env-file=.env.local scripts/rag/rag_eval.ts                    # built-in questions
 *   npx tsx --env-file=.env.local scripts/rag/rag_eval.ts sociology "question"
 */
import { retrieve } from '../../lib/rag/retrieve';
import { checkFacts } from '../../lib/rag/factCheck';
import type { SubjectKey } from '../../lib/subjectConfig';

const QUESTIONS: [SubjectKey, string][] = [
  ['sociology', 'Critically examine Durkheim\'s concept of anomie. How did Merton modify it? (20 marks)'],
  ['sociology', 'Discuss Sanskritisation as a process of social mobility in India.'],
  ['sociology', 'Weber\'s ideal type is a methodological tool, not a description of reality. Comment.'],
  ['anthropology', 'Discuss the contribution of Malinowski to functionalism in anthropology.'],
  ['anthropology', 'Explain the culture area concept and its limitations.'],
  ['polsci', 'Explain Rawls\'s theory of justice as fairness.'],
  ['polsci', 'Discuss the relevance of Non-Alignment in the post-Cold War world.'],
  ['geography', 'Critically examine Mackinder\'s Heartland theory.'],
  ['geography', 'Explain Christaller\'s central place theory and its assumptions.'],
  ['pub-admin', 'Examine Riggs\'s prismatic-sala model.'],
  ['pub-admin', 'Discuss the significance of the Minnowbrook conferences for New Public Administration.'],
];

async function main() {
  const args = process.argv.slice(2);
  const qs: [SubjectKey, string][] = args.length >= 2 ? [[args[0] as SubjectKey, args.slice(1).join(' ')]] : QUESTIONS;
  for (const [subject, q] of qs) {
    const r = await retrieve(q, { subject });
    console.log(`\n=== [${subject}] ${q.slice(0, 110)}`);
    console.log(`plan: units ${JSON.stringify(r.plan.units)} facts ${JSON.stringify(r.plan.facts.map((f) => f.id))}`);
    console.log(`      why: ${r.plan.why.join('; ') || '(nothing named)'}  claims: ${r.plan.claims.length}`);
    console.log(`stage ${r.stage}, ${r.hits.length} passages, ${r.facts.length} key facts, ${r.ms} ms`);
    r.hits.forEach((h, i) => console.log(`  [S${i + 1}] ${h.score.toFixed(3)} ${h.tagged ? '' : '(untagged) '}${h.header}\n       ${(h.context || h.text).slice(0, 140)}`));
  }
  const samples: [SubjectKey, string][] = [
    ['sociology', 'Weber\'s concept of anomie explains the breakdown of norms.'],
    ['sociology', 'Durkheim\'s The Division of Labour in Society (1897) contrasts mechanical and organic solidarity.'],
    ['sociology', 'Durkheim\'s The Division of Labour in Society (1893) contrasts mechanical and organic solidarity.'],
  ];
  for (const [s, t] of samples) console.log(`\nfact check: ${t}\n  ->`, checkFacts(t, s).map((i) => `${i.severity} ${i.kind}: ${i.said}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
