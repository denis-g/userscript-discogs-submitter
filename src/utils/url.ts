/**
 * Converts glob-style URL patterns (using * as wildcard) into RegExp testers.
 *
 * @param patterns - One or more string patterns where `*` acts as a wildcard.
 * @returns A predicate function that takes a URL and returns true if it matches any pattern.
 *
 * @example
 * ```typescript
 * const isBandcamp = matchUrls('https://*.bandcamp.com/*');
 * console.log(isBandcamp('https://artist.bandcamp.com/album')); // true
 * ```
 */
export function matchUrls(...patterns: string[]): (_url: string) => boolean {
  const regexes = patterns.map(pattern =>
    new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`, 'i'),
  );

  return (url: string) => regexes.some(regex => regex.test(url));
}

/**
 * Extracts the last segment of the URL path (often used as a Release ID).
 *
 * @param url - The URL to extract the ID from. Defaults to current window location.
 * @returns The last segment of the URL path, or null if the path is empty.
 *
 * @example
 * ```typescript
 * const identifier = getReleaseIdFromUrl('https://example.com/release/title/12345');
 * console.log(identifier); // '12345'
 * ```
 */
export function getReleaseIdFromUrl(url: string = unsafeWindow.location.href): string | null {
  try {
    const path = new URL(url).pathname;

    return path.split('/').filter(Boolean).at(-1) || null;
  }
  catch {
    return url.split('/').filter(Boolean).at(-1) || null;
  }
}

/**
 * Detects whether the current page is a Wayback Machine snapshot by inspecting
 * `unsafeWindow.location` for a `https://web.archive.org/web/...` URL.
 *
 * @returns True when running on an archived snapshot.
 *
 * @example
 * ```typescript
 * if (isWebarchive()) {
 *   // pick selectors for the legacy Bandcamp layout
 * }
 * ```
 */
export function isWebarchive(): boolean {
  try {
    const url = new URL(unsafeWindow.location.href);

    return url.hostname === 'web.archive.org' && url.pathname.startsWith('/web/');
  }
  catch {
    // ignore — fall through
  }

  return false;
}
