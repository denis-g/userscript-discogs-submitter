import type {
  ArtistCredit,
  StoreAdapter,
} from '@/types';
import { networkRequest } from '@/core';
import { normalizeArtists, normalizeDuration, normalizeMainArtists, normalizeReleaseDate, normalizeTitle } from '@/domain/normalizers';
import { getTextFromTag, matchUrls } from '@/utils';
import styles from './7digital.css?inline';

interface SevenDigitalArtist {
  name: string;
}

interface SevenDigitalLabel {
  name: string;
}

interface SevenDigitalRelease {
  image: string;
  title: string;
  artist: SevenDigitalArtist;
  label: SevenDigitalLabel;
}

interface SevenDigitalTrack {
  release: SevenDigitalRelease;
  artist: SevenDigitalArtist;
  title: string;
  version: string;
  duration: string;
}

/**
 * Fetches track details array from 7digital API.
 *
 * @returns Array of parsed track items.
 */
async function getData(): Promise<SevenDigitalTrack[]> {
  const releaseId = getTextFromTag('.release-info', null, 'data-releaseid');

  if (!releaseId) {
    throw new Error(`[Discogs Submitter] Release ID not found`);
  }

  const response = await networkRequest<{ tracks: SevenDigitalTrack[] }>({
    url: `https://api.7digital.com/1.2/release/tracks?releaseid=${releaseId}&pagesize=100&imagesize=800&usageTypes=download&oauth_consumer_key=7digital.com`,
    headers: {
      Accept: 'application/json',
    },
    responseType: 'json',
  });

  return response.tracks;
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
  },

  target: '.release-purchase',

  injectButton: (button, target) => {
    target.insertAdjacentElement('afterend', button);
  },

  styles,

  parse: async () => {
    const data = await getData();
    const smallCover = data[0].release.image?.replace('_800', '_350');
    const albumCover = data[0].release.image;
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists([data[0].release.artist.name], albumExtraArtists);
    const albumTitle = normalizeTitle(data[0].release.title, albumExtraArtists);
    const albumLabel = data[0].release.label.name;
    const albumReleased = normalizeReleaseDate(getTextFromTag('.release-data-label + .release-data-info'));
    const albumTracks = data.map((track, index) => {
      const trackPosition = `${index + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = normalizeArtists(track.artist.name, trackExtraArtists);
      const trackTitle = normalizeTitle(track.version !== '' ? `${track.title} (${track.version})` : track.title, trackExtraArtists);
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
      thumb: smallCover,
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
