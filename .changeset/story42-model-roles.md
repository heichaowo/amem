---
'@heichaowo/amem-core': minor
'openclaw-amem': minor
---

Split the engine's LLM calls into a `fast` and an optional `strong` tier (Story 42, PR 1/2).

Published results are consistent that memory quality is mostly architecture-bound:
for fact extraction a cheap model scores within ~2 points of a strong one, and
retrieval method moves accuracy far more than write strategy does. There is one
exception — judging whether new information *contradicts* what is stored, where
the cheap/strong gap is large.

So the calls now split by how hard they actually are. `fast` runs note
construction, link judgement, neighbourhood refresh and the per-turn CRUD
decision. `strong` runs only merge adjudication and EVOLVE/CONFLICT/EXPAND/NEW
classification.

**Configure nothing and nothing changes.** `strong` falls back to `fast` field by
field, so the three useful shapes all work: set only `llmStrongModel` for "same
endpoint, better model"; set all three `llmStrong*` fields to run the tiers on
entirely different backends (a local Ollama for `fast`, a hosted API for
`strong`); set none and the engine behaves exactly as before. There is
deliberately no built-in strong default — inventing one would start spending an
existing user's money without them asking.

New config: `llmStrongProvider` / `llmStrongModel` / `llmStrongBaseURL` and
`llmCrudRole`, plus `AMEM_LLM_STRONG_PROVIDER` / `AMEM_LLM_STRONG_MODEL` /
`AMEM_LLM_STRONG_BASE_URL` / `AMEM_LLM_CRUD_ROLE`.

The CRUD decision defaults to `fast` even though it is a contradiction judgement:
it runs every turn, and its one destructive failure mode — overwriting the wrong
memory — is already handled architecturally by the update guard rather than by
model tier. `llmCrudRole: "strong"` moves it for operators who prefer that.

SDK clients are now cached per base URL instead of as singletons, since the two
tiers may point at different backends.
