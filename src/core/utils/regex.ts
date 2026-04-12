/**
 * Utility functions for dynamically building and processing Regular Expressions.
 */

const SPACE_REGEX = /\s+/g;
const WORD_BOUNDARY_END_REGEX = /\\w$/;
const PLACEHOLDER_REGEX = /\{\{p\}\}/g;
const PLACEHOLDER_BOUNDARY_REGEX = /\\\{\\\{p\\\}\\\}\\b/g;
const JOINER_REPLACE_REGEX = /[.*+?^${}()|[\]\\]/g;

/**
 * Dynamically generates regex objects for artist credits or string cleaning.
 * Replaces the `{{p}}` placeholder in templates with the provided phrases.
 *
 * @param phrases - List of keywords to search for (e.g. `["remix", "rmx"]`).
 * @param templates - List of regex patterns containing the `{{p}}` placeholder.
 * @returns An array of compiled RegExp objects representing the parsed templates.
 *
 * @example
 * ```typescript
 * const templates = ['\\b{{p}}\\b'];
 * const regexes = buildCreditRegexes(['feat'], templates);
 * ```
 */
export function buildCreditRegexes(phrases: string[], templates: string[]): RegExp[] {
  return phrases.flatMap((phrase) => {
    // Escape spaces in phrases to match any whitespace
    const p = phrase.replace(SPACE_REGEX, '\\s+');

    return templates.map((t) => {
      let finalTemplate = t;

      // If the phrase doesn't end with a word character (like "f/"),
      // we remove the \b boundary to ensure it still matches.
      if (!WORD_BOUNDARY_END_REGEX.test(phrase)) {
        finalTemplate = finalTemplate.replace(PLACEHOLDER_BOUNDARY_REGEX, '{{p}}');
      }

      return new RegExp(finalTemplate.replace(PLACEHOLDER_REGEX, p), 'gi');
    });
  });
}

/**
 * Escapes special characters in a string for safe use in a RegExp.
 *
 * @param text - The raw string to escape.
 * @returns The escaped string safe for RegExp construction.
 *
 * @example
 * ```typescript
 * console.log(escapeRegExp('feat. artist (remix)')); // "feat\\. artist \\(remix\\)"
 * ```
 */
export function escapeRegExp(text: string): string {
  return text.replace(JOINER_REPLACE_REGEX, '\\$&');
}

/**
 * Builds a combined regex pattern for splitting artist lists based on provided joiner strings.
 *
 * @param joiners - List of string joiners (e.g., `["&", "vs"]`).
 * @returns A global, case-insensitive regex for splitting artists.
 *
 * @example
 * ```typescript
 * const regex = buildJoinerPattern(['&', 'vs']);
 * const parts = 'Artist A & Artist B'.split(regex);
 * ```
 */
export function buildJoinerPattern(joiners: string[]): RegExp {
  const escapedJoiners = joiners.map(j => escapeRegExp(j));
  const strongJoiners = escapedJoiners.filter(j => j.toLowerCase() !== 'x');
  const xJoiner = escapedJoiners.find(j => j.toLowerCase() === 'x');
  const strongPattern = `(?:\\s+(?:${strongJoiners.join('|')})(?=\\s+)|\\s*,\\s*)`;

  if (xJoiner) {
    // Only match "x" as a joiner if it's surrounded by spaces and NOT followed by another joiner
    const xPattern = `\\s+${xJoiner}(?=\\s+(?!${strongJoiners.join('|')}|,))`;

    return new RegExp(`((?:${strongPattern})+|${xPattern})`, 'i');
  }

  return new RegExp(`((?:${strongPattern})+)`, 'i');
}

/**
 * Builds an Oxford comma detection pattern for a list of joiners.
 *
 * @param joiners - List of string joiners (e.g., `["&", "and"]`).
 * @returns A RegExp targeting the Oxford comma format, or null if no valid joiners are found.
 *
 * @example
 * ```typescript
 * const regex = buildOxfordPattern(['&']);
 * const result = 'A, B, & C'.replace(regex, ' $1 '); // 'A, B & C'
 * ```
 */
export function buildOxfordPattern(joiners: string[]): RegExp | null {
  const nonCommaJoiners = joiners
    .filter(j => j !== ',')
    .map(j => escapeRegExp(j));

  return nonCommaJoiners.length > 0
    ? new RegExp(`,\\s*(${nonCommaJoiners.join('|')})(?:\\s+|$)`, 'gi')
    : null;
}
