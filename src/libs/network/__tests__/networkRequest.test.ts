import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { networkRequest } from '..';

/** Installs a `GM_xmlhttpRequest` stub that invokes the given handler with the request config. */
function stubGmRequest(handler: (_config: any) => void): ReturnType<typeof vi.fn> {
  const mock = vi.fn(handler);

  (globalThis as any).GM_xmlhttpRequest = mock;

  return mock;
}

describe('networkRequest', () => {
  beforeEach(() => {
    (globalThis as any).unsafeWindow = { location: { origin: 'https://example.com' } };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete (globalThis as any).GM_xmlhttpRequest;
    delete (globalThis as any).unsafeWindow;
    vi.restoreAllMocks();
  });

  it('resolves the responseText for a default (text) request on 2xx', async () => {
    stubGmRequest(config => config.onload({ status: 200, responseText: 'body', response: 'raw' }));

    await expect(networkRequest({ url: 'https://store.example/album' })).resolves.toBe('body');
  });

  it('resolves the parsed response for a json request on 2xx', async () => {
    stubGmRequest(config => config.onload({ status: 200, response: { id: 42 }, responseText: '{"id":42}' }));

    await expect(networkRequest({ url: 'https://store.example/api', responseType: 'json' })).resolves.toEqual({ id: 42 });
  });

  it('rejects with an HTTP error on a non-2xx status', async () => {
    stubGmRequest(config => config.onload({ status: 404, statusText: 'Not Found' }));

    await expect(networkRequest({ url: 'https://store.example/missing' }, 0)).rejects.toThrow('HTTP Error: 404 Not Found');
  });

  it('retries a failed attempt and resolves when a later attempt succeeds', async () => {
    let calls = 0;
    const mock = stubGmRequest((config) => {
      calls += 1;

      if (calls === 1) {
        config.onerror({ status: 0, statusText: '' });
      }
      else {
        config.onload({ status: 200, responseText: 'ok' });
      }
    });

    await expect(networkRequest({ url: 'https://store.example/album' }, 1)).resolves.toBe('ok');
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('rejects after exhausting all retries', async () => {
    const mock = stubGmRequest(config => config.ontimeout());

    await expect(networkRequest({ url: 'https://store.example/album' }, 1)).rejects.toThrow('Request timed out');
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('partitions cookies against the top-level site origin', async () => {
    const mock = stubGmRequest(config => config.onload({ status: 200, responseText: '' }));

    await networkRequest({ url: 'https://store.example/album' });

    expect(mock.mock.calls[0][0].cookiePartition.topLevelSite).toBe('https://example.com');
  });

  it('lets the caller override defaults (e.g. method) via options', async () => {
    const mock = stubGmRequest(config => config.onload({ status: 200, responseText: '' }));

    await networkRequest({ url: 'https://store.example/album', method: 'POST' });

    expect(mock.mock.calls[0][0].method).toBe('POST');
  });
});
