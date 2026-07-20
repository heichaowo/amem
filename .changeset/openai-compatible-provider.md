---
'@heichaowo/amem-core': minor
'openclaw-amem': minor
---

Add an OpenAI-compatible LLM provider. Set `AMEM_LLM_PROVIDER=openai` to route
note construction, CRUD decisions, link judgment and memory evolution through the
Chat Completions API instead of the Anthropic Messages API, with
`AMEM_LLM_BASE_URL` pointing at any OpenAI-compatible endpoint — OpenAI, DeepSeek,
OpenRouter, Groq, Together, or a local server (Ollama, vLLM, LM Studio). The
default stays `anthropic`, so existing setups are unchanged.

Reasoning models (`o1`, `o3`, `gpt-5`) are handled automatically, and keyless
local servers work without an API key. In the plugin, the `openai` SDK is a
runtime dependency kept out of the bundle, so the download size is unchanged for
everyone on the default path.
