# Evolution & Quality

## Evolution Mechanism

Unlike flat memory systems that silently overwrite existing notes, openclaw-amem treats memory as **living knowledge that evolves over time**.

When new content lands in the 0.72–0.85 cosine similarity zone with an existing note, it is flagged `pending_merge=true` and routed through an **LLM evolution judgment** at `agent_end` instead of being force-merged or silently accepted.

### Four evolution paths

| Path | When | Action |
|------|------|--------|
| **EVOLVE** | New info deepens or updates old memory (e.g. "wants to buy Model 3" → "decided on standard RWD") | Old note content updated, event appended to `evolution_history`, new note absorbed |
| **CONFLICT** | New and old info contradict each other (e.g. "lives in Riverstone" vs "moved to Eastholm") | Both notes kept, both marked `conflict: true` — preserved for human review |
| **EXPAND** | New info complements old memory (e.g. "has a sister" + "sister works in finance in Northvale") | Content merged into old note, `evolution_history` appended, new note absorbed |
| **NEW** | Unrelated content | Both notes kept as-is, `pending_merge` cleared |

### Why this matters

- `evolution_history` gives a full audit trail: you can answer "when did this memory change?"
- `conflict` flags surface contradictory facts for human review instead of silently picking one
- This is the key differentiator from mem0-style systems, which replace or append without tracking the relationship between old and new

### References

- arXiv:2603.11768 (SSGM Framework, 2026) — memory evolution taxonomy: content abstraction / structural reorganization / policy optimization
- arXiv:2602.05665 (Graph-based Agent Memory, 2026) — conflict detection in graph update pipelines
- arXiv:2604.01707 (Memory in the LLM Era, 2026) — consolidation / updating / filtering / enhancement operations

---

## Quality Scoring & Auto-Review

### Write-time quality gate

Every `memory_add` call passes through `checkQuality()` before any LLM or embedding work:

- **Content under 10 characters** → rejected with an error (e.g. "OK", "明白", "好的")
- **Contains temporal signal words** (`待跑`, `等确认`, `昨日`, `明天完成`) → written with `ephemeral: true` flag

### Periodic quality scan

The `memory_quality_scan` tool (or `scanLowQuality()` in code) scans the full memory store and returns entries in three categories:

| Category | Condition |
|----------|-----------|
| `too_short` | Content length under 10 characters |
| `expired_ephemeral` | `ephemeral: true` and written more than 7 days ago |
| `pending_conflict` | `conflict: true` — awaiting human review |

Flagged entries are identified for human review via the `memory_quality_scan` tool.
