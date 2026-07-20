# @heichaowo/amem-core

## 0.3.0

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

## 0.2.0

### Minor Changes

- [`f48a266`](https://github.com/heichaowo/amem/commit/f48a266f85ed5f346c2acd3534f64f02f9f83b6a) Thanks [@heichaowo](https://github.com/heichaowo)! - First public release of the **amem** engine. Install it directly — `npm i @heichaowo/amem-core` —
  to build memory on top of the A-MEM engine: notes that construct, link, and
  evolve like a Zettelkasten, over Qdrant + local Transformers.js embeddings, with
  hybrid (BM25 + dense) retrieval and graph expansion. No Python.

  The public API is deliberate: memory operations (`addMemory`, `addEpisodic`,
  `searchMemory`, `consolidateMemories`, `scanLowQuality`, …), the storage context,
  the embedding-model lifecycle, and the domain types. Being `0.x`, the surface may
  still shift.
