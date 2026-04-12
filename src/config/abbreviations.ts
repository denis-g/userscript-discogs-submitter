/**
 * Internal list of word abbreviations that bypass capitalization formatting.
 */
const IGNORE_CAPITALIZATION = [
  // abbreviations
  'FM',
  'VHS',
  'VIP',
  'UFO',
  'WTF',
  'WWII',
  'WWIII',
  'LSD',
  'TNT',
  'DNA',
  'BBQ',
  'MK',
  // roman numerals
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  // time
  'AM',
  'PM',
  // music
  'DJ',
  'MC',
  'EP',
  'LP',
  // formats
  'CD',
  'DVD',
  'HD',
  'MP3',
  'DAT',
  // organizations
  'NASA',
  'FBI',
  'CIA',
  'KGB',
  'MI6',
  // countries
  'UK',
  'USA',
  'USSR',
  'GDR',
  'DDR',
];

/**
 * Pre-calculated map for O(1) abbreviation lookups during capitalization parsing.
 */
export const ignoreCapitalizationMap = new Map<string, string>();

IGNORE_CAPITALIZATION.forEach((ex) => {
  ignoreCapitalizationMap.set(ex.replace(/\./g, '').toUpperCase(), ex);
});
