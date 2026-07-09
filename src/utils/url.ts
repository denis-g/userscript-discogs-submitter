import { escapeRegExp } from './regex';

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
    // Escape the literal pattern, then turn the escaped `\*` wildcard back into `.*`.
    new RegExp(`^${escapeRegExp(pattern).replace(/\\\*/g, '.*')}$`, 'i'),
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

/**
 * Checks whether a value is an absolute `http:`/`https:` URL. Scraped image URLs are gated
 * through this before they reach a CSS `url()` sink or a cross-origin `GM_xmlhttpRequest`,
 * so a hostile store page cannot smuggle a `file:`, `data:`, `blob:`, or `javascript:` URL
 * into a local-resource fetch or a stylesheet.
 *
 * @param value - The URL string to validate.
 * @returns True when `value` parses as an absolute `http:` or `https:` URL.
 *
 * @example
 * ```typescript
 * console.log(isHttpUrl('https://f4.bcbits.com/img/a1.jpg')); // true
 * console.log(isHttpUrl('file:///etc/passwd'));               // false
 * console.log(isHttpUrl(null));                               // false
 * ```
 */
export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const { protocol } = new URL(value);

    return protocol === 'http:' || protocol === 'https:';
  }
  catch {
    return false;
  }
}
