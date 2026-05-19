import { DigitalStoreRegistry } from '@/providers';
import { InjectButton } from '@/ui/inject-button';
import { Widget } from '@/ui/widget';
import { bindActivation } from '@/utils/dom';
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
  private position: 'left' | 'right' = 'right';
  private readonly injectButton = new InjectButton();
  private readonly widget = new Widget({
    onOpen: () => this.injectButton.setHidden(true),
    onClose: () => this.injectButton.setHidden(false),
    onPositionChange: (side) => {
      this.position = side;

      this.injectButton.setPosition(side);
    },
  });

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

    this.injectButton.setPosition(this.position);

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
    bindActivation(this.injectButton.element, () => {
      const store = DigitalStoreRegistry.detectByLocation();

      if (store) {
        this.widget.open(store);
      }
    });
  }

  /**
   * Verifies whether the current location matches a supported store. The inject button itself is
   * already built in the constructor; this method just attaches it to `<body>` (if it isn't already)
   * and injects the matching provider's CSS. On unsupported pages it detaches the button and removes
   * any lingering provider stylesheet. Position is `fixed`, so no store-specific anchor is needed.
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

    if (this.injectButton.element && !this.injectButton.element.isConnected) {
      document.body.appendChild(this.injectButton.element);
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
