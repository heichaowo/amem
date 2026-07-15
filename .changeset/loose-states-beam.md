---
---

No release needed. `amem-api` gained its MCP stdio bridge, but the package is
private and nothing in `openclaw-amem` imports it — the published plugin is
unchanged. The bridge will become user-visible when the plugin's remote mode
lands and starts talking to the service.
