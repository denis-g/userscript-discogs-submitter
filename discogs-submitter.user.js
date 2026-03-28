// ==UserScript==
// @name         Discogs Submitter
// @version      2.0.10
// @description  Parse release data from Bandcamp, Qobuz, Juno Download, Beatport, 7digital and submit releases to Discogs.
// @license      MIT
// @namespace    discogs-submitter
// @iconURL      https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/assets/icon.svg
// @updateURL    https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/discogs-submitter.user.js
// @downloadURL  https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/discogs-submitter.user.js
// @author       Denis G. <https://github.com/denis-g>
// @homepage     https://github.com/denis-g/userscript-discogs-submitter#readme
// @homepageURL  https://github.com/denis-g/userscript-discogs-submitter#readme
// @supportURL   https://github.com/denis-g/userscript-discogs-submitter/issues
// @match        https://*.bandcamp.com/album/*
// @match        https://web.archive.org/web/*/*://*.bandcamp.com/album/*
// @match        https://*.qobuz.com/*/album/*
// @match        https://*.junodownload.com/products/*
// @match        https://*.beatport.com/*
// @match        https://*.7digital.com/artist/*/release/*
// @connect      discogs.com
// @connect      bandcamp.com
// @connect      bcbits.com
// @connect      qobuz.com
// @connect      static.qobuz.com
// @connect      junodownload.com
// @connect      imagescdn.junodownload.com
// @connect      beatport.com
// @connect      api.beatport.com
// @connect      geo-media.beatport.com
// @connect      7digital.com
// @connect      api.7digital.com
// @connect      artwork-cdn.7static.com
// @run-at       document-end
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_openInTab
// @grant        GM_getResourceText
// @grant        unsafeWindow
// @resource     DS_ICON https://github.com/denis-g/userscript-discogs-submitter/raw/refs/heads/master/assets/icon.svg
// ==/UserScript==

