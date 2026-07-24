---
'@heichaowo/amem-core': minor
'openclaw-amem': patch
---

Add a cold-layer contradiction sweep (Story 43).

The per-turn CRUD decision runs on the fast model. That is safe — the update
guard stops it writing to the wrong memory — but dull: it misses contradictions
it should have caught, scoring around 8.7% at noticing a stored memory has
quietly stopped being true. This sweep is the other half of that trade.

`conflictSweep()` runs offline, in batches, on the `strong` tier. It hands the
model a whole batch of memories at once rather than comparing them pairwise,
because the contradictions that matter are usually *far apart* in meaning — "is
vegetarian" and "loved the steak" would never be paired by a similarity gate, and
the existing consolidation's 0.75 cosine threshold structurally excludes exactly
the class this exists to find.

When a pair is found, BOTH notes are marked with a pointer to the other
(`conflicts_with`) and the model's reason (`conflict_reason`). Those fields are
what let a conflict be reviewed as **one decision** instead of two disconnected
entries — the review batch now renders each pair side by side with timestamps,
the reason, and a recommendation, so it is one glance and one tick.

`AMEM_CONFLICT_MODE` chooses what happens next. `review` (default) marks and
stops. `auto` also retires the older note of each pair, needing no human — but
even a strong model is only around 55% accurate here, so roughly two in five
retirements will silence a memory that was still true. The retirement is a soft
delete and recoverable, but for a system answering in real time that only helps
once somebody notices. The docs say so plainly, in a danger callout.

Hallucinated, self-referential and duplicate pair indices are all dropped before
they can reach a note.
