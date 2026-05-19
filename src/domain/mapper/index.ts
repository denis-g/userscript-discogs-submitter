import type {
  BuildPayloadOptions,
  DiscogsPayload,
  DiscogsPayloadData,
  DiscogsTrack,
  ReleaseData,
} from '@/types';
import { groupExtraArtists } from '@/domain/normalizers/artists';
import { normalizeCountry } from '@/domain/normalizers/country';
import { extractFormatFromTitle } from '@/domain/normalizers/format';

/**
 * A shared adapter for transforming various digital store data into the Discogs release schema.
 * Handles the normalization and deduplication of artists, labels, and tracklists.
 */
export const DiscogsMapper = {
  /**
   * Transforms raw scraped store data into the strict JSON payload schema required by Discogs.
   *
   * Logic handles track level vs release level artist deduplication, cover mapping,
   * format configurations, and standardizing notes.
   *
   * NOTE: This method prioritizes manually edited data provided in the `data` object.
   * Heuristics that must be visible and editable in the UI (e.g. the "Not On Label"
   * label normalization or the `resolveCountry` fallback) are applied by the widget
   * before the data lands here; the same defaults are re-applied inside this method as
   * a safety net for the case where the user clears an editable field to an empty value.
   *
   * @param data - The raw or edited Data extracted from a store.
   * @param sourceUrl - The originating URL where the data was scraped.
   * @param options - Configuration options determining format and audio quality.
   * @returns The fully constructed JSON payload split into `_previewObject`, `full_data`, and `sub_notes`.
   *
   * @example
   * ```typescript
   * const payload = DiscogsMapper.mapToPayload(releaseData, window.location.href, { format: 'WAV' });
   * console.log(payload.full_data);
   * ```
   */
  mapToPayload: (data: ReleaseData, sourceUrl: string, options?: BuildPayloadOptions): DiscogsPayload => {
    const { format = 'WAV' } = options || {};
    const releaseArtistsArr = data.artists || [];
    const tracks = data.tracks || [];
    // Determine if all tracks have the same artist list
    const firstTrackArtists = tracks[0]?.artists || [];
    const allTracksShareSameArtists = tracks.length > 0 && tracks.every((track) => {
      const trackArtists = track.artists || [];

      if (trackArtists.length !== firstTrackArtists.length) {
        return false;
      }

      return trackArtists.every((artist, index) => artist.name === firstTrackArtists[index].name && artist.join === firstTrackArtists[index].join);
    });
    // If all tracks match, we elevate the common track artist to the release level.
    // However, we only do this if no release artists are provided to avoid overwriting manual edits.
    let finalReleaseArtists = releaseArtistsArr;

    if ((!finalReleaseArtists.length || (finalReleaseArtists.length === 1 && !finalReleaseArtists[0].name)) && allTracksShareSameArtists && firstTrackArtists.length > 0) {
      finalReleaseArtists = firstTrackArtists;
    }

    // Check if the final release artists match the track artists (for deduplication)
    const allTracksMatchRelease = tracks.length > 0 && tracks.every((track) => {
      const trackArtists = track.artists || [];

      if (trackArtists.length !== finalReleaseArtists.length) {
        return false;
      }

      const trackArtistNames = trackArtists.map(artist => (artist.name || '').trim().toLowerCase()).sort();
      const releaseArtistNames = finalReleaseArtists.map(artist => (artist.name || '').trim().toLowerCase()).sort();

      return JSON.stringify(trackArtistNames) === JSON.stringify(releaseArtistNames);
    });
    // Label logic: Default to "Not On Label" if missing.
    const labelName = data.label || 'Not On Label';
    let formatText = options?.formatText ?? '';

    if (!formatText) {
      if (format === 'MP3') {
        formatText = '320 kbps';
      }
    }

    const releaseFormat = options?.descriptions || extractFormatFromTitle(data.title);
    const totalTracks = data.tracks?.length ? `${data.tracks.length}` : '1';
    const validBpmTracks = (data.tracks || []).filter(track => track.bpm);
    const infoBpm = validBpmTracks.length > 0 ? `BPM's:\n${validBpmTracks.map(track => `${track.pos}: ${track.bpm}`).join('\n')}` : '';
    // Smart Various Artists detection: if artists are divergent across tracks and no release-level artist is set
    let finalArtists = finalReleaseArtists;

    if ((!finalArtists.length || finalArtists[0]?.name === '') && tracks.length > 1) {
      const uniqueArtists = new Set(tracks.map(track => (track.artists?.[0]?.name || '').toLowerCase()).filter(Boolean));

      if (uniqueArtists.size >= 4) {
        finalArtists = [{ name: 'Various', join: ',' }];
      }
    }

    const payload: DiscogsPayloadData = {
      cover: data.cover || null,
      title: data.title || '',
      artists: finalArtists.length ? finalArtists : [{ name: '', join: ',' }],
      extraartists: groupExtraArtists(data.extraartists || []),
      country: normalizeCountry(options?.country !== undefined ? options.country : (data.country || 'Worldwide')),
      released: data.released || '',
      labels: labelName ? [{ name: labelName, catno: data.number || 'none' }] : [{ name: '', catno: '' }],
      format: [{
        name: 'File',
        qty: totalTracks,
        desc: [
          format,
          ...releaseFormat,
        ],
        text: formatText,
      }],
      tracks: (data.tracks || []).map((track): DiscogsTrack => ({
        pos: track.pos || '',
        artists: allTracksMatchRelease ? [] : track.artists || [],
        extraartists: groupExtraArtists(track.extraartists || []),
        title: track.title || '',
        duration: track.duration || '',
      })),
      notes: data.notes ?? infoBpm,
      submissionNotes: data.submissionNotes || `${sourceUrl}\n---\nA digital release has been added.`,
    };

    return {
      _previewObject: payload,
      full_data: JSON.stringify(payload),
      sub_notes: payload.submissionNotes,
    };
  },
};
