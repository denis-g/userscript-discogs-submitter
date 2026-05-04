import { describe, expect, it } from 'vitest';
import { normalizeCountry } from './country';

describe('normalizeCountry', () => {
  it('should be case-insensitive for allowed countries', () => {
    expect(normalizeCountry('germany')).toBe('Germany');
    expect(normalizeCountry('uK')).toBe('UK');
    expect(normalizeCountry('WORLDWIDE')).toBe('Worldwide');
  });

  it('should map common variations to canonical names', () => {
    expect(normalizeCountry('USA')).toBe('US');
    expect(normalizeCountry('United States')).toBe('US');
    expect(normalizeCountry('United Kingdom')).toBe('UK');
    expect(normalizeCountry('The UK')).toBe('UK');
    expect(normalizeCountry('Great Britain')).toBe('UK');
    expect(normalizeCountry('Micronesia')).toBe('Micronesia, Federated States of');
    expect(normalizeCountry('Moldova')).toBe('Moldova, Republic of');
    expect(normalizeCountry('Holland')).toBe('Netherlands');
    expect(normalizeCountry('Czechia')).toBe('Czech Republic');
    expect(normalizeCountry('UAE')).toBe('United Arab Emirates');
  });

  it('should handle dots in abbreviations', () => {
    expect(normalizeCountry('U.S.A.')).toBe('US');
    expect(normalizeCountry('U.S.')).toBe('US');
    expect(normalizeCountry('U.K.')).toBe('UK');
  });

  it('should handle whitespace', () => {
    expect(normalizeCountry('  Germany  ')).toBe('Germany');
    expect(normalizeCountry('\tUS\n')).toBe('US');
  });

  it('should return empty string for invalid countries', () => {
    expect(normalizeCountry('Mars')).toBe('');
    expect(normalizeCountry('Atlantis')).toBe('');
    expect(normalizeCountry('Unknown')).toBe('');
  });

  it('should handle null/undefined/empty input', () => {
    expect(normalizeCountry(null)).toBe('');
    expect(normalizeCountry(undefined)).toBe('');
    expect(normalizeCountry('')).toBe('');
    expect(normalizeCountry('   ')).toBe('');
  });
});
