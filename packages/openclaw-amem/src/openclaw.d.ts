/**
 * Ambient types for the OpenClaw host SDK.
 *
 * `openclaw` is supplied by the host runtime when the plugin is loaded. It is
 * deliberately not a dependency — tsup keeps it external (see tsup.config.ts),
 * so nothing installs it and `tsc` has no declarations to resolve.
 *
 * Declaring the single symbol the plugin imports lets `typecheck` cover our own
 * source without pulling the OpenClaw CLI (200+ transitive packages, and build
 * scripts that would need allowlisting in pnpm-workspace.yaml) into the
 * workspace just to resolve one import.
 *
 * The cost: `register` is not checked against the host's real `OpenClawPluginApi`.
 * `register` in src/index.ts annotates its own `api` parameter, so its body is
 * still fully typed; only the plugin/host boundary goes unchecked. `api` is
 * `any` rather than `unknown` because a narrower callback parameter is not
 * assignable to an `unknown` one under strictFunctionTypes.
 */
declare module 'openclaw/plugin-sdk/plugin-entry' {
  export interface PluginEntry {
    id: string
    name: string
    description: string
    register: (api: any) => void
  }

  export function definePluginEntry(entry: PluginEntry): PluginEntry
}
