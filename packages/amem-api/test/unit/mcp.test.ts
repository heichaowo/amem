import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from '../../src/mcp.js'

// Drive the bridge through a real MCP client over a linked in-memory transport,
// so the schemas and the protocol wiring are exercised, not just the handlers.
// The only thing stubbed is fetch — the bridge's single I/O call.
let client: Client
let fetchMock: ReturnType<typeof vi.fn>

const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) })
const bad = (status: number, body: unknown) => ({
  ok: false,
  status,
  text: async () => JSON.stringify(body),
})

beforeEach(async () => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  const server = createMcpServer()
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'test', version: '0' })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
})

afterEach(async () => {
  await client.close()
  vi.unstubAllGlobals()
})

const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args }) as Promise<{
    content: { text: string }[]
    isError?: boolean
  }>

const requestFor = (i = 0) => {
  const [url, init] = fetchMock.mock.calls[i] as [string, { body: string }]
  return { url, body: JSON.parse(init.body) as Record<string, unknown> }
}

describe('MCP bridge', () => {
  it('advertises exactly the five memory tools', async () => {
    const { tools } = await client.listTools()

    expect(tools.map((t) => t.name).sort()).toEqual([
      'memory_add',
      'memory_add_episodic',
      'memory_consolidate',
      'memory_quality_scan',
      'memory_search',
    ])
  })

  it('routes memory_add to the full pipeline, passing agent and scope through', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'note-1' }))

    const res = await call('memory_add', {
      text: 'the ender dragon killed us at the portal',
      agentId: 'game',
      scope: 'shared',
    })

    expect(requestFor().url).toBe('http://127.0.0.1:7788/v1/memories')
    expect(requestFor().body).toEqual({
      text: 'the ender dragon killed us at the portal',
      agentId: 'game',
      scope: 'shared',
    })
    expect(res.content[0].text).toContain('note-1')
    expect(res.isError).toBeFalsy()
  })

  it('routes memory_add_episodic to the cheap path, not the pipeline', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'event-1' }))

    await call('memory_add_episodic', { text: 'the ender dragon killed us at the portal' })

    expect(requestFor().url).toBe('http://127.0.0.1:7788/v1/memories/episodic')
  })

  it('omits the fields the caller left out, rather than sending undefined', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'note-1' }))

    await call('memory_add', { text: 'the ender dragon killed us at the portal' })

    // amem-api's schema is additionalProperties:false and applies its own
    // defaults — the bridge must not invent an agentId or a scope.
    expect(requestFor().body).toEqual({ text: 'the ender dragon killed us at the portal' })
  })

  it('passes the search query, limit and topic filter through', async () => {
    fetchMock.mockResolvedValue(ok({ results: [] }))

    await call('memory_search', {
      query: 'dragon',
      limit: 10,
      agentId: 'game',
      topicsFilter: ['combat'],
    })

    expect(requestFor().url).toBe('http://127.0.0.1:7788/v1/memories/search')
    expect(requestFor().body).toEqual({
      query: 'dragon',
      limit: 10,
      agentId: 'game',
      topicsFilter: ['combat'],
    })
  })

  it('routes the two maintenance tools to their own endpoints', async () => {
    fetchMock.mockResolvedValue(ok({ merged: 0 }))
    await call('memory_consolidate', { agentId: 'game' })
    expect(requestFor().url).toBe('http://127.0.0.1:7788/v1/maintenance/consolidate')

    fetchMock.mockResolvedValue(ok({ items: [] }))
    await call('memory_quality_scan', {})
    expect(requestFor(1).url).toBe('http://127.0.0.1:7788/v1/maintenance/quality-scan')
    // A body is still required, even when every field is optional.
    expect(requestFor(1).body).toEqual({})
  })

  it('rejects a call that violates the tool schema, without reaching the network', async () => {
    // The SDK validates against the declared zod shape and answers with an
    // error result — it does not invoke the handler, so amem-api never sees it.
    const res = await call('memory_add', { agentId: 'game' }) // no `text`

    expect(res.isError).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("surfaces amem-api's 4xx detail, which is the part the caller can act on", async () => {
    fetchMock.mockResolvedValue(
      bad(422, { statusCode: 422, error: 'Unprocessable Entity', detail: '[quality] 写入拒绝: 内容过短' })
    )

    const res = await call('memory_add', { text: 'short' })

    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('422')
    expect(res.content[0].text).toContain('[quality]')
  })

  it('says amem-api is down, and how to start it, when it cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const res = await call('memory_search', { query: 'dragon' })

    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('not reachable')
    expect(res.content[0].text).toContain('amem-api')
  })

  it('honours AMEM_API_URL', async () => {
    vi.stubEnv('AMEM_API_URL', 'http://memory.internal:9000')
    fetchMock.mockResolvedValue(ok({ results: [] }))

    await call('memory_search', { query: 'dragon' })

    expect(requestFor().url).toBe('http://memory.internal:9000/v1/memories/search')
  })
})
