/**
 * Keywords for pre-selecting edition and format info from release titles.
 * These are mapped to standardized Discogs format descriptions.
 * If the keyword list is empty, the format will be available in the UI but not automatically extracted.
 */
export const TITLE_FORMAT: Record<string, string[]> = {
  'Album': [
    'remix album',
    'rmx album',
  ],
  'Mini-Album': [],
  'EP': [
    'EP',
    'E.P',
    'E.P.',
    'E-P',
    'Extended Play',
  ],
  'Maxi-Single': [
    'maxi single',
    'maxi-single',
  ],
  'Single': [
    'single',
  ],
  'Compilation': [
    'compilation',
    'compiled by',
  ],
  'Deluxe Edition': [
    'deluxe edition',
    'deluxe version',
    'deluxe',
    'dlx',
  ],
  'Limited Edition': [
    'limited edition',
    'limited version',
    'ltd. edition',
    'ltd. version',
    'ltd edition',
    'ltd version',
  ],
  'Mixed': [
    'mix by',
    'mixed by',
  ],
  'Mixtape': [
    'mixtape',
  ],
  'Reissue': [
    'reissue',
    're-issue',
  ],
  'Remastered': [
    'remaster',
    'remastered',
  ],
  'Unofficial Release': [
    'unofficial',
    'non official',
    'unofficial release',
  ],
};

export const RELEASE_TYPES = Object.keys(TITLE_FORMAT);

export const FILE_FORMATS = [
  'WAV',
  'FLAC',
  'MP3',
  'AIFF',
  'ALAC',
  'DFS',
];
