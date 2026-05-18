import { beforeAll, describe, expect, it } from 'vitest'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function isDevServerUp(): Promise<boolean> {
  try {
    const response = await fetch(`${APP_URL}/api/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

// The proxy is only exercised against a live Next.js dev server. The shared
// dev-server helper (with the visible-skip warn) lands in a later PR; until
// then this suite inlines the probe and emits a console.warn when the dev
// server is unreachable so the skip is not silent.
describe('proxy', () => {
  let devUp = false

  beforeAll(async () => {
    devUp = await isDevServerUp()
    if (!devUp) {
      console.warn(`SKIP proxy.test.ts: dev server unreachable at ${APP_URL}`)
    }
  })

  it('redirects unauthenticated requests for protected paths to /login', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/dashboard`, { redirect: 'manual' })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('/api/health responds 200 without redirect (proxy matcher excludes /api)', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/api/health`, { redirect: 'manual' })
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
