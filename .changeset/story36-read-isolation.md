---
'@heichaowo/amem-core': minor
---

Enforce the `readers` access rule on reads by id (Access Protocol, Story 36).

Story 33 closed the write half of the protocol. The read half had one hole left:
`getNote(id)` fetches straight by UUID, so unlike every list and search path it
never went through the `agent_id` filter and never consulted `readers`. That
mattered because of how shared notes link: a shared note is returned to every
agent by every query, and its `links[]` can name its owner's **private** notes.
Evolution walks that neighbourhood and puts each neighbour's content into the
LLM prompt — so one shared note could carry its owner's private memory out to
any agent that linked to it.

`getNote` now takes an optional `readerAgentId`. When passed, an unreadable note
comes back as `null` — indistinguishable from missing, so nothing leaks, and
every existing caller already handles `null`. Omitting it skips the check, so
internal callers that only ever hold their own ids are unchanged. The two
neighbourhood walks in evolution now pass the caller: the link expansion that
feeds `llmEvolveNote`, and the strengthen step, whose target ids come from the
model rather than from a filtered query.

The rule ships as `canRead(note, callerAgentId)` alongside `canWrite` — true for
the owner, an agent listed in `readers`, or `readers: ['*']`. Read and write are
independent: a shared note is typically public to read and closed to write.
Search and list paths were audited and need no change; they build their working
set from the agent-filtered `listNotes`, so they cannot materialise a note the
caller may not see.
