---
'@heichaowo/amem-core': minor
'openclaw-amem': minor
---

Let a host choose the engine's LLM provider, model and endpoint (Story 35).

The engine's own LLM settings were frozen at module load: `PROVIDER` and `MODEL`
were top-level consts, so the only way to change them was to set an environment
variable before the process started. A host embedding the engine had no way in.

They now resolve per call, and `configureLlm({ provider, model, baseURL })` lets a
host set them after import. The OpenClaw plugin wires this to three new config
keys — `llmProvider`, `llmModel`, `llmBaseURL` — so `openclaw.json` can point
amem's note construction, linking and evolution at a different model than the one
your agent session uses. Precedence, highest first: environment variable, then
plugin config, then the built-in default per provider. Configure nothing and
behaviour is exactly as before.

Two deliberate choices worth naming. There is **no way to inject an API key**:
keys come from the environment only. Configuration arrives from a host config
file, and a key field would make the memory engine a channel for a user's gateway
credentials — endpoint and model are enough to route a call. And an environment
variable set to the **empty string now counts as unset**, so an exported-but-blank
`AMEM_LLM_MODEL` can no longer silently outrank a valid configured model.

The engine still does not follow whichever model your agent session is using;
that needs host APIs this change does not depend on, and is tracked separately.
Following it is also not obviously desirable — these are cheap, high-frequency
utility calls, and inheriting a large reasoning model would make every memory
write slow and expensive.
