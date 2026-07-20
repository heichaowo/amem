---
'@heichaowo/amem-core': patch
'openclaw-amem': patch
---

Fix three issues in the OpenAI-compatible provider, found in pre-release review:

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
