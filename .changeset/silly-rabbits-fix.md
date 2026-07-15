---
---

No release needed. The engine package is renamed `amem-core` → `amem` and its
public API is curated down from `export *` to a deliberate surface. The plugin
still inlines the same engine source via the bundler, so its published output
and behaviour are unchanged; `amem` and `amem-api` remain private for now.
