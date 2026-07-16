---
---

No release. The engine's `0.2.0` was never published — npm rejected the bare name
`amem` with an E403 — so renaming it to `@heichaowo/amem-core` does not change any
version that exists on npm. The `0.2.0` entry already in its CHANGELOG is still the
first public release; it just ships under the scoped name. The plugin inlines the
engine at build time, so its published bundle is unaffected.
