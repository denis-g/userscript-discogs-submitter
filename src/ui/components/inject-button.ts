import injectButtonCss from '@/assets/css/inject-button.css?inline';
import { USERSCRIPT } from '@/config';
import { renderTemplate } from '@/core';

import injectButtonTemplate from '@/ui/templates/inject-button.html?raw';

/**
 * Manages the "Inject" button that appears on supported digital store pages.
 */
export class InjectButton {
  public element: HTMLElement | null = null;
  private readonly WIDGET_ID: string;

  constructor() {
    this.WIDGET_ID = USERSCRIPT.NAME;

    this.build();
    this.injectStyles();
  }

  private injectStyles(): void {
    if (!document.getElementById(`${this.WIDGET_ID}-inject-styles`)) {
      const style = document.createElement('style');

      style.id = `${this.WIDGET_ID}-inject-styles`;
      style.textContent = injectButtonCss;

      document.head.appendChild(style);
    }
  }

  private build(): void {
    const data = {
      scriptName: USERSCRIPT.NAME,
    };
    const wrapper = document.createElement('div');

    renderTemplate(injectButtonTemplate, data, wrapper);

    this.element = wrapper.firstElementChild as HTMLElement;
  }

  /**
   * Updates the button's appearance based on the detected digital store.
   * Removes any previously set store themes before applying the new one.
   *
   * @param storeId - The ID of the detected store (e.g., 'bandcamp').
   *
   * @example
   * ```typescript
   * const button = new InjectButton();
   * button.setStore('bandcamp');
   * ```
   */
  public setStore(storeId: string): void {
    if (this.element) {
      const classesToRemove: string[] = [];

      this.element.classList.forEach((className) => {
        if (className.startsWith('is-')) {
          classesToRemove.push(className);
        }
      });

      classesToRemove.forEach(className => this.element?.classList.remove(className));

      this.element.classList.add(`is-${storeId}`);
    }
  }

  /**
   * Toggles the interactive state of the button.
   *
   * @param disabled - If true, restricts clicks and applies a disabled visual state.
   */
  public setDisabled(disabled: boolean): void {
    if (this.element) {
      if (disabled) {
        this.element.classList.add('is-disabled');
      }
      else {
        this.element.classList.remove('is-disabled');
      }
    }
  }
}
