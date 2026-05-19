import type { WidgetState } from './types';
import type { StoreAdapter } from '@/types';
import { USERSCRIPT } from '@/config';
import { DiscogsMapper } from '@/domain/mapper';
import { resolveCountry } from '@/domain/normalizers/country';
import { extractFormatFromTitle } from '@/domain/normalizers/format';
import { normalizeLabel } from '@/domain/normalizers/label';
import { renderTemplate } from '@/libs/template';
import { isWebarchive } from '@/utils/url';
import { FooterController } from './footer';
import { HeaderController } from './header';
import { LoaderController } from './loader';
import { PreviewController } from './preview';
import { StatusController } from './status';
import { SubmissionController } from './submission';
import template from './template.html?raw';
import { createWidgetState } from './types';

/**
 * Aggregated CSS payload built from every `styles.css` co-located inside `src/ui/widget/`.
 * Auto-discovered via `import.meta.glob` so adding a new sub-controller folder with its own
 * `styles.css` requires no wiring here.
 */
const WIDGET_CSS = Object.values(
  import.meta.glob('./**/styles.css', { eager: true, query: '?inline', import: 'default' }),
).join('\n') as string;
const WIDGET_STYLES_ID = `${USERSCRIPT.ID}-widget-styles`;
const DEBUG_FEEDBACK_DURATION_MS = 2000;

/**
 * Top-level orchestrator for the floating widget. Owns the shared state, builds the DOM,
 * composes per-concern controllers (header, footer, loader, status, preview, submission),
 * and wires the high-level lifecycle (`init`, `open`, `reset`) plus shell-level events.
 *
 * @example
 * ```typescript
 * const widget = new Widget();
 * widget.init();
 * widget.open(detectedStore);
 * ```
 */
/**
 * Lifecycle callbacks the app shell can wire into the widget so it can sync siblings
 * (inject button visibility, position class, etc.) without the widget needing to know
 * about them.
 */
export interface WidgetHooks {
  /** Fired right after the widget starts opening (animation in flight). */
  onOpen?: () => void;
  /** Fired when the widget is closed (via header button or `reset()`). Safe to call repeatedly. */
  onClose?: () => void;
  /** Fired when the user docks the widget to a different side. */
  onPositionChange?: (_side: 'left' | 'right') => void;
}

export class Widget {
  private readonly state: WidgetState = createWidgetState();
  private readonly elements: Record<string, HTMLElement | null> = {};
  private readonly hooks: WidgetHooks;

  private loader!: LoaderController;
  private header!: HeaderController;
  private footer!: FooterController;
  private status!: StatusController;
  private preview!: PreviewController;
  private submission!: SubmissionController;

  constructor(hooks: WidgetHooks = {}) {
    this.hooks = hooks;
  }

  /**
   * Bootstraps the widget: injects its CSS, builds DOM, instantiates controllers,
   * binds events.
   *
   * @returns A promise that resolves when the widget is fully mounted and ready.
   */
  public async init(): Promise<void> {
    this.injectStyles();

    await this.buildPopup();

    this.composeControllers();
    this.bindEvents();
  }

  /**
   * Injects the widget's auto-discovered CSS bundle as a single `<style>` tag.
   * Idempotent — repeat calls are no-ops.
   */
  private injectStyles(): void {
    if (document.getElementById(WIDGET_STYLES_ID)) {
      return;
    }

    const style = document.createElement('style');

    style.id = WIDGET_STYLES_ID;
    style.textContent = WIDGET_CSS;

    document.head.appendChild(style);
  }

  /**
   * Opens the widget and triggers parsing against the given store.
   *
   * @param store - The detected store adapter.
   */
  public open(store: StoreAdapter): void {
    this.state.currentDigitalStore = store;

    if (this.elements.widget) {
      this.elements.widget.classList.add('is-open');

      this.hooks.onOpen?.();

      this.startParsing();
    }
  }

  /**
   * Resets the widget state and UI. Used on SPA URL changes so the next open starts clean.
   */
  public reset(): void {
    if (this.elements.widget) {
      this.elements.widget.classList.remove('is-open');
    }

    this.state.currentPayload = null;
    this.state.originalData = null;
    this.state.editedData = null;

    this.preview.clear();
    this.status.set('Ready to parse...', 'info');
    this.submission.setHidden(true);

    this.header.updateCover();
    this.hooks.onClose?.();
  }

  /**
   * Builds the widget DOM and caches references to its named elements.
   */
  private async buildPopup(): Promise<void> {
    if (document.getElementById(USERSCRIPT.ID)) {
      return;
    }

    const data = {
      scriptId: USERSCRIPT.ID,
      scriptName: USERSCRIPT.NAME,
      rootClasses: `${USERSCRIPT.ID} is-position-right${isWebarchive() ? ' is-webarchive' : ''}`,
    };
    const wrapper = document.createElement('div');

    renderTemplate(template, data, wrapper);

    const container = wrapper.firstElementChild as HTMLElement;

    document.body.appendChild(container);

    this.elements.widget = container;
    this.elements.header = container.querySelector('.discogs-submitter__header');
    this.elements.content = container.querySelector('.discogs-submitter__content');
    this.elements.footer = container.querySelector('.discogs-submitter__footer');
    this.elements.loader = container.querySelector('.discogs-submitter__loader');
  }

