import { describe, it, expect, vi, afterEach } from 'vitest';
import { postBookmark } from '../lib/api';

const client = { apiUrl: 'https://swish.example.com/', pat: 'tok-123' };

function mockFetch(response: Response | Error) {
  const fn = vi.fn(
    (_url: string, _init: RequestInit): Promise<Response> =>
      response instanceof Error
        ? Promise.reject(response)
        : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postBookmark', () => {
  it('strips the trailing slash and sends Bearer auth + JSON body', async () => {
    const fetchFn = mockFetch(
      new Response(JSON.stringify({ id: 'x', status: 'pending' }), {
        status: 200,
      }),
    );

    const result = await postBookmark(client, { url: 'https://a.test' });

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://swish.example.com/api/bookmarks');
    expect(init.method).toBe('POST');
    expect(headers.authorization).toBe('Bearer tok-123');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ url: 'https://a.test' });
    expect(result).toEqual({
      kind: 'saved',
      response: { id: 'x', status: 'pending' },
    });
  });

  it('maps 409 to duplicate', async () => {
    mockFetch(new Response('{}', { status: 409 }));
    const result = await postBookmark(client, { url: 'https://a.test' });
    expect(result).toEqual({ kind: 'duplicate' });
  });

  it('maps 401 and 403 to auth_error', async () => {
    mockFetch(new Response('{}', { status: 401 }));
    expect(await postBookmark(client, { url: 'https://a.test' })).toEqual({
      kind: 'auth_error',
    });
    mockFetch(new Response('{}', { status: 403 }));
    expect(await postBookmark(client, { url: 'https://a.test' })).toEqual({
      kind: 'auth_error',
    });
  });

  it('maps other non-2xx to http_error with the status', async () => {
    mockFetch(new Response('boom', { status: 500 }));
    const result = await postBookmark(client, { url: 'https://a.test' });
    expect(result).toEqual({ kind: 'http_error', status: 500 });
  });

  it('maps a thrown fetch to network_error', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    const result = await postBookmark(client, { url: 'https://a.test' });
    expect(result).toEqual({
      kind: 'network_error',
      message: 'Failed to fetch',
    });
  });
});
