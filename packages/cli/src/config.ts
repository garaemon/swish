import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export type SwishCliConfig = {
  apiUrl: string
  pat: string
}

function configDir(): string {
  return process.env.SWISH_CONFIG_DIR || path.join(os.homedir(), '.config', 'swish')
}

function configPath(): string {
  return path.join(configDir(), 'config.json')
}

export async function readConfig(): Promise<SwishCliConfig | null> {
  try {
    const raw = await fs.readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<SwishCliConfig>
    if (!parsed.apiUrl || !parsed.pat) return null
    return { apiUrl: parsed.apiUrl, pat: parsed.pat }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

// TODO: keychain integration on macOS / Linux Secret Service / Windows
// Credential Manager. The PAT is currently stored in plaintext under
// $SWISH_CONFIG_DIR (default ~/.config/swish/config.json) with mode 0600.
// That is conventional (gh, npm, etc. do the same) but the file can leak
// via shared home directories on NFS or cloud-backup tools.
export async function writeConfig(value: SwishCliConfig): Promise<string> {
  const dir = configDir()
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  const file = configPath()
  await fs.writeFile(file, JSON.stringify(value, null, 2), { mode: 0o600 })
  return file
}

export async function clearConfig(): Promise<void> {
  await fs.rm(configPath(), { force: true })
}

export function configFilePath(): string {
  return configPath()
}
