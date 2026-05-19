import type { ArtistCredit, StoreAdapter } from '@/types';
import { normalizeArtists, normalizeMainArtists } from '@/domain/normalizers/artists';
import { normalizeReleaseDate } from '@/domain/normalizers/date';
import { normalizeDuration } from '@/domain/normalizers/duration';
import { normalizeTitle } from '@/domain/normalizers/titles';
import { getTextFromTag } from '@/utils/dom';
import { matchUrls } from '@/utils/url';

/**
 * Adapter configuration for the HDtracks digital store.
 *
 * @type {StoreAdapter}
 */
export const hdtracks: StoreAdapter = {
  id: 'hdtracks',
  test: matchUrls(
    'https://*.hdtracks.com/*',
  ),
  supports: {
    formats: ['WAV', 'DSF'],
  },
  parse: async () => {
    // get current page context
    const context = document.querySelector('.list-page.page-current:not(.page-swipeback-active)') || document.querySelector('.list-page.page-current');
    const albumCover = getTextFromTag('.list-info .list-cover', context, 'style')?.match(/background-image:\s*url\("?(.*?)"?\)/)?.[1] ?? null;
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists(getTextFromTag('.list-info .list-artist', context), albumExtraArtists);
    const albumTitle = normalizeTitle(getTextFromTag('.list-info .list-title h2', context));
    const albumLabel = getTextFromTag('.list-info .list-artist + p', context);
    const albumReleased = normalizeReleaseDate(getTextFromTag('.list-content .list-footer p:first-child', context));
    const albumTracks = Array.from((context || document).querySelectorAll('.tracks-table .list:not(.tracks-table-header) > ul > li')).map((track: Element, index: number) => {
      const trackPosition = `${index + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = normalizeArtists(getTextFromTag('.item-cell.artist', track, '', false, true), trackExtraArtists);
      const trackTitle = normalizeTitle(getTextFromTag('.item-cell.title', track, '', false, true), trackExtraArtists);
      const trackDuration = normalizeDuration(getTextFromTag('.item-cell.duration .duration-container', track));

      return {
        pos: trackPosition,
        extraartists: trackExtraArtists,
        artists: trackArtists,
        title: trackTitle,
        duration: trackDuration,
      };
    });

    return {
      thumb: albumCover,
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
