# openclaw-amem

<p align="center">
  <img src="https://raw.githubusercontent.com/heichaowo/openclaw-amem/main/website/public/logo.webp" width="120" alt="A-MEM Logo" />
</p>

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
*   🧬 **Memory Evolution & Strengthening** — Linked memories update context/tags/embeddings when new details arrive. Supports active link strengthening and tag propagation.
*   🚦 **LLM CRUD Decision Gate** — Hooked into OpenClaw's `agent_end` dialog termination. Analyses user-assistant dialogue context, running `NEW` / `UPDATE` / `DELETE` / `NONE` decisions to keep memory clean.
*   🧹 **Same-Day Semantic Merger** — Automatically merge semantic duplicates written during the same day (≥ 0.80 cosine similarity).
*   📅 **In-Process Daily Consolidation** — Endogenous in-process `setTimeout` scheduler running at 02:30 AM. Groups notes by `category`, merges semantic duplicates (≥ 0.75) into clean unified knowledge notes, and **cascades all link references** automatically to preserve graph topology.
*   ⏳ **Temporal Invalidation & Soft-Delete** — Outdated/conflicting memories are marked `is_active: false` (soft-deleted) and excluded from searches using zero-migration Qdrant filters.
*   🔥 **Retrieval Heat Tracking with Time Decay** — Incorporates `retrieval_count` and `last_accessed` timestamps in hybrid scoring. Frequently retrieved memories receive a logarithmic heat boost, dampened by elapsed time since last access so stale memories do not permanently outrank fresh ones:

```
Final Score = RRF Score × (1 + 0.05 × ln(1 + retrieval_count) / (age_days + 1))
```

  A note last accessed 60 days ago with 10 retrievals gets boost ≈ 1.002; the same note accessed today gets ≈ 1.060.

*   🔍 **2-hop Graph Traversal with Relevance Gate** — After vector retrieval, BFS walks the link graph up to 2 hops from each anchor result. Only nodes passing an embedding relevance gate (cosine similarity ≥ 0.25 against the query) are admitted, preventing noise from distant graph neighborhoods.
*   🀄 **Chinese-Optimized BM25** — The BM25 pipeline uses [Jieba](https://github.com/fxsjy/jieba) (via `@node-rs/jieba`) for CJK word segmentation instead of character-level splitting, dramatically improving recall for Chinese queries. English and mixed-language text fall back to whitespace tokenization automatically.
*   🛡️ **Strict Quality Controls** — Full Vitest test coverage for embeddings, storage, link-cascading consolidation, tokenization, and BFS gate behavior, integrated into ESLint + Prettier + import boundary CI checks running on GitHub Actions.

---

## Why A-MEM? (vs Traditional RAG) 🎯

| Dimension | Traditional RAG | A-MEM (Zettelkasten Graph) |
| :--- | :--- | :--- |
| **Retrieval Mode** | Single-vector similarity | **BM25 + Dense Vector Hybrid (RRF) + 2-hop Graph Expansion** |
| **Chinese Recall** | Character-level n-gram / single char split | **Jieba word segmentation for accurate CJK BM25 indexing** |
| **Fact Evolution** | Static chunking — cannot update historical entries | **Dynamic Attribute Evolution & Connection Strengthening** |
| **Temporal Conflicts** | Recalls contradictory facts simultaneously | **`is_active` soft-invalidation** shields outdated facts |
| **Memory Bloat** | Fragmented memories stack up infinitely | **Daily Consolidation** merges semantic duplicates |
| **Stale Memory Suppression** | High-retrieval old memories permanently outrank fresh ones | **Time-decayed heat boost** — age dampens retrieval_count influence |
| **Graph Noise** | N/A | **BFS Relevance Gate** filters low-similarity linked nodes |

---

## What is A-MEM?

A-MEM is an advanced memory architecture for LLM agents inspired by the Zettelkasten method. Unlike traditional flat vector databases, A-MEM maintains memory as a living, self-evolving semantic graph:

1.  **Note Construction** — On write, LLM extracts keywords, tags, a context summary, and categorizes the note (Technical, Business, Personal, Project, Research, System, General).
2.  **Link Generation** — Retrieves top-6 candidates; LLM judges whether to link bidirectionally (similarity > 0.3).
3.  **Memory Evolution & Strengthening** — Up to 3 linked memories have their attributes evolved based on the new context, potentially triggering additional links.
4.  **Hybrid Retrieval** — Fuses vector search (Transformers.js ONNX local `paraphrase-multilingual-MiniLM-L12-v2`, 384-dim) and BM25 using Reciprocal Rank Fusion (RRF), boosted by retrieval frequency (heat).
5.  **2-hop BFS Graph Expansion** — After RRF top-K selection, BFS traverses the link graph up to 2 hops, appending up to 8 contextually linked notes that may be semantically distant but graph-connected. Each candidate passes an embedding relevance gate (cos-sim ≥ 0.25) before admission. This is the key architectural advantage over flat vector memory systems like mem0.

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
                   agent_id ISO   + Jieba BM25     + evolution)
