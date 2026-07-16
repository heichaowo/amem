---
"amem": minor
---

First public release of the **amem** engine. Install it directly — `npm i amem` —
to build memory on top of the A-MEM engine: notes that construct, link, and
evolve like a Zettelkasten, over Qdrant + local Transformers.js embeddings, with
hybrid (BM25 + dense) retrieval and graph expansion. No Python.

The public API is deliberate: memory operations (`addMemory`, `addEpisodic`,
`searchMemory`, `consolidateMemories`, `scanLowQuality`, …), the storage context,
the embedding-model lifecycle, and the domain types. Being `0.x`, the surface may
still shift.
