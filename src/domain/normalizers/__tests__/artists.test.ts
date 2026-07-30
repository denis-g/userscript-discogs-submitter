import { describe, expect, it } from 'vitest';
import { groupExtraArtists, normalizeMainArtists, parseArtists } from '../artists';

describe('parseArtists', () => {
  it('treats "&"-joined names after "feat" as featured artists, not additional main artists', () => {
    const extraArtists: any[] = [];
    const result = parseArtists('Artist One Feat Artist Two & Artist Three', extraArtists);

    expect(result).toEqual([{ name: 'Artist One', join: ',' }]);
    expect(extraArtists).toEqual([
      { name: 'Artist Two', role: 'Featuring' },
      { name: 'Artist Three', role: 'Featuring' },
    ]);
  });

  it('keeps "&"-joined names before "feat" as separate main artists', () => {
    const extraArtists: any[] = [];
    const result = parseArtists('Artist One & Artist Two feat. Artist Three', extraArtists);

    expect(result).toEqual([
      { name: 'Artist One', join: '&' },
      { name: 'Artist Two', join: ',' },
    ]);
    expect(extraArtists).toEqual([{ name: 'Artist Three', role: 'Featuring' }]);
  });

  it('preserves a trailing single-letter abbreviation period in a featured artist name', () => {
    const extraArtists: any[] = [];
    const result = parseArtists('Artist One feat Artist B.', extraArtists);

    expect(result).toEqual([{ name: 'Artist One', join: ',' }]);
    expect(extraArtists).toEqual([{ name: 'Artist B.', role: 'Featuring' }]);
  });
});

describe('normalizeMainArtists', () => {
  it('converts 6 or more artists to "Various"', () => {
    const sixArtists = 'A1, A2, A3, A4, A5 & A6';
    const result = normalizeMainArtists(sixArtists);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Various');
  });

  it('keeps 5 or fewer artists lists', () => {
    const fiveArtists = 'A1, A2, A3, A4 & A5';
    const result = normalizeMainArtists(fiveArtists);

    expect(result).toHaveLength(5);
    expect(result[0].name).toBe('A1');
    expect(result[4].name).toBe('A5');
  });

  it('normalizes common VA variations to "Various"', () => {
    expect(normalizeMainArtists('VA')[0].name).toBe('Various');
    expect(normalizeMainArtists('Various Artists')[0].name).toBe('Various');
    expect(normalizeMainArtists('V/A')[0].name).toBe('Various');
  });

  it('elevates "Compiled By" artists to primary', () => {
    const extra = [{ name: 'Compiler Name', role: 'Compiled By' }];
    const result = normalizeMainArtists('Various Artists', extra);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Compiler Name');
  });
});

describe('groupExtraArtists', () => {
  it('merges different roles for the same artist', () => {
    const credits = [
      { name: 'Artist Name', role: 'Written-By' },
      { name: 'Artist Name', role: 'Producer' },
    ];
    const result = groupExtraArtists(credits);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Artist Name');
    // Roles are sorted alphabetically: Producer < Written-By
    expect(result[0].role).toBe('Producer, Written-By');
  });

  it('groups names case-insensitively', () => {
    const credits = [
      { name: 'Artist Name', role: 'Producer' },
      { name: 'Artist Name', role: 'Mixer' },
    ];
    const result = groupExtraArtists(credits);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Artist Name'); // Preserves first encountered casing
    expect(result[0].role).toBe('Mixer, Producer');
  });

  it('deduplicates identical roles', () => {
    const credits = [
      { name: 'Artist Name', role: 'Producer' },
      { name: 'Artist Name', role: 'Producer' },
    ];
    const result = groupExtraArtists(credits);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('Producer');
  });
});
