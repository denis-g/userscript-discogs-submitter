import { describe, expect, it } from 'vitest';
import {
  groupExtraArtists,
  normalizeMainArtists,
  normalizeTitle,
  splitArtistTitle,
} from './artists';

describe('normalizeMainArtists', () => {
  it('converts 4 or more artists to "Various"', () => {
    const fourArtists = 'Artist One, Artist Two, Artist Three & Artist Four';
    const result = normalizeMainArtists(fourArtists);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Various');
  });

  it('keeps 3 or fewer artists lists', () => {
    const threeArtists = 'Artist One, Artist Two & Artist Three';
    const result = normalizeMainArtists(threeArtists);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Artist One');
    expect(result[1].name).toBe('Artist Two');
    expect(result[2].name).toBe('Artist Three');
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

describe('normalizeTitle', () => {
  it('strips BPM from titles', () => {
    expect(normalizeTitle('Track Title 123bpm')).toBe('Track Title');
    expect(normalizeTitle('Track Title 123 bpm')).toBe('Track Title');
    expect(normalizeTitle('Track Title - 123 bpm')).toBe('Track Title');
    expect(normalizeTitle('Track Title - 123bpm')).toBe('Track Title');
    expect(normalizeTitle('Track Title (123 bpm)')).toBe('Track Title');
    expect(normalizeTitle('Track Title (123bpm)')).toBe('Track Title');
    expect(normalizeTitle('Track Title [123 BPM]')).toBe('Track Title');
    expect(normalizeTitle('Track Title [123BPM]')).toBe('Track Title');
  });

  it('standardizes capitalization and extra spaces', () => {
    expect(normalizeTitle('  Track   Title  ')).toBe('Track Title');
  });
});

describe('splitArtistTitle', () => {
  const defaultArtists = [{ name: 'Test Artist', join: ',' }];

  it('splits artist and title by hyphen', () => {
    const result = splitArtistTitle('Artist Name - Track Title', defaultArtists, []);

    expect(result.artists[0].name).toBe('Artist Name');
    expect(result.title).toBe('Track Title');
  });

  it('ignores "Intro" as an artist (prefix case)', () => {
    const result = splitArtistTitle('Intro - Title', defaultArtists, []);

    expect(result.artists).toEqual(defaultArtists);
    expect(result.title).toBe('Intro - Title');
  });

  it('ignores "Outro" as an artist (prefix case)', () => {
    const result = splitArtistTitle('Outro - Title', defaultArtists, []);

    expect(result.artists).toEqual(defaultArtists);
    expect(result.title).toBe('Outro - Title');
  });

  it('ignores "Intro" as a title (suffix case)', () => {
    const result = splitArtistTitle('Title - Intro', defaultArtists, []);

    expect(result.artists).toEqual(defaultArtists);
    expect(result.title).toBe('Title - Intro');
  });

  it('ignores "Outro" as a title (suffix case)', () => {
    const result = splitArtistTitle('Title - Outro', defaultArtists, []);

    expect(result.artists).toEqual(defaultArtists);
    expect(result.title).toBe('Title - Outro');
  });

  it('is case-insensitive for technical parts', () => {
    const result = splitArtistTitle('INTRO - TITLE', defaultArtists, []);

    expect(result.artists).toEqual(defaultArtists);
    expect(result.title).toBe('Intro - Title');
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

describe('normalizeTitle with Credits', () => {
  it('extracts remixers from real-world trailing role pattern (Artist Name Remix)', () => {
    const extra: any[] = [];
    const title = normalizeTitle('Track Title (Artist Name Remix)', extra);

    expect(title).toBe('Track Title (Artist Name Remix)');
    expect(extra).toContainEqual({ name: 'Artist Name', role: 'Remix' });
  });

  it('does not extract remixers from mix name (Summer Mix)', () => {
    const extra: any[] = [];
    const title = normalizeTitle('Track Title (Summer Mix)', extra);

    expect(title).toBe('Track Title (Summer Mix)');
    expect(extra).toHaveLength(0);
  });

  it('handles multiple remixers in real-world format (Artist One & Artist Two Remix)', () => {
    const extra: any[] = [];
    const title = normalizeTitle('Track Title (Artist One & Artist Two Remix)', extra);

    expect(title).toBe('Track Title (Artist One & Artist Two Remix)');
    expect(extra).toContainEqual({ name: 'Artist One', role: 'Remix' });
    expect(extra).toContainEqual({ name: 'Artist Two', role: 'Remix' });
  });

  it('ignores technical versions as artists in real-world contexts (Original Mix, Edit)', () => {
    const extra: any[] = [];
    const title = normalizeTitle('Track Title (Original Mix)', extra);

    expect(title).toBe('Track Title');
    expect(extra).toHaveLength(0);

    const extra2: any[] = [];
    const title2 = normalizeTitle('Track Title (Edit)', extra2);

    expect(title2).toBe('Track Title (Edit)');
    expect(extra2).toHaveLength(0);
  });

  it('prevents bridging between consecutive parenthesized groups (Remix + Instrumental)', () => {
    const extra: any[] = [];
    const title = normalizeTitle('Track Title (Remix) (Instrumental)', extra);

    expect(title).toBe('Track Title (Remix) (Instrumental)');
    expect(extra).toHaveLength(0);
  });

  it('extracts artist from possessive remix patterns (Artist\'s Remix)', () => {
    const extra: any[] = [];
    const title = normalizeTitle('Track Title (Artist Name\'s Title Remix)', extra);

    expect(title).toBe('Track Title (Artist Name\'s Title Remix)');
    expect(extra).toContainEqual({ name: 'Artist Name', role: 'Remix' });

    const extra2: any[] = [];

    expect(normalizeTitle('Track Title (Artist Name\'s Re-Mix)', extra2)).toBe('Track Title (Artist Name\'s Re-Mix)');
    expect(extra2).toContainEqual({ name: 'Artist Name', role: 'Remix' });
  });
});
