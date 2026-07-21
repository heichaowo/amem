import { describe, it, expect } from 'vitest'
import { isConvAccessBlocked } from '../../src/conv-access.js'

const ID = 'openclaw-amem'
// Build a minimal openclaw.json-shaped config for our plugin entry.
const cfg = (hooks?: { allowConversationAccess?: boolean }) => ({
  plugins: { entries: { [ID]: hooks === undefined ? {} : { hooks } } },
})

describe('isConvAccessBlocked', () => {
  it('is blocked when the hooks flag is absent', () => {
    expect(isConvAccessBlocked(cfg(), ID)).toBe(true)
  })

  it('is blocked when the flag is explicitly false', () => {
    expect(isConvAccessBlocked(cfg({ allowConversationAccess: false }), ID)).toBe(true)
  })

  it('is allowed when the flag is explicitly true', () => {
    expect(isConvAccessBlocked(cfg({ allowConversationAccess: true }), ID)).toBe(false)
  })

  it('does NOT warn when the config cannot be read (no false alarm on uncertainty)', () => {
    expect(isConvAccessBlocked(undefined, ID)).toBe(false)
    expect(isConvAccessBlocked({}, ID)).toBe(false)
    expect(isConvAccessBlocked({ plugins: {} }, ID)).toBe(false)
    expect(isConvAccessBlocked({ plugins: { entries: {} } }, ID)).toBe(false)
  })

  it('does NOT warn when our entry is not found under this id', () => {
    expect(isConvAccessBlocked(cfg({ allowConversationAccess: false }), 'a-different-plugin')).toBe(false)
  })
})
