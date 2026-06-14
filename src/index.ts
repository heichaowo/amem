/**
 * amem-plugin v2 — A-MEM agentic memory backend for OpenClaw
 * TypeScript rewrite — Story 5: native TS implementation (no Python daemon)
 *
 * Depends on:
 *   - src/memory.ts  (addMemory, searchMemory, listMemories)
 *   - src/storage.ts (Qdrant)
 *   - src/embedding.ts (Transformers.js)
 *   - src/llm.ts (Anthropic via LLM proxy)
 */

import * as os from 'os'
import * as path from 'path'
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry'
import { addMemory, searchMemory, listMemories, mergeSimilarNotes, consolidateMemories } from './memory.js'
import { ensureCollection, createStorageContext, type AmemPluginConfig } from './storage.js'
import { encode } from './embedding.js'
import { createHash } from 'crypto'
import { generateReviewBatch } from './quality.js'

// ── Config ────────────────────────────────────────────────────────────────────
let _config: Record<string, unknown> = {}

// ── OpenClaw plugin registration ──────────────────────────────────────────────
function register(api: {
  logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void }
  pluginConfig?: Record<string, unknown>
  agentId?: string
  registerMemoryCapability?: (cap: unknown) => void
  registerTool?: (tool: unknown, opts?: unknown) => void
  registerService?: (svc: unknown) => void
}) {
  const logger = api.logger
  _config = (api.pluginConfig as Record<string, unknown>) || {}
  const pluginConfig = _config as AmemPluginConfig

  // ── Story 32: Per-agent config resolution ────────────────────────────────────
  // Priority: api.agentId (runtime) > pluginConfig.agentId (static) > 'main'
  let currentAgentId: string
  if (api.agentId) {
    currentAgentId = api.agentId
  } else if (pluginConfig.agentId) {
    logger.warn(
      `openclaw-amem: api.agentId not available, falling back to pluginConfig.agentId="${pluginConfig.agentId}"`
    )
    currentAgentId = pluginConfig.agentId
  } else {
    currentAgentId = 'main'
  }

  const agentCfg = pluginConfig.agents?.[currentAgentId] ?? {}
  const effectiveAgentId = agentCfg.agentId ?? currentAgentId
  const effectiveCollection = agentCfg.collection ?? pluginConfig.collection ?? undefined

  // Mode B: agent has its own collection
  const modeBIsolated = !!agentCfg.collection
  const storageCtx = createStorageContext(effectiveCollection, modeBIsolated)

  const agentId = effectiveAgentId
  const dbPath = path.join(os.homedir(), '.openclaw', 'amem_db')

  logger.info(
    `openclaw-amem: registered (native TS, Qdrant, agent_id=${agentId}, collection=${effectiveCollection ?? 'amem_notes (default)'}, mode=${modeBIsolated ? 'B-isolated' : 'A-shared'})`
  )

  // Pre-warm: ensure Qdrant collection exists
  ensureCollection(effectiveCollection).catch((e) =>
    logger.warn(`openclaw-amem: ensureCollection failed — ${e.message}`)
  )

  // ── registerMemoryCapability ─────────────────────────────────────────────
  if (typeof api.registerMemoryCapability === 'function') {
    api.registerMemoryCapability({
      publicArtifacts: {
        async listArtifacts(_p: unknown) {
          return { items: [] }
        },
        async getArtifact(_p: unknown) {
          return null
        },
      },
      runtime: {
        async getMemorySearchManager(_params: unknown) {
          try {
            return {
              manager: {
                status() {
                  return {
                    backend: 'amem-qdrant',
                    files: 0,
                    chunks: 0,
                    dirty: false,
                    workspaceDir: dbPath,
                  }
                },
                async search(query: string, opts: { limit?: number; topK?: number } = {}) {
                  try {
                    const topK = opts.limit || opts.topK || 5
                    const results = await searchMemory(query, topK, agentId, { storageCtx })
                    return results.map((r) => ({
                      id: r.id,
                      memory: r.content,
                      score: r.similarity,
                      context: r.context,
                      tags: r.tags.join(', '),
                    }))
                  } catch (err) {
                    logger.warn(`openclaw-amem: search failed — ${(err as Error).message}`)
                    return []
                  }
                },
                async add(text: string) {
                  try {
                    await addMemory(text, agentId, { storageCtx })
                    return { ok: true }
                  } catch (err) {
                    logger.warn(`openclaw-amem: add failed — ${(err as Error).message}`)
                    return { ok: false, error: (err as Error).message }
                  }
                },
                async probeEmbeddingAvailability() {
                  return { ok: true }
                },
                async close() {},
              },
            }
          } catch (err) {
            logger.warn(`openclaw-amem: getMemorySearchManager failed — ${(err as Error).message}`)
            return { manager: null, error: `amem backend unavailable: ${String(err)}` }
          }
        },
        resolveMemoryBackendConfig(_params: unknown) {
          return { backend: 'amem-qdrant', baseUrl: '', userId: agentId }
        },
        async closeAllMemorySearchManagers() {},
      },
    })
  } else {
    logger.warn('openclaw-amem: api.registerMemoryCapability not available')
  }

  // ── registerTool: memory_search ──────────────────────────────────────────
  if (typeof api.registerTool === 'function') {
    api.registerTool(
      {
        name: 'memory_search',
        label: 'Memory Search (A-MEM)',
        description: 'Search long-term memories stored in A-MEM / Qdrant.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Max results (default: 5)' },
            topicsFilter: {
              type: 'array',
              items: { type: 'string' },
              description: 'Story 26B: filter knowledge notes by topics (all must match)',
            },
          },
          required: ['query'],
        },
        async execute(_toolCallId: string, params: { query: string; limit?: number; topicsFilter?: string[] }) {
          const { query, limit = 5, topicsFilter } = params
          const start = Date.now()
          try {
            const results = await searchMemory(query, limit, agentId, { topicsFilter, storageCtx })
            logger.info(`openclaw-amem: memory_search "${query}" → ${results.length} results (${Date.now() - start}ms)`)
            if (!results.length) {
              return { content: [{ type: 'text', text: 'No relevant memories found.' }], details: { count: 0 } }
            }
            const text = results
              .map((r, i) => `${i + 1}. ${r.content} (score: ${(r.similarity * 100).toFixed(0)}%, id: ${r.id})`)
              .join('\n')
            return {
              content: [{ type: 'text', text: `Found ${results.length} memories:\n\n${text}` }],
              details: { count: results.length, memories: results },
            }
          } catch (err) {
            logger.warn(`openclaw-amem: memory_search error — ${(err as Error).message}`)
            return {
              content: [{ type: 'text', text: `Memory search failed: ${(err as Error).message}` }],
              details: { error: String(err) },
            }
          }
        },
      },
      { optional: false }
    )

    // ── registerTool: memory_add ─────────────────────────────────────────────
    api.registerTool(
      {
        name: 'memory_add',
        label: 'Memory Add (A-MEM)',
        description: 'Save important information into long-term A-MEM memory.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Fact or information to remember' },
          },
          required: ['text'],
        },
        async execute(_toolCallId: string, params: { text: string }) {
          const { text } = params
          const start = Date.now()
          try {
            const id = await addMemory(text, agentId, { storageCtx })
            logger.info(`openclaw-amem: memory_add OK id=${id} (${Date.now() - start}ms)`)
            return {
              content: [{ type: 'text', text: 'Memory saved successfully.' }],
              details: { ok: true, id },
            }
          } catch (err) {
            logger.warn(`openclaw-amem: memory_add error — ${(err as Error).message}`)
            return {
              content: [{ type: 'text', text: `Memory add failed: ${(err as Error).message}` }],
              details: { ok: false, error: String(err) },
            }
          }
        },
      },
      { optional: false }
    )

    // ── registerTool: memory_list ─────────────────────────────────────────────
    api.registerTool(
      {
        name: 'memory_list',
        label: 'Memory List (A-MEM)',
        description: 'Show total memory count in A-MEM.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        async execute(_toolCallId: string, _params: Record<string, never>) {
          try {
            const { count } = await listMemories(agentId, storageCtx)
            return {
              content: [{ type: 'text', text: `Total memories: ${count}` }],
              details: { count },
            }
          } catch (err) {
            return {
              content: [{ type: 'text', text: `Memory list failed: ${(err as Error).message}` }],
              details: { error: String(err) },
            }
          }
        },
      },
      { optional: true }
    )

    // ── registerTool: memory_consolidate ──────────────────────────────────────
    api.registerTool(
      {
        name: 'memory_consolidate',
        label: 'Memory Consolidate (A-MEM)',
        description: 'Trigger daily consolidation to merge semantic duplicates.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        async execute(_toolCallId: string, _params: Record<string, never>) {
          const start = Date.now()
          try {
            const merged = await consolidateMemories(agentId, logger, storageCtx)
            logger.info(`openclaw-amem: memory_consolidate OK merged=${merged} (${Date.now() - start}ms)`)
            return {
              content: [{ type: 'text', text: `Consolidation completed. Merged ${merged} memory pairs.` }],
              details: { ok: true, mergedCount: merged },
            }
          } catch (err) {
            logger.warn(`openclaw-amem: memory_consolidate failed — ${(err as Error).message}`)
            return {
              content: [{ type: 'text', text: `Consolidation failed: ${(err as Error).message}` }],
              details: { ok: false, error: String(err) },
            }
          }
        },
      },
      { optional: true }
    )

    // ── registerTool: memory_quality_scan ────────────────────────────────────
    api.registerTool(
      {
        name: 'memory_quality_scan',
        label: 'Memory Quality Scan (A-MEM)',
        description:
          'Scan all memories for quality issues (too short, expired ephemeral, conflicts) and generate a review batch file.',
        parameters: {
          type: 'object',
          properties: {
            outputPath: {
              type: 'string',
              description: 'Custom output path for the review batch file (optional, auto-generates if omitted)',
            },
          },
          required: [],
        },
        async execute(_toolCallId: string, params: { outputPath?: string }) {
          const start = Date.now()
          try {
            const filePath = await generateReviewBatch(agentId, params.outputPath)
            logger.info(`openclaw-amem: memory_quality_scan OK path=${filePath} (${Date.now() - start}ms)`)
            return {
              content: [{ type: 'text', text: `Quality scan complete. Review batch saved to: ${filePath}` }],
              details: { ok: true, path: filePath },
            }
          } catch (err) {
            logger.warn(`openclaw-amem: memory_quality_scan failed — ${(err as Error).message}`)
            return {
              content: [{ type: 'text', text: `Quality scan failed: ${(err as Error).message}` }],
              details: { ok: false, error: String(err) },
            }
          }
        },
      },
      { optional: true }
    )

    logger.info(
      'openclaw-amem: memory_search, memory_add, memory_list, memory_consolidate, memory_quality_scan tools registered'
    )
  } else {
    logger.warn('openclaw-amem: api.registerTool not available — tools not registered')
  }

  // ── agent_end hook: auto-capture memories after each turn ─────────────────
  if (typeof (api as any).registerHook === 'function' || typeof (api as any).on === 'function') {
    const hookFn = (typeof (api as any).on === 'function' ? (api as any).on : (api as any).registerHook).bind(api)
    hookFn(
      'agent_end',
      async (event: {
        messages?: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>
        success?: boolean
      }) => {
        logger.info(
          `openclaw-amem: agent_end hook triggered (success=${event.success}, messages=${event.messages?.length ?? 0})`
        )
        try {
          if (!event.success) {
            logger.info('openclaw-amem: agent_end skipped — event.success is false')
            return
          }
          // Extract last user + assistant exchange
          const msgs = event.messages || []
          const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
          const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')
          if (!lastUser || !lastAssistant) return

          const userText =
            typeof lastUser.content === 'string'
              ? lastUser.content
              : lastUser.content
                  .filter((b: any) => b.type === 'text')
                  .map((b: any) => b.text)
                  .join(' ')
          const assistantText =
            typeof lastAssistant.content === 'string'
              ? lastAssistant.content
              : lastAssistant.content
                  .filter((b: any) => b.type === 'text')
                  .map((b: any) => b.text)
                  .join(' ')

          // ── Step 1: 规则前置过滤 ──────────────────────────────────────────────────
          function shouldProcessTurn(text: string): boolean {
            if (text.trim().length < 10) return false
            const skipWords = ['好', '嗯', '明白', '明白了', '收到', 'ok', 'OK', '好的', '知道了', '了解', '谢谢', '谢']
            const trimmed = text.trim()
            if (skipWords.some((w) => trimmed === w || trimmed === w + '。' || trimmed === w + '！')) return false
            return true
          }

          if (!userText || !shouldProcessTurn(userText)) return

          // ── Step 2: 检索 Top5 已有相关记忆 ─────────────────────────────────────────
          const searchResults = await searchMemory(userText, 5, agentId, { storageCtx })
          const existingMemories = searchResults.map((r, idx) => ({
            idx,
            id: r.id,
            content: r.content,
          }))

          // ── Step 3: 调用 llmCrudDecision ────────────────────────────────────────────
          const { llmCrudDecision } = await import('./llm.js')
          const operations = await llmCrudDecision(
            userText,
            assistantText,
            existingMemories.map((m) => ({ idx: m.idx, content: m.content }))
          )

          if (!operations || operations.length === 0) return

          // ── Step 4: 执行 CRUD 操作 ───────────────────────────────────────────────
          for (const op of operations) {
            if (op.action === 'NEW') {
              await addMemory(op.fact, agentId, { storageCtx })
              logger.info(`openclaw-amem: CRUD NEW: "${op.fact.slice(0, 60)}${op.fact.length > 60 ? '...' : ''}"`)
            } else if (op.action === 'UPDATE' && op.existingIdx !== undefined) {
              const target = existingMemories[op.existingIdx]
              if (target) {
                const newEmbedding = await encode(op.fact)
                const hash = createHash('md5').update(op.fact).digest('hex')
                await storageCtx.updateNoteContent(target.id, op.fact, newEmbedding, hash)
                logger.info(
                  `openclaw-amem: CRUD UPDATE id=${target.id.slice(0, 8)}: "${op.fact.slice(0, 60)}${op.fact.length > 60 ? '...' : ''}"`
                )
              }
            } else if (op.action === 'DELETE' && op.existingIdx !== undefined) {
              const target = existingMemories[op.existingIdx]
              if (target) {
                await storageCtx.invalidateNote(target.id)
                logger.info(
                  `openclaw-amem: CRUD INVALIDATE id=${target.id.slice(0, 8)}: "${op.fact.slice(0, 60)}${op.fact.length > 60 ? '...' : ''}"`
                )
              }
            }
            // NONE: skip
          }

          // 同步触发碎片合并（Story 29: 改为 await 确保执行完毕）
          const today = new Date().toISOString().slice(0, 10)
          logger.info(`openclaw-amem: starting mergeSimilarNotes for agent=${agentId}, date=${today}`)
          try {
            const merged = await mergeSimilarNotes(agentId, storageCtx)
            if (merged > 0) {
              logger.info(`openclaw-amem: merged ${merged} similar notes today (${today})`)
            } else {
              logger.info(`openclaw-amem: mergeSimilarNotes completed, 0 pairs merged (${today})`)
            }
          } catch (mergeErr) {
            logger.error(
              `openclaw-amem: mergeSimilarNotes FAILED — ${(mergeErr as Error).message}\n${(mergeErr as Error).stack}`
            )
          }
        } catch (e) {
          logger.warn(`openclaw-amem: agent_end CRUD hook failed — ${(e as Error).message}`)
        }
      },
      { timeoutMs: 30000 }
    )
    logger.info('openclaw-amem: agent_end CRUD decision hook registered')
  }

  // ── scheduleNextRun ──────────────────────────────────────────────────────
  function scheduleNextRun() {
    const now = new Date()
    const target = new Date()
    target.setHours(2, 30, 0, 0)
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1)
    }
    const delay = target.getTime() - now.getTime()
    setTimeout(async () => {
      try {
        logger.info('openclaw-amem: Running scheduled daily consolidation...')
        const merged = await consolidateMemories(agentId, logger, storageCtx)
        if (merged > 0) {
          logger.info(`openclaw-amem: Scheduled daily consolidation merged ${merged} pairs.`)
        }
      } catch (err) {
        logger.warn(`openclaw-amem: Scheduled daily consolidation failed — ${(err as Error).message}`)
      }
      scheduleNextRun()
    }, delay)
  }
  scheduleNextRun()

  // ── registerService ──────────────────────────────────────────────────────
  if (typeof api.registerService === 'function') {
    api.registerService({
      id: 'amem-plugin',
      start() {
        logger.info(`openclaw-amem: started (backend: amem-qdrant, agentId: ${agentId})`)
      },
      stop() {
        logger.info('openclaw-amem: stopped')
      },
    })
  } else {
    logger.info(`openclaw-amem: initialized (backend: amem-qdrant, agentId: ${agentId})`)
  }
}

const plugin = definePluginEntry({
  id: 'openclaw-amem',
  name: 'Memory (A-MEM v2)',
  description: 'A-MEM agentic memory backend for OpenClaw — Qdrant + Transformers.js, no Python required.',
  register,
})

export default plugin
export { register }
export { addMemory, searchMemory, listMemories, mergeSimilarNotes, consolidateMemories } from './memory.js'
export { checkQuality } from './memory.js'
export {
  ensureCollection,
  getNote,
  updateNote,
  deleteNote,
  invalidateNote,
  listNotes,
  patchNotePayload,
} from './storage.js'
export { scanLowQuality, generateReviewBatch } from './quality.js'
