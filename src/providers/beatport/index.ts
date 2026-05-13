import type { BeatportRelease, BeatportReleaseData, BeatportTrack } from './types';
import type { ArtistCredit, StoreAdapter } from '@/types';
import { normalizeArtists, normalizeMainArtists } from '@/domain/normalizers/artists';
import { normalizeTitle } from '@/domain/normalizers/titles';
import { networkRequest } from '@/libs/network';
import { getReleaseIdFromUrl, matchUrls } from '@/utils/url';

/**
 * Fetches required tokens and loads store metadata arrays via API endpoints.
 *
 * @returns Parsed JSON with combined meta and tracks payload.
 * @throws {Error} When the release ID cannot be extracted from the URL.
 * @throws {Error} When the anonymous access token request fails.
 */
async function getData(): Promise<BeatportReleaseData> {
  const releaseId = getReleaseIdFromUrl();

  if (!releaseId) {
    throw new Error(`[Discogs Submitter] Release ID not found`);
  }

  const accessTokenResponse = await networkRequest<{ access_token: string }>({
    url: `https://www.beatport.com/api/auth/refresh-anon-token`,
    method: 'POST',
    responseType: 'json',
  });
  const accessToken = accessTokenResponse.access_token;

  if (!accessToken) {
    throw new Error('Beatport access token not found');
  }

  const [meta, tracksResponse] = await Promise.all([
    networkRequest<BeatportRelease>({
      url: `https://api.beatport.com/v4/catalog/releases/${releaseId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'json',
    }),
    networkRequest<{ results: BeatportTrack[] }>({
      url: `https://api.beatport.com/v4/catalog/releases/${releaseId}/tracks?per_page=100`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'json',
    }),
  ]);
  const tracks = tracksResponse.results;

  return { ...meta, tracks };
}

/**
 * Adapter configuration for the Beatport digital store.
 * @type {StoreAdapter}
 */
export const beatport: StoreAdapter = {
  id: 'beatport',
  test: matchUrls(
    'https://*.beatport.com/*',
  ),
  supports: {
    formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
  },
  target: '[class^="ReleaseDetailCard-style__Controls"]',
  injectButton: (button, target) => {
    target.appendChild(button);
  },
  parse: async () => {
    const data = await getData();
    const smallCover = data.image.dynamic_uri?.replace('{w}', '350')?.replace('{h}', '350');
    const albumCover = data.image.uri;
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists(data.artists.map(artist => artist.name), albumExtraArtists);
    const albumTitle = normalizeTitle(data.name, albumExtraArtists);
    const albumLabel = data.label.name;
    const labelNumber = data.catalog_number;
    const albumReleased = data.publish_date;
    const albumTracks = data.tracks.map((track, index) => {
      const trackPosition = `${index + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = normalizeArtists(track.artists.map(artist => artist.name), trackExtraArtists);
      const trackTitle = normalizeTitle(track.mix_name !== '' ? `${track.name} (${track.mix_name})` : track.name, trackExtraArtists);
      const trackDuration = track.length;
      const trackBpm = track.bpm;

      return {
        pos: trackPosition,
        extraartists: trackExtraArtists,
        artists: trackArtists,
        title: trackTitle,
        duration: trackDuration,
        bpm: trackBpm,
      };
    });

    return {
      thumb: smallCover,
      cover: albumCover,
      extraartists: albumExtraArtists,
      artists: albumArtists,
      title: albumTitle,
      label: albumLabel,
      released: albumReleased,
      number: labelNumber,
      tracks: albumTracks,
    };
  },
};
