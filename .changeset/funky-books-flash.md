---
---

No release needed. `amem-core` gained `addEpisodic`, but nothing in
`openclaw-amem` calls it yet, so the published plugin's behaviour is unchanged.
The engine change does ship (amem-core is bundled into the plugin) — it is just
inert until `amem-api` starts using it.
