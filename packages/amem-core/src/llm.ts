/**
 * llm.ts — LLM helpers for A-MEM note construction, linking, evolution
 */

import Anthropic from '@anthropic-ai/sdk'
import { t } from './prompts.js'

// ── Client ────────────────────────────────────────────────────────────────────
const client = new Anthropic({
  ...(process.env.AMEM_LLM_API_KEY && { apiKey: process.env.AMEM_LLM_API_KEY }),
  ...(process.env.AMEM_LLM_BASE_URL && { baseURL: process.env.AMEM_LLM_BASE_URL }),
})

const MODEL = process.env.AMEM_LLM_MODEL ?? 'claude-sonnet-4-6' // override via env for smoketest/benchmark

// ── Base LLM call ─────────────────────────────────────────────────────────────
export async function llmCall(prompt: string, maxTokens = 500): Promise<string | null> {
  try {
    // Gemini thinking models consume extra tokens for reasoning; scale up automatically
    const isThinking = MODEL.includes('gemini') || MODEL.includes('pro-agent')
    const effectiveMaxTokens = isThinking ? Math.max(maxTokens * 8, 4000) : maxTokens
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: effectiveMaxTokens,
      messages: [{ role: 'user', content: prompt }],
    })
    for (const block of resp.content) {
      if (block.type === 'text') return block.text.trim()
    }
    return null
  } catch (e) {
    console.error(`[amem] LLM call failed: ${(e as Error).message}`)
    return null
  }
}

// ── Strip markdown fences ─────────────────────────────────────────────────────
function stripFences(raw: string): string {
  raw = raw.trim()
  if (raw.startsWith('```')) {
    const lines = raw.split('\n')
    lines.shift()
    if (lines[lines.length - 1] === '```') lines.pop()
    raw = lines.join('\n').trim()
  }
  // Handle models that wrap JSON in outer quotes: "{ ... }" or "[...]"
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    try {
      raw = JSON.parse(raw)
    } catch {
      /* keep as-is */
    }
  }
  return raw
}

// ── Note construction ─────────────────────────────────────────────────────────

/**
 * Valid category values (Story 13-E).
 * "General" is the fallback for anything that doesn't fit a specific bucket.
 */
export type NoteCategory = 'Technical' | 'Business' | 'Personal' | 'Project' | 'Research' | 'System' | 'General'

export interface NoteStructure {
  keywords: string[]
  tags: string[]
  context: string
  /** Story 13-E: coarse-grained category */
  category: NoteCategory
  /** Story 26A: episodic memory vs durable knowledge */
  note_type: 'memory' | 'knowledge'
  /** Story 26B: topic tags, non-empty only for knowledge notes */
  topics: string[]
  /** Story 27: LLM self-reported confidence in note_type classification */
  confidence: 'high' | 'medium' | 'low'
}

const VALID_CONFIDENCE = new Set<string>(['high', 'medium', 'low'])

const VALID_CATEGORIES = new Set<string>([
  'Technical',
  'Business',
  'Personal',
  'Project',
  'Research',
  'System',
  'General',
])

