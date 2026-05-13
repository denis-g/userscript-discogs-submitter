import type { StoreAdapter } from '@/types';
import { sevendigital } from './7digital';
import { amazonmusic } from './amazonmusic';
import { bandcamp } from './bandcamp';
import { beatport } from './beatport';
import { bleep } from './bleep';
import { hdtracks } from './hdtracks';
import { junodownload } from './junodownload';
import { qobuz } from './qobuz';

/**
 * Provider-specific CSS auto-discovered by directory convention.
 * Each `src/providers/<id>/styles.css` becomes a record keyed by `<id>`.
 * Adding a new provider with a `styles.css` requires no extra wiring here.
 */
const PROVIDER_STYLES = Object.fromEntries(
  Object.entries(
    import.meta.glob('./*/styles.css', { eager: true, query: '?inline', import: 'default' }),
  )
    .map(([path, content]) => {
      const match = path.match(/^\.\/([^/]+)\/styles\.css$/);

      return match ? [match[1], content as string] : null;
    })
    .filter((entry): entry is [string, string] => entry !== null),
);

/**
 * Central registry for all supported digital music store adapters.
 * Used to automatically detect and route parsing logic based on the current active URL.
 */
export const DigitalStoreRegistry = {
  /**
   * List of all supported digital stores.
   */
  list: [
    bandcamp,
    qobuz,
    junodownload,
    beatport,
    sevendigital,
    amazonmusic,
    bleep,
    hdtracks,
  ] as StoreAdapter[],

  /**
   * Detects the correct digital store based on the current window location.
   *
   * @returns The matched store adapter, or undefined if the current URL is not supported.
   *
   * @example
   * ```typescript
   * const store = DigitalStoreRegistry.detectByLocation();
   * if (store) {
   *   console.log(`Matched store: ${store.id}`);
   * }
   * ```
   */
  detectByLocation: (): StoreAdapter | undefined => DigitalStoreRegistry.list.find(provider => provider.test(unsafeWindow.location.href)),

  /**
   * Returns the auto-discovered store-specific CSS for the given store id, if any.
   *
   * @param storeId - The id of the store (matches the directory name under `src/providers/`).
   * @returns The inline CSS string, or undefined when the provider ships no `styles.css`.
   */
  getStyles: (storeId: string): string | undefined => PROVIDER_STYLES[storeId],
};
