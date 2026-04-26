import { buildCreditRegexes } from '@/core/utils/regex';

/**
 * Patterns of common terms or promotional text to remove from artist names.
 */
export const REMOVE_FROM_ARTIST = [];

/**
 * Patterns of common terms, version info, or promotional text to remove from track/album titles.
 * Includes technical details like BPM, bit depth, and "Bonus Track" markers.
 */
export const REMOVE_FROM_TITLE = [
  ...buildCreditRegexes(
    ['original mix', 'original', 'remaster', 'remastered', 'explicit', 'digital bonus track', 'digital bonus', 'bonus track', 'bonus', '24bit', '24 bit', '16bit', '16 bit'],
    ['\\(\\s*{{p}}\\s*\\)', '\\[\\s*{{p}}\\s*\\]', '-\\s*{{p}}\\b'],
  ),
  /[([-]?\s*\b\d{2,3}\s*bpm\b\s*[)\]]?/gi,
];
