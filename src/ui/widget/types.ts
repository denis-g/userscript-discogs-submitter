import type { DiscogsPayload, ReleaseData, StoreAdapter } from '@/types';

/**
 * Single source of truth for the active parse session. `Widget` builds it once at construction,
 * passes the same reference into every sub-controller, and the controllers mutate fields in place
 * (e.g. `editedData` on every keystroke, `currentPayload` on every render). Sharing one reference
 * — instead of plumbing setters or events — keeps the preview render synchronous and lets the
 * submission flow read the latest user edits without any extra wiring.
 *
 * Field roles:
 * - `currentDigitalStore`: active provider adapter; null between sessions.
 * - `originalData`: the immutable result of `store.parse()`; used as the restore-to baseline.
 * - `editedData`: mutated copy of `originalData`; what the preview renders and what gets submitted.
 * - `currentPayload`: last `DiscogsMapper.mapToPayload(...)` output cached for debug copy/submit.
 * - `selectedFormat` / `selectedDescriptions` / `formatText`: UI-driven format choices that feed
 *   into the next `mapToPayload` call.
 */
export interface WidgetState {
  currentDigitalStore: StoreAdapter | null;
  currentPayload: DiscogsPayload | null;
  originalData: ReleaseData | null;
  editedData: ReleaseData | null;
  selectedFormat: string | null;
  selectedDescriptions: string[];
  formatText: string;
}

/**
 * Builds a pristine `WidgetState` with all fields cleared.
 *
 * @returns A fresh state object.
 */
export function createWidgetState(): WidgetState {
  return {
    currentDigitalStore: null,
    currentPayload: null,
    originalData: null,
    editedData: null,
    selectedFormat: null,
    selectedDescriptions: [],
    formatText: '',
  };
}

/**
 * Semantic kind for the status banner: drives both background color and the debug button visibility.
 */
export type StatusKind = 'error' | 'success' | 'info' | 'warning';
