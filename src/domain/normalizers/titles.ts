import type { ArtistCredit } from '@/types';
import { REMOVE_FROM_TITLE } from '@/config';
import { capitalizeString, cleanString, extractBpm } from '@/utils/string';
import { extractExtraArtists, normalizeArtists } from './artists';

/**
 * Cleans titles (tracks or albums), standardizes casing, and extracts side-effect artist credits.
 *
 * @param rawTitle - The original title string.
 * @param extraArtists - Array to collect associated credits (e.g. remixers).
 * @returns Cleaned and formatted title.
 *
 * @example
 * ```typescript
 * const title = normalizeTitle('Track Title (Remix by Artist Name)', []);
 * ```
 */
export function normalizeTitle(rawTitle: string | null | undefined, extraArtists: ArtistCredit[] | null = null): string {
  if (!rawTitle) {
    return '';
  }

  let title = capitalizeString(rawTitle);

  REMOVE_FROM_TITLE.forEach((pattern) => {
    title = title.replace(pattern, '').trim();
  });

  if (extraArtists) {
    title = extractExtraArtists(title, extraArtists, ['Remix']);
  }

  // Add space before brackets
  title = title.replace(/(\S)([[(])/g, '$1 $2');

  return cleanString(title) || '';
}

/**
 * Result of splitting a composite title into its artist and title components.
 */
export interface SplitArtistTitleResult {
  /** The artists extracted from the artist portion (or the supplied fallback). */
  artists: ArtistCredit[];
  /** The normalized track title. */
  title: string;
  /** The BPM parsed from the raw title, if present. */
  bpm: number | undefined;
}

/**
 * Attempts to split a single string (often a track title) into separate artist and title components.
 *
 * @param rawTitle - The composite string containing artist and title (e.g. "Artist - Title").
 * @param defaultArtists - Fallback artist list if splitting fails.
 * @param extraArtists - Array to accumulate parsed credits.
 * @returns An object containing the extracted `artists`, track `title`, and parsed `bpm`.
 *
 * @example
 * ```typescript
 * const split = splitArtistTitle('Artist Name - Track Title', [], []);
 * ```
 */
export function splitArtistTitle(rawTitle: string | null | undefined, defaultArtists: ArtistCredit[], extraArtists: ArtistCredit[]): SplitArtistTitleResult {
  let cleanTitleForSplit = rawTitle || '';

  REMOVE_FROM_TITLE.forEach((pattern) => {
    cleanTitleForSplit = cleanTitleForSplit.replace(pattern, '').trim();
  });

  // Try to split by em dash, en dash, or hyphen
  const splitMatch = cleanTitleForSplit.match(/^(\S(?:.*?\S)?)\s+[-–—]\s*(\S.*)$/) || cleanTitleForSplit.match(/^(\S(?:.*?\S)?)[-–—]\s+(\S.*)$/);

  if (splitMatch) {
    const artistPart = splitMatch[1].trim();
    const titlePart = splitMatch[2].trim();
    const technicalParts = /^(?:intro|outro|skit|reprise|interlude)$/i;

    // Heuristic: Intro/Outro/etc are usually not artists or titles in this context (splitting hyphen)
    if (!technicalParts.test(artistPart) && !technicalParts.test(titlePart)) {
      return {
        artists: normalizeArtists(artistPart, extraArtists),
        title: normalizeTitle(titlePart, extraArtists),
        bpm: extractBpm(rawTitle),
      };
    }
  }

  return {
    artists: defaultArtists,
    title: normalizeTitle(rawTitle || '', extraArtists),
    bpm: extractBpm(rawTitle),
  };
}
