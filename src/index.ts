/**
 * amem-plugin v2 — A-MEM agentic memory backend for OpenClaw
 * TypeScript rewrite — Story 0: stub (calls Python daemon via HTTP)
 *
 * TODO: Stories 1-4 will replace the HTTP calls with native TS implementation
 */

import * as http from 'http'
import * as os from 'os'
import * as path from 'path'

// ── Config ───────────────────────────────────────────────────────────────────
let _config: Record<string, unknown> = {}

const DAEMON_URL = 'http://127.0.0.1:9885'

// ── HTTP helpers (calls existing Python daemon) ───────────────────────────────
function postJson(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const url = new URL(`${DAEMON_URL}${endpoint}`)
    const options = {
      hostname: url.hostname,
      port: Number(url.port),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve({ ok: false, error: data }) }
      })
    })
    req.on('error', reject)
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('amem HTTP timeout')) })
    req.write(payload)
    req.end()
  })
}

function getJson(endpoint: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${DAEMON_URL}${endpoint}`)
    const req = http.get({ hostname: url.hostname, port: Number(url.port), path: url.pathname }, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve({ ok: false }) }
      })
    })
    req.on('error', reject)
  })
}

// ── Core operations (stub → Python daemon) ────────────────────────────────────
async function addMemory(text: string): Promise<{ ok: boolean; error?: string }> {
  const res = (await postJson('/add', { text })) as { ok: boolean; error?: string }
  return res
}

interface SearchResult {
  id: string
  memory: string
  score: number
  context?: string
  tags?: string
}

async function searchMemory(query: string, topK = 5): Promise<SearchResult[]> {
  const res = (await postJson('/search', { query, top_k: topK })) as {
    ok: boolean
    output?: string
    results?: SearchResult[]
  }
  if (!res.ok) return []
  // daemon returns text output — parse it
  if (res.results) return res.results.slice(0, topK)
  if (res.output) return parseSearchOutput(res.output).slice(0, topK)
  return []
}

async function listMemories(): Promise<{ count: number }> {
  const res = (await getJson('/health')) as { ok: boolean; notes?: number }
  return { count: res.notes ?? 0 }
}

// ── Parse search output text ─────────────────────────────────────────────────
function parseSearchOutput(output: string): SearchResult[] {
  const results: SearchResult[] = []
  const blockRe = /\[(\d+)\]\s+(\S+)\s+\(similarity:\s*([\d.]+)[^)]*\)/g
  let match: RegExpExecArray | null
  const positions: { index: number; id: string; score: number }[] = []
  while ((match = blockRe.exec(output)) !== null) {
    positions.push({ index: match.index, id: match[2], score: parseFloat(match[3]) })
  }
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index
    const end = i + 1 < positions.length ? positions[i + 1].index : output.length
    const block = output.slice(start, end)
    const entry: SearchResult = { id: positions[i].id, score: positions[i].score, memory: '' }
    const contentMatch = block.match(/Content\s*:\s*(.+)/)
    const contextMatch = block.match(/Context\s*:\s*(.+)/)
    const tagsMatch = block.match(/Tags\s*:\s*(.+)/)
    if (contentMatch) entry.memory = contentMatch[1].trim()
    if (contextMatch) entry.context = contextMatch[1].trim()
    if (tagsMatch) entry.tags = tagsMatch[1].trim()
    if (entry.memory) results.push(entry)
  }
  return results
}

// ── OpenClaw plugin registration ──────────────────────────────────────────────
function register(api: {
  logger: { info: (msg: string) => void; warn: (msg: string) => void }
  config?: () => Record<string, unknown>
  registerMemoryCapability?: (cap: unknown) => void
  registerTool?: (tool: unknown, opts?: unknown) => void
  registerService?: (svc: unknown) => void
}) {
  const logger = api.logger
  _config = (api.config && api.config()) || {}
  const dbPath = (_config.dbPath as string) || path.join(os.homedir(), '.openclaw', 'amem_db')

  logger.info('amem-plugin v2: registered (stub → Python daemon)')

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
                    backend: 'amem-chromadb',
                    files: 0,
                    chunks: 0,
                    dirty: false,
                    workspaceDir: dbPath,
                  }
                },
                async search(query: string, opts: { limit?: number; topK?: number } = {}) {
                  try {
                    return await searchMemory(query, opts.limit || opts.topK || 5)
                  } catch (err) {
                    logger.warn(`amem-plugin: search failed — ${(err as Error).message}`)
                    return []
                  }
                },
                async add(text: string) {
                  try {
                    await addMemory(text)
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
          return { backend: 'amem-chromadb', baseUrl: '', userId: 'default' }
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
        description: 'Search long-term memories stored in A-MEM / ChromaDB.',
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
            const results = await searchMemory(query, limit)
            logger.info(`amem-plugin: memory_search "${query}" → ${results.length} results (${Date.now() - start}ms)`)
            if (!results.length) {
              return { content: [{ type: 'text', text: 'No relevant memories found.' }], details: { count: 0 } }
            }
            const text = results
              .map((r, i) => `${i + 1}. ${r.memory} (score: ${(r.score * 100).toFixed(0)}%, id: ${r.id})`)
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
            await addMemory(text)
            logger.info(`amem-plugin: memory_add OK (${Date.now() - start}ms)`)
            return {
              content: [{ type: 'text', text: 'Memory saved successfully.' }],
              details: { ok: true },
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
        description: 'List memory count in A-MEM.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        async execute(_toolCallId: string, _params: Record<string, never>) {
          try {
            const { count } = await listMemories()
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

    logger.info('amem-plugin: memory_search, memory_add, memory_list tools registered')
  } else {
    logger.warn('amem-plugin: api.registerTool not available — tools not registered')
  }

  // ── registerService ──────────────────────────────────────────────────────
  if (typeof api.registerService === 'function') {
    api.registerService({
      id: 'amem-plugin',
      start() { logger.info(`amem-plugin: initialized (backend: amem-chromadb, stateDir: ${dbPath})`) },
      stop() { logger.info('amem-plugin: stopped') },
    })
  } else {
    logger.info('amem-plugin: initialized (backend: amem-chromadb)')
  }
}

module.exports = { register }
