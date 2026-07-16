# amem

## 0.2.0

### Minor Changes

- [`f48a266`](https://github.com/heichaowo/amem/commit/f48a266f85ed5f346c2acd3534f64f02f9f83b6a) Thanks [@heichaowo](https://github.com/heichaowo)! - First public release of the **amem** engine. Install it directly — `npm i amem` —
  to build memory on top of the A-MEM engine: notes that construct, link, and
  evolve like a Zettelkasten, over Qdrant + local Transformers.js embeddings, with
  hybrid (BM25 + dense) retrieval and graph expansion. No Python.

  The public API is deliberate: memory operations (`addMemory`, `addEpisodic`,
  `searchMemory`, `consolidateMemories`, `scanLowQuality`, …), the storage context,
  the embedding-model lifecycle, and the domain types. Being `0.x`, the surface may
  still shift.
