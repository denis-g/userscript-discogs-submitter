import type { ArtistCredit, StoreAdapter, TrackData } from '@/types';
import { normalizeArtists, normalizeMainArtists } from '@/domain/normalizers/artists';
import { normalizeReleaseDate } from '@/domain/normalizers/date';
import { normalizeDuration } from '@/domain/normalizers/duration';
import { normalizeTitle } from '@/domain/normalizers/titles';
import { getTextFromTag } from '@/utils/dom';
import { matchUrls } from '@/utils/url';

/**
 * Adapter configuration for the Amazon Music digital store.
 * @type {StoreAdapter}
 */
export const amazonmusic: StoreAdapter = {
  id: 'amazonmusic',
  test: matchUrls(
    'https://*.amazon.*/*',
  ),
  supports: {
    formats: ['MP3'],
  },
  parse: async () => {
    const albumCover = getTextFromTag('#main_content music-detail-header', null, 'image-src');
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists(getTextFromTag('#main_content music-detail-header', null, 'primary-text'), albumExtraArtists);
    const albumTitle = normalizeTitle(getTextFromTag('#main_content music-detail-header', null, 'headline'), albumExtraArtists);
    let albumLabel = getTextFromTag('#main_content .music-tertiary-text');
    let albumTracks: TrackData[] = [];

    if (albumLabel) {
      // Remove the copyright info and the release date from the label
      albumLabel = albumLabel.replace(/^[℗©\s\d:]+/, '').trim();
    }

    let albumReleased = getTextFromTag('#main_content music-detail-header', null, 'tertiary-text');

    if (albumReleased) {
      // Text format: 2 SONGS • 8 MINUTES • APR 19 2024
      const dateParts = albumReleased.split('•');

      albumReleased = normalizeReleaseDate(dateParts[dateParts.length - 1].trim());
    }

    const tracklistContainer = document.querySelector('#main_content music-container');
    const tracklistRows = (tracklistContainer?.shadowRoot ?? tracklistContainer)?.querySelectorAll('music-text-row') || [];

    if (tracklistRows.length) {
      albumTracks = Array.from(tracklistRows).map((track: Element, index: number) => {
        const trackPosition = `${index + 1}`;
        const trackExtraArtists: ArtistCredit[] = [];
        const trackArtists = normalizeArtists(getTextFromTag('.col3 > music-link', track, 'title') || albumArtists.map(artist => artist.name), trackExtraArtists);
        const trackTitle = normalizeTitle(getTextFromTag('.col1 > music-link', track), trackExtraArtists);
        const trackDuration = normalizeDuration(getTextFromTag('.col4 > music-link', track, 'title'));

        return {
          pos: trackPosition,
          extraartists: trackExtraArtists,
          artists: trackArtists,
          title: trackTitle,
          duration: trackDuration,
        };
      });
    }

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
