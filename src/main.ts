import { USERSCRIPT } from '@/config';
import { DigitalStoreRegistry } from '@/providers';
import { InjectButton, UiWidget } from '@/ui';

import buttonsCss from '@/ui/assets/css/buttons.css?inline';
import inputsCss from '@/ui/assets/css/inputs.css?inline';
import previewCss from '@/ui/assets/css/preview.css?inline';
import resetCss from '@/ui/assets/css/reset.css?inline';
import variablesCss from '@/ui/assets/css/variables.css?inline';
import widgetCss from '@/ui/assets/css/widget.css?inline';
import iconBug from '@/ui/assets/images/icons/bug.svg?raw';
import iconChevronDown from '@/ui/assets/images/icons/chevron-down.svg?raw';
import iconClose from '@/ui/assets/images/icons/close.svg?raw';
import iconMove from '@/ui/assets/images/icons/move.svg?raw';
import iconRotateLeft from '@/ui/assets/images/icons/rotate-left.svg?raw';
import iconSquareCheck from '@/ui/assets/images/icons/square-check.svg?raw';
import imageLogo from '@/ui/assets/images/logo.svg?raw';

/**
 * The core widget controller for the Discogs Submitter userscript.
 * Coordinates UI injection, SPA navigation detection, and data parsing triggers.
 */
class Widget {
  private widget: UiWidget;
  private injectButton: InjectButton;
  private currentUrl: string;
  private observer: MutationObserver | null = null;

  constructor() {
    this.widget = new UiWidget();
    this.injectButton = new InjectButton();
    this.currentUrl = unsafeWindow.location.href;
  }

  /**
   * Bootstraps the widget, mounts the UI, and starts DOM observation.
   */
  public async init(): Promise<void> {
    await this.widget.init();

    this.injectStyles();
    this.buildSvgSprite();

    this.bindEvents();
    this.setupObservers();
    this.refreshInjection();
  }

  /**
   * Injects the styles for the widget.
   */
  public injectStyles(): void {
    if (!document.getElementById(`${USERSCRIPT.ID}-styles`)) {
      const style = document.createElement('style');

      style.id = `${USERSCRIPT.ID}-styles`;
      style.textContent = variablesCss + resetCss + inputsCss + buttonsCss + widgetCss + previewCss;

      document.head.appendChild(style);
    }
  }

  /**
   * Builds the SVG sprite for the widget.
   */
  public buildSvgSprite(): void {
    if (document.getElementById(`${USERSCRIPT.ID}-svg-sprite`)) {
      return;
    }

    const svgSprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    svgSprite.id = `${USERSCRIPT.ID}-svg-sprite`;
    svgSprite.style.display = 'none';

    const rawIcons: Record<string, string> = {
      'ds-logo': imageLogo,
      'ds-icon-move': iconMove,
      'ds-icon-close': iconClose,
      'ds-icon-bug': iconBug,
      'ds-icon-chevron-down': iconChevronDown,
      'ds-square-check': iconSquareCheck,
      'ds-rotate-left': iconRotateLeft,
    };
    const parser = new DOMParser();
    let symbolsHtml = '';

    Object.entries(rawIcons).forEach(([iconId, svgString]) => {
      if (!svgString) {
        return;
      }

      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (svgElement) {
        const viewBox = svgElement.getAttribute('viewBox') || '0 0 1024 1024';
        const innerContent = svgElement.innerHTML.trim();

        symbolsHtml += `<symbol id="${iconId}" viewBox="${viewBox}">${innerContent}</symbol>`;
      }
    });

    svgSprite.innerHTML = symbolsHtml;

    document.body.appendChild(svgSprite);
  }

  /**
   * Binds UI events, specifically the injection button click handler.
   */
  private bindEvents(): void {
    if (this.injectButton.element) {
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
  }

  /**
   * Verifies if the current location matches a supported store and injects the action button.
   * Removes the button if no match is found.
   */
  private refreshInjection(): void {
    const store = DigitalStoreRegistry.detectByLocation();

    if (!store) {
      if (this.injectButton.element?.parentElement) {
        this.injectButton.element.remove();
      }

      return;
    }

    const targets = document.querySelectorAll(store.target) as NodeListOf<HTMLElement>;
    const target = Array.from(targets).find(target => target.offsetWidth > 0) || targets[0];

    if (target && this.injectButton.element && !this.injectButton.element.isConnected) {
      this.injectButton.setStore(store.id);

      store.injectButton(this.injectButton.element, target);
    }
  }

  /**
   * Acts upon a change in the current browser URL (e.g., via SPA routing).
   *
   * @returns True if the URL actually changed and the widget was reset, otherwise false.
   */
  private handleUrlChange(): boolean {
    const newUrl = unsafeWindow.location.href;

    if (newUrl === this.currentUrl) {
      return false;
    }

    this.currentUrl = newUrl;

    this.widget.reset();

    if (this.injectButton.element?.parentElement) {
      this.injectButton.element.remove();
    }

    return true;
  }

  /**
   * Initializes DOM mutation observers and history patching to support SPA navigation.
   */
  private setupObservers(): void {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => this.refreshInjection(), 100);
    };

    this.observer = new MutationObserver(debouncedRefresh);

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.patchPushState();

    unsafeWindow.addEventListener('popstate', () => this.checkForUrlChange());
  }

  /**
   * Verifies if the URL has changed and triggers a re-injection if so.
   */
  private checkForUrlChange(): void {
    if (this.handleUrlChange()) {
      this.scheduleInjection();
    }
  }

  /**
   * Triggers multiple delayed refreshes to ensure injection on dynamic page loads.
   */
  private scheduleInjection(): void {
    const delays = [100, 300, 600, 1000];

    delays.forEach(delay => setTimeout(() => this.refreshInjection(), delay));
  }

  /**
   * Patches history.pushState to detect client-side navigation.
   */
  private patchPushState(): void {
    const originalPushState = history.pushState;

    history.pushState = (...callArguments: [any, string, string | URL | null | undefined]) => {
      originalPushState.apply(history, callArguments);

      this.checkForUrlChange();
    };
  }
}

const discogsSubmitter = new Widget();

discogsSubmitter.init();
