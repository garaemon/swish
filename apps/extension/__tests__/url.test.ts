import { describe, it, expect } from 'vitest';
import { isHttpUrl } from '../lib/url';

describe('isHttpUrl', () => {
  it('accepts https', () => {
    expect(isHttpUrl('https://a.test')).toBe(true);
  });

  it('accepts http', () => {
    expect(isHttpUrl('http://a.test')).toBe(true);
  });

  it('rejects a browser-internal url', () => {
    expect(isHttpUrl('chrome://extensions')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isHttpUrl(undefined)).toBe(false);
  });
});
