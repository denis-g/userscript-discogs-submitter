const MUTATION_DEBOUNCE_MS = 100;
const POST_NAVIGATION_DELAYS_MS = [100, 300, 600, 1000];

/**
 * Callbacks the app registers with the observer.
 */
export interface SpaObserverHandlers {
  /** Fired (debounced) whenever the document body mutates — used to re-check inject button targets. */
  onMutate: () => void;
  /** Fired only when `window.location.href` actually changes (after `pushState`, `replaceState`, or `popstate`). */
  onUrlChange: () => void;
}

/**
 * Watches the host page for two distinct events the userscript cares about:
 *
 *  1. Generic DOM mutations (new nodes inserted by the host SPA's renderer) — debounced
 *     and reported via `onMutate` so the app can re-attempt button injection.
 *  2. URL changes (SPA navigation via `history.pushState`/`popstate`) — reported via
 *     `onUrlChange`, followed by a series of scheduled `onMutate` calls because the host
 *     page typically re-renders asynchronously after the URL flip.
 *
 * The observer keeps its own `currentUrl` cursor so it only emits `onUrlChange` on true changes.
 */
export class SpaObserver {
  private currentUrl: string;
  private mutationObserver: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.currentUrl = unsafeWindow.location.href;
  }

  /**
   * Starts the observer. Safe to call once at app bootstrap.
   *
   * @param handlers - Callback bundle invoked on DOM mutations and URL changes.
   */
  public start(handlers: SpaObserverHandlers): void {
    const handleMutation = () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(handlers.onMutate, MUTATION_DEBOUNCE_MS);
    };

    this.mutationObserver = new MutationObserver(handleMutation);

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.patchPushState(() => this.handlePotentialUrlChange(handlers));

    unsafeWindow.addEventListener('popstate', () => this.handlePotentialUrlChange(handlers));
  }

  /**
   * Compares the current URL against the cached one. On mismatch, updates the cursor,
   * fires `onUrlChange`, and schedules follow-up `onMutate` calls to let the SPA settle.
   *
   * @param handlers - The same handler bundle passed to `start`.
   */
  private handlePotentialUrlChange(handlers: SpaObserverHandlers): void {
    const newUrl = unsafeWindow.location.href;

    if (newUrl === this.currentUrl) {
      return;
    }

    this.currentUrl = newUrl;

    handlers.onUrlChange();

    // The host SPA usually renders the new view asynchronously; trigger several delayed mutates
    // so the inject button has a chance to find its target as the DOM settles.
    POST_NAVIGATION_DELAYS_MS.forEach(delay => setTimeout(handlers.onMutate, delay));
  }

  /**
   * Monkey-patches `history.pushState` so SPA navigations (which don't fire `popstate`)
   * are observable.
   *
   * @param onChange - Callback invoked after every `pushState` call.
   */
  private patchPushState(onChange: () => void): void {
    const originalPushState = history.pushState;

    history.pushState = (...callArguments: [any, string, string | URL | null | undefined]) => {
      originalPushState.apply(history, callArguments);

      onChange();
    };
  }
}
