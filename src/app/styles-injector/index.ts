import { USERSCRIPT } from '@/config';

/**
 * Aggregated CSS payload built from every file in `src/assets/styles/`. Auto-discovered via
 * `import.meta.glob` and concatenated in the alphabetical order Vite returns the keys in.
 * Cascade order is encoded in the numeric filename prefix (`10-reset.css`, `20-variables.css`,
 * `30-inputs.css`, `40-buttons.css`) — foundation first, components after — so reset/variables
 * always land before any component rules. Add a new stylesheet by picking an unused number in
 * the right band; no wiring change needed here.
 */
const GLOBAL_CSS = Object.values(
  import.meta.glob('@/assets/styles/*.css', { eager: true, query: '?inline', import: 'default' }),
).join('\n') as string;
const GLOBAL_STYLES_ID = `${USERSCRIPT.ID}-styles`;
const PROVIDER_STYLES_ID_PREFIX = `${USERSCRIPT.ID}-styles-`;

/**
 * Manages the truly-global page-wide `<style>` element (CSS variables, reset, shared
 * inputs/buttons) and the per-provider stylesheets that swap in and out as the user
 * navigates between supported stores. Component-specific CSS (widget, inject-button,
 * select) is owned and injected by the components themselves.
 */
export class StylesInjector {
  /**
   * Injects the global stylesheet (variables, reset, inputs, buttons) into `<head>`
   * as a single `<style>` element. Idempotent.
   */
  public injectGlobal(): void {
    if (document.getElementById(GLOBAL_STYLES_ID)) {
      return;
    }

    const style = document.createElement('style');

    style.id = GLOBAL_STYLES_ID;
    style.textContent = GLOBAL_CSS;

    document.head.appendChild(style);
  }

  /**
   * Injects the given store's provider-specific CSS as a scoped `<style>` tag.
   * If a tag for this store is already present, the call is a no-op. Any previously-injected
   * provider stylesheet for a different store is removed first.
   *
   * @param storeId - The active store id (matches `<style>` id suffix).
   * @param css - The inline CSS payload, typically obtained from `DigitalStoreRegistry.getStyles`.
   */
  public injectProvider(storeId: string, css: string | undefined): void {
    const styleId = `${PROVIDER_STYLES_ID_PREFIX}${storeId}`;

    if (document.getElementById(styleId)) {
      return;
    }

    this.cleanupProvider();

    if (!css) {
      return;
    }

    const style = document.createElement('style');

    style.id = styleId;
    style.textContent = css;

    document.head.appendChild(style);
  }

  /**
   * Removes every provider-specific `<style>` tag injected by `injectProvider`.
   * The global stylesheet (id `${USERSCRIPT.ID}-styles`) is untouched because the
   * selector requires the trailing hyphen.
   */
  public cleanupProvider(): void {
    const selector = `style[id^="${PROVIDER_STYLES_ID_PREFIX}"]`;

    document.querySelectorAll(selector).forEach(element => element.remove());
  }
}
