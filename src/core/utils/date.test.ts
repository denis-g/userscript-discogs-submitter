import { describe, expect, it } from 'vitest';
import { normalizeReleaseDate } from './date';

describe('normalizeReleaseDate', () => {
  it('normalizes Bandcamp date formats (DD Mmm YYYY)', () => {
    expect(normalizeReleaseDate('05 Aug 2024')).toBe('2024-08-05');
    expect(normalizeReleaseDate('5 Aug 2024')).toBe('2024-08-05');
  });

  it('normalizes partial Bandcamp patterns (Mmm YYYY)', () => {
    expect(normalizeReleaseDate('Aug 2024')).toBe('2024-08-00');
  });

  it('normalizes 7digital date formats (DD/MM/YYYY)', () => {
    expect(normalizeReleaseDate('05/08/2024')).toBe('2024-08-05');
    expect(normalizeReleaseDate('5/8/2024')).toBe('2024-08-05');
  });

  it('normalizes Juno Download date formats (DD Mmmm, YYYY)', () => {
    expect(normalizeReleaseDate('14 April, 2011')).toBe('2011-04-14');
    expect(normalizeReleaseDate('14 April 2011')).toBe('2011-04-14');
  });

  it('extracts year from strings containing year-only info', () => {
    expect(normalizeReleaseDate('2009')).toBe('2009');
    expect(normalizeReleaseDate('Published in 1954')).toBe('1954');
  });

  it('returns null for empty or invalid input', () => {
    expect(normalizeReleaseDate('')).toBeNull();
    expect(normalizeReleaseDate(null)).toBeNull();
    expect(normalizeReleaseDate(undefined)).toBeNull();
  });
});
