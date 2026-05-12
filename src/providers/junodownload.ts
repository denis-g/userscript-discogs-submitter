import type {
  ArtistCredit,
  StoreAdapter,
} from '@/types';
import { networkRequest } from '@/core';
import { normalizeArtists, normalizeDuration, normalizeMainArtists, normalizeReleaseDate, normalizeTitle } from '@/domain/normalizers';
import { cleanString, getReleaseIdFromUrl, getTextFromTag, matchUrls } from '@/utils';
import styles from './junodownload.css?inline';

interface JunoArtist {
  name: string;
}

interface JunoLabel {
  name: string;
}

interface JunoTrackItem {
  releaseArtists: JunoArtist[];
  releaseTitle: string;
  label: JunoLabel;
  artists: JunoArtist[];
  title: string;
  version: string;
  length: string;
  bpm?: number;
}

/**
 * Fetches playlist details array from JunoDownload API.
 *
 * @returns Array of parsed track items.
 */
async function getData(): Promise<JunoTrackItem[]> {
  const releaseId = getReleaseIdFromUrl();

  if (!releaseId) {
    throw new Error(`[Discogs Submitter] Release ID not found`);
  }

  const response = await networkRequest<{ items: JunoTrackItem[] }>({
    url: `https://www.junodownload.com/api/1.2/playlist/getplaylistdetails/?product_key=${releaseId}&limit=100&output_type=json`,
    method: 'GET',
    responseType: 'json',
  });

  return response.items;
}

/**
 * Adapter configuration for the Juno Download digital store.
 * @type {StoreAdapter}
 */
export const junodownload: StoreAdapter = {
  id: 'junodownload',

  test: matchUrls(
    'https://*.junodownload.com/*',
  ),

  supports: {
    formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
  },

  target: '#product-action-btns',

  injectButton: (button, target) => {
    target.insertAdjacentElement('afterend', button);
  },

  styles,

  parse: async () => {
    const data = await getData();
    const smallCover = getTextFromTag('.product-image-for-modal', null, 'src');
    const albumCover = getTextFromTag('.product-image-for-modal', null, 'data-src-full');
    const albumExtraArtists: ArtistCredit[] = [];
    const albumArtists = normalizeMainArtists(data[0].releaseArtists.map(artist => artist.name), albumExtraArtists);
    const albumTitle = normalizeTitle(data[0].releaseTitle, albumExtraArtists);
    const albumLabel = data[0].label.name;
    const albumReleased = normalizeReleaseDate(getTextFromTag('#product-page-digi [itemprop="datePublished"]'));
    let labelNumber = null;

    Array.from(document.querySelectorAll('#product-page-digi .mb-2')).some((element) => {
      // Normalize &nbsp; and other entities to ensure regex match
      const html = (element.innerHTML || '').replace(/&nbsp;/g, ' ');
      const match = html.match(/<strong>Cat:<\/strong>([^<]+)<br>/i);

      if (match?.[1]) {
        labelNumber = cleanString(match[1]);

        return true;
      }

      return false;
    });

    const albumTracks = data.map((track, index) => {
      const trackPosition = `${index + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const trackArtists = normalizeArtists(track.artists.map(artist => artist.name), trackExtraArtists);
      const trackTitle = normalizeTitle(track.version ? `${track.title} (${track.version})` : track.title, trackExtraArtists);
      const trackDuration = normalizeDuration(track.length);
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
