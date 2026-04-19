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
      const isStore = matchUrls('https://*.example.com/*', 'https://*.example.com/*');

      expect(isStore('https://artist.example.com/album')).toBe(true);
      expect(isStore('https://www.example.com/release/title/1')).toBe(true);
    });

    it('is case-insensitive', () => {
      const matcher = matchUrls('https://EXAMPLE.com/*');

      expect(matcher('https://example.com/test')).toBe(true);
    });

    it('matches Amazon Music patterns correctly', () => {
      const isAmazon = matchUrls(
        'https://*.amazon.*/*/dp/*',
        'https://*.amazon.*/music/player/albums/*',
      );

      expect(isAmazon('https://www.amazon.com/Title/dp/123456')).toBe(true);
      expect(isAmazon('https://www.amazon.com/music/player/albums/123456')).toBe(true);
      expect(isAmazon('https://example.amazon.com/other')).toBe(false);
    });
  });

  describe('getReleaseIdFromUrl', () => {
    it('extracts the last segment as ID', () => {
      expect(getReleaseIdFromUrl('https://example.com/release/123456')).toBe('123456');
      expect(getReleaseIdFromUrl('https://example.com/release/title/123456/')).toBe('123456');
    });
  });
});
