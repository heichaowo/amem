# Changelog

## 1.1.0

### Minor Changes

- f0ec301: Repackage as the `amem` pnpm monorepo and extract the memory engine into `amem-core` (bundled into the plugin, so there is no install or runtime change for users). New baseline `1.1.0` following the ClawHub 1.0.x line.

## v1.0.1

### Fixed

- **False-positive "agent_end hook has never fired" warning.** The hook-liveness
  signal (`hookEverFired` / plugin start time) was per-`register()`-call closure
  state. On a config hot-reload the gateway re-runs `register()` in the same
  process, leaving multiple coexisting plugin instances. `agent_end` would fire
  on a newer instance (marking _its_ flag), while a `memory_search` handler bound
  to a _stale_ instance read _its own_ `false` flag — appending the warning to
  results even though the hook was firing and memories were being written.

  The signal is now anchored on `globalThis` (`src/hook-liveness.ts`), shared by
  every instance and stable across hot-reloads and module re-evaluation. The
  genuine true-positive is preserved: when the hook is actually blocked
  (`allowConversationAccess` unset/false, or never registered anywhere), no
  instance marks it fired and the warning still surfaces after the 10-minute
  delay. Tool output shape and the warning text are unchanged.
