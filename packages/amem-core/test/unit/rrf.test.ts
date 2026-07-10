import { describe, it, expect } from 'vitest'
import { rrfMerge } from '../../src/memory.js'

describe('rrfMerge', () => {
  it('fuses two ranked lists with reciprocal-rank scoring', () => {
    const merged = rrfMerge(['a', 'b', 'c'], ['b', 'c', 'a'])
    const ids = merged.map(([id]) => id)
    // b is rank 1 in the first list and rank 0 in the second — best combined
    expect(ids[0]).toBe('b')
    expect(new Set(ids)).toEqual(new Set(['a', 'b', 'c']))
  })

  it('ranks an item present in both lists above one present in only one', () => {
    const merged = rrfMerge(['x', 'y'], ['x', 'z'])
    const score = (id: string) => merged.find(([i]) => i === id)![1]
    expect(score('x')).toBeGreaterThan(score('y'))
    expect(score('x')).toBeGreaterThan(score('z'))
  })

  it('uses the k constant — a smaller k yields larger scores', () => {
    const [[, s60]] = rrfMerge(['a'], ['a'], 60)
    const [[, s10]] = rrfMerge(['a'], ['a'], 10)
    expect(s10).toBeGreaterThan(s60)
  })
})
