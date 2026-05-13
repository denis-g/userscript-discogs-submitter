import { DigitalStoreRegistry } from '@/providers';
import { InjectButton } from '@/ui/inject-button';
import { Widget } from '@/ui/widget';
import { SpaObserver } from './spa-observer';
import { StylesInjector } from './styles-injector';
import { SvgSprite } from './svg-sprite';

/**
 * Top-level userscript controller. Composes the widget, the inject button, the styles injector,
 * and the SPA observer; drives the bootstrap lifecycle and reacts to host-page changes.
 *
 * Not to be confused with `Widget` — `App` is the page-level integration layer, `Widget` is
 * the floating popup it manages.
 *
 * @example
 * ```typescript
 * new App().init();
 * ```
 */
export class App {
  private readonly widget = new Widget();
  private readonly injectButton = new InjectButton();
  private readonly styles = new StylesInjector();
  private readonly sprite = new SvgSprite();
  private readonly observer = new SpaObserver();

  /**
   * Bootstraps the userscript: mounts the widget, injects global styles + SVG sprite,
   * wires the inject-button click handler, starts SPA observation, and performs the
   * initial injection attempt for the current URL.
   *
   * @returns A promise that resolves once the widget is fully mounted.
   */
  public async init(): Promise<void> {
    this.styles.injectGlobal();
    this.sprite.mount();

    await this.widget.init();

    this.bindEvents();

    this.observer.start({
      onMutate: () => this.refreshInjection(),
      onUrlChange: () => this.handleUrlChange(),
    });

    this.refreshInjection();
  }

  /**
   * Wires the inject button click — opens the widget for the currently-detected store.
   */
  private bindEvents(): void {
    if (!this.injectButton.element) {
      return;
    }

    this.injectButton.element.addEventListener('click', () => {
      if (this.injectButton.element?.classList.contains('is-disabled')) {
        return;
      }

      const store = DigitalStoreRegistry.detectByLocation();

      if (store) {
        this.widget.open(store);
      }
    });
  }

  /**
   * Verifies whether the current location matches a supported store. When it does, injects
   * the action button (if not already there) and the provider-specific CSS. When it doesn't,
   * removes the button and cleans up any leftover provider styles.
   */
  private refreshInjection(): void {
    const store = DigitalStoreRegistry.detectByLocation();

    if (!store) {
      if (this.injectButton.element?.parentElement) {
        this.injectButton.element.remove();
      }

      this.styles.cleanupProvider();

      return;
    }

    const targets = document.querySelectorAll(store.target) as NodeListOf<HTMLElement>;
    const target = Array.from(targets).find(candidate => candidate.offsetWidth > 0) || targets[0];

    if (target && this.injectButton.element && !this.injectButton.element.isConnected) {
      this.injectButton.setStore(store.id);

      store.injectButton(this.injectButton.element, target);
    }

    this.styles.injectProvider(store.id, DigitalStoreRegistry.getStyles(store.id));
  }

  /**
   * Reacts to an SPA URL change — resets the widget and removes the inject button so the next
   * `refreshInjection` re-evaluates the new page from scratch.
   */
  private handleUrlChange(): void {
    this.widget.reset();

    if (this.injectButton.element?.parentElement) {
      this.injectButton.element.remove();
    }
  }
}
