import { describe, expect, it } from 'vitest';
import { buildBookmarklet } from '@/lib/bookmarklet/template';

function decodeBookmarklet(link: string): string {
  return decodeURIComponent(link.replace(/^javascript:/, ''));
}

describe('buildBookmarklet', () => {
  it('produces a javascript: URL containing the api endpoint and PAT', () => {
    const link = buildBookmarklet({
      apiUrl: 'https://swish.example',
      pat: 'tok-123',
    });
    expect(link.startsWith('javascript:')).toBe(true);
    const decoded = decodeBookmarklet(link);
    expect(decoded).toContain('https://swish.example/api/bookmarks');
    expect(decoded).toContain('Bearer tok-123');
    expect(decoded).toContain('location.href');
  });

  it('trims a trailing slash from apiUrl', () => {
    const link = buildBookmarklet({ apiUrl: 'http://localhost:3000/', pat: 'x' });
    const decoded = decodeBookmarklet(link);
    expect(decoded).toContain('http://localhost:3000/api/bookmarks');
    expect(decoded).not.toContain('com//api');
  });

  it('throws when required inputs are missing', () => {
    expect(() => buildBookmarklet({ apiUrl: '', pat: 'tok' })).toThrow(/apiUrl/);
    expect(() => buildBookmarklet({ apiUrl: 'http://x', pat: '' })).toThrow(/pat/);
  });

  it('rejects apiUrl values that are not http(s)', () => {
    expect(() =>
      buildBookmarklet({ apiUrl: 'javascript:alert(1)', pat: 'tok' }),
    ).toThrow(/http/);
  });

  it('embeds the CORS + JSON request shape so the bookmarklet matches /api/bookmarks', () => {
    const decoded = decodeBookmarklet(
      buildBookmarklet({ apiUrl: 'https://swish.example', pat: 'tok' }),
    );
    expect(decoded).toContain("mode: 'cors'");
    expect(decoded).toContain("'Content-Type': 'application/json'");
    expect(decoded).toContain('Saved to Swish');
  });

  it('produces a body that parses as valid JavaScript after minification', () => {
    const decoded = decodeBookmarklet(
      buildBookmarklet({ apiUrl: 'https://swish.example', pat: 'tok' }),
    );
    // Should not throw a SyntaxError. We do not execute the IIFE — running
    // fetch() in the vitest env is unhelpful — only the parser pass matters.
    expect(() => new Function(`return (function(){ ${decoded} });`)).not.toThrow();
  });

  it('handles PAT values that contain $& without re-injecting the matched pattern', () => {
    const decoded = decodeBookmarklet(
      buildBookmarklet({ apiUrl: 'https://swish.example', pat: 'x$&y' }),
    );
    expect(decoded).toContain('Bearer x$&y');
    expect(decoded).not.toContain('__PAT__');
  });
});
