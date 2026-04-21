import type {
  ArtistCredit,
  StoreAdapter,
} from '@/types';
import { networkRequest } from '@/core/network';
import {
  getTextFromTag,
  matchUrls,
  normalizeArtists,
  normalizeDuration,
  normalizeMainArtists,
  normalizeReleaseDate,
  normalizeTrackTitle,
} from '@/core/utils';

/**
 * Fetches track details array from 7digital API.
 *
 * @returns Array of parsed track items.
 */
async function getData() {
  const releaseId = getTextFromTag('.release-info', null, 'data-releaseid');

  if (!releaseId) {
    throw new Error(`[Discogs Submitter] Release ID not found`);
  }

  const responseText = (await networkRequest({
    url: `https://api.7digital.com/1.2/release/tracks?releaseid=${releaseId}&pagesize=100&imagesize=800&usageTypes=download&oauth_consumer_key=7digital.com`,
    headers: {
      Accept: 'application/json',
    },
  }));

  return JSON.parse(responseText).tracks;
}

/**
 * Adapter configuration for the 7digital store.
 * @type {StoreAdapter}
 */
export const sevendigital: StoreAdapter = {
  id: '7digital',
  test: matchUrls(
    'https://*.7digital.com/artist/*/release/*',
  ),

  supports: {
    formats: ['FLAC', 'MP3'],
    hdAudio: true,
  },

  target: '.release-purchase',

  injectButton: (button, target) => {
    target.insertAdjacentElement('afterend', button);
  },

  parse: async () => {
    const data = await getData();
    const albumCover = data[0].release.image;
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists([data[0].release.artist.name], albumExtraArtists);
    const albumTitle = normalizeTrackTitle(data[0].release.title, albumExtraArtists);
    const albumLabel = data[0].release.label.name;
    const albumReleased = normalizeReleaseDate(getTextFromTag('.release-data-label + .release-data-info'));
    const albumTracks = data.map((track: any, index: number) => {
      const trackPosition = `${index + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = normalizeArtists(track.artist.name, trackExtraArtists);
      const trackTitle = normalizeTrackTitle(track.version !== '' ? `${track.title} (${track.version})` : track.title, trackExtraArtists);
      const trackDuration = normalizeDuration(track.duration);

      return {
        pos: trackPosition,
        extraartists: trackExtraArtists,
        artists: trackArtists,
        title: trackTitle,
        duration: trackDuration,
      };
    });

    return {
      cover: albumCover,
      extraartists: albumExtraArtists,
      artists: albumArtists,
      title: albumTitle,
      label: albumLabel,
      released: albumReleased,
      tracks: albumTracks,
    };
  },
};
