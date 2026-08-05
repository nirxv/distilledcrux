// ─────────────────────────────────────────────────────────────────────────────
// lib/subjects/pub-admin.ts
// Public Administration Optional — subject config
// RAG: null until books uploaded
// ─────────────────────────────────────────────────────────────────────────────

import { SubjectConfig } from './index'

export const pubAdminConfig: SubjectConfig = {
  id: 'pub-admin',
  label: 'Public Administration Optional',
  thinkerTerm: 'theorist/commission',

  thinkerRoster: [
    // ── Classical / Foundational ──
    { name: 'Woodrow Wilson',       work: 'The Study of Administration (1887)',                         domain: 'classical' },
    { name: 'Frank Goodnow',        work: 'Politics and Administration',                                domain: 'classical' },
    { name: 'Frederick Winslow Taylor', work: 'Principles of Scientific Management',                   domain: 'classical' },
    { name: 'Henri Fayol',          work: 'General and Industrial Management',                         domain: 'classical' },
    { name: 'Luther Gulick',        work: 'Papers on the Science of Administration (POSDCORB)',         domain: 'classical' },
    { name: 'Lyndall Urwick',       work: 'Papers on the Science of Administration',                   domain: 'classical' },
    { name: 'Max Weber',            work: 'Economy and Society (bureaucracy chapter)',                  domain: 'classical' },
    { name: 'Leonard White',        work: 'Introduction to the Study of Public Administration',        domain: 'classical' },
    // ── Behavioural / Human Relations ──
    { name: 'Elton Mayo',           work: 'The Human Problems of an Industrial Civilization',          domain: 'behavioural' },
    { name: 'Herbert Simon',        work: 'Administrative Behaviour / Models of Man',                  domain: 'behavioural' },
    { name: 'Chester Barnard',      work: 'The Functions of the Executive',                            domain: 'behavioural' },
    { name: 'Abraham Maslow',       work: 'Motivation and Personality (hierarchy of needs)',           domain: 'behavioural' },
    { name: 'Douglas McGregor',     work: 'The Human Side of Enterprise (Theory X and Y)',             domain: 'behavioural' },
    { name: 'Chris Argyris',        work: 'Personality and Organization',                              domain: 'behavioural' },
    { name: 'Rensis Likert',        work: 'New Patterns of Management',                                domain: 'behavioural' },
    // ── New Public Administration / Post-Behavioural ──
    { name: 'Dwight Waldo',         work: 'The Administrative State',                                  domain: 'NPA' },
    { name: 'Frank Marini',         work: 'Toward a New Public Administration (Minnowbrook)',          domain: 'NPA' },
    { name: 'HD Lasswell',          work: 'Politics: Who Gets What When How',                          domain: 'NPA' },
    // ── NPM / Governance ──
    { name: 'Christopher Hood',     work: 'A Public Management for All Seasons (NPM article)',         domain: 'NPM' },
    { name: 'Osborne and Gaebler',  work: 'Reinventing Government',                                    domain: 'NPM' },
    { name: 'Jan Kooiman',          work: 'Modern Governance',                                         domain: 'NPM' },
    { name: 'B Guy Peters',         work: 'The Future of Governing',                                   domain: 'NPM' },
    // ── Development Administration ──
    { name: 'Fred Riggs',           work: 'Administration in Developing Countries / Prismatic Society', domain: 'development' },
    { name: 'Edward Weidner',       work: 'Development Administration concept',                        domain: 'development' },
    { name: 'Ferrel Heady',         work: 'Public Administration: A Comparative Perspective',          domain: 'development' },
    // ── Indian Administration ──
    { name: 'Paul Appleby',         work: 'Public Administration in India: Report of a Survey',        domain: 'indian' },
    { name: 'AH Hanson',            work: 'Public Enterprise and Economic Development',                domain: 'indian' },
    { name: 'VN Gadgil',            work: 'Indian Administrative System',                              domain: 'indian' },
    { name: 'Rajni Kothari',        work: 'State Against Democracy',                                   domain: 'indian' },
    { name: 'Second ARC',           work: 'Reports of the Second Administrative Reforms Commission',   domain: 'indian' },
    { name: 'Sarkaria Commission',  work: 'Report on Centre-State Relations',                          domain: 'indian' },
    { name: 'Punchhi Commission',   work: 'Report on Centre-State Relations (2010)',                   domain: 'indian' },
  ],

  rag: null,

  rubricWeights: {
    introduction: 15,
    body: 60,
    conclusion: 15,
    presentation: 10,
  },

  systemPromptTemplate: `You are a UPSC Public Administration Optional evaluator with deep knowledge of administrative theory, Indian administration, comparative public administration, and governance. Read the answer as it actually is.

{{RAG_CONTEXT}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPISTEMIC INTEGRITY PROTOCOL — HIGHEST PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are writing for UPSC Public Administration aspirants. Incorrect committee names, wrong commission recommendations, or misattributed administrative theories directly harm aspirants who memorise your feedback. This is someone's career.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLAIM CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIER 1 — CERTAIN:
- Core theories: Weber's bureaucracy (hierarchy/rules/impersonality), Simon's bounded rationality/satisficing, Taylor's scientific management, Fayol's 14 principles, Gulick's POSDCORB
- NPM: Hood's 7 doctrines, Osborne-Gaebler's steering vs rowing
- Fred Riggs: prismatic society, sala model, fused-prismatic-diffracted continuum
- Indian admin: Paul Appleby's two reports, Sarkaria Commission on centre-state, Second ARC recommendations

TIER 2 — PROBABLE (hedge lightly):
- Specific article numbers of the Constitution relating to administration
- Exact year of committee/commission reports
- Recent policy schemes and their precise targets

TIER 3 — DO NOT WRITE:
- Invented committee names or non-existent commissions
- Exact quotes from reports you cannot verify
- Provisions attributed to the wrong ARC report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THINKER CITATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{THINKER_ROSTER}}

STRICT PROHIBITIONS:
- NEVER attribute POSDCORB to Fayol — it is Gulick's
- NEVER confuse First ARC (1966) with Second ARC (2005-2009) recommendations
- NEVER invent a commission or committee that does not exist
- NEVER attribute Simon's bounded rationality to Chester Barnard or vice versa

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION RUBRIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRONG body point: named theorist/commission + specific concept/recommendation + applied to the question
WEAK body point: name dropped, concept vague or just stated without application
NONE: purely descriptive, no theory, no named scholar, no commission

Public administration answers must link THEORY to INDIAN PRACTICE wherever possible.

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
