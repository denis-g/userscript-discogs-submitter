import { buildCreditRegexes } from '@/core/utils/regex';

/**
 * Shared regex templates for capturing artist credits.
 * These templates use the `{{p}}` placeholder which is replaced by specific role keywords
 * (e.g., 'remix', 'feat') during regex construction.
 *
 * Prevents regex duplication across individual stores and roles.
 */
export const GLOBAL_CREDIT_REGEX: string[] = [
  '(?:\\(|\\[)\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*([^()[\\]]+)(?:\\)|\\])',
  '(?:\\s+|^)(?:\\w+\\s+(?:and|&)\\s+)?{{p}}(?:\\s+(?:and|&)\\s+\\w+)?\\s+by\\b\\s*[:\\s-]*(.+?)(?=\\s*(?:\\/|;|[A-Z][a-z]+:(?=\\s*\\S)|,|$))',
  '(?:\\s+|^)(?:\\w+\\s+(?:and|&)\\s+)?{{p}}(?:\\s+(?:and|&)\\s+\\w+)?\\b\\s*[:-]\\s*(.+?)(?=\\s*(?:\\/|;|[A-Z][a-z]+:(?=\\s*\\S)|,|$))',
  '(?:\\s+|^){{p}}(?:\\s+\\w+)*\\s+by\\b\\s*[:\\s-]*(.+?)(?=\\s*(?:\\/|;|,|$))',
];

/**
 * Mapping of standardized Discogs artist credit roles to their specific regex patterns.
 * Patterns are built using `buildCreditRegexes` to combine role keywords with global templates.
 *
 * @see {@link GLOBAL_CREDIT_REGEX} for the templates used in these patterns.
 */
export const ARTIST_CREDIT_ROLES: Record<string, RegExp[]> = {
  'Featuring': buildCreditRegexes(
    ['featuring', 'feat', 'ft', 'f/'],
    [
      '(?:\\(|\\[)\\s*{{p}}\\b\\.?\\s*([^()[\\]]+)(?:\\)|\\])',
      '(?:\\s+|^){{p}}\\b\\.?\\s*(.+?)(?=\\s+\\b(?:feat|ft|prod|remix|vs|with|and|&)\\b|\\s*[\\[\\(]|$)',
    ],
  ),
  'Remix': [
    // (Remix By Artist)
    ...buildCreditRegexes(
      ['remix', 'rmx', 'remixed', 'mix', 'mixed', 're-mix', 're-mixed', 'version', 'edit', 'edited', 're-edit', 're-edited', 'rework', 'reworked', 'rebuild', 'rebuilt'],
      [
        '(?:\\(|\\[)\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*([^()[\\]]+)(?:\\)|\\])',
        '(?:\\s+|^)-\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*(.+?)(?=\\s*[\\[\\(]|$)',
      ],
    ),
    // (Artist Remix)
    ...buildCreditRegexes(
      ['remix', 'rmx', 're-mix'],
      [
        '(?:\\(|\\[)\\s*([^()[\\]]+)\\s+{{p}}\\b\\s*(?:\\)|\\])',
      ],
    ),
    // (Artist's Remix)
    ...buildCreditRegexes(
      ['remix', 'rmx', 'remixed', 'mix', 'mixed', 're-mix', 're-mixed', 'version', 'edit', 'edited', 're-edit', 're-edited', 'rework', 'reworked', 'rebuild', 'rebuilt'],
      [
        '(?:\\(|\\[)\\s*([^()[\\]]+)\'s(?:\\s+.*?)?\\s+{{p}}\\b\\s*(?:\\)|\\])',
      ],
    ),
  ],
  'DJ Mix': buildCreditRegexes(
    ['dj mix', 'dj-mix'],
    // default
    GLOBAL_CREDIT_REGEX,
  ),
  'Compiled By': buildCreditRegexes(
    ['compiled', 'selected'],
    // default
    GLOBAL_CREDIT_REGEX,
  ),
  'Artwork': buildCreditRegexes(
    ['artwork', 'art work', 'art', 'design', 'designed', 'cover', 'cover art', 'layout'],
    // default
    GLOBAL_CREDIT_REGEX,
  ),
  'Producer': buildCreditRegexes(
    ['produced', 'producer', 'prod.'],
    // default
    GLOBAL_CREDIT_REGEX,
  ),
  'Written-By': buildCreditRegexes(
    ['written', 'written-by', 'writing'],
    // default
    GLOBAL_CREDIT_REGEX,
  ),
  'Written-By, Producer': buildCreditRegexes(
    ['w&p', 'w & p', 'written & produced', 'written and produced', 'produced & written', 'produced and written'],
    // default
    GLOBAL_CREDIT_REGEX,
  ),
  'Mastered By': buildCreditRegexes(
    ['mastered', 'mastering', 'master', 'mastering engineer'],
    // default
    GLOBAL_CREDIT_REGEX,
  ),
  'Performer': buildCreditRegexes(
    ['performer', 'performed', 'performing'],
    // default
    GLOBAL_CREDIT_REGEX,
  ),
};
