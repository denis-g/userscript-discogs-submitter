/**
 * Normalizes various raw date strings into standard `YYYY-MM-DD` or `YYYY` formats.
 *
 * Supports patterns from specific stores (e.g. Bandcamp's `DD Mmm YYYY`, 7digital's `DD/MM/YYYY`, Juno's `DD Mmm, YYYY`).
 *
 * @param date - The raw date string scraped from a store.
 * @returns A normalized date string, or null if the input is falsy. Falls back to original string if no patterns match.
 *
 * @example
 * ```typescript
 * console.log(normalizeReleaseDate('05 Aug 2024')); // '2024-08-05'
 * console.log(normalizeReleaseDate('14 April, 2011')); // '2011-04-14'
 * console.log(normalizeReleaseDate('2009')); // '2009'
 * ```
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function normalizeReleaseDate(date: string | null | undefined): string | null {
  if (!date) {
    return null;
  }

  // 05 Aug 2024 or Aug 2024 - Bandcamp
  const gmtMatch = date.match(/(?:(\d{1,2})\s+)?([a-z]{3,})\s+(\d{4})/i);

  if (gmtMatch) {
    const day = gmtMatch[1] ? String(gmtMatch[1]).padStart(2, '0') : '00';
    const monthStr = gmtMatch[2].substring(0, 3).toLowerCase();
    const monthIndex = MONTHS.findIndex(month => month.toLowerCase() === monthStr);
    const year = gmtMatch[3];

    if (monthIndex !== -1) {
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}`;
    }
  }

  // 05/08/2024 - 7digital
  const euroDateMatch = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (euroDateMatch) {
    const day = euroDateMatch[1].padStart(2, '0');
    const month = euroDateMatch[2].padStart(2, '0');
    const year = euroDateMatch[3];

    return `${year}-${month}-${day}`;
  }

  // 14 April, 2011 - Juno Download
  const dateMatch = date.match(/(\d{1,2})\s+([a-z]{3,}),?\s+(\d{4})/i);

  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const monthStr = dateMatch[2].substring(0, 3).toLowerCase();
    const monthIndex = MONTHS.findIndex(month => month.toLowerCase() === monthStr);
    const year = dateMatch[3];

    if (monthIndex !== -1) {
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}`;
    }
  }

  // JUN 17 2021 or June 17, 2021 - Amazon Music
  const usDateMatch = date.match(/([a-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/i);

  if (usDateMatch) {
    const monthStr = usDateMatch[1].substring(0, 3).toLowerCase();
    const day = usDateMatch[2].padStart(2, '0');
    const year = usDateMatch[3];
    const monthIndex = MONTHS.findIndex(month => month.toLowerCase() === monthStr);

    if (monthIndex !== -1) {
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}`;
    }
  }

  // 1954, 2009
  const yearOnlyMatch = date.match(/(?<![\d-])\b(19|20)\d{2}\b(?![\d-])/);

  if (yearOnlyMatch) {
    return yearOnlyMatch[0];
  }

  return date;
}
