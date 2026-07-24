/**
 * Story 41 — the CRUD UPDATE write-safety rule. Synthetic vectors only.
 *
 * The rule exists because an in-range but WRONG index passes every structural
 * check and overwrites an unrelated memory irreversibly.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { isPlausibleUpdateTarget, resolveCrudUpdateMinSim, DEFAULT_CRUD_UPDATE_MIN_SIM } from '../../src/crud-guard.js'

/** L2-normalized 2-D vector at the given angle — cosine == cos(angle difference). */
const at = (rad: number): number[] => [Math.cos(rad), Math.sin(rad)]

const SAME = at(0)
const NEAR = at(0.6) // cos ≈ 0.825 — a rephrase/correction of the same fact
const FAR = at(Math.PI / 2) // cos = 0 — an unrelated memory (the mis-target case)
const OPPOSITE = at(Math.PI) // cos = -1

afterEach(() => vi.unstubAllEnvs())

describe('isPlausibleUpdateTarget', () => {
  it('accepts an update whose replacement is the same fact', () => {
    expect(isPlausibleUpdateTarget(SAME, SAME)).toBe(true)
  })

  it('accepts a related rephrase or correction', () => {
    // "drinks tea" → "switched to coffee": related, not identical. Must not be
    // rejected, or real corrections would be downgraded to duplicates.
    expect(isPlausibleUpdateTarget(NEAR, SAME)).toBe(true)
  })

  it('rejects an unrelated target — the mis-picked index', () => {
    expect(isPlausibleUpdateTarget(FAR, SAME)).toBe(false)
  })

  it('rejects an opposed target', () => {
    expect(isPlausibleUpdateTarget(OPPOSITE, SAME)).toBe(false)
  })

  it('honours an explicit stricter threshold', () => {
    // Same pair, stricter bar → now refused. This is the cheap-model knob.
    expect(isPlausibleUpdateTarget(NEAR, SAME)).toBe(true)
    expect(isPlausibleUpdateTarget(NEAR, SAME, 0.9)).toBe(false)
  })

  it('refuses on a missing or malformed vector rather than waving it through', () => {
    expect(isPlausibleUpdateTarget([], SAME)).toBe(false)
    expect(isPlausibleUpdateTarget(SAME, [])).toBe(false)
    expect(isPlausibleUpdateTarget([1, 0, 0], SAME)).toBe(false) // dimension mismatch
  })
})

describe('resolveCrudUpdateMinSim precedence', () => {
  it('defaults when nothing is set', () => {
    expect(resolveCrudUpdateMinSim()).toBe(DEFAULT_CRUD_UPDATE_MIN_SIM)
  })

  it('uses an explicit override', () => {
    expect(resolveCrudUpdateMinSim(0.7)).toBe(0.7)
  })

  it('lets the env var win over the override', () => {
    vi.stubEnv('AMEM_CRUD_UPDATE_MIN_SIM', '0.9')
    expect(resolveCrudUpdateMinSim(0.4)).toBe(0.9)
  })

  it('ignores a non-numeric env var', () => {
    vi.stubEnv('AMEM_CRUD_UPDATE_MIN_SIM', 'not-a-number')
    expect(resolveCrudUpdateMinSim()).toBe(DEFAULT_CRUD_UPDATE_MIN_SIM)
  })

  it('allows 0 to disable the guard deliberately', () => {
    vi.stubEnv('AMEM_CRUD_UPDATE_MIN_SIM', '0')
    expect(resolveCrudUpdateMinSim()).toBe(0)
    expect(isPlausibleUpdateTarget(FAR, SAME)).toBe(true)
  })
})
