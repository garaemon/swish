import { notImplemented } from '@/lib/http/json'

export const runtime = 'nodejs'

export function GET(): Response {
  return notImplemented('GET /api/items')
}
