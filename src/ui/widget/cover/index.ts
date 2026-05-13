import { renderTemplate } from '@/libs/template';
import template from './template.html?raw';

/**
 * Renders the widget header cover slot: shows the release thumbnail when available,
 * otherwise the userscript logo.
 */
export class CoverController {
  private readonly slot: HTMLElement | null;
  private readonly getThumb: () => string | null | undefined;

  /**
   * @param slot - The `.discogs-submitter__header__cover` container element.
   * @param getThumb - Lazy getter for the active release thumbnail.
   */
  constructor(slot: HTMLElement | null, getThumb: () => string | null | undefined) {
    this.slot = slot;

    this.getThumb = getThumb;
  }

  /**
   * Re-renders the cover slot using the current thumbnail. Idempotent — safe to call repeatedly.
   */
  public update(): void {
    if (!this.slot) {
      return;
    }

    renderTemplate(template, { thumb: this.getThumb() }, this.slot, { replace: true });
  }
}
