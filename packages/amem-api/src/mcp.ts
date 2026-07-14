import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

/**
 * The MCP bridge is a thin HTTP client of amem-api — deliberately not a second
 * engine.
 *
 * A stdio MCP server is spawned once *per client*: Claude Desktop, OpenClaw, a
 * game brain. If this process imported amem-core, each of those clients would
 * bring up its own Qdrant connection and its own embedding model — N writers,
 * which is the exact failure amem-api exists to prevent. So every tool below is
 * an HTTP call to the one running amem-api, and the single-writer guarantee
 * survives no matter how many clients attach.
 *
 * Two things fall out of that. The process starts instantly, with no model to
 * load — which matters, because the client spawns it on demand. And nothing
 * here can write to stdout, which under stdio *is* the protocol channel.
 */
const DEFAULT_API_URL = 'http://127.0.0.1:7788'

/**
 * Parse AMEM_API_URL rather than interpolate it. An operator who pastes a URL
 * carrying a path would otherwise silently end up POSTing to
 * `…/their/path/v1/memories`, and a typo'd scheme would fail deep inside fetch
 * with nothing to go on. Keep only the origin, and insist it is http(s) —
 * this bridge ships memory content, so where it ships it to is worth checking.
 */
function apiOrigin(): string {
  const raw = process.env.AMEM_API_URL ?? DEFAULT_API_URL
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`AMEM_API_URL is not a valid URL: "${raw}"`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`AMEM_API_URL must be http(s), got "${url.protocol}" in "${raw}"`)
  }
  return url.origin
}

const fail = (text: string): CallToolResult => ({ content: [{ type: 'text', text }], isError: true })

async function callApi(path: string, body: unknown): Promise<CallToolResult> {
  const origin = apiOrigin()
  let res: Response
  try {
    res = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return fail(`amem-api is not reachable at ${origin}. Start it first: \`amem-api\`.`)
  }

  const text = await res.text()
  if (!res.ok) {
    // amem-api answers { statusCode, error, detail? }. `detail` is present only
    // on 4xx — which is exactly the part the caller can do something about.
    let reason = text
    try {
      const parsed = JSON.parse(text) as { error?: string; detail?: string }
      reason = parsed.detail ?? parsed.error ?? text
    } catch {
      // Not JSON (a proxy error page, say) — hand back the raw body.
    }
    return fail(`amem-api ${res.status}: ${reason}`)
  }

  return { content: [{ type: 'text', text }] }
}

/**
 * These mirror the HTTP route bodies. amem-api stays the authoritative
 * validator — what is declared here is what the MCP client sees when it
 * discovers the tools, and any drift simply earns an honest 400 rather than a
 * silent mismatch.
 */
const agentId = z.string().min(1).optional().describe('Which agent\'s memories to act on. Defaults to "main".')

const writeShape = {
  text: z.string().min(1).describe('The memory content to store.'),
  agentId,
  scope: z
    .enum(['private', 'shared'])
    .optional()
    .describe('"shared" makes the memory readable by every agent. Defaults to "private".'),
}

const maintenanceShape = { agentId }

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'amem', version: '0.1.0' })

  server.registerTool(
    'memory_add',
    {
      title: 'Add memory (full pipeline)',
      description:
        'Store a memory through the full A-MEM pipeline — LLM note construction, link generation, evolution of neighbouring notes. Costs an LLM call; for a raw event you just want on the record, use memory_add_episodic.',
      inputSchema: writeShape,
    },
    ({ text, agentId, scope }) => callApi('/v1/memories', { text, agentId, scope })
  )

  server.registerTool(
    'memory_add_episodic',
    {
      title: 'Add episodic memory (cheap)',
      description:
        'Append a raw event to the memory log. Embeds and stores it, with no LLM call and no evolution — a faithful record, distilled later by consolidation. This is the one to use in a hot loop.',
      inputSchema: writeShape,
    },
    ({ text, agentId, scope }) => callApi('/v1/memories/episodic', { text, agentId, scope })
  )

  server.registerTool(
    'memory_search',
    {
      title: 'Search memories',
      description:
        'Retrieve memories relevant to a query, using hybrid retrieval (dense embeddings + BM25) with graph expansion over linked notes.',
      inputSchema: {
        query: z.string().min(1).describe('What to search for.'),
        limit: z.number().int().min(1).optional().describe('How many hits to return. Defaults to 5.'),
        agentId,
        topicsFilter: z.array(z.string()).optional().describe('Restrict the search to notes carrying these topics.'),
      },
    },
    ({ query, limit, agentId, topicsFilter }) => callApi('/v1/memories/search', { query, limit, agentId, topicsFilter })
  )

  server.registerTool(
    'memory_consolidate',
    {
      title: 'Consolidate memories',
      description:
        'Run offline consolidation: merge near-duplicate notes and distil episodic events. Slow and LLM-heavy — this is maintenance, not something to call in a loop.',
      inputSchema: maintenanceShape,
    },
    ({ agentId }) => callApi('/v1/maintenance/consolidate', { agentId })
  )

  server.registerTool(
    'memory_quality_scan',
    {
      title: 'Scan memory quality',
      description:
        'Report which stored notes look suspect — too short, an expired ephemeral, or carrying an unresolved conflict. Returns note ids and reasons; it changes nothing.',
      inputSchema: maintenanceShape,
    },
    ({ agentId }) => callApi('/v1/maintenance/quality-scan', { agentId })
  )

  return server
}
