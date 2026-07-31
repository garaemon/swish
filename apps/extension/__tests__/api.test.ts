import { describe, it, expect, vi, afterEach } from 'vitest';
import { saveBookmark } from '../lib/api';
import { stubFetch } from './stub-fetch';

const client = { apiUrl: 'https://swish.example.com/', pat: 'tok-123' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveBookmark', () => {
  it('maps a 2xx JSON response to saved', async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ id: 'x', status: 'pending' }), {
        status: 200,
      }),
    );

    const result = await saveBookmark(client, { url: 'https://a.test' });

    // The request itself is @swish/shared's contract; assert only that the
    // shared builder is what produced it.
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://swish.example.com/api/bookmarks',
    );
    expect(result).toEqual({
      kind: 'saved',
      response: { id: 'x', status: 'pending' },
    });
  });

  it('maps 409 to duplicate', async () => {
    stubFetch(new Response('{}', { status: 409 }));
    const result = await saveBookmark(client, { url: 'https://a.test' });
    expect(result).toEqual({ kind: 'duplicate' });
  });

  it('maps 401 and 403 to auth_error', async () => {
    stubFetch(new Response('{}', { status: 401 }));
    expect(await saveBookmark(client, { url: 'https://a.test' })).toEqual({
      kind: 'auth_error',
    });
    stubFetch(new Response('{}', { status: 403 }));
    expect(await saveBookmark(client, { url: 'https://a.test' })).toEqual({
      kind: 'auth_error',
    });
  });

  it('maps other non-2xx to http_error with the status', async () => {
    stubFetch(new Response('boom', { status: 500 }));
    const result = await saveBookmark(client, { url: 'https://a.test' });
    expect(result).toEqual({ kind: 'http_error', status: 500 });
  });

  it('maps a 2xx response with a non-JSON body to invalid_response', async () => {
    // Captive portals and proxies answer 200 with HTML. The server accepted the
    // request, so this must not be reported as a failed save.
    stubFetch(new Response('<html>captive portal</html>', { status: 200 }));
    const result = await saveBookmark(client, { url: 'https://a.test' });
    expect(result).toEqual({ kind: 'invalid_response' });
  });

  it('maps a thrown fetch to network_error', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    const result = await saveBookmark(client, { url: 'https://a.test' });
    expect(result).toEqual({
      kind: 'network_error',
      message: 'Failed to fetch',
    });
  });
});
