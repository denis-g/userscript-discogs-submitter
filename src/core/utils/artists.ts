import type { ArtistCredit } from '@/types';
import { ARTIST_CREDIT_ROLES, ARTIST_JOINERS, joinerPattern, oxfordPattern, REMOVE_FROM_ARTIST, REMOVE_FROM_TITLE, VARIOUS_ARTISTS } from '@/config';
import { capitalizeString, cleanString, extractBpm } from './string';

/**
 * Heuristic check to determine if a captured string is likely a credit (artist name)
 * or just ordinary descriptive text (prose).
 *
 * @param text - The string to check.
 * @returns True if it looks like a valid artist name, false if it is likely prose (e.g. "Includes digital bonus tracks").
 *
 * @example
 * ```typescript
 * console.log(isValidCreditPhrase('Artist Name')); // true
 * console.log(isValidCreditPhrase('This album was recorded in 1999')); // false
 * ```
 */
export function isValidCreditPhrase(text: string | null | undefined): boolean {
  if (!text || text.length > 150) {
    return false;
  }

  // Remove common promotional words
  const promoBlacklist = /\b(?:tracks?|music|album|exclusive|material|songs?|ep|lp|release|available|digital|vinyl|download|stream|out\s+now|listen|debut|compilation|collection)\b/i;

  if (promoBlacklist.test(text)) {
    return false;
  }

  const blocks = text.split(joinerPattern).filter(Boolean);
  const hasLongSentence = blocks.some((block) => {
    const cleanBlock = block.trim().replace(/[.,;!"'()[\]{}<>:]/g, '');

    return cleanBlock.split(/\s+/).filter(Boolean).length > 5;
  });

  return !hasLongSentence;
}

/**
 * Parses a string containing one or more artists separated by joiners (e.g., ",", "&", "feat").
 *
 * @param artistString - Raw string to parse.
 * @param extraArtists - Optional array to collect any side-effect credits found.
 * @returns An array of normalized ArtistCredit objects.
 *
 * @example
 * ```typescript
 * const credits = parseArtists('Artist One & Artist Two feat. Artist Three');
 * // [{name: "Artist One", join: "&"}, {name: "Artist Two", join: "feat."}, {name: "Artist Three", join: ","}]
 * ```
 */
export function parseArtists(artistString: string | null | undefined, extraArtists: ArtistCredit[] | null = null): ArtistCredit[] {
  if (!artistString) {
    return [];
  }

  let processedString = artistString;

  if (oxfordPattern) {
    processedString = artistString.replace(oxfordPattern, ' $1 ');
  }

  const parts = processedString.split(joinerPattern);
  const artists: ArtistCredit[] = [];

  for (let index = 0; index < parts.length; index += 2) {
    const rawName = parts[index].trim();
    const join = parts[index + 1] || null;

    if (rawName) {
      const normalized = normalizeArtists(rawName, extraArtists, true);

      if (normalized.length > 0) {
        const artist = { ...normalized[0] };

        if (join) {
          const originalJoin = ARTIST_JOINERS.find(joiner => joiner.toLowerCase() === join.trim().toLowerCase());

          artist.join = originalJoin || join;
        }
        else {
          artist.join = ',';
        }

        artists.push(artist);
      }
    }
  }

  return artists;
}

/**
 * Scans text for artist credits (e.g. "Remix by...", "feat. ...") using patterns.
 * When found, it adds the credit to the extraArtists array and removes it from the original text.
 *
 * @param text - The text to scan.
 * @param extraArtists - Mutated array where found credits are stored.
 * @param preserveRoles - List of roles that should NOT be removed from the text (e.g., "Remix" often stays in title).
 * @returns Cleaned text with credits removed (unless preserved).
 *
 * @example
 * ```typescript
 * const extra = [];
 * const clean = extractExtraArtists('Track Title (Remix by Artist One)', extra);
 * // clean: "Track Title"
 * // extra: [{name: "Artist Name", role: "Remix"}]
 * ```
 */
export function extractExtraArtists(text: string, extraArtists: ArtistCredit[], preserveRoles: string[] = []): string {
  if (!text) {
    return '';
  }

  let processedText = text;

  for (const [role, patterns] of Object.entries(ARTIST_CREDIT_ROLES)) {
    for (const pattern of patterns) {
      processedText = processedText.replace(pattern, (fullMatch, capturedName) => {
        if (typeof capturedName !== 'string') {
          return fullMatch;
        }

        let cleanCapture = capturedName.replace(/[.:,;\s]+$/, '').trim();
        const chunks = cleanCapture.split(/\.\s+/);

        if (chunks.length > 1) {
          let validName = chunks[0];
          const namePrefixes = new Set(['mr', 'mrs', 'dr', 'st', 'vs', 'feat', 'ft', 'prof', 'bros', 'inc', 'ltd', 'vol']);

          for (let chunkIndex = 1; chunkIndex < chunks.length; chunkIndex++) {
            const prevChunk = chunks[chunkIndex - 1];
            const words = prevChunk.split(/\s+/);
            const lastWord = words.at(-1)?.toLowerCase() || '';

            if (lastWord.length === 1 || namePrefixes.has(lastWord)) {
              validName += `. ${chunks[chunkIndex]}`;
            }
            else {
              break;
            }
          }

          cleanCapture = validName;
        }

        if (isValidCreditPhrase(cleanCapture)) {
          const items = parseArtists(cleanCapture, extraArtists);

          items.forEach((artist) => {
            if (artist.name && !extraArtists.some(existing => existing.name === artist.name && existing.role === role)) {
              extraArtists.push({ name: artist.name, role });
            }
          });

          return preserveRoles.includes(role) ? fullMatch : '';
        }

        return fullMatch;
      });
    }
  }

  return processedText.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Cleans and standardizes artist names while extracting extra credits.
 *
 * @param artists - The raw artist string or array of strings.
 * @param extraArtists - Mutated array for passing along side-effect credits.
 * @param isSubcall - Internal flag to prevent infinite recursion during chunking.
 * @returns A normalized array of ArtistCredit objects.
 *
 * @example
 * ```typescript
 * const credits = normalizeArtists('Raw Name', []);
 * ```
 */
export function normalizeArtists(artists: string | string[] | null | undefined, extraArtists: ArtistCredit[] | null = null, isSubcall = false): ArtistCredit[] {
  if (!artists) {
    return isSubcall ? [] : [{ name: '', join: ',' }];
  }

  if (!isSubcall) {
    const processedString = Array.isArray(artists) ? artists.filter(Boolean).join(', ') : artists;

    if (typeof processedString === 'string') {
      return parseArtists(processedString, extraArtists);
    }
  }

  const artistList = Array.isArray(artists) ? artists : [artists];
  const normalizedNames = artistList
    .map((rawArtist) => {
      if (!rawArtist) {
        return null;
      }

      let cleaned = cleanString(rawArtist);

      if (!cleaned) {
        return null;
      }

      if (extraArtists) {
        cleaned = extractExtraArtists(cleaned, extraArtists);
      }

      REMOVE_FROM_ARTIST.forEach((pattern) => {
        cleaned = (cleaned as string).replace(pattern, '').trim();
      });

      return capitalizeString(cleaned);
    })
    .filter((name): name is string => Boolean(name));

  if (normalizedNames.length === 0) {
    return isSubcall ? [] : [{ name: 'Unknown Artist', join: ',' }];
  }

  return normalizedNames.map(name => ({ name, join: ',' }));
}

/**
 * Normalizes and standardizes the release-level artist list.
 *
 * Logic flow:
 * 1. "Compiled By" artists become primary if found.
 * 2. Extremely long artist lists (>5) default to "Various".
 * 3. Fallbacks to common "Various Artists" expressions.
 *
 * @param rawArtists - Original artist string or array from store.
 * @param extraArtists - Current collected credits (used for compiler detection).
 * @returns Standardized Discogs-ready artist list.
 *
 * @example
 * ```typescript
 * const artists = normalizeMainArtists('Various Artists', null);
 * // [{name: 'Various', join: ','}]
 * ```
 */
export function normalizeMainArtists(rawArtists: string | string[] | null | undefined, extraArtists: ArtistCredit[] | null = null): ArtistCredit[] {
  const normalized = normalizeArtists(rawArtists, extraArtists);

  if (Array.isArray(extraArtists)) {
    const compilers = extraArtists.filter(artist => artist.role === 'Compiled By');

    if (compilers.length > 0) {
      // Deduplicate compilers: keep the most complete name
      const compilerMap = new Map<string, string>();

      compilers.forEach((compiler) => {
        const normalizedName = compiler.name.toLowerCase();
        let found = false;

        for (const [existingName] of compilerMap.entries()) {
          if (existingName.includes(normalizedName) || normalizedName.includes(existingName)) {
            if (normalizedName.length > existingName.length) {
              compilerMap.delete(existingName);
              compilerMap.set(normalizedName, compiler.name);
            }

            found = true;

            break;
          }
        }

        if (!found) {
          compilerMap.set(normalizedName, compiler.name);
        }
      });

      return Array.from(compilerMap.values()).map(name => ({ name, join: ',' }));
    }
  }

  // If there are too many artists, default to "Various"
  if (normalized.length >= 4) {
    return [{ name: 'Various', join: ',' }];
  }

  if (VARIOUS_ARTISTS.length > 0) {
    const isVA = normalized.some(artist => VARIOUS_ARTISTS.some(pattern => pattern.test(artist.name)));

    if (isVA) {
      return [{ name: 'Various', join: ',' }];
    }
  }

  return normalized;
}

/**
 * Merges multiple credits for the same artist into a single entry with combined roles.
 *
 * @param artists - List of potentially duplicate artist credits.
 * @returns Unified list with deduplicated names and merged roles.
 *
 * @example
 * ```typescript
 * const grouped = groupExtraArtists([{name: "Artist Name", role: "Producer"}, {name: "Artist Name", role: "Mixer"}]);
 * // [{name: "Artist Name", role: "Producer, Mixer"}]
 * ```
 */
export function groupExtraArtists(artists: ArtistCredit[]): ArtistCredit[] {
  if (!Array.isArray(artists) || !artists.length) {
    return [];
  }

  // Use a map to track casing: normalizedName -> originalCasing
  const nameKeys = new Map<string, string>();
  const roleGroups = new Map<string, Set<string>>();

  artists.forEach((artist) => {
    if (!artist.name || !artist.role) {
      return;
    }

    const trimmedName = artist.name.trim();
    const normalizedName = trimmedName.toLowerCase();

    // Preserve the first encountered casing
    if (!nameKeys.has(normalizedName)) {
      nameKeys.set(normalizedName, trimmedName);
      roleGroups.set(normalizedName, new Set());
    }

    roleGroups.get(normalizedName)!.add(artist.role.trim());
  });

  return Array.from(nameKeys.entries()).map(([key, name]) => {
    const roles = Array.from(roleGroups.get(key)!).sort((roleA, roleB) => roleA.localeCompare(roleB));

    return {
      name,
      role: roles.join(', '),
    };
  });
}

/**
 * Cleans titles (tracks or albums), standardizes casing, and extracts side-effect artist credits.
 *
 * @param rawTitle - The original title string.
 * @param extraArtists - Array to collect associated credits (e.g. remixers).
 * @returns Cleaned and formatted title.
 *
 * @example
 * ```typescript
 * const title = normalizeTitle('Track Title (Remix by Artist Name)', []);
 * ```
 */
export function normalizeTitle(rawTitle: string | null | undefined, extraArtists: ArtistCredit[] | null = null): string {
  if (!rawTitle) {
    return '';
  }

  let title = capitalizeString(rawTitle);

  REMOVE_FROM_TITLE.forEach((pattern) => {
    title = title.replace(pattern, '').trim();
  });

  if (extraArtists) {
    title = extractExtraArtists(title, extraArtists, ['Remix']);
  }

  // Add space before brackets
  title = title.replace(/(\S)([[(])/g, '$1 $2');

  return cleanString(title) || '';
}

/**
 * Attempts to split a single string (often a track title) into separate artist and title components.
 *
 * @param rawTitle - The composite string containing artist and title (e.g. "Artist - Title").
 * @param defaultArtists - Fallback artist list if splitting fails.
 * @param extraArtists - Array to accumulate parsed credits.
 * @returns An object containing the extracted `artists` and track `title`.
 *
 * @example
 * ```typescript
 * const split = splitArtistTitle('Artist Name - Track Title', [], []);
 * ```
 */
export function splitArtistTitle(rawTitle: string | null | undefined, defaultArtists: ArtistCredit[], extraArtists: ArtistCredit[]) {
  let cleanTitleForSplit = rawTitle || '';

  REMOVE_FROM_TITLE.forEach((pattern) => {
    cleanTitleForSplit = cleanTitleForSplit.replace(pattern, '').trim();
  });

  // Try to split by em dash, en dash, or hyphen
  const splitMatch = cleanTitleForSplit.match(/^(\S(?:.*?\S)?)\s+[-\u2013\u2014]\s*(\S.*)$/) || cleanTitleForSplit.match(/^(\S(?:.*?\S)?)[-\u2013\u2014]\s+(\S.*)$/);

  if (splitMatch) {
    const artistPart = splitMatch[1].trim();
    const titlePart = splitMatch[2].trim();
    const technicalParts = /^(?:intro|outro|skit|reprise|interlude)$/i;

    // Heuristic: Intro/Outro/etc are usually not artists or titles in this context (splitting hyphen)
    if (!technicalParts.test(artistPart) && !technicalParts.test(titlePart)) {
      return {
        artists: normalizeArtists(artistPart, extraArtists),
        title: normalizeTitle(titlePart, extraArtists),
        bpm: extractBpm(rawTitle),
      };
    }
  }

  return {
    artists: defaultArtists,
    title: normalizeTitle(rawTitle || '', extraArtists),
    bpm: extractBpm(rawTitle),
  };
}
