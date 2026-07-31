import { vi } from 'vitest';

/**
 * Replaces the global `fetch` for one test. Pass an Error to simulate a
 * transport failure; callers must `vi.unstubAllGlobals()` afterwards.
 */
export function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(
    (_url: string, _init: RequestInit): Promise<Response> =>
      response instanceof Error
        ? Promise.reject(response)
        : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
