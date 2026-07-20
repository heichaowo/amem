---
'openclaw-amem': patch
---

Document the multi-provider LLM support prominently. The OpenAI-compatible
provider was only described in the configuration reference and the README's
security section; the plugin README's Requirements line and the docs
getting-started page still framed the LLM as Anthropic-only. Both now point at
a dedicated **LLM provider** section covering `AMEM_LLM_PROVIDER=anthropic|openai`
and the OpenAI-compatible endpoints (OpenAI, DeepSeek, OpenRouter, Groq, Together,
Ollama, vLLM, LM Studio).
