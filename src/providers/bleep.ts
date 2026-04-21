import type {
  ArtistCredit,
  StoreAdapter,
} from '@/types';
import {
  getManyTextFromTags,
  getTextFromTag,
  matchUrls,
  normalizeArtists,
  normalizeMainArtists,
  normalizeReleaseDate,
  normalizeTrackTitle,
} from '@/core/utils';

/**
 * Adapter configuration for the Bleep digital store.
 * @type {StoreAdapter}
 */
export const bleep: StoreAdapter = {
  id: 'bleep',

  test: matchUrls(
    'https://bleep.com/*',
  ),

  supports: {
    formats: ['WAV', 'FLAC', 'MP3'],
    hdAudio: true,
  },

  target: '.product-page .product-actions',

  injectButton: (button, target): void => {
    target.before(button);
  },

  /**
   * Main parsing logic for Bleep releases.
   *
   * @returns Standardized ReleaseData object.
   */
  parse: async () => {
    const albumMainArtistsRaw = getManyTextFromTags('.product-page .product-details .main-artists a');
    const albumMainArtistsSource = albumMainArtistsRaw.length > 0
      ? albumMainArtistsRaw
      : getTextFromTag('.product-page .product-details .artist a');
    const albumCover = getTextFromTag('.product-page .main-product-image img', null, 'src');
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists(albumMainArtistsSource, albumExtraArtists);
    const albumTitle = normalizeTrackTitle(getTextFromTag('.product-page .product-details .release-title'));
    const albumLabel = getTextFromTag('.product-page .product-details .label');
    const labelNumber = getTextFromTag('.product-page .product-details .catalogue-number');
    const albumReleased = normalizeReleaseDate(getTextFromTag('.product-page .product-details .product-release-date'));
    const albumTracks = Array.from(document.querySelectorAll('.track-list > li')).map((track: Element, index: number) => {
      const trackMainArtists = getManyTextFromTags('.track-main-artists a, .track-artist a:not(.track-featured-artists a)', track);
      const trackFeaturedArtists = getManyTextFromTags('.track-featured-artists a', track);
      const trackPosition = `${index + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = trackMainArtists.length > 0 ? normalizeArtists(trackMainArtists, trackExtraArtists) : albumArtists;
      const trackTitle = normalizeTrackTitle(getTextFromTag('.track-name [itemprop="name"]', track), trackExtraArtists);
      const trackDuration = getTextFromTag('.track-duration', track) || '';

      // Handle featured artists
      if (trackFeaturedArtists.length > 0) {
        normalizeArtists(trackFeaturedArtists).forEach((artist) => {
          if (!trackExtraArtists.some(ea => ea.name === artist.name && ea.role === 'Featuring')) {
            trackExtraArtists.push({ ...artist, role: 'Featuring' });
          }
        });
      }

      return {
        position: trackPosition,
        extraartists: trackExtraArtists,
        artists: trackArtists,
        title: trackTitle,
        duration: trackDuration,
      };
    });
    const featuredArtists = getManyTextFromTags('.product-page .product-details .featured-artists a');

    if (featuredArtists?.length) {
      normalizeArtists(featuredArtists).forEach((artist) => {
        if (!albumExtraArtists.some(ea => ea.name === artist.name && ea.role === 'Featuring')) {
          albumExtraArtists.push({ ...artist, role: 'Featuring' });
        }
      });
    }

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
