# @heichaowo/amem-api

**The single-writer memory service for the [amem](../../) stack** — HTTP + MCP.

One process owns Qdrant, the embedding model, evolution and consolidation. Every consumer — the [`openclaw-amem`](../openclaw-amem) plugin in remote mode, a game brain — talks to it over HTTP or MCP rather than importing [`amem-core`](../amem-core) and opening its own Qdrant connection. That is what makes the single-writer guarantee **structural** rather than a convention.

> ⚠️ **Not published, and not finished.** This package is `private` while its API settles. It is scaffolding today: the memory routes, the MCP bridge and the auth/config layer are still landing.

## Status

| | |
| --- | --- |
| `GET /healthz` | ✅ liveness |
| memory routes (`/v1/memories`, …) | ⏳ |
| MCP bridge (stdio) | ⏳ |
| auth + non-localhost binding | ⏳ |

## Run it

```bash
pnpm --filter @heichaowo/amem-api build
pnpm --filter @heichaowo/amem-api start
```

| env | default | what |
| --- | --- | --- |
| `AMEM_API_HOST` | `127.0.0.1` | bind address — localhost only, by design |
| `AMEM_API_PORT` | `7788` | port |
| `AMEM_API_LOG_LEVEL` | `info` | pino level |

## Single-writer rule

**Only one `amem-api` instance may write a given Qdrant collection.** This is deployment discipline, not something the code enforces — running two instances against one collection will corrupt evolution and consolidation state.

## License

MIT
