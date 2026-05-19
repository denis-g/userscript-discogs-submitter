import type { ReleaseData } from '@/types';
import { describe, expect, it } from 'vitest';
import { DiscogsMapper } from '..';

const SOURCE_URL = 'https://example.bandcamp.com/album/x';

/** Builds a minimal `ReleaseData` fixture with sensible defaults; override per test. */
function makeRelease(overrides: Partial<ReleaseData> = {}): ReleaseData {
  return {
    thumb: null,
    cover: null,
    title: 'Album',
    artists: [{ name: 'Artist', join: ',' }],
    extraartists: [],
    label: 'Label',
    number: 'CAT001',
    country: 'US',
    released: '2024-01-01',
    tracks: [{ pos: '1', artists: [{ name: 'Artist', join: ',' }], extraartists: [], title: 'Track', duration: '3:00' }],
    ...overrides,
  };
}

describe('discogsMapper.mapToPayload', () => {
  describe('shape', () => {
    it('returns _previewObject, full_data (stringified), and sub_notes', () => {
      const payload = DiscogsMapper.mapToPayload(makeRelease(), SOURCE_URL);

      expect(payload._previewObject).toBeTruthy();
      expect(payload.full_data).toBe(JSON.stringify(payload._previewObject));
      expect(payload.sub_notes).toBe(payload._previewObject.submissionNotes);
    });

    it('wraps the label and catalog number into a single labels entry', () => {
      const payload = DiscogsMapper.mapToPayload(makeRelease({ label: 'Acme', number: 'AC-1' }), SOURCE_URL);

      expect(payload._previewObject.labels).toEqual([{ name: 'Acme', catno: 'AC-1' }]);
    });

    it('builds a single File-format block with qty equal to track count', () => {
      const tracks = [
        { pos: '1', artists: [], extraartists: [], title: 'a', duration: '1:00' },
        { pos: '2', artists: [], extraartists: [], title: 'b', duration: '1:00' },
        { pos: '3', artists: [], extraartists: [], title: 'c', duration: '1:00' },
      ];
      const payload = DiscogsMapper.mapToPayload(makeRelease({ tracks }), SOURCE_URL);

      expect(payload._previewObject.format).toHaveLength(1);
      expect(payload._previewObject.format[0].name).toBe('File');
      expect(payload._previewObject.format[0].qty).toBe('3');
    });
  });

  describe('artist deduplication', () => {
    it('elevates a common track artist to release level when release has none', () => {
      const release = makeRelease({
        artists: [],
        tracks: [
          { pos: '1', artists: [{ name: 'Shared', join: ',' }], extraartists: [], title: 'a', duration: '1:00' },
          { pos: '2', artists: [{ name: 'Shared', join: ',' }], extraartists: [], title: 'b', duration: '1:00' },
        ],
      });
      const payload = DiscogsMapper.mapToPayload(release, SOURCE_URL);

      expect(payload._previewObject.artists).toEqual([{ name: 'Shared', join: ',' }]);
    });

    it('clears track-level artists when all tracks match the release artist', () => {
      const release = makeRelease({
        artists: [{ name: 'Artist', join: ',' }],
        tracks: [
          { pos: '1', artists: [{ name: 'Artist', join: ',' }], extraartists: [], title: 'a', duration: '1:00' },
          { pos: '2', artists: [{ name: 'Artist', join: ',' }], extraartists: [], title: 'b', duration: '1:00' },
        ],
      });
      const payload = DiscogsMapper.mapToPayload(release, SOURCE_URL);

      expect(payload._previewObject.tracks.every(track => track.artists.length === 0)).toBe(true);
    });

    it('keeps track-level artists when they diverge from the release artist', () => {
      const release = makeRelease({
        artists: [{ name: 'Various', join: ',' }],
        tracks: [
          { pos: '1', artists: [{ name: 'Artist A', join: ',' }], extraartists: [], title: 'a', duration: '1:00' },
          { pos: '2', artists: [{ name: 'Artist B', join: ',' }], extraartists: [], title: 'b', duration: '1:00' },
        ],
      });
      const payload = DiscogsMapper.mapToPayload(release, SOURCE_URL);

      expect(payload._previewObject.tracks[0].artists[0].name).toBe('Artist A');
      expect(payload._previewObject.tracks[1].artists[0].name).toBe('Artist B');
    });

    it('defaults to "Various" when 4+ unique track artists and no release artist', () => {
      const release = makeRelease({
        artists: [],
        tracks: [
          { pos: '1', artists: [{ name: 'A', join: ',' }], extraartists: [], title: 't1', duration: '1:00' },
          { pos: '2', artists: [{ name: 'B', join: ',' }], extraartists: [], title: 't2', duration: '1:00' },
          { pos: '3', artists: [{ name: 'C', join: ',' }], extraartists: [], title: 't3', duration: '1:00' },
          { pos: '4', artists: [{ name: 'D', join: ',' }], extraartists: [], title: 't4', duration: '1:00' },
        ],
      });
      const payload = DiscogsMapper.mapToPayload(release, SOURCE_URL);

      expect(payload._previewObject.artists).toEqual([{ name: 'Various', join: ',' }]);
    });
  });

  describe('label fallback', () => {
    it('uses "Not On Label" when data.label is null', () => {
      const payload = DiscogsMapper.mapToPayload(makeRelease({ label: null }), SOURCE_URL);

      expect(payload._previewObject.labels[0].name).toBe('Not On Label');
    });

    it('uses "none" as catno when data.number is missing', () => {
      const payload = DiscogsMapper.mapToPayload(makeRelease({ number: null }), SOURCE_URL);

      expect(payload._previewObject.labels[0].catno).toBe('none');
    });
  });

  describe('format options', () => {
    it('auto-fills "320 kbps" when format is MP3 and formatText is empty', () => {
      const payload = DiscogsMapper.mapToPayload(makeRelease(), SOURCE_URL, { format: 'MP3' });

      expect(payload._previewObject.format[0].text).toBe('320 kbps');
    });

    it('preserves a caller-supplied formatText over the MP3 default', () => {
      const payload = DiscogsMapper.mapToPayload(makeRelease(), SOURCE_URL, { format: 'MP3', formatText: '192 kbps' });

      expect(payload._previewObject.format[0].text).toBe('192 kbps');
    });

    it('includes the format and provided descriptions in `desc`', () => {
      const payload = DiscogsMapper.mapToPayload(makeRelease(), SOURCE_URL, { format: 'WAV', descriptions: ['EP', 'Limited Edition'] });

      expect(payload._previewObject.format[0].desc).toEqual(['WAV', 'EP', 'Limited Edition']);
    });
  });

  describe('notes', () => {
    it('synthesises a BPM block in notes when tracks have bpm and no notes were provided', () => {
      const release = makeRelease({
        notes: undefined,
        tracks: [
          { pos: '1', artists: [], extraartists: [], title: 'a', duration: '1:00', bpm: 128 },
          { pos: '2', artists: [], extraartists: [], title: 'b', duration: '1:00', bpm: 140 },
        ],
      });
      const payload = DiscogsMapper.mapToPayload(release, SOURCE_URL);

      expect(payload._previewObject.notes).toContain('BPM\'s:');
      expect(payload._previewObject.notes).toContain('1: 128');
      expect(payload._previewObject.notes).toContain('2: 140');
    });

    it('falls back to a default submissionNotes containing the source URL', () => {
      const payload = DiscogsMapper.mapToPayload(makeRelease({ submissionNotes: undefined }), SOURCE_URL);

      expect(payload._previewObject.submissionNotes).toContain(SOURCE_URL);
    });
  });

  describe('country', () => {
    it('uses the option override over data.country', () => {
      const payload = DiscogsMapper.mapToPayload(makeRelease({ country: 'US' }), SOURCE_URL, { country: 'UK' });

      expect(payload._previewObject.country).toBe('UK');
    });

    it('falls back to "Worldwide" when both option and data lack a country', () => {
      const payload = DiscogsMapper.mapToPayload(makeRelease({ country: null }), SOURCE_URL);

      expect(payload._previewObject.country).toBe('Worldwide');
    });
  });
});