```

---

## Smoke Test Results

Internal regression test suite (`amem-smoketest`) — 25 QA pairs across 5 categories, evaluated 2026-06-05:

| Metric | Value |
| :--- | :--- |
| **Average Score** | **4.56 / 5.0** |
| **Hit@1** | **64.0%** |
| **Hit@3** | **76.0%** |
| **MRR** | **0.693** |

| Category | Avg Score | Notes |
| :--- | :--- | :--- |
| fact | 5.00 / 5.0 | — |
| temporal | 5.00 / 5.0 | — |
| bfs | 5.00 / 5.0 | — |
| multihop | 4.20 / 5.0 | — |
| semantic | 3.60 / 5.0 | Active improvement area (Story 21 Chinese BM25) |

**BFS ablation** (10 questions, bfs + multihop categories):

| | BFS OFF | BFS ON | Delta |
|:---|:---:|:---:|:---:|
| Average Score | 3.00 | 5.00 | **+2.00** |
| bfs category | 2.00 | 5.00 | **+3.00** |
| multihop category | 4.00 | 5.00 | **+1.00** |

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
Searches long-term memories using fused RRF (BM25 + Cosine similarity) with heat-based ranking and 2-hop BFS graph expansion.

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

Test coverage includes:

| Test File | What It Covers |
|-----------|----------------|
| `test/embedding.test.ts` | ONNX embedding shape & cosine similarity |
| `test/storage.test.ts` | Qdrant note add / soft-delete (live integration) |
| `test/memory.test.ts` | Consolidation & cascading link updates |
| `test/tokenize.test.ts` | Jieba Chinese segmentation, mixed-language, edge cases |
| `test/bfs-gate.test.ts` | BFS relevance gate: filter / admit / disable |
| `test/heat-decay.test.ts` | Time-decay heat boost: fresh > stale ranking, decay magnitude |

---

## References & Prior Work

This plugin implements and extends the following prior work:

| Reference | Role |
|-----------|------|
| Xu et al., _A-MEM: Agentic Memory for LLM Agents_, NeurIPS 2025 · [arXiv:2502.12110](https://arxiv.org/abs/2502.12110) | Core architecture: note construction, link generation, memory evolution, RRF hybrid retrieval |
| Robertson & Zaragoza, _The Probabilistic Relevance Framework: BM25 and Beyond_, 2009 | BM25 ranking formula (k1=1.5, b=0.75) used in hybrid retrieval |
| Weller et al., _On the Theoretical Limitations of Embedding-Based Retrieval_, arXiv:2508.21038, 2025 | Motivation for BM25 hybrid: single-vector models cannot scale to combinatorial query complexity |
| Sun et al., _E5: Text Embeddings by Weakly Supervised Contrastive Pre-training_, arXiv:2212.03533, 2022 | Embedding model family reference for multilingual retrieval quality benchmarks |
| Sun et al., _Jieba Chinese Text Segmentation_ · [github.com/fxsjy/jieba](https://github.com/fxsjy/jieba) | Chinese word segmentation for BM25 (via `@node-rs/jieba`, Rust port) |
| Cormack et al., _Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods_, SIGIR 2009 | RRF fusion formula used to merge BM25 and dense vector ranked lists |

---

## Citation

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
