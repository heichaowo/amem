---
'openclaw-amem': patch
---

Declare the OpenAI-provider capability surface in the plugin manifest. `0.3.0`
added an OpenAI-compatible LLM path (reading `AMEM_LLM_PROVIDER` and
`OPENAI_API_KEY`, and able to reach `api.openai.com` or any compatible gateway),
but `openclaw.plugin.json` still only declared the Anthropic surface. The two new
env vars and an `openai` endpoint class are now declared, so the manifest matches
what the code actually does — and ClawHub's scan can adjudicate the bundled
`openai` SDK's env/network access against a declared capability instead of
holding the release.
