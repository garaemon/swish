import { notImplemented } from '@/lib/http/json'

export const runtime = 'nodejs'

export function DELETE(): Response {
  return notImplemented('DELETE /api/tokens/[id]')
}
