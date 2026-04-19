import { ignoreCapitalizationMap } from '@/config/abbreviations';

/**
 * Trims whitespace, optionally collapses multiple spaces/newlines/tabs into a single space,
 * and replaces HTML non-breaking space entities (`&nbsp;`).
 *
 * @param str - The sequence of characters to clean.
 * @param collapseWhitespace - Whether to collapse multiple whitespace characters into one (default: true).
 * @returns The cleaned string, or null if the input is empty or invalid.
 *
 * @example
 * ```typescript
 * const clean = cleanString('  Hello &nbsp;  World  ');
 * console.log(clean); // 'Hello World'
 * ```
 */
export function cleanString(str: string | null | undefined, collapseWhitespace = true): string | null {
  if (typeof str !== 'string') {
    return null;
  }

  let cleaned = str.replace(/&nbsp;/gi, ' ');

  if (collapseWhitespace) {
    cleaned = cleaned.replace(/\s+/g, ' ');
  }

  const result = cleaned.trim();

  return result || null;
}

/**
 * Standardizes casing to Title Case, cleans whitespace, and handles stylistic abbreviations.
 *
 * @param str - The sequence of characters to capitalize.
 * @returns The capitalized and cleaned string, or an empty string if input is falsy.
 *
 * @example
 * ```typescript
 * // Standard casing
 * console.log(capitalizeString("yet another track (super mix)")); // "Yet Another Track (Super Mix)"
 *
 * // Preserves stylistic casing
 * console.log(capitalizeString("LIVE AT LONDON")); // "Live At London"
 * console.log(capitalizeString("McDonalds")); // "McDonalds"
 *
 * // Handles abbreviations via ignore map
 * console.log(capitalizeString("It's an EP")); // "It's An EP"
 * ```
 */
export function capitalizeString(str: string | null | undefined): string {
  if (!str) {
    return '';
  }

  let cleaned = String(str).trim();

  cleaned = cleaned.replace(/[’`´]/g, '\'');
  cleaned = cleaned.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

  return cleaned
    .split(/(\s+|(?=\/)|(?<=\/))/)
    .map((word, index, words) => {
      if (!word || /\s+/.test(word) || word === '/') {
        return word;
      }

      const match = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}](?:.*?[\p{L}\p{N}])?)([^\p{L}\p{N}]*)$/iu);

      if (!match) {
        return word;
      }

      const prefix = match[1];
      const core = match[2];
      const suffix = match[3];

      if (/^[A-Z](?:\.[A-Z])+\.?$/i.test(core + suffix)) {
        return prefix + (core + suffix).toUpperCase();
      }

      const upperCore = core.toUpperCase();
      const upperCoreNoDots = upperCore.replace(/\./g, '');
      // Smart check for AM/PM (time vs word)
      const isWordAMorPM = upperCoreNoDots === 'AM' || upperCoreNoDots === 'PM';
      const isFusedTime = /^\d+(?::\d+)?(?:AM|PM)$/.test(upperCoreNoDots);

      if (isWordAMorPM || isFusedTime) {
        let isTimeContext = isFusedTime;

        if (!isTimeContext) {
          const prevNonSpace = words
            .slice(0, index)
            .reverse()
            .find(w => /\S/.test(w));

          isTimeContext = !!(prevNonSpace && /\d/.test(prevNonSpace));
        }

        if (isTimeContext) {
          return prefix + upperCoreNoDots + suffix;
        }
      }

      const exception = ignoreCapitalizationMap.get(upperCoreNoDots);

      if (exception) {
        return prefix + exception + suffix;
      }

      const hasUppercaseAfterFirst = /[^\p{L}\p{N}]*[\p{L}\p{N}].*\p{Lu}/u.test(core);
      const hasLowercase = /\p{Ll}/u.test(core);

      if (hasUppercaseAfterFirst && hasLowercase) {
        return prefix + core + suffix;
      }

      if (core.length > 0) {
        const capitalizedCore = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();

        return prefix + capitalizedCore + suffix;
      }

      return word;
    })
    .join('');
}

/**
 * Extracts a BPM value from a string.
 *
 * @param str - The string to search.
 * @returns The extracted BPM number, or undefined if none found.
 *
 * @example
 * ```typescript
 * console.log(extractBpm("Song name (156bpm)")); // 156
 * ```
 */
export function extractBpm(str: string | null | undefined): number | undefined {
  if (!str) {
    return undefined;
  }

  const match = str.match(/[([-]?\s*\b(\d{2,3})\s*bpm\b\s*[)\]]?/i);

  return match ? Number.parseInt(match[1], 10) : undefined;
}
