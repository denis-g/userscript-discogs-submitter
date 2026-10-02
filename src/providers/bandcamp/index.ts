import type { ArtistCredit, StoreAdapter, TrackData } from '@/types';
import { normalizeMainArtists } from '@/domain/normalizers/artists';
import { normalizeReleaseDate } from '@/domain/normalizers/date';
import { normalizeDuration } from '@/domain/normalizers/duration';
import { normalizeTitle, splitArtistTitle } from '@/domain/normalizers/titles';
import { getManyTextFromTags, getTextFromTag } from '@/utils/dom';
import { escapeRegExp } from '@/utils/regex';
import { cleanString } from '@/utils/string';
import { isWebarchive, matchUrls } from '@/utils/url';

/**
 * Builds a case-insensitive regex that captures the value following any of the given prefixes.
 * Each prefix is regex-escaped and its internal whitespace made flexible (`\s+`), so
 * `'Catalog Number'` also matches `'Catalog  Number'`.
 *
 * @param prefixes - Label/catalog prefixes to match (e.g. `['Cat.', 'Catalog Number']`).
 * @returns A RegExp whose first capture group is the text following the matched prefix.
 */
function buildPrefixRegex(prefixes: string[]): RegExp {
  const escaped = prefixes.map(prefix => escapeRegExp(prefix).replace(/\s+/g, '\\s+'));

  return new RegExp(`(?:${escaped.join('|')})[\\s:-]+(\\S.+)`, 'i');
}

/**
 * Builds a case-insensitive regex that captures a catalog-number-shaped token following any of
 * the given prefixes. Unlike {@link buildPrefixRegex}, the capture is bounded to a single token
 * (e.g. `DDD113`) so a prefix embedded mid-sentence (e.g. in a prose "about" blurb) doesn't
 * swallow the rest of the sentence.
 *
 * @param prefixes - Catalog-number prefixes to match (e.g. `['Cat.', 'Catalog Number']`).
 * @returns A RegExp whose first capture group is the catalog number token following the matched prefix.
 */
function buildCatalogRegex(prefixes: string[]): RegExp {
  const escaped = prefixes.map(prefix => escapeRegExp(prefix).replace(/\s+/g, '\\s+'));

  return new RegExp(`(?:${escaped.join('|')})[\\s:-]+([A-Za-z0-9][\\w./-]{1,19})`, 'i');
}

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
    'Cat. No.',
    'Cat.',
    'Catalog#',
    'Catalog #',
    'Catalogue Number',
    'Catalogue #',
    'Catalogue No',
    'Cat No.',
  ];
  const catRegex = buildCatalogRegex(catPrefixes);
  const bracketedCatRegex = /\[([A-Z0-9-]{3,15})\]/;
  let labelNumber: string | null = null;

  items.some((element) => {
    // Try standard prefixes
    const match = element.match(catRegex);

    if (match?.[1]) {
      labelNumber = cleanString(match[1]);

      return true;
    }

    // Try bracketed format like [CAT001]
    const bracketMatch = element.match(bracketedCatRegex);

    if (bracketMatch?.[1]) {
      labelNumber = cleanString(bracketMatch[1]);

      return true;
    }

    return false;
  });

  // 3. Fallback: search for something that LOOKS like a catalog number
  if (!labelNumber) {
    const suspectedCat = items.find(item => /^[A-Z0-9]{3,10}-\d{1,5}$/.test(item) || /^[A-Z]{2,4}\d{3,6}$/.test(item));

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
  const labelRegex = buildPrefixRegex(labelPrefixes);
  let albumLabel: string | null = null;

  items.some((element) => {
    if (/label|released\s+on/i.test(element) && element.length < 100) {
      const match = element.match(labelRegex);

      if (match?.[1]) {
        albumLabel = cleanString(match[1]);

        return true;
      }
    }

    return false;
  });

  if (!albumLabel && credits.length) {
    albumLabel = credits.find(item => item.length > 1) || null;
  }

  return albumLabel;
}

