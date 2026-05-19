import { USERSCRIPT } from '@/config';
import { renderTemplate } from '@/libs/template';

import styles from './styles.css?inline';
import template from './template.html?raw';

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
    if (document.getElementById(`${USERSCRIPT.ID}-inject-button-styles`)) {
      return;
    }

    const style = document.createElement('style');

    style.id = `${USERSCRIPT.ID}-inject-button-styles`;
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
   * Docks the button to the given side by toggling the `is-position-*` classes. Kept in sync
   * with the widget so opening the popup feels like one continuous motion.
   *
   * @param side - Target dock side.
   */
  public setPosition(side: 'left' | 'right'): void {
    if (!this.element) {
      return;
    }

    this.element.classList.toggle('is-position-left', side === 'left');
    this.element.classList.toggle('is-position-right', side === 'right');
  }

  /**
   * Animates the button in/out by toggling the `is-hidden` class. Used by the app shell to
   * tuck the button away while the widget is open.
   *
   * @param hidden - When true, slides the button off-screen on its docked side.
   */
  public setHidden(hidden: boolean): void {
    this.element?.classList.toggle('is-hidden', hidden);
  }
}
