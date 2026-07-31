import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  apiUrlItem,
  getSettings,
  patItem,
  validateSettingsInput,
} from '../lib/settings';

beforeEach(() => {
  fakeBrowser.reset();
});

describe('validateSettingsInput', () => {
  it('accepts an https url and returns normalized settings', () => {
    const result = validateSettingsInput(
      ' https://swish.example.com/ ',
      ' tok-123 ',
    );
    expect(result).toEqual({
      ok: true,
      settings: { apiUrl: 'https://swish.example.com', pat: 'tok-123' },
    });
  });

  it('accepts http for localhost so local development still works', () => {
    const result = validateSettingsInput('http://localhost:3000', 'tok-123');
    expect(result).toEqual({
      ok: true,
      settings: { apiUrl: 'http://localhost:3000', pat: 'tok-123' },
    });
  });

  it('accepts http for the IPv4 loopback address', () => {
    const result = validateSettingsInput('http://127.0.0.1:3000', 'tok-123');
    expect(result.ok).toBe(true);
  });

  it('accepts http for the IPv6 loopback address', () => {
    // new URL('http://[::1]:3000').hostname keeps the brackets, so a plausible
    // "cleanup" of LOOPBACK_HOSTNAMES to '::1' would silently break this.
    const result = validateSettingsInput('http://[::1]:3000', 'tok-123');
    expect(result.ok).toBe(true);
  });

  it('rejects http for a remote host so the token is never sent in cleartext', () => {
    const result = validateSettingsInput('http://swish.example.com', 'tok-123');
    expect(result).toEqual({
      ok: false,
      message: 'URL must use https:// (http:// is allowed for localhost only).',
    });
  });

  it('rejects a url with a non-http(s) protocol', () => {
    const result = validateSettingsInput('ftp://swish.example.com', 'tok-123');
    expect(result).toEqual({
      ok: false,
      message: 'URL must use https:// (http:// is allowed for localhost only).',
    });
  });

  it('tells a user who omitted the scheme that the url is incomplete', () => {
    const result = validateSettingsInput('swish.example.com', 'tok-123');
    expect(result).toEqual({
      ok: false,
      message:
        'Enter a full URL, including https:// (for example https://swish.example.com).',
    });
  });

  it('rejects a blank access token', () => {
    const result = validateSettingsInput('https://swish.example.com', '   ');
    expect(result).toEqual({
      ok: false,
      message: 'Access token is required.',
    });
  });
});

describe('getSettings', () => {
  it('returns both values once they are stored', async () => {
    await apiUrlItem.setValue('https://swish.example.com');
    await patItem.setValue('tok-123');

    expect(await getSettings()).toEqual({
      apiUrl: 'https://swish.example.com',
      pat: 'tok-123',
    });
  });

  it('returns null when nothing is stored', async () => {
    expect(await getSettings()).toBeNull();
  });

  it('returns null when the url is set but the token is missing', async () => {
    await apiUrlItem.setValue('https://swish.example.com');

    expect(await getSettings()).toBeNull();
  });

  it('returns null when the token is set but the url is missing', async () => {
    await patItem.setValue('tok-123');

    expect(await getSettings()).toBeNull();
  });

  it('returns null for a stored http url so an old profile cannot leak the token', async () => {
    await apiUrlItem.setValue('http://swish.example.com');
    await patItem.setValue('tok-123');

    expect(await getSettings()).toBeNull();
  });

  it('normalizes a stored url that was written without normalization', async () => {
    await apiUrlItem.setValue('https://swish.example.com/');
    await patItem.setValue('tok-123');

    expect(await getSettings()).toEqual({
      apiUrl: 'https://swish.example.com',
      pat: 'tok-123',
    });
  });
});
