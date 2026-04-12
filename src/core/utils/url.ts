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
  const regexes = patterns.map(p =>
    new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`, 'i'),
  );

  return (url: string) => regexes.some(re => re.test(url));
}

/**
 * Extracts the last segment of the URL path (often used as a Release ID).
 *
 * @param url - The URL to extract the ID from. Defaults to current window location.
 * @returns The last segment of the URL path, or null if the path is empty.
 *
 * @example
 * ```typescript
 * const id = getReleaseIdFromUrl('https://example.com/release/title/12345');
 * console.log(id); // '12345'
 * ```
 */
export function getReleaseIdFromUrl(url: string = window.location.href): string | null {
  return url.split('/').filter(Boolean).at(-1) || null;
}
