import { describe, it, expect, beforeEach } from 'vitest'
import {
  hookLiveness,
  markHookFired,
  hookNeverFiredWarning,
  __resetHookLiveness,
  HOOK_WARN_DELAY_MS,
  HOOK_WARNING_TEXT,
} from '../../src/hook-liveness.js'

// The signal lives on globalThis (reload-stable across register() instances), so
// every test starts from a clean, explicitly-seeded record.
beforeEach(() => __resetHookLiveness(0))

describe('hookLiveness', () => {
  it('seeds an unfired record on first access, anchoring firstSeenAt', () => {
    __resetHookLiveness()
    const s = hookLiveness(1000)
    expect(s).toEqual({ everFired: false, lastFiredAt: 0, firstSeenAt: 1000 })
  })

  it('returns the same record on later calls without moving firstSeenAt', () => {
    const first = hookLiveness(0)
    const later = hookLiveness(999_999)
    expect(later).toBe(first)
    expect(later.firstSeenAt).toBe(0)
  })
})

describe('markHookFired', () => {
  it('flips everFired and stamps lastFiredAt', () => {
    markHookFired(500)
    const s = hookLiveness()
    expect(s.everFired).toBe(true)
    expect(s.lastFiredAt).toBe(500)
  })

  it('is visible to a later, independent reader (shared via globalThis)', () => {
    markHookFired(42)
    // Simulates a different register() instance reading the process-wide signal.
    expect(hookLiveness(1_000_000).everFired).toBe(true)
  })
})

describe('hookNeverFiredWarning', () => {
  it('stays silent while still inside the warn delay', () => {
    expect(hookNeverFiredWarning(HOOK_WARN_DELAY_MS)).toBe('')
  })

  it('warns once past the delay and the hook has never fired', () => {
    expect(hookNeverFiredWarning(HOOK_WARN_DELAY_MS + 1)).toBe(HOOK_WARNING_TEXT)
  })

  it('stays silent past the delay once the hook has fired', () => {
    markHookFired(1)
    expect(hookNeverFiredWarning(HOOK_WARN_DELAY_MS + 1)).toBe('')
  })
})

describe('__resetHookLiveness', () => {
  it('clears the signal, so a fired hook reads as never-fired again', () => {
    markHookFired(1)
    expect(hookLiveness().everFired).toBe(true)
    __resetHookLiveness(0)
    expect(hookLiveness().everFired).toBe(false)
  })
})
