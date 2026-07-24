<p align="center">
  <img src="https://raw.githubusercontent.com/heichaowo/amem/main/docs/public/logo.webp" width="120" alt="amem Logo" />
</p>

# amem

Monorepo for the **amem** agentic-memory stack — memories that **evolve**, not just accumulate. Qdrant + local Transformers.js + LLM, **no Python required**.

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License: MIT" /></a>
  <a href="https://www.npmjs.com/package/openclaw-amem"><img src="https://img.shields.io/npm/v/openclaw-amem?style=for-the-badge&logo=npm&logoColor=white&label=openclaw-amem" alt="npm: openclaw-amem" /></a>
  <a href="https://github.com/heichaowo/amem/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/heichaowo/amem/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI" alt="CI" /></a>
  <a href="https://arxiv.org/abs/2502.12110"><img src="https://img.shields.io/badge/arXiv-2502.12110-b31b1b?style=for-the-badge" alt="arXiv" /></a>
</p>

## Packages

| Package | What it is | npm |
| --- | --- | --- |
| [`@heichaowo/amem-core`](packages/amem-core) | Framework-agnostic **A-MEM engine** — note construction, evolution, hybrid (BM25 + dense) retrieval with graph expansion. Qdrant + Transformers.js. | `@heichaowo/amem-core` |
| [`openclaw-amem`](packages/openclaw-amem) | **OpenClaw** memory-slot plugin — a thin wrapper around `amem-core`. | `openclaw-amem` |
| `amem-api` | Thin single-writer **service** (HTTP + MCP) so multiple processes share one memory store. | *coming soon* |

📖 Documentation: **[amem.owo.lc](https://amem.owo.lc)** · 📄 Paper: [A-MEM (arXiv:2502.12110, NeurIPS 2025)](https://arxiv.org/abs/2502.12110)

## Choosing models

amem runs its own LLM calls in two tiers, because they are not equally hard:

- **fast** — nearly every call (extract keywords/tags, judge links, the per-turn
  CRUD decision). Configure a **cheap, quick** model here; local models are fine.
- **strong** — *optional*, and only for the genuinely hard judgements (should two
  memories merge, does this contradict what is stored). Configure a **more
  capable** model, or skip it entirely.

**Configure one model and everything runs on it** — that is the default. The
strong tier is opt-in, and each of its fields falls back to the fast one, so you
can set just a better model, or point the two tiers at completely different
backends (e.g. a local Ollama for fast, a hosted API for strong).

amem does **not** need a frontier model. For extraction a cheap model scores
within ~2 points of a strong one; the gap only opens up on contradiction
detection, which is why exactly those calls get their own tier.

→ [Choosing models](https://amem.owo.lc/reference/configuration#choosing-models-a-fast-one-and-optionally-a-strong-one) · [Design Rationale](https://amem.owo.lc/guide/design-rationale)

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
