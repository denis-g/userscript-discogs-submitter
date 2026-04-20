import type {
  BuildPayloadOptions,
  DiscogsPayload,
  DiscogsPayloadData,
  DiscogsTrack,
  ReleaseData,
} from '@/types';
import { groupExtraArtists, normalizeCountry } from './utils';

/**
 * A shared adapter for transforming various digital store data into the Discogs release schema.
 * Handles the normalization and deduplication of artists, labels, and tracklists.
 */
export const DiscogsAdapter = {
  /**
   * Transforms raw scraped store data into the strict JSON payload schema required by Discogs.
   *
   * Logic handles track level vs release level artist deduplication, cover mapping,
   * default fallback labels, format configurations, and standardizing notes.
   *
   * @param data - The raw Data extracted from a store.
   * @param sourceUrl - The originating URL where the data was scraped.
   * @param options - Configuration options determining format and audio quality.
   * @returns The fully constructed JSON payload split into `_previewObject`, `full_data`, and `sub_notes`.
   *
   * @example
   * ```typescript
   * const payload = DiscogsAdapter.buildPayload(releaseData, window.location.href, { format: 'WAV', isHdAudio: true });
   * console.log(payload.full_data);
   * ```
   */
  buildPayload: (data: ReleaseData, sourceUrl: string, options?: BuildPayloadOptions): DiscogsPayload => {
    const { format = 'WAV', isHdAudio = false } = options || {};
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
    let finalReleaseArtists = releaseArtistsArr;

    if (allTracksShareSameArtists && firstTrackArtists.length > 0) {
      finalReleaseArtists = firstTrackArtists;
    }

    const primaryArtistName = (finalReleaseArtists[0]?.name || '').trim();
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
    const labelName = (data.label && primaryArtistName && data.label === primaryArtistName)
      ? `Not On Label (${primaryArtistName} Self-released)`
      : (data.label || 'Not On Label');
    let formatText = '';

    if (format === 'MP3') {
      formatText = '320 kbps';
    }
    else if (isHdAudio) {
      formatText = '24-bit';
    }

    const totalTracks = data.tracks?.length ? `${data.tracks.length}` : '1';
    const validBpmTracks = (data.tracks || []).filter(track => track.bpm);
    const infoBpm = validBpmTracks.length > 0 ? `BPM's:\n${validBpmTracks.map(track => `${track.position}: ${track.bpm}`).join('\n')}` : '';
    // Smart Various Artists detection: if artists are divergent across tracks and no release-level artist is set
    let finalArtists = finalReleaseArtists;

    if ((!finalArtists.length || finalArtists[0]?.name === '') && tracks.length > 1) {
      const uniqueArtists = new Set(tracks.map(t => (t.artists?.[0]?.name || '').toLowerCase()).filter(Boolean));

      if (uniqueArtists.size >= 4) {
        finalArtists = [{ name: 'Various', join: ',' }];
      }
    }

    const payload: DiscogsPayloadData = {
      cover: data.cover || null,
      title: data.title || '',
      artists: finalArtists.length ? finalArtists : [{ name: '', join: ',' }],
      extraartists: groupExtraArtists(data.extraartists || []),
      country: normalizeCountry(data.country || 'Worldwide'),
      released: data.released || '',
      labels: labelName ? [{ name: labelName, catno: data.number || 'none' }] : [{ name: '', catno: '' }],
      format: [{ name: 'File', qty: totalTracks, desc: [format], text: formatText }],
      tracks: (data.tracks || []).map((track): DiscogsTrack => ({
        pos: track.position || '',
        artists: allTracksMatchRelease ? [] : track.artists || [],
        extraartists: groupExtraArtists(track.extraartists || []),
        title: track.title || '',
        duration: track.duration || '',
      })),
      notes: infoBpm,
    };

    return {
      _previewObject: payload,
      full_data: JSON.stringify(payload),
      sub_notes: `${sourceUrl}\n---\nA digital release in ${format} format has been added.`,
    };
  },
};
