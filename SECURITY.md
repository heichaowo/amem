# Security Policy

## Supported versions

`openclaw-amem` is the published artifact. Security fixes land on the latest release; there is no back-porting to older lines.

| Version           | Supported |
| ----------------- | --------- |
| latest `1.1.x`    | ✅        |
| anything older    | ❌        |

`amem-core` and `amem-api` are internal packages that are never published on their own — `amem-core` ships bundled inside the plugin, and `amem-api` is not released yet. Report issues in either against this repository all the same.

## Reporting a vulnerability

Please report privately, **not** as a public issue or pull request.

Use GitHub's private vulnerability reporting on this repository: **Security → Report a vulnerability** (<https://github.com/heichaowo/amem/security/advisories/new>). It opens a private channel with the maintainer; nothing is visible until an advisory is published.

Include what you found, how to reproduce it, and the impact you expect — a proof of concept helps. You will get an acknowledgement, and then either a fix or a reasoned explanation of why it is not one.

Please give a reasonable window to ship a fix before any public disclosure.

## What is in scope

This is a memory engine and a single-writer service in front of it. Memory content is private data, so anything that reads it, writes it, or moves it without authorization is the most interesting thing to probe:

- **`amem-api` / `amem-mcp`** — the network and MCP surfaces. The intended posture is that the service binds `127.0.0.1` and requires a token to listen anywhere else, and that the MCP bridge only talks to a loopback `amem-api` unless `AMEM_MCP_ALLOW_REMOTE=1` is set explicitly. A way around either of those is in scope.
- **The `openclaw-amem` plugin** — a path by which untrusted content (a stored memory, a document an agent reads) reaches the filesystem, a network call, or the shell.
- **Supply chain** — the published package integrity. Releases carry npm provenance and a source-linked ClawHub entry.

## What is not

- Development-only tooling — the docs site, the test runner, build tools — that never ships inside the published plugin. Advisories against those dependencies are tracked, but they are not part of the attack surface a user of the plugin is exposed to.
- Anything that already requires operator-level access. Whoever can set the process's environment variables, or write its data directory, can already run code as that user; that is not a privilege boundary this project claims to defend.
