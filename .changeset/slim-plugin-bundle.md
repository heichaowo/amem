---
"openclaw-amem": patch
---

Keep `@anthropic-ai/sdk` and `uuid` external instead of inlining them into `dist` — they are already declared as dependencies and installed at runtime. This cuts the published bundle from ~252 KB to ~92 KB and stops registry static scanners from flagging the vendored SDK's env-reading helper (a false positive). Also adds the `license` field and a canonical `git+` repository URL to the manifest.
