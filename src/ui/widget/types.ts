import type { DiscogsPayload, ReleaseData, StoreAdapter } from '@/types';

/**
 * Mutable state shared across all widget controllers.
 * Owned by `Widget`, mutated in-place by the controllers via reference.
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
