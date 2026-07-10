import { describe, it, expect, vi } from 'vitest'

// Deterministic fake embedding, hoisted so the vi.mock factory can use it:
// the same text always maps to the same L2-normalized 384-d vector, so a query
// that repeats the stored text matches it exactly. No ONNX model download.
const { fakeEncode } = vi.hoisted(() => {
  function fakeEncode(text: string): number[] {
    const dim = 384
    const v = new Array(dim).fill(0)
    for (let i = 0; i < text.length; i++) v[i % dim] += text.charCodeAt(i) + 1
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
    return v.map((x) => x / norm)
  }
  return { fakeEncode }
})

// Mock the LLM so the pipeline is deterministic and hits no API: a fixed note
// structure (empty keywords/tags/context → embed text == content), and no
// linking / merging / evolution.
vi.mock('../../src/llm.js', () => ({
  llmConstructNote: async () => ({
    keywords: [],
    tags: [],
    context: '',
    category: 'General',
    note_type: 'memory',
    topics: [],
  }),
  llmShouldLink: async () => false,
  llmEvolveNote: async () => ({ context: '', tags: [], keywords: [] }),
  llmShouldMerge: async () => ({ shouldMerge: false }),
  llmEvolutionJudge: async () => ({ action: 'NONE' }),
}))

// Mock embeddings so no 384-d ONNX model is downloaded; deterministic vectors.
vi.mock('../../src/embedding.js', () => ({
  encode: async (t: string) => fakeEncode(t),
  cosineSimilarity: (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0),
}))

import { addMemory, searchMemory } from '../../src/memory.js'
import { createStorageContext } from '../../src/storage.js'

// A fresh collection per worker keeps integration runs isolated (Mode B).
const collection = `amem_it_${process.pid}`

describe('memory pipeline (integration — requires Qdrant on :6333)', () => {
  it('stores a memory and retrieves it by the same query', async () => {
    const ctx = createStorageContext(collection)
    const id = await addMemory('the sky is unusually blue today', 'main', { storageCtx: ctx })
    expect(id).toBeTruthy()

    const results = await searchMemory('the sky is unusually blue today', 5, 'main', { storageCtx: ctx })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content).toContain('sky is unusually blue')
  })

  it('isolates memories per agent — dev cannot see main’s private note', async () => {
    const ctx = createStorageContext(collection)
    await addMemory('mains private note mentioning zephyrquux', 'main', {
      scope: 'private',
      storageCtx: ctx,
    })
    const devResults = await searchMemory('zephyrquux', 5, 'dev', { storageCtx: ctx })
    expect(devResults).toHaveLength(0)
  })
})
