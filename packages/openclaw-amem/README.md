# openclaw-amem

<p align="center">
  <img src="https://amem.owo.lc/logo.webp" width="120" alt="A-MEM Logo" />
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/openclaw-amem?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/openclaw-amem)
[![arXiv](https://img.shields.io/badge/arXiv-2502.12110-b31b1b?style=for-the-badge)](https://arxiv.org/abs/2502.12110)

**A-MEM agentic memory backend for [OpenClaw](https://github.com/openclaw/openclaw)** — memories **evolve**, not just accumulate.

The first open-source A-MEM memory plugin for OpenClaw: dynamic graph linking, hybrid (BM25 + dense) retrieval with 2-hop graph expansion, and LLM-driven memory evolution. Backed by Qdrant + local Transformers.js. **No Python required.**

> 🧠 The memory **engine** lives in **[`@heichaowo/amem-core`](../amem-core)**; this package is the thin OpenClaw plugin around it.
> 📖 Full guides, architecture & references: **[amem.owo.lc](https://amem.owo.lc)**.

⭐ Useful? [Star it on GitHub](https://github.com/heichaowo/amem).

## Highlights

- 🔄 **Memories evolve** — new facts update/link related memories (EVOLVE / CONFLICT / EXPAND / NEW), not silent overwrite.
- 🔍 **Hybrid retrieval** — BM25 (Jieba for Chinese) + dense vectors (RRF) + 2-hop graph expansion with a relevance gate.
- 🧠 **Knowledge vs episodic** — durable knowledge notes skip consolidation & time-decay; topic tags for precise recall.
- 🧹 **Self-consolidating** — daily 02:30 in-process merge of semantic duplicates with link cascading.
- 🔐 **Per-agent isolation** — private by default; explicit `owner`/`readers`/`writers`; Mode A (shared collection) or Mode B (dedicated collection).
- 🀄 **Chinese-optimized** & local embeddings (Transformers.js, 384-dim) — no Python, no external embedding API.

→ Full feature list & internals: **[amem-core README](../amem-core)** · **[docs](https://amem.owo.lc)**.

## Requirements

- OpenClaw v2026.4+
- Node.js 24 (18+ works; 24/26 supported)
- Qdrant running on `:6333`
- Anthropic API key (`ANTHROPIC_API_KEY`) — or set `AMEM_LLM_BASE_URL` for a compatible proxy

## Installation

### 1. Install the plugin

```bash
# From ClawHub (recommended)
openclaw plugins install clawhub:@heichaowo/openclaw-amem

# From npm
openclaw plugins install openclaw-amem

# From a local checkout of the amem monorepo
pnpm --filter openclaw-amem build
openclaw plugins install --link ./packages/openclaw-amem
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

> **⚠️ Memory slot conflict:** If your `openclaw.json` already assigns the `memory` slot to another plugin (e.g. `memory-core`), you **must** change it to `openclaw-amem`. The gateway only loads one plugin per slot — any additional `memory`-kind plugins are **silently skipped**. Set `"memory-core": { "enabled": false }` in `entries` to disable the old plugin.

### 3. Restart OpenClaw

```bash
openclaw gateway restart
```

## Configuration Reference

| Key                             | Type                                      | Default  | Description                                                                                                                          |
| ------------------------------- | ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `agentId`                       | `string`                                  | `"main"` | Agent namespace for memory isolation                                                                                               |
| `topK`                          | `number`                                  | `5`      | Maximum memories to retrieve during search                                                                                         |
| `agents`                        | `Record<string, {agentId?, collection?}>` | `{}`     | Per-agent overrides. Set `collection` for Mode B physical isolation.                                                               |
| `hooks.allowConversationAccess` | `boolean`                                 | `false`  | **Required** for automatic memory write-back. Without it, the `agent_end` hook is silently blocked by OpenClaw's security policy. |

## Tools

Once installed, the plugin exposes five tools to the agent:

| Tool | What it does |
| --- | --- |
| `memory_add` | Write a memory — hash dedup, LLM note construction, bidirectional linking, evolution. |
| `memory_search` | Search via RRF (BM25 + cosine) with heat ranking + 2-hop BFS graph expansion. Accepts `topicsFilter`. |
| `memory_list` | Total active note count for the current agent namespace. |
| `memory_consolidate` | Manually trigger category-based semantic dedup + link cascading. |
| `memory_quality_scan` | Scan for low-quality/expired/conflicting notes → Obsidian-compatible review batch file. |

## Development

This package is part of the **[amem monorepo](../../)**. From the repo root:

```bash
pnpm install
pnpm -r build                       # build all packages
pnpm --filter openclaw-amem build   # build just the plugin
pnpm --filter openclaw-amem test    # vitest (needs Qdrant on :6333)
```

## Docs & References

Full guides, architecture, and academic references: **[amem.owo.lc](https://amem.owo.lc)** · engine: **[@heichaowo/amem-core](../amem-core)** · paper: [A-MEM (arXiv:2502.12110)](https://arxiv.org/abs/2502.12110).

## License

MIT
