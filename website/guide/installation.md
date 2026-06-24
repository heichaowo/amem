# Installation

## Requirements

| Dependency | Version |
|-----------|---------|
| OpenClaw | v2026.4+ |
| Node.js | 18+ (Node 24/26 fully supported) |
| Qdrant | Running on `:6333` |
| LLM Endpoint | Anthropic-compatible (set `AMEM_LLM_BASE_URL`) |

Qdrant can be started via Docker:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

---

## Install the plugin

```bash
# From npm (recommended)
openclaw plugins install openclaw-amem

# From git
openclaw plugins install git:github.com/heichaowo/openclaw-amem

# From local checkout
openclaw plugins install --link ./openclaw-amem
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

> **Required:** `hooks.allowConversationAccess: true` must be set explicitly. Without it, the `agent_end` hook is blocked by OpenClaw's security policy and **automatic memory write-back will not work** — memories will only be written when you call `memory_add` manually.

> If `allowConversationAccess` is not set, the plugin will log a warning after 10 minutes of startup and append a notice to every `memory_search` result indicating that write-back is disabled (Story 34).

---

## Restart OpenClaw

```bash
openclaw gateway restart
```

On first run, the plugin downloads the `multilingual-e5-small` ONNX embedding model (~120MB) and caches it locally. Subsequent restarts are instant.
