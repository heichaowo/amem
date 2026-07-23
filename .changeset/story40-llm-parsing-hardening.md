---
'@heichaowo/amem-core': patch
'openclaw-amem': patch
---

Harden LLM response parsing and add a request timeout (Story 40, mem0 取经).

Three robustness fixes for the engine's LLM layer, all in `llm.ts`, prompted by
reading how mem0 handles the same problems:

- **Strip reasoning scaffolding before JSON.parse.** The engine accepts any
  OpenAI-compatible `baseURL`, so it can be pointed at reasoning/open-weight
  models (DeepSeek-R1, Qwen, LLaMA-3 via Ollama/vLLM) that wrap their output in
  `<think>…</think>` blocks and chat special tokens (`<|eot_id|>`, `<|im_end|>`,
  …). Those broke `JSON.parse`, and every JSON task silently fell back to its
  blank default on an otherwise-valid response — with nothing in the logs to say
  why. `stripReasoning()` now removes them first, in `stripFences` (covering the
  five object-JSON tasks) and on the CRUD array path. This was a latent silent
  degradation, not just a nicety.

- **Tolerate a preamble before the JSON object.** `parseJsonLoose()` replaces the
  four direct `JSON.parse(stripFences(raw))` calls: on a parse failure it retries
  against the first `{…}` region, recovering the common "Sure! Here is the JSON:"
  preamble smaller models emit. It still throws when nothing parses, so every
  caller's existing try/catch → safe-default path is unchanged. The CRUD path
  already did array extraction and is untouched.

- **Configurable client timeout.** The SDK clients were built with no timeout, so
  a slow or stuck endpoint (loaded vLLM, unreachable gateway) could hang the whole
  `addMemory` pipeline indefinitely. New `AMEM_LLM_TIMEOUT` env var (default
  30000 ms) and `LlmConfig.timeoutMs`, threaded into both client constructors.

No behaviour change for a well-formed response from a normal model. New tests
drive the real note-construction and CRUD functions with mocked SDKs; the
reasoning-strip and preamble-recovery tests were verified to fail against mutated
source (a no-op `stripReasoning`, a dropped brace fallback), so they are not
vacuous.

Deliberately NOT changed, after comparing with mem0: the CRUD integer-index
referencing (amem's JS `undefined` + `if (target)` guard is already safer than
mem0's unguarded index), the three-layer dedup (stronger than mem0 v3's single
hash pass), and retry/fallback-on-error (mem0 has none either — a real runtime
fallback is designed separately, with Story 39).
