# Installation

## Requirements

| Dependency  | Version                                                        |
| ----------- | -------------------------------------------------------------- |
| OpenClaw    | v2026.4+                                                       |
| Node.js     | 18+ (Node 24/26 fully supported)                               |
| Qdrant      | Running on `:6333`                                             |
| LLM access  | `ANTHROPIC_API_KEY` (default), or any OpenAI-compatible provider — see [LLM provider](#llm-provider) |

Qdrant can be started via Docker:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

---

## Install the plugin

```bash
# From npm (recommended)
openclaw plugins install openclaw-amem

# From a local checkout of the amem monorepo
pnpm --filter openclaw-amem build
openclaw plugins install --link ./packages/openclaw-amem
```

---

## Configure `openclaw.json`

Add `openclaw-amem` to your plugin config and hook it into the `memory` slot:

```json
{
  "plugins": {
    "allow": ["openclaw-amem"],
    "entries": {
      "openclaw-amem": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true
        },
        "config": {
          "agentId": "main",
          "topK": 5
        }
      }
    },
    "slots": {
      "memory": "openclaw-amem"
    }
  }
}
```

::: warning Memory slot conflict
If your `openclaw.json` already has a `memory` slot assigned to another plugin (e.g. `memory-core`), **you must replace it** with `openclaw-amem`. The gateway only loads one plugin per slot — a second `memory`-kind plugin is **silently skipped** with no log output.

```json
// ❌ Will cause amem to be silently ignored
"slots": {
  "memory": "memory-core"
}

// ✅ Correct — amem replaces memory-core
"slots": {
  "memory": "openclaw-amem"
}
```

If you were previously using `memory-core`, you can safely remove or disable it in `plugins.entries`:

```json
"entries": {
  "memory-core": { "enabled": false },
  "openclaw-amem": {
    "enabled": true,
    "hooks": { "allowConversationAccess": true },
    "config": { "agentId": "main", "topK": 5 }
  }
}
```

:::

> **Required:** `hooks.allowConversationAccess: true` must be set explicitly. Without it, the `agent_end` hook is blocked by OpenClaw's security policy and **automatic memory write-back will not work** — memories will only be written when you call `memory_add` manually.

> If `allowConversationAccess` is not set, the plugin will log a warning after 10 minutes of startup and append a notice to every `memory_search` result indicating that write-back is disabled (Story 34).

---

## Restart OpenClaw

```bash
openclaw gateway restart
```

On first run, the plugin downloads the `multilingual-e5-small` ONNX embedding model (~120MB) and caches it locally. Subsequent restarts are instant.

---

## LLM provider

The engine calls an LLM for note construction, linking, and evolution. Choose the backend with `AMEM_LLM_PROVIDER`:

- **`anthropic`** (default) — the Anthropic Messages API. Set `ANTHROPIC_API_KEY`.
- **`openai`** — the OpenAI Chat Completions API, which every OpenAI-compatible endpoint speaks. Set `AMEM_LLM_PROVIDER=openai`, point `AMEM_LLM_BASE_URL` at the endpoint, and set `AMEM_LLM_API_KEY` (or the standard `OPENAI_API_KEY`). This covers **OpenAI, DeepSeek, OpenRouter, Groq, Together**, and local servers (**Ollama, vLLM, LM Studio** — no key needed).

```bash
# DeepSeek
AMEM_LLM_PROVIDER=openai AMEM_LLM_BASE_URL=https://api.deepseek.com/v1 \
AMEM_LLM_API_KEY=sk-... AMEM_LLM_MODEL=deepseek-chat

# Local Ollama (keyless)
AMEM_LLM_PROVIDER=openai AMEM_LLM_BASE_URL=http://localhost:11434/v1 \
AMEM_LLM_MODEL=qwen2.5
```

Full env-var reference and model recommendations: **[Configuration →](/reference/configuration)**.
