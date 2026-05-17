import { beforeAll, describe, expect, it } from 'vitest'
import { APP_URL, isDevServerUp, requireDevServer } from '../helpers/dev-server'

// The proxy is only exercised when the Next.js dev server is up. Each test
// uses requireDevServer so a missing server emits a visible console.warn
// (consistent with the rest of the integration suite) instead of silently
// passing.
describe('proxy', () => {
  let devUp = false

  beforeAll(async () => {
    devUp = await isDevServerUp()
  })

  it('redirects unauthenticated requests for protected paths to /login', async () => {
    if (requireDevServer(devUp, 'proxy redirect')) return
    const response = await fetch(`${APP_URL}/dashboard`, { redirect: 'manual' })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows /login through and renders the page', async () => {
    if (requireDevServer(devUp, 'proxy /login')) return
    const response = await fetch(`${APP_URL}/login`, { redirect: 'manual' })
    expect(response.status).toBe(200)
  })

  it('bypasses the proxy for /api/*', async () => {
    if (requireDevServer(devUp, 'proxy bypass /api')) return
    const response = await fetch(`${APP_URL}/api/health`, { redirect: 'manual' })
    expect(response.status).toBe(200)
  })
})
