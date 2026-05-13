import { describe, expect, it } from 'vitest';
import { normalizeTitle, splitArtistTitle } from '../titles';

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
