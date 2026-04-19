import type {
  ArtistCredit,
  StoreAdapter,
} from '@/types';
import { networkRequest } from '@/core/network';
import {
  cleanString,
  getReleaseIdFromUrl,
  getTextFromTag,
  matchUrls,
  normalizeArtists,
  normalizeDuration,
  normalizeMainArtists,
  normalizeReleaseDate,
  normalizeTrackTitle,
} from '@/core/utils';

/**
 * Fetches playlist details array from JunoDownload API.
 *
 * @returns Array of parsed track items.
 */
async function getData() {
  const releaseId = getReleaseIdFromUrl();

  if (!releaseId) {
    throw new Error(`[Discogs Submitter] Release ID not found`);
  }

  const responseText = await networkRequest({
    url: `https://www.junodownload.com/api/1.2/playlist/getplaylistdetails/?product_key=${releaseId}&output_type=json`,
    method: 'GET',
  });

  return JSON.parse(responseText).items;
}

/**
 * Adapter configuration for the Juno Download digital store.
 * @type {StoreAdapter}
 */
export const junodownload: StoreAdapter = {
  id: 'junodownload',

  test: matchUrls(
    'https://*.junodownload.com/products/*',
  ),

  supports: {
    formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
    hdAudio: true,
  },

  target: '#product-action-btns',

  injectButton: (button, target) => {
    target.insertAdjacentElement('afterend', button);
  },

  parse: async () => {
    const data = await getData();
    const albumCover = getTextFromTag('.product-image-for-modal', null, 'data-src-full');
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists(data[0].releaseArtists.map((item: any) => item.name), albumExtraArtists);
    const albumTitle = normalizeTrackTitle(data[0].releaseTitle, albumExtraArtists);
    const albumLabel = data[0].label.name;
    const albumReleased = normalizeReleaseDate(getTextFromTag('#product-page-digi [itemprop="datePublished"]'));
    let labelNumber = null;

    Array.from(document.querySelectorAll('#product-page-digi .mb-2')).some((el) => {
      // Normalize &nbsp; and other entities to ensure regex match
      const html = (el.innerHTML || '').replace(/&nbsp;/g, ' ');
      const match = html.match(/<strong>Cat:<\/strong>([^<]+)<br>/i);

      if (match?.[1]) {
        labelNumber = cleanString(match[1]);

        return true;
      }

      return false;
    });

    const albumTracks = data.map((track: any, i: number) => {
      const trackPosition = `${i + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = normalizeArtists(track.artists.map((item: any) => item.name), trackExtraArtists);
      const trackTitle = normalizeTrackTitle(track.version ? `${track.title} (${track.version})` : track.title, trackExtraArtists);
      const trackDuration = normalizeDuration(track.length);
      const trackBpm = track.bpm;

      return {
        position: trackPosition,
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
