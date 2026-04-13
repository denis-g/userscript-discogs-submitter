import { describe, expect, it } from 'vitest';
import {
  buildCreditRegexes,
  buildJoinerPattern,
  buildOxfordPattern,
  escapeRegExp,
} from './regex';

describe('regex utilities', () => {
  describe('buildCreditRegexes', () => {
    it('replaces placeholder {{p}} with phrase and compiles to regex', () => {
      const phrases = ['remix'];
      const templates = ['\\b{{p}}\\b'];
      const result = buildCreditRegexes(phrases, templates);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('\\bremix\\b');
      expect('Testing remix track'.match(result[0])).not.toBeNull();
    });

    it('handles phrases with multiple words', () => {
      const phrases = ['original mix'];
      const templates = ['\\b{{p}}\\b'];
      const result = buildCreditRegexes(phrases, templates);

      expect(result[0].source).toBe('\\boriginal\\s+mix\\b');
      expect('Track original  mix'.match(result[0])).not.toBeNull();
    });

    it('removes word boundaries for phrases ending in non-word characters (e.g. f/)', () => {
      const phrases = ['f/'];
      const templates = ['\\b{{p}}\\b']; // Template has \b bound to {{p}}
      const result = buildCreditRegexes(phrases, templates);

      // The boundary \b after {{p}} should be removed because "/" is not a word character
      expect(result[0].source).toBe('\\bf\\/');
      expect('ft. Artist f/ Other'.match(result[0])).not.toBeNull();
    });
  });

  describe('escapeRegExp', () => {
    it('escapes special regex characters', () => {
      expect(escapeRegExp('artist (feat. remix) [edit]')).toBe('artist \\(feat\\. remix\\) \\[edit\\]');
    });
  });

  describe('buildJoinerPattern', () => {
    it('builds a pattern for standard joiners', () => {
      const regex = buildJoinerPattern(['&', 'and', 'vs']);

      expect('A & B'.split(regex).map(s => s.trim())).toContain('&');
      expect('A vs B'.split(regex).map(s => s.trim())).toContain('vs');
      expect('A, B'.split(regex).map(s => s.trim())).toContain(',');
    });

    it('handles special "x" joiner correctly (only when surrounded by spaces)', () => {
      const regex = buildJoinerPattern(['&', 'x']);

      expect('Artist x Artist'.split(regex).map(s => s.trim())).toContain('x');
      expect('ArtistxArtist'.split(regex).map(s => s.trim())).not.toContain('x');
    });
  });

  describe('buildOxfordPattern', () => {
    it('builds a pattern for detecting Oxford commas', () => {
      const regex = buildOxfordPattern(['&', 'and']);

      expect(regex).not.toBeNull();
      if (regex) {
        expect('A, B, & C'.replace(regex, ' $1 ')).toBe('A, B & C');
        expect('A, B, and C'.replace(regex, ' $1 ')).toBe('A, B and C');
      }
    });

    it('returns null if no non-comma joiners provided', () => {
      expect(buildOxfordPattern([','])).toBeNull();
    });
  });
});
