# openclaw-amem

<p align="center">
  <img src="https://raw.githubusercontent.com/heichaowo/openclaw-amem/main/website/public/logo.webp" width="120" alt="A-MEM Logo" />
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![npm](https://img.shields.io/npm/v/openclaw-amem?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/openclaw-amem)
[![arXiv](https://img.shields.io/badge/arXiv-2502.12110-b31b1b?style=for-the-badge)](https://arxiv.org/abs/2502.12110)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-blue?style=for-the-badge)](https://github.com/openclaw/openclaw)
[![CI](https://img.shields.io/github/actions/workflow/status/heichaowo/openclaw-amem/ci.yml?style=for-the-badge&logo=github-actions&logoColor=white&label=CI)](https://github.com/heichaowo/openclaw-amem/actions)

**A-MEM agentic memory backend for [OpenClaw](https://github.com/openclaw/openclaw)**

⭐ **If you find this useful, [star us on GitHub](https://github.com/heichaowo/openclaw-amem)!**

The first open-source A-MEM memory plugin for [OpenClaw](https://github.com/openclaw/openclaw) — memories **evolve**, not just accumulate. Dynamic graph linking, hybrid retrieval, and LLM-driven evolution judgment. Backed by Qdrant + local Transformers.js + LLM. **No Python required.**

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
*   🧠 **Knowledge Type Classification** — Notes are automatically classified as `memory` (episodic, time-sensitive) or `knowledge` (durable reference, timeless) by LLM. Knowledge notes are excluded from Daily Consolidation merging and time-decay heat penalties, ensuring durable facts remain reliably retrievable regardless of age.
*   🏷️ **Topic Tags for Knowledge Notes** — `knowledge`-type notes carry a `topics: string[]` field (1-5 concise subject labels, e.g. `["TypeScript", "Qdrant"]`). The `memory_search` tool accepts a `topicsFilter` parameter (AND semantics, case-insensitive) for precise knowledge retrieval by subject.
*   🛡️ **Strict Quality Controls** — Full Vitest test coverage for embeddings, storage, link-cascading consolidation, tokenization, and BFS gate behavior, integrated into ESLint + Prettier + import boundary CI checks running on GitHub Actions.
*   📊 **Quality Scoring & Auto-Review** — Write-time quality gate rejects content under 10 characters and marks temporal/ephemeral content (containing signal words like '待跑', '等确认'). The `memory_quality_scan` tool scans the full memory store, identifies low-quality entries (too short, expired ephemeral >7 days, unresolved conflicts), and generates Obsidian-compatible review batch files for human curation.
*   🔐 **Per-Agent Memory Isolation** — Each agent operates in its own private memory namespace. Memories written by `main` are invisible to `dev` by default. A `shared` scope lets the writing agent publish memories readable by all agents, with explicit `owner`/`readers`/`writers` access fields on every note. Two modes: Mode A (shared Qdrant collection, filtered by `agent_id`) and Mode B (dedicated collection per agent, full physical isolation).
*   🔔 **Hook Self-Check** — If the `agent_end` hook has never fired within 10 minutes of startup (likely blocked by OpenClaw's security policy), the plugin logs a warning and appends a visible notice to every `memory_search` result so you know automatic write-back is disabled.

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
| **Knowledge vs. Episodic** | All memories treated equally | **`note_type` field** separates durable knowledge from episodic events; knowledge notes skip consolidation merge and time-decay |
| **Topic-Based Recall** | Only similarity-based | **`topics` tags + `topicsFilter`** enables precise subject-level knowledge retrieval |

---

## What is A-MEM?

A-MEM is an advanced memory architecture for LLM agents inspired by the Zettelkasten method. Unlike traditional flat vector databases, A-MEM maintains memory as a living, self-evolving semantic graph:

1.  **Note Construction** — On write, LLM extracts keywords, tags, a context summary, categorizes the note (Technical, Business, Personal, Project, Research, System, General), classifies it as `memory` (episodic) or `knowledge` (durable), and for knowledge notes extracts 1-5 `topics` subject tags.
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

## Evolution Mechanism (Story 30)

When new memories are borderline-similar to existing ones (cosine similarity 0.72–0.85), A-MEM marks them `pending_merge` and routes them through an **LLM-driven evolution judgment** instead of simple deduplication. The LLM classifies the relationship between the old and new memory into one of four paths:

| Type | Meaning | Action |
|------|---------|--------|
| **EVOLVE** | New info deepens/updates the old memory (e.g. "wants to buy Model 3" → "decided on standard RWD Model 3") | Old note content updated, `evolution_history` appended, new note absorbed |
| **CONFLICT** | Old and new info contradict each other (e.g. "lives in Riverstone" vs "moved to Eastholm") | Both notes kept, both marked `conflict: true` |
| **EXPAND** | New info complements the old memory (e.g. "has a sister" + "sister works in education in Northvale") | Content merged into old note, `evolution_history` appended, new note absorbed |
| **NEW** | Unrelated information, no real connection | Both notes kept as-is |

This is the key differentiator from mem0-style flat memory systems: memories **evolve** rather than being silently overwritten. The `evolution_history` field provides a full audit trail of how each memory changed over time.

---

## Quality Scoring & Auto-Review (Story 31)

A-MEM enforces quality at both **write time** and **periodic scan**:

### Write-Time Quality Gate

Every `memory_add` call passes through `checkQuality()` before any LLM or embedding work:

- **Content < 10 characters** → write rejected, error returned
- **Contains temporal signal words** (`待跑`, `等确认`, `昨日`, `明天完成`) → written with `ephemeral: true` flag

### Periodic Quality Scan

The `memory_quality_scan` tool scans the entire memory store and identifies:

| Reason | Condition |
|--------|-----------|
| `too_short` | Content < 10 characters (legacy notes that predate the gate) |
| `expired_ephemeral` | `ephemeral=true` and written > 7 days ago |
| `pending_conflict` | `conflict=true` (contradictory evolution detected) |

Flagged notes are patched with `low_quality: true` in Qdrant.

---

## Agent Isolation (Story 32)

Each OpenClaw agent gets its own private memory namespace. Memories written by `main` are not visible to `dev` or other agents by default.

### Mode A — Shared Collection (default)

All agents share one Qdrant collection (`amem_notes`), isolated by `agent_id` filter at query time:

| Scope | `agent_id` in Qdrant | `readers` | Visible to |
|-------|---------------------|-----------|------------|
| Private (default) | `"main"` | `["main"]` | Only the writing agent |
| Shared | `"shared"` | `["*"]` | All agents |

### Mode B — Dedicated Collection

Each agent gets a physically isolated Qdrant collection:

```json
"agents": {
  "dev": {
    "agentId": "dev",
    "collection": "amem_notes_dev"
  }
}
```

In Mode B, `dev` reads and writes only `amem_notes_dev`. Shared notes written by `main` are not visible to `dev` (no cross-collection sharing).

### Access fields on every note

Every `MemoryNote` carries three access fields:

```ts
{
  owner:   "main",      // the agent that wrote this note
  readers: ["main"],    // ["*"] = all agents; ["main"] = private
  writers: ["main"]     // writers enforcement: Story 33
}
```

### Design rationale

amem uses an **explicit** `agent_id="shared"` marker rather than mem0's implicit null-scoping (omitting `agent_id` to indicate shared access). Per [arXiv:2604.16548], isolation should be the default; sharing is an explicit, auditable exception. amem's approach makes shared notes immediately identifiable in the database.

Consolidation runs per-agent scope: `dev`'s consolidation never touches `main`'s private notes or shared notes.

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
# From npm (recommended)
openclaw plugins install openclaw-amem

# From git
openclaw plugins install git:github.com/heichaowo/openclaw-amem

# From local checkout
openclaw plugins install --link ./openclaw-amem
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

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `agentId` | `string` | `"main"` | Agent namespace for memory isolation |
| `topK` | `number` | `5` | Maximum memories to retrieve during search |
| `agents` | `Record<string, {agentId?, collection?}>` | `{}` | Per-agent overrides. Set `collection` for Mode B physical isolation. |
| `hooks.allowConversationAccess` | `boolean` | `false` | **Required** for automatic memory write-back. Must be set explicitly in `plugins.entries.openclaw-amem.hooks`; without it, the `agent_end` hook is silently blocked by OpenClaw's security policy. |

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

### `memory_quality_scan`
Scans all memories for quality issues (content < 10 chars, expired ephemeral notes > 7 days, unresolved conflicts) and generates an Obsidian-compatible review batch markdown file.

```js
memory_quality_scan()                    // auto-generates batch file in Obsidian vault
memory_quality_scan(outputPath="/tmp/review.md")  // custom output path
```

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
| `test/quality-test.ts` | Quality gate: short text rejection, ephemeral marking, scan identification |
| `test/evolution-test.ts` | Evolution mechanism: EVOLVE/CONFLICT/EXPAND/NEW paths (standalone) |
| `test/agent-isolation.test.ts` | Story 32: per-agent private/shared isolation, cross-agent consolidation safety, shared note field correctness |

> **Note:** Story 34 has no new test file (self-check logic is timing-based, not unit-testable in isolation)

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
| Chhikara et al., _Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory_, ECAI 2025 · [arXiv:2504.19413](https://arxiv.org/abs/2504.19413) | Multi-dimensional scope isolation (user_id/agent_id/run_id/app_id); amem's explicit shared marker vs mem0's implicit null-scoping |
| _Multi-Agent Memory from a Computer Architecture Perspective_, arXiv:2603.10062, 2026 | Private/shared/distributed memory hierarchy; access protocol design |
| _Security of Long-Term Memory in LLM Agents_, arXiv:2604.16548, 2026 | Isolation-by-default principle; explicit sharing as exception |
| Kerestecioglu et al., _Human-Inspired Memory Architecture for LLM Agents_, arXiv:2605.08538, Microsoft, 2026 | Sleep-phase consolidation design |
| _Governing Evolving Memory in LLM Agents: SSGM Framework_, arXiv:2603.11768, 2026 | Memory evolution taxonomy (EVOLVE/CONFLICT/EXPAND/NEW) |
| _Graph-based Agent Memory: Taxonomy, Techniques, and Applications_, arXiv:2602.05665, 2026 | Conflict detection in graph memory updates |
| _Memory in the LLM Era_, arXiv:2604.01707, 2026 | Memory operations taxonomy |

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
