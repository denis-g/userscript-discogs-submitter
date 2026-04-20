// ==UserScript==
// @name         Discogs Submitter
// @namespace    discogs-submitter
// @version      3.0.12
// @author       Denis G. <https://github.com/denis-g>
// @description  Parse release data from Bandcamp, Qobuz, Juno Download, Beatport, 7digital, Amazon Music and submit releases to Discogs.
// @icon         https://raw.githubusercontent.com/denis-g/userscript-discogs-submitter/master/src/assets/icon-main.svg
// @homepage     https://github.com/denis-g/userscript-discogs-submitter
// @homepageURL  https://github.com/denis-g/userscript-discogs-submitter
// @source       https://github.com/denis-g/userscript-discogs-submitter.git
// @supportURL   https://github.com/denis-g/userscript-discogs-submitter/issues
// @downloadURL  https://raw.githubusercontent.com/denis-g/userscript-discogs-submitter/master/discogs-submitter.user.js
// @updateURL    https://raw.githubusercontent.com/denis-g/userscript-discogs-submitter/master/discogs-submitter.user.js
// @match        https://*.bandcamp.com/album/*
// @match        https://web.archive.org/web/*/*://*.bandcamp.com/album/*
// @match        https://*.qobuz.com/*
// @match        https://*.junodownload.com/products/*
// @match        https://*.beatport.com/*
// @match        https://*.7digital.com/artist/*/release/*
// @match        https://*.amazon.co.jp/*
// @match        https://*.amazon.com/*
// @match        https://*.amazon.ae/*
// @match        https://*.amazon.co.uk/*
// @match        https://*.amazon.it/*
// @match        https://*.amazon.in/*
// @match        https://*.amazon.eg/*
// @match        https://*.amazon.com.au/*
// @match        https://*.amazon.nl/*
// @match        https://*.amazon.ca/*
// @match        https://*.amazon.sa/*
// @match        https://*.amazon.sg/*
// @match        https://*.amazon.se/*
// @match        https://*.amazon.es/*
// @match        https://*.amazon.de/*
// @match        https://*.amazon.com.tr/*
// @match        https://*.amazon.com.br/*
// @match        https://*.amazon.fr/*
// @match        https://*.amazon.com.be/*
// @match        https://*.amazon.pl/*
// @match        https://*.amazon.com.mx/*
// @match        https://*.amazon.cn/*
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
// @connect      m.media-amazon.com
// @grant        GM_info
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    (function () {

        function networkRequest(options, retries = 2, timeout = 15e3) {
            const attempt = (currentTry) => new Promise((resolve, reject) => {
                const config = {
                    method: "GET",
                    timeout,
                    anonymous: false,
                    fetch: false,
                    ...options,
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(!config.responseType || config.responseType === "text" ? response.responseText : response.response);
                        } else {
                            reject(new Error(`HTTP Error: ${response.status} ${response.statusText || ""}`.trim()));
                        }
                    },
                    onerror: (response) => {
                        const statusText = response.statusText || "";
                        reject(new Error(`Network Error: ${response.status} ${statusText}`.trim() || "Connection failed"));
                    },
                    ontimeout: () => reject(new Error("Request timed out"))
                };
                GM_xmlhttpRequest(config);
            }).catch((error) => {
                if (currentTry < retries) {
                    console.warn(`[Discogs Submitter] Request failed (${error.message}). Retrying... (${currentTry + 1}/${retries})`);
                    return attempt(currentTry + 1);
                }
                throw error;
            });
            return attempt(0);
        }

        const SPACE_REGEX = /\s+/g;
        const WORD_BOUNDARY_END_REGEX = /\w$/;
        const PLACEHOLDER_REGEX = /\{\{p\}\}/g;
        const PLACEHOLDER_BOUNDARY_REGEX = /\{\{p\}\}\\b/g;
        const JOINER_REPLACE_REGEX = /[.*+?^${}()|[\]\\]/g;
        function buildCreditRegexes(phrases, templates) {
            return phrases.flatMap((phrase) => {
                const p = phrase.replace(SPACE_REGEX, "\\s+");
                return templates.map((t) => {
                    let finalTemplate = t;
                    if (!WORD_BOUNDARY_END_REGEX.test(phrase)) {
                        finalTemplate = finalTemplate.replace(PLACEHOLDER_BOUNDARY_REGEX, "{{p}}");
                    }
                    return new RegExp(finalTemplate.replace(PLACEHOLDER_REGEX, p), "gi");
                });
            });
        }
        function escapeRegExp(text) {
            return text.replace(JOINER_REPLACE_REGEX, "\\$&");
        }
        function buildJoinerPattern(joiners) {
            const escapedJoiners = joiners.map((j) => escapeRegExp(j));
            const strongJoiners = escapedJoiners.filter((j) => j.toLowerCase() !== "x");
            const xJoiner = escapedJoiners.find((j) => j.toLowerCase() === "x");
            const strongPattern = `(?:\\s+(?:${strongJoiners.join("|")})(?=\\s+)|\\s*,\\s*)`;
            if (xJoiner) {
                const xPattern = `\\s+${xJoiner}(?=\\s+(?!${strongJoiners.join("|")}|,))`;
                return new RegExp(`((?:${strongPattern})+|${xPattern})`, "i");
            }
            return new RegExp(`((?:${strongPattern})+)`, "i");
        }
        function buildOxfordPattern(joiners) {
            const nonCommaJoiners = joiners.filter((j) => j !== ",").map((j) => escapeRegExp(j));
            return nonCommaJoiners.length > 0 ? new RegExp(`,\\s*(${nonCommaJoiners.join("|")})(?:\\s+|$)`, "gi") : null;
        }

        const GLOBAL_CREDIT_REGEX = [
            "(?:\\(|\\[)\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*([^()[\\]]+)(?:\\)|\\])",
            "(?:\\s+|^)(?:\\w+\\s+(?:and|&)\\s+)?{{p}}(?:\\s+(?:and|&)\\s+\\w+)?\\s+by\\b\\s*[:\\s-]*(.+?)(?=\\s*(?:\\/|;|[A-Z][a-z]+:(?=\\s*\\S)|,|$))",
            "(?:\\s+|^)(?:\\w+\\s+(?:and|&)\\s+)?{{p}}(?:\\s+(?:and|&)\\s+\\w+)?\\b\\s*[:-]\\s*(.+?)(?=\\s*(?:\\/|;|[A-Z][a-z]+:(?=\\s*\\S)|,|$))",
            "(?:\\s+|^){{p}}(?:\\s+\\w+)*\\s+by\\b\\s*[:\\s-]*(.+?)(?=\\s*(?:\\/|;|,|$))"
        ];
        const PATTERNS = {
            joiners: [",", "/", "|", "And", "&", "X", "×", "With", "w/", "Vs", "Vs.", "Versus", "Present", "Pres.", "Aka", "Meets"],
            variousArtists: buildCreditRegexes(
                ["VA", "V A", "V\\/A", "Various", "Various Artists", "Varios", "Varios Artistas", "Různí", "Různí interpreti"],
                ["^{{p}}$"]
            ),
            removeFromArtistName: [],
            removeFromTitleName: [
                ...buildCreditRegexes(
                    ["original mix", "original", "remaster", "remastered", "explicit", "digital bonus track", "digital bonus", "bonus track", "bonus", "24bit", "24 bit", "16bit", "16 bit"],
                    ["\\(\\s*{{p}}\\s*\\)", "\\[\\s*{{p}}\\s*\\]", "-\\s*{{p}}\\b"]
                ),
                /[([-]?\s*\b\d{2,3}\s*bpm\b\s*[)\]]?/gi
            ],
            artistCredit: {
                "Featuring": buildCreditRegexes(
                    ["featuring", "feat", "ft", "f/"],
                    [
                        "(?:\\(|\\[)\\s*{{p}}\\b\\.?\\s*([^()[\\]]+)(?:\\)|\\])",
                        "(?:\\s+|^){{p}}\\b\\.?\\s*(.+?)(?=\\s+\\b(?:feat|ft|prod|remix|vs|with|and|&)\\b|\\s*[\\[\\(]|$)"
                    ]
                ),
                "Remix": [
                    ...buildCreditRegexes(
                        ["remix", "rmx", "remixed", "mix", "mixed", "re-mix", "re-mixed", "version", "edit", "edited", "re-edit", "re-edited", "rework", "reworked", "rebuild", "rebuilt"],
                        [
                            "(?:\\(|\\[)\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*([^()[\\]]+)(?:\\)|\\])",
                            "(?:\\s+|^)-\\s*{{p}}\\b\\s*(?:by)?\\s*[:\\s-]*(.+?)(?=\\s*[\\[\\(]|$)"
                        ]
                    ),
                    ...buildCreditRegexes(
                        ["remix", "rmx", "re-mix"],
                        [
                            "(?:\\(|\\[)\\s*([^()[\\]]+)\\s+{{p}}\\b\\s*(?:\\)|\\])"
                        ]
                    )
                ],
                "DJ Mix": buildCreditRegexes(
                    ["dj mix", "dj-mix"],
                    GLOBAL_CREDIT_REGEX
                ),
                "Compiled By": buildCreditRegexes(
                    ["compiled", "selected"],
                    GLOBAL_CREDIT_REGEX
                ),
                "Artwork": buildCreditRegexes(
                    ["artwork", "art work", "art", "design", "designed", "cover", "cover art", "layout"],
                    GLOBAL_CREDIT_REGEX
                ),
                "Producer": buildCreditRegexes(
                    ["produced", "producer", "prod."],
                    GLOBAL_CREDIT_REGEX
                ),
                "Written-By": buildCreditRegexes(
                    ["written", "written-by", "writing"],
                    GLOBAL_CREDIT_REGEX
                ),
                "Written-By, Producer": buildCreditRegexes(
                    ["w&p", "w & p", "written & produced", "written and produced", "produced & written", "produced and written"],
                    GLOBAL_CREDIT_REGEX
                ),
                "Mastered By": buildCreditRegexes(
                    ["mastered", "mastering", "master"],
                    GLOBAL_CREDIT_REGEX
                )
            }
        };
        const joinerPattern = buildJoinerPattern(PATTERNS.joiners);
        const oxfordPattern = buildOxfordPattern(PATTERNS.joiners);

        const IGNORE_CAPITALIZATION = [
            "FM",
            "VHS",
            "VIP",
            "UFO",
            "WTF",
            "WWII",
            "WWIII",
            "LSD",
            "TNT",
            "DNA",
            "BBQ",
            "MK",
            "I",
            "II",
            "III",
            "IV",
            "V",
            "VI",
            "VII",
            "VIII",
            "IX",
            "X",
            "XI",
            "XII",
            "XIII",
            "XIV",
            "XV",
            "XVI",
            "XVII",
            "XVIII",
            "XIX",
            "DJ",
            "MC",
            "EP",
            "LP",
            "CD",
            "DVD",
            "HD",
            "MP3",
            "DAT",
            "NASA",
            "FBI",
            "CIA",
            "KGB",
            "MI6",
            "UK",
            "USA",
            "USSR",
            "GDR",
            "DDR"
        ];
        const ignoreCapitalizationMap = new Map();
        IGNORE_CAPITALIZATION.forEach((ex) => {
            ignoreCapitalizationMap.set(ex.replace(/\./g, "").toUpperCase(), ex);
        });

        function cleanString(str, collapseWhitespace = true) {
            if (typeof str !== "string") {
                return null;
            }
            let cleaned = str.replace(/&nbsp;/gi, " ");
            if (collapseWhitespace) {
                cleaned = cleaned.replace(/\s+/g, " ");
            }
            const result = cleaned.trim();
            return result || null;
        }
        function capitalizeString(str) {
            if (!str) {
                return "";
            }
            let cleaned = String(str).trim();
            cleaned = cleaned.replace(/[’`´]/g, "'");
            cleaned = cleaned.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
            return cleaned.split(/(\s+|(?=\/)|(?<=\/))/).map((word, index, words) => {
                if (!word || /\s+/.test(word) || word === "/") {
                    return word;
                }
                const match = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}](?:.*?[\p{L}\p{N}])?)([^\p{L}\p{N}]*)$/iu);
                if (!match) {
                    return word;
                }
                const prefix = match[1];
                const core = match[2];
                const suffix = match[3];
                if (/^[A-Z](?:\.[A-Z])+\.?$/i.test(core + suffix)) {
                    return prefix + (core + suffix).toUpperCase();
                }
                const upperCore = core.toUpperCase();
                const upperCoreNoDots = upperCore.replace(/\./g, "");
                const isWordAMorPM = upperCoreNoDots === "AM" || upperCoreNoDots === "PM";
                const isFusedTime = /^\d+(?::\d+)?(?:AM|PM)$/.test(upperCoreNoDots);
                if (isWordAMorPM || isFusedTime) {
                    let isTimeContext = isFusedTime;
                    if (!isTimeContext) {
                        const prevNonSpace = words.slice(0, index).reverse().find((w) => /\S/.test(w));
                        isTimeContext = !!(prevNonSpace && /\d/.test(prevNonSpace));
                    }
                    if (isTimeContext) {
                        return prefix + upperCoreNoDots + suffix;
                    }
                }
                const exception = ignoreCapitalizationMap.get(upperCoreNoDots);
                if (exception) {
                    return prefix + exception + suffix;
                }
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
            }).join("");
        }
        function extractBpm(str) {
            if (!str) {
                return void 0;
            }
            const match = str.match(/[([-]?\s*\b(\d{2,3})\s*bpm\b\s*[)\]]?/i);
            return match ? Number.parseInt(match[1], 10) : void 0;
        }

        function isValidCreditPhrase(text) {
            if (!text || text.length > 150) {
                return false;
            }
            const promoBlacklist = /\b(?:tracks?|music|album|exclusive|material|songs?|ep|lp|release|available|digital|vinyl|download|stream|out\s+now|listen|debut|compilation|collection)\b/i;
            if (promoBlacklist.test(text)) {
                return false;
            }
            const blocks = text.split(joinerPattern).filter(Boolean);
            const hasLongSentence = blocks.some((block) => {
                const cleanBlock = block.trim().replace(/[.,;!"'()[\]{}<>:]/g, "");
                return cleanBlock.split(/\s+/).filter(Boolean).length > 5;
            });
            return !hasLongSentence;
        }
        function parseArtists(artistString, extraArtists = null) {
            if (!artistString) {
                return [];
            }
            let processedString = artistString;
            if (oxfordPattern) {
                processedString = artistString.replace(oxfordPattern, " $1 ");
            }
            const parts = processedString.split(joinerPattern);
            const artists = [];
            for (let i = 0; i < parts.length; i += 2) {
                const rawName = parts[i].trim();
                const join = parts[i + 1] || null;
                if (rawName) {
                    const normalized = normalizeArtists(rawName, extraArtists, true);
                    if (normalized.length > 0) {
                        const artist = { ...normalized[0] };
                        if (join) {
                            const originalJoin = PATTERNS.joiners.find((j) => j.toLowerCase() === join.trim().toLowerCase());
                            artist.join = originalJoin || join;
                        } else {
                            artist.join = ",";
                        }
                        artists.push(artist);
                    }
                }
            }
            return artists;
        }
        function extractExtraArtists(text, extraArtists, preserveRoles = []) {
            if (!text) {
                return "";
            }
            let processedText = text;
            for (const [role, patterns] of Object.entries(PATTERNS.artistCredit)) {
                for (const pattern of patterns) {
                    processedText = processedText.replace(pattern, (fullMatch, p1) => {
                        if (typeof p1 !== "string") {
                            return fullMatch;
                        }
                        let cleanCapture = p1.replace(/[.:,;\s]+$/, "").trim();
                        const chunks = cleanCapture.split(/\.\s+/);
                        if (chunks.length > 1) {
                            let validName = chunks[0];
                            const namePrefixes = new Set(["mr", "mrs", "dr", "st", "vs", "feat", "ft", "prof", "bros", "inc", "ltd", "vol"]);
                            for (let i = 1; i < chunks.length; i++) {
                                const prevChunk = chunks[i - 1];
                                const words = prevChunk.split(/\s+/);
                                const lastWord = words.at(-1)?.toLowerCase() || "";
                                if (lastWord.length === 1 || namePrefixes.has(lastWord)) {
                                    validName += `. ${chunks[i]}`;
                                } else {
                                    break;
                                }
                            }
                            cleanCapture = validName;
                        }
                        if (isValidCreditPhrase(cleanCapture)) {
                            const items = parseArtists(cleanCapture, extraArtists);
                            items.forEach((artist) => {
                                if (artist.name && !extraArtists.some((existing) => existing.name === artist.name && existing.role === role)) {
                                    extraArtists.push({ name: artist.name, role });
                                }
                            });
                            return preserveRoles.includes(role) ? fullMatch : "";
                        }
                        return fullMatch;
                    });
                }
            }
            return processedText.replace(/\s{2,}/g, " ").trim();
        }
        function normalizeArtists(artists, extraArtists = null, isSubcall = false) {
            if (!artists) {
                return isSubcall ? [] : [{ name: "", join: "," }];
            }
            if (!isSubcall) {
                const processedString = Array.isArray(artists) ? artists.filter(Boolean).join(", ") : artists;
                if (typeof processedString === "string") {
                    return parseArtists(processedString, extraArtists);
                }
            }
            const artistList = Array.isArray(artists) ? artists : [artists];
            const normalizedNames = artistList.map((raw) => {
                if (!raw) {
                    return null;
                }
                let cleaned = cleanString(raw);
                if (!cleaned) {
                    return null;
                }
                if (extraArtists) {
                    cleaned = extractExtraArtists(cleaned, extraArtists);
                }
                PATTERNS.removeFromArtistName.forEach((pattern) => {
                    cleaned = cleaned.replace(pattern, "").trim();
                });
                return capitalizeString(cleaned);
            }).filter((name) => Boolean(name));
            if (normalizedNames.length === 0) {
                return isSubcall ? [] : [{ name: "Unknown Artist", join: "," }];
            }
            return normalizedNames.map((name) => ({ name, join: "," }));
        }
        function normalizeMainArtists(rawArtists, extraArtists = null) {
            const normalized = normalizeArtists(rawArtists, extraArtists);
            if (Array.isArray(extraArtists)) {
                const compilers = extraArtists.filter((artist) => artist.role === "Compiled By");
                if (compilers.length > 0) {
                    const compilerMap = new Map();
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
                    return Array.from(compilerMap.values()).map((name) => ({ name, join: "," }));
                }
            }
            if (normalized.length >= 4) {
                return [{ name: "Various", join: "," }];
            }
            const vaPatterns = PATTERNS.variousArtists;
            if (vaPatterns.length > 0) {
                const isVA = normalized.some((artist) => vaPatterns.some((pattern) => pattern.test(artist.name)));
                if (isVA) {
                    return [{ name: "Various", join: "," }];
                }
            }
            return normalized;
        }
        function groupExtraArtists(artists) {
            if (!Array.isArray(artists) || !artists.length) {
                return [];
            }
            const nameKeys = new Map();
            const roleGroups = new Map();
            artists.forEach((artist) => {
                if (!artist.name || !artist.role) {
                    return;
                }
                const trimmedName = artist.name.trim();
                const normalizedName = trimmedName.toLowerCase();
                if (!nameKeys.has(normalizedName)) {
                    nameKeys.set(normalizedName, trimmedName);
                    roleGroups.set(normalizedName, new Set());
                }
                roleGroups.get(normalizedName).add(artist.role.trim());
            });
            return Array.from(nameKeys.entries()).map(([key, name]) => {
                const roles = Array.from(roleGroups.get(key)).sort((a, b) => a.localeCompare(b));
                return {
                    name,
                    role: roles.join(", ")
                };
            });
        }
        function normalizeTrackTitle(rawTitle, extraArtists = null) {
            if (!rawTitle) {
                return "";
            }
            let title = capitalizeString(rawTitle);
            PATTERNS.removeFromTitleName.forEach((pattern) => {
                title = title.replace(pattern, "").trim();
            });
            if (extraArtists) {
                title = extractExtraArtists(title, extraArtists, ["Remix"]);
            }
            title = title.replace(/(\S)([[(])/g, "$1 $2");
            return cleanString(title) || "";
        }
        function splitArtistTitle(rawTitle, defaultArtists, extraArtists) {
            let cleanTitleForSplit = rawTitle || "";
            PATTERNS.removeFromTitleName.forEach((pattern) => {
                cleanTitleForSplit = cleanTitleForSplit.replace(pattern, "").trim();
            });
            const splitMatch = cleanTitleForSplit.match(/^(\S(?:.*?\S)?)\s+[-\u2013\u2014]\s*(\S.*)$/) || cleanTitleForSplit.match(/^(\S(?:.*?\S)?)[-\u2013\u2014]\s+(\S.*)$/);
            if (splitMatch) {
                const artistPart = splitMatch[1].trim();
                const titlePart = splitMatch[2].trim();
                const technicalParts = /^(?:intro|outro|skit|reprise|interlude)$/i;
                if (!technicalParts.test(artistPart) && !technicalParts.test(titlePart)) {
                    return {
                        artists: normalizeArtists(artistPart, extraArtists),
                        title: normalizeTrackTitle(titlePart, extraArtists),
                        bpm: extractBpm(rawTitle)
                    };
                }
            }
            return {
                artists: defaultArtists,
                title: normalizeTrackTitle(rawTitle || "", extraArtists),
                bpm: extractBpm(rawTitle)
            };
        }

        const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        function normalizeReleaseDate(date) {
            if (!date) {
                return null;
            }
            const gmtMatch = date.match(/(?:(\d{1,2})\s+)?([a-z]{3,})\s+(\d{4})/i);
            if (gmtMatch) {
                const day = gmtMatch[1] ? String(gmtMatch[1]).padStart(2, "0") : "00";
                const monthStr = gmtMatch[2].substring(0, 3).toLowerCase();
                const monthIndex = MONTHS.findIndex((m) => m.toLowerCase() === monthStr);
                const year = gmtMatch[3];
                if (monthIndex !== -1) {
                    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day}`;
                }
            }
            const euroDateMatch = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (euroDateMatch) {
                const day = euroDateMatch[1].padStart(2, "0");
                const month = euroDateMatch[2].padStart(2, "0");
                const year = euroDateMatch[3];
                return `${year}-${month}-${day}`;
            }
            const dateMatch = date.match(/(\d{1,2})\s+([a-z]{3,}),?\s+(\d{4})/i);
            if (dateMatch) {
                const day = dateMatch[1].padStart(2, "0");
                const monthStr = dateMatch[2].substring(0, 3).toLowerCase();
                const monthIndex = MONTHS.findIndex((m) => m.toLowerCase() === monthStr);
                const year = dateMatch[3];
                if (monthIndex !== -1) {
                    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day}`;
                }
            }
            const usDateMatch = date.match(/([a-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/i);
            if (usDateMatch) {
                const monthStr = usDateMatch[1].substring(0, 3).toLowerCase();
                const day = usDateMatch[2].padStart(2, "0");
                const year = usDateMatch[3];
                const monthIndex = MONTHS.findIndex((m) => m.toLowerCase() === monthStr);
                if (monthIndex !== -1) {
                    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day}`;
                }
            }
            const yearOnlyMatch = date.match(/(?<![\d-])\b(19|20)\d{2}\b(?![\d-])/);
            if (yearOnlyMatch) {
                return yearOnlyMatch[0];
            }
            return date;
        }

        function getManyTextFromTags(target, parent = null, keepNewlines = false) {
            const context = parent || document;
            const results = Array.from(context.querySelectorAll(target));
            return results.map((el) => {
                if (keepNewlines) {
                    const clone = el.cloneNode(true);
                    clone.querySelectorAll("br").forEach((br) => {
                        br.replaceWith("\n");
                    });
                    return cleanString(clone.textContent, false);
                }
                return cleanString(el.textContent);
            }).filter((text) => Boolean(text));
        }
        function getTextFromTag(target, parent = null, attribute = "", keepNewlines = false) {
            const context = parent || document;
            const result = context.querySelector(target);
            if (!result) {
                return null;
            }
            if (attribute) {
                return cleanString(result.getAttribute(attribute));
            }
            if (keepNewlines) {
                const clone = result.cloneNode(true);
                clone.querySelectorAll("br").forEach((br) => {
                    br.replaceWith("\n");
                });
                return cleanString(clone.textContent, false);
            }
            return cleanString(result.textContent);
        }

        function normalizeDuration(rawDuration) {
            if (!rawDuration) {
                return "";
            }
            const trimmed = String(rawDuration).trim();
            if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
                const totalSeconds = Math.round(Number.parseFloat(trimmed));
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor(totalSeconds % 3600 / 60);
                const seconds = totalSeconds % 60;
                const timeParts = [minutes, seconds].map((val) => String(val).padStart(2, "0"));
                if (hours > 0) {
                    timeParts.unshift(String(hours));
                } else {
                    timeParts[0] = Number.parseInt(timeParts[0], 10).toString();
                }
                return timeParts.join(":");
            }
            const hmsMatch = trimmed.match(/^(?:\d+:)?\d{1,2}:\d{2}$/);
            if (hmsMatch) {
                const parts = trimmed.split(":").map((p) => p.padStart(2, "0"));
                if (parts.length === 3 && Number.parseInt(parts[0], 10) === 0) {
                    parts.shift();
                }
                parts[0] = Number.parseInt(parts[0], 10).toString();
                return parts.join(":");
            }
            return trimmed || "";
        }

        function matchUrls(...patterns) {
            const regexes = patterns.map(
                (p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}`, "i")
            );
            return (url) => regexes.some((re) => re.test(url));
        }
        function getReleaseIdFromUrl(url = window.location.href) {
            try {
                const path = new URL(url).pathname;
                return path.split("/").filter(Boolean).at(-1) || null;
            } catch {
                return url.split("/").filter(Boolean).at(-1) || null;
            }
        }

        async function getData$3() {
            const releaseId = getTextFromTag(".release-info", null, "data-releaseid");
            if (!releaseId) {
                throw new Error(`[Discogs Submitter] Release ID not found`);
            }
            const responseText = await networkRequest({
                url: `https://api.7digital.com/1.2/release/tracks?releaseid=${releaseId}&pagesize=100&imagesize=800&usageTypes=download&oauth_consumer_key=7digital.com`,
                headers: {
                    Accept: "application/json"
                }
            });
            return JSON.parse(responseText).tracks;
        }
        const sevendigital = {
            id: "7digital",
            test: matchUrls(
                "https://*.7digital.com/artist/*/release/*"
            ),
            supports: {
                formats: ["FLAC", "MP3"],
                hdAudio: true
            },
            target: ".release-purchase",
            injectButton: (button, target) => {
                target.insertAdjacentElement("afterend", button);
            },
            parse: async () => {
                const data = await getData$3();
                const albumCover = data[0].release.image;
                const albumExtraArtists = [];
                const albumArtists = normalizeMainArtists([data[0].release.artist.name], albumExtraArtists);
                const albumTitle = normalizeTrackTitle(data[0].release.title, albumExtraArtists);
                const albumLabel = data[0].release.label.name;
                const albumReleased = normalizeReleaseDate(getTextFromTag(".release-data-label + .release-data-info"));
                const albumTracks = data.map((track, i) => {
                    const trackPosition = `${i + 1}`;
                    const trackExtraArtists = [];
                    const trackArtists = normalizeArtists(track.artist.name, trackExtraArtists);
                    const trackTitle = normalizeTrackTitle(track.version !== "" ? `${track.title} (${track.version})` : track.title, trackExtraArtists);
                    const trackDuration = normalizeDuration(track.duration);
                    return {
                        position: trackPosition,
                        extraartists: trackExtraArtists,
                        artists: trackArtists,
                        title: trackTitle,
                        duration: trackDuration
                    };
                });
                return {
                    cover: albumCover,
                    extraartists: albumExtraArtists,
                    artists: albumArtists,
                    title: albumTitle,
                    label: albumLabel,
                    released: albumReleased,
                    tracks: albumTracks
                };
            }
        };

        const amazonmusic = {
            id: "amazonmusic",
            test: matchUrls(
                "https://*.amazon.*/*"
            ),
            supports: {
                formats: ["MP3"],
                hdAudio: false
            },
            target: 'music-detail-header[primary-text-href] div[slot="icons"]',
            injectButton: (button, target) => {
                target.style.whiteSpace = "normal";
                target.append(button);
            },
            parse: async () => {
                const albumCover = getTextFromTag("#main_content music-detail-header", null, "image-src");
                const albumExtraArtists = [];
                const albumArtists = normalizeMainArtists(getTextFromTag("#main_content music-detail-header", null, "primary-text"), albumExtraArtists);
                const albumTitle = normalizeTrackTitle(getTextFromTag("#main_content music-detail-header", null, "headline"), albumExtraArtists);
                let albumLabel = getTextFromTag("#main_content .music-tertiary-text");
                let albumTracks = [];
                if (albumLabel) {
                    albumLabel = albumLabel.replace(/^[℗©\s\d:]+/, "").trim();
                }
                let albumReleased = getTextFromTag("#main_content music-detail-header", null, "tertiary-text");
                if (albumReleased) {
                    const dateParts = albumReleased.split("•");
                    albumReleased = normalizeReleaseDate(dateParts[dateParts.length - 1].trim());
                }
                const tracklistContainer = document.querySelector("#main_content music-container");
                const tracklistRows = (tracklistContainer?.shadowRoot ?? tracklistContainer)?.querySelectorAll("music-text-row") || [];
                if (tracklistRows.length) {
                    albumTracks = Array.from(tracklistRows).map((track, i) => {
                        const trackPosition = `${i + 1}`;
                        const trackExtraArtists = [];
                        const trackArtists = normalizeArtists(getTextFromTag(".col3 > music-link", track, "title") || albumArtists.map((artist) => artist.name), trackExtraArtists);
                        const trackTitle = normalizeTrackTitle(getTextFromTag(".col1 > music-link", track), trackExtraArtists);
                        const trackDuration = normalizeDuration(getTextFromTag(".col4 > music-link", track, "title"));
                        return {
                            position: trackPosition,
                            extraartists: trackExtraArtists,
                            artists: trackArtists,
                            title: trackTitle,
                            duration: trackDuration
                        };
                    });
                }
                return {
                    cover: albumCover,
                    extraartists: albumExtraArtists,
                    artists: albumArtists,
                    title: albumTitle,
                    label: albumLabel,
                    released: albumReleased,
                    tracks: albumTracks
                };
            }
        };

        function extractCatalogNumber(items) {
            const catPrefixes = [
                "Catalog Number",
                "Calalog No",
                "Catalogue N°",
                "Release Catalog No",
                "Cat.#",
                "Cat#",
                "CatNo",
                "Cat.no",
                "Cat. Number",
                "Cat.",
                "Catalog#",
                "Catalog #",
                "Catalogue Number",
                "Catalogue #",
                "Catalogue No",
                "Cat No."
            ];
            const buildPrefixRegex = (prefixes) => {
                const escaped = prefixes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
                return new RegExp(`(?:${escaped.join("|")})[\\s:-]+(\\S.+)`, "i");
            };
            const catRegex = buildPrefixRegex(catPrefixes);
            const bracketedCatRegex = /\[([A-Z0-9-]{3,15})\]/;
            let labelNumber = null;
            items.some((el) => {
                const match = el.match(catRegex);
                if (match?.[1]) {
                    labelNumber = cleanString(match[1]);
                    return true;
                }
                const bracketMatch = el.match(bracketedCatRegex);
                if (bracketMatch?.[1]) {
                    labelNumber = cleanString(bracketMatch[1]);
                    return true;
                }
                return false;
            });
            if (!labelNumber) {
                const suspectedCat = items.find((it) => /^[A-Z0-9]{3,10}-\d{1,5}$/.test(it) || /^[A-Z]{2,4}\d{3,6}$/.test(it));
                if (suspectedCat && suspectedCat.length < 20) {
                    labelNumber = suspectedCat;
                }
            }
            return labelNumber;
        }
        function extractLabelName(items, credits) {
            const labelPrefixes = ["Label", "Released on", "Record Label"];
            const buildPrefixRegex = (prefixes) => {
                const escaped = prefixes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
                return new RegExp(`(?:${escaped.join("|")})[\\s:-]+(\\S.+)`, "i");
            };
            const labelRegex = buildPrefixRegex(labelPrefixes);
            let albumLabel = null;
            items.some((el) => {
                if (/label|released\s+on/i.test(el) && el.length < 100) {
                    const match = el.match(labelRegex);
                    if (match?.[1]) {
                        albumLabel = cleanString(match[1]);
                        return true;
                    }
                }
                return false;
            });
            if (!albumLabel && credits.length) {
                albumLabel = credits.find((it) => it.length > 1) || null;
            }
            return albumLabel;
        }
        const bandcamp = {
            id: "bandcamp",
            test: matchUrls(
                "https://*.bandcamp.com/album/*",
                "https://web.archive.org/web/*/*://*.bandcamp.com/album/*"
            ),
            supports: {
                formats: ["WAV", "FLAC", "AIFF", "MP3"],
                hdAudio: true
            },
            target: ".tralbumCommands",
            injectButton: (button, target) => {
                target.insertAdjacentElement("afterend", button);
            },
            parse: async () => {
                const albumCover = getTextFromTag("a.popupImage", null, "href");
                const albumExtraArtists = [];
                const about = getManyTextFromTags(".tralbum-about", null, true);
                const credits = getManyTextFromTags(".tralbum-credits", null, true);
                const allCreditLines = [
                    ...about.flatMap((c) => c.split(/\r?\n/)),
                    ...credits.flatMap((c) => c.split(/\r?\n/))
                ];
                allCreditLines.forEach((line) => {
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                        normalizeTrackTitle(trimmedLine, albumExtraArtists);
                    }
                });
                const albumArtists = normalizeMainArtists(getTextFromTag("#name-section h3 span") || getTextFromTag("#band-name-location .title"), albumExtraArtists);
                const albumTitle = normalizeTrackTitle(getTextFromTag("#name-section .trackTitle"), albumExtraArtists);
                const albumTracks = Array.from(document.querySelectorAll("#track_table .track_row_view")).map((track, i) => {
                    const trackExtraArtists = [];
                    const { artists: trackArtists, title: trackTitle, bpm: trackBpm } = splitArtistTitle(getTextFromTag(".track-title", track), albumArtists, trackExtraArtists);
                    const trackDuration = normalizeDuration(getTextFromTag(".time, .time.secondaryText", track));
                    return {
                        position: `${i + 1}`,
                        extraartists: trackExtraArtists,
                        artists: trackArtists,
                        title: trackTitle,
                        duration: trackDuration,
                        bpm: trackBpm
                    };
                });
                const location = document.querySelector("#band-name-location");
                let albumLabel = location ? getTextFromTag(".title", location) : null;
                const labelCountry = location ? getTextFromTag(".location", location)?.split(",").pop()?.trim() || null : null;
                let labelNumber = null;
                const aboutItems = about.flatMap((c) => c.split(/\r?\n/).map((line) => cleanString(line)).filter(Boolean));
                const creditItems = credits.flatMap((c) => c.split(/\r?\n/).map((line) => cleanString(line)).filter(Boolean));
                const combinedItems = [...aboutItems, ...creditItems];
                labelNumber = extractCatalogNumber(combinedItems);
                if (!albumLabel) {
                    albumLabel = extractLabelName(combinedItems, creditItems);
                }
                if (!albumLabel) {
                    albumLabel = getTextFromTag('[itemprop="publisher"]');
                }
                let albumReleased = normalizeReleaseDate(getTextFromTag(".tralbum-credits"));
                if (albumReleased) {
                    const dateParts = albumReleased.split("-");
                    const year = Number.parseInt(dateParts[0], 10);
                    const month = dateParts[1] ? Number.parseInt(dateParts[1], 10) : 0;
                    const isOldYear = year < 2008;
                    const isOldMonth = year === 2008 && month < 9;
                    const isPre2008 = isOldYear || isOldMonth;
                    if (isPre2008) {
                        albumReleased = null;
                    }
                }
                return {
                    cover: albumCover,
                    extraartists: albumExtraArtists,
                    artists: albumArtists,
                    title: albumTitle,
                    label: albumLabel,
                    number: labelNumber,
                    country: labelCountry,
                    released: albumReleased,
                    tracks: albumTracks
                };
            }
        };

        async function getData$2() {
            const releaseId = getReleaseIdFromUrl();
            if (!releaseId) {
                throw new Error(`[Discogs Submitter] Release ID not found`);
            }
            const accessTokenResponse = await networkRequest({
                url: `https://www.beatport.com/api/auth/refresh-anon-token`,
                method: "POST"
            });
            const accessToken = JSON.parse(accessTokenResponse).access_token;
            if (!accessToken) {
                throw new Error("Beatport access token not found");
            }
            const [metaResponse, tracksResponse] = await Promise.all([
                networkRequest({
                    url: `https://api.beatport.com/v4/catalog/releases/${releaseId}`,
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                }),
                networkRequest({
                    url: `https://api.beatport.com/v4/catalog/releases/${releaseId}/tracks?per_page=100`,
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                })
            ]);
            const meta = JSON.parse(metaResponse);
            const tracks = JSON.parse(tracksResponse).results;
            return { ...meta, tracks };
        }
        const beatport = {
            id: "beatport",
            test: matchUrls(
                "https://*.beatport.com/*"
            ),
            supports: {
                formats: ["WAV", "FLAC", "AIFF", "MP3"],
                hdAudio: true
            },
            target: '[class^="ReleaseDetailCard-style__Controls"]',
            injectButton: (button, target) => {
                target.appendChild(button);
            },
            parse: async () => {
                const data = await getData$2();
                const albumExtraArtists = [];
                const albumArtists = normalizeMainArtists(data.artists.map((artist) => artist.name), albumExtraArtists);
                const albumTitle = normalizeTrackTitle(data.name, albumExtraArtists);
                const albumLabel = data.label.name || null;
                const labelNumber = data.catalog_number || null;
                const albumReleased = data.publish_date;
                const albumTracks = data.tracks.map((track, index) => {
                    const trackPosition = `${index + 1}`;
                    const trackExtraArtists = [];
                    const trackArtists = normalizeArtists(track.artists.map((artist) => artist.name), trackExtraArtists);
                    const trackTitle = normalizeTrackTitle(track.mix_name !== "" ? `${track.name} (${track.mix_name})` : track.name, trackExtraArtists);
                    const trackDuration = track.length;
                    const trackBpm = track.bpm;
                    return {
                        position: trackPosition,
                        extraartists: trackExtraArtists,
                        artists: trackArtists,
                        title: trackTitle,
                        duration: trackDuration,
                        bpm: trackBpm
                    };
                });
                return {
                    cover: data.image.uri,
                    extraartists: albumExtraArtists,
                    artists: albumArtists,
                    title: albumTitle,
                    label: albumLabel,
                    released: albumReleased,
                    number: labelNumber,
                    tracks: albumTracks
                };
            }
        };

        async function getData$1() {
            const releaseId = getReleaseIdFromUrl();
            if (!releaseId) {
                throw new Error(`[Discogs Submitter] Release ID not found`);
            }
            const responseText = await networkRequest({
                url: `https://www.junodownload.com/api/1.2/playlist/getplaylistdetails/?product_key=${releaseId}&output_type=json`,
                method: "GET"
            });
            return JSON.parse(responseText).items;
        }
        const junodownload = {
            id: "junodownload",
            test: matchUrls(
                "https://*.junodownload.com/products/*"
            ),
            supports: {
                formats: ["WAV", "FLAC", "AIFF", "MP3"],
                hdAudio: true
            },
            target: "#product-action-btns",
            injectButton: (button, target) => {
                target.insertAdjacentElement("afterend", button);
            },
            parse: async () => {
                const data = await getData$1();
                const albumCover = getTextFromTag(".product-image-for-modal", null, "data-src-full");
                const albumExtraArtists = [];
                const albumArtists = normalizeMainArtists(data[0].releaseArtists.map((item) => item.name), albumExtraArtists);
                const albumTitle = normalizeTrackTitle(data[0].releaseTitle, albumExtraArtists);
                const albumLabel = data[0].label.name;
                const albumReleased = normalizeReleaseDate(getTextFromTag('#product-page-digi [itemprop="datePublished"]'));
                let labelNumber = null;
                Array.from(document.querySelectorAll("#product-page-digi .mb-2")).some((el) => {
                    const html = (el.innerHTML || "").replace(/&nbsp;/g, " ");
                    const match = html.match(/<strong>Cat:<\/strong>([^<]+)<br>/i);
                    if (match?.[1]) {
                        labelNumber = cleanString(match[1]);
                        return true;
                    }
                    return false;
                });
                const albumTracks = data.map((track, i) => {
                    const trackPosition = `${i + 1}`;
                    const trackExtraArtists = [];
                    const trackArtists = normalizeArtists(track.artists.map((item) => item.name), trackExtraArtists);
                    const trackTitle = normalizeTrackTitle(track.version ? `${track.title} (${track.version})` : track.title, trackExtraArtists);
                    const trackDuration = normalizeDuration(track.length);
                    const trackBpm = track.bpm;
                    return {
                        position: trackPosition,
                        extraartists: trackExtraArtists,
                        artists: trackArtists,
                        title: trackTitle,
                        duration: trackDuration,
                        bpm: trackBpm
                    };
                });
                return {
                    cover: albumCover,
                    extraartists: albumExtraArtists,
                    artists: albumArtists,
                    title: albumTitle,
                    label: albumLabel,
                    released: albumReleased,
                    number: labelNumber,
                    tracks: albumTracks
                };
            }
        };

        async function getData() {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            let data = null;
            Array.from(scripts).some((script) => {
                try {
                    const jsonData = JSON.parse(script.textContent || "{}");
                    if (jsonData["@type"] === "Product") {
                        data = jsonData;
                        return true;
                    }
                } catch {
                    return false;
                }
                return false;
            });
            return data;
        }
        const qobuz = {
            id: "qobuz",
            test: matchUrls(
                "https://*.qobuz.com/*"
            ),
            supports: {
                formats: ["WAV", "FLAC", "AIFF", "MP3"],
                hdAudio: true
            },
            target: ".album-meta",
            injectButton: (button, target) => {
                target.appendChild(button);
                const win = unsafeWindow;
                if (typeof win.infiniteScroll === "function") {
                    try {
                        win.infiniteScroll("/v4/ajax/album/load-tracks");
                    } catch {
                    }
                }
            },
            parse: async () => {
                const data = await getData();
                let albumCover = getTextFromTag(".album-cover__image", null, "src");
                const albumExtraArtists = [];
                const albumArtists = normalizeMainArtists(getTextFromTag(".album-meta__title .artist-name"), albumExtraArtists);
                const albumTitle = normalizeTrackTitle(getTextFromTag(".album-meta__title .album-title"), albumExtraArtists);
                const albumLabel = getTextFromTag('.album-meta__item a[href*="/label/"]');
                const albumReleased = data?.releaseDate || null;
                const albumTracks = Array.from(document.querySelectorAll("#playerTracks > .player__item")).map((track, i) => {
                    const artistRow = getTextFromTag(".track__item--artist", track);
                    const trackPosition = `${i + 1}`;
                    const trackExtraArtists = [];
                    const trackArtists = artistRow ? normalizeArtists([artistRow], trackExtraArtists) : albumArtists;
                    const trackTitle = normalizeTrackTitle(getTextFromTag(".track__item--name", track), trackExtraArtists);
                    const trackDuration = normalizeDuration(getTextFromTag(".track__item--duration", track));
                    return {
                        position: trackPosition,
                        extraartists: trackExtraArtists,
                        artists: trackArtists,
                        title: trackTitle,
                        duration: trackDuration
                    };
                });
                if (albumCover) {
                    albumCover = albumCover.replace(/_(600|300)\.jpg$/, "_max.jpg").replace("_600", "_max");
                }
                return {
                    cover: albumCover,
                    extraartists: albumExtraArtists,
                    artists: albumArtists,
                    title: albumTitle,
                    label: albumLabel,
                    released: albumReleased,
                    tracks: albumTracks
                };
            }
        };

        const DigitalStoreRegistry = {
            list: [
                bandcamp,
                qobuz,
                junodownload,
                beatport,
                sevendigital,
                amazonmusic
            ],
            detectByLocation: () => DigitalStoreRegistry.list.find((p) => p.test(window.location.href))
        };

        const injectBtnCss = "/* --- INJECTED BUTTONS --- */\n\n.discogs-submitter__inject__btn {\n  display: inline-flex;\n  vertical-align: middle;\n  align-items: center;\n  justify-content: center;\n  gap: 10px;\n  cursor: pointer;\n  user-select: none;\n  padding: calc(var(--ds-gap) / 2);\n  color: var(--ds-color-black);\n  font-family: var(--ds-font-sans) !important;\n  font-size: 14px;\n  font-weight: bold;\n  line-height: 1.2;\n  text-transform: none;\n  text-shadow: none;\n  white-space: nowrap;\n  background: var(--ds-color-white);\n  border: 2px solid var(--ds-color-gray-dark);\n  border-radius: calc(var(--ds-radius) * 2);\n  outline: 1px solid var(--ds-color-gray-dark);\n  transition: outline 0.2s ease;\n\n  &:hover {\n    outline: 2px solid var(--ds-color-white);\n\n    .discogs-submitter__inject__logo {\n      animation: ds-spinner 1s linear infinite;\n    }\n  }\n\n  &.is-disabled {\n    opacity: 0.5;\n    pointer-events: none;\n  }\n\n  /* Site-specific styles */\n\n  &.is-bandcamp {\n    margin-bottom: 1.5em;\n    box-sizing: border-box;\n  }\n\n  &.is-qobuz {\n    margin-top: 20px;\n    text-transform: none;\n  }\n\n  &.is-qobuz {\n    .discogs-submitter__inject__logo {\n      margin-top: -4px;\n    }\n  }\n\n  &.is-junodownload {\n    margin-top: 20px;\n  }\n\n  &.is-beatport {\n    margin-top: 8px;\n  }\n\n  &.is-amazonmusic {\n    margin-top: 24px;\n    margin-right: 100%;\n  }\n}\n\n.discogs-submitter__inject__logo {\n  display: block;\n  width: 1.25em;\n  height: 1.25em;\n}\n";

        let btnTemplate = null;
        function getInjectBtnTemplate() {
            if (!btnTemplate) {
                btnTemplate = document.createElement("template");
                btnTemplate.innerHTML = `
      <div class="discogs-submitter__inject__btn" role="button">
        <svg class="discogs-submitter__inject__logo" aria-hidden="true"><use href="#icon-logo"></use></svg>
        <span class="discogs-submitter__inject__name">${GM_info?.script?.name || "Discogs Submitter"}</span>
      </div>
    `.trim();
            }
            return btnTemplate;
        }
        class InjectButton {
            element = null;
            WIDGET_ID;
            constructor() {
                this.WIDGET_ID = GM_info.script.namespace || "discogs-submitter";
                this.build();
                this.injectStyles();
            }
            injectStyles() {
                if (!document.getElementById(`${this.WIDGET_ID}-inject-styles`)) {
                    const style = document.createElement("style");
                    style.id = `${this.WIDGET_ID}-inject-styles`;
                    style.textContent = injectBtnCss;
                    document.head.appendChild(style);
                }
            }
            build() {
                const template = getInjectBtnTemplate();
                const clone = template.content.cloneNode(true);
                this.element = clone.firstElementChild;
            }
            setStore(storeId) {
                if (this.element) {
                    const classesToRemove = [];
                    this.element.classList.forEach((className) => {
                        if (className.startsWith("is-")) {
                            classesToRemove.push(className);
                        }
                    });
                    classesToRemove.forEach((className) => this.element?.classList.remove(className));
                    this.element.classList.add(`is-${storeId}`);
                }
            }
            setDisabled(disabled) {
                if (this.element) {
                    if (disabled) {
                        this.element.classList.add("is-disabled");
                    } else {
                        this.element.classList.remove("is-disabled");
                    }
                }
            }
        }

        const iconMain = "<svg height=\"488\" viewBox=\"0 0 488 488\" width=\"488\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\"><linearGradient id=\"a\" x1=\"50%\" x2=\"50%\" y1=\"0%\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#0b0b0b\"/><stop offset=\"1\" stop-color=\"#333\"/></linearGradient><linearGradient id=\"b\" x1=\"50%\" x2=\"50.022587%\" y1=\"50%\" y2=\"50.022724%\"><stop offset=\"0\" stop-color=\"#f20000\"/><stop offset=\"1\" stop-color=\"#d8d8d8\"/></linearGradient><g fill=\"none\" fill-rule=\"evenodd\"><circle cx=\"244\" cy=\"244\" fill=\"url(#a)\" r=\"242\" stroke=\"#fff\" stroke-width=\"4\"/><circle cx=\"245.1\" cy=\"244.2\" fill=\"url(#b)\" r=\"104.8\" stroke=\"#292929\" stroke-width=\"12\"/><g fill=\"#000\" fill-rule=\"nonzero\"><g transform=\"translate(192.5 290)\"><path d=\"m1.675 2.86v7.14h1.47v-5.01h.02l1.75 5.01h1.21l1.75-5.06h.02v5.06h1.47v-7.14h-2.21l-1.58 4.91h-.02l-1.67-4.91z\"/><path d=\"m12.545 7.24.93-2.62h.02l.9 2.62zm.15-4.38-2.7 7.14h1.58l.56-1.59h2.67l.54 1.59h1.63l-2.67-7.14z\"/><path d=\"m17.595 2.86v7.14h1.57v-2.3l.9-.91 2.15 3.21h1.97l-3.06-4.32 2.79-2.82h-1.96l-2.79 2.96v-2.96z\"/><path d=\"m24.815 2.86v7.14h5.42v-1.32h-3.85v-1.75h3.46v-1.22h-3.46v-1.53h3.77v-1.32z\"/><path d=\"m35.645 8.68v-4.5h1.12c.3866667 0 .7116667.055.975.165s.475.26833333.635.475.275.455.345.745.105.615.105.975c0 .39333333-.05.72666667-.15 1s-.2333333.495-.4.665-.3566667.29166667-.57.365-.4333333.11-.66.11zm-1.57-5.82v7.14h3.08c.5466667 0 1.0216667-.09166667 1.425-.275s.74-.435 1.01-.755.4716667-.7.605-1.14.2-.92.2-1.44c0-.59333333-.0816667-1.11-.245-1.55s-.39-.80666667-.68-1.1-.6333333-.51333333-1.03-.66-.825-.22-1.285-.22z\"/><path d=\"m43.055 6.09v-2.01h1.72c.36 0 .63.07833333.81.235s.27.40833333.27.755c0 .36-.09.62-.27.78s-.45.24-.81.24zm-1.57-3.23v7.14h1.57v-2.79h1.57c.3933333 0 .6766667.08666667.85.26s.2866667.44666667.34.82c.04.28666667.07.58666667.09.9s.0733333.58333333.16.81h1.57c-.0733333-.1-.1283333-.22166667-.165-.365s-.0633333-.295-.08-.455-.0283333-.31666667-.035-.47-.0133333-.28666667-.02-.4c-.0133333-.18-.0383333-.36-.075-.54s-.095-.345-.175-.495-.1833333-.28-.31-.39-.2866667-.19166667-.48-.245v-.02c.4-.16.6883333-.39333333.865-.7s.265-.67.265-1.09c0-.27333333-.0483333-.52833333-.145-.765s-.2366667-.445-.42-.625-.4033333-.32166667-.66-.425-.545-.155-.865-.155z\"/><path d=\"m50.505 7.24.93-2.62h.02l.9 2.62zm.15-4.38-2.7 7.14h1.58l.56-1.59h2.67l.54 1.59h1.63l-2.67-7.14z\"/><path d=\"m55.555 2.86v7.14h1.57v-2.95h2.99v-1.22h-2.99v-1.65h3.45v-1.32z\"/><path d=\"m63.065 4.18v5.82h1.57v-5.82h2.14v-1.32h-5.85v1.32z\"/><path d=\"m75.535 9.19.16.81h1v-3.86h-3v1.17h1.58c-.0466667.5-.2116667.88166667-.495 1.145s-.685.395-1.205.395c-.3533333 0-.6533333-.06833333-.9-.205s-.4466667-.31833333-.6-.545-.265-.48166667-.335-.765-.105-.575-.105-.875c0-.31333333.035-.61666667.105-.91s.1816667-.555.335-.785.3533333-.41333333.6-.55.5466667-.205.9-.205c.38 0 .7033333.1.97.3s.4466667.5.54.9h1.5c-.04-.40666667-.15-.76666667-.33-1.08s-.4083333-.57666667-.685-.79-.5866667-.375-.93-.485-.6983333-.165-1.065-.165c-.5466667 0-1.0383333.09666667-1.475.29s-.805.46-1.105.8-.53.73833333-.69 1.195-.24.95166667-.24 1.485c0 .52.08 1.005.24 1.455s.39.84166667.69 1.175.6683333.595 1.105.785.9283333.285 1.475.285c.3466667 0 .69-.0716667 1.03-.215.34-.14333333.65-.395.93-.755z\"/><path d=\"m79.535 6.09v-2.01h1.72c.36 0 .63.07833333.81.235s.27.40833333.27.755c0 .36-.09.62-.27.78s-.45.24-.81.24zm-1.57-3.23v7.14h1.57v-2.79h1.57c.3933333 0 .6766667.08666667.85.26s.2866667.44666667.34.82c.04.28666667.07.58666667.09.9s.0733333.58333333.16.81h1.57c-.0733333-.1-.1283333-.22166667-.165-.365s-.0633333-.295-.08-.455-.0283333-.31666667-.035-.47-.0133333-.28666667-.02-.4c-.0133333-.18-.0383333-.36-.075-.54s-.095-.345-.175-.495-.1833333-.28-.31-.39-.2866667-.19166667-.48-.245v-.02c.4-.16.6883333-.39333333.865-.7s.265-.67.265-1.09c0-.27333333-.0483333-.52833333-.145-.765s-.2366667-.445-.42-.625-.4033333-.32166667-.66-.425-.545-.155-.865-.155z\"/><path d=\"m85.185 2.86v7.14h5.42v-1.32h-3.85v-1.75h3.46v-1.22h-3.46v-1.53h3.77v-1.32z\"/><path d=\"m93.465 7.24.93-2.62h.02l.9 2.62zm.15-4.38-2.7 7.14h1.58l.56-1.59h2.67l.54 1.59h1.63l-2.67-7.14z\"/><path d=\"m99.175 4.18v5.82h1.57v-5.82h2.14v-1.32h-5.85v1.32z\"/><path d=\"m24.585 19.24.93-2.62h.02l.9 2.62zm.15-4.38-2.7 7.14h1.58l.56-1.59h2.67l.54 1.59h1.63l-2.67-7.14z\"/><path d=\"m34.795 21.19.16.81h1v-3.86h-3v1.17h1.58c-.0466667.5-.2116667.8816667-.495 1.145s-.685.395-1.205.395c-.3533333 0-.6533333-.0683333-.9-.205s-.4466667-.3183333-.6-.545-.265-.4816667-.335-.765-.105-.575-.105-.875c0-.3133333.035-.6166667.105-.91s.1816667-.555.335-.785.3533333-.4133333.6-.55.5466667-.205.9-.205c.38 0 .7033333.1.97.3s.4466667.5.54.9h1.5c-.04-.4066667-.15-.7666667-.33-1.08s-.4083333-.5766667-.685-.79-.5866667-.375-.93-.485-.6983333-.165-1.065-.165c-.5466667 0-1.0383333.0966667-1.475.29s-.805.46-1.105.8-.53.7383333-.69 1.195-.24.9516667-.24 1.485c0 .52.08 1.005.24 1.455s.39.8416667.69 1.175.6683333.595 1.105.785.9283333.285 1.475.285c.3466667 0 .69-.0716667 1.03-.215s.65-.395.93-.755z\"/><path d=\"m39.025 19.24.93-2.62h.02l.9 2.62zm.15-4.38-2.7 7.14h1.58l.56-1.59h2.67l.54 1.59h1.63l-2.67-7.14z\"/><path d=\"m44.075 14.86v7.14h1.57v-7.14z\"/><path d=\"m47.025 14.86v7.14h1.47v-4.78h.02l2.97 4.78h1.57v-7.14h-1.47v4.79h-.02l-2.98-4.79z\"/><path d=\"m59.555 14.69h-1.19c-.22.32-.4116667.67-.575 1.05s-.3.7733333-.41 1.18-.1933333.815-.25 1.225-.085.8016667-.085 1.175c0 .7866667.115 1.56.345 2.32s.555 1.4833333.975 2.17h1.18c-.38-.7266667-.655-1.4733333-.825-2.24s-.255-1.55-.255-2.35c0-.7866667.0866667-1.5616667.26-2.325s.45-1.4983333.83-2.205z\"/><path d=\"m61.765 17.83v1c.1733333 0 .355.005.545.015s.365.0466667.525.11.2916667.165.395.305.155.3433333.155.61c0 .34-.11.6083333-.33.805s-.49.295-.81.295c-.2066667 0-.385-.0366667-.535-.11s-.275-.1716667-.375-.295-.1766667-.27-.23-.44-.0833333-.3483333-.09-.535h-1.35c-.0066667.4066667.0516667.7666667.175 1.08s.2983333.5783333.525.795.5016667.3816667.825.495.6816667.17 1.075.17c.34 0 .6666667-.05.98-.15s.59-.2466667.83-.44.4316667-.4333333.575-.72.215-.6133333.215-.98c0-.4-.11-.7433333-.33-1.03s-.5233333-.4733333-.91-.56v-.02c.3266667-.0933333.5716667-.27.735-.53s.245-.56.245-.9c0-.3133333-.07-.59-.21-.83s-.3216667-.4433333-.545-.61-.475-.2916667-.755-.375-.56-.125-.84-.125c-.36 0-.6866667.0583333-.98.175s-.545.2816667-.755.495-.3733333.4683333-.49.765-.1816667.625-.195.985h1.35c-.0066667-.36.0816667-.6583333.265-.895s.455-.355.815-.355c.26 0 .49.08.69.24s.3.39.3.69c0 .2-.0483333.36-.145.48s-.22.2116667-.37.275-.3116667.1016667-.485.115-.3366667.0133333-.49 0z\"/><path d=\"m67.225 18.46v-1.54h-1.57v1.54zm-1.57 2v1.54h1.57v-1.54z\"/><path d=\"m71.745 22v-7h-1.13c-.04.2666667-.1233333.49-.25.67s-.2816667.325-.465.435-.39.1866667-.62.23-.4683333.0616667-.715.055v1.07h1.76v4.54z\"/><path d=\"m75.105 16.9c0-.16.0283333-.3.085-.42s.135-.22.235-.3.215-.1416667.345-.185.265-.065.405-.065c.22 0 .3983333.0333333.535.1s.2433333.15.32.25.1283333.205.155.315.04.2116667.04.305c0 .3-.1.5283333-.3.685s-.45.235-.75.235c-.2866667 0-.5366667-.0783333-.75-.235s-.32-.385-.32-.685zm-1.29-.13c0 .3466667.0866667.65.26.91s.43.4366667.77.53v.02c-.42.1-.745.3-.975.6s-.345.6733333-.345 1.12c0 .38.075.7066667.225.98s.35.5.6.68.5333333.3116667.85.395.645.125.985.125c.3266667 0 .6466667-.045.96-.135s.5933333-.225.84-.405.445-.4066667.595-.68.225-.5966667.225-.97c0-.44-.1133333-.8116667-.34-1.115s-.55-.5016667-.97-.595v-.02c.34-.1133333.595-.3.765-.56s.255-.5633333.255-.91c0-.1733333-.04-.3683333-.12-.585s-.2116667-.42-.395-.61-.425-.3516667-.725-.485-.6666667-.2-1.1-.2c-.2866667 0-.57.04-.85.12s-.5316667.2-.755.36-.405.36-.545.6-.21.5166667-.21.83zm1.13 3.11c0-.36.12-.635.36-.825s.5333333-.285.88-.285c.1666667 0 .3216667.0266667.465.08s.27.13.38.23.1966667.2183333.26.355.095.2883333.095.455c0 .1733333-.03.3333333-.09.48s-.145.2716667-.255.375-.2366667.1833333-.38.24-.3016667.085-.475.085c-.1666667 0-.3266667-.0283333-.48-.085s-.285-.1366667-.395-.24-.1983333-.2283333-.265-.375-.1-.31-.1-.49z\"/><path d=\"m78.885 23.81h1.18c.22-.3133333.4133333-.66.58-1.04s.305-.7716667.415-1.175.1916667-.81.245-1.22.08-.8016667.08-1.175c0-.7866667-.115-1.5633333-.345-2.33s-.555-1.4933333-.975-2.18h-1.17c.3666667.7266667.6366667 1.4766667.81 2.25s.26 1.56.26 2.36c0 .7866667-.0883333 1.5583333-.265 2.315s-.4483333 1.4883333-.815 2.195z\"/></g><g transform=\"translate(158 266)\"><path d=\"m2.946 2.97h.54c-.008-.236-.053-.439-.135-.609s-.194-.311-.336-.423-.307-.194-.495-.246-.392-.078-.612-.078c-.196 0-.387.025-.573.075s-.352.126-.498.228-.263.232-.351.39-.132.345-.132.561c0 .196.039.359.117.489s.182.236.312.318.277.148.441.198.331.094.501.132.337.075.501.111.311.083.441.141.234.133.312.225.117.212.117.36c0 .156-.032.284-.096.384s-.148.179-.252.237-.221.099-.351.123-.259.036-.387.036c-.16 0-.316-.02-.468-.06s-.285-.102-.399-.186-.206-.191-.276-.321-.105-.285-.105-.465h-.54c0 .26.047.485.141.675s.222.346.384.468.35.213.564.273.441.09.681.09c.196 0 .393-.023.591-.069s.377-.12.537-.222.291-.234.393-.396.153-.357.153-.585c0-.212-.039-.388-.117-.528s-.182-.256-.312-.348-.277-.165-.441-.219-.331-.101-.501-.141-.337-.077-.501-.111-.311-.077-.441-.129-.234-.119-.312-.201-.117-.189-.117-.321c0-.14.027-.257.081-.351s.126-.169.216-.225.193-.096.309-.12.234-.036.354-.036c.296 0 .539.069.729.207s.301.361.333.669z\"/><path d=\"m4.38 1.716v4.284h.57v-4.284z\"/><path d=\"m6.48 5.52v-3.324h.96c.264 0 .486.037.666.111s.327.182.441.324.196.314.246.516.075.431.075.687c0 .264-.027.489-.081.675s-.123.341-.207.465-.179.222-.285.294-.213.127-.321.165-.21.062-.306.072-.176.015-.24.015zm-.57-3.804v4.284h1.47c.356 0 .664-.05.924-.15s.474-.245.642-.435.292-.424.372-.702.12-.597.12-.957c0-.688-.178-1.2-.534-1.536s-.864-.504-1.524-.504z\"/><path d=\"m10.134 1.716v4.284h2.976v-.48h-2.406v-1.482h2.226v-.48h-2.226v-1.362h2.388v-.48z\"/><path d=\"m16.206 4.23.726-1.998h.012l.714 1.998zm.426-2.514-1.668 4.284h.582l.48-1.29h1.812l.468 1.29h.63l-1.674-4.284z\"/></g><g transform=\"translate(291 266)\"><path d=\"m11.456 6v-4.254h-.39c-.028.16-.08.292-.156.396s-.169.186-.279.246-.233.101-.369.123-.276.033-.42.033v.408h1.104v3.048z\"/><path d=\"m12.92 3.252h.51c-.004-.128.009-.255.039-.381s.079-.239.147-.339.155-.181.261-.243.233-.093.381-.093c.112 0 .218.018.318.054s.187.088.261.156.133.149.177.243.066.199.066.315c0 .148-.023.278-.069.39s-.114.216-.204.312-.203.191-.339.285-.294.197-.474.309c-.148.088-.29.182-.426.282s-.258.216-.366.348-.197.287-.267.465-.115.393-.135.645h2.778v-.45h-2.184c.024-.132.075-.249.153-.351s.172-.197.282-.285.231-.171.363-.249.264-.157.396-.237c.132-.084.26-.172.384-.264s.234-.195.33-.309.173-.243.231-.387.087-.31.087-.498c0-.2-.035-.376-.105-.528s-.165-.279-.285-.381-.261-.18-.423-.234-.335-.081-.519-.081c-.224 0-.424.038-.6.114s-.323.181-.441.315-.205.293-.261.477-.078.384-.066.6z\"/><path d=\"m17.486 1.716v1.548h.408v-1.548zm-.84 0v1.548h.408v-1.548z\"/><path d=\"m21.254 3.768v-1.572h1.116c.324 0 .561.067.711.201s.225.329.225.585-.075.452-.225.588-.387.202-.711.198zm-.57-2.052v4.284h.57v-1.752h1.308c.432.004.759-.106.981-.33s.333-.536.333-.936-.111-.711-.333-.933-.549-.333-.981-.333z\"/><path d=\"m24.47 2.898v3.102h.51v-1.38c0-.2.02-.377.06-.531s.104-.285.192-.393.204-.19.348-.246.318-.084.522-.084v-.54c-.276-.008-.504.048-.684.168s-.332.306-.456.558h-.012v-.654z\"/><path d=\"m26.75 4.452c0-.188.025-.355.075-.501s.119-.269.207-.369.191-.176.309-.228.243-.078.375-.078.257.026.375.078.221.128.309.228.157.223.207.369.075.313.075.501-.025.355-.075.501-.119.268-.207.366-.191.173-.309.225-.243.078-.375.078-.257-.026-.375-.078-.221-.127-.309-.225-.157-.22-.207-.366-.075-.313-.075-.501zm-.54 0c0 .228.032.44.096.636s.16.367.288.513.286.26.474.342.404.123.648.123c.248 0 .465-.041.651-.123s.343-.196.471-.342.224-.317.288-.513.096-.408.096-.636-.032-.441-.096-.639-.16-.37-.288-.516-.285-.261-.471-.345-.403-.126-.651-.126c-.244 0-.46.042-.648.126s-.346.199-.474.345-.224.318-.288.516-.096.411-.096.639z\"/><path d=\"m29.822 2.898v3.102h.51v-1.932c0-.06.015-.135.045-.225s.078-.177.144-.261.152-.156.258-.216.233-.09.381-.09c.116 0 .211.017.285.051s.133.082.177.144.075.135.093.219.027.176.027.276v2.034h.51v-1.932c0-.24.072-.432.216-.576s.342-.216.594-.216c.124 0 .225.018.303.054s.139.085.183.147.074.135.09.219.024.174.024.27v2.034h.51v-2.274c0-.16-.025-.297-.075-.411s-.12-.207-.21-.279-.198-.125-.324-.159-.267-.051-.423-.051c-.204 0-.391.046-.561.138s-.307.222-.411.39c-.064-.192-.174-.328-.33-.408s-.33-.12-.522-.12c-.436 0-.77.176-1.002.528h-.012v-.456z\"/><path d=\"m35.312 4.452c0-.188.025-.355.075-.501s.119-.269.207-.369.191-.176.309-.228.243-.078.375-.078.257.026.375.078.221.128.309.228.157.223.207.369.075.313.075.501-.025.355-.075.501-.119.268-.207.366-.191.173-.309.225-.243.078-.375.078-.257-.026-.375-.078-.221-.127-.309-.225-.157-.22-.207-.366-.075-.313-.075-.501zm-.54 0c0 .228.032.44.096.636s.16.367.288.513.286.26.474.342.404.123.648.123c.248 0 .465-.041.651-.123s.343-.196.471-.342.224-.317.288-.513.096-.408.096-.636-.032-.441-.096-.639-.16-.37-.288-.516-.285-.261-.471-.345-.403-.126-.651-.126c-.244 0-.46.042-.648.126s-.346.199-.474.345-.224.318-.288.516-.096.411-.096.639z\"/><path d=\"m1.808 10.57v.432c.096-.012.198-.018.306-.018.128 0 .247.017.357.051s.205.086.285.156.144.156.192.258.072.219.072.351c0 .128-.025.243-.075.345s-.117.188-.201.258-.182.124-.294.162-.23.057-.354.057c-.292 0-.514-.087-.666-.261s-.232-.399-.24-.675h-.51c-.004.22.027.416.093.588s.161.317.285.435.274.207.45.267.372.09.588.09c.2 0 .389-.027.567-.081s.333-.135.465-.243.237-.243.315-.405.117-.349.117-.561c0-.256-.063-.478-.189-.666s-.319-.31-.579-.366v-.012c.168-.076.308-.188.42-.336s.168-.318.168-.51c0-.196-.033-.366-.099-.51s-.157-.262-.273-.354-.253-.161-.411-.207-.329-.069-.513-.069c-.212 0-.399.034-.561.102s-.297.162-.405.282-.191.264-.249.432-.091.354-.099.558h.51c0-.124.016-.242.048-.354s.081-.21.147-.294.15-.151.252-.201.221-.075.357-.075c.216 0 .396.057.54.171s.216.285.216.513c0 .112-.022.212-.066.3s-.103.161-.177.219-.16.102-.258.132-.201.045-.309.045h-.108c-.02 0-.04 0-.06 0-.016 0-.034-.002-.054-.006z\"/><path d=\"m5.144 10.57v.432c.096-.012.198-.018.306-.018.128 0 .247.017.357.051s.205.086.285.156.144.156.192.258.072.219.072.351c0 .128-.025.243-.075.345s-.117.188-.201.258-.182.124-.294.162-.23.057-.354.057c-.292 0-.514-.087-.666-.261s-.232-.399-.24-.675h-.51c-.004.22.027.416.093.588s.161.317.285.435.274.207.45.267.372.09.588.09c.2 0 .389-.027.567-.081s.333-.135.465-.243.237-.243.315-.405.117-.349.117-.561c0-.256-.063-.478-.189-.666s-.319-.31-.579-.366v-.012c.168-.076.308-.188.42-.336s.168-.318.168-.51c0-.196-.033-.366-.099-.51s-.157-.262-.273-.354-.253-.161-.411-.207-.329-.069-.513-.069c-.212 0-.399.034-.561.102s-.297.162-.405.282-.191.264-.249.432-.091.354-.099.558h.51c0-.124.016-.242.048-.354s.081-.21.147-.294.15-.151.252-.201.221-.075.357-.075c.216 0 .396.057.54.171s.216.285.216.513c0 .112-.022.212-.066.3s-.103.161-.177.219-.16.102-.258.132-.201.045-.309.045h-.108c-.02 0-.04 0-.06 0-.016 0-.034-.002-.054-.006z\"/><path d=\"m12.644 13v-4.254h-.39c-.028.16-.08.292-.156.396s-.169.186-.279.246-.233.101-.369.123-.276.033-.42.033v.408h1.104v3.048z\"/><path d=\"m15.512 8.614-1.77 4.482h.432l1.776-4.482z\"/><path d=\"m17.15 10.57v.432c.096-.012.198-.018.306-.018.128 0 .247.017.357.051s.205.086.285.156.144.156.192.258.072.219.072.351c0 .128-.025.243-.075.345s-.117.188-.201.258-.182.124-.294.162-.23.057-.354.057c-.292 0-.514-.087-.666-.261s-.232-.399-.24-.675h-.51c-.004.22.027.416.093.588s.161.317.285.435.274.207.45.267.372.09.588.09c.2 0 .389-.027.567-.081s.333-.135.465-.243.237-.243.315-.405.117-.349.117-.561c0-.256-.063-.478-.189-.666s-.319-.31-.579-.366v-.012c.168-.076.308-.188.42-.336s.168-.318.168-.51c0-.196-.033-.366-.099-.51s-.157-.262-.273-.354-.253-.161-.411-.207-.329-.069-.513-.069c-.212 0-.399.034-.561.102s-.297.162-.405.282-.191.264-.249.432-.091.354-.099.558h.51c0-.124.016-.242.048-.354s.081-.21.147-.294.15-.151.252-.201.221-.075.357-.075c.216 0 .396.057.54.171s.216.285.216.513c0 .112-.022.212-.066.3s-.103.161-.177.219-.16.102-.258.132-.201.045-.309.045h-.108c-.02 0-.04 0-.06 0-.016 0-.034-.002-.054-.006z\"/><path d=\"m21.314 8.716v4.284h.57v-1.83h1.392c.14 0 .252.021.336.063s.152.098.204.168.09.152.114.246.044.193.06.297c.02.104.032.21.036.318s.008.209.012.303.013.179.027.255.041.136.081.18h.636c-.06-.072-.105-.155-.135-.249s-.053-.193-.069-.297-.026-.21-.03-.318-.01-.214-.018-.318c-.012-.104-.029-.204-.051-.3s-.056-.183-.102-.261-.108-.145-.186-.201-.179-.096-.303-.12v-.012c.26-.072.449-.206.567-.402s.177-.424.177-.684c0-.348-.115-.622-.345-.822s-.549-.3-.957-.3zm1.758 1.974h-1.188v-1.494h1.416c.268 0 .462.068.582.204s.18.312.18.528c0 .156-.027.283-.081.381s-.126.176-.216.234-.195.097-.315.117-.246.03-.378.03z\"/><path d=\"m25.454 12.334v.666h.666v-.666z\"/><path d=\"m27.662 10.768v-1.572h1.116c.324 0 .561.067.711.201s.225.329.225.585-.075.452-.225.588-.387.202-.711.198zm-.57-2.052v4.284h.57v-1.752h1.308c.432.004.759-.106.981-.33s.333-.536.333-.936-.111-.711-.333-.933-.549-.333-.981-.333z\"/><path d=\"m29.936 12.334v.666h.666v-.666z\"/><path d=\"m31.586 8.716v4.284h.54v-3.564h.012l1.338 3.564h.486l1.338-3.564h.012v3.564h.54v-4.284h-.78l-1.356 3.6-1.35-3.6z\"/><path d=\"m36.83 12.334v.666h.666v-.666z\"/></g><g transform=\"translate(195.5 179)\"><path d=\"m9.10546875.15625h3.01562505c2.1510416 0 3.8307291.49479167 5.0390624 1.484375.8854167.72395833 1.5390626 1.44791667 1.9609376 2.171875h.7421874c.6354167 1.08333333.953125 2.01822917.953125 2.8046875v.109375c0 .015625-.0364583.06770833-.109375.15625l-.2656249-.046875h-.421875v.2578125c0 .07291667-.0364584.109375-.109375.109375h-.578125v.421875h.578125c.0729166.01041667.109375.046875.109375.109375v.1015625c0 .77083333-.2994792 1.77864583-.8984375 3.0234375-.0729167.0104167-.109375.046875-.109375.109375v.046875h1.0078125c.0677083.0104167.1015625.046875.1015625.109375-.1145834.0677083-.21875.1015625-.3125001.1015625h-.9062499l-.7890626.9609375h-1.0078125c-.5312499 0-.7968749.0859375-.7968749.2578125v.0546875h1.375c.0729166.0104167.109375.046875.109375.109375-.0572917 0-.2682292.1588542-.6328126.4765625-1.3333333.953125-2.6223958 1.4296875-3.8671875 1.4296875h-5.83593745v-1.90625c0-.0729167-.03385417-.109375-.1015625-.109375h-.109375c-.91666667 0-1.375-.0520833-1.375-.15625v-.0546875c.01041667-.0677083.046875-.1015625.109375-.1015625h1.375c.06770833 0 .1015625-.0364583.1015625-.109375v-.8515625c.234375 0 .58854167-.015625 1.0625-.046875v-.109375c-.47916667-.0364583-.81510417-.0546875-1.0078125-.0546875l-.0546875-.1015625v-3.125c0-.05208333-.05208333-.10677083-.15625-.1640625h-.4765625c-.06770833 0-.1015625-.03385417-.1015625-.1015625v-.2109375c0-.08333333.140625-.13802083.421875-.1640625l.1015625.0546875.375-.3203125c.45833333 0 .6875-.05208333.6875-.15625v-2.8046875c0-.08333333-.28385417-.15625-.8515625-.21875v-3.390625l.0546875-.1015625c.70833333-.03645833 1.23958333-.0546875 1.59375-.0546875zm2.17187505 2.96875v.578125c.0104166.07291667.0442708.109375.1015624.109375h.640625c.0677084.01041667.1015625.046875.1015625.109375v2.8046875c0 .02604167-.0520833.078125-.15625.15625l-.2656249-.046875h-.3203126l-.2109374.3671875h-.4765626c-.0677083.01041667-.1015624.046875-.1015624.109375v.3125h.578125c.03125 0 .0859374.0546875.1640624.1640625l-.0546874.265625v2.0625c0 .078125.0182291.1484375.0546874.2109375-.0364583.0625-.0546874.1328125-.0546874.2109375v.2109375l.0546874.265625h.6328125c.0781251 0 .1484375.0182292.2109375.0546875.0625001-.0364583.1328125-.0546875.2109376-.0546875l.0546874.109375-.2109374.1015625c-.0729167 0-.1093751-.015625-.1093751-.046875l-.3671874.046875h-.4218751l-.0546874.265625v.109375c.0104166.0729167.0442708.109375.1015624.109375h1.1171876c.34375 0 .9088541-.1614583 1.6953125-.484375.5312499-.03125.9192708-.046875 1.1640624-.046875l.0546875-.109375c-.3541666-.0364583-.6197916-.0546875-.796875-.0546875h-.1015624v-.1015625c.6510416-.4739583 1.1276041-1.1640625 1.4296875-2.0703125l.2656249-1.109375-.1640624-.109375h-.4765626c-.0677083 0-.1015624-.03385417-.1015624-.1015625v-.2109375c0-.05208333.0520833-.10677083.15625-.1640625.0364583 0 .0546874.01822917.0546874.0546875.328125 0 .5390626-.10677083.6328126-.3203125h.3203124l.3671876-.046875v-.109375c-.1302084-1.04166667-.640625-1.99479167-1.53125-2.859375-.7760417-.0625-1.2552084-.1875-1.4375-.375-.5677084-.31770833-1.0442709-.4765625-1.4296876-.4765625h-1.21875c-.0677083.01041667-.1015624.046875-.1015624.109375zm-4.07812505.6875h.1015625c.07291667.01041667.109375.046875.109375.109375v.1015625c0 .0625-.08854167.11458333-.265625.15625l-.0546875-.1015625v-.15625c.01041667-.07291667.046875-.109375.109375-.109375zm7.52343745 3.0703125h.578125c.0729167.01041667.109375.046875.109375.109375v.0546875c0 .06770833-.0364583.1015625-.109375.1015625h-.4765624c-.0677084 0-.1015626-.03385417-.1015626-.1015625zm-8.48437495.265625h.109375c.07291667.01041667.109375.046875.109375.109375v.265625c0 .06770833-.03645833.1015625-.109375.1015625h-.2109375v-.3671875c.01041667-.07291667.04427083-.109375.1015625-.109375z\"/><path d=\"m21.3554688.1796875h3.6484374c.0729167 0 .1276042.19270833.1640626.578125h.578125c.0729166.015625.109375.05208333.109375.109375l-.1640625.109375c-.1197917-.03645833-.1901042-.0546875-.2109375-.0546875-.0625.03645833-.1328126.0546875-.2109376.0546875v-.0546875c-.0677083.03645833-.1197916.0546875-.15625.0546875v6.2421875c0 .08333333.140625.13541667.421875.15625.0625-.03645833.1328126-.0546875.2109376-.0546875 0 .015625.0364583.06770833.109375.15625v.1640625c0 .046875-.0546875.09895833-.1640625.15625h-.3125001c-.109375 0-.1640624-.01822917-.1640624-.0546875l-.2578126.0546875h-.53125c-.0729166.01041667-.109375.046875-.109375.109375v.2109375c.0104167.06770833.046875.1015625.109375.1015625h1.109375v3.703125c0 .078125.0182292.1484375.0546876.2109375-.0572917.1770833-.1640625.265625-.3203126.265625 0-.0364583-.0182291-.0546875-.0546874-.0546875l-.046875.109375v1.53125c.0104166.0729167.0442708.109375.1015624.109375.0625-.0364583.1328126-.0546875.2109376-.0546875.0729166.1302083.109375.2708333.109375.421875l-.109375.0546875h-2.328125c-.296875 0-.7708334-.0182292-1.421875-.0546875v-.3125l-.375-.2109375c0-.0364583-.0182292-.0546875-.0546876-.0546875l.0546876-.375v-.3125c0-.0833333-.0182292-.1536458-.0546876-.2109375.0364584-.0625.0546876-.1328125.0546876-.2109375v-.265625c0-.0677083-.1588542-.15625-.4765626-.265625-.0364583-.0677083-.0546874-.1197917-.0546874-.15625.0572916-.1458333.1119791-.21875.1640624-.21875h.2109376c.0625 0 .1145833.1588542.15625.4765625h.265625c.0729166 0 .109375-.0338542.109375-.1015625v-3.9140625c0-.07291667-.0364584-.109375-.109375-.109375-.6197917-.03645833-.9895834-.0546875-1.109375-.0546875l-.0546876-.1015625v-.15625c0-.05208333.0520834-.10677083.15625-.1640625.0364584 0 .0546876.01822917.0546876.0546875l.109375-.0546875h1.109375c.0677083 0 .1015624-.03385417.1015624-.1015625v-.1640625l-.1015624-.15625-.375.0546875h-.1015626c-.0520833 0-.1041666-.05208333-.15625-.15625v-6.140625l.046875-.1015625c-.0520833-.03645833-.15625-.0546875-.3125-.0546875v-.109375h.265625v-.5234375c.0104167-.07291667.0442709-.109375.1015626-.109375zm.265625.6875c.0104166.07291667.046875.109375.109375.109375h.1015624c.0729167 0 .109375-.03645833.109375-.109375s-.0364583-.109375-.109375-.109375h-.1015624c-.0729167.015625-.109375.05208333-.109375.109375z\"/><path d=\"m31.3085937.1328125c.0572917.03645833.125.0546875.2031251.0546875h.1562499c.7500001 0 1.2473959.0859375 1.4921876.2578125h.3046875c.1041666 0 .5494791.16927083 1.3359374.5078125h.515625c.0520834 0 .1041667.05208333.15625.15625-.0364583.03645833-.1744791.0546875-.4140624.0546875.6197916.546875.9296875.85416667.9296875.921875v.0546875c-.0156251.05729167-.6692709.69010417-1.9609375 1.8984375h-.71875c-.6979167-.671875-1.2291667-1.03125-1.59375-1.078125h-.0468751c-.6874999 0-1.0312499.13802083-1.0312499.4140625-.1458334 0-.2317709.23958333-.2578126.71875l.0546876.2578125h.4609374c.1145834 0 .2682292.0859375.4609376.2578125.2395833.046875.359375.11458333.359375.203125l-.0468751.1015625.1015625.0546875h1.234375v.15625h-1.0312499v.046875c.0104166.09375.3697916.265625 1.0781249.515625 1.359375.40104167 2.4401042.95052083 3.2421876 1.6484375 0 .04166667.171875.24739583.515625.6171875-.4114584.03125-.6171876.08072917-.6171876.1484375.078125 0 .1302084.0859375.1562501.2578125h.6171875c.09375 0 .1953124.20572917.3046874.6171875l-.1015624.0546875h-.515625c-.0677084.01041667-.1015626.04427083-.1015626.1015625h.671875c.046875 0 .0963542.05208333.1484376.15625v.1015625c0 .06770833-.0338542.1015625-.1015626.1015625h-.515625v.0546875c0 .17708333.0182292.46875.0546876.875 0 .5677083-.2057292 1.2369792-.6171876 2.0078125-.0677083.0104167-.1015624.0442708-.1015624.1015625v.1015625h.71875c.0677083.0104167.1015624.0442708.1015624.1015625-.0416666 0-.2630208.2239583-.6640624.671875-.8958334.6822917-2.1145834 1.0234375-3.65625 1.0234375h-.046875c-1.8906251 0-3.4348959-.5833333-4.6328126-1.75-.890625-.0572917-1.3359374-.2447917-1.3359374-.5625-.328125-.296875-.5-.5703125-.515625-.8203125.5104166-.3385417.9036458-.578125 1.1796874-.71875l.2109376.046875c.0989583-.0260417.5963541-.3177083 1.4921874-.875h.6171876c.0572916 0 .2447916.2578125.5625.7734375v.1015625h-.15625v.1015625c.5833333.515625 1.1666666.7734375 1.75.7734375.890625-.1458333 1.3359374-.5755208 1.3359374-1.2890625 0-.109375-.0859374-.34895833-.2578124-.71875h.515625v-.046875c-.0885417-.171875-.2239584-.2578125-.40625-.2578125h-.515625c-.1458334 0-.3359376-.01822917-.5703126-.0546875l-.1015624.0546875c-.0677084-.03645833-.1197917-.0546875-.15625-.0546875v-.1015625h.0546875c.0937499 0 .4374999-.01822917 1.0312499-.0546875v-.1015625l-1.4453125-.4609375c-.1041666 0-.2239583-.01822917-.359375-.0546875-.0572916.03645833-.125.0546875-.2031249.0546875-.2187501-.10416667-.5286459-.20833333-.9296876-.3125v-.1015625h.3671876v-.1015625c-1.0625-.39583333-1.7838542-.92708333-2.1640626-1.59375-.2604166-.35416667-.4140624-.74739583-.4609374-1.1796875l.1015624-.0546875h.2031251c.0364583 0 .0546875.01822917.0546875.0546875.0520833-.03645833.1536458-.0546875.3046875-.0546875v-.1015625h-.6640625v-.1015625c.171875 0 .2578124-.03385417.2578124-.1015625l-.359375-.2109375c-.0520833-.13541667-.1041666-.203125-.15625-.203125h-.5703124v-.4140625c0-1.07291667.4973958-2.015625 1.4921875-2.828125h.1562499c.0364584 0 .0546876.01822917.0546876.0546875l.1015624-.0546875.1015626.0546875c.2083333-.03645833.3124999-.08854167.3124999-.15625l-.109375-.0546875h-.3046875v-.046875c.4427084-.25520833.6640625-.40885417.6640625-.4609375 0-.09895833.4114584-.18489583 1.2343751-.2578125h.7734374c.0781251 0 .1484375-.01822917.2109375-.0546875zm-2.9843749 4.8359375v.1015625h.046875v-.1015625zm.1484374 0v.1015625h.15625c0-.06770833-.0338541-.1015625-.1015624-.1015625zm-2.2578124 0h.1015624v.1015625h-.1015624zm.2578124 0h.1484376v.1015625h-.1484376zm3.9609376 4.0625h.5078124v.15625l-.359375-.0546875h-.1484374zm-1.546875.921875v.109375h.0546874v-.109375z\"/><path d=\"m42.4726562.15625c.0364584 0 .0546876.01822917.0546876.0546875l.203125-.0546875c1.65625 0 3.0703124.39583333 4.2421875 1.1875 1.2395833 0 1.8593749.13802083 1.8593749.4140625.7760417.625 1.3776042 1.296875 1.8046876 2.015625v.3125l-1.9140626.9765625c-.3541666.20833333-.6119791.3125-.7734374.3125h-.515625c-.7760417-1.08333333-1.4817709-1.703125-2.1171875-1.859375-.2083334-.09895833-.5364584-.21875-.984375-.359375-.6093751 0-1.3151042.20572917-2.1171875.6171875v.0546875c.3802083 0 .5703124.03385417.5703124.1015625-.9322916.83854167-1.3984374 1.4921875-1.3984374 1.9609375-.1093751.13020833-.2109376.47395833-.3046876 1.03125h-1.0390624c-.0677084.01041667-.1015626.046875-.1015626.109375 0 .046875.0520834.09635417.1562501.1484375h.8749999c.0520834 0 .1380209.43229167.2578126 1.296875.1770833.69791667.5390624 1.31770833 1.0859375 1.859375l-.1015625.046875h-.5703126v.109375c.4583334.4479167 1.2161459.7916667 2.2734375 1.03125.3906251 0 .9609375-.15625 1.7109376-.46875.6927083 0 1.2265625-.2239583 1.6015625-.671875h.046875v-.1015625h-.515625v-.046875c.1302083-.234375.3541666-.54427083.671875-.9296875h.6171874c.0729167 0 .6770834.30989583 1.8125001.9296875.7239583 0 1.2239583.1536458 1.4999999.4609375v.0546875c-.140625.1510417-.2109375.2369792-.2109375.2578125l-.3593749-.0546875c-.2239584 0-.5338542.34375-.9296875 1.03125-.1510417.0729167-.4270834.109375-.8281251.109375h-.1015624c-.0520834 0-.1041667.0494792-.15625.1484375h.671875v.15625c-1.0989584 1.0208333-2.0286459 1.5911458-2.7890626 1.7109375-.546875.2708333-1.1666666.40625-1.859375.40625h-1.0859374c-1.8802084 0-3.5520834-.6692708-5.015625-2.0078125-.1458334-.1770833-.4036459-.265625-.7734376-.265625-.1197916.0364583-.1874999.0546875-.203125.0546875-.140625-.0520833-.2109374-.1041667-.2109374-.15625.0104166-.0677083.046875-.1015625.109375-.1015625.0364583 0 .0859374.0182292.1484375.0546875l.3125-.0546875h.1015625v-.0546875c-.6197917-.8489583-.9296876-1.3645833-.9296876-1.546875v-.0546875h.5156251l.2578124-.046875c-.4010416-.91666667-.6249999-1.84635417-.6718749-2.7890625h-.6640626v-.15625h.5625c.0677084 0 .1015626-.03385417.1015626-.1015625 0-.07291667-.0338542-.109375-.1015626-.109375h-.9296874c-.0677084 0-.1015626-.03385417-.1015626-.1015625v-.15625c.15625 0 .2604167-.015625.3125-.046875l.1015626.046875c.515625 0 .7734374-.06770833.7734374-.203125.0677084-.97395833.3437501-1.88802083.828125-2.7421875v-.046875c0-.06770833-.0338541-.1015625-.1015624-.1015625h-.515625l-.109375-.0546875c.6197916-1.09375 1.3255208-1.8515625 2.1171874-2.2734375 0-.06770833-.0338541-.1015625-.1015624-.1015625h-1.03125v-.0546875c.4010416-.359375 1.1249999-.6875 2.171875-.984375.5572916-.09895833 1.0572916-.1484375 1.5-.1484375h.1015624c.0781251 0 .1458334-.01822917.203125-.0546875zm-3.359375 7.234375v.15625h.15625c.0677084 0 .1015626-.03645833.1015626-.109375l-.1015626-.046875zm5.4765626 2.890625h.46875c.0677083.0104167.1015624.0442708.1015624.1015625-.4322916.3802083-.7421874.5703125-.9296874.5703125h-.4140626v-.1015625c.1302084 0 .3880209-.1901042.7734376-.5703125z\"/><path d=\"m59.0820313.1796875c1.2135416 0 2.2395833.2578125 3.078125.7734375-.0625001.03125-.1302084.046875-.2031251.046875v.1015625c.1250001 0 .6015626.32552083 1.4296876.9765625.203125 0 .4088541.06770833.6171875.203125h.5703125l.25.0546875v.0546875c0 .06770833-.0338542.1015625-.1015625.1015625h-.2578125c-.03125 0-.046875-.01822917-.046875-.0546875-.0572917.03645833-.1432292.0546875-.2578126.0546875v.046875c.7760417.86458333 1.3567709 2.02864583 1.7421876 3.4921875l-.1484376.1015625h-1.234375v.0546875c.5052084 0 .796875.015625.875.046875.0572917-.03125.1432292-.046875.2578126-.046875h.1015624c.1354167 0 .203125.32552083.203125.9765625.0104167.06770833.0442709.1015625.1015626.1015625h.515625c.03125 0 .046875.015625.046875.046875l.109375-.046875h.046875c.2083333.02083333.3125.0703125.3125.1484375 0 1.140625-.3255209 2.2890625-.9765626 3.4453125l-.1015624.046875h-.9765626l-.2109374.15625h-.5078126c-.0677083.0104167-.1015624.0442708-.1015624.1015625.375 0 .5625.0182292.5625.0546875-.796875 1.3125-2.0286459 2.2864583-3.6953125 2.921875-.8125001.2083333-1.5494792.3125-2.2109375.3125h-.5625001c-.4010416 0-.6744791-.0364583-.8203125-.109375-.0677083.0364583-.1197916.0546875-.15625.0546875-1.5052083-.2552083-2.6848958-.7526042-3.5390625-1.4921875-.6614583-.5572917-1.1927083-1.1197917-1.5937499-1.6875-.0572917-.0364583-.125-.0546875-.203125-.0546875h-.4609376v-.1015625h.5078126c0-.1041667.0364583-.15625.109375-.15625h.6640624l.2578126-.046875c-.53125-1.01041667-.8229167-1.93489583-.875-2.7734375v-.15625l.0546874-.1015625c.03125 0 .046875.01822917.046875.0546875.515625-.03645833.8932292-.0546875 1.1328126-.0546875h.765625v-.0546875c0-.06770833-.0338542-.1015625-.1015626-.1015625h-1.84375c-.0416666 0-.1276041-.11979167-.2578124-.359375h-.875c-.0677084 0-.1015626-.03385417-.1015626-.1015625s.1380209-.11979167.4140626-.15625v-.203125c-.0364584 0-.0885417-.015625-.15625-.046875-.0677084.03125-.1197917.046875-.15625.046875-.03125-.06770833-.046875-.11979167-.046875-.15625.0989583-1.1875.5416666-2.3828125 1.328125-3.5859375.3020833-.41145833.578125-.6171875.8281249-.6171875.4427084 0 .6640625-.05208333.6640625-.15625-.1145833-.06770833-.2161458-.1015625-.3046875-.1015625h-.0546875l-.2578124.046875-.0468751-.1015625.0468751-.1015625c-.1354167 0-.203125-.03385417-.203125-.1015625.2552083-.22395833.7343749-.54947917 1.4374999-.9765625h.5625001c.9166666-.546875 2.2526041-.8203125 4.0078125-.8203125zm-4.2656251 6.4140625v.1015625l.3125.2109375v.1015625c0 .06770833-.0364583.1015625-.109375.1015625h-.25v.15625h.9218751c.0572916 0 .1093749.11979167.1562499.359375.734375.03125 1.28125.046875 1.640625.046875h.40625v.1015625c0 .07291667-.0338541.109375-.1015624.109375-.0625-.03645833-.1119792-.0546875-.1484376-.0546875-.0364583 0-.0546874.01822917-.0546874.0546875l-.2578126-.0546875c-.125 0-.6041666.01822917-1.4375.0546875v.25c.1666667.83854167.59375 1.59375 1.28125 2.265625.3802084.2604167.5703126.4140625.5703126.4609375l-.1015626.046875h-.71875l.046875.1015625v.0546875h-.3046874v.1015625h.6171874c.609375.171875 1.0182292.2578125 1.2265626.2578125.1979166 0 .5234374-.0520833.9765624-.15625 0-.0677083-.0338541-.1015625-.1015624-.1015625h-.2578126v-.1015625h.5625c.0364584 0 .2760417-.0520833.71875-.15625h.515625c.078125 0 .1458334-.015625.203125-.046875.0677084.03125.1197917.046875.15625.046875.671875-.2864583 1.2708334-.91927083 1.7968751-1.8984375.2031249-.6875.3046875-1.08072917.3046875-1.1796875v-.4140625c0-.05729167-.1692709-.10677083-.5078126-.1484375l-.1015624.046875h-.359375c-.140625 0-.2109376-.34114583-.2109376-1.0234375l-.25-.0546875h-1.75v-.1015625c.515625-.03125.8932292-.046875 1.1328126-.046875h.765625v-.0546875c-.3229167-.91145833-.8359376-1.61197917-1.5390626-2.1015625-.7760416-.47916667-1.4088541-.71875-1.8984374-.71875-1.4322917 0-2.5963542.734375-3.4921876 2.203125-.2395833.60416667-.359375.99739583-.359375 1.1796875zm-3.5390624 1.078125h.5625c.0677083.01041667.1015624.04427083.1015624.1015625l-.1015624.0546875h-.5625zm12.625.2109375-.046875.1015625v.046875h.046875c0-.06770833.0338541-.1015625.1015624-.1015625v-.046875zm-6.3125.765625h.0546874c.0677084.01041667.1015626.04427083.1015626.1015625v.15625c0 .06770833-.0338542.1015625-.1015626.1015625h-.0546874c-.0677084 0-.1015626-.03385417-.1015626-.1015625v-.15625c.0104167-.06770833.0442709-.1015625.1015626-.1015625zm-6.0078126.5625h.3125l.046875.2578125-.1484374.1015625h-.15625c-.0677084 0-.1197917-.1015625-.15625-.3046875z\"/><path d=\"m74.9414062.1953125c1.21875 0 2.3463542.29166667 3.3828126.875v.046875c-.1822917 0-.3359376.01822917-.4609375.0546875v.046875c.7708333.36458333 1.5729166 1.1171875 2.4062499 2.2578125.3333334 0 .5390626.1015625.6171876.3046875 0 .046875-.1015626.09895833-.3046875.15625 0 .15625-.5651042.48177083-1.6953125.9765625-.5104167.33854167-.8697917.5078125-1.078125.5078125h-.40625l-.9765626-1.171875c-.25-.13020833-.3854166-.234375-.40625-.3125v-.046875h.203125v-.109375c-.046875 0-.2682291-.1015625-.6640624-.3046875h-.2109376c-.3177083 0-.5729166-.06770833-.765625-.203125h-.8203124c-.078125 0-.1458334.015625-.203125.046875l-.1015626-.046875c-1.1822916.36979167-1.953125.84895833-2.3124999 1.4375-.0833334.09895833-.3046875.16666667-.6640625.203125v.046875c.0104166.07291667.0442708.109375.1015624.109375.0677084 0 .1015626-.01822917.1015626-.0546875l.515625.0546875h.921875v.046875c0 .06770833-.0338542.1015625-.1015626.1015625h-1.234375c-.203125.13541667-.4062499.71614583-.609375 1.7421875v.4140625c0 .41666667.1015626.96354167.3046876 1.640625l-.1015625.046875h-.5156251l-.3046874.0546875c-.0677084-.03645833-.1197917-.0546875-.15625-.0546875l-.1015626.0546875c-.0677083-.03645833-.1197916-.0546875-.15625-.0546875v.0546875c.2291667.65104167.6901042 1.1979167 1.3828126 1.640625.3385416.2395833.578125.359375.71875.359375h1.28125c.8020833.2395833 1.3854166.359375 1.75.359375.7083333-.2395833 1.1510416-.359375 1.328125-.359375.0677083.0364583.1197916.0546875.15625.0546875.7760416-.5208333 1.1848958-.8463542 1.2265624-.9765625.1979167-.140625.4713542-.5.8203126-1.078125v-.0546875h-4.1015626c-.0677083 0-.1015624-.03385417-.1015624-.1015625v-1.4296875c.171875-.10416667.2578124-.19010417.2578124-.2578125l-.046875-.1015625c.03125-.0625.046875-.1328125.046875-.2109375-.171875-.04166667-.2578124-.09114583-.2578124-.1484375.0677083-.08854167.1015624-.140625.1015624-.15625.0729167 0 .109375.01822917.109375.0546875.4010417-.03645833.6901042-.0546875.8671876-.0546875h5.3359374c.0729167 0 .140625.01822917.203125.0546875.0572917-.03645833.1250001-.0546875.203125-.0546875h.921875l.3125.359375v.3046875c-.171875.09375-.2760416.31770833-.3125.671875-.03125.5-.046875.84114583-.046875 1.0234375.171875 0 .2578126.03385417.2578126.1015625v.0546875c-.390625 1.3333333-.734375 2-1.03125 2-.0572917-.0364583-.125-.0546875-.203125-.0546875-.8020834 1.4479167-2.2369792 2.5078125-4.3046876 3.1796875-.578125.1041667-1.0052083.15625-1.28125.15625h-.9765624c-2.625 0-4.6927084-1.1119792-6.203125-3.3359375h-1.3828126c-.171875-.09375-.4635416-.6744792-.875-1.7421875v-.3125h1.3828126l-.203125-1.640625v-.25c.1510416-1.30208333.2864583-1.953125.40625-1.953125.6614583-.03125 1.0911458-.046875 1.2890624-.046875v-.1015625h-.0546874c-.359375 0-.90625-.01822917-1.640625-.0546875 0-.05208333.171875-.11979167.515625-.203125.6614583-1.66145833 1.6848958-2.875 3.0703124-3.640625.5416667 0 1.0052084-.11979167 1.390625-.359375.9166667-.41145833 2.078125-.6171875 3.484375-.6171875zm-8.875 4.6640625h.15625v.15625c-.1197916.03645833-.1875.0546875-.203125.0546875l-.0546874-.109375c.0104166-.06770833.0442708-.1015625.1015624-.1015625zm6.7734376 1.796875c.3385416.02604167.5078124.078125.5078124.15625 0 .06770833-.0338541.1015625-.1015624.1015625h-.4609376c-.0677083 0-.1015624-.03385417-.1015624-.1015625 0-.05208333.0520833-.10416667.15625-.15625zm-.671875.0546875h.109375c.0677083.01041667.1015624.04427083.1015624.1015625v.1015625h-.2109374c-.0677084 0-.1015626-.03385417-.1015626-.1015625.0104167-.06770833.0442709-.1015625.1015626-.1015625z\"/><path d=\"m87.1054688.1328125c.0572916.03645833.125.0546875.203125.0546875h.15625c.75 0 1.2473958.0859375 1.4921874.2578125h.3046876c.1041666 0 .5494791.16927083 1.3359374.5078125h.515625c.0520834 0 .1041667.05208333.15625.15625-.0364583.03645833-.1744791.0546875-.4140624.0546875.6197916.546875.9296874.85416667.9296874.921875v.0546875c-.015625.05729167-.6692708.69010417-1.9609374 1.8984375h-.71875c-.6979167-.671875-1.2291667-1.03125-1.59375-1.078125h-.046875c-.6875 0-1.03125.13802083-1.03125.4140625-.1458334 0-.2317709.23958333-.2578126.71875l.0546876.2578125h.4609374c.1145834 0 .2682292.0859375.4609376.2578125.2395833.046875.359375.11458333.359375.203125l-.046875.1015625.1015624.0546875h1.234375v.15625h-1.03125v.046875c.0104167.09375.3697917.265625 1.078125.515625 1.359375.40104167 2.4401042.95052083 3.2421876 1.6484375 0 .04166667.171875.24739583.515625.6171875-.4114584.03125-.6171876.08072917-.6171876.1484375.078125 0 .1302084.0859375.15625.2578125h.6171876c.09375 0 .1953124.20572917.3046874.6171875l-.1015624.0546875h-.515625c-.0677084.01041667-.1015626.04427083-.1015626.1015625h.671875c.046875 0 .0963542.05208333.1484376.15625v.1015625c0 .06770833-.0338542.1015625-.1015626.1015625h-.515625v.0546875c0 .17708333.0182292.46875.0546876.875 0 .5677083-.2057292 1.2369792-.6171876 2.0078125-.0677083.0104167-.1015624.0442708-.1015624.1015625v.1015625h.71875c.0677083.0104167.1015624.0442708.1015624.1015625-.0416666 0-.2630208.2239583-.6640624.671875-.8958334.6822917-2.1145834 1.0234375-3.65625 1.0234375h-.046875c-1.890625 0-3.4348959-.5833333-4.6328126-1.75-.890625-.0572917-1.3359374-.2447917-1.3359374-.5625-.328125-.296875-.5-.5703125-.515625-.8203125.5104166-.3385417.9036458-.578125 1.1796874-.71875l.2109376.046875c.0989583-.0260417.5963541-.3177083 1.4921874-.875h.6171876c.0572916 0 .2447916.2578125.5625.7734375v.1015625h-.15625v.1015625c.5833333.515625 1.1666666.7734375 1.75.7734375.890625-.1458333 1.3359374-.5755208 1.3359374-1.2890625 0-.109375-.0859374-.34895833-.2578124-.71875h.515625v-.046875c-.0885417-.171875-.2239584-.2578125-.40625-.2578125h-.515625c-.1458334 0-.3359376-.01822917-.5703126-.0546875l-.1015624.0546875c-.0677084-.03645833-.1197917-.0546875-.15625-.0546875v-.1015625h.0546874c.09375 0 .4375-.01822917 1.03125-.0546875v-.1015625l-1.4453124-.4609375c-.1041667 0-.2239584-.01822917-.359375-.0546875-.0572917.03645833-.125.0546875-.203125.0546875-.21875-.10416667-.5286459-.20833333-.9296876-.3125v-.1015625h.3671876v-.1015625c-1.0625-.39583333-1.7838542-.92708333-2.1640626-1.59375-.2604166-.35416667-.4140624-.74739583-.4609374-1.1796875l.1015624-.0546875h.203125c.0364584 0 .0546876.01822917.0546876.0546875.0520833-.03645833.1536458-.0546875.3046874-.0546875v-.1015625h-.6640624v-.1015625c.171875 0 .2578124-.03385417.2578124-.1015625l-.359375-.2109375c-.0520833-.13541667-.1041666-.203125-.15625-.203125h-.5703124v-.4140625c0-1.07291667.4973958-2.015625 1.4921874-2.828125h.15625c.0364584 0 .0546876.01822917.0546876.0546875l.1015624-.0546875.1015626.0546875c.2083333-.03645833.3125-.08854167.3125-.15625l-.109375-.0546875h-.3046876v-.046875c.4427084-.25520833.6640626-.40885417.6640626-.4609375 0-.09895833.4114583-.18489583 1.234375-.2578125h.7734374c.078125 0 .1484376-.01822917.2109376-.0546875zm-2.984375 4.8359375v.1015625h.046875v-.1015625zm.1484374 0v.1015625h.15625c0-.06770833-.0338541-.1015625-.1015624-.1015625zm-2.2578124 0h.1015624v.1015625h-.1015624zm.2578124 0h.1484376v.1015625h-.1484376zm3.9609376 4.0625h.5078124v.15625l-.359375-.0546875h-.1484374zm-1.546875.921875v.109375h.0546874v-.109375z\"/><path d=\"m6.15625 16.1328125c.05729167.0364583.125.0546875.203125.0546875h.15625c.75 0 1.24739583.0859375 1.4921875.2578125h.3046875c.10416667 0 .54947917.1692708 1.3359375.5078125h.515625c.0520833 0 .1041667.0520833.15625.15625-.0364583.0364583-.1744792.0546875-.4140625.0546875.6197917.546875.9296875.8541667.9296875.921875v.0546875c-.015625.0572917-.6692708.6901042-1.9609375 1.8984375h-.71875c-.69791667-.671875-1.22916667-1.03125-1.59375-1.078125h-.046875c-.6875 0-1.03125.1380208-1.03125.4140625-.14583333 0-.23177083.2395833-.2578125.71875l.0546875.2578125h.4609375c.11458333 0 .26822917.0859375.4609375.2578125.23958333.046875.359375.1145833.359375.203125l-.046875.1015625.1015625.0546875h1.234375v.15625h-1.03125v.046875c.01041667.09375.36979167.265625 1.078125.515625 1.359375.4010417 2.4401042.9505208 3.2421875 1.6484375 0 .0416667.171875.2473958.515625.6171875-.4114583.03125-.6171875.0807292-.6171875.1484375.078125 0 .1302083.0859375.15625.2578125h.6171875c.09375 0 .1953125.2057292.3046875.6171875l-.1015625.0546875h-.515625c-.0677083.0104167-.1015625.0442708-.1015625.1015625h.671875c.046875 0 .0963542.0520833.1484375.15625v.1015625c0 .0677083-.0338542.1015625-.1015625.1015625h-.515625v.0546875c0 .1770833.0182292.46875.0546875.875 0 .5677083-.2057292 1.2369792-.6171875 2.0078125-.0677083.0104167-.1015625.0442708-.1015625.1015625v.1015625h.71875c.0677083.0104167.1015625.0442708.1015625.1015625-.0416667 0-.2630208.2239583-.6640625.671875-.8958333.6822917-2.11458333 1.0234375-3.65625 1.0234375h-.046875c-1.890625 0-3.43489583-.5833333-4.6328125-1.75-.890625-.0572917-1.3359375-.2447917-1.3359375-.5625-.328125-.296875-.5-.5703125-.515625-.8203125.51041667-.3385417.90364583-.578125 1.1796875-.71875l.2109375.046875c.09895833-.0260417.59635417-.3177083 1.4921875-.875h.6171875c.05729167 0 .24479167.2578125.5625.7734375v.1015625h-.15625v.1015625c.58333333.515625 1.16666667.7734375 1.75.7734375.890625-.1458333 1.3359375-.5755208 1.3359375-1.2890625 0-.109375-.0859375-.3489583-.2578125-.71875h.515625v-.046875c-.08854167-.171875-.22395833-.2578125-.40625-.2578125h-.515625c-.14583333 0-.3359375-.0182292-.5703125-.0546875l-.1015625.0546875c-.06770833-.0364583-.11979167-.0546875-.15625-.0546875v-.1015625h.0546875c.09375 0 .4375-.0182292 1.03125-.0546875v-.1015625l-1.4453125-.4609375c-.10416667 0-.22395833-.0182292-.359375-.0546875-.05729167.0364583-.125.0546875-.203125.0546875-.21875-.1041667-.52864583-.2083333-.9296875-.3125v-.1015625h.3671875v-.1015625c-1.0625-.3958333-1.78385417-.9270833-2.1640625-1.59375-.26041667-.3541667-.4140625-.7473958-.4609375-1.1796875l.1015625-.0546875h.203125c.03645833 0 .0546875.0182292.0546875.0546875.05208333-.0364583.15364583-.0546875.3046875-.0546875v-.1015625h-.6640625v-.1015625c.171875 0 .2578125-.0338542.2578125-.1015625l-.359375-.2109375c-.05208333-.1354167-.10416667-.203125-.15625-.203125h-.5703125v-.4140625c0-1.0729167.49739583-2.015625 1.4921875-2.828125h.15625c.03645833 0 .0546875.0182292.0546875.0546875l.1015625-.0546875.1015625.0546875c.20833333-.0364583.3125-.0885417.3125-.15625l-.109375-.0546875h-.3046875v-.046875c.44270833-.2552083.6640625-.4088542.6640625-.4609375 0-.0989583.41145833-.1848958 1.234375-.2578125h.7734375c.078125 0 .1484375-.0182292.2109375-.0546875zm-2.984375 4.8359375v.1015625h.046875v-.1015625zm.1484375 0v.1015625h.15625c0-.0677083-.03385417-.1015625-.1015625-.1015625zm-2.2578125 0h.1015625v.1015625h-.1015625zm.2578125 0h.1484375v.1015625h-.1484375zm3.9609375 4.0625h.5078125v.15625l-.359375-.0546875h-.1484375zm-1.546875.921875v.109375h.0546875v-.109375z\"/><path d=\"m12.296875 16.1796875h3.5859375c.0729167.0104167.109375.0442708.109375.1015625v3.75h.984375c.0729167.0104167.109375.0442708.109375.1015625v.0546875c-.46875.0364583-.8177083.0546875-1.046875.0546875h-.046875v.359375l-.265625.2109375v.3125c.1197917 0 .2421875.0859375.3671875.2578125h.625c.0677083.0104167.1015625.046875.1015625.109375v2.703125c0 .0677083-.0338542.1015625-.1015625.1015625-.0364583 0-.0546875-.015625-.0546875-.046875-.0572917.03125-.125.046875-.203125.046875v.109375c0 .078125.015625.1458333.046875.203125 0 .3125-.15625.46875-.46875.46875v.0546875l.3671875.046875.2109375-.046875c.1354167 0 .2395833.2604167.3125.78125.1041667.078125.15625.1979167.15625.359375l-.2109375.109375c-.1875-.0364583-.34375-.0546875-.46875-.0546875h-.0546875c0 .3385417.3984375.7213542 1.1953125 1.1484375.1979167.1041667.5807292.171875 1.1484375.203125.7395833-.2135417 1.3307292-.6302083 1.7734375-1.25.0104167-.0677083.0442708-.1015625.1015625-.1015625h.4140625c.2916667 0 .4817708-.1744792.5703125-.5234375l.0546875-.2578125v-.8828125c0-.2447917.0338542-.4348958.1015625-.5703125-.0677083 0-.1015625-.0364583-.1015625-.109375v-2.1875l.0546875-.2578125c-.1510417-.1041667-.3958333-.15625-.734375-.15625 0 .0364583-.015625.0546875-.046875.0546875 0-.1875-.1223958-.2916667-.3671875-.3125v-.3125l.3125-.2109375c0-.2760417.0338542-.4140625.1015625-.4140625h.9375v-.1015625c-.46875-.0364583-.8151042-.0546875-1.0390625-.0546875v-3.75c.0104167-.0677083.0442708-.1015625.1015625-.1015625h3.5390625c.0729167.0104167.109375.0442708.109375.1015625v3.6484375c.0104167.0677083.0442708.1015625.1015625.1015625h.8828125c.0729167.0104167.109375.0442708.109375.1015625-.1770833.0729167-.4895833.109375-.9375.109375h-.109375c0 .3125-.1015625.46875-.3046875.46875v.4140625c.171875 0 .2578125.0338542.2578125.1015625l-.0546875.109375.2578125.046875h.5234375l.15625.109375-.0546875.2578125v3.8515625c0 .078125.0182292.1458333.0546875.203125-.0364583.3489583-.0885417.5234375-.15625.5234375h-.625c-.1145833 0-.234375.3125-.359375.9375-.2395833.6614583-.8307292 1.3723958-1.7734375 2.1328125.0677083.0104167.1015625.0442708.1015625.1015625v.0546875c-1.140625.5885417-2.1979167.8828125-3.171875.8828125-.1458333 0-.2838542.0182292-.4140625.0546875-1.4479167 0-2.75-.2604167-3.90625-.78125-.3177083-.2083333-.6302083-.3307292-.9375-.3671875-.9375-.6458333-1.5625-1.4609375-1.875-2.4453125l-.1015625-.515625.1015625-.0546875h.578125c.046875 0 .0989583-.0520833.15625-.15625l-.0546875-.7265625c.0364583-.0677083.0546875-.1197917.0546875-.15625l-.15625-.109375h-.625c-.0729167 0-.109375-.0338542-.109375-.1015625l.109375-.046875h.359375v-.625l.3671875-.2109375c0-.2083333.0182292-.3125.0546875-.3125l-.0546875-.3671875v-.9375c0-.125.0182292-.28125.0546875-.46875-.0364583-.0416667-.0546875-.1614583-.0546875-.359375v-.109375c0-.03125.0182292-.046875.0546875-.046875 0-.09375-.1041667-.1640625-.3125-.2109375-.0677083.0364583-.1197917.0546875-.15625.0546875v-.0546875l-.109375.0546875h-.203125c-.09375-.171875-.1640625-.2578125-.2109375-.2578125h-.1015625v-.15625l-.0546875-.265625c.2083333 0 .3125-.1901042.3125-.5703125h1.0390625v-.1015625c-.515625-.0364583-.8619792-.0546875-1.0390625-.0546875l-.0546875-.1015625v-3.6484375c.0104167-.0677083.046875-.1015625.109375-.1015625zm9.8828125 7.390625c0 .0677083-.0338542.1015625-.1015625.1015625v.0546875h.1015625l.0546875-.1015625v-.0546875z\"/><path d=\"m27.2265625 16.15625h4.7109375c1.9479167 0 3.3229167.6875 4.125 2.0625-.09375.0260417-.3072917.0598958-.640625.1015625.15625.3229167.296875.78125.421875 1.375h.53125c.0729167 0 .109375.0520833.109375.15625h.6328125c.0677083.015625.1015625.0520833.1015625.109375v.2109375c0 .0729167-.0338542.109375-.1015625.109375-.0364583 0-.0546875-.0182292-.0546875-.0546875-.0364583 0-.0546875.0182292-.0546875.0546875l-.2578125-.0546875h-.21875c0 1.3072917-.5442708 2.2942708-1.6328125 2.9609375v.1015625c1.40625.6197917 2.109375 1.7135417 2.109375 3.28125v.421875h.0546875c.046875 0 .2239583-.0182292.53125-.0546875l.0546875.109375c-.0260417.4583333-.0963542.6875-.2109375.6875h-.21875c-.078125 0-.1484375-.0182292-.2109375-.0546875-.1197917 0-.2786458.3177083-.4765625.953125l-.421875.421875-.3671875-.0546875h-.15625c-.9635417.9895833-1.9505208 1.484375-2.9609375 1.484375h-7.7734375c-.0729167 0-.109375-.0364583-.109375-.109375v-1.265625c.0104167-.0729167.046875-.109375.109375-.109375h.5234375c.0729167 0 .109375-.0338542.109375-.1015625v-.109375c0-.1041667-.0182292-.15625-.0546875-.15625l.0546875-.265625v-3.1171875c0-.0729167-.0364583-.109375-.109375-.109375h-.3125c-.3020833 0-.7786458-.0182292-1.4296875-.0546875l-.0546875-.1015625v-.0546875l.0546875-.1015625c.6510417-.0364583 1.1276042-.0546875 1.4296875-.0546875h.3671875l.0546875-.265625v-3.9140625l-.0546875-.3125c.0364583-.0625.0546875-.1510417.0546875-.265625v-.1640625c0-.0416667-.125-.1276042-.375-.2578125v-1.21875c0-.046875.1067708-.0989583.3203125-.15625.0364583-.0729167.0546875-.1276042.0546875-.1640625 0-.109375-.0182292-.4427083-.0546875-1 .0364583-.53125.0729167-.8151042.109375-.8515625.7552083-.03125 1.3177083-.046875 1.6875-.046875zm-2.9609375 2.1640625h.109375v1.3203125h-.109375zm.375 0h.1015625v1.3203125h-.1015625zm4.9140625.6875h-.953125v.5859375c.0104167.0677083.046875.1015625.109375.1015625h.4765625c.015625 0 .0677083.0364583.15625.109375l-.0546875.3671875v1.7421875c.0104167.0729167.046875.109375.109375.109375h2.109375c.7760417-.3125 1.1640625-.7708333 1.1640625-1.375v-.421875h.640625v-.0546875c0-.1510417-.0729167-.2578125-.21875-.3203125l-.1015625.0546875c-.0364583 0-.0546875-.0182292-.0546875-.0546875l-.1015625.0546875h-.265625c-.125-.140625-.25-.2109375-.375-.2109375h-.421875c-.421875-.4583333-.7552083-.6875-1-.6875h-1.0625c-.03125 0-.046875-.0182292-.046875-.0546875zm-.2109375 5.65625v.1640625h.578125c.5260417 0 1.2317708-.0182292 2.1171875-.0546875-.0208333-.1041667-.1614583-.15625-.421875-.15625h-.84375c-.3020833 0-.7786458.015625-1.4296875.046875zm-1.90625.1640625c0 .0677083-.015625.1015625-.046875.1015625.03125.0677083.046875.1197917.046875.15625h1.75v-.15625l-.375-.1015625zm5.7109375 0v.2109375l.0546875.1015625.3671875-.0546875h1.375c.0729167 0 .109375-.0338542.109375-.1015625v-.0546875c0-.0677083-.0364583-.1015625-.109375-.1015625zm-9.9375 0c.0677083.0104167.1015625.0442708.1015625.1015625v.0546875c0 .0677083-.0338542.1015625-.1015625.1015625-.0729167 0-.109375-.0338542-.109375-.1015625v-.0546875c.0104167-.0677083.046875-.1015625.109375-.1015625zm6.453125.3125h-.3203125l-.0546875.375c0 .1041667.0182292.15625.0546875.15625l-.0546875.265625v.265625c0 .3020833.0182292.6171875.0546875.9453125-.0364583.1354167-.0546875.2942708-.0546875.4765625l.109375.0546875h3.2265625c.2864583 0 .6015625-.2109375.9453125-.6328125-.421875-.0364583-.6328125-.0885417-.6328125-.15625.1197917 0 .2083333-.3359375.265625-1.0078125-.28125-.4947917-.4401042-.7421875-.4765625-.7421875-.2604167 0-1.125-.0182292-2.59375-.0546875l-.3671875.0546875v-.0546875z\"/><path d=\"m38.3046875 16.15625c.1927083.0364583.3515625.0546875.4765625.0546875h1.6953125c.078125 0 .1484375-.0182292.2109375-.0546875.4583333 0 .6875.1588542.6875.4765625l1 2.5859375h.4765625v.1640625h-.3125c-.0729167.0104167-.109375.0442708-.109375.1015625 0 .0625.1588542.1171875.4765625.1640625l.0546875.1015625v.265625h-.2109375c.28125.8697917.9140625 2.4895833 1.8984375 4.859375l.265625-.046875h.3203125l-.0546875-.375v-.2109375c.0729167-.2291667.109375-.4036458.109375-.5234375-.0729167 0-.109375-.0364583-.109375-.109375v-.0546875c.0104167-.0677083.046875-.1015625.109375-.1015625h.046875l.109375.0546875 1.6875-4.125.265625.0546875c.0208333 0 .0911458-.0182292.2109375-.0546875v-.1640625h-.2578125c-.0729167 0-.109375-.0338542-.109375-.1015625l1.109375-2.8515625.109375-.0546875h3.484375c.0729167.0104167.109375.0442708.109375.1015625v2.90625h.3125c.0729167.015625.109375.0520833.109375.109375l-.109375.0546875h-.3125v4.0703125h.265625c.0677083.0104167.1015625.0442708.1015625.1015625v.0546875c0 .0520833-.0520833.1041667-.15625.15625h-.0546875l-.109375-.046875-.046875.1015625v1.0078125h.578125c.0729167.0104167.109375.0442708.109375.1015625v3.3828125c0 .0729167-.0364583.109375-.109375.109375h-.578125v2.0078125c0 .0677083-.0364583.1015625-.109375.1015625h-1.7421875c-.3541667 0-.8828125-.015625-1.5859375-.046875v-1.75l-.0546875-.2578125.109375-.0546875h.3671875l.265625-.0546875v-2.8515625c.140625-.2135417.2109375-.4270833.2109375-.640625-.3854167-.0260417-.578125-.078125-.578125-.15625.2083333-.6666667.3645833-1 .46875-1 .140625 0 .2109375-.0364583.2109375-.109375v-.1015625c-.2447917 0-.3671875-.0546875-.3671875-.1640625v-.953125h-.0546875c-.046875 0-.1875.3359375-.421875 1.0078125.2135417.046875.3203125.0989583.3203125.15625 0 .09375-.125.1640625-.375.2109375 0-.03125-.015625-.046875-.046875-.046875-.140625.2552083-.28125.625-.421875 1.109375h.5234375c.0729167.0104167.109375.0442708.109375.1015625-.53125 1.3177083-.8671875 2.2005208-1.0078125 2.6484375-.2291667.5625-.3697917.84375-.421875.84375h-.6328125l-.796875 2.109375h-.9453125c-.3541667 0-.8828125-.015625-1.5859375-.046875-.4583333-1.1458333-.6875-1.8333333-.6875-2.0625h.4765625c.0677083 0 .1015625-.0364583.1015625-.109375-.6458333-1.6145833-.9817708-2.53125-1.0078125-2.75v-.6875c-.0208333 0-.2473958-.015625-.6796875-.046875l-.0546875.1015625v3.3828125c0 .0729167-.0364583.109375-.109375.109375h-.4765625c-.0677083.0104167-.1015625.0442708-.1015625.1015625v.1640625h.265625c.0677083.0104167.1015625.0442708.1015625.1015625 0 .0729167-.0338542.109375-.1015625.109375h-.265625v1.53125c0 .0677083-.0364583.1015625-.109375.1015625h-1.8515625c-.296875 0-.7708333-.015625-1.421875-.046875l-.0546875-.109375v-1.375l.3203125-.2109375-.3203125-.2109375v-.0546875c.0104167-.0677083.046875-.1015625.109375-.1015625h.578125l.0546875-.265625v-3.0703125l-.0546875-.2578125h-.578125c-.0729167 0-.109375-.0364583-.109375-.109375v-4.6015625c.0104167-.0677083.046875-.1015625.109375-.1015625h.2578125v-.421875h-.2578125c-.0729167 0-.109375-.0364583-.109375-.109375v-.046875h.3671875c.0729167 0 .109375-.0364583.109375-.109375v-.109375c-.078125 0-.1484375-.015625-.2109375-.046875-.0625.03125-.1328125.046875-.2109375.046875l-.0546875-.1015625v-1.1640625c0-.078125.0182292-.1484375.0546875-.2109375-.0364583-.0625-.0546875-.1328125-.0546875-.2109375v-1.21875c.0104167-.0677083.046875-.1015625.109375-.1015625h.3125c.203125 0 .3255208-.0182292.3671875-.0546875zm6.609375 3.0625h.3203125c.0364583 0 .0546875.0182292.0546875.0546875l.1015625-.0546875h.0546875v.1640625h-.53125c-.0677083 0-.1015625-.0364583-.1015625-.109375zm1.4296875 0h.53125v.1640625h-.53125c-.0729167 0-.109375-.0364583-.109375-.109375zm-5.390625 2.9140625v2.6953125h.6875v-.796875c-.2135417-.84375-.4427083-1.4765625-.6875-1.8984375zm4.703125 1.421875v.1640625h.0546875c.0677083 0 .1015625-.0364583.1015625-.109375v-.15625h-.046875c-.0729167.0104167-.109375.0442708-.109375.1015625zm-.265625 1.2734375c0 .03125-.0182292.046875-.0546875.046875.2395833.6979167.4166667 1.0859375.53125 1.1640625l.265625-.8984375c-.0729167-.1145833-.109375-.203125-.109375-.265625z\"/><path d=\"m52.9375 16.1796875h3.6484375c.0729167 0 .1276042.1927083.1640625.578125h.578125c.0729167.015625.109375.0520833.109375.109375l-.1640625.109375c-.1197917-.0364583-.1901042-.0546875-.2109375-.0546875-.0625.0364583-.1328125.0546875-.2109375.0546875v-.0546875c-.0677083.0364583-.1197917.0546875-.15625.0546875v6.2421875c0 .0833333.140625.1354167.421875.15625.0625-.0364583.1328125-.0546875.2109375-.0546875 0 .015625.0364583.0677083.109375.15625v.1640625c0 .046875-.0546875.0989583-.1640625.15625h-.3125c-.109375 0-.1640625-.0182292-.1640625-.0546875l-.2578125.0546875h-.53125c-.0729167.0104167-.109375.046875-.109375.109375v.2109375c.0104167.0677083.046875.1015625.109375.1015625h1.109375v3.703125c0 .078125.0182292.1484375.0546875.2109375-.0572917.1770833-.1640625.265625-.3203125.265625 0-.0364583-.0182292-.0546875-.0546875-.0546875l-.046875.109375v1.53125c.0104167.0729167.0442708.109375.1015625.109375.0625-.0364583.1328125-.0546875.2109375-.0546875.0729167.1302083.109375.2708333.109375.421875l-.109375.0546875h-2.328125c-.296875 0-.7708333-.0182292-1.421875-.0546875v-.3125l-.375-.2109375c0-.0364583-.0182292-.0546875-.0546875-.0546875l.0546875-.375v-.3125c0-.0833333-.0182292-.1536458-.0546875-.2109375.0364583-.0625.0546875-.1328125.0546875-.2109375v-.265625c0-.0677083-.1588542-.15625-.4765625-.265625-.0364583-.0677083-.0546875-.1197917-.0546875-.15625.0572917-.1458333.1119792-.21875.1640625-.21875h.2109375c.0625 0 .1145833.1588542.15625.4765625h.265625c.0729167 0 .109375-.0338542.109375-.1015625v-3.9140625c0-.0729167-.0364583-.109375-.109375-.109375-.6197917-.0364583-.9895833-.0546875-1.109375-.0546875l-.0546875-.1015625v-.15625c0-.0520833.0520833-.1067708.15625-.1640625.0364583 0 .0546875.0182292.0546875.0546875l.109375-.0546875h1.109375c.0677083 0 .1015625-.0338542.1015625-.1015625v-.1640625l-.1015625-.15625-.375.0546875h-.1015625c-.0520833 0-.1041667-.0520833-.15625-.15625v-6.140625l.046875-.1015625c-.0520833-.0364583-.15625-.0546875-.3125-.0546875v-.109375h.265625v-.5234375c.0104167-.0729167.0442708-.109375.1015625-.109375zm.265625.6875c.0104167.0729167.046875.109375.109375.109375h.1015625c.0729167 0 .109375-.0364583.109375-.109375s-.0364583-.109375-.109375-.109375h-.1015625c-.0729167.015625-.109375.0520833-.109375.109375z\"/><path d=\"m58.9375 16.171875h8.7890625c.078125 0 .1484375.0182292.2109375.0546875.0625-.0364583.1328125-.0546875.2109375-.0546875.0729167.0885417.109375.1588542.109375.2109375l-.0546875.109375c.0364583.1822917.1067708.3229167.2109375.421875v2l-.0546875.1015625-.265625-.046875h-1.1015625l-.3203125.046875c-.0572917-.03125-.1432292-.046875-.2578125-.046875l-.3671875.046875c-.0625-.03125-.1328125-.046875-.2109375-.046875l-.109375.046875c-.0364583 0-.0546875-.015625-.0546875-.046875l-.2578125.046875h-.53125v1.84375c0 .0729167-.140625.1276042-.421875.1640625 0 .1354167-.0338542.203125-.1015625.203125h-.4765625c-.0677083.015625-.1015625.0520833-.1015625.109375.0104167.0677083.0442708.1015625.1015625.1015625h.53125l.1015625.0546875-.0546875.265625v.4765625l.3203125.2109375c0 .0677083-.2109375.1197917-.6328125.15625v3.1015625c0 .0989583-.1770833.1692708-.53125.2109375v.0546875h.796875c.2083333.09375.3125.1640625.3125.2109375v4.1640625c0 .0677083-.0338542.1015625-.1015625.1015625h-2.109375c-.3541667 0-.8802083-.0182292-1.578125-.0546875-.0364583-.6458333-.0546875-1.1197917-.0546875-1.421875v-2.84375c-.3177083-.0677083-.4765625-.1380208-.4765625-.2109375l-.1015625.0546875h-.4765625v-.0546875c.0104167-.0677083.046875-.1015625.109375-.1015625l.2578125.0546875c.0677083-.0364583.1223958-.0546875.1640625-.0546875v-3.1640625c.0104167-.0677083.0442708-.1015625.1015625-.1015625h.4765625v-.2109375c-.1770833 0-.265625-.0338542-.265625-.1015625v-.6875c0-.0729167-.0364583-.109375-.109375-.109375h-.46875c-.0729167 0-.109375-.0338542-.109375-.1015625.0104167-.0729167.046875-.109375.109375-.109375h.46875l.2109375-.2578125h.265625l.0546875-.4765625c0-.0677083-.0182292-.1015625-.0546875-.1015625l.0546875-.265625v-.84375c0-.1510417-.0703125-.2552083-.2109375-.3125-.0364583 0-.0546875.015625-.0546875.046875l-.265625-.046875h-3.046875c-.0729167 0-.109375-.0364583-.109375-.109375v-2c-.140625 0-.2109375-.0338542-.2109375-.1015625v-.0546875c0-.078125.0182292-.1484375.0546875-.2109375-.0364583-.0625-.0546875-.1328125-.0546875-.2109375.0364583 0 .0546875-.0182292.0546875-.0546875.7552083-.0364583 1.3177083-.0546875 1.6875-.0546875zm.46875 5.0546875h.109375c.0677083.015625.1015625.0520833.1015625.109375 0 .0677083-.0338542.1015625-.1015625.1015625h-.109375c-.0677083 0-.1015625-.0338542-.1015625-.1015625.0104167-.0729167.0442708-.109375.1015625-.109375zm1.4765625 4.1640625v.1015625h.0546875v-.1015625z\"/><path d=\"m68.7578125 16.171875h8.7890625c.078125 0 .1484375.0182292.2109375.0546875.0625-.0364583.1328125-.0546875.2109375-.0546875.0729167.0885417.109375.1588542.109375.2109375l-.0546875.109375c.0364583.1822917.1067708.3229167.2109375.421875v2l-.0546875.1015625-.265625-.046875h-1.1015625l-.3203125.046875c-.0572917-.03125-.1432292-.046875-.2578125-.046875l-.3671875.046875c-.0625-.03125-.1328125-.046875-.2109375-.046875l-.109375.046875c-.0364583 0-.0546875-.015625-.0546875-.046875l-.2578125.046875h-.53125v1.84375c0 .0729167-.140625.1276042-.421875.1640625 0 .1354167-.0338542.203125-.1015625.203125h-.4765625c-.0677083.015625-.1015625.0520833-.1015625.109375.0104167.0677083.0442708.1015625.1015625.1015625h.53125l.1015625.0546875-.0546875.265625v.4765625l.3203125.2109375c0 .0677083-.2109375.1197917-.6328125.15625v3.1015625c0 .0989583-.1770833.1692708-.53125.2109375v.0546875h.796875c.2083333.09375.3125.1640625.3125.2109375v4.1640625c0 .0677083-.0338542.1015625-.1015625.1015625h-2.109375c-.3541667 0-.8802083-.0182292-1.578125-.0546875-.0364583-.6458333-.0546875-1.1197917-.0546875-1.421875v-2.84375c-.3177083-.0677083-.4765625-.1380208-.4765625-.2109375l-.1015625.0546875h-.4765625v-.0546875c.0104167-.0677083.046875-.1015625.109375-.1015625l.2578125.0546875c.0677083-.0364583.1223958-.0546875.1640625-.0546875v-3.1640625c.0104167-.0677083.0442708-.1015625.1015625-.1015625h.4765625v-.2109375c-.1770833 0-.265625-.0338542-.265625-.1015625v-.6875c0-.0729167-.0364583-.109375-.109375-.109375h-.46875c-.0729167 0-.109375-.0338542-.109375-.1015625.0104167-.0729167.046875-.109375.109375-.109375h.46875l.2109375-.2578125h.265625l.0546875-.4765625c0-.0677083-.0182292-.1015625-.0546875-.1015625l.0546875-.265625v-.84375c0-.1510417-.0703125-.2552083-.2109375-.3125-.0364583 0-.0546875.015625-.0546875.046875l-.265625-.046875h-3.046875c-.0729167 0-.109375-.0364583-.109375-.109375v-2c-.140625 0-.2109375-.0338542-.2109375-.1015625v-.0546875c0-.078125.0182292-.1484375.0546875-.2109375-.0364583-.0625-.0546875-.1328125-.0546875-.2109375.0364583 0 .0546875-.0182292.0546875-.0546875.7552083-.0364583 1.3177083-.0546875 1.6875-.0546875zm.46875 5.0546875h.109375c.0677083.015625.1015625.0520833.1015625.109375 0 .0677083-.0338542.1015625-.1015625.1015625h-.109375c-.0677083 0-.1015625-.0338542-.1015625-.1015625.0104167-.0729167.0442708-.109375.1015625-.109375zm1.4765625 4.1640625v.1015625h.0546875v-.1015625z\"/><path d=\"m79.0625 16.15625h7.515625c.046875 0 .0989583.0520833.15625.15625v1.8046875c0 .046875.0520833.0989583.15625.15625h.2109375c.0833333 0 .15625-.0182292.21875-.0546875.171875.046875.2578125.0989583.2578125.15625v.109375c0 .0677083-.0338542.1015625-.1015625.1015625h-.265625v.265625c0 .0729167-.0364583.109375-.109375.109375h-3.6484375c-.3697917 0-.9322917.0182292-1.6875.0546875v.4765625c.0104167.0677083.0442708.1015625.1015625.1015625h.4765625c.0729167.0104167.109375.046875.109375.109375v2.2734375h4.6015625c.0677083.0104167.1015625.0442708.1015625.1015625v.796875c0 .0677083-.1927083.1197917-.578125.15625l-.109375-.0546875-.3125.0546875c-.0729167-.0364583-.1276042-.0546875-.1640625-.0546875l-.0546875.265625v.8984375l.0546875.53125-.15625.109375h-4.5c0 .1197917-.1223958.1901042-.3671875.2109375l-.3203125-.0546875h-.1015625c-.0729167.0104167-.109375.046875-.109375.109375v.046875h.3203125l.53125.0546875v1.75c0 .1875.1041667.2916667.3125.3125 0 .078125.0182292.1484375.0546875.2109375-.0364583.0625-.0546875.1328125-.0546875.2109375v.0546875h5.03125c.0677083 0 .1197917.1770833.15625.53125h.7890625c.0729167.0104167.109375.0442708.109375.1015625 0 .0729167-.0364583.109375-.109375.109375h-.578125l-.265625.0546875v2.0078125h-8.671875c-.0364583 0-.0546875-.0182292-.0546875-.0546875l-.109375.0546875h-.3125c-.0520833 0-.1067708-.0520833-.1640625-.15625v-.109375c0-.0364583.0182292-.0546875.0546875-.0546875l-.0546875-.1015625v-1.2734375l-.265625-.046875h-.46875c-.0729167 0-.109375-.0364583-.109375-.109375v-.109375c.0104167-.0677083.046875-.1015625.109375-.1015625.5885417-.0364583 1.046875-.0546875 1.375-.0546875h.2109375v-.1015625l-.53125-.0546875h-.2109375c-.0729167 0-.109375-.0520833-.109375-.15625l.0546875-.109375c-.0364583-.0625-.0546875-.1328125-.0546875-.2109375 0-.046875.1067708-.0989583.3203125-.15625.0364583-.0625.0546875-.1354167.0546875-.21875 0-.1510417-.125-.2369792-.375-.2578125v-1.8046875l.0546875-.1015625-.1015625-.0546875h-.6875c-.0729167 0-.109375-.0338542-.109375-.1015625.0104167-.0729167.046875-.109375.109375-.109375h.6328125c.0677083 0 .1015625-.0364583.1015625-.109375v-1.7421875c0-.0729167.0546875-.109375.1640625-.109375s.4427083-.015625 1-.046875v-3.2265625c0-.109375-.1927083-.1640625-.578125-.1640625h-.109375v-.84375l.375-.2109375v-.109375c0-.0677083-.0364583-.1015625-.109375-.1015625h-.6328125c-.0729167 0-.109375-.0364583-.109375-.109375v-1.8515625l.0546875-.1015625c.7083333-.0364583 1.2369792-.0546875 1.5859375-.0546875zm-2.0078125 6.3515625h.265625c.0677083.0104167.1015625.0442708.1015625.1015625v.265625c0 .0677083-.0338542.1015625-.1015625.1015625h-.265625c-.0729167 0-.109375-.0338542-.109375-.1015625v-.265625c.015625-.0677083.0520833-.1015625.109375-.1015625zm1.90625 5.8671875h.4765625v-.1015625h-.375c-.0677083.0104167-.1015625.0442708-.1015625.1015625zm5.7109375.0546875v.2109375c.0104167.0729167.046875.109375.109375.109375h.734375c0-.0416667.0182292-.0963542.0546875-.1640625-.0364583-.0677083-.0546875-.1197917-.0546875-.15625z\"/><path d=\"m88.3515625 16.15625c.0677083 0 .1015625.0182292.1015625.0546875.53125-.0364583.921875-.0546875 1.171875-.0546875h3.703125c1.34375 0 2.2447917.1223958 2.703125.3671875.3177083.09375.5130208.2005208.5859375.3203125-.0364583.0625-.0546875.1328125-.0546875.2109375.5520833.265625 1.0286458.8489583 1.4296875 1.75.25.75.375 1.3151042.375 1.6953125 0 .1302083-.0520833.5546875-.15625 1.2734375.2083333 0 .3125.0364583.3125.109375-.4010417 1.0989583-1.0364583 1.9114583-1.90625 2.4375l-.796875.3125v.0546875c.0833333.078125.2786458.3619792.5859375.8515625-.1145833.0677083-.203125.1015625-.265625.1015625l.0546875.109375v.0546875c-.640625.03125-1.0651042.046875-1.2734375.046875v.0546875c.0104167.0729167.046875.109375.109375.109375h1.3203125l.4765625.578125c.3489583 0 .578125.1770833.6875.53125v.0546875c-.1770833 0-.265625.0364583-.265625.109375 1.0989583 1.578125 1.6484375 2.390625 1.6484375 2.4375-.140625.0260417-.2109375.0598958-.2109375.1015625.2447917.3697917.3671875.5833333.3671875.640625l-.1015625.046875h-2.65625c-.296875 0-.7734375-.015625-1.4296875-.046875-.28125-.4010417-.421875-.6145833-.421875-.640625.0572917-.0364583.1458333-.0546875.265625-.0546875v-.046875c-1.0260417-1.5572917-1.5390625-2.40625-1.5390625-2.546875h.2109375v-.109375c-.109375-.3489583-.3203125-.5234375-.6328125-.5234375-.2760417-.3541667-.4895833-.53125-.640625-.53125h-.953125v.265625c0 .03125-.015625.046875-.046875.046875l.046875.109375v2.4375h.5859375c.0729167.0104167.109375.046875.109375.109375 0 .0677083-.0364583.1015625-.109375.1015625h-.5859375c0 .1770833-.015625.265625-.046875.265625l.046875.109375v.6328125c0 .078125-.015625.1484375-.046875.2109375.03125.0677083.046875.1223958.046875.1640625l-.1015625.046875h-2.171875c-.3541667 0-.8854167-.015625-1.59375-.046875v-1.2734375c.0104167-.0729167.046875-.109375.109375-.109375h.578125v-.15625h-.578125c-.0729167 0-.109375-.0364583-.109375-.109375v-2.75l-.265625-.0546875h-1.0546875c-.0729167 0-.109375-.0364583-.109375-.109375l.109375-.0546875c.8802083-.015625 1.3203125-.0494792 1.3203125-.1015625 0-.109375.0364583-.1640625.109375-.1640625.0677083.0364583.1197917.0546875.15625.0546875l.0546875-.1015625v-3.609375c.0104167-.0677083.0442708-.1015625.1015625-.1015625h.265625l.0546875-.3203125c-.0677083-.0364583-.1197917-.0546875-.15625-.0546875-.3125.0364583-.4895833.0546875-.53125.0546875 0-.28125-.140625-.421875-.421875-.421875v-.265625l.3671875-.2109375v-3.5546875l.3203125-.2109375v-.53125c.0104167-.0677083.0442708-.1015625.1015625-.1015625h.375c.1197917 0 .2083333-.0182292.265625-.0546875zm2.8046875 2.8125c0 .03125-.015625.046875-.046875.046875.03125.3541667.046875.6197917.046875.796875v.3203125c0 .0364583-.015625.0546875-.046875.0546875l.046875.1015625v.0546875c0 .3177083-.140625.4765625-.421875.4765625v.3203125c.28125.0208333.421875.0729167.421875.15625h-.046875c.03125.0677083.046875.1197917.046875.15625h1.2734375v.109375h-.4765625l-.2109375.265625h-.265625v.53125h1.640625c.7135417 0 1.1927083-.1770833 1.4375-.53125.3489583 0 .5234375-.125.5234375-.375h-.4765625l-.1015625-.046875c.0677083-.2447917.1015625-.4583333.1015625-.640625v-.421875c0-.3697917-.3177083-.7760417-.953125-1.21875-.078125-.0729167-.4296875-.125-1.0546875-.15625l-.109375.046875-.109375-.046875c-.03125 0-.046875.015625-.046875.046875-.125-.03125-.1979167-.046875-.21875-.046875-.3072917.03125-.4817708.046875-.5234375.046875-.1979167-.03125-.3411458-.046875-.4296875-.046875zm-3.015625 2.5390625v.0546875h.1015625v-.0546875zm.265625 0v.0546875h.1015625v-.0546875zm10.015625-.0546875h.15625v.109375h-.15625zm.3671875 0h.1640625v.109375h-.1640625zm.265625 0h.4765625v.109375h-.4765625zm-7.734375 4.1875-.109375-.0546875c0 .0729167-.0338542.109375-.1015625.109375.03125.0677083.046875.1197917.046875.15625.3541667-.03125.6197917-.046875.796875-.046875h.0546875l.1015625.046875.21875-.3671875c-.140625-.3177083-.2291667-.4765625-.265625-.4765625h-.4765625c-.0729167 0-.1276042.2109375-.1640625.6328125zm-1.59375.2109375v.0546875c.0104167.0729167.046875.109375.109375.109375h.953125c.0677083 0 .1015625-.0364583.1015625-.109375v-.0546875zm4.2421875 3.9765625h.1015625c0 .0572917.0364583.1276042.109375.2109375v.109375c-.046875-.0052083-.1171875-.09375-.2109375-.265625zm.3671875.53125h.0546875v.109375h-.0546875z\"/></g></g><circle cx=\"245.1\" cy=\"244.2\" fill=\"#fff\" r=\"11\" stroke=\"#323232\" stroke-width=\"2\"/><g fill=\"#fff\" transform=\"translate(-2)\"><path d=\"m244.1 448.2c-112.8 0-204-91.2-204-204 0-4 3.2-8 8-8 4 0 8 3.2 8 8-.8 104 84 188.8 188 188.8 4 0 8 3.2 8 8 0 4-4 7.2-8 7.2z\"/><path d=\"m440.9 252.2c-4 0-8-3.2-8-8 0-104-84.8-188.8-188.8-188.8-4 0-8-3.2-8-8 0-4 3.2-8 8-8 112.8 0 204 92 204 204 0 4.8-3.2 8.8-7.2 8.8z\"/><path d=\"m244.1 401c-86.4 0-156.8-70.4-156.8-156.8 0-4 3.2-8 8-8 4 0 8 3.2 8 8 0 77.6 63.2 141.6 141.6 141.6 4 0 8 3.2 8 8-.8 4-4.8 7.2-8.8 7.2z\"/><path d=\"m392.9 252.2c-4 0-8-3.2-8-8 0-77.6-63.2-141.6-141.6-141.6-4 0-8-3.2-8-8 0-4 3.2-8 8-8 86.4 0 156.8 70.4 156.8 156.8.8 4.8-2.4 8.8-7.2 8.8z\"/></g></g></svg>";

        const widgetCss = "/* --- VARIABLES --- */\n\n:root {\n  --ds-gap: 20px;\n  --ds-radius: 12px;\n  --ds-color-white: #fafafa;\n  --ds-color-black: #212121;\n  --ds-color-gray: #666;\n  --ds-color-gray-dark: #333;\n  --ds-color-gray-light: #eee;\n  --ds-color-primary: #148a66;\n  --ds-color-success: #28a745;\n  --ds-color-error: #dc3545;\n  --ds-color-warning: #ffc107;\n  --ds-color-info: #17a2b8;\n  --ds-font-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;\n  --ds-font-monospace: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;\n}\n\n/* --- RESET --- */\n\n.discogs-submitter {\n  *,\n  *::after,\n  *::before {\n    color-scheme: light;\n    -webkit-font-smoothing: antialiased;\n    -moz-osx-font-smoothing: grayscale;\n    text-rendering: optimizeLegibility;\n    box-sizing: border-box;\n  }\n\n  em {\n    font-style: oblique;\n  }\n\n  strong {\n    font-weight: bold;\n  }\n\n  [hidden] {\n    display: none !important;\n  }\n}\n\n/* --- WIDGET --- */\n\n.discogs-submitter {\n  contain: layout;\n  overflow: hidden;\n  display: none;\n  flex-direction: column;\n  justify-content: start;\n  gap: var(--ds-gap);\n  position: fixed;\n  z-index: 999999;\n  top: var(--ds-gap);\n  right: var(--ds-gap);\n  width: calc(100% - (var(--ds-gap) * 2));\n  max-width: 500px;\n  padding: var(--ds-gap);\n  color: var(--ds-color-black);\n  font-family: var(--ds-font-sans) !important;\n  font-size: 14px;\n  font-weight: normal;\n  line-height: 1.2;\n  text-transform: none;\n  text-shadow: none;\n  background: var(--ds-color-white);\n  border: 2px solid var(--ds-color-gray-dark);\n  border-radius: var(--ds-radius);\n  outline: 2px solid var(--ds-color-white);\n  opacity: 0;\n  transition:\n    opacity 0.3s ease,\n    box-shadow 0.6s ease;\n\n  &.is-open {\n    display: flex;\n    opacity: 1;\n    box-shadow:\n      0 0 10px rgba(0, 0, 0, 0.6),\n      0 0 30px rgba(0, 0, 0, 0.8);\n  }\n\n  &.is-webarchive {\n    top: calc(var(--wm-toolbar-height) + var(--ds-gap));\n  }\n}\n\n.discogs-submitter__loader {\n  position: absolute;\n  z-index: -1;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  opacity: 0;\n  transition: opacity 0.8s ease;\n\n  &.is-loading {\n    z-index: 10;\n    opacity: 1;\n  }\n\n  &::before {\n    content: '';\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background: var(--ds-color-white);\n    opacity: 0.75;\n  }\n\n  svg {\n    width: 70px;\n    height: 70px;\n    animation: ds-spinner 0.5s linear infinite;\n  }\n}\n\n.discogs-submitter__content {\n  max-height: 60vh;\n  overflow: auto;\n  -webkit-overflow-scrolling: touch;\n}\n\n.discogs-submitter__header {\n  --icon-size: 24px;\n  display: flex;\n  align-items: center;\n  gap: calc(var(--ds-gap) / 2);\n  font-size: 20px;\n  font-weight: 600;\n}\n\n.discogs-submitter__header__logo {\n  flex: 0 0 auto;\n  width: 1.25em;\n  height: 1.25em;\n}\n\n.discogs-submitter__header__title {\n  small {\n    font-size: 8px;\n  }\n}\n\n.discogs-submitter__header__drag-btn,\n.discogs-submitter__header__close-btn {\n  width: var(--icon-size);\n  height: var(--icon-size);\n}\n\n.discogs-submitter__header__drag-btn {\n  margin-left: auto;\n  display: flex;\n  align-items: center;\n  justify-content: space-evenly;\n  flex-direction: column;\n  cursor: grab;\n}\n\n.discogs-submitter__header__drag-btn {\n  &::before,\n  &::after {\n    content: '';\n    width: 6px;\n    height: 6px;\n    background-color: currentColor;\n    border-radius: 100%;\n    transition: background-color 0.3s ease;\n  }\n\n  &:hover::before,\n  &:hover::after {\n    background-color: var(--ds-color-info);\n  }\n\n  &.is-draggable {\n    cursor: grabbing;\n  }\n}\n\n.discogs-submitter__header__close-btn {\n  position: relative;\n  z-index: 1;\n  cursor: pointer;\n\n  &::before,\n  &::after {\n    position: absolute;\n    z-index: 1;\n    left: calc(var(--icon-size) / 2 - 1px);\n    content: ' ';\n    height: var(--icon-size);\n    width: 3px;\n    background-color: currentColor;\n    transition: background-color 0.3s ease;\n  }\n\n  &::before {\n    transform: rotate(45deg);\n  }\n\n  &::after {\n    transform: rotate(-45deg);\n  }\n\n  &:hover::before,\n  &:hover::after {\n    background-color: var(--ds-color-error);\n  }\n}\n\n.discogs-submitter__preview-container {\n  overflow: auto;\n  max-height: 330px;\n  background:\n    linear-gradient(var(--ds-color-white) 30%, rgba(0, 0, 0, 0)),\n    linear-gradient(rgba(0, 0, 0, 0), var(--ds-color-white) 70%) 0 100%,\n    radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)),\n    radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)) 0 100%;\n  background-repeat: no-repeat;\n  background-size:\n    100% 40px,\n    100% 40px,\n    100% 20px,\n    100% 20px;\n  background-attachment: local, local, scroll, scroll;\n  scrollbar-width: thin;\n  scrollbar-color: var(--ds-color-gray-dark) transparent;\n\n  &::-webkit-scrollbar {\n    width: 6px;\n  }\n}\n\n.discogs-submitter__results {\n  display: flex;\n  flex-wrap: wrap;\n  font-family: var(--ds-font-monospace);\n  font-size: 10px;\n  line-height: normal;\n}\n\n.discogs-submitter__results__row {\n  width: 100%;\n  display: grid;\n  gap: calc(var(--ds-gap) / 4);\n  grid-template-columns: 60px 1fr;\n  padding: 2px 0;\n  border-bottom: 1px dotted rgba(0, 0, 0, 0.2);\n\n  &:hover {\n    background: rgba(0, 0, 0, 0.05);\n  }\n\n  &.is-half {\n    width: 50%;\n  }\n\n  &.is-tracklist {\n    grid-template-columns: 20px 1fr 1fr 50px;\n\n    &.is-no-artist {\n      grid-template-columns: 20px 1fr 50px;\n    }\n\n    > .discogs-submitter__results__body:last-child {\n      text-align: right;\n    }\n  }\n\n  &.is-notes {\n    grid-template-columns: 1fr;\n  }\n}\n\n.discogs-submitter__results__head {\n  font-weight: bold;\n}\n\n.discogs-submitter__results__body {\n  em {\n    font-style: normal;\n    padding: 2px 4px;\n    display: inline-block;\n    vertical-align: baseline;\n    background: var(--ds-color-gray-light);\n    border-radius: calc(var(--ds-radius) / 4);\n    outline: 0.1px solid var(--ds-color-gray);\n  }\n\n  small {\n    font-size: 9px;\n  }\n\n  label {\n    display: inline-flex;\n    align-items: center;\n    gap: calc(var(--ds-gap) / 4);\n    vertical-align: middle;\n    color: var(--ds-color-white);\n    margin: 0;\n    padding: 2px 5px;\n    background: var(--ds-color-gray-dark);\n    border-radius: calc(var(--ds-radius) / 2);\n    cursor: pointer;\n    transition: background 0.3s ease;\n  }\n\n  input[type='radio'],\n  input[type='checkbox'] {\n    position: absolute;\n    z-index: -1;\n    width: 1px;\n    height: 1px;\n    opacity: 0;\n  }\n\n  input[type='radio']:checked + label,\n  input[type='checkbox']:checked + label {\n    background: var(--ds-color-primary);\n  }\n\n  input[type='radio']:checked + label::before,\n  input[type='checkbox']:checked + label::before {\n    content: '';\n    width: 8px;\n    height: 5px;\n    margin-top: -2px;\n    border: solid currentColor;\n    border-width: 0 0 2px 2px;\n    transform: rotate(-45deg);\n  }\n\n  input[type=\"radio\"]:disabled + label,\n  input[type=\"checkbox\"]:disabled + label {\n    opacity: 0.5;\n    cursor: not-allowed;\n  }\n}\n\n.discogs-submitter__status-container {\n  --status-color: var(--ds-color-gray-dark);\n  position: relative;\n  z-index: 1;\n  display: flex;\n  justify-content: space-between;\n  align-items: start;\n  gap: var(--ds-gap);\n  margin-bottom: var(--ds-gap);\n  padding: calc(var(--ds-gap) / 2);\n  border-left: 4px solid var(--status-color);\n  border-radius: calc(var(--ds-radius) / 2);\n  transition: border-color 0.3s ease;\n\n  &::after {\n    content: '';\n    position: absolute;\n    z-index: -1;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background: var(--status-color);\n    opacity: 0.1;\n    transition: background 0.3s ease;\n  }\n\n  &.is-success {\n    --status-color: var(--ds-color-success);\n  }\n\n  &.is-error {\n    --status-color: var(--ds-color-error);\n  }\n\n  &.is-info {\n    --status-color: var(--ds-color-info);\n  }\n\n  &.is-warning {\n    --status-color: var(--ds-color-warning);\n  }\n}\n\n.discogs-submitter__status-debug-btn {\n  font-size: 18px;\n  cursor: pointer;\n}\n\n.discogs-submitter__actions {\n  display: flex;\n  flex-wrap: nowrap;\n  gap: var(--ds-gap);\n}\n\n.discogs-submitter__actions__btn-submit {\n  display: block;\n  width: 100%;\n  color: var(--ds-color-white);\n  font-size: 16px;\n  font-weight: bold;\n  text-align: center;\n  padding: calc(var(--ds-gap) / 2) calc(var(--ds-gap) / 4);\n  background: var(--ds-color-primary);\n  border-radius: calc(var(--ds-radius) / 2);\n  cursor: pointer;\n  transition:\n    background 0.3s ease,\n    opacity 0.3s ease;\n  user-select: none;\n\n  &:hover {\n    background: var(--ds-color-black);\n  }\n\n  &.is-disabled {\n    opacity: 0.5;\n    pointer-events: none;\n  }\n}\n\n.discogs-submitter__copyright {\n  display: flex;\n  justify-content: center;\n  gap: var(--ds-gap);\n  font-size: 10px;\n  margin: var(--ds-gap) 0 0;\n\n  a {\n    color: currentColor;\n    text-decoration: none;\n\n    &:hover {\n      text-decoration: underline;\n    }\n  }\n\n  span {\n    display: inline-block;\n    vertical-align: middle;\n    font-family: var(--ds-font-monospace);\n    color: var(--ds-color-error);\n    animation: ds-pulse 1s ease-in-out infinite;\n  }\n}\n\n@keyframes ds-spinner {\n  0% {\n    transform: rotate(0);\n  }\n\n  100% {\n    transform: rotate(360deg);\n  }\n}\n\n@keyframes ds-pulse {\n  0% {\n    transform: scale(1);\n  }\n\n  50% {\n    transform: scale(1.2);\n  }\n\n  100% {\n    transform: scale(1);\n  }\n}\n";

        const DiscogsAdapter = {
            buildPayload: (data, sourceUrl, options) => {
                const { format = "WAV", isHdAudio = false } = options || {};
                const releaseArtistsArr = data.artists || [];
                const tracks = data.tracks || [];
                const firstTrackArtists = tracks[0]?.artists || [];
                const allTracksShareSameArtists = tracks.length > 0 && tracks.every((track) => {
                    const trackArtists = track.artists || [];
                    if (trackArtists.length !== firstTrackArtists.length) {
                        return false;
                    }
                    return trackArtists.every((artist, index) => artist.name === firstTrackArtists[index].name && artist.join === firstTrackArtists[index].join);
                });
                let finalReleaseArtists = releaseArtistsArr;
                if (allTracksShareSameArtists && firstTrackArtists.length > 0) {
                    finalReleaseArtists = firstTrackArtists;
                }
                const primaryArtistName = (finalReleaseArtists[0]?.name || "").trim();
                const allTracksMatchRelease = tracks.length > 0 && tracks.every((track) => {
                    const trackArtists = track.artists || [];
                    if (trackArtists.length !== finalReleaseArtists.length) {
                        return false;
                    }
                    const trackArtistNames = trackArtists.map((artist) => (artist.name || "").trim().toLowerCase()).sort();
                    const releaseArtistNames = finalReleaseArtists.map((artist) => (artist.name || "").trim().toLowerCase()).sort();
                    return JSON.stringify(trackArtistNames) === JSON.stringify(releaseArtistNames);
                });
                const labelName = data.label && primaryArtistName && data.label === primaryArtistName ? `Not On Label (${primaryArtistName} Self-released)` : data.label || "Not On Label";
                let formatText = "";
                if (format === "MP3") {
                    formatText = "320 kbps";
                } else if (isHdAudio) {
                    formatText = "24-bit";
                }
                const totalTracks = data.tracks?.length ? `${data.tracks.length}` : "1";
                const validBpmTracks = (data.tracks || []).filter((track) => track.bpm);
                const infoBpm = validBpmTracks.length > 0 ? `BPM's:
${validBpmTracks.map((track) => `${track.position}: ${track.bpm}`).join("\n")}` : "";
                let finalArtists = finalReleaseArtists;
                if ((!finalArtists.length || finalArtists[0]?.name === "") && tracks.length > 1) {
                    const uniqueArtists = new Set(tracks.map((t) => (t.artists?.[0]?.name || "").toLowerCase()).filter(Boolean));
                    if (uniqueArtists.size >= 4) {
                        finalArtists = [{ name: "Various", join: "," }];
                    }
                }
                const payload = {
                    cover: data.cover || null,
                    title: data.title || "",
                    artists: finalArtists.length ? finalArtists : [{ name: "", join: "," }],
                    extraartists: groupExtraArtists(data.extraartists || []),
                    country: data.country || "Worldwide",
                    released: data.released || "",
                    labels: labelName ? [{ name: labelName, catno: data.number || "none" }] : [{ name: "", catno: "" }],
                    format: [{ name: "File", qty: totalTracks, desc: [format], text: formatText }],
                    tracks: (data.tracks || []).map((track) => ({
                        pos: track.position || "",
                        artists: allTracksMatchRelease ? [] : track.artists || [],
                        extraartists: groupExtraArtists(track.extraartists || []),
                        title: track.title || "",
                        duration: track.duration || ""
                    })),
                    notes: infoBpm
                };
                return {
                    _previewObject: payload,
                    full_data: JSON.stringify(payload),
                    sub_notes: `${sourceUrl}
---
A digital release in ${format} format has been added.`
                };
            }
        };

        let widgetTemplate = null;
        function getWidgetTemplate() {
            if (!widgetTemplate) {
                widgetTemplate = document.createElement("template");
                widgetTemplate.innerHTML = `
      <div class="discogs-submitter__header">
        <svg class="discogs-submitter__header__logo" aria-hidden="true"><use href="#icon-logo"></use></svg>
        <span class="discogs-submitter__header__title">${GM_info?.script?.name || ""} <small>v${GM_info?.script?.version || ""}</small></span>
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
          <a href="${GM_info?.script?.homepage || ""}" target="_blank">Homepage</a>
          <a href="${GM_info?.script?.supportURL || ""}" target="_blank">Report Bug</a>
          <a href="https://buymeacoffee.com/denis_g" target="_blank">Made with <span>♥</span> for music</a>
        </div>
      </div>
      <div class="discogs-submitter__loader">
        <svg class="discogs-submitter__loader__logo" aria-hidden="true"><use href="#icon-logo"></use></svg>
      </div>
    `.trim();
            }
            return widgetTemplate;
        }
        const Renderer = {
            renderRow: (label, value, extraClass = "") => `
    <div class="discogs-submitter__results__row ${extraClass}">
      <div class="discogs-submitter__results__head">${label}</div>
      <div class="discogs-submitter__results__body">${value}</div>
    </div>
  `,
            renderTracklist: (tracks) => {
                const hasTrackArtists = tracks.some((t) => t.artists?.length > 0);
                const rowBaseClass = hasTrackArtists ? "" : "is-no-artist";
                let html = `
      <div class="discogs-submitter__results__row is-tracklist ${rowBaseClass}">
        <div class="discogs-submitter__results__head">#</div>
        ${hasTrackArtists ? '<div class="discogs-submitter__results__head">Artist</div>' : ""}
        <div class="discogs-submitter__results__head">Title</div>
        <div class="discogs-submitter__results__head">Duration</div>
      </div>
    `;
                if (!tracks.length) {
                    return `
        ${html}
        <div class="discogs-submitter__results__row">
          <div class="discogs-submitter__results__body">⚠️ No tracks found.</div>
        </div>
      `;
                }
                tracks.forEach((track) => {
                    const trackArtists = (track.artists || []).map((a, i, all) => `<em>${a.name}</em>${a.join && i < all.length - 1 ? ` ${a.join} ` : ""}`).join("");
                    const trackExtraArtists = (track.extraartists || []).map((a) => `${a.role} – <em>${a.name}</em>`).join("<br />");
                    html += `
        <div class="discogs-submitter__results__row is-tracklist ${rowBaseClass}">
          <div class="discogs-submitter__results__body">${track.position || track.pos || "⚠️"}</div>
          ${hasTrackArtists ? `<div class="discogs-submitter__results__body">${trackArtists}</div>` : ""}
          <div class="discogs-submitter__results__body">
            <div>${track.title || "⚠️"}</div>
            ${trackExtraArtists ? `<small>${trackExtraArtists}</small>` : ""}
          </div>
          <div class="discogs-submitter__results__body">${track.duration || "⚠️"}</div>
        </div>
      `;
                });
                return html;
            },
            releasePreview: (release, options) => {
                const { selectedFormat, isHdAudio, supports } = options;
                const availableFormats = supports.formats || [];
                const canHaveHdAudio = selectedFormat !== "MP3" && !!supports.hdAudio;
                const artists = (release.artists || []).map((artist, i, all) => `<em>${artist.name}</em>${artist.join && i < all.length - 1 ? ` ${artist.join} ` : ""}`).join("") || "⚠️";
                const extraArtists = (release.extraartists || []).map((artist) => `${artist.role} – <em>${artist.name}</em>`).join("<br />");
                const formatLabel = (release.format || []).map((format) => `${format.name}, Qty: ${format.qty}`).join(", ") || "⚠️";
                let formatSelectionHtml = "";
                if (release.format?.some((format) => format.name === "File")) {
                    const types = availableFormats.map((format) => `
          <input type="radio" id="ds[format][${format.toLowerCase()}]" name="ds[format]" tabindex="-1" value="${format}" class="is-format" ${selectedFormat === format ? "checked" : ""} />
          <label for="ds[format][${format.toLowerCase()}]">${format}</label>
        `).join("");
                    const hdAudio = supports.hdAudio ? `
          <input type="checkbox" id="ds[format][hdAudio]" tabindex="-1" class="is-hdaudio" ${isHdAudio ? "checked" : ""} ${!canHaveHdAudio ? "disabled" : ""} />
          <label for="ds[format][hdAudio]">24-bit</label>` : "";
                    formatSelectionHtml = `, Type: ${types}${hdAudio}`;
                }
                return `
      <div class="discogs-submitter__results">
        ${Renderer.renderRow("Artist", artists)}
        ${Renderer.renderRow("Title", release.title || "⚠️")}
        ${Renderer.renderRow("Label", release.labels?.[0]?.name || "⚠️")}
        ${Renderer.renderRow("Catalog", release.labels?.[0]?.catno || "⚠️")}
        ${Renderer.renderRow("Released", release.released || "⚠️", "is-half")}
        ${Renderer.renderRow("Country", release.country || "–", "is-half")}
        ${Renderer.renderRow("Format", `${formatLabel}${formatSelectionHtml}`)}
        ${Renderer.renderTracklist(release.tracks || [])}
        ${extraArtists ? Renderer.renderRow("Credits", extraArtists, "is-notes") : ""}
        ${release.notes ? Renderer.renderRow("Notes", release.notes.replace(/\n/g, "<br />"), "is-notes") : ""}
      </div>
    `;
            }
        };
        class UiWidget {
            WIDGET_ID;
            ui = {};
            state = {
                currentDigitalStore: null,
                currentPayload: null,
                lastRawData: null,
                selectedFormat: null,
                isHdAudio: false,
                isDragging: false,
                offset: { x: 0, y: 0 }
            };
            constructor() {
                this.WIDGET_ID = GM_info.script.namespace || "discogs-submitter";
                this.handleMouseMove = this.handleMouseMove.bind(this);
                this.handleMouseUp = this.handleMouseUp.bind(this);
            }
            injectStyles() {
                if (!document.getElementById(`${this.WIDGET_ID}-styles`)) {
                    const style = document.createElement("style");
                    style.id = `${this.WIDGET_ID}-styles`;
                    style.textContent = widgetCss;
                    document.head.appendChild(style);
                }
            }
            buildSvgSprite() {
                if (document.getElementById(`${this.WIDGET_ID}-svg-sprite`)) {
                    return;
                }
                const svgSprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svgSprite.id = `${this.WIDGET_ID}-svg-sprite`;
                svgSprite.style.display = "none";
                const rawIcons = {
                    "icon-logo": iconMain
                };
                let symbolsHtml = "";
                Object.entries(rawIcons).forEach(([iconId, svgString]) => {
                    if (!svgString) {
                        return;
                    }
                    const viewBoxMatch = svgString.match(/viewBox=["']([^"']+)["']/i);
                    const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 1024 1024";
                    const innerMatch = svgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
                    if (innerMatch && innerMatch[1]) {
                        const innerContent = innerMatch[1].trim();
                        symbolsHtml += `<symbol id="${iconId}" viewBox="${viewBox}">${innerContent}</symbol>`;
                    }
                });
                svgSprite.innerHTML = symbolsHtml;
                document.body.appendChild(svgSprite);
            }
            buildPopup() {
                if (document.getElementById(this.WIDGET_ID)) {
                    return;
                }
                const container = document.createElement("aside");
                const isWebArchive = window.location.href.includes("https://web.archive.org/web/");
                container.id = this.WIDGET_ID;
                container.className = `${container.id} ${isWebArchive ? "is-webarchive" : ""}`;
                const template = getWidgetTemplate();
                container.appendChild(template.content.cloneNode(true));
                document.body.appendChild(container);
                this.ui.widget = container;
                this.ui.header = container.querySelector(".discogs-submitter__header");
                this.ui.headerDragBtn = container.querySelector(".discogs-submitter__header__drag-btn");
                this.ui.headerCloseBtn = container.querySelector(".discogs-submitter__header__close-btn");
                this.ui.statusContainer = container.querySelector(".discogs-submitter__status-container");
                this.ui.statusText = container.querySelector(".discogs-submitter__status-text");
                this.ui.statusDebugCopyBtn = container.querySelector(".discogs-submitter__status-debug-btn");
                this.ui.previewContainer = container.querySelector(".discogs-submitter__preview-container");
                this.ui.actionsSubmitBtn = container.querySelector(".discogs-submitter__actions__btn-submit");
                this.ui.loader = container.querySelector(".discogs-submitter__loader");
            }
            open(store) {
                this.state.currentDigitalStore = store;
                if (this.ui.widget) {
                    this.ui.widget.classList.add("is-open");
                    this.executeParsing();
                }
            }
            reset() {
                if (this.ui.widget) {
                    this.ui.widget.classList.remove("is-open");
                }
                this.state.currentPayload = null;
                this.state.lastRawData = null;
                if (this.ui.previewContainer) {
                    this.ui.previewContainer.innerHTML = "";
                }
                this.setStatus("Ready to parse...", "info");
                if (this.ui.actionsSubmitBtn) {
                    this.ui.actionsSubmitBtn.hidden = true;
                }
                if (this.ui.statusDebugCopyBtn) {
                    this.ui.statusDebugCopyBtn.hidden = true;
                }
            }
            setLoader(isActive) {
                this.ui.loader?.classList.toggle("is-loading", isActive);
            }
            setStatus(message, status = "info") {
                if (this.ui.statusText) {
                    this.ui.statusText.innerHTML = message;
                }
                if (this.ui.statusContainer) {
                    this.ui.statusContainer.classList.remove("is-error", "is-success", "is-info", "is-warning");
                    this.ui.statusContainer.classList.add(`is-${status}`);
                }
            }
            async executeParsing() {
                if (!this.state.currentDigitalStore) {
                    return;
                }
                this.setStatus("Parsing current release...", "info");
                this.setLoader(true);
                if (this.ui.statusDebugCopyBtn) {
                    this.ui.statusDebugCopyBtn.hidden = true;
                }
                if (this.ui.actionsSubmitBtn) {
                    this.ui.actionsSubmitBtn.hidden = true;
                }
                if (this.ui.previewContainer) {
                    this.ui.previewContainer.innerHTML = "";
                }
                if (this.ui.statusContainer) {
                    delete this.ui.statusContainer.dataset.rawJson;
                }
                try {
                    this.state.lastRawData = await this.state.currentDigitalStore.parse();
                    this.state.selectedFormat = this.state.currentDigitalStore.supports?.formats?.[0] || "WAV";
                    this.state.isHdAudio = false;
                    this.renderPayload();
                    const storeWarning = this.getStoreWarning();
                    const successMsg = storeWarning ? `Parsed successfully! Ready to submit.<br />${storeWarning}` : "Parsed successfully! Ready to submit.";
                    this.setStatus(successMsg, "success");
                } catch (error) {
                    this.state.currentPayload = null;
                    this.state.lastRawData = null;
                    const errMsg = error.message || String(error);
                    this.setStatus(errMsg, "error");
                    if (this.ui.statusContainer) {
                        this.ui.statusContainer.dataset.rawJson = `URL: ${window.location.href}
Version: ${GM_info.script.version}
Error Trace:
${error.stack || error}`;
                    }
                    if (this.ui.statusDebugCopyBtn) {
                        this.ui.statusDebugCopyBtn.hidden = false;
                    }
                } finally {
                    this.setLoader(false);
                }
            }
            renderPayload() {
                if (!this.state.lastRawData || !this.state.currentDigitalStore) {
                    return;
                }
                const effectiveHdAudio = this.state.selectedFormat !== "MP3" && this.state.isHdAudio && this.state.currentDigitalStore.supports?.hdAudio;
                this.state.currentPayload = DiscogsAdapter.buildPayload(this.state.lastRawData, window.location.href, {
                    format: this.state.selectedFormat || "WAV",
                    isHdAudio: effectiveHdAudio
                });
                const previewObj = this.state.currentPayload._previewObject;
                const rawJsonString = JSON.stringify(previewObj, null, 2);
                if (this.ui.previewContainer) {
                    this.ui.previewContainer.innerHTML = Renderer.releasePreview(previewObj, {
                        selectedFormat: this.state.selectedFormat || "WAV",
                        isHdAudio: effectiveHdAudio,
                        supports: this.state.currentDigitalStore.supports || { formats: [], hdAudio: false }
                    });
                }
                if (this.ui.statusContainer) {
                    this.ui.statusContainer.dataset.rawJson = rawJsonString;
                }
                if (this.ui.actionsSubmitBtn) {
                    this.ui.actionsSubmitBtn.hidden = false;
                }
                if (this.ui.statusDebugCopyBtn) {
                    this.ui.statusDebugCopyBtn.hidden = false;
                }
            }
            async handleDebugCopy() {
                const textToCopy = this.ui.statusContainer?.dataset.rawJson;
                if (!textToCopy) {
                    return;
                }
                this.setLoader(true);
                const btnOriginalText = this.ui.statusDebugCopyBtn?.textContent || "";
                try {
                    await GM_setClipboard(textToCopy, "text");
                    if (this.ui.statusDebugCopyBtn) {
                        this.ui.statusDebugCopyBtn.textContent = "✅";
                    }
                    setTimeout(() => {
                        if (this.ui.statusDebugCopyBtn) {
                            this.ui.statusDebugCopyBtn.textContent = btnOriginalText;
                        }
                        this.setLoader(false);
                    }, 2e3);
                } catch {
                    if (this.ui.statusDebugCopyBtn) {
                        this.ui.statusDebugCopyBtn.textContent = "⛔";
                    }
                    setTimeout(() => {
                        if (this.ui.statusDebugCopyBtn) {
                            this.ui.statusDebugCopyBtn.textContent = btnOriginalText;
                        }
                        this.setLoader(false);
                    }, 2e3);
                }
            }
            async handleSubmit() {
                if (!this.state.currentPayload) {
                    return;
                }
                this.setLoader(true);
                this.setStatus("Sending to Discogs...", "info");
                this.ui.actionsSubmitBtn?.classList.add("is-disabled");
                try {
                    const formData = new FormData();
                    formData.append("full_data", this.state.currentPayload.full_data);
                    formData.append("sub_notes", this.state.currentPayload.sub_notes);
                    const response = await networkRequest({
                        method: "POST",
                        url: "https://www.discogs.com/submission/release/create",
                        data: formData
                    });
                    const jsonData = JSON.parse(response);
                    if (jsonData?.id) {
                        if (this.state.lastRawData?.cover) {
                            this.setStatus("Draft created. Uploading cover image...", "info");
                            try {
                                const coverBlob = await networkRequest({
                                    url: this.state.lastRawData.cover,
                                    method: "GET",
                                    responseType: "blob"
                                });
                                const imageFormData = new FormData();
                                imageFormData.append("image", coverBlob, "cover.jpg");
                                imageFormData.append("pos", "1");
                                await networkRequest({
                                    method: "POST",
                                    url: `https://www.discogs.com/release/${jsonData.id}/images/upload`,
                                    data: imageFormData
                                });
                                this.setStatus("Draft and cover uploaded successfully!<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>", "success");
                                if (this.ui.actionsSubmitBtn) {
                                    this.ui.actionsSubmitBtn.hidden = true;
                                }
                                GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);
                                setTimeout(() => this.ui.widget?.classList.remove("is-open"), 5e3);
                            } catch (imageError) {
                                console.error("[Discogs Submitter] Cover upload failed:", imageError);
                                this.setStatus(`Draft created, but cover upload failed!<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>`, "warning");
                                if (this.ui.actionsSubmitBtn) {
                                    this.ui.actionsSubmitBtn.hidden = true;
                                }
                                GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);
                            }
                        } else {
                            this.setStatus(`Draft successfully created! ID: ${jsonData.id}.<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>`, "success");
                            if (this.ui.actionsSubmitBtn) {
                                this.ui.actionsSubmitBtn.hidden = true;
                            }
                            GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);
                            setTimeout(() => this.ui.widget?.classList.remove("is-open"), 5e3);
                        }
                    } else {
                        throw new Error("Response missing release ID");
                    }
                } catch (error) {
                    let errMsg = error.message || String(error);
                    if (errMsg.includes("404")) {
                        errMsg = "This usually means you are not logged in or use Containers, Incognito, or strict tracking protection.";
                    }
                    this.setStatus(`Failed to create Discogs draft:<br />${errMsg}`, "error");
                } finally {
                    this.setLoader(false);
                    this.ui.actionsSubmitBtn?.classList.remove("is-disabled");
                }
            }
            getStoreWarning() {
                const storeId = this.state.currentDigitalStore?.id;
                if (storeId === "bandcamp") {
                    return "<small><strong>Be sure to check the metadata, as formatting can vary significantly between labels and artists.</strong></small>";
                } else {
                    return "<small><strong>The list of artists is presented in random order, separated by commas (`,`), and may not exactly match the list of authors from the official release source.</strong></small>";
                }
            }
            bindEvents() {
                this.ui.headerCloseBtn?.addEventListener("click", () => this.ui.widget?.classList.remove("is-open"));
                this.ui.previewContainer?.addEventListener("change", (e) => {
                    const target = e.target;
                    if (target.classList.contains("is-format")) {
                        this.state.selectedFormat = target.value;
                        this.renderPayload();
                    } else if (target.classList.contains("is-hdaudio")) {
                        this.state.isHdAudio = target.checked;
                        this.renderPayload();
                    }
                });
                this.ui.statusDebugCopyBtn?.addEventListener("click", () => this.handleDebugCopy());
                this.ui.actionsSubmitBtn?.addEventListener("click", () => this.handleSubmit());
            }
            getCoords(e) {
                if ("touches" in e && e.touches.length > 0) {
                    return {
                        x: e.touches[0].pageX,
                        y: e.touches[0].pageY
                    };
                }
                return {
                    x: e.pageX,
                    y: e.pageY
                };
            }
            handleMouseMove(e) {
                if (!this.state.isDragging || !this.ui.widget) {
                    return;
                }
                const coords = this.getCoords(e);
                const rootRect = this.ui.widget.getBoundingClientRect();
                const left = Math.min(Math.max(0, coords.x - this.state.offset.x), window.innerWidth - rootRect.width);
                const top = Math.min(Math.max(0, coords.y - this.state.offset.y), window.innerHeight - rootRect.height);
                this.ui.widget.style.left = `${left}px`;
                this.ui.widget.style.top = `${top}px`;
            }
            handleMouseUp() {
                if (!this.state.isDragging) {
                    return;
                }
                this.state.isDragging = false;
                this.ui.headerDragBtn?.classList.remove("is-draggable");
                document.removeEventListener("mousemove", this.handleMouseMove);
                document.removeEventListener("touchmove", this.handleMouseMove);
                document.removeEventListener("mouseup", this.handleMouseUp);
                document.removeEventListener("touchend", this.handleMouseUp);
            }
            bindDraggableEvent() {
                const handleDown = (e) => {
                    if ("button" in e && e.button !== 0) {
                        return;
                    }
                    if (!this.ui.widget || !this.ui.widget.classList.contains("is-open")) {
                        return;
                    }
                    e.preventDefault();
                    this.state.isDragging = true;
                    const coords = this.getCoords(e);
                    const rect = this.ui.widget.getBoundingClientRect();
                    this.state.offset.x = coords.x - rect.left;
                    this.state.offset.y = coords.y - rect.top;
                    this.ui.headerDragBtn?.classList.add("is-draggable");
                    document.addEventListener("mousemove", this.handleMouseMove);
                    document.addEventListener("touchmove", this.handleMouseMove, { passive: false });
                    document.addEventListener("mouseup", this.handleMouseUp);
                    document.addEventListener("touchend", this.handleMouseUp);
                };
                this.ui.headerDragBtn?.addEventListener("mousedown", (e) => handleDown(e));
                this.ui.headerDragBtn?.addEventListener("touchstart", (e) => handleDown(e), { passive: false });
            }
            init() {
                this.injectStyles();
                this.buildSvgSprite();
                this.buildPopup();
                this.bindDraggableEvent();
                this.bindEvents();
            }
        }

        class App {
            widget;
            injectBtn;
            currentUrl;
            observer = null;
            constructor() {
                this.widget = new UiWidget();
                this.injectBtn = new InjectButton();
                this.currentUrl = window.location.href;
            }
            init() {
                this.widget.init();
                this.bindEvents();
                this.setupObservers();
                this.refreshInjection();
            }
            bindEvents() {
                if (this.injectBtn.element) {
                    this.injectBtn.element.addEventListener("click", () => {
                        if (this.injectBtn.element?.classList.contains("is-disabled")) {
                            return;
                        }
                        const store = DigitalStoreRegistry.detectByLocation();
                        if (store) {
                            this.widget.open(store);
                        }
                    });
                }
            }
            refreshInjection() {
                const store = DigitalStoreRegistry.detectByLocation();
                if (!store) {
                    if (this.injectBtn.element?.parentElement) {
                        this.injectBtn.element.remove();
                    }
                    return;
                }
                const targets = document.querySelectorAll(store.target);
                const target = Array.from(targets).find((t) => t.offsetWidth > 0) || targets[0];
                if (target && this.injectBtn.element && !this.injectBtn.element.isConnected) {
                    this.injectBtn.setStore(store.id);
                    store.injectButton(this.injectBtn.element, target);
                }
            }
            handleUrlChange() {
                const newUrl = window.location.href;
                if (newUrl === this.currentUrl) {
                    return false;
                }
                this.currentUrl = newUrl;
                this.widget.reset();
                if (this.injectBtn.element?.parentElement) {
                    this.injectBtn.element.remove();
                }
                return true;
            }
            setupObservers() {
                let debounceTimer = null;
                const debouncedRefresh = () => {
                    if (debounceTimer) {
                        clearTimeout(debounceTimer);
                    }
                    debounceTimer = setTimeout(() => this.refreshInjection(), 100);
                };
                this.observer = new MutationObserver(debouncedRefresh);
                this.observer.observe(document.body, { childList: true, subtree: true });
                this.patchPushState();
                window.addEventListener("popstate", () => this.checkForUrlChange());
                setInterval(() => {
                    this.checkForUrlChange();
                    this.refreshInjection();
                }, 1e3);
            }
            checkForUrlChange() {
                if (this.handleUrlChange()) {
                    this.scheduleInjection();
                }
            }
            scheduleInjection() {
                const delays = [100, 300, 600, 1e3];
                delays.forEach((delay) => setTimeout(() => this.refreshInjection(), delay));
            }
            patchPushState() {
                const originalPushState = history.pushState;
                history.pushState = (...args) => {
                    originalPushState.apply(history, args);
                    this.checkForUrlChange();
                };
            }
        }
        const app = new App();
        app.init();

    })();

})();