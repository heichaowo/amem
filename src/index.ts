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
import { addMemory, searchMemory, listMemories } from './memory.js'
import { ensureCollection } from './storage.js'

// ── Config ────────────────────────────────────────────────────────────────────
let _config: Record<string, unknown> = {}

function getAgentId(cfg: Record<string, unknown>): string {
  return (cfg.agentId as string) || 'main'
}

// ── OpenClaw plugin registration ──────────────────────────────────────────────
function register(api: {
  logger: { info: (msg: string) => void; warn: (msg: string) => void }
  pluginConfig?: Record<string, unknown>
  registerMemoryCapability?: (cap: unknown) => void
  registerTool?: (tool: unknown, opts?: unknown) => void
  registerService?: (svc: unknown) => void
}) {
  const logger = api.logger
  _config = (api.pluginConfig as Record<string, unknown>) || {}
  const agentId = getAgentId(_config)
  const dbPath = path.join(os.homedir(), '.openclaw', 'amem_db')

  logger.info(`openclaw-amem: registered (native TS, Qdrant, agent_id=${agentId})`)

  // Pre-warm: ensure Qdrant collection exists
  ensureCollection().catch((e) => logger.warn(`openclaw-amem: ensureCollection failed — ${e.message}`))

  // ── registerMemoryCapability ─────────────────────────────────────────────
  if (typeof api.registerMemoryCapability === 'function') {
    api.registerMemoryCapability({
      publicArtifacts: {
        async listArtifacts(_p: unknown) { return { items: [] } },
        async getArtifact(_p: unknown) { return null },
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
                    const results = await searchMemory(query, topK, agentId)
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
                    await addMemory(text, agentId)
                    return { ok: true }
                  } catch (err) {
                    logger.warn(`openclaw-amem: add failed — ${(err as Error).message}`)
                    return { ok: false, error: (err as Error).message }
                  }
                },
                async probeEmbeddingAvailability() { return { ok: true } },
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
          },
          required: ['query'],
        },
        async execute(_toolCallId: string, params: { query: string; limit?: number }) {
          const { query, limit = 5 } = params
          const start = Date.now()
          try {
            const results = await searchMemory(query, limit, agentId)
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
            const id = await addMemory(text, agentId)
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
            const { count } = await listMemories(agentId)
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

    logger.info('openclaw-amem: memory_search, memory_add, memory_list tools registered')
  } else {
    logger.warn('openclaw-amem: api.registerTool not available — tools not registered')
  }

  // ── agent_end hook: auto-capture memories after each turn ─────────────────
  if (typeof (api as any).registerHook === 'function' || typeof (api as any).on === 'function') {
    const hookFn = (typeof (api as any).on === 'function' ? (api as any).on : (api as any).registerHook).bind(api)
    hookFn('agent_end', async (event: {
      messages?: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>
      success?: boolean
    }) => {
      try {
        if (!event.success) return
        // Extract last user + assistant exchange
        const msgs = event.messages || []
        const lastUser = [...msgs].reverse().find(m => m.role === 'user')
        const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant')
        if (!lastUser || !lastAssistant) return

        const userText = typeof lastUser.content === 'string'
          ? lastUser.content
          : lastUser.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ')
        const assistantText = typeof lastAssistant.content === 'string'
          ? lastAssistant.content
          : lastAssistant.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ')

        if (!userText || userText.length < 10) return

        // Ask LLM to extract memorable facts from this exchange
        const { llmCall } = await import('./llm.js')
        const prompt = `You are a memory extraction assistant. Given a conversation exchange, extract 0-3 important facts worth remembering long-term. Only extract genuinely important facts (decisions, preferences, project status, account info, key insights). Skip small talk and trivial content.

User: ${userText.slice(0, 500)}
Assistant: ${assistantText.slice(0, 500)}

Respond with a JSON array of strings (facts to remember), or an empty array [] if nothing is worth remembering. Each fact should be a concise sentence under 150 chars. Example: ["Alex决定用 CrewAI 作为多 agent 框架", "MetaSmith 定位是 bug 修复工具，不做通用代码生成"]`

        const result = await llmCall(prompt, 300)
        if (!result) return

        const match = result.match(/\[.*\]/s)
        if (!match) return
        const facts: string[] = JSON.parse(match[0])
        if (!Array.isArray(facts) || facts.length === 0) return

        for (const fact of facts.slice(0, 3)) {
          if (typeof fact === 'string' && fact.length > 5) {
            await addMemory(fact, agentId)
            logger.info(`openclaw-amem: auto-captured memory: "${fact.slice(0, 60)}..."`)
          }
        }
      } catch (e) {
        logger.warn(`openclaw-amem: agent_end auto-capture failed — ${(e as Error).message}`)
      }
    }, { timeoutMs: 30000 })
    logger.info('openclaw-amem: agent_end auto-capture hook registered')
  }

  // ── registerService ──────────────────────────────────────────────────────
  if (typeof api.registerService === 'function') {
    api.registerService({
      id: 'amem-plugin',
      start() { logger.info(`openclaw-amem: started (backend: amem-qdrant, agentId: ${agentId})`) },
      stop() { logger.info('openclaw-amem: stopped') },
    })
  } else {
    logger.info(`openclaw-amem: initialized (backend: amem-qdrant, agentId: ${agentId})`)
  }
}

export { register }
