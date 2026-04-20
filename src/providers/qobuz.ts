import type {
  ArtistCredit,
  StoreAdapter,
} from '@/types';
import {
  getTextFromTag,
  matchUrls,
  normalizeArtists,
  normalizeDuration,
  normalizeMainArtists,
  normalizeTrackTitle,
} from '@/core/utils';

/**
 * Scrapes metadata directly from JSON-LD schema injected in the DOM.
 *
 * @returns The parsed structured data or null.
 */
async function getData(): Promise<any> {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  let data: any = null;

  Array.from(scripts).some((script) => {
    try {
      const jsonData = JSON.parse(script.textContent || '{}');

      if (jsonData['@type'] === 'Product') {
        data = jsonData;

        return true;
      }
    }
    catch {
      return false;
    }

    return false;
  });

  return data;
}

/**
 * Adapter configuration for the Qobuz digital store.
 * @type {StoreAdapter}
 */
export const qobuz: StoreAdapter = {
  id: 'qobuz',

  test: matchUrls(
    'https://*.qobuz.com/*',
  ),

  supports: {
    formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
    hdAudio: true,
  },

  target: '.album-meta',

  injectButton: (button, target) => {
    target.appendChild(button);

    // Qobuz uses infinite scroll for tracks, we need to ensure they are loaded
    const win = unsafeWindow as any;

    if (typeof win.infiniteScroll === 'function') {
      try {
        win.infiniteScroll('/v4/ajax/album/load-tracks');
      }
      catch {
      }
    }
  },

  parse: async () => {
    const data = await getData();
    let albumCover = getTextFromTag('.album-cover__image', null, 'src');
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists(getTextFromTag('.album-meta__title .artist-name'), albumExtraArtists);
    const albumTitle = normalizeTrackTitle(getTextFromTag('.album-meta__title .album-title'), albumExtraArtists);
    const albumLabel = getTextFromTag('.album-meta__item a[href*="/label/"]');
    const albumReleased = data?.releaseDate || null;
    const albumTracks = Array.from(document.querySelectorAll('#playerTracks > .player__item')).map((track: Element, i: number) => {
      const artistRow = getTextFromTag('.track__item--artist', track);
      const trackPosition = `${i + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = artistRow ? normalizeArtists([artistRow], trackExtraArtists) : albumArtists;
      const trackTitle = normalizeTrackTitle(getTextFromTag('.track__item--name', track), trackExtraArtists);
      const trackDuration = normalizeDuration(getTextFromTag('.track__item--duration', track));

      return {
        position: trackPosition,
        extraartists: trackExtraArtists,
        artists: trackArtists,
        title: trackTitle,
        duration: trackDuration,
      };
    });

    if (albumCover) {
      albumCover = albumCover.replace(/_(600|300)\.jpg$/, '_max.jpg').replace('_600', '_max');
    }

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
