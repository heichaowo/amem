---
"openclaw-amem": patch
---

Declare the plugin's capabilities in `openclaw.plugin.json`: the eight `AMEM_*` environment variables it reads (`setup.providers[].envVars`) and its network endpoints (`providerEndpoints` — local Qdrant plus the LLM API). This is ClawHub's designed disclosure signal that the plugin's env + network access is intentional and purpose-aligned, addressing the advisory `suspicious.env_credential_access` audit finding (a heuristic false positive endemic to every configurable memory/LLM plugin). Also adds a **Security & data flow** section to the README documenting exactly what the plugin reads and where it sends memory data.
