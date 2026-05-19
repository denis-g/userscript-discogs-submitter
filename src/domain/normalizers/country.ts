import { ALLOWED_COUNTRIES } from '@/config/countries';

/**
 * A mapping of common country name variations to their canonical Discogs names.
 */
const COUNTRY_MAP = new Map<string, string>([
  ['usa', 'US'],
  ['united states', 'US'],
  ['united states of america', 'US'],
  ['united kingdom', 'UK'],
  ['the uk', 'UK'],
  ['great britain', 'UK'],
  ['bahamas', 'Bahamas, The'],
  ['micronesia', 'Micronesia, Federated States of'],
  ['moldova', 'Moldova, Republic of'],
  ['russian federation', 'Russia'],
  ['holland', 'Netherlands'],
  ['republic of korea', 'South Korea'],
  ['dprk', 'North Korea'],
  ['uae', 'United Arab Emirates'],
  ['bolivarian republic of venezuela', 'Venezuela'],
  ['syrian arab republic', 'Syria'],
  ['viet nam', 'Vietnam'],
  ['lao peoples democratic republic', 'Laos'],
  ['brunei darussalam', 'Brunei'],
  ['macao', 'Macau'],
  ['czechia', 'Czech Republic'],
]);
/**
 * A lookup map for case-insensitive validation of allowed countries.
 */
const LOWERCASE_ALLOWED_COUNTRIES = new Map(
  ALLOWED_COUNTRIES.map(country => [country.toLowerCase(), country]),
);

/**
 * Validates and normalizes a country name against the allowed Discogs country list.
 *
 * Handles dots, case-insensitivity, and maps common variations (e.g., "USA") to standard names.
 *
 * @param country - The country name string to validate.
 * @returns The canonical Discogs country name, or an empty string if not allowed.
 *
 * @example
 * ```typescript
 * console.log(normalizeCountry("usa")); // "US"
 * console.log(normalizeCountry("United Kingdom")); // "UK"
 * console.log(normalizeCountry("germany")); // "Germany"
 * ```
 */
export function normalizeCountry(country: string | null | undefined): string {
  if (!country) {
    return '';
  }

  // Remove dots and trim for broader matching (e.g. "U.S.A." -> "usa")
  const cleaned = country.replace(/\./g, '').trim().toLowerCase();
  // Try common mappings
  const mapped = COUNTRY_MAP.get(cleaned);

  if (mapped) {
    return mapped;
  }

  // Try case-insensitive lookup in allowed list
  const canonical = LOWERCASE_ALLOWED_COUNTRIES.get(cleaned);

  return canonical || '';
}

/**
 * Resolves an arbitrary country string from a store parser into a valid Discogs country.
 * Combines the allowed-list check with the alias normalizer and falls back to `'Worldwide'`
 * when the value is empty or unrecognized (e.g. provider returned a city/state like `'Texas'`).
 *
 * @param raw - The raw country string from a store adapter.
 * @returns A guaranteed-valid Discogs country name.
 *
 * @example
 * ```typescript
 * resolveCountry('UK');       // 'UK'        (already canonical)
 * resolveCountry('usa');      // 'US'        (alias)
 * resolveCountry('Texas');    // 'Worldwide' (unknown → fallback)
 * resolveCountry(null);       // 'Worldwide' (empty → fallback)
 * ```
 */
export function resolveCountry(raw: string | null | undefined): string {
  if (!raw) {
    return 'Worldwide';
  }

  if (ALLOWED_COUNTRIES.includes(raw)) {
    return raw;
  }

  return normalizeCountry(raw) || 'Worldwide';
}
