---
'@heichaowo/amem-core': minor
'openclaw-amem': patch
---

Make the CRUD `UPDATE` path non-destructive (Story 41).

When the `agent_end` hook decides an existing memory should be updated, it picks
one from a numbered candidate list. Picking the wrong number was the engine's one
silent, unrecoverable failure: the index is valid and the note is usually one the
caller owns, so neither bounds-checking nor the access protocol catches it — and
`updateNoteContent` overwrites content and embedding in place. (`DELETE` was
never affected; `invalidateNote` is a soft delete.)

This is a documented failure class, not a hypothetical. mem0 removed its own CRUD
step partly because "overwrites sometimes erased key information from the original
fact", and Memory-R1 exists because vanilla LLMs mis-classify additive facts as
contradictions. The risk scales inversely with model capability, and the notes
reaching this step have already survived hash and vector dedup — the hardest
subset, exactly where a cheap model is least reliable.

Two guards, both default-on:

- **`isPlausibleUpdateTarget`** — before overwriting, check the replacement text is
  plausibly *about* the memory it replaces (cosine ≥ `crudUpdateMinSim`, default
  `0.35`). Both embeddings are already in hand, so this costs one dot product and
  no LLM call. On failure the fact is stored as a **new** memory instead: nothing
  is lost, and consolidation can merge a duplicate later — whereas it can never
  resurrect an overwritten note. Tunable via `AMEM_CRUD_UPDATE_MIN_SIM` or the
  `crudUpdateMinSim` plugin config; raise it for cheaper models.
- **History snapshot** — an accepted overwrite now records the replaced text in the
  note's `evolution_history` (`action: "crud_update"`, new `oldContent` field), so
  even a false negative stays recoverable. Only the caller-scoped path pays for
  this; the dedup and merge paths pass no `callerAgentId` and are unchanged, so
  they take no extra read.

The threshold is a heuristic, not a tuned constant — it sits just above the `0.3`
bar the engine already uses for "related at all", because a legitimate update is
often a correction ("drinks tea" → "switched to coffee") that is related but not
near-identical. Set it to `0` to disable the check deliberately.
