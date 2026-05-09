# openclaw-amem

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![arXiv](https://img.shields.io/badge/arXiv-2502.12110-b31b1b.svg)](https://arxiv.org/abs/2502.12110)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-blue)](https://github.com/openclaw/openclaw)

**A-MEM agentic memory backend for [OpenClaw](https://github.com/openclaw/openclaw)**

An OpenClaw plugin that integrates the [A-MEM](https://arxiv.org/abs/2502.12110) (Agentic Memory) system — dynamic memory organization with automatic **link generation** and **memory evolution**, backed by ChromaDB + SentenceTransformer + LLM.

> **Note:** This project is an OpenClaw integration of the A-MEM system. For the original research implementation and paper reproduction, see [agiresearch/A-MEM](https://github.com/agiresearch/A-MEM).

---

## Key Features ✨

- 🔄 **Dynamic memory organization** based on Zettelkasten principles
- 🔗 **Automatic link generation** — new memories are linked to related existing ones via embedding similarity + LLM judgment
- 🧬 **Memory evolution** — existing memories update their context, tags, and embeddings when new related memories arrive
- 🔍 **Hybrid retrieval** — BM25 + vector search with RRF fusion
- 🤖 **OpenClaw native** — registers as `memory_search` / `memory_add` tools, works with `plugins.slots.memory`
- 🏠 **Local-first** — ChromaDB + SentenceTransformer, no external vector DB required

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
     ├── memory_search(query)  ──►  amem-plugin (OpenClaw plugin)
     └── memory_add(text)      ──►       │
                                         ▼
                                  amem_client.py
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼               ▼
                      ChromaDB    SentenceTransformer   LLM (Anthropic)
                    (vector store)   (embeddings)    (note construction
                                                      + link judgment
                                                      + evolution)
```

---

## Requirements

- Python 3.10+
- conda (miniforge recommended)
- An Anthropic API key (or compatible proxy)

---

## Installation

### 1. Create conda environment

```bash
conda create -n amem python=3.10 -y
conda activate amem
pip install anthropic chromadb sentence-transformers rank-bm25
```

### 2. Place `amem_client.py`

```bash
mkdir -p ~/.amem
cp amem_client.py ~/.amem/
```

### 3. Configure environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *(required)* | Anthropic API key |
| `ANTHROPIC_BASE_URL` | *(Anthropic official)* | Custom base URL (e.g. local proxy) |
| `AMEM_LLM_MODEL` | `claude-opus-4-5` | LLM model for note construction & linking |
| `AMEM_DB_PATH` | `~/.amem/db/` | ChromaDB storage path |

Example:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
export AMEM_DB_PATH=~/.amem/db/
```

### 4. Test

```bash
conda activate amem
python ~/.amem/amem_client.py add "Hello, this is my first memory."
python ~/.amem/amem_client.py search "first memory"
python ~/.amem/amem_client.py list
```

Expected output for `add`:
```
[add] Constructing note...
  keywords: ['first memory', 'hello', ...]
  tags: ['general']
  context: A greeting note marking the first memory entry.
  saved note xxxxxxxx-...
[done] Note added: xxxxxxxx-...
```

---

## OpenClaw Plugin Installation

### 1. Copy plugin

```bash
cp -r amem-plugin ~/.openclaw/extensions/
```

### 2. Configure `~/.openclaw/openclaw.json`

```json
{
  "plugins": {
    "allow": ["amem-plugin"],
    "entries": {
      "amem-plugin": {
        "enabled": true,
        "config": {
          "amemScript": "/Users/you/.amem/amem_client.py",
          "condaEnv": "amem",
          "condaBase": "/opt/homebrew/Caskroom/miniforge/base",
          "userId": "your-username",
          "anthropicApiKey": "sk-ant-...",
          "dbPath": "/Users/you/.amem/db/"
        }
      }
    },
    "slots": {
      "memory": "amem-plugin"
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
| `amemScript` | `~/.amem/amem_client.py` | Path to `amem_client.py` |
| `condaEnv` | `amem` | conda environment name |
| `condaBase` | auto-detected | conda base directory |
| `userId` | `default` | User namespace for memories |
| `anthropicApiKey` | `$ANTHROPIC_API_KEY` | API key override |
| `anthropicBaseUrl` | `$ANTHROPIC_BASE_URL` | Base URL override |
| `llmModel` | `$AMEM_LLM_MODEL` | Model override |
| `dbPath` | `$AMEM_DB_PATH` | DB path override |

---

## Usage

Once installed, the agent gains two tools:

### `memory_search`
Search long-term memories using hybrid retrieval (BM25 + vector + RRF).

```
memory_search(query="MetaSmith project status", limit=5)
```

### `memory_add`
Write a new memory. Automatically triggers link generation and memory evolution.

```
memory_add(text="Decided to use ChromaDB for the vector store due to local-first requirements.")
```

---

## How Memory Evolution Works 🧬

When a new memory is added:

1. **Note Construction** — LLM generates keywords, tags, and a context summary
2. **Embedding** — SentenceTransformer encodes the enriched note
3. **Link Generation** — Top-K candidates (cosine sim > 0.3) are evaluated by LLM; meaningful ones are linked bidirectionally
4. **Memory Evolution** — Up to 3 linked existing notes have their context/tags/embeddings updated to reflect the new relationship

This mirrors the A-MEM paper's core contribution: memories are not static entries but a living, self-organizing network.

---

## Acknowledgements

This project implements the A-MEM architecture proposed in:

> Wujiang Xu et al. _A-MEM: Agentic Memory for LLM Agents_. arXiv:2502.12110, 2025.

Original research repository: [agiresearch/A-MEM](https://github.com/agiresearch/A-MEM)

---

## License

MIT
