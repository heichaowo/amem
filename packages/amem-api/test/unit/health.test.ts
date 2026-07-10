import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app.js'

describe('createApp', () => {
  it('answers GET /healthz with 200 and a status body', async () => {
    const app = createApp({ logger: false })
    const res = await app.inject({ method: 'GET', url: '/healthz' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })

    await app.close()
  })

  it('404s an unknown route', async () => {
    const app = createApp({ logger: false })
    const res = await app.inject({ method: 'GET', url: '/nope' })

    expect(res.statusCode).toBe(404)

    await app.close()
  })
})
