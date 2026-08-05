// ─────────────────────────────────────────────────────────────────────────────
// lib/subjects/geography.ts
// Geography Optional — subject config
// RAG: null until books uploaded
// ─────────────────────────────────────────────────────────────────────────────

import { SubjectConfig } from './index'

export const geographyConfig: SubjectConfig = {
  id: 'geography',
  label: 'Geography Optional',
  thinkerTerm: 'geographer',

  thinkerRoster: [
    // ── Physical Geography ──
    { name: 'Arthur Holmes',        work: 'Principles of Physical Geology',                              domain: 'physical' },
    { name: 'WM Davis',             work: 'Geographical Essays (cycle of erosion)',                      domain: 'physical' },
    { name: 'LP Kessen',            work: 'Climate and vegetation zone frameworks',                      domain: 'physical' },
    { name: 'Alfred Wegener',       work: 'The Origin of Continents and Oceans',                        domain: 'physical' },
    { name: 'Harry Hess',           work: 'Sea Floor Spreading hypothesis',                              domain: 'physical' },
    // ── Human Geography — Founders ──
    { name: 'Carl Sauer',           work: 'The Morphology of Landscape',                                domain: 'human' },
    { name: 'Richard Hartshorne',   work: 'The Nature of Geography / Perspectives on the Nature of Geography', domain: 'human' },
    { name: 'Paul Vidal de la Blache', work: 'Principles of Human Geography',                           domain: 'human' },
    { name: 'Friedrich Ratzel',     work: 'Anthropogeography',                                          domain: 'human' },
    { name: 'Ellen Churchill Semple', work: 'Influences of Geographic Environment',                     domain: 'human' },
    // ── Modern / Quantitative ──
    { name: 'Walter Christaller',   work: 'Central Places in Southern Germany',                         domain: 'economic' },
    { name: 'August Losch',         work: 'The Economics of Location',                                  domain: 'economic' },
    { name: 'Johann Heinrich von Thunen', work: 'The Isolated State',                                   domain: 'economic' },
    { name: 'Alfred Weber',         work: 'Theory of the Location of Industries',                       domain: 'economic' },
    { name: 'Ernest Burgess',       work: 'Concentric Zone Model',                                      domain: 'urban' },
    { name: 'Homer Hoyt',           work: 'Sector Model of urban land use',                             domain: 'urban' },
    { name: 'Chauncy Harris',       work: 'Multiple Nuclei Model',                                      domain: 'urban' },
    // ── Critical / Radical Geography ──
    { name: 'David Harvey',         work: 'Social Justice and the City / The Condition of Postmodernity', domain: 'critical' },
    { name: 'Doreen Massey',        work: 'Space Place and Gender / For Space',                         domain: 'critical' },
    { name: 'Yi-Fu Tuan',           work: 'Topophilia / Space and Place',                               domain: 'critical' },
    // ── Development & Population ──
    { name: 'Amartya Sen',          work: 'Development as Freedom / Poverty and Famines',               domain: 'development' },
    { name: 'Thomas Malthus',       work: 'An Essay on the Principle of Population',                    domain: 'population' },
    { name: 'Ester Boserup',        work: 'The Conditions of Agricultural Growth',                      domain: 'population' },
    { name: 'WW Rostow',            work: 'The Stages of Economic Growth',                              domain: 'development' },
    { name: 'Gunnar Myrdal',        work: 'Asian Drama / Economic Theory and Under-Developed Regions',  domain: 'development' },
    // ── Indian Geography ──
    { name: 'RD Dikshit',           work: 'Political Geography of India',                               domain: 'indian' },
    { name: 'RB Singh',             work: 'Environmental Geography',                                    domain: 'indian' },
    { name: 'LP Singh',             work: 'Indian Geography (drainage, climate sections)',               domain: 'indian' },
  ],

  rag: null,

  rubricWeights: {
    introduction: 15,
    body: 60,
    conclusion: 15,
    presentation: 10,
  },

  systemPromptTemplate: `You are a UPSC Geography Optional evaluator with deep knowledge of physical geography, human geography, economic geography, and Indian geography. Read the answer as it actually is.

{{RAG_CONTEXT}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPISTEMIC INTEGRITY PROTOCOL — HIGHEST PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are writing for UPSC Geography Optional aspirants. Fabricated statistics, wrong river data, or misattributed geographical models can cost them a rank. This is someone's career.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLAIM CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIER 1 — CERTAIN:
- Core physical processes: plate tectonics, Davis cycle of erosion, Koppen climate classification, ocean current systems
- Established models: Christaller's central place theory, Von Thunen's land use rings, Burgess concentric zone model, Rostow's stages of growth
- Indian geography basics: major river systems, physiographic divisions, monsoon mechanism, soil types

TIER 2 — PROBABLE (hedge lightly):
- Specific numerical data: exact river lengths, precise rainfall figures, population density numbers — write "approximately" or "around"
- Recent census data — verify year and figure before citing

TIER 3 — DO NOT WRITE:
- Exact statistics you are not certain of — omit or hedge strongly
- Specific dam heights, reservoir capacities, industrial output figures
- Thinkers' model applied to a region they never studied

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THINKER / MODEL CITATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{THINKER_ROSTER}}

STRICT PROHIBITIONS:
- NEVER confuse Burgess (concentric zones) with Hoyt (sectors) with Harris-Ullman (multiple nuclei)
- NEVER attribute Malthus's pessimism to Boserup — they have opposite arguments
- NEVER invent census figures or environmental data
- Physical geography diagrams described in text must be accurate — do not describe a process incorrectly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION RUBRIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Geography answers must balance PHYSICAL, HUMAN, and INDIAN dimensions where the question demands all three.

STRONG body point: named geographer/model + applied correctly to the question + with specific geographic example
WEAK body point: model named but wrongly applied, or no geographic example
NONE: purely descriptive, no model, no theorist, no geographic analysis

Map-based answers: spatial accuracy and correct identification of regions counts as a strength.

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
