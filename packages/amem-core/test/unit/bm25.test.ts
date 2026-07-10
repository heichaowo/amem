import { describe, it, expect } from 'vitest'
import { buildBM25, bm25Score } from '../../src/memory.js'
import type { MemoryNote } from '../../src/storage.js'

const note = (id: string, content: string, keywords: string[] = [], tags: string[] = []): MemoryNote =>
  ({ id, content, keywords, tags }) as unknown as MemoryNote

describe('buildBM25', () => {
  it('builds one corpus entry per note with a positive avgdl', () => {
    const state = buildBM25([note('a', 'the cat sat'), note('b', 'the dog ran fast')])
    expect(state.ids).toEqual(['a', 'b'])
    expect(state.corpus).toHaveLength(2)
    expect(state.avgdl).toBeGreaterThan(0)
  })

  it('indexes keywords and tags alongside content', () => {
    const state = buildBM25([note('a', 'hello', ['qdrant'], ['vector'])])
    expect(state.corpus[0]).toContain('qdrant')
    expect(state.corpus[0]).toContain('vector')
  })
})

describe('bm25Score', () => {
  it('ranks the matching doc first and scores non-matches zero', () => {
    const state = buildBM25([note('a', 'the cat sat on the mat'), note('b', 'the dog ran')])
    const ranked = bm25Score(state, ['cat'])
    expect(ranked[0][0]).toBe('a')
    expect(ranked.find(([id]) => id === 'b')![1]).toBe(0)
  })

  it('returns results sorted by descending score, highest term frequency first', () => {
    const state = buildBM25([
      note('a', 'apple apple apple'),
      note('b', 'apple banana'),
      note('c', 'cherry'),
    ])
    const ranked = bm25Score(state, ['apple'])
    const scores = ranked.map(([, s]) => s)
    expect(scores).toEqual([...scores].sort((x, y) => y - x))
    expect(ranked[0][0]).toBe('a')
  })
})
