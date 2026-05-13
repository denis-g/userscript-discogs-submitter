import { USERSCRIPT } from '@/config';
import { renderTemplate } from '@/libs/template';

import styles from './styles.css?inline';
import template from './template.html?raw';

const INJECT_BUTTON_STYLES_ID = `${USERSCRIPT.ID}-inject-button-styles`;

/**
 * Manages the "Inject" button that appears on supported digital store pages.
 */
export class InjectButton {
  public element: HTMLElement | null = null;

  constructor() {
    this.build();
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.getElementById(INJECT_BUTTON_STYLES_ID)) {
      return;
    }

    const style = document.createElement('style');

    style.id = INJECT_BUTTON_STYLES_ID;
    style.textContent = styles;

    document.head.appendChild(style);
  }

  private build(): void {
    const data = {
      scriptName: USERSCRIPT.NAME,
    };
    const wrapper = document.createElement('div');

    renderTemplate(template, data, wrapper);

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
