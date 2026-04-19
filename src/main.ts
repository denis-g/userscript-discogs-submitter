import { DigitalStoreRegistry } from '@/providers';
import { InjectButton } from '@/ui/inject-btn';
import { UiWidget } from '@/ui/widget';

/**
 * The core application controller for the Discogs Submitter userscript.
 * Coordinates UI injection, SPA navigation detection, and data parsing triggers.
 */
class App {
  private widget: UiWidget;
  private injectBtn: InjectButton;
  private currentUrl: string;
  private observer: MutationObserver | null = null;

  constructor() {
    this.widget = new UiWidget();
    this.injectBtn = new InjectButton();
    this.currentUrl = window.location.href;
  }

  /**
   * Bootstraps the application, mounts the UI, and starts DOM observation.
   */
  public init(): void {
    this.widget.init();

    this.bindEvents();
    this.setupObservers();
    this.refreshInjection();
  }

  /**
   * Binds UI events, specifically the injection button click handler.
   */
  private bindEvents(): void {
    if (this.injectBtn.element) {
      this.injectBtn.element.addEventListener('click', () => {
        if (this.injectBtn.element?.classList.contains('is-disabled')) {
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
      if (this.injectBtn.element?.parentElement) {
        this.injectBtn.element.remove();
      }

      return;
    }

    const targets = document.querySelectorAll<HTMLElement>(store.target);
    const target = Array.from(targets).find(t => t.offsetWidth > 0) || targets[0];

    if (target && this.injectBtn.element && !this.injectBtn.element.isConnected) {
      this.injectBtn.setStore(store.id);

      store.injectButton(this.injectBtn.element, target);
    }
  }

  /**
   * Acts upon a change in the current browser URL (e.g., via SPA routing).
   *
   * @returns True if the URL actually changed and the widget was reset, otherwise false.
   */
  private handleUrlChange(): boolean {
    const newUrl = window.location.href;

    if (newUrl === this.currentUrl) {
      return false;
    }

    this.currentUrl = newUrl;

    this.widget.reset();

    if (this.injectBtn.element?.parentElement) {
      this.injectBtn.element.remove();
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

    this.observer.observe(document.body, { childList: true, subtree: true });

    this.patchPushState();

    window.addEventListener('popstate', () => this.checkForUrlChange());

    setInterval(() => {
      this.checkForUrlChange();
      this.refreshInjection();
    }, 1000);
  }

  /**
   * Periodically checks if the URL has changed and triggers a re-injection if so.
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

    history.pushState = (...args: [any, string, string | URL | null | undefined]) => {
      originalPushState.apply(history, args);

      this.checkForUrlChange();
    };
  }
}

const app = new App();

app.init();
