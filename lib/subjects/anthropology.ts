// ─────────────────────────────────────────────────────────────────────────────
// lib/subjects/anthropology.ts
// Anthropology Optional — subject config
// RAG: null until anthropology books uploaded
// ─────────────────────────────────────────────────────────────────────────────

import { SubjectConfig } from './index'

export const anthropologyConfig: SubjectConfig = {
  id: 'anthropology',
  label: 'Anthropology Optional',
  thinkerTerm: 'anthropologist',

  thinkerRoster: [
    // ── Founders / Classical ──
    { name: 'EB Tylor',              work: 'Primitive Culture',                                              domain: 'classical' },
    { name: 'Lewis Henry Morgan',    work: 'Ancient Society',                                                domain: 'classical' },
    { name: 'James George Frazer',   work: 'The Golden Bough',                                              domain: 'classical' },
    { name: 'Franz Boas',            work: 'The Mind of Primitive Man',                                     domain: 'classical' },
    // ── Structural-Functional ──
    { name: 'Bronislaw Malinowski',  work: 'Argonauts of the Western Pacific / Magic Science and Religion', domain: 'functional' },
    { name: 'AR Radcliffe-Brown',    work: 'Structure and Function in Primitive Society',                   domain: 'functional' },
    { name: 'EE Evans-Pritchard',    work: 'Witchcraft Oracles and Magic Among the Azande / The Nuer',     domain: 'functional' },
    { name: 'Meyer Fortes',          work: 'The Web of Kinship Among the Tallensi',                         domain: 'functional' },
    // ── Structuralism ──
    { name: 'Claude Levi-Strauss',   work: 'Structural Anthropology / Myth and Meaning / The Raw and the Cooked', domain: 'structural' },
    // ── Interpretive / Symbolic ──
    { name: 'Clifford Geertz',       work: 'The Interpretation of Cultures',                                domain: 'interpretive' },
    { name: 'Victor Turner',         work: 'The Ritual Process / The Forest of Symbols',                    domain: 'interpretive' },
    { name: 'Mary Douglas',          work: 'Purity and Danger / Natural Symbols',                           domain: 'interpretive' },
    { name: 'Edmund Leach',          work: 'Political Systems of Highland Burma / Culture and Communication', domain: 'interpretive' },
    // ── Feminist / Critical ──
    { name: 'Margaret Mead',         work: 'Coming of Age in Samoa / Sex and Temperament',                  domain: 'feminist' },
    { name: 'Ruth Benedict',         work: 'Patterns of Culture',                                           domain: 'feminist' },
    { name: 'Sherry Ortner',         work: 'Making Gender / Is Female to Male as Nature is to Culture',     domain: 'feminist' },
    // ── Indian Anthropology ──
    { name: 'MN Srinivas',           work: 'The Remembered Village / Social Change in Modern India',        domain: 'indian' },
    { name: 'SC Dube',               work: 'Indian Village / India\'s Changing Villages',                   domain: 'indian' },
    { name: 'Andre Beteille',        work: 'Caste Class and Power',                                         domain: 'indian' },
    { name: 'LP Vidyarthi',          work: 'The Sacred Complex in Hindu Gaya',                              domain: 'indian' },
    { name: 'Irawati Karve',         work: 'Kinship Organization in India',                                 domain: 'indian' },
    { name: 'GS Ghurye',             work: 'Caste and Race in India / Indian Sadhus',                       domain: 'indian' },
    { name: 'Verrier Elwin',         work: 'The Baiga / The Muria and Their Ghotul',                        domain: 'indian' },
    { name: 'Surajit Sinha',         work: 'Tribe-Caste and Tribe-Peasant Continua',                       domain: 'indian' },
  ],

  rag: null,

  rubricWeights: {
    introduction: 15,
    body: 60,
    conclusion: 15,
    presentation: 10,
  },

  systemPromptTemplate: `You are a UPSC Anthropology Optional evaluator with deep knowledge of anthropological theory, ethnography, physical anthropology, and Indian tribal society. Read the answer as it actually is.

{{RAG_CONTEXT}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPISTEMIC INTEGRITY PROTOCOL — HIGHEST PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are writing for UPSC Anthropology Optional aspirants. Fabricated fieldwork data, misattributed ethnographic findings, or invented theoretical positions can cost them a rank. This is someone's career.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLAIM CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIER 1 — CERTAIN:
- Core theories: Malinowski's functionalism/reciprocity, Radcliffe-Brown's structural functionalism, Levi-Strauss's structuralism/binary oppositions, Geertz's interpretive anthropology/thick description
- Established Indian anthropology: Srinivas's village studies, GS Ghurye's caste framework, Verrier Elwin's tribal work

TIER 2 — PROBABLE (hedge lightly):
- Specific ethnographic details from fieldwork studies
- Population genetics claims and fossil site attributions

TIER 3 — DO NOT WRITE:
- Exact field measurements, skeleton counts, specific radiocarbon dates you are not certain of
- Arguments attributed to thinkers outside their known fieldwork region

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THINKER CITATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{THINKER_ROSTER}}

STRICT PROHIBITIONS:
- NEVER attribute fieldwork findings from one anthropologist to another
- NEVER invent a tribal group, ethnographic detail, or fossil site
- NEVER cite a thinker on a region they never studied

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION RUBRIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRONG body point: named anthropologist + their specific theory/fieldwork finding + applied to the question
WEAK body point: anthropologist named, argument vague or generic
NONE: no named anthropologist — purely descriptive

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
