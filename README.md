# openclaw-amem

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![arXiv](https://img.shields.io/badge/arXiv-2502.12110-b31b1b.svg)](https://arxiv.org/abs/2502.12110)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-blue)](https://github.com/openclaw/openclaw)
[![CI Workflow](https://github.com/heichaowo/openclaw-amem/actions/workflows/ci.yml/badge.svg)](https://github.com/heichaowo/openclaw-amem/actions)

**A-MEM agentic memory backend for [OpenClaw](https://github.com/openclaw/openclaw)**

An OpenClaw plugin that integrates the **A-MEM** (Agentic Memory) system — featuring dynamic memory networks, automatic **link generation**, **memory evolution**, and **in-process consolidation**, backed by Qdrant + local Transformers.js + LLM. **No Python required.**

> **Note:** This project is a production-ready OpenClaw plugin integration of the A-MEM system. For the original research implementation and paper reproduction, see [agiresearch/A-MEM](https://github.com/agiresearch/A-MEM).

---

## Key Features ✨

*   🔄 **Dynamic Memory Network** — Inspired by Zettelkasten. Memories are stored as nodes in a graph, not just flat vector rows.
*   🔗 **Automatic Link Generation** — New memories automatically link bidirectionally to existing related memories via embedding similarity + LLM verification.
*   🧬 **Memory Evolution & Strengthening** (Stories 13-B, 13-D) — Linked memories update context/tags/embeddings when new details arrive. Added `strengthen` action allowing memories to actively request link enforcement and tag propagation.
*   🚦 **LLM CRUD Decision Gate** (Story 11) — Hooked into OpenClaw's `agent_end` dialog termination. Analyses user-assistant dialogue context, running `NEW` / `UPDATE` / `DELETE` / `NONE` decisions to keep memory clean.
*   🧹 **Same-Day Semantic Merger** (Story 12) — Automatically merge semantic duplicates written during the same day ($\ge 0.80$).
*   📅 **In-Process Daily Consolidation** (Story 16) — Endogenous in-process `setTimeout` scheduler running at 02:30 AM. Groups notes by `category`, merges semantic duplicates ($\ge 0.75$) into clean unified knowledge notes, and **cascades all link references** automatically to preserve graph topology.
*   ⏳ **Temporal Invalidation & Soft-Delete** (Story 15) — Outdated/conflicting memories are marked `is_active: false` (soft-deleted) and excluded from searches using zero-migration Qdrant filters.
*   🔥 **Retrieval Heat Tracking** (Story 13-A) — Incorporates `retrieval_count` and `last_accessed` timestamps in hybrid scoring:
    $$\text{Final Score} = \text{RRF Score} \times (1 + 0.05 \times \ln(1 + \text{retrieval\_count}))$$
*   🛡️ **Strict Quality Controls** (Story 17) — Full Vitest test coverage for embeddings (mocked), storage, and link-cascading consolidation, integrated into ESLint + Prettier + import boundary CI checks running on GitHub Actions.

---

## What is A-MEM?

A-MEM is an advanced memory architecture for LLM agents inspired by the Zettelkasten method. Unlike traditional flat vector databases, A-MEM maintains memory as a living, self-evolving semantic graph:

1.  **Note Construction** — On write, LLM extracts keywords, tags, a context summary, and categorizes the note (Technical, Business, Personal, Project, Research, System, General).
2.  **Link Generation** — Retrieves top-6 candidates; LLM judges whether to link bidirectionally (similarity $> 0.3$).
3.  **Memory Evolution & Strengthening** — Up to 3 linked memories have their attributes evolved based on the new context, potentially triggering additional links.
4.  **Hybrid Retrieval** — Fuses vector search (Transformers.js ONNX local `multilingual-e5-small`) and BM25 using Reciprocal Rank Fusion (RRF), boosted by retrieval frequency (heat).

Academic Paper: _A-MEM: Agentic Memory for LLM Agents_ — [arXiv:2502.12110](https://arxiv.org/abs/2502.12110) (NeurIPS 2025)

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
                    (vector store)  (ONNX embed)   (CRUD decision
                      :6333        384-dim local    + link judgment
                   agent_id ISO                    + evolution)
```

---

## Requirements

*   OpenClaw v2026.4+
*   Node.js 18+ (Node 24/26 fully supported)
*   Qdrant running on `:6333`
*   Anthropic-compatible LLM proxy on `:8080` (uses `claude-sonnet-4-6` or compatible)

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

Add `openclaw-amem` to your allowed plugins and hook it into the `memory` slot:

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

---

## Plugin Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `agentId` | `"main"` | Agent namespace for memory isolation |
| `topK` | `5` | Maximum memories to retrieve during search |

---

## Usage & Tools

Once installed, the plugin exposes the following capabilities:

### `memory_add`
Writes a new memory. Automatically evaluates exact-hash duplicate checks, runs LLM note construction, generates bidirectional links, and evaluates memory evolution.

```js
memory_add(text="vendor profile")
```

### `memory_search`
Searches long-term memories using fused RRF (BM25 + Cosine similarity) with heat-based ranking.

```js
memory_search(query="database configuration", limit=5)
```

### `memory_list`
Returns the total active note count for the current agent namespace.

### `memory_consolidate`
Exposes the memory consolidation tool to manually trigger category-based semantic deduplication and link cascading.

---

## Development & Test

We maintain a strict code quality pipeline including linting, code formatting, path audits, and Vitest test suites.

```bash
npm install
npm run build              # Compile TS files to dist/
npm run lint               # Lint code using ESLint (Flat Config)
npm run format             # Check code formatting via Prettier
npm run check:boundaries   # Run custom import boundary & absolute path auditor
npm run test               # Run Vitest unit & integration tests
npm run check              # Run entire validation suite (format + lint + boundaries + test)
```

---

## Citation & Reference

If you use this memory system in your research, please cite the original A-MEM paper:

```bibtex
@inproceedings{xu2025amem,
  title={A-Mem: Agentic Memory for LLM Agents},
  author={Xu, Wujiang and Liang, Zujie and Mei, Kai and Gao, Hang and Tan, Juntao and Zhang, Yongfeng},
  booktitle={Advances in Neural Information Processing Systems (NeurIPS)},
  year={2025}
}
```

Original research repository: [agiresearch/A-MEM](https://github.com/agiresearch/A-MEM)

---

## License

MIT
