import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fakeEncode } = vi.hoisted(() => {
  function fakeEncode(text: string): number[] {
    const dim = 8
    const v = new Array(dim).fill(0)
    for (let i = 0; i < text.length; i++) v[i % dim] += text.charCodeAt(i) + 1
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
    return v.map((x) => x / norm)
  }
  return { fakeEncode }
})

vi.mock('../../src/embedding.js', () => ({
  encode: vi.fn(async (t: string) => fakeEncode(t)),
  cosineSimilarity: (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0),
}))

// Spies only — addEpisodic must never reach any of these.
vi.mock('../../src/llm.js', () => ({
  llmConstructNote: vi.fn(),
  llmShouldLink: vi.fn(),
  llmEvolveNote: vi.fn(),
  llmShouldMerge: vi.fn(),
  llmEvolutionJudge: vi.fn(),
}))

import { addEpisodic } from '../../src/memory.js'
import { encode } from '../../src/embedding.js'
import * as llm from '../../src/llm.js'
import type { MemoryNote, StorageContext } from '../../src/storage.js'

const EVENT = 'the ender dragon killed us at the portal'

function makeCtx() {
  const added: MemoryNote[] = []
  const ctx = {
    addNote: vi.fn(async (n: MemoryNote) => {
      added.push(n)
    }),
  } as unknown as StorageContext
  return { ctx, added }
}

describe('addEpisodic', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores a raw note and returns its id', async () => {
    const { ctx, added } = makeCtx()
    const id = await addEpisodic(EVENT, 'game', { storageCtx: ctx })

    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(added).toHaveLength(1)
    expect(added[0].id).toBe(id)
    expect(added[0].content).toBe(EVENT)
    expect(added[0].agent_id).toBe('game')
    expect(added[0].owner).toBe('game')
  })

  it('never calls the LLM — that is the whole point of the cheap path', async () => {
    const { ctx } = makeCtx()
    await addEpisodic(EVENT, 'game', { storageCtx: ctx })

    expect(llm.llmConstructNote).not.toHaveBeenCalled()
    expect(llm.llmShouldLink).not.toHaveBeenCalled()
    expect(llm.llmEvolveNote).not.toHaveBeenCalled()
    expect(llm.llmShouldMerge).not.toHaveBeenCalled()
    expect(llm.llmEvolutionJudge).not.toHaveBeenCalled()
  })

  it('leaves LLM-derived fields empty and carries no link/evolution state', async () => {
    const { ctx, added } = makeCtx()
    await addEpisodic(EVENT, 'game', { storageCtx: ctx })
    const n = added[0]

    expect(n.keywords).toEqual([])
    expect(n.tags).toEqual([])
    expect(n.context).toBe('')
    expect(n.topics).toEqual([])
    expect(n.links).toEqual([])
    expect(n.evolution_history).toEqual([])
    expect(n.category).toBe('General')
    expect(n.note_type).toBe('memory')
    expect(n.pending_merge).toBe(false)
  })

  it('embeds the raw content, not a keyword/tag concatenation', async () => {
    const { ctx } = makeCtx()
    await addEpisodic(EVENT, 'game', { storageCtx: ctx })

    expect(encode).toHaveBeenCalledTimes(1)
    expect(encode).toHaveBeenCalledWith(EVENT)
  })

  it('is append-only — identical content written twice becomes two events', async () => {
    const { ctx, added } = makeCtx()
    const first = await addEpisodic(EVENT, 'game', { storageCtx: ctx })
    const second = await addEpisodic(EVENT, 'game', { storageCtx: ctx })

    expect(first).not.toBe(second)
    expect(added).toHaveLength(2)
    // Same content hash, still two distinct notes: no dedup on the event log.
    expect(added[0].hash).toBe(added[1].hash)
  })

  it('honours the quality gate and stores nothing when it fails', async () => {
    const { ctx, added } = makeCtx()
    await expect(addEpisodic('too short', 'game', { storageCtx: ctx })).rejects.toThrow(/quality/)
    expect(added).toHaveLength(0)
  })

  it('writes a shared-scope note as agent_id "shared", readable by all', async () => {
    const { ctx, added } = makeCtx()
    await addEpisodic(EVENT, 'game', { scope: 'shared', storageCtx: ctx })

    expect(added[0].agent_id).toBe('shared')
    expect(added[0].readers).toEqual(['*'])
    expect(added[0].owner).toBe('game')
    expect(added[0].writers).toEqual(['game'])
  })

  it('marks ephemeral content from the quality signal', async () => {
    const { ctx, added } = makeCtx()
    await addEpisodic('这个任务待跑一下明天再看结果', 'game', { storageCtx: ctx })
    expect(added[0].ephemeral).toBe(true)
  })
})
