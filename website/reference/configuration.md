# Configuration

## Plugin config (`openclaw.json`)

```json
{
  "plugins": {
    "entries": {
      "openclaw-amem": {
        "enabled": true,
        "config": {
          "agentId": "main",
          "topK": 5
        }
      }
    }
  }
}
```

### Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `agentId` | `string` | `"main"` | Agent namespace for memory isolation. Notes from different agents are stored separately in Qdrant. |
| `topK` | `number` | `5` | Maximum memories returned by `memory_search`. |
| `agents` | `Record<string, {agentId?, collection?}>` | `{}` | Per-agent overrides. Set `collection` for Mode B physical isolation. |
| `hooks.allowConversationAccess` | `boolean` | `false` | Required for `agent_end` hook access. Set under `plugins.entries.openclaw-amem.hooks`, not under `config`. Without this, automatic memory write-back is silently blocked by OpenClaw. |

### Per-agent configuration (`agents`)

Each agent can override its `agentId` and optionally use a dedicated Qdrant collection (Mode B physical isolation):

```json
{
  "plugins": {
    "entries": {
      "openclaw-amem": {
        "enabled": true,
        "config": {
          "agentId": "main",
          "topK": 5,
          "agents": {
            "dev": {
              "agentId": "dev"
            }
          }
        }
      }
    }
  }
}
```

For full physical isolation (Mode B), add a `collection` field:

```json
"agents": {
  "dev": {
    "agentId": "dev",
    "collection": "amem_notes_dev"
  }
}
```

See [Agent Isolation](/guide/agent-isolation) for a full explanation of Mode A vs Mode B.

## Environment variables

These environment variables override plugin defaults at runtime. Useful for testing or scripting without modifying config files.

| Variable | Default | Description |
|----------|---------|-------------|
| `AMEM_LLM_MODEL` | `claude-sonnet-4-6` | LLM model used for note construction, CRUD decisions, link judgment, and memory evolution. Set to a Gemini model when running smoke tests to avoid consuming Claude quota. |
| `AMEM_COLLECTION` | `amem_notes` | Qdrant collection name. Override to use a separate collection for testing. |

### Example: run smoke test with Gemini

```bash
AMEM_LLM_MODEL=gemini-3.5-flash-low node run_smoketest.mjs
```

## LLM requirements

The plugin requires an **Anthropic-compatible LLM proxy** on `http://127.0.0.1:8080` with API key `YOUR_API_KEY` (configurable via source).

Any model that follows the Anthropic Messages API is supported. Recommended:

| Use case | Model |
|----------|-------|
| Production | `claude-sonnet-4-6` |
| Testing / smoke | `gemini-3.5-flash-low` |

## Qdrant collection schema

The plugin auto-creates the Qdrant collection on first run with:

- **Vector size**: 384 (multilingual-e5-small)
- **Distance**: Cosine
- **Payload fields**: `id`, `content`, `keywords`, `tags`, `context`, `category`, `links`, `retrieval_count`, `last_accessed`, `is_active`, `agent_id`, `created_at`, `updated_at`, `owner`, `readers`, `writers`
