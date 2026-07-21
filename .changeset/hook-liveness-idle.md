---
'openclaw-amem': patch
---

Replace the agent_end hook self-check with a deterministic config check. It used a
10-minute timer to guess whether the hook was "blocked", which mis-fired on an idle
gateway that had simply had no conversation, and only surfaced in the gateway log
(seen via `openclaw completion --write-state`). The plugin now reads the actual flag —
`plugins.entries.<id>.hooks.allowConversationAccess` — from the full OpenClaw config
at startup, so it knows for certain whether automatic memory write-back is on: no
timer, no heuristic, no idle false positives. When it is off, it logs once at startup
and appends a clearer, actionable notice to memory_search results so the assistant
relays it to the user. It stays silent if the config can't be read.
