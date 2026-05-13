/**
 * llm.ts — LLM helpers for A-MEM note construction, linking, evolution
 * Uses @anthropic-ai/sdk via LLM proxy (http://127.0.0.1:8080)
 */

import Anthropic from '@anthropic-ai/sdk'

// ── Client (LLM proxy) ────────────────────────────────────────────────────────
const client = new Anthropic({
  apiKey: 'YOUR_API_KEY',
  baseURL: 'http://127.0.0.1:8080',
})

const MODEL = 'claude-sonnet-4-6'  // faster than opus for amem ops

// ── Base LLM call ─────────────────────────────────────────────────────────────
async function llmCall(prompt: string, maxTokens = 500): Promise<string | null> {
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
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
  return raw
}

// ── Note construction ─────────────────────────────────────────────────────────
export interface NoteStructure {
  keywords: string[]
  tags: string[]
  context: string
}

export async function llmConstructNote(content: string): Promise<NoteStructure> {
  const prompt = `Analyze the following text and respond with JSON only (no markdown, no explanation):
{
  "keywords": ["keyword1", "keyword2", ...],  // 3-7 key terms
  "tags": ["tag1", "tag2", ...],              // 2-4 category tags
  "context": "one sentence summary"
}

Text: ${content}`

  const raw = await llmCall(prompt, 300)
  if (!raw) return { keywords: [], tags: [], context: '' }

  try {
    const data = JSON.parse(stripFences(raw))
    return {
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      context: typeof data.context === 'string' ? data.context : '',
    }
  } catch (e) {
    console.error(`[amem] Note construction parse failed: ${(e as Error).message}`)
    return { keywords: [], tags: [], context: '' }
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

// ── Note evolution ────────────────────────────────────────────────────────────
export interface EvolvedNote {
  tags: string[] | null
  context: string | null
}

export async function llmEvolveNote(content: string, linkedContents: string[]): Promise<EvolvedNote> {
  const linkedStr = linkedContents.map((c) => `- ${c}`).join('\n')
  const prompt = `A memory note has gained new connections. Update its context and tags.
Reply with JSON only (no markdown):
{
  "tags": ["tag1", "tag2", ...],
  "context": "updated one sentence summary"
}

Original note: ${content}
Newly linked notes:
${linkedStr}`

  const raw = await llmCall(prompt, 200)
  if (!raw) return { tags: null, context: null }

  try {
    const data = JSON.parse(stripFences(raw))
    return {
      tags: Array.isArray(data.tags) ? data.tags : null,
      context: typeof data.context === 'string' ? data.context : null,
    }
  } catch (e) {
    console.error(`[amem] Evolution parse failed: ${(e as Error).message}`)
    return { tags: null, context: null }
  }
}