/**
 * Extracts track duration on single-track Bandcamp pages where `#track_table` is absent.
 * Checks audio player DOM elements, `data-tralbum` script attribute,
 * `unsafeWindow.TralbumData`, JSON-LD schema metadata, and duration meta tags.
 *
 * @returns The normalized duration string, or an empty string if not found.
 */
function extractSingleTrackDuration(): string {
  const domDuration = getTextFromTag('.time_total') || getTextFromTag('.time, .time.secondaryText');

  if (domDuration) {
    const normalized = normalizeDuration(domDuration);

    if (normalized) {
      return normalized;
    }
  }

  const tralbumScript = document.querySelector('script[data-tralbum]');

  if (tralbumScript) {
    try {
      const tralbumData = JSON.parse(tralbumScript.getAttribute('data-tralbum') || '{}');
      const trackDuration = tralbumData.trackinfo?.[0]?.duration;

      if (trackDuration != null) {
        const normalized = normalizeDuration(trackDuration);

        if (normalized) {
          return normalized;
        }
      }
    }
    catch {
      // Ignore JSON parse errors in malformed script attributes
    }
  }

  try {
    const windowTralbum = (globalThis as any).unsafeWindow?.TralbumData;
    const trackDuration = windowTralbum?.trackinfo?.[0]?.duration;

    if (trackDuration != null) {
      const normalized = normalizeDuration(trackDuration);

      if (normalized) {
        return normalized;
      }
    }
  }
  catch {
    // Ignore unsafeWindow access errors
  }

  const jsonLdScript = document.querySelector('script[type="application/ld+json"]');

  if (jsonLdScript) {
    try {
      const jsonLd = JSON.parse(jsonLdScript.textContent || '{}');

      if (jsonLd.duration) {
        const normalized = normalizeDuration(jsonLd.duration);

        if (normalized) {
          return normalized;
        }
      }
    }
    catch {
      // Ignore JSON parse errors
    }
  }

  const metaDuration = getTextFromTag('meta[itemprop="duration"]', null, 'content');

  if (metaDuration) {
    return normalizeDuration(metaDuration);
  }

  return '';
}

/**
 * Adapter configuration for the Bandcamp digital store.
 * Handles pattern matching, DOM extraction, and normalization for Bandcamp release and track pages.
 */
