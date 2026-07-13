# Changelog

## 1.1.4

### Patch Changes

- [#25](https://github.com/heichaowo/amem/pull/25) [`ec149d9`](https://github.com/heichaowo/amem/commit/ec149d9c3ad07f4af7c6e3028f2739df98b20121) Thanks [@heichaowo](https://github.com/heichaowo)! - Fix a phantom `amem-core@0.1.0` dependency that broke installation from ClawHub.

  The engine is bundled into the plugin's `dist` by tsup, but `amem-core` was
  still declared as a `workspace:*` devDependency. On publish, pnpm rewrote that
  to `amem-core@0.1.0` — a private package that does not exist on npm. ClawHub
  extracts the tarball and runs a full `npm install`, which then 404s on it, so
  the plugin could not be installed at all.

  The engine is now resolved by a build alias to its source (see
  `tsup.config.ts`) instead of a package dependency, so it stays inlined in the
  bundle while no longer appearing anywhere in the published manifest.

- [`7967915`](https://github.com/heichaowo/amem/commit/7967915de59855a7993adab4e43e10203617e500) - Refresh the package description shown on npm and ClawHub — replace the stale "TypeScript rewrite" wording with a description of what the plugin actually does: an OpenClaw memory plugin implementing A-MEM, with evolving memory, graph linking, and hybrid retrieval.

## 1.1.3

### Patch Changes

- [`310ea62`](https://github.com/heichaowo/amem/commit/310ea62962c88c2ec471f9879329af845b461af6) - Fix the broken logo image in the README as shown on npm and ClawHub — serve it from `raw.githubusercontent.com` instead of the `amem.owo.lc` GitHub Pages custom domain, which did not render reliably on the registry pages.

## 1.1.2

### Patch Changes

- [`e300c80`](https://github.com/heichaowo/amem/commit/e300c803c11074e2d0d09516f734bac7306e43e9) - Declare the plugin's capabilities in `openclaw.plugin.json`: the eight `AMEM_*` environment variables it reads (`setup.providers[].envVars`) and its network endpoints (`providerEndpoints` — local Qdrant plus the LLM API). This is ClawHub's designed disclosure signal that the plugin's env + network access is intentional and purpose-aligned, addressing the advisory `suspicious.env_credential_access` audit finding (a heuristic false positive endemic to every configurable memory/LLM plugin). Also adds a **Security & data flow** section to the README documenting exactly what the plugin reads and where it sends memory data.

## 1.1.1

### Patch Changes

- 4422cd7: Keep `@anthropic-ai/sdk` and `uuid` external instead of inlining them into `dist` — they are already declared as dependencies and installed at runtime. This cuts the published bundle from ~252 KB to ~92 KB and stops registry static scanners from flagging the vendored SDK's env-reading helper (a false positive). Also adds the `license` field and a canonical `git+` repository URL to the manifest.

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
