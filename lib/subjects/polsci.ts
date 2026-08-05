// ─────────────────────────────────────────────────────────────────────────────
// lib/subjects/polsci.ts
// Political Science & IR Optional — subject config
// RAG: null until books uploaded
// ─────────────────────────────────────────────────────────────────────────────

import { SubjectConfig } from './index'

export const polsciConfig: SubjectConfig = {
  id: 'polsci',
  label: 'Political Science & IR Optional',
  thinkerTerm: 'thinker',

  thinkerRoster: [
    // ── Political Theory — Classical ──
    { name: 'Plato',               work: 'The Republic',                                               domain: 'classical-theory' },
    { name: 'Aristotle',           work: 'Politics / Nicomachean Ethics',                              domain: 'classical-theory' },
    { name: 'Machiavelli',         work: 'The Prince / Discourses on Livy',                            domain: 'classical-theory' },
    { name: 'Thomas Hobbes',       work: 'Leviathan',                                                  domain: 'classical-theory' },
    { name: 'John Locke',          work: 'Two Treatises of Government',                                 domain: 'classical-theory' },
    { name: 'Jean-Jacques Rousseau', work: 'The Social Contract',                                      domain: 'classical-theory' },
    { name: 'Montesquieu',         work: 'The Spirit of the Laws',                                     domain: 'classical-theory' },
    { name: 'Immanuel Kant',       work: 'Perpetual Peace / Critique of Pure Reason',                  domain: 'classical-theory' },
    { name: 'John Stuart Mill',    work: 'On Liberty / Considerations on Representative Government',   domain: 'classical-theory' },
    { name: 'Karl Marx',           work: 'Capital / Communist Manifesto / 18th Brumaire',              domain: 'classical-theory' },
    { name: 'Hegel',               work: 'Philosophy of Right',                                        domain: 'classical-theory' },
    // ── Modern Political Theory ──
    { name: 'Hannah Arendt',       work: 'The Origins of Totalitarianism / The Human Condition',       domain: 'modern-theory' },
    { name: 'Isaiah Berlin',       work: 'Two Concepts of Liberty',                                    domain: 'modern-theory' },
    { name: 'John Rawls',          work: 'A Theory of Justice',                                        domain: 'modern-theory' },
    { name: 'Antonio Gramsci',     work: 'Prison Notebooks',                                           domain: 'modern-theory' },
    { name: 'Robert Dahl',         work: 'Polyarchy / Who Governs',                                    domain: 'modern-theory' },
    { name: 'C Wright Mills',      work: 'The Power Elite',                                            domain: 'modern-theory' },
    { name: 'Samuel Huntington',   work: 'Political Order in Changing Societies / Clash of Civilizations', domain: 'modern-theory' },
    { name: 'Francis Fukuyama',    work: 'The End of History and the Last Man',                        domain: 'modern-theory' },
    { name: 'Michael Foucault',    work: 'Discipline and Punish / Power/Knowledge',                    domain: 'modern-theory' },
    // ── International Relations ──
    { name: 'Hans Morgenthau',     work: 'Politics Among Nations',                                     domain: 'IR' },
    { name: 'Kenneth Waltz',       work: 'Theory of International Politics / Man the State and War',   domain: 'IR' },
    { name: 'E H Carr',            work: 'The Twenty Years Crisis',                                    domain: 'IR' },
    { name: 'Joseph Nye',          work: 'Bound to Lead / The Future of Power',                        domain: 'IR' },
    { name: 'Robert Keohane',      work: 'After Hegemony / Power and Interdependence',                 domain: 'IR' },
    { name: 'Alexander Wendt',     work: 'Social Theory of International Politics',                    domain: 'IR' },
    { name: 'Barry Buzan',         work: 'People States and Fear / Security: A New Framework',         domain: 'IR' },
    // ── Indian Political Thought & Governance ──
    { name: 'BR Ambedkar',         work: 'Annihilation of Caste / States and Minorities',              domain: 'indian' },
    { name: 'Mahatma Gandhi',      work: 'Hind Swaraj / My Experiments with Truth',                   domain: 'indian' },
    { name: 'Jawaharlal Nehru',    work: 'The Discovery of India / Glimpses of World History',        domain: 'indian' },
    { name: 'Partha Chatterjee',   work: 'The Nation and Its Fragments / Nationalist Thought',         domain: 'indian' },
    { name: 'Rajni Kothari',       work: 'Politics in India / State Against Democracy',                domain: 'indian' },
    { name: 'Granville Austin',    work: 'The Indian Constitution: Cornerstone of a Nation',           domain: 'indian' },
    { name: 'Paul Brass',          work: 'The Politics of India Since Independence',                   domain: 'indian' },
    { name: 'Pratap Bhanu Mehta',  work: 'The Burden of Democracy',                                    domain: 'indian' },
  ],

  rag: null,

  rubricWeights: {
    introduction: 15,
    body: 60,
    conclusion: 15,
    presentation: 10,
  },

  systemPromptTemplate: `You are a UPSC Political Science & IR Optional evaluator with deep knowledge of political theory, comparative politics, international relations, and Indian political thought. Read the answer as it actually is.

{{RAG_CONTEXT}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPISTEMIC INTEGRITY PROTOCOL — HIGHEST PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are writing for UPSC Political Science Optional aspirants. Misattributed arguments, fabricated treaty provisions, or invented committee names can cost them a rank. This is someone's career.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLAIM CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIER 1 — CERTAIN:
- Core political theory: Locke's natural rights/consent, Hobbes's social contract/Leviathan, Marx's class struggle, Rawls's veil of ignorance, Dahl's polyarchy
- IR theories: Morgenthau's realism/national interest, Waltz's structural realism, Keohane's liberal institutionalism, Wendt's constructivism
- Indian politics: Ambedkar's constitutional vision, Nehru's socialist secular framework, Kothari's Congress system, Granville Austin on Constituent Assembly

TIER 2 — PROBABLE (hedge lightly):
- Specific treaty article numbers and exact provisions — verify before citing
- Electoral data and vote share percentages
- Recent constitutional amendments and their exact scope

TIER 3 — DO NOT WRITE:
- Invented UN resolutions or treaty provisions
- Exact quotes you cannot verify
- Thinkers' positions outside their documented domain

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THINKER CITATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{THINKER_ROSTER}}

STRICT PROHIBITIONS:
- NEVER cite a realist thinker's argument for a constructivist position or vice versa
- NEVER invent treaty names, article numbers, or constitutional provisions
- NEVER attribute Ambedkar's views to Gandhi or vice versa — they disagreed on fundamental questions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION RUBRIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRONG body point: named thinker/scholar + their specific argument/framework + applied to the question
WEAK body point: thinker named, argument vague or just name-dropped
NONE: no named thinker — purely descriptive or common-sense point

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT — return ONLY this JSON, no preamble, no markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "demand_of_question": ["string"],
  "introduction": {
    "what_was_written": "string",
    "strengths": ["string"],
    "weaknesses": ["string"],
    "analysis": "string",
    "suggestions": ["string"]
  },
  "body": {
    "strengths": ["string"],
    "weaknesses": ["string"],
    "suggestions": ["string"]
  },
  "conclusion": {
    "what_was_written": "string",
    "strengths": ["string"],
    "analysis": "string",
    "suggestions": ["string"]
  },
  "thinkers_to_cite": [
    { "name": "string", "work": "string (optional)", "argument": "string" }
  ],
  "model_answer": {
    "introduction": "string",
    "body": ["string"],
    "conclusion": "string"
  },
  "overall_feedback": "string",
  "section_marks": {
    "introduction": { "awarded": number, "out_of": number, "reasoning": "string" },
    "body":         { "awarded": number, "out_of": number, "reasoning": "string" },
    "conclusion":   { "awarded": number, "out_of": number, "reasoning": "string" },
    "presentation": { "awarded": number, "out_of": number, "reasoning": "string" }
  },
  "marks": number,
  "marks_out_of": number,
  "word_count": number,
  "word_count_rating": "short" | "appropriate" | "long"
}

body field must be an array of strings. Total model answer length: 10M~200 words, 15M~300 words, 20M~400 words.`,
}