export const bandcamp: StoreAdapter = {
  id: 'bandcamp',
  test: matchUrls(
    'https://*.bandcamp.com/album/*',
    'https://*.bandcamp.com/track/*',
    // The archived URL preserves the original scheme + port (e.g. `http://...bandcamp.com:80/album/`),
    // so allow anything between `.com` and `/album/` or `/track/` to swallow the port segment.
    'https://web.archive.org/web/*/*://*.bandcamp.com*/album/*',
    'https://web.archive.org/web/*/*://*.bandcamp.com*/track/*',
  ),
  supports: {
    formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
  },
  parse: async () => {
    const smallCover = isWebarchive()
      ? getTextFromTag('#tralbumArt img[itemprop="image"]', null, 'src')
      : getTextFromTag('a.popupImage img', null, 'src');
    const albumCover = isWebarchive()
      ? getTextFromTag('#tralbumArt img[itemprop="image"]', null, 'src')
      : getTextFromTag('a.popupImage', null, 'href');
    const albumExtraArtists: ArtistCredit[] = [];
    const about = getManyTextFromTags('.tralbum-about', null, true);
    const credits = getManyTextFromTags('.tralbum-credits', null, true);
    const allCreditLines = [
      ...about.flatMap(credit => credit.split(/\r?\n/)),
      ...credits.flatMap(credit => credit.split(/\r?\n/)),
    ];

    allCreditLines.forEach((line) => {
      const trimmedLine = line.trim();

      if (trimmedLine) {
        normalizeTitle(trimmedLine, albumExtraArtists);
      }
    });

    const albumArtists = normalizeMainArtists(
      isWebarchive()
        // Older snapshots expose the artist as schema.org microdata; newer snapshots mirror the
        // live layout, so fall back to the same `#name-section` heading the live branch reads.
        ? getTextFromTag('[itemtype*="MusicGroup"] meta[itemprop="name"]', null, 'content') || getTextFromTag('#name-section [itemprop="byArtist"]') || getTextFromTag('#name-section h3 > span:last-of-type')
        : getTextFromTag('#name-section [itemprop="byArtist"]') || getTextFromTag('#name-section h3 > span:last-of-type') || getTextFromTag('#band-name-location .title'),
      albumExtraArtists,
    );
    const albumTitle = normalizeTitle(getTextFromTag('#name-section .trackTitle'), albumExtraArtists);
    let albumTracks: TrackData[] = Array.from(document.querySelectorAll('#track_table .track_row_view')).map((track, index) => {
      const trackPosition = `${index + 1}`;
      const trackExtraArtists: ArtistCredit[] = [];
      const { artists: trackArtists, title: trackTitle, bpm: trackBpm } = splitArtistTitle(getTextFromTag('.title > span, .title > a', track), albumArtists, trackExtraArtists);
      const trackDuration = normalizeDuration(getTextFromTag('.time, .time.secondaryText', track));

      return {
        pos: trackPosition,
        extraartists: trackExtraArtists,
        artists: trackArtists,
        title: trackTitle,
        duration: trackDuration,
        bpm: trackBpm,
      };
    });

    if (albumTracks.length === 0) {
      const rawTrackTitle = getTextFromTag('#name-section .trackTitle');

      if (rawTrackTitle) {
        const trackExtraArtists: ArtistCredit[] = [];
        const { artists: trackArtists, title: trackTitle, bpm: trackBpm } = splitArtistTitle(rawTrackTitle, albumArtists, trackExtraArtists);
        const trackDuration = extractSingleTrackDuration();

        albumTracks = [
          {
            pos: '1',
            extraartists: trackExtraArtists,
            artists: trackArtists,
            title: trackTitle,
            duration: trackDuration,
            bpm: trackBpm,
          },
        ];
      }
    }

    const location = document.querySelector('#band-name-location');
    let albumLabel = location ? getTextFromTag('.title', location) : null;
    let labelNumber = null;
    const aboutItems = about.flatMap(credit => credit.split(/\r?\n/).map(line => cleanString(line)).filter(Boolean) as string[]);
    const creditItems = credits.flatMap(credit => credit.split(/\r?\n/).map(line => cleanString(line)).filter(Boolean) as string[]);
    const combinedItems = [...aboutItems, ...creditItems];

    labelNumber = extractCatalogNumber(combinedItems);

    if (!albumLabel) {
      albumLabel = extractLabelName(combinedItems, creditItems);
    }

    if (!albumLabel) {
      albumLabel = getTextFromTag('[itemprop="publisher"]');
    }

    let albumReleased = normalizeReleaseDate(
      isWebarchive()
        // Newer snapshots keep the "released …" line in `.tralbum-credits` (matched first, since the
        // generic `.tralbumData` class also tags the dateless `.tralbum-about` block); older snapshots
        // only carry `.tralbumData`, so keep it as the fallback.
        ? getTextFromTag('.tralbum-credits') || getTextFromTag('.tralbumData')
        : getTextFromTag('.tralbum-credits'),
    );

    // Discard release dates before Bandcamp's September 2008 launch — they are unreliable
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
      thumb: smallCover,
      cover: albumCover,
      extraartists: albumExtraArtists,
      artists: albumArtists,
      title: albumTitle,
      label: albumLabel,
      number: labelNumber,
      released: albumReleased,
      tracks: albumTracks,
    };
  },
};
