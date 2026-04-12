/**
 * Wrapper for `GM_xmlhttpRequest` that provides a Promise-based API for cross-origin network fetching.
 * Includes built-in configurable retries and timeout handling.
 *
 * @param options - The native Tampermonkey request configuration object.
 * @param retries - Number of automatic retry attempts before failing (default: 2).
 * @param timeout - Request timeout threshold in milliseconds (default: 15000).
 * @returns A promise resolving to the final HTTP response (either a string or Blob).
 * @throws {Error} When network fails, status is not 2xx, or request times out after all retries are exhausted.
 *
 * @example
 * ```typescript
 * try {
 *   const html = await networkRequest({ url: 'https://example.com' });
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 */
export function networkRequest(options: Tampermonkey.Request, retries = 2, timeout = 15000): Promise<string | Blob | any> {
  const attempt = (currentTry: number): Promise<string | Blob | any> =>
    new Promise((resolve, reject) => {
      const config: Tampermonkey.Request = {
        method: 'GET',
        timeout,
        ...options,
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) {
            resolve(!config.responseType || (config.responseType as string) === 'text' ? response.responseText : response.response);
          }
          else {
            reject(new Error(`HTTP Error: ${response.status} ${response.statusText || ''}`.trim()));
          }
        },
        onerror: (response) => {
          const statusText = (response as any).statusText || '';

          reject(new Error(`Network Error: ${response.status} ${statusText}`.trim() || 'Connection failed'));
        },
        ontimeout: () => reject(new Error('Request timed out')),
      };

      GM_xmlhttpRequest(config);
    }).catch((error) => {
      if (currentTry < retries) {
        console.warn(`[Discogs Submitter] Request failed (${error.message}). Retrying... (${currentTry + 1}/${retries})`);

        return attempt(currentTry + 1);
      }

      throw error;
    });

  return attempt(0);
}
