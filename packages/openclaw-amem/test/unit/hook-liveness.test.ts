import { describe, it, expect, beforeEach } from 'vitest'
import {
  hookLiveness,
  markHookFired,
  markActivity,
  hookLikelyBlocked,
  hookNeverFiredWarning,
  __resetHookLiveness,
  HOOK_WARN_DELAY_MS,
  HOOK_WARNING_TEXT,
} from '../../src/hook-liveness.js'

// The signal lives on globalThis (reload-stable across register() instances), so
// every test starts from a clean, explicitly-seeded record.
beforeEach(() => __resetHookLiveness(0))

describe('hookLiveness', () => {
  it('seeds an unfired, no-activity record on first access, anchoring firstSeenAt', () => {
    __resetHookLiveness()
    const s = hookLiveness(1000)
    expect(s).toEqual({ everFired: false, lastFiredAt: 0, firstSeenAt: 1000, sawActivity: false })
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

describe('markActivity', () => {
  it('records that a conversation is happening (shared via globalThis)', () => {
    expect(hookLiveness().sawActivity).toBe(false)
    markActivity(10)
    expect(hookLiveness(1_000_000).sawActivity).toBe(true)
  })
})

describe('hookLikelyBlocked / hookNeverFiredWarning', () => {
  it('stays silent on an IDLE gateway past the delay — no activity, nothing was due', () => {
    // The regression this fixes: a restarted-but-untouched gateway must not warn.
    expect(hookLikelyBlocked(HOOK_WARN_DELAY_MS + 1)).toBe(false)
    expect(hookNeverFiredWarning(HOOK_WARN_DELAY_MS + 1)).toBe('')
  })

  it('stays silent while still inside the warn delay, even with activity', () => {
    markActivity(1)
    expect(hookLikelyBlocked(HOOK_WARN_DELAY_MS)).toBe(false)
    expect(hookNeverFiredWarning(HOOK_WARN_DELAY_MS)).toBe('')
  })

  it('warns once past the delay when there was activity but the hook never fired', () => {
    markActivity(1)
    expect(hookLikelyBlocked(HOOK_WARN_DELAY_MS + 1)).toBe(true)
    expect(hookNeverFiredWarning(HOOK_WARN_DELAY_MS + 1)).toBe(HOOK_WARNING_TEXT)
  })

  it('stays silent past the delay once the hook has fired, even with activity', () => {
    markActivity(1)
    markHookFired(2)
    expect(hookLikelyBlocked(HOOK_WARN_DELAY_MS + 1)).toBe(false)
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
