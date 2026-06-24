# Contributing

## Development setup

```bash
git clone https://github.com/heichaowo/openclaw-amem
cd openclaw-amem
npm install
npm run build
```

## Running checks

```bash
npm run lint               # ESLint (Flat Config)
npm run format             # Prettier check
npm run test               # Vitest unit & integration tests
npm run check              # Full suite (format + lint + test)
```

## Test coverage

| Test File | What It Covers |
|-----------|----------------|
| `test/embedding.test.ts` | ONNX embedding shape & cosine similarity |
| `test/storage.test.ts` | Qdrant note add / soft-delete (live integration) |
| `test/memory.test.ts` | Consolidation & cascading link updates |
| `test/tokenize.test.ts` | Jieba Chinese segmentation, mixed-language, edge cases |
| `test/bfs-gate.test.ts` | BFS relevance gate: filter / admit / disable |
| `test/heat-decay.test.ts` | Time-decay heat boost: fresh > stale ranking, decay magnitude |

## Project structure

```
openclaw-amem/
├── src/
│   ├── index.ts          # Plugin entry point & OpenClaw hooks
│   ├── memory.ts         # Core A-MEM operations (add, search, consolidate)
│   ├── storage.ts        # Qdrant client & collection management
│   ├── embedding.ts      # Local ONNX embedding via Transformers.js
│   ├── llm.ts            # LLM calls (note construction, CRUD, links, evolution)
│   ├── quality.ts        # Memory quality scanning & review batch generation
│   └── evo-counter.ts    # Evolution throttle counter
└── website/              # Documentation site (VitePress)
```

## References

| Reference | Role |
|-----------|------|
| Xu et al., _A-MEM: Agentic Memory for LLM Agents_, NeurIPS 2025 · [arXiv:2502.12110](https://arxiv.org/abs/2502.12110) | Core architecture |
| Robertson & Zaragoza, _The Probabilistic Relevance Framework: BM25 and Beyond_, 2009 | BM25 ranking formula |
| Cormack et al., _Reciprocal Rank Fusion_, SIGIR 2009 | RRF fusion formula |
| Sun et al., _Jieba Chinese Text Segmentation_ | Chinese word segmentation |
