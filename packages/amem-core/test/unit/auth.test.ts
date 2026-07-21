import { describe, it, expect } from 'vitest'
import { canWrite } from '../../src/auth.js'

// Synthetic notes only — never a real memory.
const note = (owner: string, writers: string[]) => ({ owner, writers })

describe('canWrite — the Access Protocol write rule', () => {
  it('lets the owner write its own note', () => {
    expect(canWrite(note('main', ['main']), 'main')).toBe(true)
  })

  it('lets an explicitly authorized writer write', () => {
    expect(canWrite(note('main', ['main', 'dev']), 'dev')).toBe(true)
  })

  it('lets anyone write when writers is open ("*")', () => {
    expect(canWrite(note('main', ['*']), 'someone-else')).toBe(true)
  })

  it('denies an agent that is neither owner nor listed', () => {
    expect(canWrite(note('main', ['main']), 'dev')).toBe(false)
  })

  it('denies a non-owner on a SHARED note — readable, not writable', () => {
    // The case every audited gap reduced to: shared notes are returned by every
    // query, so without this rule any agent could rewrite another agent's memory.
    expect(canWrite(note('main', ['main']), 'game-persona')).toBe(false)
  })

  it('still allows the owner even when writers omits them', () => {
    expect(canWrite(note('main', ['dev']), 'main')).toBe(true)
  })

  it('denies when writers is empty and the caller is not the owner', () => {
    expect(canWrite(note('main', []), 'dev')).toBe(false)
  })
})
