import type {
  ArtistCredit,
  StoreAdapter,
  TrackData,
} from '@/types';
import {
  cleanString,
  getManyTextFromTags,
  getTextFromTag,
  matchUrls,
  normalizeDuration,
  normalizeMainArtists,
  normalizeReleaseDate,
  normalizeTrackTitle,
  splitArtistTitle,
} from '@/core/utils';

/**
 * Extracts catalog number from credits and about items.
 *
 * @param items - Array of string items describing the release.
 * @returns The parsed catalog number or null.
 */
function extractCatalogNumber(items: string[]): string | null {
  const catPrefixes = [
    'Catalog Number',
    'Calalog No',
    'Catalogue N°',
    'Release Catalog No',
    'Cat.#',
    'Cat#',
    'CatNo',
    'Cat.no',
    'Cat. Number',
    'Cat.',
    'Catalog#',
    'Catalog #',
    'Catalogue Number',
    'Catalogue #',
    'Catalogue No',
    'Cat No.',
  ];
  const buildPrefixRegex = (prefixes: string[]) => {
    const escaped = prefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));

    return new RegExp(`(?:${escaped.join('|')})[\\s:-]+(\\S.+)`, 'i');
  };
  const catRegex = buildPrefixRegex(catPrefixes);
  const bracketedCatRegex = /\[([A-Z0-9-]{3,15})\]/;
  let labelNumber: string | null = null;

  items.some((el) => {
    // Try standard prefixes
    const match = el.match(catRegex);

    if (match?.[1]) {
      labelNumber = cleanString(match[1]);

      return true;
    }

    // Try bracketed format like [CAT001]
    const bracketMatch = el.match(bracketedCatRegex);

    if (bracketMatch?.[1]) {
      labelNumber = cleanString(bracketMatch[1]);

      return true;
    }

    return false;
  });

  // 3. Fallback: search for something that LOOKS like a catalog number
  if (!labelNumber) {
    const suspectedCat = items.find(it => /^[A-Z0-9]{3,10}-\d{1,5}$/.test(it) || /^[A-Z]{2,4}\d{3,6}$/.test(it));

    if (suspectedCat && suspectedCat.length < 20) {
      labelNumber = suspectedCat;
    }
  }

  return labelNumber;
}

/**
 * Extracts label name from credits and about items.
 *
 * @param items - Array of about strings.
 * @param credits - Array of credits strings.
 * @returns The parsed label name or null.
 */
function extractLabelName(items: string[], credits: string[]): string | null {
  const labelPrefixes = ['Label', 'Released on', 'Record Label'];
  const buildPrefixRegex = (prefixes: string[]) => {
    const escaped = prefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));

    return new RegExp(`(?:${escaped.join('|')})[\\s:-]+(\\S.+)`, 'i');
  };
  const labelRegex = buildPrefixRegex(labelPrefixes);
  let albumLabel: string | null = null;

  items.some((el) => {
    if (/label|released\s+on/i.test(el) && el.length < 100) {
      const match = el.match(labelRegex);

      if (match?.[1]) {
        albumLabel = cleanString(match[1]);

        return true;
      }
    }

    return false;
  });

  if (!albumLabel && credits.length) {
    albumLabel = credits.find(it => it.length > 1) || null;
  }

  return albumLabel;
}

/**
 * Adapter configuration for the Bandcamp digital store.
 * Handles pattern matching, DOM extraction, and normalization for Bandcamp release pages.
 */
export const bandcamp: StoreAdapter = {
  id: 'bandcamp',

  test: matchUrls(
    'https://*.bandcamp.com/album/*',
    'https://web.archive.org/web/*/*://*.bandcamp.com/album/*',
  ),

  supports: {
    formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
    hdAudio: true,
  },

  target: '.tralbumCommands',

  injectButton: (button, target) => {
    target.insertAdjacentElement('afterend', button);
  },

  parse: async () => {
    const albumCover = getTextFromTag('a.popupImage', null, 'href');
    const albumExtraArtists: ArtistCredit[] = [];
    const about = getManyTextFromTags('.tralbum-about', null, true);
    const credits = getManyTextFromTags('.tralbum-credits', null, true);
    const allCreditLines = [
      ...about.flatMap(c => c.split(/\r?\n/)),
      ...credits.flatMap(c => c.split(/\r?\n/)),
    ];

    allCreditLines.forEach((line) => {
      const trimmedLine = line.trim();

      if (trimmedLine) {
        normalizeTrackTitle(trimmedLine, albumExtraArtists);
      }
    });

    const albumArtists = normalizeMainArtists(getTextFromTag('#name-section h3 span') || getTextFromTag('#band-name-location .title'), albumExtraArtists);
    const albumTitle = normalizeTrackTitle(getTextFromTag('#name-section .trackTitle'), albumExtraArtists);
    const albumTracks: TrackData[] = Array.from(document.querySelectorAll('#track_table .track_row_view')).map((track, i) => {
      const trackExtraArtists: ArtistCredit[] = [];
      const { artists: trackArtists, title: trackTitle, bpm: trackBpm } = splitArtistTitle(getTextFromTag('.track-title', track), albumArtists, trackExtraArtists);
      const trackDuration = normalizeDuration(getTextFromTag('.time, .time.secondaryText', track));

      return {
        position: `${i + 1}`,
        extraartists: trackExtraArtists,
        artists: trackArtists,
        title: trackTitle,
        duration: trackDuration,
        bpm: trackBpm,
      };
    });
    const location = document.querySelector('#band-name-location');
    let albumLabel = location ? getTextFromTag('.title', location) : null;
    const labelCountry = location ? getTextFromTag('.location', location)?.split(',').pop()?.trim() || null : null;
    let labelNumber = null;
    const aboutItems = about.flatMap(c => c.split(/\r?\n/).map(line => cleanString(line)).filter(Boolean) as string[]);
    const creditItems = credits.flatMap(c => c.split(/\r?\n/).map(line => cleanString(line)).filter(Boolean) as string[]);
    const combinedItems = [...aboutItems, ...creditItems];

    labelNumber = extractCatalogNumber(combinedItems);

    if (!albumLabel) {
      albumLabel = extractLabelName(combinedItems, creditItems);
    }

    if (!albumLabel) {
      albumLabel = getTextFromTag('[itemprop="publisher"]');
    }

    let albumReleased = normalizeReleaseDate(getTextFromTag('.tralbum-credits'));

    // If release date is older than 2008, check publish date (Bandcamp changed behavior)
    if (albumReleased) {
      const dateParts = albumReleased.split('-');
      const year = Number.parseInt(dateParts[0], 10);
      const month = dateParts[1] ? Number.parseInt(dateParts[1], 10) : 0;
      const isOldYear = year < 2008;
      const isOldMonth = year === 2008 && month < 9;
      const isPre2008 = isOldYear || isOldMonth;

      if (isPre2008) {
        albumReleased = null;
      }
    }

    return {
      cover: albumCover,
      extraartists: albumExtraArtists,
      artists: albumArtists,
      title: albumTitle,
      label: albumLabel,
      number: labelNumber,
      country: labelCountry,
      released: albumReleased,
      tracks: albumTracks,
    };
  },
};
