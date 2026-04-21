import type {
  ArtistCredit,
  StoreAdapter,
} from '@/types';
import { networkRequest } from '@/core/network';
import {
  getReleaseIdFromUrl,
  matchUrls,
  normalizeArtists,
  normalizeMainArtists,
  normalizeTrackTitle,
} from '@/core/utils';

/**
 * Fetches required tokens and loads store metadata arrays via API endpoints.
 *
 * @returns Parsed JSON with combined meta and tracks payload.
 */
async function getData() {
  const releaseId = getReleaseIdFromUrl();

  if (!releaseId) {
    throw new Error(`[Discogs Submitter] Release ID not found`);
  }

  const accessTokenResponse = await networkRequest({
    url: `https://www.beatport.com/api/auth/refresh-anon-token`,
    method: 'POST',
  });
  const accessToken = JSON.parse(accessTokenResponse).access_token;

  if (!accessToken) {
    throw new Error('Beatport access token not found');
  }

  const [metaResponse, tracksResponse] = await Promise.all([
    networkRequest({
      url: `https://api.beatport.com/v4/catalog/releases/${releaseId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }),
    networkRequest({
      url: `https://api.beatport.com/v4/catalog/releases/${releaseId}/tracks?per_page=100`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }),
  ]);
  const meta = JSON.parse(metaResponse);
  const tracks = JSON.parse(tracksResponse).results;

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
    hdAudio: true,
  },

  target: '[class^="ReleaseDetailCard-style__Controls"]',

  injectButton: (button, target) => {
    target.appendChild(button);
  },

  parse: async () => {
    const data = await getData();
    const albumCover = data.image.uri;
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists(data.artists.map((artist: any) => artist.name), albumExtraArtists);
    const albumTitle = normalizeTrackTitle(data.name, albumExtraArtists);
    const albumLabel = data.label.name || null;
    const labelNumber = data.catalog_number || null;
    const albumReleased = data.publish_date;
    const albumTracks = data.tracks.map((track: any, index: number) => {
      const trackPosition = `${index + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = normalizeArtists(track.artists.map((artist: any) => artist.name), trackExtraArtists);
      const trackTitle = normalizeTrackTitle(track.mix_name !== '' ? `${track.name} (${track.mix_name})` : track.name, trackExtraArtists);
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
