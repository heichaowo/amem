---
---

No release needed. `amem-core` gained three exports — `loadModel`, `isModelLoaded`
and `pingQdrant` — so that `amem-api` can warm the model at startup and report
honestly on `/healthz`. Nothing in `openclaw-amem` calls them, and no existing
behaviour changed, so the published plugin is unaffected.
