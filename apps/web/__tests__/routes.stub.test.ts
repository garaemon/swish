import { describe, expect, it } from 'vitest'
import * as items from '@/app/api/items/route'
import * as itemsRead from '@/app/api/items/[id]/read/route'

type ResponseFactory = () => Response | Promise<Response>

const stubs: Array<[string, ResponseFactory]> = [
  ['GET /api/items', () => items.GET()],
  ['PUT /api/items/[id]/read', () => itemsRead.PUT()],
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
