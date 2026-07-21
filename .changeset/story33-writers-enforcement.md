---
'@heichaowo/amem-core': minor
'openclaw-amem': patch
---

Enforce the `writers` access rule on every write path (Access Protocol, Story 33).

Notes have carried `owner` / `readers` / `writers` since per-agent isolation landed,
but only `readers` was enforced. Because the agent filter matches
`agent_id == caller OR agent_id == 'shared'`, every query can return another
agent's shared note — and each mutation then wrote to it unchecked. An audit of
the engine found **eight such write sites**: high-similarity dedup, bidirectional
link generation, evolution (neighbour rewrite and strengthen), the plugin's
agent_end CRUD update and delete, the quality scan, and consolidation's link
rewriting. In the worst of them, one agent's write could silently overwrite the
content and embedding of another agent's shared memory.

All eight now gate on a new exported rule, `canWrite(note, callerAgentId)` — true
for the owner, an agent listed in `writers`, or `writers: ['*']`. Denial degrades
gracefully and never throws: dedup inserts the caller's own note instead of
overwriting, back-links and evolution skip that note, CRUD ops are logged and
skipped, and the quality scan no longer flags notes it cannot act on.
`updateNoteContent` and `invalidateNote` take an optional `callerAgentId` for
callers that hold only an id (they return `false`, unwritten, when denied);
omitting it preserves existing behaviour, so consolidation and merge — already
scoped to their own private notes — are unchanged.
