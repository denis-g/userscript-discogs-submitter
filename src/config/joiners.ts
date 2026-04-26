import { buildJoinerPattern, buildOxfordPattern } from '@/core/utils/regex';

/**
 * List of recognized artist joiners used to split artist strings.
 * Includes punctuation, conjunctions, and collaboration markers.
 */
export const ARTIST_JOINERS = [
  ',',
  '/',
  '|',
  'And',
  '&',
  'X',
  '×',
  'With',
  'w/',
  'Vs',
  'Vs.',
  'Versus',
  'Present',
  'Pres.',
  'Aka',
  'Meets',
];

/** Pre-compiled global regular expression for detecting artist joiners. */
export const joinerPattern = buildJoinerPattern(ARTIST_JOINERS);

/** Pre-compiled global regular expression for detecting Oxford comma variations. */
export const oxfordPattern = buildOxfordPattern(ARTIST_JOINERS);
