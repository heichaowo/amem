/**
 * Hook-liveness signal (Story 34 fix, v1.0.1).
 *
 * The plugin can be re-registered many times within ONE gateway process (config
 * hot-reload), leaving multiple coexisting `register()` instances. A per-instance
 * boolean is unreliable: agent_end may fire on a NEW instance while a STALE
 * instance's memory_search reads its OWN `false`, emitting a false-positive
 * "hook never fired" warning once that stale instance passes 10 min of uptime.
 *
 * We anchor the signal on globalThis so every instance — and even a fresh module
 * re-evaluation — shares ONE source of truth. This kills the false positive while
 * preserving the true positive: when the hook is genuinely blocked, NO instance
 * ever marks it fired, so the warning still surfaces after the delay.
 *
 * Kept dependency-free so it can be unit-tested without loading the heavy
 * embedding / storage / LLM modules pulled in by index.ts.
 */

const HOOK_STATE_KEY = Symbol.for('openclaw-amem.hookLiveness')

export const HOOK_WARN_DELAY_MS = 10 * 60 * 1000
export const HOOK_WARNING_TEXT =
  '\n\n⚠️ Warning: agent_end hook has never fired. Automatic memory write-back may be disabled. ' +
  'Set plugins.entries.openclaw-amem.hooks.allowConversationAccess=true in openclaw.json.'

export interface HookLiveness {
  everFired: boolean
  lastFiredAt: number
  firstSeenAt: number
  /**
   * Set once the plugin has seen real agent activity (a memory tool ran, i.e. a
   * conversation is happening). Without this, an idle gateway — restarted and
   * left untouched for 10 min — would warn that agent_end "never fired" even
   * though nothing ever should have fired it. agent_end is only expected once a
   * conversation actually occurs.
   */
  sawActivity: boolean
}

/** Get (lazily seeding) the process-wide, reload-stable liveness record. */
export function hookLiveness(now: number = Date.now()): HookLiveness {
  const g = globalThis as unknown as Record<symbol, HookLiveness | undefined>
  let s = g[HOOK_STATE_KEY]
  if (!s) {
    s = { everFired: false, lastFiredAt: 0, firstSeenAt: now, sawActivity: false }
    g[HOOK_STATE_KEY] = s
  }
  return s
}

/** Record that the agent_end hook fired (process-wide, reload-stable). */
export function markHookFired(now: number = Date.now()): void {
  const s = hookLiveness(now)
  s.everFired = true
  s.lastFiredAt = now
}

/** Record real agent activity — a conversation is happening, so agent_end is due. */
export function markActivity(now: number = Date.now()): void {
  hookLiveness(now).sawActivity = true
}

/**
 * True when agent_end is genuinely blocked: there has been real activity, the
 * hook has never fired on ANY instance in this process, and the process has been
 * up longer than the delay. Requiring activity is what stops an idle gateway from
 * warning about a hook that simply had nothing to fire it.
 */
export function hookLikelyBlocked(now: number = Date.now()): boolean {
  const s = hookLiveness(now)
  return !s.everFired && s.sawActivity && now - s.firstSeenAt > HOOK_WARN_DELAY_MS
}

/** The warning suffix to append to memory_search output, or '' when healthy. */
export function hookNeverFiredWarning(now: number = Date.now()): string {
  return hookLikelyBlocked(now) ? HOOK_WARNING_TEXT : ''
}

/** Test-only: clear the process-wide signal (and optionally re-seed firstSeenAt). */
export function __resetHookLiveness(now?: number): void {
  ;(globalThis as unknown as Record<symbol, HookLiveness | undefined>)[HOOK_STATE_KEY] = undefined
  if (now !== undefined) hookLiveness(now)
}
