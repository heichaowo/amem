---
---

No release needed. This declares `@types/node` as a direct devDependency of
`amem-core`, which its `tsc --noEmit` already required — it was previously
satisfied only by a transitive `/// <reference types="node" />` that a future
dependency bump could remove. It is a build-time type-only change: nothing in
the published package (`dist/`) or its runtime behaviour changes.
