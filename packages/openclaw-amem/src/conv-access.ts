/**
 * conv-access.ts — deterministic check for the agent_end conversation-access hook.
 *
 * The plugin's agent_end hook (automatic memory write-back) fires only when
 * `plugins.entries.<id>.hooks.allowConversationAccess` is true in openclaw.json.
 * Without it, OpenClaw silently drops the hook, so nothing is written back.
 *
 * That flag lives in the FULL config (`api.config`), NOT in `api.pluginConfig`
 * (which carries only the sibling `config` block). Reading it at startup tells us
 * for certain whether write-back is on — replacing the old 10-minute "did the hook
 * ever fire?" timer, which was an arbitrary heuristic that also mis-fired on an idle
 * gateway that had simply had no conversation.
 *
 * Dependency-free so it can be unit-tested without the heavy embedding / storage /
 * LLM modules pulled in by index.ts.
 */

/** Logged once at startup when write-back is off. */
export const BLOCKED_WARNING_LOG =
  'openclaw-amem: ⚠️  automatic memory write-back is OFF — the agent_end hook is blocked by ' +
  "OpenClaw's security policy, so conversations are NOT being saved to long-term memory. Enable it: " +
  'set plugins.entries.openclaw-amem.hooks.allowConversationAccess=true in openclaw.json, then restart the gateway.'

/** Appended to memory_search results so the assistant relays it to the user. */
export const BLOCKED_WARNING_SUFFIX =
  '\n\n⚠️ NOTE TO ASSISTANT — please tell the user: openclaw-amem automatic memory write-back is ' +
  'currently DISABLED, so nothing from this conversation is being saved to long-term memory. To fix it, add ' +
  '`plugins.entries.openclaw-amem.hooks.allowConversationAccess: true` to openclaw.json and restart the gateway.'

interface ConfigShape {
  plugins?: {
    entries?: Record<string, { hooks?: { allowConversationAccess?: boolean } } | undefined>
  }
}

/**
 * True when the agent_end hook is blocked: our plugin entry is readable in the config
 * AND its `hooks.allowConversationAccess` is not explicitly true. Returns false when the
 * config — or our entry within it — can't be read: we warn only on a positive read of a
 * blocked flag, never on uncertainty, so a config we can't see never triggers a false alarm.
 */
export function isConvAccessBlocked(config: unknown, pluginId: string): boolean {
  const entry = (config as ConfigShape | undefined)?.plugins?.entries?.[pluginId]
  return entry !== undefined && entry.hooks?.allowConversationAccess !== true
}
