import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loginCommand } from '../../src/commands/login'
import { readConfig } from '../../src/config'

const ENV_KEY = 'SWISH_CONFIG_DIR'
const originalValue = process.env[ENV_KEY]

describe('swish login command', () => {
  let tmpDir: string
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'swish-login-'))
    process.env[ENV_KEY] = tmpDir
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`)
    }) as never)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    exitSpy.mockRestore()
    await rm(tmpDir, { recursive: true, force: true })
    if (originalValue === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = originalValue
    vi.restoreAllMocks()
  })

  it('persists apiUrl and pat from flags without prompting', async () => {
    await loginCommand({ apiUrl: 'http://example.test', pat: 'tok-1' })
    const stored = await readConfig()
    expect(stored).toEqual({ apiUrl: 'http://example.test', pat: 'tok-1' })
  })

  it('exits with code 1 when pat is empty', async () => {
    await expect(loginCommand({ apiUrl: 'http://example.test', pat: '' })).rejects.toThrow(
      /process.exit\(1\)/,
    )
  })
})
