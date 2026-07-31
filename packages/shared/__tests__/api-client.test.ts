import { describe, it, expect } from 'vitest';
import {
  buildBookmarkPostRequest,
  normalizeApiUrl,
} from '../src/api-client';

const client = { apiUrl: 'https://swish.example.com/', pat: 'tok-123' };

describe('normalizeApiUrl', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeApiUrl('  https://swish.example.com  ')).toBe(
      'https://swish.example.com',
    );
  });

  it('strips a single trailing slash', () => {
    expect(normalizeApiUrl('https://swish.example.com/')).toBe(
      'https://swish.example.com',
    );
  });

  it('strips repeated trailing slashes so every client builds the same path', () => {
    expect(normalizeApiUrl('https://swish.example.com//')).toBe(
      'https://swish.example.com',
    );
  });

  it('leaves an already normalized url unchanged', () => {
    expect(normalizeApiUrl('https://swish.example.com')).toBe(
      'https://swish.example.com',
    );
  });

  it('keeps a base path intact', () => {
    expect(normalizeApiUrl('https://swish.example.com/swish/')).toBe(
      'https://swish.example.com/swish',
    );
  });
});

describe('buildBookmarkPostRequest', () => {
  it('targets the bookmarks endpoint on the normalized base url', () => {
    const { url } = buildBookmarkPostRequest(client, { url: 'https://a.test' });
    expect(url).toBe('https://swish.example.com/api/bookmarks');
  });

  it('sends a JSON body with Bearer auth', () => {
    const { init } = buildBookmarkPostRequest(client, {
      url: 'https://a.test',
      title: 'A',
    });
    const headers = init.headers as Record<string, string>;

    expect(init.method).toBe('POST');
    expect(headers.authorization).toBe('Bearer tok-123');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      url: 'https://a.test',
      title: 'A',
    });
  });
});
