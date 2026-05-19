import type { ArtistCredit, StoreAdapter } from '@/types';
import { normalizeArtists, normalizeMainArtists } from '@/domain/normalizers/artists';
import { normalizeDuration } from '@/domain/normalizers/duration';
import { normalizeTitle } from '@/domain/normalizers/titles';
import { getTextFromTag } from '@/utils/dom';
import { matchUrls } from '@/utils/url';

/**
 * Scrapes metadata directly from JSON-LD schema injected in the DOM.
 *
 * @returns The parsed structured data or null.
 */
async function getData(): Promise<Record<string, any> | null> {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  let data: Record<string, any> | null = null;

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
  },
  beforeParse: () => {
    // Qobuz uses infinite scroll for tracks; nudge the host's loader so every track is in the DOM
    // before parsing. Best-effort: silently ignore if the helper isn't exposed (page version drift,
    // or running outside a userscript host like the test environment).
    if (typeof (unsafeWindow as any).infiniteScroll === 'function') {
      try {
        (unsafeWindow as any).infiniteScroll('/v4/ajax/album/load-tracks');
      }
      catch (error) {
        console.warn('[Discogs Submitter] Qobuz infiniteScroll trigger failed:', error);
      }
    }
  },
  parse: async () => {
    const data = await getData();
    const smallCover = getTextFromTag('.album-cover__image', null, 'src');
    const albumCover = smallCover?.replace(/_(600|300)\.jpg$/, '_max.jpg').replace('_600', '_max') || null;
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists(getTextFromTag('.album-meta__title .artist-name'), albumExtraArtists);
    const albumTitle = normalizeTitle(getTextFromTag('.album-meta__title .album-title'), albumExtraArtists);
    const albumLabel = getTextFromTag('.album-meta__item a[href*="/label/"]');
    const albumReleased = data?.releaseDate || null;
    const albumTracks = Array.from(document.querySelectorAll('#playerTracks > .player__item')).map((track: Element, index: number) => {
      const artistRow = getTextFromTag('.track__item--artist', track);
      const trackPosition = `${index + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = artistRow ? normalizeArtists([artistRow], trackExtraArtists) : albumArtists;
      const trackTitle = normalizeTitle(getTextFromTag('.track__item--name', track), trackExtraArtists);
      const trackDuration = normalizeDuration(getTextFromTag('.track__item--duration', track));

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
