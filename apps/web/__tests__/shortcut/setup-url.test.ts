import { describe, expect, it } from 'vitest';
import {
  buildShortcutSetupUrl,
  SHORTCUT_CONFIG_PREFIX,
  SHORTCUT_NAME,
} from '@/lib/shortcut/setup-url';

function decodeTextParam(link: string): string {
  const params = new URLSearchParams(link.replace(/^shortcuts:\/\/run-shortcut\?/, ''));
  return params.get('text') ?? '';
}

describe('buildShortcutSetupUrl', () => {
  it('produces a shortcuts://run-shortcut URL targeting the template by name', () => {
    const link = buildShortcutSetupUrl({
      apiUrl: 'https://swish.example',
      pat: 'tok-123',
    });
    expect(link.startsWith('shortcuts://run-shortcut?')).toBe(true);
    const params = new URLSearchParams(link.replace(/^shortcuts:\/\/run-shortcut\?/, ''));
    expect(params.get('name')).toBe(SHORTCUT_NAME);
    expect(params.get('input')).toBe('text');
  });

  it('passes the config JSON with the swish-config: prefix', () => {
    const link = buildShortcutSetupUrl({
      apiUrl: 'https://swish.example',
      pat: 'tok-123',
    });
    const text = decodeTextParam(link);
    expect(text.startsWith(SHORTCUT_CONFIG_PREFIX)).toBe(true);
    const config = JSON.parse(text.slice(SHORTCUT_CONFIG_PREFIX.length)) as {
      endpoint: string
      authorization: string
    };
    expect(config).toEqual({
      endpoint: 'https://swish.example/api/bookmarks',
      authorization: 'Bearer tok-123',
    });
  });

  it('trims a trailing slash from apiUrl', () => {
    const link = buildShortcutSetupUrl({ apiUrl: 'http://localhost:3000/', pat: 'x' });
    const text = decodeTextParam(link);
    expect(text).toContain('http://localhost:3000/api/bookmarks');
    expect(text).not.toContain('3000//api');
  });

  it('survives PATs with URL-hostile characters via query encoding', () => {
    const pat = 'a+b&c=d "quoted"';
    const link = buildShortcutSetupUrl({ apiUrl: 'https://swish.example', pat });
    const text = decodeTextParam(link);
    const config = JSON.parse(text.slice(SHORTCUT_CONFIG_PREFIX.length)) as {
      authorization: string
    };
    expect(config.authorization).toBe(`Bearer ${pat}`);
  });

  it('throws when required inputs are missing', () => {
    expect(() => buildShortcutSetupUrl({ apiUrl: '', pat: 'tok' })).toThrow(/apiUrl/);
    expect(() => buildShortcutSetupUrl({ apiUrl: 'http://x', pat: '' })).toThrow(/pat/);
  });

  it('rejects apiUrl values that are not http(s)', () => {
    expect(() =>
      buildShortcutSetupUrl({ apiUrl: 'javascript:alert(1)', pat: 'tok' }),
    ).toThrow(/http/);
  });
});
