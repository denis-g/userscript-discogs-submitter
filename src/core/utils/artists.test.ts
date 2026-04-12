import { describe, expect, it } from 'vitest';
import { groupExtraArtists, normalizeTrackTitle, splitArtistTitle } from './artists';

describe('normalizeTrackTitle', () => {
  it('strips BPM from titles', () => {
    expect(normalizeTrackTitle('Track title (156bpm)')).toBe('Track Title');
    expect(normalizeTrackTitle('Track title 156bpm')).toBe('Track Title');
    expect(normalizeTrackTitle('Track title (156 bpm)')).toBe('Track Title');
    expect(normalizeTrackTitle('Track title [120 BPM]')).toBe('Track Title');
    expect(normalizeTrackTitle('Track title - 140 bpm')).toBe('Track Title');
  });

  it('standardizes capitalization and extra spaces', () => {
    expect(normalizeTrackTitle('  Track   Title  ')).toBe('Track Title');
  });
});

describe('splitArtistTitle', () => {
  const defaultArtists = [{ name: 'Test Artist', join: ',' }];

  it('splits artist and title by hyphen', () => {
    const result = splitArtistTitle('Artist A - Track Title', defaultArtists, []);

    expect(result.artists[0].name).toBe('Artist A');
    expect(result.title).toBe('Track Title');
  });

  it('ignores "Intro" as an artist (prefix case)', () => {
    const result = splitArtistTitle('Intro - Morning', defaultArtists, []);

    expect(result.artists).toEqual(defaultArtists);
    expect(result.title).toBe('Intro - Morning');
  });

  it('ignores "Outro" as an artist (prefix case)', () => {
    const result = splitArtistTitle('Outro - Night', defaultArtists, []);

    expect(result.artists).toEqual(defaultArtists);
    expect(result.title).toBe('Outro - Night');
  });

  it('ignores "Intro" as a title (suffix case)', () => {
    const result = splitArtistTitle('Morning - Intro', defaultArtists, []);

    expect(result.artists).toEqual(defaultArtists);
    expect(result.title).toBe('Morning - Intro');
  });

  it('ignores "Outro" as a title (suffix case)', () => {
    const result = splitArtistTitle('Night - Outro', defaultArtists, []);

    expect(result.artists).toEqual(defaultArtists);
    expect(result.title).toBe('Night - Outro');
  });

  it('is case-insensitive for technical parts', () => {
    const result = splitArtistTitle('INTRO - Morning', defaultArtists, []);

    expect(result.artists).toEqual(defaultArtists);
    expect(result.title).toBe('Intro - Morning');
  });
});

describe('groupExtraArtists', () => {
  it('merges different roles for the same artist', () => {
    const credits = [
      { name: 'Artist', role: 'Written-By' },
      { name: 'Artist', role: 'Producer' },
    ];
    const result = groupExtraArtists(credits);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Artist');
    // Roles are sorted alphabetically: Producer < Written-By
    expect(result[0].role).toBe('Producer, Written-By');
  });

  it('groups names case-insensitively', () => {
    const credits = [
      { name: 'Artist', role: 'Producer' },
      { name: 'artist', role: 'Mixer' },
    ];
    const result = groupExtraArtists(credits);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Artist'); // Preserves first encountered casing
    expect(result[0].role).toBe('Mixer, Producer');
  });

  it('deduplicates identical roles', () => {
    const credits = [
      { name: 'Artist', role: 'Producer' },
      { name: 'Artist', role: 'Producer' },
    ];
    const result = groupExtraArtists(credits);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('Producer');
  });
});

describe('normalizeTrackTitle with Credits', () => {
  it('extracts remixers from real-world trailing role pattern (Artist A Remix)', () => {
    const extra: any[] = [];
    const title = normalizeTrackTitle('Track title (Artist A Remix)', extra);

    expect(title).toBe('Track Title (Artist A Remix)');
    expect(extra).toContainEqual({ name: 'Artist A', role: 'Remix' });
  });

  it('does not extract remixers from mix name (Summer Mix)', () => {
    const extra: any[] = [];
    const title = normalizeTrackTitle('Track title (Summer Mix)', extra);

    expect(title).toBe('Track Title (Summer Mix)');
    expect(extra).toHaveLength(0);
  });

  it('handles multiple remixers in real-world format (Artist A & Artist B Remix)', () => {
    const extra: any[] = [];
    const title = normalizeTrackTitle('Track title (Artist A & Artist B Remix)', extra);

    expect(title).toBe('Track Title (Artist A & Artist B Remix)');
    expect(extra).toContainEqual({ name: 'Artist A', role: 'Remix' });
    expect(extra).toContainEqual({ name: 'Artist B', role: 'Remix' });
  });

  it('ignores technical versions as artists in real-world contexts (Original Mix, Edit)', () => {
    const extra: any[] = [];
    const title = normalizeTrackTitle('Track title (Original Mix)', extra);

    expect(title).toBe('Track Title');
    expect(extra).toHaveLength(0);

    const extra2: any[] = [];
    const title2 = normalizeTrackTitle('Track title (Edit)', extra2);

    expect(title2).toBe('Track Title (Edit)');
    expect(extra2).toHaveLength(0);
  });
});
