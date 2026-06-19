import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  clearConfig,
  configFilePath,
  readConfig,
  writeConfig,
} from '../src/config';

let tmpDir: string;
const ENV_KEY = 'SWISH_CONFIG_DIR';
const originalValue = process.env[ENV_KEY];

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'swish-cli-'));
  process.env[ENV_KEY] = tmpDir;
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  if (originalValue === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = originalValue;
  }
});

describe('CLI config', () => {
  it('returns null when no config has been written', async () => {
    expect(await readConfig()).toBeNull();
  });

  it('round-trips writeConfig + readConfig', async () => {
    const file = await writeConfig({ apiUrl: 'http://localhost:3000', pat: 'tok' });
    expect(file).toBe(configFilePath());
    const loaded = await readConfig();
    expect(loaded).toEqual({ apiUrl: 'http://localhost:3000', pat: 'tok' });
  });

  it('clearConfig deletes the file (idempotent)', async () => {
    await writeConfig({ apiUrl: 'a', pat: 'b' });
    await clearConfig();
    await clearConfig();
    expect(await readConfig()).toBeNull();
  });
});
