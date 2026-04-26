import { buildCreditRegexes } from '@/core/utils/regex';

/**
 * Regex patterns for identifying "Various Artists" across different languages and abbreviations.
 * Used to trigger fallback to the standardized "Various" artist name on Discogs.
 */
export const VARIOUS_ARTISTS = buildCreditRegexes(
  [
    'VA',
    'V.A',
    'V.A.',
    'V. A',
    'V. A.',
    'V A',
    'V\\/A',
    'Various',
    'Various Artists',
    'Varios',
    'Varios Artistas',
    'Různí',
    'Různí interpreti',
  ],
  ['^{{p}}$'],
);
