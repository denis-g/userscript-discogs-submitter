import { ignoreCapitalizationMap } from '@/config';

/**
 * Zero-width and invisible formatting characters that carry no visible content but survive a
 * plain `\s` whitespace collapse (which does not match them). Left in place they silently break
 * comparisons and duplicate detection, so they are stripped outright from every scraped value:
 * soft hyphen (U+00AD), Arabic letter mark (U+061C), Mongolian vowel separator (U+180E),
 * zero-width space/non-joiner/joiner plus directional marks (U+200B to U+200F), bidirectional
 * embedding / override controls (U+202A to U+202E), word joiner (U+2060), bidirectional isolate
 * controls (U+2066 to U+2069), and the BOM / zero-width no-break space (U+FEFF).
 */
const INVISIBLE_CHARACTERS_PATTERN = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;
/** Ellipsis characters (horizontal U+2026, midline U+22EF) normalized to three ASCII dots. */
const ELLIPSIS_PATTERN = /[\u2026\u22EF]/g;
/**
 * Dash characters normalized to a plain ASCII hyphen-minus (`-`): hyphen / non-breaking hyphen /
 * figure dash / en dash / em dash / horizontal bar (U+2010 to U+2015), minus sign (U+2212), and the
 * small / fullwidth hyphen-minus forms (U+FE58, U+FE63, U+FF0D).
 */
const DASH_PATTERN = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/**
 * Trims whitespace, optionally collapses multiple spaces/newlines/tabs into a single space,
 * replaces HTML non-breaking space entities (`&nbsp;`), converts non-breaking spaces (U+00A0)
 * to regular spaces, strips zero-width / invisible formatting characters, and normalizes
 * typographic ellipses (`…`) to `...` and dash variants (en/em dash, minus, etc.) to `-`.
 *
 * @param text - The sequence of characters to clean.
 * @param collapseWhitespace - Whether to collapse multiple whitespace characters into one (default: true).
 * @returns The cleaned string, or null if the input is empty or invalid.
 *
 * @example
 * ```typescript
 * const clean = cleanString('  Hello &nbsp;  World  ');
 * console.log(clean); // 'Hello World'
 *
 * // Strips a zero-width space hidden between letters
 * console.log(cleanString('Arti\u200Bst')); // 'Artist'
 * ```
 */
export function cleanString(text: string | null | undefined, collapseWhitespace = true): string | null {
  if (typeof text !== 'string') {
    return null;
  }

  let cleaned = text
    .replace(/&nbsp;/gi, ' ')
    .replace(INVISIBLE_CHARACTERS_PATTERN, '')
    // Normalize any non-breaking space to a regular space (also handled by the `\s` collapse
    // below, but done explicitly so it applies even when collapsing is disabled).
    .replace(/\u00A0/g, ' ')
    .replace(ELLIPSIS_PATTERN, '...')
    .replace(DASH_PATTERN, '-');

  if (collapseWhitespace) {
    cleaned = cleaned.replace(/\s+/g, ' ');
  }

  const result = cleaned.trim();

  return result || null;
}

/**
 * Standardizes casing to Title Case, cleans whitespace, and handles stylistic abbreviations.
 *
 * @param text - The sequence of characters to capitalize.
 * @returns The capitalized and cleaned string, or an empty string if input is falsy.
 *
 * @example
 * ```typescript
 * // Standard casing
 * console.log(capitalizeString("track name (mix)")); // "Track Name (Mix)"
 *
 * // Preserves stylistic casing
 * console.log(capitalizeString("LIVE AT LONDON")); // "Live At London"
 * console.log(capitalizeString("McDonald's")); // "McDonald's"
 *
 * // Handles abbreviations via ignore map
 * console.log(capitalizeString("It's an EP")); // "It's An EP"
 * ```
 */
export function capitalizeString(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  let cleaned = String(text).trim();

  // Replace various quote types with apostrophes
  cleaned = cleaned.replace(/[’`´]/g, '\'');
  // Replace parentheses with extra spaces with normal parentheses
  cleaned = cleaned.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

  return cleaned
    .split(/(\s+|(?=\/)|(?<=\/))/)
    .map((word, index, words) => {
      if (!word || /\s+/.test(word) || word === '/') {
        return word;
      }

      // Match non-letter/non-number at the start and end of the word
      // and the core word in the middle
      const match = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}](?:.*?[\p{L}\p{N}])?)([^\p{L}\p{N}]*)$/iu);

      if (!match) {
        return word;
      }

      const prefix = match[1];
      const core = match[2];
      const suffix = match[3];

      // Check if the core or suffix is an acronym (e.g., "U.S.A.")
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
            .find(word => /\S/.test(word));

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
 * @param text - The string to search.
 * @returns The extracted BPM number, or undefined if none found.
 *
 * @example
 * ```typescript
 * console.log(extractBpm("Track Title (156bpm)")); // 156
 * ```
 */
export function extractBpm(text: string | null | undefined): number | undefined {
  if (!text) {
    return undefined;
  }

  const match = text.match(/[([-]?\s*\b(\d{2,3})\s*bpm\b\s*[)\]]?/i);

  return match ? Number.parseInt(match[1], 10) : undefined;
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
};

/**
 * Escapes the five HTML-significant characters so untrusted text (e.g. scraped values
 * surfaced inside an error message) can be safely interpolated into an `innerHTML` string.
 *
 * @param text - The untrusted text to escape.
 * @returns The text with `&`, `<`, `>`, `"`, and `'` replaced by their HTML entities.
 *
 * @example
 * ```typescript
 * escapeHtml('<img src=x onerror=alert(1)>'); // '&lt;img src=x onerror=alert(1)&gt;'
 * ```
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return String(text).replace(/[&<>"']/g, character => HTML_ESCAPE_MAP[character]);
}
