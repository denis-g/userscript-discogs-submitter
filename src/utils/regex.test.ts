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
      expect('Track Original Mix'.match(result[0])).not.toBeNull();
    });

    it('removes word boundaries for phrases ending in non-word characters (e.g. f/)', () => {
      const phrases = ['f/'];
      const templates = ['\\b{{p}}\\b']; // Template has \b bound to {{p}}
      const result = buildCreditRegexes(phrases, templates);

      // The boundary \b after {{p}} should be removed because "/" is not a word character
      expect(result[0].source).toBe('\\bf\\/');
      expect('ft. Artist One f/ Artist Two'.match(result[0])).not.toBeNull();
    });
  });

  describe('escapeRegExp', () => {
    it('escapes special regex characters', () => {
      expect(escapeRegExp('Artist One (feat. Artist Two) [Edit]')).toBe('Artist One \\(feat\\. Artist Two\\) \\[Edit\\]');
    });
  });

  describe('buildJoinerPattern', () => {
    it('builds a pattern for standard joiners', () => {
      const regex = buildJoinerPattern(['&', 'and', 'vs']);

      expect('Artist One & Artist Two'.split(regex).map(segment => segment.trim())).toContain('&');
      expect('Artist One and Artist Two'.split(regex).map(segment => segment.trim())).toContain('and');
      expect('Artist One vs Artist Two'.split(regex).map(segment => segment.trim())).toContain('vs');
      expect('Artist One, Artist Two'.split(regex).map(segment => segment.trim())).toContain(',');
    });

    it('handles special "x" joiner correctly (only when surrounded by spaces)', () => {
      const regex = buildJoinerPattern(['&', 'x']);

      expect('Artist One x Artist Two'.split(regex).map(segment => segment.trim())).toContain('x');
      expect('ArtistxArtist'.split(regex).map(segment => segment.trim())).not.toContain('x');
    });
  });

  describe('buildOxfordPattern', () => {
    it('builds a pattern for detecting Oxford commas', () => {
      const regex = buildOxfordPattern(['&', 'and']);

      expect(regex).not.toBeNull();
      if (regex) {
        expect('Artist One, Artist Two, & Artist Three'.replace(regex, ' $1 ')).toBe('Artist One, Artist Two & Artist Three');
        expect('Artist One, Artist Two, and Artist Three'.replace(regex, ' $1 ')).toBe('Artist One, Artist Two and Artist Three');
      }
    });

    it('returns null if no non-comma joiners provided', () => {
      expect(buildOxfordPattern([','])).toBeNull();
    });
  });
});
