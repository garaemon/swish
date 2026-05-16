import { notImplemented } from '@/lib/http/json'

export const runtime = 'nodejs'

export function GET(): Response {
  return notImplemented('GET /api/tokens')
}

export function POST(): Response {
  return notImplemented('POST /api/tokens')
}
