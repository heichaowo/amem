import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Shared spies for both SDK clients. The engine constructs each client lazily,
// so these capture the constructor options and the create() calls.
const { anthropicCreate, openaiCreate, AnthropicCtor, OpenAICtor } = vi.hoisted(() => {
  const anthropicCreate = vi.fn()
  const openaiCreate = vi.fn()
  const AnthropicCtor = vi.fn()
  const OpenAICtor = vi.fn()
  return { anthropicCreate, openaiCreate, AnthropicCtor, OpenAICtor }
})

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreate }
    constructor(opts: unknown) {
      AnthropicCtor(opts)
    }
  },
}))

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: openaiCreate } }
    constructor(opts: unknown) {
      OpenAICtor(opts)
    }
  },
}))

// PROVIDER and MODEL are read at module load, so each case re-imports llm.js
// fresh after stubbing env.
async function loadLlm(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) vi.stubEnv(k, '')
    else vi.stubEnv(k, v)
  }
  return import('../../src/llm.js')
}

beforeEach(() => {
  anthropicCreate.mockReset()
  openaiCreate.mockReset()
  AnthropicCtor.mockReset()
  OpenAICtor.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('llmCall provider dispatch', () => {
  it('defaults to Anthropic and returns the first text block', async () => {
    anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: '  hi from claude  ' }] })
    const { llmCall } = await loadLlm({ AMEM_LLM_PROVIDER: undefined })

    const out = await llmCall('ping')

    expect(out).toBe('hi from claude')
    expect(anthropicCreate).toHaveBeenCalledOnce()
    expect(openaiCreate).not.toHaveBeenCalled()
    const arg = anthropicCreate.mock.calls[0][0]
    expect(arg.model).toBe('claude-sonnet-4-6')
    expect(arg.messages).toEqual([{ role: 'user', content: 'ping' }])
  })

  it('routes to OpenAI chat.completions when AMEM_LLM_PROVIDER=openai', async () => {
    openaiCreate.mockResolvedValue({ choices: [{ message: { content: '  hi from gpt  ' } }] })
    const { llmCall } = await loadLlm({ AMEM_LLM_PROVIDER: 'openai' })

    const out = await llmCall('ping', 123)

    expect(out).toBe('hi from gpt')
    expect(openaiCreate).toHaveBeenCalledOnce()
    expect(anthropicCreate).not.toHaveBeenCalled()
    const arg = openaiCreate.mock.calls[0][0]
    expect(arg.model).toBe('gpt-4o-mini') // provider default
    expect(arg.max_tokens).toBe(123)
    expect(arg.max_completion_tokens).toBeUndefined()
    expect(arg.messages).toEqual([{ role: 'user', content: 'ping' }])
  })

  it('honours AMEM_LLM_BASE_URL and AMEM_LLM_API_KEY on the OpenAI client', async () => {
    openaiCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] })
    const { llmCall } = await loadLlm({
      AMEM_LLM_PROVIDER: 'openai',
      AMEM_LLM_BASE_URL: 'http://localhost:11434/v1',
      AMEM_LLM_API_KEY: 'my-key',
    })

    await llmCall('ping')

    expect(OpenAICtor).toHaveBeenCalledOnce()
    expect(OpenAICtor.mock.calls[0][0]).toMatchObject({ apiKey: 'my-key', baseURL: 'http://localhost:11434/v1' })
  })

  it('falls back to a placeholder key so keyless local servers work', async () => {
    openaiCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] })
    const { llmCall } = await loadLlm({ AMEM_LLM_PROVIDER: 'openai', AMEM_LLM_API_KEY: undefined })

    await llmCall('ping')

    expect(OpenAICtor.mock.calls[0][0].apiKey).toBe('sk-no-key-required')
  })

  it('uses max_completion_tokens for OpenAI reasoning models', async () => {
    openaiCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] })
    const { llmCall } = await loadLlm({ AMEM_LLM_PROVIDER: 'openai', AMEM_LLM_MODEL: 'o3-mini' })

    await llmCall('ping', 200)

    const arg = openaiCreate.mock.calls[0][0]
    expect(arg.max_completion_tokens).toBe(200)
    expect(arg.max_tokens).toBeUndefined()
  })

  it('returns null (not throw) when the provider call rejects', async () => {
    openaiCreate.mockRejectedValue(new Error('502 upstream'))
    const { llmCall } = await loadLlm({ AMEM_LLM_PROVIDER: 'openai' })

    const out = await llmCall('ping')

    expect(out).toBeNull()
  })
})
