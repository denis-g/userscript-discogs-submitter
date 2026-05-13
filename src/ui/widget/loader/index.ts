import { renderTemplate } from '@/libs/template';
import template from './template.html?raw';

/**
 * Controls the full-widget overlay loader: visibility, cover thumbnail, and progress label.
 * Owns its `<style>`-less wrapper that already lives in the widget shell DOM.
 */
export class LoaderController {
  private readonly element: HTMLElement | null;
  private readonly getThumb: () => string | null | undefined;

  /**
   * @param element - The `.discogs-submitter__loader` element from the rendered widget shell.
   * @param getThumb - Lazy getter for the active release thumbnail; called when the loader is shown.
   */
  constructor(element: HTMLElement | null, getThumb: () => string | null | undefined) {
    this.element = element;

    this.getThumb = getThumb;
  }

  /**
   * Toggles the loader and, when activating, re-renders the template with the current thumbnail and label.
   *
   * @param isActive - Whether the loader should be visible.
   * @param label - Initial label shown inside the loader.
   */
  public setActive(isActive: boolean, label: string = 'Please wait...'): void {
    if (!this.element) {
      return;
    }

    this.element.classList.toggle('is-loading', isActive);

    if (isActive) {
      renderTemplate(template, { thumb: this.getThumb(), label }, this.element, { replace: true });
    }
  }

  /**
   * Updates only the label text without re-rendering the loader DOM.
   *
   * @param message - The new label text.
   */
  public setLabel(message: string): void {
    const labelElement = this.element?.querySelector('.discogs-submitter__loader__label');

    if (labelElement) {
      labelElement.textContent = message;
    }
  }
}
