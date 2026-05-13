import type { StatusKind } from '../types';
import type { StoreAdapter } from '@/types';

/**
 * Controls the widget status banner: message text, semantic colour class,
 * and the visibility of the "copy debug" button (shown only on terminal states).
 * Also exposes a couple of helpers to build the standard "ready to submit" message
 * and to store the raw JSON payload on the status element for later debug copy.
 */
export class StatusController {
  private readonly statusElement: HTMLElement | null;
  private readonly textElement: HTMLElement | null;
  private readonly debugButton: HTMLElement | null;
  private readonly getStore: () => StoreAdapter | null;
  private readonly hasParsedData: () => boolean;

  /**
   * @param statusElement - The `.discogs-submitter__status` container element.
   * @param textElement - The inner `.discogs-submitter__status__text` element receiving the HTML message.
   * @param debugButton - The "copy debug" button toggled by semantic kind.
   * @param getStore - Lazy getter for the currently-detected store adapter (drives store-specific warnings).
   * @param hasParsedData - Lazy probe for whether a parse already produced data (gates restoreReady).
   */
  constructor(statusElement: HTMLElement | null, textElement: HTMLElement | null, debugButton: HTMLElement | null, getStore: () => StoreAdapter | null, hasParsedData: () => boolean) {
    this.statusElement = statusElement;
    this.textElement = textElement;
    this.debugButton = debugButton;
    this.getStore = getStore;
    this.hasParsedData = hasParsedData;
  }

  /**
   * Sets the visible status banner and toggles the debug button.
   *
   * @param message - The HTML to render inside the status text container.
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

  private getStoreWarning(): string | null {
    const storeId = this.getStore()?.id;

    if (storeId === 'bandcamp') {
      return '<small><strong>Be sure to check the metadata, as formatting can vary significantly between labels and artists.</strong></small>';
    }

    return '<small><strong>The list of artists is presented in random order, separated by commas (`,`), and may not exactly match the list of authors from the official release source.</strong></small>';
  }
}