export async function llmConstructNote(content: string): Promise<NoteStructure> {
  const prompt = `Analyze the following text and respond with valid JSON only (no markdown fences, no explanation, no comments). All string values must use standard double quotes and be properly escaped:
{
  "keywords": ["keyword1", "keyword2"],
  "tags": ["tag1", "tag2"],
  "context": "one sentence summary in the same language as the input",
  "category": "Technical|Business|Personal|Project|Research|System|General",
  "note_type": "memory|knowledge",
  "topics": ["Topic1", "Topic2"],
  "confidence": "high|medium|low"
}

Category guide:
- Technical: code, tools, configuration, APIs, debugging
- Business: company, finance, compliance, contracts, invoices
- Personal: personal state, habits, preferences, emotions
- Project: project progress, decisions, milestones
- Research: research, literature, evaluation, comparison
- System: system services, monitoring, operations
- General: anything that does not fit the above

note_type guide:
- knowledge: books, methodologies, tools, domain knowledge, reference material — durable, no strong time component
- memory: events, decisions, preferences, states, observations — episodic, time-sensitive

topics guide (Story 26B):
- Only populate for knowledge notes (note_type=knowledge). For memory notes, return [].
- List 1-5 concise subject tags representing the main topics of this knowledge, e.g. ["TypeScript", "Qdrant", "Vector DB"].

confidence guide (Story 27):
- high: note_type is unambiguous — clearly episodic (event/decision/state) or clearly durable knowledge (tool doc/methodology)
- medium: some ambiguity — e.g. "learned X method" could be either memory or knowledge
- low: LLM is uncertain — vague, fragmentary, or mixed content

Text: ${content}`

  const raw = await llmCall(prompt, 400)
  if (!raw)
    return {
      keywords: [],
      tags: [],
      context: '',
      category: 'General',
      note_type: 'memory',
      topics: [],
      confidence: 'medium',
    }

  try {
    const data = JSON.parse(stripFences(raw))
    const rawCategory = typeof data.category === 'string' ? data.category : 'General'
    const category: NoteCategory = VALID_CATEGORIES.has(rawCategory) ? (rawCategory as NoteCategory) : 'General'
    const note_type: 'memory' | 'knowledge' = data.note_type === 'knowledge' ? 'knowledge' : 'memory'
    const topics: string[] =
      note_type === 'knowledge' && Array.isArray(data.topics)
        ? (data.topics as unknown[]).filter((v): v is string => typeof v === 'string')
        : []
    const rawConfidence = typeof data.confidence === 'string' ? data.confidence : 'medium'
    const confidence: 'high' | 'medium' | 'low' = VALID_CONFIDENCE.has(rawConfidence)
      ? (rawConfidence as 'high' | 'medium' | 'low')
      : 'medium'
    return {
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      context: typeof data.context === 'string' ? data.context : '',
      category,
      note_type,
      topics,
      confidence,
    }
  } catch (e) {
    console.error(`[amem] Note construction parse failed: ${(e as Error).message}`)
    return {
      keywords: [],
      tags: [],
      context: '',
      category: 'General',
      note_type: 'memory',
      topics: [],
      confidence: 'medium',
    }
  }
}

// ── Link judgment ─────────────────────────────────────────────────────────────
export async function llmShouldLink(noteContent: string, candidateContent: string): Promise<boolean> {
  const prompt = `Do these two memory notes have a meaningful relationship that would be useful to link?
Reply with only "yes" or "no".

Note A: ${noteContent}
Note B: ${candidateContent}`

  const raw = await llmCall(prompt, 10)
  if (!raw) return false
  return raw.toLowerCase().startsWith('yes')
}

// ── CRUD Decision ────────────────────────────────────────────────────────────
export interface MemoryOperation {
  action: 'NEW' | 'UPDATE' | 'DELETE' | 'NONE'
  fact: string
  existingIdx?: number // For UPDATE/DELETE: integer index into existingMemories (guards against hallucination)
  reason?: string
}

export async function llmCrudDecision(
  userText: string,
  assistantText: string,
  existingMemories: Array<{ idx: number; content: string }>
): Promise<MemoryOperation[]> {
  const memoryList =
    existingMemories.length > 0 ? existingMemories.map((m) => `[${m.idx}] ${m.content}`).join('\n') : '(none)'

  const prompt = t.crudDecision(userText.slice(0, 500), assistantText.slice(0, 500), memoryList)

  try {
    const raw = await llmCall(prompt, 400)
    if (!raw) return []
    const match = raw.match(/\[.*\]/s)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    const ops: MemoryOperation[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const action = item.action
      if (!['NEW', 'UPDATE', 'DELETE', 'NONE'].includes(action)) continue
      if (action === 'NONE') continue
      const op: MemoryOperation = {
        action,
        fact: typeof item.fact === 'string' ? item.fact : '',
        reason: typeof item.reason === 'string' ? item.reason : undefined,
      }
      if (typeof item.existingIdx === 'number') {
        op.existingIdx = item.existingIdx
      }
      ops.push(op)
    }
    return ops.slice(0, 3)
  } catch (e) {
    console.error(`[amem] llmCrudDecision failed: ${(e as Error).message}`)
    return []
  }
}

