# Changelog

## 1.2.1

### Patch Changes

- [#51](https://github.com/heichaowo/amem/pull/51) [`79075a6`](https://github.com/heichaowo/amem/commit/79075a6f45c97bddce4ee3b3757558b7586f50b6) Thanks [@heichaowo](https://github.com/heichaowo)! - Declare the OpenAI-provider capability surface in the plugin manifest. `0.3.0`
  added an OpenAI-compatible LLM path (reading `AMEM_LLM_PROVIDER` and
  `OPENAI_API_KEY`, and able to reach `api.openai.com` or any compatible gateway),
  but `openclaw.plugin.json` still only declared the Anthropic surface. The two new
  env vars and an `openai` endpoint class are now declared, so the manifest matches
  what the code actually does — and ClawHub's scan can adjudicate the bundled
  `openai` SDK's env/network access against a declared capability instead of
  holding the release.

- [#53](https://github.com/heichaowo/amem/pull/53) [`51dca27`](https://github.com/heichaowo/amem/commit/51dca272bd28a32b3388e697566bb48bae2d35e4) Thanks [@heichaowo](https://github.com/heichaowo)! - Document the multi-provider LLM support prominently. The OpenAI-compatible
  provider was only described in the configuration reference and the README's
  security section; the plugin README's Requirements line and the docs
  getting-started page still framed the LLM as Anthropic-only. Both now point at
  a dedicated **LLM provider** section covering `AMEM_LLM_PROVIDER=anthropic|openai`
  and the OpenAI-compatible endpoints (OpenAI, DeepSeek, OpenRouter, Groq, Together,
  Ollama, vLLM, LM Studio).

## 1.2.0

### Minor Changes

- [#45](https://github.com/heichaowo/amem/pull/45) [`398a59c`](https://github.com/heichaowo/amem/commit/398a59c9d6a2a931aadfa0db2e60baef4b6453ce) Thanks [@heichaowo](https://github.com/heichaowo)! - Add an OpenAI-compatible LLM provider. Set `AMEM_LLM_PROVIDER=openai` to route
  note construction, CRUD decisions, link judgment and memory evolution through the
  Chat Completions API instead of the Anthropic Messages API, with
  `AMEM_LLM_BASE_URL` pointing at any OpenAI-compatible endpoint — OpenAI, DeepSeek,
  OpenRouter, Groq, Together, or a local server (Ollama, vLLM, LM Studio). The
  default stays `anthropic`, so existing setups are unchanged.

  Reasoning models (`o1`, `o3`, `gpt-5`) are handled automatically, and keyless
  local servers work without an API key. In the plugin, the `openai` SDK is a
  runtime dependency kept out of the bundle, so the download size is unchanged for
  everyone on the default path.

### Patch Changes

- [#50](https://github.com/heichaowo/amem/pull/50) [`d07f16c`](https://github.com/heichaowo/amem/commit/d07f16c8f5766902ff29890a60c25c7e0a359363) Thanks [@heichaowo](https://github.com/heichaowo)! - Fix three issues in the OpenAI-compatible provider, found in pre-release review:

  - **`OPENAI_API_KEY` was ignored.** The client always passed an explicit key, so
    the SDK never read the standard `OPENAI_API_KEY` — a user who set it (but not
    `AMEM_LLM_API_KEY`) got 401 on every call. It now falls back to
    `OPENAI_API_KEY`, then to the keyless-local placeholder.
  - **`deepseek-reasoner` sent the wrong token parameter.** A broad
    `includes('reason')` match classified it as an OpenAI reasoning model and sent
    `max_completion_tokens`, which DeepSeek's API does not accept. Reasoning
    detection is now scoped to OpenAI's own `o*`/`gpt-5` names.
  - **`AMEM_LLM_PROVIDER` with surrounding whitespace** (e.g. `"openai "` from a
    `.env` file) silently routed to the Anthropic path. The value is now trimmed,
    and an unrecognised value logs a warning instead of failing invisibly.

## 1.1.5

### Patch Changes

- [#28](https://github.com/heichaowo/amem/pull/28) [`c8464be`](https://github.com/heichaowo/amem/commit/c8464bed94e86abf28d6969619e08156dcbdb43d) Thanks [@heichaowo](https://github.com/heichaowo)! - Security: the `memory_quality_scan` tool now treats its `outputPath` as a bare
  filename written under the review directory, instead of a full path it writes
  verbatim. `generateReviewBatch` previously used a caller-supplied `outputPath`
  directly, so a prompt-injected agent could pass an absolute path or a `../`
  traversal and overwrite an arbitrary file the process could write (CodeQL
  `js/path-injection`). An `outputPath` that carries any directory component is
  now rejected; a bare filename lands under `AMEM_REVIEW_DIR` (default: the
  current working directory). Set `AMEM_REVIEW_DIR` to choose the directory.

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
