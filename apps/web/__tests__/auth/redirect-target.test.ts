import { describe, expect, it } from 'vitest';
import { DEFAULT_REDIRECT, sanitizeRedirectPath } from '@/lib/auth/redirect-target';

describe('sanitizeRedirectPath', () => {
  it('keeps a local path with its query and hash', () => {
    expect(sanitizeRedirectPath('/items/123?from=inbox#summary'))
      .toBe('/items/123?from=inbox#summary');
  });

  it('falls back to the default when absent', () => {
    expect(sanitizeRedirectPath(null)).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirectPath(undefined)).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirectPath('')).toBe(DEFAULT_REDIRECT);
  });

  it('rejects absolute and scheme-relative URLs', () => {
    expect(sanitizeRedirectPath('https://evil.com')).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirectPath('//evil.com')).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirectPath('/\\evil.com')).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirectPath('evil.com')).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirectPath('/foo\\bar')).toBe(DEFAULT_REDIRECT);
  });

  it('rejects control characters that could split the Location header', () => {
    expect(sanitizeRedirectPath('/foo\r\nSet-Cookie: a=b')).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirectPath('/foo\u007f')).toBe(DEFAULT_REDIRECT);
  });

  it('leaves percent-encoded slashes alone — they stay same-origin', () => {
    expect(sanitizeRedirectPath('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
    expect(new URL('/%2F%2Fevil.com', 'https://swish.example.com').origin)
      .toBe('https://swish.example.com');
  });
});
