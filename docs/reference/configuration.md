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
| `AMEM_LLM_PROVIDER` | `anthropic` | Request format for LLM calls. `anthropic` uses the native Messages API; `openai` uses the Chat Completions API, which every OpenAI-compatible endpoint speaks (OpenAI, DeepSeek, OpenRouter, Groq, Together, Ollama, vLLM, LM Studio…). |
| `AMEM_LLM_MODEL` | `claude-sonnet-4-6` (anthropic) · `gpt-4o-mini` (openai) | LLM model used for note construction, CRUD decisions, link judgment, and memory evolution. Set to a cheaper model when running smoke tests to avoid consuming production quota. |
| `AMEM_LLM_BASE_URL` | provider default | Override the SDK base URL. Point it at your OpenAI-compatible gateway (with `AMEM_LLM_PROVIDER=openai`) or an Anthropic proxy. |
| `AMEM_LLM_API_KEY` | provider env | Override the API key. If unset, the Anthropic path falls back to `ANTHROPIC_API_KEY` and the OpenAI path to `OPENAI_API_KEY`; if neither is set, the OpenAI path sends a placeholder so keyless local servers (Ollama, vLLM) work. |
| `AMEM_COLLECTION` | `amem_notes` | Qdrant collection name. Override to use a separate collection for testing. |
| `AMEM_REVIEW_DIR` | `process.cwd()` | Output directory for quality review batch files. |
| `AMEM_EVO_COUNTER_PATH` | `~/.openclaw/amem_evo_cnt.json` | File path for the evolution throttle counter. |
| `AMEM_PROMPT_LOCALE` | `en` | Prompt language for memory CRUD, merge, and evolution functions. Set to `zh` for Chinese prompts (better for Chinese-primary users). |

> `AMEM_DATA_DIR` (the engine's on-disk location for the evolution counter and consolidation logs) is read by the engine but **fixed to `~/.openclaw` by the plugin**, so setting it has no effect when running as the OpenClaw plugin — it applies only when using [`@heichaowo/amem-core`](https://www.npmjs.com/package/@heichaowo/amem-core) directly.

### Example: run smoke test with Gemini

```bash
AMEM_LLM_MODEL=gemini-3.5-flash-low node run_smoketest.mjs
```

## LLM requirements

By default the engine uses the **Anthropic SDK** against `https://api.anthropic.com`. Set `ANTHROPIC_API_KEY` (or `AMEM_LLM_API_KEY`) to authenticate, and `AMEM_LLM_BASE_URL` to point at an Anthropic-compatible proxy.

To use an **OpenAI-compatible** provider instead, set `AMEM_LLM_PROVIDER=openai` and point `AMEM_LLM_BASE_URL` at its endpoint. This covers OpenAI, DeepSeek, OpenRouter, Groq, Together, and local servers (Ollama, vLLM, LM Studio). Reasoning models (`o1`, `o3`, `gpt-5`) are handled automatically.

```bash
# Example: DeepSeek
AMEM_LLM_PROVIDER=openai \
AMEM_LLM_BASE_URL=https://api.deepseek.com/v1 \
AMEM_LLM_API_KEY=sk-... \
AMEM_LLM_MODEL=deepseek-chat node run_smoketest.mjs

# Example: local Ollama (no key needed)
AMEM_LLM_PROVIDER=openai \
AMEM_LLM_BASE_URL=http://localhost:11434/v1 \
AMEM_LLM_MODEL=qwen2.5 node run_smoketest.mjs
```

Recommended models:

| Use case | Model |
|----------|-------|
| Production (Anthropic) | `claude-sonnet-4-6` |
| Production (OpenAI-compatible) | `gpt-4o-mini`, `deepseek-chat` |
| Testing / smoke | `gemini-3.5-flash-low` |

## Qdrant collection schema

The plugin auto-creates the Qdrant collection on first run with:

- **Vector size**: 384 (multilingual-e5-small)
- **Distance**: Cosine
- **Payload fields**: `id`, `content`, `keywords`, `tags`, `context`, `category`, `links`, `retrieval_count`, `last_accessed`, `is_active`, `agent_id`, `created_at`, `updated_at`, `owner`, `readers`, `writers`
