import type { ArtistCredit, StoreAdapter } from '@/types';
import { normalizeArtists, normalizeMainArtists } from '@/domain/normalizers/artists';
import { normalizeReleaseDate } from '@/domain/normalizers/date';
import { normalizeDuration } from '@/domain/normalizers/duration';
import { normalizeTitle } from '@/domain/normalizers/titles';
import { getManyTextFromTags, getTextFromTag } from '@/utils/dom';
import { cleanString } from '@/utils/string';
import { matchUrls } from '@/utils/url';

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
  },
  parse: async () => {
    const albumMainArtistsRaw = getManyTextFromTags('.product-page .product-details .main-artists a');
    const albumMainArtistsSource = albumMainArtistsRaw.length > 0
      ? albumMainArtistsRaw
      : getTextFromTag('.product-page .product-details .artist a');
    const smallCover = getTextFromTag('.product-page .main-product-image img', null, 'src')?.replace('/b/', '/s/') || null;
    const albumCover = getTextFromTag('.product-page .main-product-image img', null, 'src');
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists(albumMainArtistsSource, albumExtraArtists);
    const albumTitle = normalizeTitle(getTextFromTag('.product-page .product-details .release-title'));
    const albumLabel = getTextFromTag('.product-page .product-details .label');
    const labelNumber = getTextFromTag('.product-page .product-details .catalogue-number');
    const albumReleased = normalizeReleaseDate(getTextFromTag('.product-page .product-details .product-release-date'));
    const albumTracks = Array.from(document.querySelectorAll('.track-list > li')).map((track: Element, index: number) => {
      const featuredArtistAnchors = new Set<Element>(track.querySelectorAll('.track-featured-artists a'));
      const mainArtistAnchors = new Set<Element>([
        ...track.querySelectorAll('.track-main-artists a'),
        ...track.querySelectorAll('.track-artist a'),
      ]);

      featuredArtistAnchors.forEach(anchor => mainArtistAnchors.delete(anchor));

      const trackMainArtists = Array.from(mainArtistAnchors)
        .map(anchor => cleanString(anchor.textContent))
        .filter((text): text is string => Boolean(text));
      const trackFeaturedArtists = getManyTextFromTags('.track-featured-artists a', track);
      const trackPosition = `${index + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = trackMainArtists.length > 0 ? normalizeArtists(trackMainArtists, trackExtraArtists) : albumArtists;
      const trackTitle = normalizeTitle(getTextFromTag('.track-name [itemprop="name"]', track), trackExtraArtists);
      const trackDuration = normalizeDuration(getTextFromTag('.track-duration', track));

      // Handle featured artists
      if (trackFeaturedArtists.length > 0) {
        normalizeArtists(trackFeaturedArtists).forEach((artist) => {
          if (!trackExtraArtists.some(extraArtist => extraArtist.name === artist.name && extraArtist.role === 'Featuring')) {
            trackExtraArtists.push({ ...artist, role: 'Featuring' });
          }
        });
      }

      return {
        pos: trackPosition,
        extraartists: trackExtraArtists,
        artists: trackArtists,
        title: trackTitle,
        duration: trackDuration,
      };
    });
    const featuredArtists = getManyTextFromTags('.product-page .product-details .featured-artists a');

    if (featuredArtists?.length) {
      normalizeArtists(featuredArtists).forEach((artist) => {
        if (!albumExtraArtists.some(extraArtist => extraArtist.name === artist.name && extraArtist.role === 'Featuring')) {
          albumExtraArtists.push({ ...artist, role: 'Featuring' });
        }
      });
    }

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
