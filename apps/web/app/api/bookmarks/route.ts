import { notImplemented } from '@/lib/http/json'

export const runtime = 'nodejs'

export function POST(): Response {
  return notImplemented('POST /api/bookmarks')
}

export function OPTIONS(): Response {
  return notImplemented('OPTIONS /api/bookmarks')
}
