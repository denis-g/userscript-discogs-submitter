import { describe, expect, it } from 'vitest';
import { normalizeLabel } from '../label';

describe('normalizeLabel', () => {
  it('should return "Not On Label" for empty input', () => {
    expect(normalizeLabel(null, 'Artist')).toBe('Not On Label');
    expect(normalizeLabel('', 'Artist')).toBe('Not On Label');
  });

  it('should transform matching label and artist to "Not On Label (... Self-released)"', () => {
    expect(normalizeLabel('Artist Name', 'Artist Name')).toBe('Not On Label (Artist Name Self-released)');
  });

  it('should be case-insensitive when matching', () => {
    expect(normalizeLabel('ARTIST NAME', 'Artist Name')).toBe('Not On Label (Artist Name Self-released)');
    expect(normalizeLabel('artist name', 'Artist Name')).toBe('Not On Label (Artist Name Self-released)');
    expect(normalizeLabel('Artist Name', 'ARTIST NAME')).toBe('Not On Label (ARTIST NAME Self-released)');
  });

  it('should trim whitespace when matching', () => {
    expect(normalizeLabel('  Artist Name  ', 'Artist Name')).toBe('Not On Label (Artist Name Self-released)');
    expect(normalizeLabel('Artist Name', '  Artist Name  ')).toBe('Not On Label (Artist Name Self-released)');
  });

  it('should return the original label if it does not match the artist', () => {
    expect(normalizeLabel('Label Name', 'Artist Name')).toBe('Label Name');
  });

  it('should handle missing artist gracefully', () => {
    expect(normalizeLabel('ARTIST NAME', null)).toBe('ARTIST NAME');
    expect(normalizeLabel('ARTIST NAME', '')).toBe('ARTIST NAME');
  });
});
