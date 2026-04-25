import { buildCreditRegexes, buildJoinerPattern, buildOxfordPattern } from '@/core/utils/regex';

/**
 * Shared regex templates for capturing artist credits.
 * Prevents regex duplication across individual stores.
 */
export const GLOBAL_CREDIT_REGEX: string[] = [
  '(?:\\(|\\[)\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*([^()[\\]]+)(?:\\)|\\])',
  '(?:\\s+|^)(?:\\w+\\s+(?:and|&)\\s+)?{{p}}(?:\\s+(?:and|&)\\s+\\w+)?\\s+by\\b\\s*[:\\s-]*(.+?)(?=\\s*(?:\\/|;|[A-Z][a-z]+:(?=\\s*\\S)|,|$))',
  '(?:\\s+|^)(?:\\w+\\s+(?:and|&)\\s+)?{{p}}(?:\\s+(?:and|&)\\s+\\w+)?\\b\\s*[:-]\\s*(.+?)(?=\\s*(?:\\/|;|[A-Z][a-z]+:(?=\\s*\\S)|,|$))',
  '(?:\\s+|^){{p}}(?:\\s+\\w+)*\\s+by\\b\\s*[:\\s-]*(.+?)(?=\\s*(?:\\/|;|,|$))',
];

/**
 * Global dictionaries for parsing artist joiners, VA variations, and standard roles.
 */
export const PATTERNS = {
  joiners: [',', '/', '|', 'And', '&', 'X', '×', 'With', 'w/', 'Vs', 'Vs.', 'Versus', 'Present', 'Pres.', 'Aka', 'Meets'],

  variousArtists: buildCreditRegexes(
    ['VA', 'V A', 'V\\/A', 'Various', 'Various Artists', 'Varios', 'Varios Artistas', 'Různí', 'Různí interpreti'],
    ['^{{p}}$'],
  ),

  removeFromArtistName: [] as RegExp[],

  removeFromTitleName: [
    ...buildCreditRegexes(
      ['original mix', 'original', 'remaster', 'remastered', 'explicit', 'digital bonus track', 'digital bonus', 'bonus track', 'bonus', '24bit', '24 bit', '16bit', '16 bit'],
      ['\\(\\s*{{p}}\\s*\\)', '\\[\\s*{{p}}\\s*\\]', '-\\s*{{p}}\\b'],
    ),
    /[([-]?\s*\b\d{2,3}\s*bpm\b\s*[)\]]?/gi,
  ],

  artistCredit: {
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
  } as Record<string, RegExp[]>,
};

/** Pre-compiled global regular expression for detecting artist joiners. */
export const joinerPattern = buildJoinerPattern(PATTERNS.joiners);

/** Pre-compiled global regular expression for detecting Oxford comma variations. */
export const oxfordPattern = buildOxfordPattern(PATTERNS.joiners);
