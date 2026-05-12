import { bugs, funding, homepage, name, version } from '~/package.json' with { type: 'json' };

// Safely access GM_info from global scope to avoid vite-plugin-monkey client side-effects in Vitest
const info = typeof GM_info !== 'undefined' ? GM_info : null;

/**
 * Centralized userscript metadata retrieved from the GM_info global.
 * Provides a single source of truth for script ID, name, version, and links.
 */
export const USERSCRIPT = {
  ID: info?.script?.namespace || 'discogs-submitter',
  NAME: info?.script?.name || name,
  VERSION: info?.script?.version || version,
  HOMEPAGE: info?.script?.homepage || homepage,
  SUPPORT_URL: info?.script?.supportURL || bugs?.url,
  FUNDING_URL: funding || '',
};
