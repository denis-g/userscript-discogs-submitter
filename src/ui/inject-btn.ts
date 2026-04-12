import injectBtnCss from '@/assets/inject-btn.css?raw';

let btnTemplate: HTMLTemplateElement | null = null;

function getInjectBtnTemplate(): HTMLTemplateElement {
  if (!btnTemplate) {
    btnTemplate = document.createElement('template');

    btnTemplate.innerHTML = `
      <div class="discogs-submitter__inject__btn" role="button">
        <svg class="discogs-submitter__inject__logo" aria-hidden="true"><use href="#icon-logo"></use></svg>
        <span class="discogs-submitter__inject__name">${GM_info?.script?.name || 'Discogs Submitter'}</span>
      </div>
    `.trim();
  }

  return btnTemplate;
}

/**
 * Manages the "Inject" button that appears on supported digital store pages.
 */
export class InjectButton {
  public element: HTMLElement | null = null;
  private readonly WIDGET_ID: string;

  constructor() {
    this.WIDGET_ID = GM_info.script.namespace || 'discogs-submitter';

    this.build();
    this.injectStyles();
  }

  private injectStyles(): void {
    if (!document.getElementById(`${this.WIDGET_ID}-inject-styles`)) {
      const style = document.createElement('style');

      style.id = `${this.WIDGET_ID}-inject-styles`;
      style.textContent = injectBtnCss;

      document.head.appendChild(style);
    }
  }

  private build(): void {
    const template = getInjectBtnTemplate();
    const clone = template.content.cloneNode(true) as DocumentFragment;

    this.element = clone.firstElementChild as HTMLElement;
  }

  /**
   * Updates the button's appearance based on the detected digital store.
   * Removes any previously set store themes before applying the new one.
   *
   * @param storeId - The ID of the detected store (e.g., 'bandcamp').
   *
   * @example
   * ```typescript
   * const btn = new InjectButton();
   * btn.setStore('beatport');
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
