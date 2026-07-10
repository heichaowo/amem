---
---

CI coverage only — nothing user-visible ships. Adds the `typecheck` script to
openclaw-amem and `lint` to amem-core/amem-api so `pnpm -r` stops silently
skipping them, plus an ambient declaration for the host-provided OpenClaw SDK.
