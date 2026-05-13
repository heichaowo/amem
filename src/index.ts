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

  logger.info(`amem-plugin v2: registered (native TS, Qdrant, agent_id=${agentId})`)

  // Pre-warm: ensure Qdrant collection exists
  ensureCollection().catch((e) => logger.warn(`amem-plugin: ensureCollection failed — ${e.message}`))

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
                    logger.warn(`amem-plugin: search failed — ${(err as Error).message}`)
                    return []
                  }
                },
                async add(text: string) {
                  try {
                    await addMemory(text, agentId)
                    return { ok: true }
                  } catch (err) {
                    logger.warn(`amem-plugin: add failed — ${(err as Error).message}`)
                    return { ok: false, error: (err as Error).message }
                  }
                },
                async probeEmbeddingAvailability() { return { ok: true } },
                async close() {},
              },
            }
          } catch (err) {
            logger.warn(`amem-plugin: getMemorySearchManager failed — ${(err as Error).message}`)
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
    logger.warn('amem-plugin: api.registerMemoryCapability not available')
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
            logger.info(`amem-plugin: memory_search "${query}" → ${results.length} results (${Date.now() - start}ms)`)
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
            logger.warn(`amem-plugin: memory_search error — ${(err as Error).message}`)
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
            logger.info(`amem-plugin: memory_add OK id=${id} (${Date.now() - start}ms)`)
            return {
              content: [{ type: 'text', text: 'Memory saved successfully.' }],
              details: { ok: true, id },
            }
          } catch (err) {
            logger.warn(`amem-plugin: memory_add error — ${(err as Error).message}`)
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

    logger.info('amem-plugin v2: memory_search, memory_add, memory_list tools registered')
  } else {
    logger.warn('amem-plugin: api.registerTool not available — tools not registered')
  }

  // ── registerService ──────────────────────────────────────────────────────
  if (typeof api.registerService === 'function') {
    api.registerService({
      id: 'amem-plugin',
      start() { logger.info(`amem-plugin v2: started (backend: amem-qdrant, agentId: ${agentId})`) },
      stop() { logger.info('amem-plugin v2: stopped') },
    })
  } else {
    logger.info(`amem-plugin v2: initialized (backend: amem-qdrant, agentId: ${agentId})`)
  }
}

export { register }
