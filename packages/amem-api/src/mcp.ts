import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { isLoopback } from './net.js'

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
 * Where this bridge is allowed to send memories.
 *
 * Every tool call POSTs the user's memory content to this origin, so a typo in
 * a config file — or a config file someone else wrote — is enough to ship a
 * lifetime of private notes to a host they did not choose. Loopback is
 * therefore the only destination allowed by default; leaving the machine has to
 * be a deliberate act (AMEM_MCP_ALLOW_REMOTE=1), not an accident.
 *
 * This mirrors the rule the server already keeps: amem-api binds 127.0.0.1 and
 * demands a token before it will listen anywhere else. The client half owes the
 * same discipline — memory should not leave the box quietly from either end.
 *
 * The URL is parsed rather than interpolated, too: a pasted URL carrying a path
 * would otherwise silently redirect every request to `…/their/path/v1/memories`.
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

  if (!isLoopback(url.hostname) && process.env.AMEM_MCP_ALLOW_REMOTE !== '1') {
    throw new Error(
      `AMEM_API_URL points off this machine (${url.hostname}). This bridge sends your memory ` +
        `content to that host. If that is what you want, set AMEM_MCP_ALLOW_REMOTE=1.`
    )
  }

  if (!isLoopback(url.hostname) && url.protocol === 'http:') {
    // Allowed — an operator may be fronting amem-api with their own TLS or a
    // tunnel — but they should know the memories are crossing the wire in clear.
    process.stderr.write(`amem-mcp: warning — sending memory content in plaintext to ${url.host}. Prefer https.\n`)
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
