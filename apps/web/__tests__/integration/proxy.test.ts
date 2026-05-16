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

describe.skipIf(process.env.CI === 'true')('proxy', () => {
  let devUp = false

  beforeAll(async () => {
    devUp = await isDevServerUp()
    if (!devUp) {
      console.warn(
        `dev server not reachable at ${APP_URL}; run \`pnpm --filter web dev\` to enable proxy tests`,
      )
    }
  })

  it('redirects unauthenticated requests for protected paths to /login', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/dashboard`, {
      redirect: 'manual',
    })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows /login through without redirect', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/login`, {
      redirect: 'manual',
    })
    // 404 (no page yet) or 200 — both are fine, just not a redirect
    expect(response.status).not.toBe(307)
  })

  it('bypasses the proxy for /api/*', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/api/health`, {
      redirect: 'manual',
    })
    expect(response.status).toBe(200)
  })
})
