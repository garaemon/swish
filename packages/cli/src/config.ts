/**
 * Persisted CLI config — the API base URL and the personal access token.
 *
 * Stored at `$SWISH_CONFIG_DIR` (default `~/.config/swish/config.json`) with
 * mode 0600 so other users on the same machine cannot read the PAT. The
 * directory itself is mode 0700 for the same reason. The single point of
 * truth allows future keychain backends to land behind these helpers
 * without callers being aware of where the secret lives.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type SwishCliConfig = {
  apiUrl: string
  pat: string
}

function configDir(): string {
  return process.env.SWISH_CONFIG_DIR || path.join(os.homedir(), '.config', 'swish');
}

/** Returns the absolute path the helpers below read from and write to. */
export function configFilePath(): string {
  return path.join(configDir(), 'config.json');
}

/**
 * Returns the persisted config, or `null` if the file does not exist or is
 * incomplete. A JSON parse failure (manually edited corrupt file) is
 * surfaced as a descriptive Error so the caller can show a recovery hint.
 */
export async function readConfig(): Promise<SwishCliConfig | null> {
  let raw: string;
  try {
    raw = await fs.readFile(configFilePath(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
  let parsed: Partial<SwishCliConfig>;
  try {
    parsed = JSON.parse(raw) as Partial<SwishCliConfig>;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `Failed to parse ${configFilePath()}: ${reason}. Run \`swish login\` to recreate it.`,
    );
  }
  if (!parsed.apiUrl || !parsed.pat) {
    return null;
  }
  return { apiUrl: parsed.apiUrl, pat: parsed.pat };
}

// TODO: keychain integration on macOS / Linux Secret Service / Windows
// Credential Manager. The PAT is currently stored in plaintext under
// $SWISH_CONFIG_DIR with mode 0600. That is conventional (gh, npm, etc. do
// the same) but the file can leak via shared home directories on NFS or
// cloud-backup tools.

/**
 * Persists the given config and returns the absolute path it was written
 * to. Creates the parent directory with mode 0700 and the file with mode
 * 0600 to keep the PAT readable only by the current user.
 */
export async function writeConfig(value: SwishCliConfig): Promise<string> {
  const dir = configDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = configFilePath();
  await fs.writeFile(file, JSON.stringify(value, null, 2), { mode: 0o600 });
  return file;
}

/** Removes the persisted config. Idempotent — does nothing if absent. */
export async function clearConfig(): Promise<void> {
  await fs.rm(configFilePath(), { force: true });
}
