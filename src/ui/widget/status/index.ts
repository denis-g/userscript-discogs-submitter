import type { StatusKind } from '../types';
import type { StoreAdapter } from '@/types';
import { renderTemplate } from '@/libs/template';
import { bindActivation } from '@/utils/dom';
import template from './template.html?raw';

/**
 * Controls the widget status banner: message text, semantic colour class,
 * and the visibility of the "copy debug" button (shown only on terminal states).
 * Also exposes helpers to build the standard "ready to submit" message and to
 * store the raw JSON payload on the status element for later debug copy.
 *
 * Owns its own DOM: renders `status/template.html` into the slot passed in, then
 * caches references to the inner text + debug button elements.
 */
export class StatusController {
  private readonly statusElement: HTMLElement | null;
  private readonly getStore: () => StoreAdapter | null;
  private readonly hasParsedData: () => boolean;

  private textElement: HTMLElement | null = null;
  private debugButton: HTMLElement | null = null;

  /**
   * @param statusElement - The `.discogs-submitter__status` slot in the widget shell.
   * @param getStore - Lazy getter for the currently-detected store adapter (drives store-specific warnings).
   * @param hasParsedData - Lazy probe for whether a parse already produced data (gates restoreReady).
   */
  constructor(statusElement: HTMLElement | null, getStore: () => StoreAdapter | null, hasParsedData: () => boolean) {
    this.statusElement = statusElement;
    this.getStore = getStore;
    this.hasParsedData = hasParsedData;

    if (this.statusElement) {
      // Live-region semantics live on the slot itself so screen readers announce updates
      this.statusElement.setAttribute('role', 'status');
      this.statusElement.setAttribute('aria-live', 'polite');

      renderTemplate(template, {}, this.statusElement, { replace: true });

      this.textElement = this.statusElement.querySelector('.discogs-submitter__status__text');
      this.debugButton = this.statusElement.querySelector('.discogs-submitter__button.is-debug');
    }
  }

  /**
   * Sets the visible status banner and toggles the debug button.
   *
   * The message is rendered as HTML so callers can include trusted static markup
   * (`<br />`, `<strong>`, store warnings). Any untrusted interpolation — notably
   * error text that may embed scraped page values — MUST be run through `escapeHtml`
   * by the caller before being passed here.
   *
   * @param message - The (trusted) HTML to render inside the status text container.
   * @param kind - Semantic kind that drives styling and debug button visibility.
   */
  public set(message: string, kind: StatusKind = 'info'): void {
    if (this.textElement) {
      this.textElement.innerHTML = message;
    }

    if (this.statusElement) {
      this.statusElement.classList.remove('is-error', 'is-success', 'is-info', 'is-warning');
      this.statusElement.classList.add(`is-${kind}`);
    }

    if (this.debugButton) {
      if (kind === 'error' || kind === 'success') {
        this.debugButton.removeAttribute('hidden');
      }
      else {
        this.debugButton.setAttribute('hidden', 'true');
      }
    }
  }

  /**
   * Restores the post-parse "ready to submit" status after a submission completes.
   * No-op when no parse has been performed yet (e.g., widget was reset).
   */
  public restoreReady(): void {
    if (!this.hasParsedData()) {
      return;
    }

    this.set(this.getReadyMessage(), 'success');
  }

  /**
   * Builds the "ready to submit" HTML message, appending any store-specific warning.
   *
   * @returns The HTML message ready to pass to `set`.
   */
  public getReadyMessage(): string {
    const warning = this.getStoreWarning();

    return warning
      ? `Parsed successfully! Ready to submit.<br />${warning}`
      : 'Parsed successfully! Ready to submit.';
  }

  /**
   * Stores the raw JSON preview on the status element so the debug button can copy it later.
   *
   * @param json - The full preview payload serialized as a string.
   */
  public setRawJson(json: string): void {
    if (this.statusElement) {
      this.statusElement.dataset.rawJson = json;
    }
  }

  /**
   * Stores the error trace on the status element for the debug button to copy.
   *
   * @param trace - The full error trace block (multiline string).
   */
  public setRawError(trace: string): void {
    if (this.statusElement) {
      this.statusElement.dataset.rawJson = trace;
    }
  }

  /**
   * Clears any stored debug payload from the status element.
   */
  public clearRawJson(): void {
    if (this.statusElement) {
      delete this.statusElement.dataset.rawJson;
    }
  }

  /**
   * Returns the stored debug payload, if any.
   *
   * @returns The raw JSON or error trace string, or null when nothing is stored.
   */
  public getRawJson(): string | null {
    return this.statusElement?.dataset.rawJson ?? null;
  }

  /**
   * Toggles a one-off feedback class on the debug button. Used by callers to flash the
   * button after a successful/failed clipboard copy without exposing the button itself.
   *
   * @param className - Modifier class (e.g. `is-success`, `is-error`).
   * @param isActive - Whether to apply or remove the class.
   */
  public setDebugFeedback(className: string, isActive: boolean): void {
    this.debugButton?.classList.toggle(className, isActive);
  }

  /**
   * Wires the debug button to the given handler with click + keyboard activation.
   *
   * @param handler - Activation callback (typically copies the raw JSON to the clipboard).
   */
  public bindDebugCopy(handler: () => void): void {
    bindActivation(this.debugButton, handler);
  }

  private getStoreWarning(): string | null {
    const storeId = this.getStore()?.id;

    if (storeId === 'bandcamp') {
      return '<small><strong>Be sure to check the metadata, as formatting can vary significantly between labels and artists.</strong></small>';
    }

    return '<small><strong>The list of artists is presented in random order, separated by commas (`,`), and may not exactly match the list of authors from the official release source.</strong></small>';
  }
}
