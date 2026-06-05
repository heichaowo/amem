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
export async function llmCall(prompt: string, maxTokens = 500): Promise<string | null> {
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

/**
 * Valid category values (Story 13-E).
 * "General" is the fallback for anything that doesn't fit a specific bucket.
 */
export type NoteCategory =
  | 'Technical'
  | 'Business'
  | 'Personal'
  | 'Project'
  | 'Research'
  | 'System'
  | 'General'

export interface NoteStructure {
  keywords: string[]
  tags: string[]
  context: string
  /** Story 13-E: coarse-grained category */
  category: NoteCategory
}

const VALID_CATEGORIES = new Set<string>([
  'Technical', 'Business', 'Personal', 'Project', 'Research', 'System', 'General',
])

export async function llmConstructNote(content: string): Promise<NoteStructure> {
  const prompt = `Analyze the following text and respond with JSON only (no markdown, no explanation):
{
  "keywords": ["keyword1", "keyword2", ...],  // 3-7 key terms
  "tags": ["tag1", "tag2", ...],              // 2-4 category tags
  "context": "one sentence summary",
  "category": "Technical|Business|Personal|Project|Research|System|General"
}

Category guide:
- Technical: code, tools, configuration, APIs, debugging
- Business: company, finance, compliance, contracts, invoices
- Personal: personal state, habits, preferences, emotions
- Project: project progress, decisions, milestones
- Research: research, literature, evaluation, comparison
- System: system services, monitoring, operations
- General: anything that does not fit the above

Text: ${content}`

  const raw = await llmCall(prompt, 350)
  if (!raw) return { keywords: [], tags: [], context: '', category: 'General' }

  try {
    const data = JSON.parse(stripFences(raw))
    const rawCategory = typeof data.category === 'string' ? data.category : 'General'
    const category: NoteCategory = VALID_CATEGORIES.has(rawCategory)
      ? (rawCategory as NoteCategory)
      : 'General'
    return {
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      context: typeof data.context === 'string' ? data.context : '',
      category,
    }
  } catch (e) {
    console.error(`[amem] Note construction parse failed: ${(e as Error).message}`)
    return { keywords: [], tags: [], context: '', category: 'General' }
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
  existingIdx?: number   // UPDATE/DELETE 时，对应 existingMemories 的整数下标（防幻觉）
  reason?: string
}

export async function llmCrudDecision(
  userText: string,
  assistantText: string,
  existingMemories: Array<{ idx: number; content: string }>
): Promise<MemoryOperation[]> {
  const memoryList = existingMemories.length > 0
    ? existingMemories.map(m => `[${m.idx}] ${m.content}`).join('\n')
    : '（无已有相关记忆）'

  const prompt = `你是一个记忆管理 agent，负责分析对话内容并决定如何操作记忆库。

## 对话内容

用户：${userText.slice(0, 500)}
助手：${assistantText.slice(0, 500)}

## 已有相关记忆（用整数 idx 标识）

${memoryList}

## 任务

分析上述对话，决定需要哪些记忆操作。只提取真正重要的长期事实（决策、偏好、账号信息、项目状态、关键洞察）。跳过闲聊、确认语、重复信息。

## 操作类型
- NEW：提取全新事实（已有记忆中没有的信息）
- UPDATE：新信息更新了某条已有记忆，用 existingIdx 指定要更新的条目
- DELETE：某条已有记忆已经过时、发生冲突或错误，用 existingIdx 指定，fact 填原内容
- NONE：不值得记录或已有完全相同的信息

## 输出格式

返回 JSON 数组，每条格式：
{"action": "NEW"|"UPDATE"|"DELETE"|"NONE", "fact": "事实内容", "existingIdx": 整数或省略, "reason": "原因（可选）"}

每次最多返回 3 条操作。如果没有值得操作的内容，返回 []。

只返回 JSON 数组，不要任何其他文字。示例：
[{"action": "NEW", "fact": "Alex决定使用 React 作为前端框架", "reason": "明确的技术选型决策"}]`

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
  contentB: string,
): Promise<{ shouldMerge: boolean; merged?: string }> {
  const prompt = `你是一个记忆去重助手，负责判断两条记忆是否表达了本质相同的信息。

记忆A：${contentA}
记忆B：${contentB}

请判断：
- 如果两条记忆表达的是本质相同的信息（可能措辞不同、粒度不同，但核心事实一致），返回 JSON：
  {"shouldMerge": true, "merged": "合并后的简洁表述，保留两条记忆的关键信息，比任何一条都更完整"}
- 如果两条记忆是互补信息、不同主题、或包含不同的具体事实，返回 JSON：
  {"shouldMerge": false}

只返回 JSON，不要任何其他文字。`

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
export interface EvolvedNote {
  tags: string[] | null
  context: string | null
  shouldStrengthen: boolean
  suggestedConnections: string[]
  tagsToUpdate: string[]
}

export async function llmEvolveNote(
  content: string,
  linkedNotes: Array<{ id: string; content: string }>,
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
