import { USERSCRIPT } from '@/config';
import { renderTemplate } from '@/libs/template';
import { bindActivation } from '@/utils/dom';
import template from './template.html?raw';

/**
 * Callbacks the header invokes when the user interacts with its buttons.
 * Mirrors the shape of `WidgetHooks` but is narrowed to header-scoped events.
 */
export interface HeaderHooks {
  /** Fired when the close button is activated (mouse or keyboard). */
  onClose?: () => void;
  /** Fired when the user docks the widget to a different side. */
  onPositionChange?: (_side: 'left' | 'right') => void;
}

/**
 * Owns the widget header subtree: title, dock-left/right buttons, close button,
 * and the cover (release thumbnail when available, logo fallback otherwise — both
 * declared inline in `template.html` via `data-if`). The header has no static
 * regions to preserve, so every refresh re-renders the whole template and re-binds
 * activation handlers on the new buttons.
 */
export class HeaderController {
  private readonly slot: HTMLElement | null;
  private readonly hooks: HeaderHooks;
  private readonly getThumb: () => string | null | undefined;

  private buttonToLeft: HTMLElement | null = null;
  private buttonToRight: HTMLElement | null = null;
  private buttonClose: HTMLElement | null = null;

  /**
   * @param slot - The `.discogs-submitter__header` element in the widget shell.
   * @param hooks - Callbacks invoked when header buttons are activated.
   * @param getThumb - Lazy getter for the active release thumbnail; read on every refresh.
   */
  constructor(slot: HTMLElement | null, hooks: HeaderHooks, getThumb: () => string | null | undefined) {
    this.slot = slot;
    this.hooks = hooks;
    this.getThumb = getThumb;

    this.refresh();
  }

  /**
   * Re-renders the header with the current thumbnail and re-binds activation handlers.
   * Idempotent — safe to call repeatedly as `editedData.thumb` changes.
   */
  public updateCover(): void {
    this.refresh();
  }

  private refresh(): void {
    if (!this.slot) {
      return;
    }

    renderTemplate(
      template,
      {
        scriptName: USERSCRIPT.NAME,
        thumb: this.getThumb(),
      },
      this.slot,
      { replace: true },
    );

    this.buttonToLeft = this.slot.querySelector('.discogs-submitter__button.is-to-left');
    this.buttonToRight = this.slot.querySelector('.discogs-submitter__button.is-to-right');
    this.buttonClose = this.slot.querySelector('.discogs-submitter__button.is-close');

    bindActivation(this.buttonToLeft, () => this.hooks.onPositionChange?.('left'));
    bindActivation(this.buttonToRight, () => this.hooks.onPositionChange?.('right'));
    bindActivation(this.buttonClose, () => this.hooks.onClose?.());
  }
}
