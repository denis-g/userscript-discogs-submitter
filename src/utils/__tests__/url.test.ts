import { afterEach, describe, expect, it } from 'vitest';
import { getReleaseIdFromUrl, isHttpUrl, isWebarchive, matchUrls } from '../url';

/** Stubs `unsafeWindow.location.href` for URL-based environment checks in tests. */
function stubLocation(href: string): void {
  (globalThis as any).unsafeWindow = { location: { href } };
}

describe('url utilities', () => {
  describe('matchUrls', () => {
    it('correctly matches glob patterns with *', () => {
      const isStore = matchUrls('https://*.example.com/*');

      expect(isStore('https://artist.example.com/album')).toBe(true);
      expect(isStore('https://example.com/album')).toBe(false);
    });

    it('matches multiple patterns', () => {
      const isStore = matchUrls('https://*.example.com/*', 'https://*.example.com/*');

      expect(isStore('https://artist.example.com/album')).toBe(true);
      expect(isStore('https://www.example.com/release/title/123456')).toBe(true);
    });

    it('is case-insensitive', () => {
      const matcher = matchUrls('https://EXAMPLE.com/*');

      expect(matcher('https://example.com/test')).toBe(true);
    });
  });

  describe('getReleaseIdFromUrl', () => {
    it('extracts the last segment as ID', () => {
      expect(getReleaseIdFromUrl('https://example.com/release/123456')).toBe('123456');
      expect(getReleaseIdFromUrl('https://example.com/release/title/123456/')).toBe('123456');
    });
  });

  describe('isWebarchive', () => {
    afterEach(() => {
      delete (globalThis as any).unsafeWindow;
    });

    it('returns true on a `https://web.archive.org/web/...` URL', () => {
      stubLocation('https://web.archive.org/web/timestamp/http://example.bandcamp.com/album/title');

      expect(isWebarchive()).toBe(true);
    });

    it('returns false on the live host URL', () => {
      stubLocation('https://example.bandcamp.com/album/title');

      expect(isWebarchive()).toBe(false);
    });

    it('returns false when the path is on web.archive.org but not `/web/...`', () => {
      stubLocation('https://web.archive.org/about/');

      expect(isWebarchive()).toBe(false);
    });

    it('returns false (no throw) when `unsafeWindow` is not defined', () => {
      expect(isWebarchive()).toBe(false);
    });
  });

  describe('isHttpUrl', () => {
    it('accepts absolute http and https URLs', () => {
      expect(isHttpUrl('https://example.com/cover.jpg')).toBe(true);
      expect(isHttpUrl('http://example.com/cover.jpg')).toBe(true);
    });

    it('rejects non-http(s) schemes that could smuggle local/inline resources', () => {
      expect(isHttpUrl('file:///etc/passwd')).toBe(false);
      expect(isHttpUrl('data:image/png;base64,AAAA')).toBe(false);
      expect(isHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isHttpUrl('blob:https://example.com/uuid')).toBe(false);
    });

    it('rejects empty, relative, or malformed values', () => {
      expect(isHttpUrl(null)).toBe(false);
      expect(isHttpUrl(undefined)).toBe(false);
      expect(isHttpUrl('')).toBe(false);
      expect(isHttpUrl('/relative/path.jpg')).toBe(false);
      expect(isHttpUrl('not a url')).toBe(false);
    });
  });
});
