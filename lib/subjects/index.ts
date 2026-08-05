// ─────────────────────────────────────────────────────────────────────────────
// lib/subjects/index.ts
// Subject registry — single source of truth for all optional subjects.
// Adding RAG later: set rag.enabled = true + namespace. Nothing else changes.
// ─────────────────────────────────────────────────────────────────────────────

export interface Thinker {
  name: string
  work?: string        // Primary known work (for citation prompts)
  domain: string       // e.g. 'ancient' | 'medieval' | 'modern' | 'classical' | 'indian'
}

export interface RagConfig {
  enabled: boolean
  namespace: string    // Supabase pgvector namespace key
  topK: number         // Chunks to retrieve
  scoreThreshold: number
}

export interface SubjectConfig {
  id: string
  label: string        // Full display name e.g. "History Optional"

  // Term used in CoT rubric bands for "named expert" — e.g. "historian", "thinker", "anthropologist"
  // Used in STRONG/WEAK/NONE band descriptions in the evaluate route.
  thinkerTerm: string

  // Prompt template — use {{THINKER_ROSTER}} and {{RAG_CONTEXT}} as placeholders.
  // assemblePrompt() injects them at runtime.
  systemPromptTemplate: string

  thinkerRoster: Thinker[]

  // null = RAG not yet set up for this subject.
  // Flip to RagConfig when books are uploaded to Supabase.
  rag: RagConfig | null

  // Section weights — used to compute max marks per section in the CoT prompt.
  // Values are *percentages* of total marks (must sum to 100).
  rubricWeights: {
    introduction: number
    body: number
    conclusion: number
    presentation: number
  }
}

// ── Registry ─────────────────────────────────────────────────────────────────

import { historyConfig }      from './history'
import { sociologyConfig }    from './sociology'
import { anthropologyConfig } from './anthropology'
import { polsciConfig }       from './polsci'
import { geographyConfig }    from './geography'
import { pubAdminConfig }     from './pub-admin'

export const SUBJECT_REGISTRY: Record<string, SubjectConfig> = {
  'history':      historyConfig,
  'sociology':    sociologyConfig,
  'anthropology': anthropologyConfig,
  'polsci':       polsciConfig,
  'geography':    geographyConfig,
  'pub-admin':    pubAdminConfig,
}

export function getSubjectConfig(id: string): SubjectConfig {
  return SUBJECT_REGISTRY[id] ?? SUBJECT_REGISTRY['history']
}

// ── Prompt assembly ───────────────────────────────────────────────────────────
// Called by the evaluate route at runtime. Injects thinker roster + RAG chunks.

export function buildRosterString(thinkers: Thinker[]): string {
  // Group by domain
  const byDomain: Record<string, Thinker[]> = {}
  for (const t of thinkers) {
    if (!byDomain[t.domain]) byDomain[t.domain] = []
    byDomain[t.domain].push(t)
  }
  return Object.entries(byDomain)
    .map(([domain, ts]) => {
      const header = `── ${domain.toUpperCase()} ──`
      const lines = ts.map(t => `- ${t.name}${t.work ? ` → ${t.work}` : ''}`)
      return [header, ...lines].join('\n')
    })
    .join('\n\n')
}

export function assemblePrompt(
  template: string,
  rosterStr: string,
  ragContext: string,
  subjectLabel: string,
  lang: string,
): string {
  const ragBlock = ragContext
    ? `\n\nRELEVANT SOURCE MATERIAL (from ${subjectLabel} books in the system):\n${ragContext}\n\nUse the above passages to verify claims and enrich the model answer where directly relevant. Do not fabricate passages not present above.`
    : ''

  const hiSuffix = lang === 'hi'
    ? '\n\nIMPORTANT: Write your ENTIRE response in Hindi (Devanagari script). All feedback, analysis, model answer — everything in Hindi.'
    : ''

  return template
    .replace('{{THINKER_ROSTER}}', rosterStr)
    .replace('{{RAG_CONTEXT}}', ragBlock)
    + hiSuffix
}
