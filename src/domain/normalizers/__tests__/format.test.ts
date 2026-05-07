import { describe, expect, it } from 'vitest';
import { extractFormatFromTitle } from '../format';

describe('extractFormatFromTitle', () => {
  it('returns an empty array for null, undefined, or empty titles', () => {
    expect(extractFormatFromTitle(null)).toEqual([]);
    expect(extractFormatFromTitle(undefined)).toEqual([]);
    expect(extractFormatFromTitle('')).toEqual([]);
  });

  it('extracts "Deluxe Edition" from various keywords', () => {
    expect(extractFormatFromTitle('Album Title (Deluxe)')).toContain('Deluxe Edition');
    expect(extractFormatFromTitle('Album Title (Deluxe Version)')).toContain('Deluxe Edition');
  });

  it('extracts "Reissue" from title', () => {
    expect(extractFormatFromTitle('Album Title (Reissue)')).toContain('Reissue');
  });

  it('extracts "Remastered" from title keywords', () => {
    expect(extractFormatFromTitle('Album Title (Remaster)')).toContain('Remastered');
    expect(extractFormatFromTitle('Album Title (Remastered)')).toContain('Remastered');
  });

  it('extracts "Limited Edition" from title', () => {
    expect(extractFormatFromTitle('Album Title (Ltd Edition)')).toContain('Limited Edition');
  });

  it('extracts "EP" from various variations', () => {
    const variations = ['Album Title EP', 'Album Title E.P', 'Album Title E.P.', 'Album Title (EP)', 'Album Title (E.P)', 'Album Title (E.P.)'];

    variations.forEach((title) => {
      expect(extractFormatFromTitle(title)).toContain('EP');
    });
  });

  it('extracts "Single" from title', () => {
    expect(extractFormatFromTitle('Album Title (Single)')).toContain('Single');
  });

  it('extracts multiple formats from a single title', () => {
    const result = extractFormatFromTitle('Album Title (Deluxe) (Remastered) EP');

    expect(result).toHaveLength(3);
    expect(result).toContain('Deluxe Edition');
    expect(result).toContain('Remastered');
    expect(result).toContain('EP');
  });

  it('handles formats in complex parenthesized lists', () => {
    const result = extractFormatFromTitle('Album Title (2019, EP, Remastered)');

    expect(result).toContain('EP');
    expect(result).toContain('Remastered');
  });

  it('extracts "Compilation" from title', () => {
    expect(extractFormatFromTitle('Album Title (Compilation)')).toContain('Compilation');
    expect(extractFormatFromTitle('Album Title (Compiled by)')).toContain('Compilation');
  });

  it('is case-insensitive', () => {
    expect(extractFormatFromTitle('ALBUM TITLE (DELUXE)')).toContain('Deluxe Edition');
    expect(extractFormatFromTitle('album title (ep)')).toContain('EP');
  });

  it('does not pre-select formats with empty keyword lists (e.g., Mini-Album)', () => {
    expect(extractFormatFromTitle('Album Title (Mini-Album)')).not.toContain('Mini-Album');
  });
});