// ── Merge judgment ───────────────────────────────────────────────────────────
export async function llmShouldMerge(
  contentA: string,
  contentB: string
): Promise<{ shouldMerge: boolean; merged?: string }> {
  const prompt = t.shouldMerge(contentA, contentB)

  const raw = await llmCall(prompt, 300)
  if (!raw) return { shouldMerge: false }

  try {
    const data = JSON.parse(stripFences(raw))
    if (typeof data.shouldMerge !== 'boolean') return { shouldMerge: false }
    if (data.shouldMerge && typeof data.merged === 'string') {
      return { shouldMerge: true, merged: data.merged }
    }
    return { shouldMerge: false }
  } catch (e) {
    console.error(`[amem] llmShouldMerge parse failed: ${(e as Error).message}`)
    return { shouldMerge: false }
  }
}

// ── Note evolution ────────────────────────────────────────────────────────────

// ── Story 30: Evolution type judgment ────────────────────────────────────────
export type EvolutionType = 'EVOLVE' | 'CONFLICT' | 'EXPAND' | 'NEW'

const VALID_EVOLUTION_TYPES = new Set<string>(['EVOLVE', 'CONFLICT', 'EXPAND', 'NEW'])

export async function llmEvolutionJudge(
  oldContent: string,
  newContent: string
): Promise<{ type: EvolutionType; mergedContent?: string }> {
  const prompt = t.evolutionJudge(oldContent, newContent)

  const raw = await llmCall(prompt, 300)
  if (!raw) return { type: 'NEW' }

  try {
    const data = JSON.parse(stripFences(raw))
    const type: EvolutionType = VALID_EVOLUTION_TYPES.has(data.type) ? (data.type as EvolutionType) : 'NEW'
    return {
      type,
      mergedContent: typeof data.mergedContent === 'string' ? data.mergedContent : undefined,
    }
  } catch (e) {
    console.error(`[amem] llmEvolutionJudge parse failed: ${(e as Error).message}`)
    return { type: 'NEW' }
  }
}

// ── Note evolution (legacy) ──────────────────────────────────────────────────
export interface EvolvedNote {
  tags: string[] | null
  context: string | null
  shouldStrengthen: boolean
  suggestedConnections: string[]
  tagsToUpdate: string[]
}

export async function llmEvolveNote(
  content: string,
  linkedNotes: Array<{ id: string; content: string }>
): Promise<EvolvedNote> {
  const linkedStr = linkedNotes.map((n) => `- ID: ${n.id}\n  Content: ${n.content}`).join('\n')
  const prompt = `A memory note has gained new connections. Update its context, tags, and decide whether to strengthen connections with specific neighbors.
Reply with JSON only (no markdown):
{
  "tags": ["tag1", "tag2", ...],
  "context": "updated one sentence summary",
  "should_strengthen": true|false,
  "suggested_connections": ["neighbor_id_1", "neighbor_id_2", ...],
  "tags_to_update": ["tag_1", ..., "tag_n"]
}

Guidelines:
- "tags" and "context" are for updating the original note based on new connections.
- "should_strengthen" is a decision whether this note should strengthen its connections to any of the newly linked notes (neighbors).
- "suggested_connections" must contain only IDs from the newly linked notes (neighbors) listed below.
- "tags_to_update" are updated tags for the original note itself if we strengthen connections.

Original note content: ${content}

Newly linked notes (neighbors):
${linkedStr}`

  const raw = await llmCall(prompt, 500)
  if (!raw) return { tags: null, context: null, shouldStrengthen: false, suggestedConnections: [], tagsToUpdate: [] }

  try {
    const data = JSON.parse(stripFences(raw))
    return {
      tags: Array.isArray(data.tags) ? data.tags : null,
      context: typeof data.context === 'string' ? data.context : null,
      shouldStrengthen: typeof data.should_strengthen === 'boolean' ? data.should_strengthen : false,
      suggestedConnections: Array.isArray(data.suggested_connections) ? data.suggested_connections.map(String) : [],
      tagsToUpdate: Array.isArray(data.tags_to_update) ? data.tags_to_update.map(String) : [],
    }
  } catch (e) {
    console.error(`[amem] Evolution parse failed: ${(e as Error).message}`)
    return { tags: null, context: null, shouldStrengthen: false, suggestedConnections: [], tagsToUpdate: [] }
  }
}