(async () => {
  /**
   * Internal helpers for configuration and parsing.
   */
  const Helper = {
    isWebArchive: () => {
      return location.href.includes('https://web.archive.org/web/');
    },

    /**
     * Shared templates for artist credits to prevent duplication.
     * @type {string[]}
     */
    GLOBAL_CREDIT_REGEX: [
      // Bracketed: (Credit Artist), (Credit By Artist), [Credit: Artist]
      '(?:\\(|\\[)\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*(.+?)(?:\\)|\\])',
      // Inline with "by" keyword: "Credit and Role by Artist", "Role and Credit by Artist"
      '(?:\\s+|^)(?:\\w+\\s+(?:and|&)\\s+)?{{p}}(?:\\s+(?:and|&)\\s+\\w+)?\\s+by\\b\\s*[:\\s-]*(.+?)(?=\\s*(?:\\/|;|[A-Z][a-z]+:|,|$))',
      // Inline with colon or dash: "Credit: Artist", "Credit - Artist"
      '(?:\\s+|^)(?:\\w+\\s+(?:and|&)\\s+)?{{p}}(?:\\s+(?:and|&)\\s+\\w+)?\\b\\s*[:-]\\s*(.+?)(?=\\s*(?:\\/|;|[A-Z][a-z]+:|,|$))',
      // Inline with optional words before "by": "Mastering Work by Artist"
      '(?:\\s+|^){{p}}(?:\\s+\\w+)*\\s+by\\b\\s*[:\\s-]*(.+?)(?=\\s*(?:\\/|;|,|$))',
    ],

    /**
     * Dynamically generates regex objects for artist credits or string cleaning.
     * Replaces the {{p}} placeholder in templates with the provided phrases.
     * Automatically handles space normalization (escaping spaces as \s+).
     * Strips the \\b word boundary after {{p}} when the phrase ends with a non-word character
     * (e.g., 'f/', 'producer:') to avoid invalid regex assertions.
     * @param {string[]} phrases - List of phrases (e.g. ['remix', 'rmx']).
     * @param {string[]} templates - Regex template strings using '{{p}}' for phrase injection.
     * @returns {RegExp[]} Array of compiled case-insensitive regular expressions.
     */
    buildCreditRegexes: (phrases, templates) =>
      phrases.flatMap((phrase) => {
        const p = phrase.replace(/\s+/g, '\\s+');

        return templates.map((t) => {
          let finalTemplate = t;

          if (!/\w$/.test(phrase)) {
            finalTemplate = finalTemplate.replace(/\{\{p\}\}\\b/g, '{{p}}');
          }

          return new RegExp(finalTemplate.replace(/\{\{p\}\}/g, p), 'gi');
        });
      }),

    ignoreCapitalizationMap: new Map(),
    escapedJoiners: [],
    joinerPattern: null,
    oxfordPattern: null,
  };

  /**
   * Global patterns for artist joiners, various artists, and artist credits.
   */
  const PATTERNS = {
    joiners: [',', '/', '|', 'And', '&', 'X', '×', 'With', 'w/', 'Vs', 'Vs.', 'Versus', 'Present', 'Aka'],
    variousArtists: Helper.buildCreditRegexes(
      // normalize various artists to "Various"
      ['VA', 'V A', 'V\\/A', 'Various', 'Various Artists', 'Varios', 'Varios Artistas', 'Různí', 'Různí interpreti'],
      ['^{{p}}$'],
    ),
    removeFromArtistName: [],
    removeFromTitleName: Helper.buildCreditRegexes(
      ['original mix', 'original', 'remaster', 'remastered', 'explicit', 'digital bonus track', 'digital bonus', 'bonus track', 'bonus', '24bit', '24 bit', '16bit', '16 bit'],
      // "(Pattern)", "[Pattern]", "- Pattern"
      ['\\(\\s*{{p}}\\s*\\)', '\\[\\s*{{p}}\\s*\\]', '-\\s*{{p}}\\b'],
    ),
    artistCredit: {
      'Featuring': Helper.buildCreditRegexes(
        ['featuring', 'feat', 'ft', 'f/'],
        [
          // Bracketed: "(feat. Artist)", "[ft Artist]"
          '(?:\\(|\\[)\\s*{{p}}\\b\\.?\\s*(.*?)(?:\\)|\\])',
          // Inline: "feat. Artist"
          '(?:\\s+|^){{p}}\\b\\.?\\s*(.+?)(?=\\s+\\b(?:feat|ft|prod|remix|vs|with|and|&)\\b|\\s*[\\[\\(]|$)',
        ],
      ),
      'Remix': Helper.buildCreditRegexes(
        ['remix', 'rmx', 'remixed', 'mix', 'mixed', 're-mix', 're-mixed', 'version', 'edit', 'edited', 're-edit', 're-edited', 'rework', 'reworked', 'rebuild', 'rebuilt'],
        [
          // Bracketed: "(Remix By Artist)", "(Artist Remix)"
          '(?:\\(|\\[)\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*(.+?)(?:\\)|\\])',
          // Inline with dash prefix: "- Remix By Artist"
          '(?:\\s+|^)-\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*(.+?)(?=\\s*[\\[\\(]|$)',
        ],
      ),
      'DJ Mix': Helper.buildCreditRegexes(
        ['dj mix', 'dj-mix'],
        // default
        Helper.GLOBAL_CREDIT_REGEX,
      ),
      'Compiled By': Helper.buildCreditRegexes(
        ['compiled'],
        // default
        Helper.GLOBAL_CREDIT_REGEX,
      ),
      'Artwork': Helper.buildCreditRegexes(
        ['artwork', 'art work', 'art'],
        // default
        Helper.GLOBAL_CREDIT_REGEX,
      ),
      'Producer': Helper.buildCreditRegexes(
        ['produced', 'producer'],
        // default
        Helper.GLOBAL_CREDIT_REGEX,
      ),
      'Written-By': Helper.buildCreditRegexes(
        ['written', 'written-by', 'writing'],
        // default
        Helper.GLOBAL_CREDIT_REGEX,
      ),
      'Written-By, Producer': Helper.buildCreditRegexes(
        ['w&p'],
        // default
        Helper.GLOBAL_CREDIT_REGEX,
      ),
      'Mastered By': Helper.buildCreditRegexes(
        ['mastered', 'mastering', 'master'],
        // default
        Helper.GLOBAL_CREDIT_REGEX,
      ),
    },
    ignoreCapitalization: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'AM', 'PM', 'AI', 'DJ', 'MC', 'EP', 'CD', 'DVD', 'HD', 'LP', 'DAT', 'NASA', 'FM', 'VHS', 'VIP', 'UK', 'USA', 'USSR', 'UFO', 'WTF', 'WWII', 'WWIII', 'LSD', 'TNT'],
  };

  /**
   * Initializes pre-calculated performance structures after PATTERNS is defined.
   */
  Helper.init = () => {
    PATTERNS.ignoreCapitalization.forEach((ex) => {
      Helper.ignoreCapitalizationMap.set(ex.replace(/\./g, '').toUpperCase(), ex);
    });

    Helper.escapedJoiners = PATTERNS.joiners.map(j => j.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    const strongJoiners = Helper.escapedJoiners.filter(j => j.toLowerCase() !== 'x');
    const xJoiner = Helper.escapedJoiners.find(j => j.toLowerCase() === 'x');
    const strongPattern = `(?:\\s+(?:${strongJoiners.join('|')})(?=\\s+)|\\s*,\\s*)`;

    if (xJoiner) {
      // Standalone X is a joiner ONLY if not immediately followed by another "strong" joiner (to avoid cases like "Adam X and ...")
      const xPattern = `\\s+${xJoiner}(?=\\s+(?!${strongJoiners.join('|')}|,))`;

      Helper.joinerPattern = new RegExp(`((?:${strongPattern})+|${xPattern})`, 'i');
    }
    else {
      Helper.joinerPattern = new RegExp(`((?:${strongPattern})+)`, 'i');
    }

    const nonCommaJoiners = Helper.escapedJoiners.filter(j => j !== ',');

    Helper.oxfordPattern = nonCommaJoiners.length > 0 ? new RegExp(`,\\s*(${nonCommaJoiners.join('|')})(?:\\s+|$)`, 'gi') : null;
  };

  /**
   * General utility functions for parsing, formatting, and making requests.
   */
  const Utils = {
    /**
     * Converts glob-style URL patterns (using * as wildcard) into RegExp testers.
     * Regexes are compiled once at definition time, not on every call.
     * @param {...string} patterns - URL patterns using * as wildcard (e.g. 'https://*.example.com/album/*').
     * @returns {(url: string) => boolean} Function that returns true if the URL matches strictly from the start.
     */
    matchUrls: (...patterns) => {
      const regexes = patterns.map(p =>
        new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`, 'i'),
      );

      return url => regexes.some(re => re.test(url));
    },

    /**
     * Trims, collapses multiple spaces/newlines/tabs into a single space,
     * and replaces &nbsp; entities. Returns null if the result is an empty string.
     * Non-string values are returned as-is.
     * @param {*} str - The value to clean.
     * @param {boolean} collapseWhitespace - Whether to collapse multiple spaces/newlines into one.
     * @returns {string|null|*} Cleaned string, null if empty, or the original value if not a string.
     */
    cleanString: (str, collapseWhitespace = true) => {
      if (typeof str !== 'string') {
        return str;
      }

      let cleaned = str.replace(/&nbsp;/gi, ' ');

      if (collapseWhitespace) {
        cleaned = cleaned.replace(/\s+/g, ' ');
      }

      return cleaned.trim() || null;
    },

    /**
     * Normalizes duration strings/numbers.
     * @param {string|number} rawDuration - Raw duration value.
     * @returns {string|null} Normalized duration or null if invalid.
     */
    normalizeDuration: (rawDuration) => {
      if (!rawDuration) {
        return null;
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
          timeParts.unshift(hours);
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

      return trimmed;
    },

    /**
     * Normalizes release dates into YYYY-MM-DD or YYYY format.
     * @param {string} date - Raw date string.
     * @returns {string|null} Normalized date (ISO-like) or raw input.
     */
    normalizeReleaseDate: (date) => {
      if (!date) {
        return null;
      }

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // 05 Aug 2024 or Aug 2024 - Bandcamp
      const gmtMatch = date.match(/(?:(\d{1,2})\s+)?([a-z]{3,})\s+(\d{4})/i);

      if (gmtMatch) {
        const day = gmtMatch[1] ? String(gmtMatch[1]).padStart(2, '0') : '00';
        const monthStr = gmtMatch[2].substring(0, 3).toLowerCase();
        const monthIndex = months.findIndex(m => m.toLowerCase() === monthStr);
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
        const monthIndex = months.findIndex(m => m.toLowerCase() === monthStr);
        const year = dateMatch[3];

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
    },

    /**
     * Extracts text or attribute value from a DOM element safely.
     * @param {string} target - CSS selector.
     * @param {HTMLElement|Document|null} [parent] - Context within which to search.
     * @param {string} [attribute] - Attribute to retrieve instead of inner text.
     * @param {boolean} [keepNewlines] - Whether to preserve newlines in the output.
     * @returns {string|null} Extracted text/value.
     */
    getTextFromTag: (target, parent = null, attribute = '', keepNewlines = false) => {
      const context = parent || document;
      const result = context.querySelector(target);

      if (!result) {
        return null;
      }

      if (attribute) {
        return Utils.cleanString(result.getAttribute(attribute));
      }

      if (keepNewlines) {
        const clone = result.cloneNode(true);

        // Replace <br> tags with \n
        clone.querySelectorAll('br').forEach((br) => {
          br.replaceWith('\n');
        });

        return Utils.cleanString(clone.textContent, false);
      }

      return Utils.cleanString(result.textContent);
    },

    /**
     * Parses a string of artists separated by joiners.
     * @param {string} artistString - The raw string of artists.
     * @param {Array<{name: string, role: string}>} [extraArtists] - Collector for any credits found during internal normalization.
     * @returns {Array<{name: string, join: string}>} List of artist objects with name and trailing joiner.
     */
    parseArtists: (artistString, extraArtists = null) => {
      if (!artistString) {
        return [];
      }

      if (Helper.oxfordPattern) {
        artistString = artistString.replace(Helper.oxfordPattern, ' $1 ');
      }

      const parts = artistString.split(Helper.joinerPattern);
      const artists = [];

      for (let i = 0; i < parts.length; i += 2) {
        const rawName = parts[i].trim();
        const join = parts[i + 1] || null;

        if (rawName) {
          // Use normalizeArtists to clean the name, but keep our join property
          // We pass isSubcall=true to avoid recursive splitting
          const normalized = Utils.normalizeArtists(rawName, extraArtists, true);

          if (normalized.length > 0) {
            const artist = { ...normalized[0] };

            if (join) {
              const originalJoin = PATTERNS.joiners.find(j => j.toLowerCase() === join.trim().toLowerCase());

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
    },

    /**
     * Normalizes and standardizes the release-level artist list.
     * Implements "Compiled By" elevation (promoting compilers to main artists for VA releases),
     * various artists detection, and fallback to "Various" for releases with > 5 artists.
     * @param {string|string[]} rawArtists - Raw artist(s) name(s) from the source page.
     * @param {Array<{name: string, role: string}>} [extraArtists] - Accumulated credits.
     * @returns {Array<{name: string, join: string}>} Normalized list of release artists.
     */
    normalizeMainArtists: (rawArtists, extraArtists = null) => {
      const normalized = Utils.normalizeArtists(rawArtists, extraArtists);
      const vaPatterns = PATTERNS.variousArtists;

      // If "Compiled By" is in extraArtists, use it as main artist
      if (Array.isArray(extraArtists)) {
        const compilers = extraArtists.filter(a => a.role === 'Compiled By');

        if (compilers.length > 0) {
          // Deduplicate compilers case-insensitively and handle overlapping names
          const uniqueCompilers = [];

          compilers.forEach((c) => {
            const currentName = c.name.toLowerCase();
            const existingIndex = uniqueCompilers.findIndex((u) => {
              const uName = u.name.toLowerCase();

              return uName.includes(currentName) || currentName.includes(uName);
            });

            if (existingIndex === -1) {
              uniqueCompilers.push(c);
            }
            else if (currentName.length > uniqueCompilers[existingIndex].name.toLowerCase().length) {
              // Keep the longer (usually more descriptive) name
              uniqueCompilers[existingIndex] = c;
            }
          });

          return uniqueCompilers.map(c => ({ name: c.name, join: ',' }));
        }
      }

      if (normalized.length > 5) {
        return [{ name: 'Various', join: ',' }];
      }

      if (Array.isArray(vaPatterns) && vaPatterns.length > 0) {
        const isVA = normalized.some(a => vaPatterns.some(pattern => pattern.test(a.name)));

        if (isVA) {
          return [{ name: 'Various', join: ',' }];
        }
      }

      return normalized;
    },

    /**
     * Standardizes casing to Title Case, cleans whitespace, and handles abbreviations.
     * @param {string} str - The string to capitalize.
     * @returns {string} The capitalized string.
     */
    capitalizeString: (str) => {
      if (!str) {
        return '';
      }

      let cleaned = String(str).trim();

      // Standardizes apostrophes and accents
      // (’, `, ´ -> ')
      cleaned = cleaned.replace(/[’`´]/g, '\'');

      // Cleans whitespace inside parentheses
      // "( text )" -> "(text)"
      cleaned = cleaned.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

      // Standardize casing to Title Case
      return cleaned
        .split(/(\s+|(?=\/)|(?<=\/))/)
        .map((word) => {
          if (!word || /\s+/.test(word) || word === '/') {
            return word;
          }

          // Find the alphanumeric core (including Unicode letters/numbers) to check against exceptions and capitalize
          // Prefix and suffix are non-alphanumeric. Core is alphanumeric potentially with internal punctuation.
          const match = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}](?:.*?[\p{L}\p{N}])?)([^\p{L}\p{N}]*)$/iu);

          if (!match) {
            return word;
          }

          const prefix = match[1];
          const core = match[2];
          const suffix = match[3];

          // preserve dotted abbreviations like "A.I." or "U.S.A." (all uppercase)
          if (/^[A-Z](?:\.[A-Z])+\.?$/i.test(core + suffix)) {
            return prefix + (core + suffix).toUpperCase();
          }

          const upperCore = core.toUpperCase();
          const upperCoreNoDots = upperCore.replace(/\./g, '');
          const exception = Helper.ignoreCapitalizationMap.get(upperCoreNoDots);

          if (exception) {
            return prefix + exception + suffix;
          }

          // Preserve stylistic mixed casing (e.g., "Sci-Fi", "iPhone")
          const hasUppercaseAfterFirst = /[^\p{L}\p{N}]*[\p{L}\p{N}].*\p{Lu}/u.test(core);
          const hasLowercase = /\p{Ll}/u.test(core);

          if (hasUppercaseAfterFirst && hasLowercase) {
            return prefix + core + suffix;
          }

          if (core.length > 0) {
            const capitalizedCore = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();

            return prefix + capitalizedCore + suffix;
          }

          return word;
        })
        .join('');
    },

    /**
     * Merges multiple credits for the same artist into a single entry with combined roles.
     * @param {Array<{name: string, role: string}>} artists - List of artist credits.
     * @returns {Array<{name: string, role: string}>} Grouped artist credits.
     */
    groupExtraArtists: (artists) => {
      if (!Array.isArray(artists) || !artists.length) {
        return [];
      }

      const grouped = new Map();

      artists.forEach((a) => {
        if (!a.name || !a.role) {
          return;
        }

        const name = a.name.trim();

        if (!grouped.has(name)) {
          grouped.set(name, new Set());
        }

        grouped.get(name).add(a.role.trim());
      });

      return Array.from(grouped.entries())
        .map(([name, roles]) => (
          { name, role: Array.from(roles).join(', ') }
        ));
    },

    /**
     * Heuristic check: whether the captured string is a credit or ordinary text (prose).
     * @param {string} text - Captured string.
     * @returns {boolean} True if it is a valid credit, False if it is a sentence.
     */
    isValidCreditPhrase: (text) => {
      if (!text || text.length > 150) {
        return false;
      }

      // Filter promo words: if "name" contains these words,
      const promoBlacklist = /\b(?:tracks?|music|album|exclusive|material|songs?|ep|lp|release|available|digital|vinyl|download|stream|out\s+now|listen|debut|compilation|collection)\b/i;

      if (promoBlacklist.test(text)) {
        return false;
      }

      // Split the string into blocks by known artist separators (, & and)
      const blocks = text.split(Helper.joinerPattern).filter(Boolean);

      // Hard word limit: if at least one "artist" contains more than 5 words, it's prose
      const hasLongSentence = blocks.some((block) => {
        // Remove punctuation for honest word counting
        const cleanBlock = block.trim().replace(/[.,;!"'()[\]{}<>:]/g, '');

        return cleanBlock.split(/\s+/).filter(Boolean).length > 5;
      });

      return !hasLongSentence;
    },

    /**
     * Extracts additional credits from a string, mutates the extraArtists array, and returns a cleaned string.
     * @param {string} text - The original string to parse (artist name or track title).
     * @param {Array<{name: string, role: string}>} [extraArtists] - Array to collect credits.
     * @param {string[]} [preserveRoles] - Array of roles whose text should be preserved in the string.
     * @returns {string} The cleaned string.
     */
    extractExtraArtists: (text, extraArtists, preserveRoles = []) => {
      if (!text || !Array.isArray(extraArtists)) {
        return text || '';
      }

      let processedText = text;

      Object.entries(PATTERNS.artistCredit).forEach(([role, patterns]) => {
        patterns.forEach((pattern) => {
          processedText = processedText.replace(pattern, (fullMatch, p1) => {
            if (typeof p1 === 'string') {
              // Initial cleaning of trailing punctuation
              let cleanCapture = p1.replace(/[.,;\s]+$/, '').trim();

              // Intelligent trimming of captured adjacent sentences
              const chunks = cleanCapture.split(/\.\s+/);

              if (chunks.length > 1) {
                let validName = chunks[0];

                for (let i = 1; i < chunks.length; i++) {
                  const prevChunk = chunks[i - 1];
                  const nextChunk = chunks[i];
                  const lastWord = prevChunk.split(/\s+/).pop().toLowerCase();

                  if (lastWord.length === 1 || ['mr', 'mrs', 'dr', 'st', 'vs', 'feat', 'ft', 'prof', 'bros', 'inc', 'ltd', 'vol'].includes(lastWord)) {
                    validName += `.  ${nextChunk}`;
                  }
                  else {
                    break;
                  }
                }
                cleanCapture = validName;
              }

              if (Utils.isValidCreditPhrase(cleanCapture)) {
                const items = Utils.parseArtists(cleanCapture, extraArtists);

                items.forEach((it) => {
                  if (it.name && !extraArtists.some(ex => ex.name === it.name && ex.role === role)) {
                    extraArtists.push({ name: it.name, role });
                  }
                });

                return preserveRoles.includes(role) ? fullMatch : '';
              }

              return fullMatch;
            }

            return '';
          });
        });
      });

      return processedText.replace(/\s{2,}/g, ' ').trim();
    },

    /**
     * Attempts to split a single string (often a track title) into artist and title components.
     * Specifically designed for stores like Bandcamp where artists and titles are frequently combined.
     * @param {string} rawTitle - The potentially combined string to split.
     * @param {Array<{name: string, join: string}>} defaultArtists - Fallback artist list if no split is found.
     * @param {Array<{name: string, role: string}>} extraArtists - Collector for extra artist credits (e.g., "featuring") found during splitting.
     * @returns {{artists: Array<{name: string, join: string}>, title: string}} Object containing the parsed artist list and normalized track title.
     */
    splitArtistTitle: (rawTitle, defaultArtists, extraArtists) => {
      let cleanTitleForSplit = rawTitle || '';

      // Pre-clean technical suffixes that might interfere with splitting
      PATTERNS.removeFromTitleName.forEach((pattern) => {
        cleanTitleForSplit = cleanTitleForSplit.replace(pattern, '').trim();
      });

      // Split by common delimiters (hyphen, en-dash, em-dash) followed by a space
      // supported formats: "Artist - Title", "Artist- Title"
      const splitMatch = cleanTitleForSplit.match(/^(\S(?:.*?\S)?)\s+[-\u2013\u2014]\s*(\S.*)$/)
        || cleanTitleForSplit.match(/^(\S(?:.*?\S)?)[-\u2013\u2014]\s+(\S.*)$/);

      if (splitMatch) {
        const artistPart = splitMatch[1];
        const titlePart = splitMatch[2];

        // If split exists, normalize both parts
        return {
          artists: Utils.normalizeArtists(artistPart, extraArtists),
          title: Utils.normalizeTrackTitle(titlePart, extraArtists),
        };
      }

      // If no split is found, return default artists and the normalized original title
      return {
        artists: defaultArtists,
        title: Utils.normalizeTrackTitle(rawTitle, extraArtists),
      };
    },

    /**
     * Cleans and standardizes artist names while extracting extra credits.
     * Handles splitting by joiners (e.g., ",", "&", "feat") recursively.
     * @param {string|string[]} artists - Artist name(s) to normalize.
     * @param {Array<{name: string, role: string}>} [extraArtists] - Collector for credits (e.g., Remixers, Features) found inside the artist string.
     * @param {boolean} [isSubcall] - Internal flag to prevent infinite recursion during recursive splitting.
     * @returns {Array<{name: string, join: string}>} List of cleaned artist objects with their respective joiners.
     */
    normalizeArtists: (artists, extraArtists = null, isSubcall = false) => {
      if (!artists) {
        return [{ name: '', join: ',' }];
      }

      if (Array.isArray(artists) && !isSubcall) {
        artists = artists.filter(Boolean).join(', ');
      }

      if (typeof artists === 'string' && !isSubcall) {
        return Utils.parseArtists(artists, extraArtists);
      }

      const artistList = Array.isArray(artists) ? artists : [artists];
      const normalized = artistList
        .map((raw) => {
          if (!raw) {
            return null;
          }

          let cleaned = Utils.cleanString(raw);

          cleaned = Utils.extractExtraArtists(cleaned, extraArtists);

          const patternsToRemove = PATTERNS.removeFromArtistName;

          if (Array.isArray(patternsToRemove)) {
            patternsToRemove.forEach((pattern) => {
              cleaned = cleaned.replace(pattern, '').trim();
            });
          }

          return Utils.capitalizeString(cleaned);
        })
        .filter(Boolean);

      if (normalized.length === 0) {
        return [{ name: 'Unknown Artist', join: ',' }];
      }

      return normalized.map(name => ({ name, join: ',' }));
    },

    /**
     * Cleans track titles, standardizes casing, and extracts artist credits.
     * @param {string} rawTitle - The original track title.
     * @param {Array<{name: string, role: string}>} [extraArtists] - Collector for credits found inside the title.
     * @returns {string} The cleaned track title.
     */
    normalizeTrackTitle: (rawTitle, extraArtists = null) => {
      if (!rawTitle) {
        return '';
      }

      let title = Utils.capitalizeString(rawTitle);

      // Preserve Remix in the track title
      title = Utils.extractExtraArtists(title, extraArtists, ['Remix']);

      PATTERNS.removeFromTitleName.forEach((pattern) => {
        title = title.replace(pattern, '').trim();
      });

      // Add space before brackets
      title = title.replace(/(\S)([[(])/g, '$1 $2');

      return Utils.cleanString(title);
    },

    /**
     * Helper to perform cross-origin requests using GM_xmlhttpRequest via a Promise.
     * @param {object} options - Standard GM_xmlhttpRequest options.
     * @param {number} [retries] - Number of times to retry the request on failure/timeout.
     * @param {number} [timeout] - Request timeout in milliseconds.
     * @returns {Promise<string|Blob>} Resolves with responseText or response Blob on success.
     */
    networkRequest: (options, retries = 2, timeout = 15000) => {
      const attempt = currentTry =>
        new Promise((resolve, reject) => {
          const config = {
            method: 'GET',
            timeout,
            responseType: 'text',
            ...options,
          };

          GM_xmlhttpRequest({
            ...config,
            onload: (response) => {
              if (response.status >= 200 && response.status < 300) {
                resolve(config.responseType === 'text' ? response.responseText : response.response);
              }
              else {
                reject(new Error(`HTTP Error: ${response.status} ${response.statusText || ''}`.trim()));
              }
            },
            onerror: (response) => {
              reject(new Error(`Network Error: ${response.status} ${response.statusText || ''}`.trim() || 'Connection failed'));
            },
            ontimeout: () => reject(new Error('Request timed out')),
          });
        }).catch((error) => {
          if (currentTry < retries) {
            console.warn(`[Discogs Submitter] Request failed (${error.message}). Retrying... (${currentTry + 1}/${retries})`);

            return attempt(currentTry + 1);
          }

          throw error;
        });

      return attempt(0);
    },
  };

  Helper.init();

  /**
   * Adapter for transforming parsed digital store data into Discogs API payload.
   */
  const DiscogsAdapter = {
    /**
     * Builds the Discogs release payload from parsed store data.
     * @param {object} data - Parsed data from the digital store.
     * @param {string} sourceUrl - The original URL the data was parsed from.
     * @param {object} [options] - Optional format configuration.
     * @param {string} [options.format] - Selected download format.
     * @param {boolean} [options.isHdAudio] - Whether the release is HD audio.
     * @returns {object} Payload with _previewObject, full_data (JSON), and sub_notes.
     */
    buildPayload: (data, sourceUrl, options) => {
      const { format = 'WAV', isHdAudio = false } = options || {};

      const releaseArtistsArr = data.artists || [];
      const tracks = data.tracks || [];

      // Determine if all tracks have the same artist list
      const firstTrackArtists = tracks[0]?.artists || [];
      const allTracksShareSameArtists
        = tracks.length > 0
          && tracks.every((track) => {
            const trackArtists = track.artists || [];

            if (trackArtists.length !== firstTrackArtists.length) {
              return false;
            }

            return trackArtists.every((a, i) => a.name === firstTrackArtists[i].name && a.join === firstTrackArtists[i].join);
          });

      // If all tracks match, we elevate the common track artist to the release level.
      // This ensures that if the artist is the same for all tracks, it's moved to the release level
      // and cleared from individual tracks in the final payload.
      let finalReleaseArtists = releaseArtistsArr;

      if (allTracksShareSameArtists && firstTrackArtists.length > 0) {
        finalReleaseArtists = firstTrackArtists;
      }

      const primaryArtistName = (finalReleaseArtists[0]?.name || '').trim();

      // Check if the final release artists match the track artists (for deduplication)
      const allTracksMatchRelease
        = tracks.length > 0
          && tracks.every((track) => {
            const trackArtists = track.artists || [];

            if (trackArtists.length !== finalReleaseArtists.length) {
              return false;
            }

            const tNames = trackArtists.map(a => (a.name || '').trim().toLowerCase()).sort();
            const rNames = finalReleaseArtists.map(a => (a.name || '').trim().toLowerCase()).sort();

            return JSON.stringify(tNames) === JSON.stringify(rNames);
          });

      const labelName = data.label && primaryArtistName && data.label === primaryArtistName
        ? `Not On Label (${primaryArtistName} Self-released)`
        : data.label || 'Not On Label';
      let formatText = '';

      if (format === 'MP3') {
        formatText = '320 kbps';
      }
      else if (isHdAudio) {
        formatText = '24-bit';
      }

      const totalTracks = data.tracks?.length ? `${data.tracks.length}` : '1';
      const validBpmTracks = (data.tracks || []).filter(track => track.bpm);
      const infoBpm = validBpmTracks.length > 0 ? `BPM's:\n${validBpmTracks.map(track => `${track.position}: ${track.bpm}`).join('\n')}` : '';

      const payload = {
        cover: data.cover || null,
        title: data.title || '',
        artists: finalReleaseArtists.length ? finalReleaseArtists : [{ name: '', join: ',' }],
        extraartists: Utils.groupExtraArtists(data.extraartists || []),
        country: data.country || '',
        released: data.released || '',
        labels: labelName ? [{ name: labelName, catno: data.number || 'none' }] : [],
        format: [{ name: 'File', qty: totalTracks, desc: [format], text: formatText }],
        tracks: (data.tracks || []).map(track => ({
          pos: track.position || '',
          artists: allTracksMatchRelease ? [] : track.artists || [],
          extraartists: Utils.groupExtraArtists(track.extraartists || []),
          title: track.title || '',
          duration: track.duration || '',
        })),
        notes: infoBpm,
      };

      return {
        _previewObject: payload,
        full_data: JSON.stringify(payload),
        sub_notes: `${sourceUrl}\n---\nA digital release in ${format} format has been added.`,
      };
    },
  };

  /**
   * Handles rendering of the release preview and other UI elements.
   */
  const Renderer = {
    /**
     * CSS styles for the widget and injected buttons.
     */
    globalCss: `
      /* --- VARIABLES --- */

      :root {
        --ds-gap: 20px;
        --ds-radius: 12px;
        --ds-color-white: #fafafa;
        --ds-color-black: #212121;
        --ds-color-gray: #666;
        --ds-color-gray-dark: #333;
        --ds-color-primary: #148a66;
        --ds-color-success: #28a745;
        --ds-color-error: #dc3545;
        --ds-color-warning: #ffc107;
        --ds-color-info: #17a2b8;
        --ds-font-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        --ds-font-monospace: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      }

      /* --- RESET --- */

      .discogs-submitter {
        *,
        *::after,
        *::before {
          color-scheme: light;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          box-sizing: border-box;
        }

        em {
          font-style: oblique;
        }

        strong {
          font-weight: bold;
        }

        [hidden] {
          display: none !important;
        }
      }

      /* --- WIDGET --- */

      .discogs-submitter {
        --ds-logo: url('');
        overflow: hidden;
        display: none;
        flex-direction: column;
        justify-content: start;
        gap: var(--ds-gap);
        position: fixed;
        z-index: 999999;
        top: var(--ds-gap);
        right: var(--ds-gap);
        width: calc(100% - (var(--ds-gap) * 2));
        max-width: 500px;
        padding: var(--ds-gap);
        color: var(--ds-color-black);
        font-family: var(--ds-font-sans) !important;
        font-size: 14px;
        font-weight: normal;
        line-height: 1.2;
        text-transform: none;
        text-shadow: none;
        background: var(--ds-color-white);
        border: 2px solid var(--ds-color-gray-dark);
        border-radius: var(--ds-radius);
        outline: 2px solid var(--ds-color-white);
        opacity: 0;
        transition:
          opacity 0.3s ease,
          box-shadow 0.6s ease;

        &.is-open {
          display: flex;
          opacity: 1;
          box-shadow:
            0 0 10px rgba(0, 0, 0, 0.6),
            0 0 30px rgba(0, 0, 0, 0.8);
        }

        &.is-webarchive {
          top: calc(var(--wm-toolbar-height) + var(--ds-gap));
        }
      }

      .discogs-submitter__loader {
        content: '';
        position: absolute;
        z-index: -1;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ds-color-white);
        opacity: 0;
        transition: opacity 0.8s ease;

        &.is-loading {
          z-index: 10;
          opacity: 0.75;
        }

        svg {
          width: 70px;
          height: 70px;
          animation: ds-spinner 0.5s linear infinite;
        }
      }

      .discogs-submitter__content {
        max-height: 60vh;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
      }

      .discogs-submitter__header {
        --icon-size: 24px;
        display: flex;
        align-items: center;
        gap: calc(var(--ds-gap) / 2);
        font-size: 20px;
        font-weight: 600;
      }

      .discogs-submitter__header__logo {
        flex: 0 0 auto;
        width: 1.25em;
        height: 1.25em;
      }

      .discogs-submitter__header__title {
        small {
          font-size: 8px;
        }
      }

      .discogs-submitter__header__drag-btn,
      .discogs-submitter__header__close-btn {
        width: var(--icon-size);
        height: var(--icon-size);
      }

      .discogs-submitter__header__drag-btn {
        margin-left: auto;
        display: flex;
        align-items: center;
        justify-content: space-evenly;
        flex-direction: column;
        cursor: grab;
      }

      .discogs-submitter__header__drag-btn {
        &::before,
        &::after {
          content: '';
          width: 6px;
          height: 6px;
          background-color: currentColor;
          border-radius: 100%;
          transition: background-color 0.3s ease;
        }

        &:hover::before,
        &:hover::after {
          background-color: var(--ds-color-info);
        }

        &.is-draggable {
          cursor: grabbing;
        }
      }

      .discogs-submitter__header__close-btn {
        position: relative;
        z-index: 1;
        cursor: pointer;

        &::before,
        &::after {
          position: absolute;
          z-index: 1;
          left: calc(var(--icon-size) / 2 - 1px);
          content: ' ';
          height: var(--icon-size);
          width: 3px;
          background-color: currentColor;
          transition: background-color 0.3s ease;
        }

        &::before {
          transform: rotate(45deg);
        }

        &::after {
          transform: rotate(-45deg);
        }

        &:hover::before,
        &:hover::after {
          background-color: var(--ds-color-error);
        }
      }

      .discogs-submitter__preview-container {
        overflow: auto;
        max-height: 330px;
        background:
          linear-gradient(var(--ds-color-white) 30%, rgba(0, 0, 0, 0)),
          linear-gradient(rgba(0, 0, 0, 0), var(--ds-color-white) 70%) 0 100%,
          radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)),
          radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)) 0 100%;
        background-repeat: no-repeat;
        background-size:
          100% 40px,
          100% 40px,
          100% 20px,
          100% 20px;
        background-attachment: local, local, scroll, scroll;
        scrollbar-width: thin;
        scrollbar-color: var(--ds-color-gray-dark) transparent;

        &::-webkit-scrollbar {
          width: 6px;
        }
      }

      .discogs-submitter__results {
        display: flex;
        flex-wrap: wrap;
        font-family: var(--ds-font-monospace);
        font-size: 10px;
        line-height: normal;
      }

      .discogs-submitter__results__row {
        width: 100%;
        display: grid;
        gap: calc(var(--ds-gap) / 4);
        grid-template-columns: 60px 1fr;
        padding: 2px 0;
        border-bottom: 1px dotted rgba(0, 0, 0, 0.2);

        &:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        &.is-half {
          width: 50%;
        }

        &.is-tracklist {
          grid-template-columns: 20px 1fr 1fr 50px;

          &.is-no-artist {
            grid-template-columns: 20px 1fr 50px;
          }

          .discogs-submitter__results__head {
            font-weight: bold;
          }

          > .discogs-submitter__results__body:last-child {
            text-align: right;
          }
        }

        &.is-notes {
          grid-template-columns: 1fr;
        }
      }

      .discogs-submitter__results__body {
        em {
          font-style: normal;
          padding: 2px 4px;
          display: inline-block;
          vertical-align: baseline;
          background: rgba(0, 0, 0, 0.05);
          border-radius: calc(var(--ds-radius) / 4);
        }

        small {
          font-size: 9px;
        }

        label {
          display: inline-flex;
          align-items: center;
          gap: calc(var(--ds-gap) / 4);
          vertical-align: middle;
          color: var(--ds-color-white);
          margin: 0;
          padding: 2px 5px;
          background: var(--ds-color-gray-dark);
          border-radius: calc(var(--ds-radius) / 2);
          cursor: pointer;
          transition: background 0.3s ease;
        }

        input[type='radio'],
        input[type='checkbox'] {
          position: absolute;
          z-index: -1;
          width: 1px;
          height: 1px;
          opacity: 0;
        }

        input[type='radio']:checked + label,
        input[type='checkbox']:checked + label {
          background: var(--ds-color-primary);
        }

        input[type='radio']:checked + label::before,
        input[type='checkbox']:checked + label::before {
          content: '';
          width: 8px;
          height: 5px;
          margin-top: -2px;
          border: solid currentColor;
          border-width: 0 0 2px 2px;
          transform: rotate(-45deg);
        }

        input[type="radio"]:disabled + label,
        input[type="checkbox"]:disabled + label {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .discogs-submitter__status-container {
        --status-color: var(--ds-color-gray-dark);
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: var(--ds-gap);
        margin-bottom: var(--ds-gap);
        padding: calc(var(--ds-gap) / 2);
        border-left: 4px solid var(--status-color);
        border-radius: calc(var(--ds-radius) / 2);
        transition: border-color 0.3s ease;

        &::after {
          content: '';
          position: absolute;
          z-index: -1;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: var(--status-color);
          opacity: 0.1;
          transition: background 0.3s ease;
        }

        &.is-success {
          --status-color: var(--ds-color-success);
        }

        &.is-error {
          --status-color: var(--ds-color-error);
        }

        &.is-info {
          --status-color: var(--ds-color-info);
        }

        &.is-warning {
          --status-color: var(--ds-color-warning);
        }
      }

      .discogs-submitter__status-debug-btn {
        font-size: 18px;
        cursor: pointer;
      }

      .discogs-submitter__actions {
        display: flex;
        flex-wrap: nowrap;
        gap: var(--ds-gap);
      }

      .discogs-submitter__actions__btn-submit {
        display: block;
        width: 100%;
        color: var(--ds-color-white);
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        padding: calc(var(--ds-gap) / 2) calc(var(--ds-gap) / 4);
        background: var(--ds-color-primary);
        border-radius: calc(var(--ds-radius) / 2);
        cursor: pointer;
        transition:
          background 0.3s ease,
          opacity 0.3s ease;
        user-select: none;

        &:hover {
          background: var(--ds-color-black);
        }

        &.is-disabled {
          opacity: 0.5;
          pointer-events: none;
        }
      }

      .discogs-submitter__copyright {
        display: flex;
        justify-content: center;
        gap: var(--ds-gap);
        font-size: 10px;
        margin: var(--ds-gap) 0 0;

        a {
          color: currentColor;
          text-decoration: none;

          &:hover {
            text-decoration: underline;
          }
        }

        span {
          display: inline-block;
          vertical-align: middle;
          font-family: var(--ds-font-monospace);
          color: var(--ds-color-error);
          animation: ds-pulse 1s ease-in-out infinite;
        }
      }

      @keyframes ds-spinner {
        0% {
          transform: rotate(0);
        }

        100% {
          transform: rotate(360deg);
        }
      }

      @keyframes ds-pulse {
        0% {
          transform: scale(1);
        }

        50% {
          transform: scale(1.2);
        }

        100% {
          transform: scale(1);
        }
      }

      /* --- INJECTED BUTTONS --- */

      .discogs-submitter__inject__btn {
        display: inline-flex;
        vertical-align: middle;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;
        user-select: none;

        &:hover {
          .discogs-submitter__inject__logo {
            animation: ds-spinner 1s linear infinite;
          }
        }

        &.is-disabled {
          opacity: 0.5;
          pointer-events: none;
        }

        &.is-bandcamp {
          margin-bottom: 1.5em;
          padding: 8px 5px;
          box-sizing: border-box;
        }

        &.is-qobuz {
          margin-top: 20px;
          text-transform: none;
        }

        &.is-qobuz {
          .discogs-submitter__inject__logo {
            margin-top: -4px;
          }
        }

        &.is-junodownload {
          margin-top: 20px;
        }

        &.is-beatport {
          margin-top: 8px;
        }
      }

      .discogs-submitter__inject__logo {
        display: block;
        width: 1.25em;
        height: 1.25em;
      }
    `,

    /**
     * HTML structure for the widget.
     */
    widgetHtml: `
      <div class="discogs-submitter__header">
        <svg class="discogs-submitter__header__logo" aria-hidden="true"><use href="#icon-logo"></use></svg>
        <span class="discogs-submitter__header__title">${GM_info.script.name} <small>v${GM_info.script.version}</small></span>
        <div class="discogs-submitter__header__drag-btn" title="Grab to move" role="button"></div>
        <div class="discogs-submitter__header__close-btn" title="Close widget" role="button"></div>
      </div>
      <div class="discogs-submitter__content">
        <div class="discogs-submitter__preview-container"></div>
      </div>
      <div class="discogs-submitter__footer">
        <div class="discogs-submitter__status-container">
          <div class="discogs-submitter__status-text">Waiting...</div>
          <div class="discogs-submitter__status-debug-btn" role="button" title="Copy debug" hidden>🐞</div>
        </div>
        <div class="discogs-submitter__actions">
          <div class="discogs-submitter__actions__btn-submit" role="button" hidden>Submit to Discogs</div>
        </div>
        <div class="discogs-submitter__copyright">
          <a href="${GM_info.script.homepage}" target="_blank">Homepage</a>
          <a href="${GM_info.script.supportURL}" target="_blank">Report Bug</a>
          <a href="https://buymeacoffee.com/denis_g" target="_blank">Made with <span>♥</span> for music</a>
        </div>
      </div>
      <div class="discogs-submitter__loader">
        <svg class="discogs-submitter__loader__logo" aria-hidden="true"><use href="#icon-logo"></use></svg>
      </div>
    `,

    /**
     * HTML for the store-injected button.
     */
    injectButtonHtml: `
      <div class="discogs-submitter__inject__btn" role="button">
        <svg class="discogs-submitter__inject__logo" aria-hidden="true"><use href="#icon-logo"></use></svg>
        <span>${GM_info.script.name}</span>
      </div>
    `,

    /**
     * Renders a styled HTML summary of the parsed release to preview in the widget.
     * @param {object} release - The cleaned, structured release object.
     * @param {object} options - Rendering options (selectedFormat, isHdAudio, supports).
     * @returns {string} Fully constructed HTML block.
     */
    releasePreview: (release, options) => {
      const { selectedFormat = '', isHdAudio = false } = options || {};
      const supports = options?.supports || { formats: [], hdAudio: true };
      const availableFormats = supports.formats || [];
      const supportsHdAudio = supports.hdAudio;

      const isHdAudioDisabled = selectedFormat === 'MP3' || !supportsHdAudio;
      const effectiveHdAudio = isHdAudioDisabled ? false : isHdAudio;

      const artists = release.artists?.length ? release.artists.map((a, i, arr) => `<em>${a.name}</em>${a.join && i < arr.length - 1 ? ` ${a.join} ` : ''}`).join('') : '⚠️';
      const extraArtists = release.extraartists?.length ? release.extraartists.map(a => `${a.role} – <em>${a.name}</em>`).join('<br />') : null;
      const title = release.title || '⚠️';
      const format = release.format?.length ? release.format.map(f => `${f.name}, Qty: ${f.qty}`).join(', ') : '⚠️';
      const label = release.labels[0]?.name || '⚠️';
      const number = release.labels[0]?.catno || '⚠️';
      const country = release.country || '–';
      const released = release.released || '⚠️';
      const notes = release.notes ? release.notes.replace(/\n/g, '<br />') : '–';

      const typeHtml = release.format?.some(f => f.name === 'File')
        ? `
        , Type:
          ${availableFormats.map(f => `
            <input type="radio" id="ds[format][${f.toLowerCase()}]" name="ds[format]" tabindex="-1" value="${f}" class="is-format" ${selectedFormat === f ? 'checked' : ''} />
            <label for="ds[format][${f.toLowerCase()}]">${f}</label>
          `).join('')}
        <input type="checkbox" id="ds[format][hdAudio]" tabindex="-1" class="is-hdaudio" ${effectiveHdAudio ? 'checked' : ''} ${isHdAudioDisabled ? 'disabled' : ''} />
        <label for="ds[format][hdAudio]">24-bit</label>
      `
        : '';

      const hasTrackArtists = (release.tracks || []).some(t => t.artists && t.artists.length > 0);
      const rowBaseClass = hasTrackArtists ? '' : 'is-no-artist';

      let tracksHtml = `
        <div class="discogs-submitter__results__row is-tracklist ${rowBaseClass}">
          <div class="discogs-submitter__results__head">#</div>
          ${hasTrackArtists ? '<div class="discogs-submitter__results__head">Artist</div>' : ''}
          <div class="discogs-submitter__results__head">Title</div>
          <div class="discogs-submitter__results__head">Duration</div>
        </div>
      `;

      if (release.tracks?.length) {
        release.tracks.forEach((track) => {
          const trackArtists = track.artists?.length ? track.artists.map((a, i, arr) => `<em>${a.name}</em>${a.join && i < arr.length - 1 ? ` ${a.join} ` : ''}`).join('') : '';
          const trackExtraArtists = track.extraartists?.length ? track.extraartists.map(a => `${a.role} – <em>${a.name}</em>`).join('<br />') : '';

          tracksHtml += `
            <div class="discogs-submitter__results__row is-tracklist ${rowBaseClass}">
              <div class="discogs-submitter__results__body">${track.pos || '⚠️'}</div>
              ${hasTrackArtists ? `<div class="discogs-submitter__results__body">${trackArtists}</div>` : ''}
              <div class="discogs-submitter__results__body">
                <div>${track.title || '⚠️'}</div>
                ${trackExtraArtists ? `<small>${trackExtraArtists}</small>` : ''}
              </div>
              <div class="discogs-submitter__results__body">${track.duration || '⚠️'}</div>
            </div>
          `;
        });
      }
      else {
        tracksHtml += `
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__body">⚠️ No tracks found.</div>
          </div>
        `;
      }

      return `
        <div class="discogs-submitter__results">
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__head">Artist</div>
            <div class="discogs-submitter__results__body">${artists}</div>
          </div>
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__head">Title</div>
            <div class="discogs-submitter__results__body">${title}</div>
          </div>
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__head">Label</div>
            <div class="discogs-submitter__results__body">${label}</div>
          </div>
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__head">Catalog</div>
            <div class="discogs-submitter__results__body">${number}</div>
          </div>
          <div class="discogs-submitter__results__row is-half">
            <div class="discogs-submitter__results__head">Released</div>
            <div class="discogs-submitter__results__body">${released}</div>
          </div>
          <div class="discogs-submitter__results__row is-half">
            <div class="discogs-submitter__results__head">Country</div>
            <div class="discogs-submitter__results__body">${country}</div>
          </div>
          <div class="discogs-submitter__results__row">
            <div class="discogs-submitter__results__head">Format</div>
            <div class="discogs-submitter__results__body">${format}${typeHtml}</div>
          </div>
          ${tracksHtml}
          ${extraArtists
    ? `
            <div class="discogs-submitter__results__row is-notes">
              <div class="discogs-submitter__results__head">Credits</div>
              <div class="discogs-submitter__results__body">${extraArtists}</div>
            </div>
          `
    : ''}
          <div class="discogs-submitter__results__row is-notes">
            <div class="discogs-submitter__results__head">Notes</div>
            <div class="discogs-submitter__results__body">${notes}</div>
          </div>
        </div>
      `;
    },
  };

  /**
   * Registry of supported digital stores containing logic for parsing and UI injection.
   */
  const DigitalStoreRegistry = {
    /**
     * List of all supported digital stores.
     * @type {Array<object>}
     */
    list: [
      {
        id: 'bandcamp',
        test: Utils.matchUrls(
          'https://*.bandcamp.com/album/*',
          'https://web.archive.org/web/*/*://*.bandcamp.com/album/*',
        ),
        target: '.tralbumCommands',
        injectButton: (button, target) => {
          button.classList.add('follow-unfollow');

          target.insertAdjacentElement('afterend', button);
        },
        supports: {
          formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
          hdAudio: true,
        },
        parse: () => {
          const data = JSON.parse(Utils.getTextFromTag('script[data-tralbum]', null, 'data-tralbum'));

          const albumCover = Utils.getTextFromTag('a.popupImage', null, 'href');
          const albumExtraArtists = [];

          const albumCredits = document.querySelectorAll('.tralbum-credits');
          const albumCreditsText = Array.from(albumCredits)
            .map((el) => {
              const clone = el.cloneNode(true);
              // Replace <br> tags with \n
              clone.querySelectorAll('br').forEach((br) => {
                br.replaceWith('\n');
              });

              return clone.textContent.trim();
            })
            .filter(Boolean)
            .join('\n');

          // Split by lines and parse each line separately to avoid greediness
          albumCreditsText.split(/\r?\n/).forEach((line) => {
            const trimmedLine = line.trim();

            if (trimmedLine) {
              Utils.normalizeTrackTitle(trimmedLine, albumExtraArtists);
            }
          });

          const albumArtists = Utils.normalizeMainArtists(data?.artist, albumExtraArtists);
          const albumTitle = Utils.normalizeTrackTitle(data?.current?.title, albumExtraArtists);
          let albumLabel = null;
          let labelCountry = null;
          let albumReleased = null;

          const albumTracks = data?.trackinfo?.map((track, i) => {
            const trackPosition = `${i + 1}`;
            const trackExtraArtists = [];
            const { artists: trackArtists, title: trackTitle } = Utils.splitArtistTitle(track.title, albumArtists, trackExtraArtists);
            const trackDuration = Utils.normalizeDuration(track.duration);

            return {
              position: trackPosition,
              extraartists: trackExtraArtists,
              artists: trackArtists,
              title: trackTitle,
              duration: trackDuration,
            };
          });

          const locationTag = document.querySelector('#band-name-location');

          if (locationTag) {
            const rawLocation = Utils.getTextFromTag('.location', locationTag);

            // Extracts only the country part (e.g., "Bristol, UK" -> "UK")
            labelCountry = rawLocation ? rawLocation.split(',').pop().trim() : null;
            albumLabel = Utils.getTextFromTag('.title', locationTag);
          }

          if (!albumLabel) {
            const nodes = albumCredits.querySelectorAll('a, span, div');
            const items = Array.from(nodes)
              .map(el => Utils.cleanString(el.textContent))
              .filter(Boolean);

            items.some((el) => {
              if (/label|released\s+on/i.test(el) && el.length < 100) {
                const match = el.match(/(?:label|released\s+on)[:\s-]*(.+)/i);

                if (match?.[1]) {
                  albumLabel = Utils.cleanString(match[1]);

                  return true;
                }
              }

              return false;
            });

            if (!albumLabel && items.length) {
              albumLabel = items.find(it => it.length > 1) || null;
            }
          }

          if (!albumLabel) {
            albumLabel = Utils.getTextFromTag('[itemprop="publisher"]');
          }

          const rawReleaseDate = data?.current?.release_date;
          const rawPublishDate = data?.current?.publish_date;

          albumReleased = Utils.normalizeReleaseDate(rawReleaseDate);

          // Bandcamp date fallback logic (Bandcamp launched Sept 2008)
          if (albumReleased && rawPublishDate) {
            const dateParts = albumReleased.split('-');
            const year = Number.parseInt(dateParts[0], 10);
            const month = dateParts[1] ? Number.parseInt(dateParts[1], 10) : 0;

            if (year < 2008 || (year === 2008 && month < 9)) {
              const published = Utils.normalizeReleaseDate(rawPublishDate);

              if (published) {
                albumReleased = published;
              }
            }
          }

          return {
            cover: albumCover,
            extraartists: albumExtraArtists,
            artists: albumArtists,
            title: albumTitle,
            label: albumLabel,
            country: labelCountry,
            released: albumReleased,
            tracks: albumTracks,
          };
        },
      },
      {
        id: 'qobuz',
        test: Utils.matchUrls(
          'https://*.qobuz.com/*/album/*',
        ),
        target: '.album-meta',
        injectButton: (button, target) => {
          button.classList.add('btn-secondary');

          target.appendChild(button);

          // load all tracks, by default loads max 50 tracks
          unsafeWindow.infiniteScroll('/v4/ajax/album/load-tracks');
        },
        supports: {
          formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
          hdAudio: true,
        },
        parse: async () => {
          const getData = async () => {
            try {
              const scripts = document.querySelectorAll('script[type="application/ld+json"]');
              let foundData = null;

              Array.from(scripts).some((script) => {
                const jsonData = JSON.parse(script.textContent);

                if (jsonData['@type'] === 'Product') {
                  foundData = jsonData;

                  return true;
                }

                return false;
              });

              return foundData;
            }
            catch (error) {
              throw new Error(`Failed to fetch Qobuz data: ${error.message}`);
            }
          };
          const data = await getData();

          let albumCover = Utils.getTextFromTag('.album-cover__image', null, 'src');
          const albumExtraArtists = [];
          const albumArtists = Utils.normalizeMainArtists(Utils.getTextFromTag('.album-meta__title .artist-name'), albumExtraArtists);
          const albumTitle = Utils.normalizeTrackTitle(Utils.getTextFromTag('.album-meta__title .album-title'), albumExtraArtists);
          const albumLabel = Utils.getTextFromTag('.album-meta__item a[href*="/label/"]');
          const albumReleased = data?.releaseDate;
          const albumTracks = Array.from(document.querySelectorAll('#playerTracks > .player__item')).map((track, i) => {
            const artistRow = Utils.getTextFromTag('.track__item--artist', track);

            const trackPosition = `${i + 1}`;
            const trackExtraArtists = [];
            const trackArtists = artistRow ? Utils.normalizeArtists([artistRow], trackExtraArtists) : albumArtists;
            const trackTitle = Utils.normalizeTrackTitle(Utils.getTextFromTag('.track__item--name', track), trackExtraArtists);
            const trackDuration = Utils.normalizeDuration(Utils.getTextFromTag('.track__item--duration', track));

            return {
              position: trackPosition,
              extraartists: trackExtraArtists,
              artists: trackArtists,
              title: trackTitle,
              duration: trackDuration,
            };
          });

          if (albumCover) {
            albumCover = albumCover.replace('_600', '_max');
          }

          return {
            cover: albumCover,
            extraartists: albumExtraArtists,
            artists: albumArtists,
            title: albumTitle,
            label: albumLabel,
            released: albumReleased,
            tracks: albumTracks,
          };
        },
      },
      {
        id: 'junodownload',
        test: Utils.matchUrls(
          'https://*.junodownload.com/products/*',
        ),
        target: '#product-action-btns',
        injectButton: (button, target) => {
          button.classList.add('btn', 'btn-cta');

          target.insertAdjacentElement('afterend', button);
        },
        supports: {
          formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
          hdAudio: false,
        },
        parse: async () => {
          const getData = async () => {
            const urlSplit = location.href.split('/');
            const releaseId = urlSplit.filter(Boolean).at(-1);
            const getMeta = async () => {
              try {
                const responseText = await Utils.networkRequest({
                  method: 'GET',
                  url: `https://www.junodownload.com/api/1.2/playlist/getplaylistdetails/?product_key=${releaseId}&output_type=json`,
                });
                const jsonData = JSON.parse(responseText);

                return jsonData.items;
              }
              catch (error) {
                throw new Error(`Failed to fetch Juno metadata: ${error.message}`);
              }
            };
            const meta = await getMeta();

            return meta;
          };
          const data = await getData();

          const albumCover = Utils.getTextFromTag('.product-image-for-modal', null, 'data-src-full');
          const albumExtraArtists = [];
          const albumArtists = Utils.normalizeMainArtists(data[0].releaseArtists.map(item => item.name), albumExtraArtists);
          const albumTitle = Utils.normalizeTrackTitle(data[0].releaseTitle, albumExtraArtists);
          const albumLabel = data[0].label.name;
          let labelNumber = null;
          const albumReleased = Utils.normalizeReleaseDate(Utils.getTextFromTag('#product-page-digi [itemprop="datePublished"]'));
          const albumTracks = data.map((track, i) => {
            const trackPosition = `${i + 1}`;
            const trackExtraArtists = [];
            const trackArtists = Utils.normalizeArtists(track.artists.map(item => item.name), trackExtraArtists);
            const trackTitle = Utils.normalizeTrackTitle(track.version ? `${track.title} (${track.version})` : track.title, trackExtraArtists);
            const trackDuration = Utils.normalizeDuration(track.length);
            const trackBpm = track.bpm;

            return {
              position: trackPosition,
              extraartists: trackExtraArtists,
              artists: trackArtists,
              title: trackTitle,
              duration: trackDuration,
              bpm: trackBpm,
            };
          });

          Array.from(document.querySelectorAll('#product-page-digi .mb-2')).forEach((el) => {
            const html = el.innerHTML || '';
            const match = html.match(/<strong>Cat:<\/strong>\s*([a-z0-9-](?:[a-z0-9\s-]*[a-z0-9-])?)\s*<br>/i);

            if (match?.[1]) {
              labelNumber = Utils.cleanString(match[1]);
            }
          });

          return {
            cover: albumCover,
            extraartists: albumExtraArtists,
            artists: albumArtists,
            title: albumTitle,
            label: albumLabel,
            number: labelNumber,
            released: albumReleased,
            tracks: albumTracks,
          };
        },
      },
      {
        id: 'beatport',
        test: Utils.matchUrls(
          'https://*.beatport.com/release/*',
        ),
        target: '[class*="ReleaseDetailCard-style__Controls"]',
        injectButton: (button, target) => {
          button.classList.add('primary', 'hzHZaW');

          target.appendChild(button);
        },
        supports: {
          formats: ['WAV', 'FLAC', 'AIFF', 'MP3'],
          hdAudio: true,
        },
        parse: async () => {
          const getData = async () => {
            const urlSplit = location.href.split('/');
            const releaseId = urlSplit.filter(Boolean).at(-1);
            const accessToken = unsafeWindow.__NEXT_DATA__?.props?.pageProps?.anonSession?.access_token;
            const getMeta = async () => {
              try {
                const responseText = await Utils.networkRequest({
                  url: `https://api.beatport.com/v4/catalog/releases/${releaseId}`,
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                });
                const jsonData = JSON.parse(responseText);

                return jsonData;
              }
              catch (error) {
                throw new Error(`Beatport metadata request failed: ${error.message}`);
              }
            };
            const getTracks = async () => {
              try {
                const responseText = await Utils.networkRequest({
                  url: `https://api.beatport.com/v4/catalog/releases/${releaseId}/tracks?per_page=100`,
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                });
                const jsonData = JSON.parse(responseText);

                return jsonData.results;
              }
              catch (error) {
                throw new Error(`Beatport tracks request failed: ${error.message}`);
              }
            };
            const [meta, tracks] = await Promise.all([getMeta(), getTracks()]);

            return { ...meta, tracks };
          };
          const data = await getData();

          const albumCover = data.image.uri;
          const albumExtraArtists = [];
          const albumArtists = Utils.normalizeMainArtists(data.artists.map(item => item.name), albumExtraArtists);
          const albumTitle = Utils.normalizeTrackTitle(data.name, albumExtraArtists);
          const albumLabel = data.label.name;
          const labelNumber = data.catalog_number;
          const albumReleased = data.publish_date;
          const albumTracks = data.tracks.map((track, i) => {
            const trackPosition = `${i + 1}`;
            const trackExtraArtists = [];
            const trackArtists = Utils.normalizeArtists(track.artists.map(item => item.name), trackExtraArtists);
            const trackTitle = Utils.normalizeTrackTitle(track.mix_name !== '' ? `${track.name} (${track.mix_name})` : track.name, trackExtraArtists);
            const trackDuration = track.length;
            const trackBpm = track.bpm;

            return {
              position: trackPosition,
              extraartists: trackExtraArtists,
              artists: trackArtists,
              title: trackTitle,
              duration: trackDuration,
              bpm: trackBpm,
            };
          });

          return {
            cover: albumCover,
            extraartists: albumExtraArtists,
            artists: albumArtists,
            title: albumTitle,
            label: albumLabel,
            number: labelNumber,
            released: albumReleased,
            tracks: albumTracks,
          };
        },
      },
      {
        id: '7digital',
        test: Utils.matchUrls(
          'https://*.7digital.com/artist/*/release/*',
        ),
        target: '.release-purchase',
        injectButton: (button, target) => {
          button.classList.add('btn-primary');

          target.insertAdjacentElement('afterend', button);
        },
        supports: {
          formats: ['FLAC', 'MP3'],
          hdAudio: true,
        },
        parse: async () => {
          const getData = async () => {
            const releaseId = Utils.getTextFromTag('.release-info', null, 'data-releaseid');
            const getMeta = async () => {
              try {
                const responseText = await Utils.networkRequest({
                  method: 'GET',
                  url: `https://api.7digital.com/1.2/release/tracks?releaseid=${releaseId}&pagesize=100&imagesize=800&usageTypes=download&oauth_consumer_key=7digital.com`,
                  headers: {
                    Accept: 'application/json',
                  },
                });
                const jsonData = JSON.parse(responseText);

                return jsonData.tracks;
              }
              catch (error) {
                throw new Error(`7digital metadata request failed: ${error.message}`);
              }
            };
            const meta = await getMeta();

            return meta;
          };
          const data = await getData();

          const albumCover = data[0].release.image;
          const albumExtraArtists = [];
          const albumArtists = Utils.normalizeMainArtists([data[0].release.artist.name], albumExtraArtists);
          const albumTitle = Utils.normalizeTrackTitle(data[0].release.title, albumExtraArtists);
          const albumLabel = data[0].release.label.name;
          const albumReleased = Utils.normalizeReleaseDate(Utils.getTextFromTag('.release-data-label + .release-data-info'));
          const albumTracks = data.map((track, i) => {
            const trackPosition = `${i + 1}`;
            const trackExtraArtists = [];
            const trackArtists = Utils.normalizeArtists(track.artist.name, trackExtraArtists);
            const trackTitle = Utils.normalizeTrackTitle(track.version !== '' ? `${track.title} (${track.version})` : track.title, trackExtraArtists);
            const trackDuration = Utils.normalizeDuration(track.duration);

            return {
              position: trackPosition,
              extraartists: trackExtraArtists,
              artists: trackArtists,
              title: trackTitle,
              duration: trackDuration,
            };
          });

          return {
            cover: albumCover,
            extraartists: albumExtraArtists,
            artists: albumArtists,
            title: albumTitle,
            label: albumLabel,
            released: albumReleased,
            tracks: albumTracks,
          };
        },
      },
    ],

    /**
     * Detects the correct digital store based on the current window location.
     * Iterates through the supported stores list and executes their test functions.
     * @returns {object | undefined} The matched digital store object, or undefined if none matched.
     */
    detectByLocation: () => DigitalStoreRegistry.list.find(p => p.test(location.href)),
  };

  /**
   * Creates the main widget interface for submitting releases.
   */
  class UiWidget {
    constructor() {
      this.WIDGET_ID = GM_info.script.namespace;

      this.ui = {};

      this.currentDigitalStore = null;
      this.currentPayload = null;
      this.lastRawData = null;

      this.selectedFormat = null;
      this.isHdAudio = false;

      this.isDragging = false;
      this.offset = { x: 0, y: 0 };

      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleMouseUp = this.handleMouseUp.bind(this);

      this.currentUrl = location.href;
      this.observer = null;
    }

    injectStyles() {
      if (!document.getElementById(`${this.WIDGET_ID}-styles`)) {
        const style = document.createElement('style');

        style.id = `${this.WIDGET_ID}-styles`;
        style.textContent = Renderer.globalCss;

        document.head.appendChild(style);
      }
    }

    /**
     * Builds a hidden SVG sprite from loaded GM resources and injects it into the DOM.
     */
    buildSvgSprite() {
      if (document.getElementById(`${this.WIDGET_ID}-svg-sprite`)) {
        return;
      }

      const svgSprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      svgSprite.id = `${this.WIDGET_ID}-svg-sprite`;
      svgSprite.style.display = 'none';

      const rawIcons = {
        'icon-logo': GM_getResourceText('DS_ICON'),
      };

      let symbolsHtml = '';

      Object.entries(rawIcons).forEach(([iconId, svgString]) => {
        if (!svgString) {
          return;
        }

        const viewBoxMatch = svgString.match(/viewBox=["']([^"']+)["']/i);
        const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 1024 1024';
        const innerMatch = svgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);

        if (innerMatch && innerMatch[1]) {
          const innerContent = innerMatch[1].trim();

          symbolsHtml += `<symbol id="${iconId}" viewBox="${viewBox}">${innerContent}</symbol>`;
        }
      });

      svgSprite.innerHTML = symbolsHtml;

      document.body.appendChild(svgSprite);
    }

    /**
     * Builds the main widget popup.
     */
    buildPopup() {
      const container = document.createElement('aside');

      container.id = this.WIDGET_ID;
      container.className = `${container.id} ${Helper.isWebArchive() ? 'is-webarchive' : ''}`;
      container.innerHTML = Renderer.widgetHtml;

      document.body.appendChild(container);

      this.ui.widget = container;
      this.ui.header = container.querySelector('.discogs-submitter__header');
      this.ui.headerDragBtn = container.querySelector('.discogs-submitter__header__drag-btn');
      this.ui.headerCloseBtn = container.querySelector('.discogs-submitter__header__close-btn');
      this.ui.headerLogo = container.querySelector('.discogs-submitter__header__logo');
      this.ui.statusContainer = container.querySelector('.discogs-submitter__status-container');
      this.ui.statusText = container.querySelector('.discogs-submitter__status-text');
      this.ui.statusDebugCopyBtn = container.querySelector('.discogs-submitter__status-debug-btn');
      this.ui.previewContainer = container.querySelector('.discogs-submitter__preview-container');
      this.ui.actionsSubmitBtn = container.querySelector('.discogs-submitter__actions__btn-submit');
      this.ui.loader = container.querySelector('.discogs-submitter__loader');

      this.ui.widget.style.setProperty('--ds-logo', `url('${GM_info.script.icon}')`);
    }

    /**
     * Builds the inject button on supported digital stores pages.
     */
    buildInjectButton() {
      const btnInjectWrapper = document.createElement('div');

      btnInjectWrapper.innerHTML = Renderer.injectButtonHtml;

      this.ui.injectBtn = btnInjectWrapper.querySelector('.discogs-submitter__inject__btn');
    }

    /**
     * Sets the loading spinner state in the widget.
     * @param {boolean} isActive - Whether the spinner should be active.
     */
    setLoader(isActive) {
      if (isActive) {
        this.ui.loader.classList.add('is-loading');
      }
      else {
        this.ui.loader.classList.remove('is-loading');
      }
    }

    /**
     * Updates the status message and styling.
     * @param {string} message - The message to display.
     * @param {string} [status] - Status level ('info', 'success', 'error').
     */
    setStatus(message, status = 'info') {
      this.ui.statusText.innerHTML = message;

      this.ui.statusContainer.classList.remove('is-error', 'is-success', 'is-info');
      this.ui.statusContainer.classList.add(`is-${status}`);
    }

    /**
     * Triggers the parsing process for the current digital store.
     */
    async executeParsing() {
      this.setStatus('Parsing current release...', 'info');
      this.setLoader(true);

      this.ui.statusDebugCopyBtn.hidden = true;
      this.ui.actionsSubmitBtn.hidden = true;

      this.ui.previewContainer.innerHTML = '';

      delete this.ui.statusContainer.dataset.rawJson;

      try {
        this.ui.injectBtn.classList.add('is-disabled');

        this.lastRawData = await this.currentDigitalStore.parse();

        this.renderPayload();

        this.setStatus('Parsed successfully! Ready to submit.', 'success');
      }
      catch (error) {
        this.currentPayload = null;
        this.lastRawData = null;

        this.setStatus(`${error?.message || error}`, 'error');

        this.ui.statusContainer.dataset.rawJson = `URL: ${window.location.href}\nVersion: ${GM_info.script.version}\nError Trace:\n${error?.stack || error}`;

        this.ui.statusDebugCopyBtn.hidden = false;
        this.ui.actionsSubmitBtn.hidden = true;
      }
      finally {
        this.setLoader(false);

        this.ui.injectBtn.classList.remove('is-disabled');
      }
    }

    /**
     * Handles URL changes, resets the widget state.
     */
    handleUrlChange() {
      const newUrl = location.href;

      if (newUrl === this.currentUrl) {
        return false;
      }

      this.currentUrl = newUrl;
      this.ui.widget.classList.remove('is-open');

      // Reset internal state on URL change to prevent stale data
      this.currentPayload = null;
      this.lastRawData = null;

      this.ui.previewContainer.innerHTML = '';

      this.setStatus('Ready to parse...', 'info');

      this.ui.actionsSubmitBtn.hidden = true;
      this.ui.statusDebugCopyBtn.hidden = true;

      this.currentDigitalStore = DigitalStoreRegistry.detectByLocation();

      if (this.ui.injectBtn?.parentNode) {
        this.ui.injectBtn.remove();
      }

      return true;
    }

    /**
     * Checks if the button needs to be injected and does so.
     */
    refreshInjection() {
      this.currentDigitalStore = DigitalStoreRegistry.detectByLocation();

      if (!this.currentDigitalStore) {
        if (this.ui.injectBtn?.parentNode) {
          this.ui.injectBtn.remove();
        }

        return;
      }

      const target = document.querySelector(this.currentDigitalStore.target);

      if (target && !this.ui.injectBtn.isConnected) {
        // Ensure button has correct digital store class
        this.ui.injectBtn.classList.add(`is-${this.currentDigitalStore.id}`);

        // Validate selected format for the current digital store
        const supportedFormats = this.currentDigitalStore.supports?.formats || [];

        if (supportedFormats.length > 0 && !supportedFormats.includes(this.selectedFormat)) {
          [this.selectedFormat] = supportedFormats;
        }

        this.currentDigitalStore.injectButton(this.ui.injectBtn, target);
      }
    }

    /**
     * Sets up MutationObserver and History API patches for SPA navigation.
     */
    setupObservers() {
      // Debounce helper to avoid firing refreshInjection on every single DOM mutation
      let debounceTimer = null;
      const debouncedRefresh = () => {
        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => this.refreshInjection(), 100);
      };

      // Observe DOM changes for late-loading elements
      this.observer = new MutationObserver(debouncedRefresh);

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // After a URL change the SPA still needs time to render the new page DOM.
      // Schedule several injection attempts at increasing delays to cover slow renders.
      const scheduleInjection = () => {
        [100, 300, 600, 1000].forEach((delay) => {
          setTimeout(() => this.refreshInjection(), delay);
        });
      };

      const check = () => {
        const changed = this.handleUrlChange();

        if (changed) {
          scheduleInjection();
        }
      };

      // Observe URL changes (history API)
      window.addEventListener('popstate', check);

      // Monkey-patch pushState for SPA navigation detection.
      // replaceState is intentionally NOT patched — Next.js uses it for scroll
      // restoration and shallow routing, which would cause false URL-change
      // detections and premature button removal.
      const originalPushState = history.pushState;

      history.pushState = function (...args) {
        originalPushState.apply(this, args);

        check();
      };

      // Fallback interval — catches any navigation missed by pushState/popstate
      setInterval(check, 1000);
    }

    /**
     * Builds the payload and renders the summary preview.
     */
    renderPayload() {
      if (!this.lastRawData) {
        return;
      }

      this.currentPayload = DiscogsAdapter.buildPayload(this.lastRawData, window.location.href, {
        format: this.selectedFormat,
        isHdAudio: this.isHdAudio,
      });

      const previewObj = this.currentPayload._previewObject;
      const rawJsonString = JSON.stringify(previewObj, null, 2);

      this.ui.previewContainer.innerHTML = Renderer.releasePreview(previewObj, {
        selectedFormat: this.selectedFormat,
        isHdAudio: this.isHdAudio,
        supports: this.currentDigitalStore ? this.currentDigitalStore.supports : null,
      });

      this.ui.statusContainer.dataset.rawJson = rawJsonString;

      this.ui.actionsSubmitBtn.hidden = false;
      this.ui.statusDebugCopyBtn.hidden = false;

      this.setStatus('Parsed successfully! Ready to submit.', 'success');
    }

    /**
     * Handles copying the raw JSON layout to the clipboard.
     */
    async handleDebugCopy() {
      const textToCopy = this.ui.statusContainer.dataset.rawJson;

      if (!textToCopy) {
        return;
      }

      this.setLoader(true);

      const btnOriginalText = this.ui.statusDebugCopyBtn.textContent;

      try {
        await GM_setClipboard(textToCopy, 'text');

        // eslint-disable-next-line no-console
        console.log('[Discogs Submitter] Raw JSON:', JSON.parse(textToCopy));

        this.ui.statusDebugCopyBtn.textContent = '✅';

        setTimeout(() => {
          this.ui.statusDebugCopyBtn.textContent = btnOriginalText;

          this.setLoader(false);
        }, 2000);
      }
      catch {
        this.ui.statusDebugCopyBtn.textContent = '⛔';

        setTimeout(() => {
          this.ui.statusDebugCopyBtn.textContent = btnOriginalText;

          this.setLoader(false);
        }, 2000);
      }
    }

    /**
     * Sends the current payload to the Discogs submission endpoint.
     */
    async handleSubmit() {
      if (!this.currentPayload) {
        return;
      }

      this.setLoader(true);
      this.setStatus('Sending to Discogs...', 'info');

      this.ui.actionsSubmitBtn.classList.add('is-disabled');

      try {
        const formData = new FormData();

        formData.append('full_data', this.currentPayload.full_data);
        formData.append('sub_notes', this.currentPayload.sub_notes);

        const response = await Utils.networkRequest({
          method: 'POST',
          url: 'https://www.discogs.com/submission/release/create',
          data: formData,
        });

        const jsonData = JSON.parse(response);

        if (jsonData?.id) {
          if (this.lastRawData.cover) {
            this.setStatus('Draft created. Uploading cover image...', 'info');

            try {
              const coverBlob = await Utils.networkRequest({
                url: this.lastRawData.cover,
                method: 'GET',
                responseType: 'blob',
              });

              const imageFormData = new FormData();

              imageFormData.append('image', coverBlob, 'cover.jpg');
              imageFormData.append('pos', '1');

              await Utils.networkRequest({
                method: 'POST',
                url: `https://www.discogs.com/release/${jsonData.id}/images/upload`,
                data: imageFormData,
              });

              this.setStatus('Draft and cover uploaded successfully!<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>', 'success');

              this.ui.actionsSubmitBtn.hidden = true;

              GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);

              setTimeout(() => {
                this.ui.widget.classList.remove('is-open');
              }, 5000);
            }
            catch (imageError) {
              console.error('[Discogs Submitter] Cover upload failed:', imageError);

              this.setStatus(`Draft created, but cover upload failed!<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>`, 'warning');

              this.ui.actionsSubmitBtn.hidden = true;

              GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);
            }
          }
          else {
            this.setStatus(`Draft successfully created! ID: ${jsonData.id}.<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>`, 'success');

            this.ui.actionsSubmitBtn.hidden = true;

            GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);

            setTimeout(() => {
              this.ui.widget.classList.remove('is-open');
            }, 5000);
          }
        }
        else {
          throw new Error('Response missing release ID');
        }
      }
      catch (error) {
        this.setStatus(`Failed to create Discogs draft:<br />${error?.message || error}`, 'error');
      }
      finally {
        this.setLoader(false);

        this.ui.actionsSubmitBtn.classList.remove('is-disabled');
      }
    }

    /**
     * Binds UI event listeners.
     */
    bindEvents() {
      this.ui.headerCloseBtn.addEventListener('click', () => this.ui.widget.classList.remove('is-open'));

      this.ui.injectBtn.addEventListener('click', () => {
        if (this.ui.injectBtn.classList.contains('is-disabled')) {
          return;
        }

        if (!this.ui.widget.classList.contains('is-open')) {
          this.ui.widget.classList.add('is-open');
        }

        this.executeParsing();
      });

      this.ui.previewContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('is-format')) {
          this.selectedFormat = e.target.value;

          if (this.lastRawData) {
            this.renderPayload();
          }
        }
        else if (e.target.classList.contains('is-hdaudio')) {
          this.isHdAudio = e.target.checked;

          if (this.lastRawData) {
            this.renderPayload();
          }
        }
      });

      this.ui.statusDebugCopyBtn.addEventListener('click', () => this.handleDebugCopy());
      this.ui.actionsSubmitBtn.addEventListener('click', () => this.handleSubmit());
    }

    /**
     * Normalizes mouse or touch coordinates.
     * @param {MouseEvent|TouchEvent} e - The event object.
     * @returns {{x: number, y: number}} The x and y coordinates.
     */
    getCoords(e) {
      if (e.touches && e.touches.length > 0) {
        return {
          x: e.touches[0].pageX,
          y: e.touches[0].pageY,
        };
      }

      return {
        x: e.pageX,
        y: e.pageY,
      };
    }

    /**
     * Handles the dragging movement of the widget.
     * @param {MouseEvent|TouchEvent} e
     */
    handleMouseMove(e) {
      if (!this.isDragging) {
        return;
      }

      const coords = this.getCoords(e);
      const rootRect = this.ui.widget.getBoundingClientRect();

      const left = Math.min(Math.max(0, coords.x - this.offset.x), window.innerWidth - rootRect.width);
      const top = Math.min(Math.max(0, coords.y - this.offset.y), window.innerHeight - rootRect.height);

      this.ui.widget.style.left = `${left}px`;
      this.ui.widget.style.top = `${top}px`;
    }

    /**
     * Stops the dragging process.
     */
    handleMouseUp() {
      if (!this.isDragging) {
        return;
      }

      this.isDragging = false;

      this.ui.headerDragBtn.classList.remove('is-draggable');

      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('touchmove', this.handleMouseMove);
      document.removeEventListener('mouseup', this.handleMouseUp);
      document.removeEventListener('touchend', this.handleMouseUp);
    }

    /**
     * Binds events for widget draggability.
     */
    bindDraggableEvent() {
      const handleDown = (e) => {
        // Only left click
        if (e.type === 'mousedown' && e.button !== 0) {
          return;
        }

        // Prevent dragging if widget is closing or closed
        if (!this.ui.widget.classList.contains('is-open')) {
          return;
        }

        e.preventDefault();

        this.isDragging = true;

        const coords = this.getCoords(e);
        const rect = this.ui.widget.getBoundingClientRect();

        this.offset.x = coords.x - rect.left;
        this.offset.y = coords.y - rect.top;

        this.ui.headerDragBtn.classList.add('is-draggable');

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('touchmove', this.handleMouseMove, { passive: false });
        document.addEventListener('mouseup', this.handleMouseUp);
        document.addEventListener('touchend', this.handleMouseUp);
      };

      this.ui.headerDragBtn.addEventListener('mousedown', handleDown);
      this.ui.headerDragBtn.addEventListener('touchstart', handleDown, { passive: false });
    }

    /**
     * Initializes the widget lifecycle.
     */
    init() {
      if (document.getElementById(this.WIDGET_ID)) {
        return;
      }

      this.currentDigitalStore = DigitalStoreRegistry.detectByLocation();

      this.injectStyles();
      this.buildSvgSprite();
      this.buildPopup();
      this.buildInjectButton();
      this.bindDraggableEvent();
      this.bindEvents();
      this.setupObservers();

      // Trigger initial detection
      this.refreshInjection();
    }
  }

  /**
   * Exports utils for dev environment.
   */
  if (typeof module !== 'undefined') {
    module.exports = {
      Utils,
      PATTERNS,
      Helper,
    };

    return;
  }

  /**
   * Initialize the widget.
   */
  try {
    const app = new UiWidget();

    app.init();
  }
  catch (error) {
    console.error('[Discogs Submitter] init error', error);
  }
})();
