import { describe, it, expect } from 'vitest'
import { checkQuality } from '../../src/memory.js'

describe('checkQuality', () => {
  it('rejects content shorter than 10 characters', () => {
    const r = checkQuality('too short') // 9 chars
    expect(r.ok).toBe(false)
    expect(r.reason).toBeDefined()
  })

  it('accepts sufficiently long content as non-ephemeral', () => {
    const r = checkQuality('this is a long enough memory note')
    expect(r.ok).toBe(true)
    expect(r.ephemeral).toBe(false)
  })

  it('flags ephemeral content by signal words but still accepts it', () => {
    const r = checkQuality('这个任务待跑一下明天再看结果') // contains 待跑
    expect(r.ok).toBe(true)
    expect(r.ephemeral).toBe(true)
  })

  it('trims before measuring length', () => {
    expect(checkQuality('   short   ').ok).toBe(false)
  })
})
