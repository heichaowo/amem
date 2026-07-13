/**
 * Turning failures into honest status codes.
 *
 * Fastify tags a schema rejection with a `validation` array. Past that gate,
 * amem-core throws plain `Error`s, so a message prefix is the only signal we
 * get. Exactly three shapes reach a route handler:
 *
 *   `[quality] ...`            the quality gate refused the caller's content
 *   `Qdrant METHOD /path ...`  Qdrant answered, and the engine rejected it
 *   `TypeError: fetch failed`  Qdrant never answered — undici gives up before
 *                              the engine's own throw is ever reached
 *
 * Anything else is our bug, and the caller gets a bare 500.
 */

export interface ErrorBody {
  statusCode: number
  error: string
  detail?: string
}

const PHRASE: Record<number, string> = {
  400: 'Bad Request',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

/**
 * undici raises `TypeError: fetch failed` for transport failures and nothing
 * else. A malformed URL is also a TypeError, but says so in its message — and
 * that is a misconfiguration, not a dependency outage.
 */
function isTransportFailure(err: unknown): boolean {
  return err instanceof TypeError && err.message === 'fetch failed'
}

export function classify(err: unknown): number {
  // Fastify types a thrown value as `unknown` — anything can be thrown — so the
  // validation tag is probed rather than asserted.
  if (err instanceof Error && 'validation' in err && Boolean(err.validation)) return 400

  const message = err instanceof Error ? err.message : String(err)
  if (message.startsWith('[quality]')) return 422
  if (message.startsWith('Qdrant') || isTransportFailure(err)) return 503
  return 500
}

/**
 * Only a caller's own mistakes come with an explanation. A 5xx message can
 * carry collection names, payloads and paths, so it stays in the log.
 */
export function errorBody(statusCode: number, err: unknown): ErrorBody {
  const body: ErrorBody = { statusCode, error: PHRASE[statusCode] }
  if (statusCode === 400 || statusCode === 422) {
    body.detail = err instanceof Error ? err.message : String(err)
  }
  return body
}