  /**
   * Instantiates the per-concern controllers and wires the cross-controller hooks.
   */
  private composeControllers(): void {
    this.loader = new LoaderController(this.elements.loader, () => this.state.editedData?.thumb);
    this.header = new HeaderController(
      this.elements.header,
      {
        onClose: () => {
          this.elements.widget?.classList.remove('is-open');

          this.hooks.onClose?.();
        },
        onPositionChange: side => this.setPosition(side),
      },
      () => this.state.editedData?.thumb,
    );
    this.footer = new FooterController(this.elements.footer);
    this.status = new StatusController(
      this.footer.statusSlot,
      () => this.state.currentDigitalStore,
      () => Boolean(this.state.originalData),
    );
    this.preview = new PreviewController(this.state, this.elements.content, {
      onRendered: (rawJson) => {
        this.status.setRawJson(rawJson);

        if (this.elements.widget && this.state.editedData?.thumb) {
          document.documentElement.style.setProperty('--ds-thumb-url', `url('${this.state.editedData.thumb}')`);
        }

        this.header.updateCover();
        this.submission.setHidden(false);
      },
    });
    this.submission = new SubmissionController(
      this.state,
      this.footer.actionsSlot,
      this.loader,
      this.status,
    );
  }

  /**
   * Drives the initial parse: invokes the active store adapter, normalizes the result,
   * primes widget state with defaults, and triggers the first preview render.
   */
  private async startParsing(): Promise<void> {
    if (!this.state.currentDigitalStore) {
      return;
    }

    this.status.set('Parsing current release...', 'info');
    this.loader.setActive(true);

    this.submission.setHidden(true);
    this.preview.clear();
    this.status.clearRawJson();

    try {
      await this.state.currentDigitalStore.beforeParse?.();

      const data = await this.state.currentDigitalStore.parse();

      data.country = resolveCountry(data.country);

      const primaryArtistName = (data.artists?.[0]?.name || '').trim();

      data.label = normalizeLabel(data.label, primaryArtistName);

      this.state.originalData = JSON.parse(JSON.stringify(data));
      this.state.editedData = JSON.parse(JSON.stringify(data));

      this.state.selectedFormat = this.state.currentDigitalStore.supports?.formats?.[0] || 'WAV';
      this.state.selectedDescriptions = extractFormatFromTitle(this.state.originalData?.title);
      this.state.formatText = '';

      // Pre-fill notes/submissionNotes from DiscogsMapper output so they show up in edit fields
      if (this.state.editedData && this.state.originalData) {
        const tempPayload = DiscogsMapper.mapToPayload(this.state.editedData, unsafeWindow.location.href, {
          format: this.state.selectedFormat || 'WAV',
          descriptions: this.state.selectedDescriptions,
        });

        if (!this.state.editedData.notes && tempPayload._previewObject.notes) {
          this.state.editedData.notes = tempPayload._previewObject.notes;
          this.state.originalData.notes = tempPayload._previewObject.notes;
        }

        if (!this.state.editedData.submissionNotes) {
          this.state.editedData.submissionNotes = tempPayload._previewObject.submissionNotes;
          this.state.originalData.submissionNotes = tempPayload._previewObject.submissionNotes;
        }
      }

      await this.preview.render();

      this.status.set(this.status.getReadyMessage(), 'success');
    }
    catch (error) {
      this.state.currentPayload = null;
      this.state.originalData = null;
      this.state.editedData = null;

      const errorMessage = (error as Error).message || String(error);

      this.status.set(errorMessage, 'error');

      this.status.setRawError(`URL: ${unsafeWindow.location.href}\nVersion: ${USERSCRIPT.VERSION}\nError Trace:\n${(error as Error).stack || error}`);
    }
    finally {
      this.loader.setActive(false);
    }
  }

  /**
   * Wires shell-level event listeners (position toggle, close, debug copy, submit) and lets the
   * preview controller bind its own scoped events.
   */
  private bindEvents(): void {
    this.preview.bindEvents();
    this.submission.bindEvents();

    this.status.bindDebugCopy(() => void this.handleDebugCopy());
  }

  /**
   * Switches the widget between the left and right docks by swapping the `is-position-*` class
   * on the widget root. No-op when the requested side is already active.
   *
   * @param side - Target dock side.
   */
  private setPosition(side: 'left' | 'right'): void {
    const widget = this.elements.widget;

    if (!widget) {
      return;
    }

    widget.classList.toggle('is-position-left', side === 'left');
    widget.classList.toggle('is-position-right', side === 'right');

    this.hooks.onPositionChange?.(side);
  }

  /**
   * Copies the stored debug payload (raw JSON or error trace) to the clipboard and flashes the button.
   */
  private async handleDebugCopy(): Promise<void> {
    const textToCopy = this.status.getRawJson();

    if (!textToCopy) {
      return;
    }

    this.loader.setActive(true);

    const feedback = async (className: 'is-success' | 'is-error') => {
      this.status.setDebugFeedback(className, true);

      setTimeout(() => {
        this.status.setDebugFeedback(className, false);
        this.loader.setActive(false);
      }, DEBUG_FEEDBACK_DURATION_MS);
    };

    try {
      await GM_setClipboard(textToCopy, 'text');
      await feedback('is-success');
    }
    catch {
      await feedback('is-error');
    }
  }
}
