import { describe, expect, it } from 'vitest'
import * as bookmarks from '@/app/api/bookmarks/route'
import * as items from '@/app/api/items/route'
import * as itemsRetry from '@/app/api/items/[id]/retry/route'
import * as itemsRead from '@/app/api/items/[id]/read/route'
import * as tokens from '@/app/api/tokens/route'
import * as tokenDelete from '@/app/api/tokens/[id]/route'
import * as settings from '@/app/api/settings/route'

type ResponseFactory = () => Response | Promise<Response>

const stubs: Array<[string, ResponseFactory]> = [
  ['POST /api/bookmarks', () => bookmarks.POST()],
  ['OPTIONS /api/bookmarks', () => bookmarks.OPTIONS()],
  ['GET /api/items', () => items.GET()],
  ['POST /api/items/[id]/retry', () => itemsRetry.POST()],
  ['PUT /api/items/[id]/read', () => itemsRead.PUT()],
  ['GET /api/tokens', () => tokens.GET()],
  ['POST /api/tokens', () => tokens.POST()],
  ['DELETE /api/tokens/[id]', () => tokenDelete.DELETE()],
  ['GET /api/settings', () => settings.GET()],
  ['PUT /api/settings', () => settings.PUT()],
]

describe('stub route handlers', () => {
  for (const [label, factory] of stubs) {
    it(`${label} returns 501`, async () => {
      const response = await factory()
      expect(response.status).toBe(501)
      const body = await response.json()
      expect(body).toMatchObject({ error: 'not_implemented' })
    })
  }
})
