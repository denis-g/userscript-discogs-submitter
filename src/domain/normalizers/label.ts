import { cleanString } from '@/utils/string';

/**
 * Normalizes the release label by applying heuristics for self-releases.
 * If the label name matches the primary artist's name (case-insensitive),
 * it transforms the label to the standard Discogs "Not On Label" format.
 *
 * @param label - The raw label name from the store.
 * @param primaryArtistName - The name of the primary artist for the release.
 * @returns The normalized label string.
 *
 * @example
 * ```typescript
 * normalizeLabel('ARTIST NAME', 'Artist Name'); // "Not On Label (Artist Name Self-released)"
 * normalizeLabel('Label Name', 'Artist Name'); // "Label Name"
 * ```
 */
export function normalizeLabel(label: string | null | undefined, primaryArtistName: string | null | undefined): string {
  const cleanLabel = cleanString(label) || '';
  const cleanArtist = cleanString(primaryArtistName) || '';

  if (!cleanLabel) {
    return 'Not On Label';
  }

  if (cleanArtist && cleanLabel.toLowerCase() === cleanArtist.toLowerCase()) {
    return `Not On Label (${cleanArtist} Self-released)`;
  }

  return cleanLabel;
}
