import type { WidgetState } from './types';
import type { StoreAdapter } from '@/types';
import { USERSCRIPT } from '@/config';
import { ALLOWED_COUNTRIES } from '@/config/countries';
import { DiscogsMapper } from '@/domain/mapper';
import { normalizeCountry } from '@/domain/normalizers/country';
import { extractFormatFromTitle } from '@/domain/normalizers/format';
import { normalizeLabel } from '@/domain/normalizers/label';
import { Draggable } from '@/libs/draggable';
import { renderTemplate } from '@/libs/template';
import { CoverController } from './cover';
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
 * composes per-concern controllers (loader, cover, status, preview, submission), and wires
 * the high-level lifecycle (`init`, `open`, `reset`) plus shell-level events.
 *
 * @example
 * ```typescript
 * const widget = new Widget();
 * widget.init();
 * widget.open(detectedStore);
 * ```
 */
export class Widget {
  private readonly state: WidgetState = createWidgetState();
  private readonly elements: Record<string, HTMLElement | null> = {};

  private loader!: LoaderController;
  private cover!: CoverController;
  private status!: StatusController;
  private preview!: PreviewController;
  private submission!: SubmissionController;

  /**
   * Bootstraps the widget: injects its CSS, builds DOM, instantiates controllers,
   * attaches drag, binds events.
   *
   * @returns A promise that resolves when the widget is fully mounted and ready.
   */
  public async init(): Promise<void> {
    this.injectStyles();

    await this.buildPopup();
    this.composeControllers();
    this.cover.update();
    this.bindDraggableEvent();
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

      void this.startParsing();
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

    this.elements.actionsButtonSubmit?.setAttribute('hidden', 'true');

    this.cover.update();
  }

  /**
   * Builds the widget DOM and caches references to its named elements.
   */
  private async buildPopup(): Promise<void> {
    if (document.getElementById(USERSCRIPT.ID)) {
      return;
    }

    const container = document.createElement('aside');
    const currentUrl = new URL(unsafeWindow.location.href);
    const isWebArchive = currentUrl.hostname === 'web.archive.org' && currentUrl.pathname.startsWith('/web/');

    container.id = USERSCRIPT.ID;
    container.className = `${container.id} ${isWebArchive ? 'is-webarchive' : ''}`;

    const data = {
      scriptName: USERSCRIPT.NAME,
      scriptVersion: USERSCRIPT.VERSION,
      homepage: USERSCRIPT.HOMEPAGE,
      supportURL: USERSCRIPT.SUPPORT_URL,
      funding: USERSCRIPT.FUNDING_URL,
    };

    renderTemplate(template, data, container);

    document.body.appendChild(container);

    this.elements.widget = container;
    this.elements.header = container.querySelector('.discogs-submitter__header');
    this.elements.cover = container.querySelector('.discogs-submitter__header__cover');
    this.elements.headerButtonMove = container.querySelector('.discogs-submitter__header .discogs-submitter__button.is-move');
    this.elements.headerButtonClose = container.querySelector('.discogs-submitter__header .discogs-submitter__button.is-close');
    this.elements.status = container.querySelector('.discogs-submitter__status');
    this.elements.statusText = container.querySelector('.discogs-submitter__status__text');
    this.elements.statusButtonDebug = container.querySelector('.discogs-submitter__status .discogs-submitter__button.is-debug');
    this.elements.content = container.querySelector('.discogs-submitter__content');
    this.elements.actionsButtonSubmit = container.querySelector('.discogs-submitter__actions .discogs-submitter__button.is-primary');
    this.elements.loader = container.querySelector('.discogs-submitter__loader');
  }

  /**
   * Instantiates the per-concern controllers and wires the cross-controller hooks.
   */
  private composeControllers(): void {
    this.loader = new LoaderController(this.elements.loader, () => this.state.editedData?.thumb);
    this.cover = new CoverController(this.elements.cover, () => this.state.editedData?.thumb);
    this.status = new StatusController(
      this.elements.status,
      this.elements.statusText,
      this.elements.statusButtonDebug,
      () => this.state.currentDigitalStore,
      () => Boolean(this.state.originalData),
    );
    this.preview = new PreviewController(this.state, this.elements.content, {
      onRendered: (rawJson) => {
        this.status.setRawJson(rawJson);

        if (this.elements.widget && this.state.editedData?.thumb) {
          document.documentElement.style.setProperty('--ds-thumb-url', `url('${this.state.editedData.thumb}')`);
        }

        this.cover.update();

        this.elements.actionsButtonSubmit?.removeAttribute('hidden');
      },
    });
    this.submission = new SubmissionController(
      this.state,
      this.elements.actionsButtonSubmit,
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

    this.elements.actionsButtonSubmit?.setAttribute('hidden', 'true');
    this.preview.clear();
    this.status.clearRawJson();

    try {
      const data = await this.state.currentDigitalStore.parse();

      // Normalize country and apply label heuristic once during the initial parse
      if (!data.country) {
        data.country = 'Worldwide';
      }
      else {
        data.country = ALLOWED_COUNTRIES.includes(data.country) ? data.country : normalizeCountry(data.country);
      }

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

        if (!this.state.editedData.submissionNotes && tempPayload._previewObject.submissionNotes) {
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
   * Wires shell-level event listeners (close button, debug copy, submit) and lets the preview
   * controller bind its own scoped events.
   */
  private bindEvents(): void {
    this.elements.headerButtonClose?.addEventListener('click', () => {
      this.elements.widget?.classList.remove('is-open');
    });

    this.preview.bindEvents();

    this.elements.statusButtonDebug?.addEventListener('click', () => void this.handleDebugCopy());
    this.elements.actionsButtonSubmit?.addEventListener('click', () => void this.submission.submit());
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

    try {
      await GM_setClipboard(textToCopy, 'text');

      this.elements.statusButtonDebug?.classList.add('is-success');

      setTimeout(() => {
        this.elements.statusButtonDebug?.classList.remove('is-success');

        this.loader.setActive(false);
      }, DEBUG_FEEDBACK_DURATION_MS);
    }
    catch {
      this.elements.statusButtonDebug?.classList.add('is-error');

      setTimeout(() => {
        this.elements.statusButtonDebug?.classList.remove('is-error');

        this.loader.setActive(false);
      }, DEBUG_FEEDBACK_DURATION_MS);
    }
  }

  /**
   * Initializes the draggable behaviour for the widget shell.
   */
  private bindDraggableEvent(): void {
    if (this.elements.widget && this.elements.headerButtonMove) {
      const draggable = new Draggable(this.elements.widget, this.elements.headerButtonMove, (isDragging) => {
        this.elements.headerButtonMove?.classList.toggle('is-draggable', isDragging);
      });

      draggable.init();
    }
  }
}
