import { USERSCRIPT } from '@/config';
import { renderTemplate } from '@/libs/template';
import template from './template.html?raw';

/**
 * Owns the widget footer subtree: the status slot, the submission actions slot, and
 * the copyright bar. Renders its template into the `.discogs-submitter__footer` slot
 * of the widget shell and exposes the inner status/actions slots so sibling controllers
 * (`StatusController`, `SubmissionController`) can attach to them.
 */
export class FooterController {
  private readonly slot: HTMLElement | null;

  /** Inner `.discogs-submitter__status` slot, or `null` when the footer slot is missing. */
  public readonly statusSlot: HTMLElement | null = null;

  /** Inner `.discogs-submitter__actions` slot, or `null` when the footer slot is missing. */
  public readonly actionsSlot: HTMLElement | null = null;

  /**
   * @param slot - The `.discogs-submitter__footer` element in the widget shell.
   */
  constructor(slot: HTMLElement | null) {
    this.slot = slot;

    if (!this.slot) {
      return;
    }

    renderTemplate(
      template,
      {
        homepage: USERSCRIPT.HOMEPAGE,
        supportURL: USERSCRIPT.SUPPORT_URL,
        funding: USERSCRIPT.FUNDING_URL,
      },
      this.slot,
      { replace: true },
    );

    this.statusSlot = this.slot.querySelector('.discogs-submitter__status');
    this.actionsSlot = this.slot.querySelector('.discogs-submitter__actions');
  }
}
