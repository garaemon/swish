import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeConfig } from '../../src/config'

const ENV_KEY = 'SWISH_CONFIG_DIR'
const originalValue = process.env[ENV_KEY]

describe('swish add command via the API', () => {
  let tmpDir: string
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'swish-add-'))
    process.env[ENV_KEY] = tmpDir
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`)
    }) as never)
  })

  afterEach(async () => {
    exitSpy.mockRestore()
    await rm(tmpDir, { recursive: true, force: true })
    if (originalValue === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = originalValue
    vi.restoreAllMocks()
  })

  it('exits with code 1 when no config is present', async () => {
    const { addCommand } = await import('../../src/commands/add')
    await expect(addCommand('https://example.com')).rejects.toThrow(/process.exit\(1\)/)
  })

  it('exits with code 2 on a malformed URL', async () => {
    await writeConfig({ apiUrl: 'http://localhost:3000', pat: 'tok' })
    const { addCommand } = await import('../../src/commands/add')
    await expect(addCommand('not a url')).rejects.toThrow(/process.exit\(2\)/)
  })

  it('posts to /api/bookmarks with Bearer PAT on success', async () => {
    await writeConfig({ apiUrl: 'http://example.test', pat: 'tok' })
    const captured: { url: string; init: RequestInit | undefined } = { url: '', init: undefined }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.url = String(input)
      captured.init = init
      return new Response(JSON.stringify({ id: 'item-1', status: 'pending' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { addCommand } = await import('../../src/commands/add')
    await addCommand('https://example.com/article')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(captured.url).toBe('http://example.test/api/bookmarks')
    const headers = (captured.init?.headers ?? {}) as Record<string, string>
    expect(headers.authorization).toBe('Bearer tok')
    expect(logSpy).toHaveBeenCalledWith('Saved item item-1 (status: pending)')
  })
})
