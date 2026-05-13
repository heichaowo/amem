# openclaw-amem

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![arXiv](https://img.shields.io/badge/arXiv-2502.12110-b31b1b.svg)](https://arxiv.org/abs/2502.12110)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-blue)](https://github.com/openclaw/openclaw)

**A-MEM agentic memory backend for [OpenClaw](https://github.com/openclaw/openclaw)**

An OpenClaw plugin that integrates the [A-MEM](https://arxiv.org/abs/2502.12110) (Agentic Memory) system — dynamic memory organization with automatic **link generation** and **memory evolution**, backed by Qdrant + Transformers.js + LLM. **No Python or conda required.**

> **Note:** This project is an OpenClaw integration of the A-MEM system. For the original research implementation and paper reproduction, see [agiresearch/A-MEM](https://github.com/agiresearch/A-MEM).

---

## Key Features ✨

- 🔄 **Dynamic memory organization** based on Zettelkasten principles
- 🔗 **Automatic link generation** — new memories are linked to related existing ones via embedding similarity + LLM judgment
- 🧬 **Memory evolution** — existing memories update their context, tags, and embeddings when new related memories arrive
- 🔍 **Hybrid retrieval** — BM25 + vector search with RRF fusion
- 🤖 **OpenClaw native** — registers as `memory_search` / `memory_add` tools, works with `plugins.slots.memory`
- 🏠 **Local-first, no Python** — Qdrant + Transformers.js ONNX, pure TypeScript in-process

---

## What is A-MEM?

A-MEM is a memory system for LLM agents inspired by the Zettelkasten method. Unlike flat vector stores, A-MEM treats memories as a living, self-organizing network:

1. **Note Construction** — LLM generates keywords, tags, and a context summary on write
2. **Link Generation** — Top-K candidates (cosine sim > 0.3) are evaluated by LLM; meaningful ones are linked bidirectionally
3. **Memory Evolution** — Up to 3 linked existing notes have their context/tags/embeddings updated to reflect the new relationship
4. **Hybrid Retrieval** — BM25 + vector search fused with RRF for robust recall

Paper: _A-MEM: Agentic Memory for LLM Agents_ — [arXiv:2502.12110](https://arxiv.org/abs/2502.12110)

---

## Architecture

```
OpenClaw Agent
     │
     ├── memory_search(query)  ──►  openclaw-amem plugin (TypeScript, in-process)
     └── memory_add(text)      ──►       │
                                         ▼
                          ┌──────────────┼──────────────┐
                          ▼              ▼               ▼
                       Qdrant     Transformers.js    LLM (Anthropic)
                    (vector store)  (ONNX embed)   (note construction
                      :6333        384-dim local    + link judgment
                   agent_id ISO                    + evolution)
```

---

## Requirements

- OpenClaw v2026.4+
- Node.js 18+
- Qdrant running on `:6333`
- Anthropic-compatible LLM proxy on `:8080`

---

## Installation

### 1. Install the plugin

```bash
# From local checkout
openclaw plugins install --link ./openclaw-amem

# From git
openclaw plugins install git:github.com/heichaowo/openclaw-amem
```

### 2. Configure `~/.openclaw/openclaw.json`

```json
{
  "plugins": {
    "allow": ["openclaw-amem"],
    "entries": {
      "openclaw-amem": {
        "enabled": true,
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

### 3. Restart OpenClaw

```bash
openclaw gateway restart
```

### Plugin config reference

| Key | Default | Description |
|-----|---------|-------------|
| `agentId` | `"main"` | Agent namespace for memory isolation |
| `topK` | `5` | Maximum memories to retrieve |

---

## Usage

Once installed, the agent gains three tools:

### `memory_add`
Write a new memory. Automatically triggers note construction, link generation, and memory evolution.

```
memory_add(text="Decided to use Qdrant for vector storage with agent_id namespace isolation.")
```

### `memory_search`
Search long-term memories using hybrid retrieval (BM25 + vector + RRF).

```
memory_search(query="vector store decision", limit=5)
```

### `memory_list`
Return total memory count.

---

## How Memory Evolution Works 🧬

When a new memory is added:

1. **Note Construction** — LLM generates keywords, tags, and a context summary
2. **Embedding** — Transformers.js encodes the enriched note (384-dim, ONNX local)
3. **Link Generation** — Top-K candidates (cosine sim > 0.3) are evaluated by LLM; meaningful ones are linked bidirectionally
4. **Memory Evolution** — Up to 3 linked existing notes have their context/tags/embeddings updated to reflect the new relationship

This mirrors the A-MEM paper's core contribution: memories are not static entries but a living, self-organizing network.

---

## Multi-Agent Isolation

Each agent writes to its own namespace via `agent_id`. Memories tagged `"shared"` are visible to all agents.

```
Qdrant collection: amem_notes
  agent_id = "main"        ← main agent memories
  agent_id = "subagent-x"  ← subagent memories
  agent_id = "shared"      ← visible to all agents
```

---

## Migration from v0.1.x (ChromaDB → Qdrant)

If you have existing memories in ChromaDB (`~/.openclaw/amem_db/`):

```bash
# Requires a Python environment with chromadb installed
pip install chromadb
python scripts/migrate-chroma-to-qdrant.py
```

---

## Development

```bash
npm install
npm run build   # outputs dist/index.js
npm run dev     # watch mode
```

---

## Acknowledgements

This project implements the A-MEM architecture proposed in:

> Wujiang Xu et al. _A-MEM: Agentic Memory for LLM Agents_. arXiv:2502.12110, 2025.

Original research repository: [agiresearch/A-MEM](https://github.com/agiresearch/A-MEM)

---

## License

MIT
