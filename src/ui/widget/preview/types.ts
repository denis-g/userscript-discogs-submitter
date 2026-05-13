import type { StoreFormatOptions } from '@/types';

/**
 * Render-time configuration passed to the preview fragment builder.
 */
export interface PreviewRenderOptions {
  selectedFormat: string;
  selectedDescriptions: string[];
  formatText: string;
  supports: StoreFormatOptions;
}
