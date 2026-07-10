#!/usr/bin/env node
import { createApp } from './app.js'

const host = process.env.AMEM_API_HOST ?? '127.0.0.1'
const port = Number(process.env.AMEM_API_PORT ?? 7788)

const app = createApp()

// A single-writer service must let go of Qdrant cleanly on the way out, so the
// next instance can take over without waiting for a stale connection to lapse.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down')
    app.close().then(
      () => process.exit(0),
      (err: unknown) => {
        app.log.error({ err }, 'failed to shut down cleanly')
        process.exit(1)
      }
    )
  })
}

app.listen({ host, port }).catch((err: unknown) => {
  app.log.error({ err }, 'failed to start')
  process.exit(1)
})
