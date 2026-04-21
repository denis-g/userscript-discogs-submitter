import type { StoreAdapter } from '@/types';
import { sevendigital } from './7digital';
import { amazonmusic } from './amazonmusic';
import { bandcamp } from './bandcamp';
import { beatport } from './beatport';
import { bleep } from './bleep';
import { junodownload } from './junodownload';
import { qobuz } from './qobuz';

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
  detectByLocation: (): StoreAdapter | undefined => DigitalStoreRegistry.list.find(provider => provider.test(window.location.href)),
};
