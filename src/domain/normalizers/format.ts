import { TITLE_FORMAT } from '@/config';
import { escapeRegExp } from '@/utils/regex';

/**
 * Extracts Discogs format descriptions from a release title based on configurable keywords.
 * Handles variations like "(EP)", "Album Name EP", or "Title (2019, EP, Remastered)".
 *
 * @param title - The release title to scan.
 * @returns Array of unique Discogs format descriptions.
 */
export function extractFormatFromTitle(title: string | null | undefined): string[] {
  if (!title) {
    return [];
  }

  const detectedFormats = new Set<string>();

  for (const [description, keywords] of Object.entries(TITLE_FORMAT)) {
    if (keywords.length === 0) {
      continue;
    }

    // Escape special characters in keywords and join them with OR
    const escapedKeywords = keywords.map(keyword => escapeRegExp(keyword));
    const pattern = `\\b(?:${escapedKeywords.join('|')})\\b`;
    const regex = new RegExp(pattern, 'i');

    if (regex.test(title)) {
      detectedFormats.add(description);
    }
  }

  return Array.from(detectedFormats);
}
