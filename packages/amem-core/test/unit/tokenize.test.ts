import { describe, it, expect } from 'vitest'
import { simpleTokenize } from '../../src/memory.js'

describe('simpleTokenize', () => {
  it('lowercases and strips punctuation for English', () => {
    expect(simpleTokenize('Hello, World!')).toEqual(['hello', 'world'])
  })

  it('treats underscores and digits as word characters', () => {
    expect(simpleTokenize('foo_bar 123')).toEqual(['foo_bar', '123'])
  })

  it('returns an empty array for empty / punctuation-only input', () => {
    expect(simpleTokenize('')).toEqual([])
    expect(simpleTokenize('!!! ??? ...')).toEqual([])
  })

  it('segments Chinese text into multiple tokens (Jieba)', () => {
    const tokens = simpleTokenize('记忆系统很好用')
    expect(tokens.length).toBeGreaterThan(1)
    expect(tokens).toContain('记忆')
  })

  it('preserves ASCII tokens (lowercased) inside mixed CJK/ASCII text', () => {
    const tokens = simpleTokenize('检索Qdrant结果')
    expect(tokens).toContain('qdrant')
  })
})
