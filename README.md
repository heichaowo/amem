# openclaw-amem

A-MEM agentic memory backend for OpenClaw — TypeScript native, no Python required.

Implements the [A-MEM](https://github.com/agiresearch/A-mem) paper: note construction, bidirectional link generation, and memory evolution via LLM.

## Architecture

```
OpenClaw → openclaw-amem plugin (TypeScript, in-process)
              ↓
         @huggingface/transformers  — local ONNX embedding (384-dim)
         Qdrant (:6333)             — vector store with agent_id isolation
         @anthropic-ai/sdk          — LLM via LLM proxy (:8080)
```

## Features

- **Note construction**: LLM extracts keywords, tags, and context summary on write
- **Link generation**: semantic similarity + LLM judgment for bidirectional linking
- **Memory evolution**: linked notes re-synthesize context when new notes arrive
- **Hybrid retrieval**: BM25 + embedding + RRF fusion for search
- **Multi-agent isolation**: `agent_id` namespace per agent, shared memory support

## Requirements

- OpenClaw v2026.4+
- Qdrant running on `:6333`
- Anthropic-compatible LLM proxy on `:8080`
- Node.js 18+

## Installation

```bash
# From local checkout
openclaw plugins install --link ./openclaw-amem

# From git
openclaw plugins install git:github.com/heichaowo/openclaw-amem
```

Restart the gateway after install:

```bash
openclaw gateway restart
```

## Configuration

In `openclaw.json`:

```json
{
  "plugins": {
    "slots": { "memory": "openclaw-amem" },
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

## Tools

| Tool | Description |
|------|-------------|
| `memory_add` | Write a note through the full A-MEM pipeline |
| `memory_search` | BM25 + embedding + RRF hybrid search |
| `memory_list` | Return total memory count |

## Migration from ChromaDB

If you have existing memories in ChromaDB (`~/.openclaw/amem_db/`):

```bash
# Requires conda amem env with chromadb installed
conda activate amem
python scripts/migrate-chroma-to-qdrant.py
```

## Development

```bash
npm install
npm run build   # outputs dist/index.js
npm run dev     # watch mode
```

## License

MIT
