import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'

/**
 * Build the Fastify app.
 *
 * Kept separate from the process entrypoint so tests can drive it with
 * `app.inject()` without opening a socket, and so the MCP bridge can later
 * mount the same handlers.
 */
export function createApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.AMEM_API_LOG_LEVEL ?? 'info' },
    ...opts,
  })

  // Liveness only. Readiness — Qdrant reachable, embedding model loaded —
  // lands with the memory routes.
  app.get('/healthz', async () => ({ status: 'ok' }))

  return app
}
