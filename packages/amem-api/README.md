# @heichaowo/amem-api

**The single-writer memory service for the [amem](../../) stack** — HTTP + MCP.

One process owns Qdrant, the embedding model, evolution and consolidation. Every consumer — the [`openclaw-amem`](../openclaw-amem) plugin in remote mode, a game brain — talks to it over HTTP or MCP rather than importing [`amem-core`](../amem-core) and opening its own Qdrant connection. That is what makes the single-writer guarantee **structural** rather than a convention.

> ⚠️ **Not published, and not finished.** This package is `private` while its API settles. The auth/config layer is still landing.

## Status

| | |
| --- | --- |
| `GET /healthz` | ✅ readiness |
| memory routes (`/v1/memories`, …) | ✅ |
| MCP bridge (stdio) | ✅ |
| auth + non-localhost binding | ⏳ |

## API

| | | |
| --- | --- | --- |
| `GET` | `/healthz` | `200` when Qdrant answers **and** the model is resident; `503` otherwise |
| `POST` | `/v1/memories` | full pipeline — LLM note construction, links, evolution → `201 {id}` |
| `POST` | `/v1/memories/episodic` | cheap append-only write, no LLM → `201 {id}` |
| `POST` | `/v1/memories/search` | hybrid BM25 + dense retrieval → `200 {results}` |
| `GET` | `/v1/memories/count` | `200 {count}` |
| `POST` | `/v1/maintenance/consolidate` | offline distillation → `200 {merged}` |
| `POST` | `/v1/maintenance/quality-scan` | `200 {items: [{noteId, reasons}]}` |

Every write and search body is schema-validated; an undeclared field is refused rather than silently dropped. Failures answer with `{statusCode, error, detail?}` — `400` malformed request, `422` the quality gate refused the content, `503` Qdrant unreachable, `500` ours. `detail` is present only on `400` and `422`: a `5xx` message stays in the log.

Bodies take an optional `agentId` (default `main`); writes take an optional `scope` of `private` (default) or `shared`.

## Run it

Needs Qdrant on `localhost:6333`. Startup loads the embedding model **before** the port opens, so the first request is not the one that pays for the download — and so `/healthz` means something the moment it answers.

```bash
pnpm --filter @heichaowo/amem-api build
pnpm --filter @heichaowo/amem-api start
```

| env | default | what |
| --- | --- | --- |
| `AMEM_API_HOST` | `127.0.0.1` | bind address — localhost only, by design |
| `AMEM_API_PORT` | `7788` | port |
| `AMEM_API_LOG_LEVEL` | `info` | pino level |

## MCP

`amem-mcp` speaks MCP over stdio, exposing the same operations as five tools: **`memory_add`**, **`memory_add_episodic`**, **`memory_search`**, **`memory_consolidate`**, **`memory_quality_scan`**. Point any local MCP client at it:

```json
{
  "mcpServers": {
    "amem": { "command": "amem-mcp", "env": { "AMEM_API_URL": "http://127.0.0.1:7788" } }
  }
}
```

**It is a client of `amem-api`, not a second engine** — so `amem-api` must be running. That is deliberate. A stdio MCP server is spawned once *per client*; if this one owned the engine, every client that attached would bring up its own Qdrant connection and its own embedding model, which is exactly the N-writers problem this service exists to prevent. Being a thin client also means it starts instantly, with no model to load.

| env | default | what |
| --- | --- | --- |
| `AMEM_API_URL` | `http://127.0.0.1:7788` | the `amem-api` to talk to |

## Single-writer rule

**Only one `amem-api` instance may write a given Qdrant collection.** This is deployment discipline, not something the code enforces — running two instances against one collection will corrupt evolution and consolidation state. Any number of MCP clients may attach; they all go through the one service.

## License

MIT
