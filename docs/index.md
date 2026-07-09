---
layout: home

hero:
  name: openclaw-amem
  text: Agentic Memory for OpenClaw
  tagline: Memories evolve, not just accumulate — dynamic graph linking, hybrid retrieval, and LLM-driven evolution. Local embeddings, no Python required.
  image:
    src: /logo.webp
    alt: A-MEM Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/heichaowo/amem
    - theme: alt
      text: npm
      link: https://www.npmjs.com/package/openclaw-amem

features:
  - icon: 🔄
    title: Dynamic Memory Network
    details: Inspired by Zettelkasten. Memories are stored as nodes in a graph with automatic bidirectional link generation and LLM-verified connections — not flat vector rows.
  - icon: 🧬
    title: Memory Evolution & Consolidation
    details: Linked memories evolve context, tags, and embeddings when new details arrive. Same-day semantic duplicates (≥ 0.80 similarity) are auto-merged, and daily consolidation at 02:30 keeps the graph clean.
  - icon: 🚦
    title: LLM CRUD Gate & Quality Controls
    details: Hooked into agent_end to run NEW / UPDATE / DELETE / NONE decisions on every conversation. A write-time quality gate rejects low-quality content; memory_quality_scan surfaces stale or conflicting entries.
  - icon: 🔍
    title: Hybrid Retrieval & Heat Tracking
    details: BM25 + dense vector hybrid (RRF) with 2-hop BFS graph expansion. Frequently retrieved memories get a logarithmic heat boost dampened by time decay, so fresh facts stay on top.
  - icon: 🧠
    title: Knowledge vs Episodic
    details: Notes are auto-classified as memory (episodic) or knowledge (durable). Knowledge notes carry topic tags and skip consolidation merging and time-decay penalties.
  - icon: 🀄
    title: Chinese-Optimized BM25
    details: Uses Jieba (via @node-rs/jieba) for CJK word segmentation, dramatically improving recall for Chinese queries. English and mixed text fall back to whitespace tokenization automatically.
  - icon: 🔐
    title: Per-Agent Memory Isolation
    details: Each agent operates in its own private namespace — memories written by main are invisible to dev by default. An explicit shared scope plus owner/readers/writers fields on every note control cross-agent access.
---

## Install in 30 seconds

::: code-group

```bash [ClawHub]
openclaw plugins install clawhub:openclaw-amem
```

```bash [npm]
openclaw plugins install openclaw-amem
```

:::

Point OpenClaw's `memory` slot at `openclaw-amem` and your agent remembers across sessions — linking, evolving, and consolidating on its own. → **[Full installation guide](/guide/installation)**

## The amem stack

`openclaw-amem` is one package in the **amem** monorepo — a memory stack you can adopt piece by piece.

| Package | What it is | Where |
| --- | --- | --- |
| **openclaw-amem** | The OpenClaw memory-slot plugin — the subject of this documentation. | [npm](https://www.npmjs.com/package/openclaw-amem) · ClawHub |
| **amem-core** | Framework-agnostic **A-MEM engine** — note construction, evolution, hybrid retrieval. Qdrant + Transformers.js. | bundled into the plugin |
| **amem-api** | Single-writer memory **service** (HTTP + MCP) so many processes share one store. | *coming soon* |

## Grounded in research

openclaw-amem implements **[A-MEM: Agentic Memory](https://arxiv.org/abs/2502.12110)** (NeurIPS 2025) — memory that constructs, links, and evolves notes like a Zettelkasten instead of dumping flat vector rows. Embeddings run locally via Transformers.js (384-dim) and are stored in Qdrant. **No Python, no external embedding API.** MIT-licensed.

<div class="tip custom-block" style="padding-top: 8px">

In a hurry? Jump straight to the **[Quick Start](/guide/quick-start)**.

</div>
