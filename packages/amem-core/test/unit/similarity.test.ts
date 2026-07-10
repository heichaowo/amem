import { describe, it, expect } from 'vitest'
import { cosineSimilarity } from '../../src/embedding.js'

// cosineSimilarity is a dot product; it equals cosine only for L2-normalized
// vectors, which is the invariant encode() guarantees.
describe('cosineSimilarity', () => {
  it('returns 1 for identical unit vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([0.6, 0.8], [0.6, 0.8])).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal unit vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('returns -1 for opposite unit vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it('computes the plain dot product for arbitrary vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [4, 5, 6])).toBe(32)
  })
})
