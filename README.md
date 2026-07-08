<p align="center">
  <img src="https://amem.owo.lc/logo.webp" width="120" alt="amem Logo" />
</p>

# amem

Monorepo for the **amem** agentic-memory stack — memories that **evolve**, not just accumulate. Qdrant + local Transformers.js + LLM, **no Python required**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![arXiv](https://img.shields.io/badge/arXiv-2502.12110-b31b1b?style=for-the-badge)](https://arxiv.org/abs/2502.12110)

## Packages

| Package | What it is | npm |
| --- | --- | --- |
| [`@heichaowo/amem-core`](packages/amem-core) | Framework-agnostic **A-MEM engine** — note construction, evolution, hybrid (BM25 + dense) retrieval with graph expansion. Qdrant + Transformers.js. | `@heichaowo/amem-core` |
| [`openclaw-amem`](packages/openclaw-amem) | **OpenClaw** memory-slot plugin — a thin wrapper around `amem-core`. | `openclaw-amem` |
| `@heichaowo/amem-api` | Thin single-writer **service** (HTTP + MCP) so multiple processes share one memory store. | *coming soon* |

📖 Documentation: **[amem.owo.lc](https://amem.owo.lc)** · 📄 Paper: [A-MEM (arXiv:2502.12110, NeurIPS 2025)](https://arxiv.org/abs/2502.12110)

## Develop

This is a [pnpm](https://pnpm.io) workspace (Node 24).

```bash
pnpm install                 # first run: `pnpm approve-builds` to allow onnxruntime-node / sharp / esbuild
pnpm -r build                # build every package
pnpm -r typecheck
pnpm -r test                 # vitest — integration tests need Qdrant on :6333 + ANTHROPIC_API_KEY
pnpm docs:dev                # run the docs site locally
```

Publishing is automated via [Changesets](https://github.com/changesets/changesets) + GitHub Actions.

## License

MIT © heichaowo
