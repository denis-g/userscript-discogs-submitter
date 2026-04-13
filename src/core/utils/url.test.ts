import { describe, expect, it } from 'vitest';
import { getReleaseIdFromUrl, matchUrls } from './url';

describe('url utilities', () => {
  describe('matchUrls', () => {
    it('correctly matches glob patterns with *', () => {
      const isBandcamp = matchUrls('https://*.example.com/*');

      expect(isBandcamp('https://artist.example.com/album')).toBe(true);
      expect(isBandcamp('https://other.com/album')).toBe(false);
    });

    it('matches multiple patterns', () => {
      const isStore = matchUrls('https://*.example.com/*', 'https://*.example.щкп/*');

      expect(isStore('https://artist.example.com/album')).toBe(true);
      expect(isStore('https://www.example.com/release/title/1')).toBe(true);
    });

    it('is case-insensitive', () => {
      const matcher = matchUrls('https://EXAMPLE.com/*');

      expect(matcher('https://example.com/test')).toBe(true);
    });
  });

  describe('getReleaseIdFromUrl', () => {
    it('extracts the last segment as ID', () => {
      expect(getReleaseIdFromUrl('https://example.com/release/12345')).toBe('12345');
      expect(getReleaseIdFromUrl('https://example.com/release/title/12345/')).toBe('12345');
    });
  });
});
