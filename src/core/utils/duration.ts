/**
 * Normalizes duration strings or numbers (e.g., seconds or HH:MM:SS) into a standard MM:SS or HH:MM:SS format.
 *
 * @param rawDuration - The raw duration value scraped from the store.
 * @returns The normalized duration string, or an empty string if input is falsy.
 *
 * @example
 * ```typescript
 * console.log(normalizeDuration(326)); // "05:26"
 * console.log(normalizeDuration("00:01:23")); // "1:23"
 * ```
 */
export function normalizeDuration(rawDuration: string | number | null | undefined): string {
  if (!rawDuration) {
    return '';
  }

  const trimmed = String(rawDuration).trim();

  // Seconds based (ex. 326 or 397.24) - Bandcamp, Juno Download, 7digital
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const totalSeconds = Math.round(Number.parseFloat(trimmed));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const timeParts = [minutes, seconds].map(val => String(val).padStart(2, '0'));

    if (hours > 0) {
      timeParts.unshift(String(hours));
    }
    else {
      // Remove leading zero from minutes if no hours (e.g., "05:23" -> "5:23")
      timeParts[0] = Number.parseInt(timeParts[0], 10).toString();
    }

    return timeParts.join(':');
  }

  // Standard HMS/MS based (ex. 01:23 or 01:23:45) - Qobuz
  const hmsMatch = trimmed.match(/^(?:\d+:)?\d{1,2}:\d{2}$/);

  if (hmsMatch) {
    const parts = trimmed.split(':').map(p => p.padStart(2, '0'));

    // If HH is 00, remove it
    if (parts.length === 3 && Number.parseInt(parts[0], 10) === 0) {
      parts.shift();
    }

    // Remove leading zero from first segment (H or M)
    parts[0] = Number.parseInt(parts[0], 10).toString();

    return parts.join(':');
  }

  return trimmed || '';
}
