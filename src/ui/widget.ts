import type {
  ArtistCredit,
  DiscogsPayload,
  DiscogsPayloadData,
  ReleaseData,
  StoreAdapter,
  StoreFormatOptions,
} from '@/types';
import iconMain from '@/assets/icon-main.svg?raw';
import widgetCss from '@/assets/widget.css?raw';
import { DiscogsAdapter } from '@/core/adapter';
import { networkRequest } from '@/core/network';

let widgetTemplate: HTMLTemplateElement | null = null;

function getWidgetTemplate(): HTMLTemplateElement {
  if (!widgetTemplate) {
    widgetTemplate = document.createElement('template');
    widgetTemplate.innerHTML = `
      <div class="discogs-submitter__header">
        <svg class="discogs-submitter__header__logo" aria-hidden="true"><use href="#icon-logo"></use></svg>
        <span class="discogs-submitter__header__title">${GM_info?.script?.name || ''} <small>v${GM_info?.script?.version || ''}</small></span>
        <div class="discogs-submitter__header__drag-btn" title="Grab to move" role="button"></div>
        <div class="discogs-submitter__header__close-btn" title="Close widget" role="button"></div>
      </div>
      <div class="discogs-submitter__content">
        <div class="discogs-submitter__preview-container"></div>
      </div>
      <div class="discogs-submitter__footer">
        <div class="discogs-submitter__status-container">
          <div class="discogs-submitter__status-text">Waiting...</div>
          <div class="discogs-submitter__status-debug-btn" role="button" title="Copy debug" hidden>🐞</div>
        </div>
        <div class="discogs-submitter__actions">
          <div class="discogs-submitter__actions__btn-submit" role="button" hidden>Submit to Discogs</div>
        </div>
        <div class="discogs-submitter__copyright">
          <a href="${GM_info?.script?.homepage || ''}" target="_blank">Homepage</a>
          <a href="${GM_info?.script?.supportURL || ''}" target="_blank">Report Bug</a>
          <a href="https://buymeacoffee.com/denis_g" target="_blank">Made with <span>♥</span> for music</a>
        </div>
      </div>
      <div class="discogs-submitter__loader">
        <svg class="discogs-submitter__loader__logo" aria-hidden="true"><use href="#icon-logo"></use></svg>
      </div>
    `.trim();
  }

  return widgetTemplate;
}

interface RenderOptions {
  selectedFormat: string;
  isHdAudio: boolean;
  supports: StoreFormatOptions;
}

/**
 * A shared utility for generating HTML fragments used in the widget UI.
 * Provides consistent rendering for rows, tracklists, and release previews.
 */
export const Renderer = {
  /**
   * Renders a single row in the release summary.
   *
   * @param label - The label text for the row header.
   * @param value - The content value for the row body.
   * @param extraClass - Optional CSS class to append to the row container.
   * @returns The HTML string representing the rendered row.
   *
   * @example
   * ```typescript
   * const html = Renderer.renderRow('Artist', 'Aphex Twin', 'is-highlighted');
   * ```
   */
  renderRow: (label: string, value: string, extraClass = ''): string => `
    <div class="discogs-submitter__results__row ${extraClass}">
      <div class="discogs-submitter__results__head">${label}</div>
      <div class="discogs-submitter__results__body">${value}</div>
    </div>
  `,

  /**
   * Renders the tracklist table for the parsed release.
   *
   * @param tracks - The array of parsed track items.
   * @returns The HTML string representing the complete tracklist grid.
   *
   * @example
   * ```typescript
   * const html = Renderer.renderTracklist([{title: 'Track 1', position: '1', duration: '3:00'}]);
   * ```
   */
  renderTracklist: (tracks: any[]): string => {
    const hasTrackArtists = tracks.some(t => t.artists?.length > 0);
    const rowBaseClass = hasTrackArtists ? '' : 'is-no-artist';
    let html = `
      <div class="discogs-submitter__results__row is-tracklist ${rowBaseClass}">
        <div class="discogs-submitter__results__head">#</div>
        ${hasTrackArtists ? '<div class="discogs-submitter__results__head">Artist</div>' : ''}
        <div class="discogs-submitter__results__head">Title</div>
        <div class="discogs-submitter__results__head">Duration</div>
      </div>
    `;

    if (!tracks.length) {
      return `
        ${html}
        <div class="discogs-submitter__results__row">
          <div class="discogs-submitter__results__body">⚠️ No tracks found.</div>
        </div>
      `;
    }

    tracks.forEach((track) => {
      const trackArtists = (track.artists || [])
        .map((a: ArtistCredit, i: number, all: ArtistCredit[]) => `<em>${a.name}</em>${a.join && i < all.length - 1 ? ` ${a.join} ` : ''}`)
        .join('');
      const trackExtraArtists = (track.extraartists || [])
        .map((a: ArtistCredit) => `${a.role} – <em>${a.name}</em>`)
        .join('<br />');

      html += `
        <div class="discogs-submitter__results__row is-tracklist ${rowBaseClass}">
          <div class="discogs-submitter__results__body">${track.position || track.pos || '⚠️'}</div>
          ${hasTrackArtists ? `<div class="discogs-submitter__results__body">${trackArtists}</div>` : ''}
          <div class="discogs-submitter__results__body">
            <div>${track.title || '⚠️'}</div>
            ${trackExtraArtists ? `<small>${trackExtraArtists}</small>` : ''}
          </div>
          <div class="discogs-submitter__results__body">${track.duration || '⚠️'}</div>
        </div>
      `;
    });

    return html;
  },

  /**
   * Renders a structured HTML summary to preview the parsed release data inside the widget.
   *
   * @param release - The core parsed DiscogsPayloadData object.
   * @param options - Configuration options such as format and HD audio toggles.
   * @returns The complete HTML string representing the result screen.
   *
   * @example
   * ```typescript
   * const html = Renderer.releasePreview(data, { selectedFormat: 'FLAC', isHdAudio: false, supports: store.supports });
   * ```
   */
  releasePreview: (release: DiscogsPayloadData, options: RenderOptions): string => {
    const { selectedFormat, isHdAudio, supports } = options;
    const availableFormats = supports.formats || [];
    const canHaveHdAudio = selectedFormat !== 'MP3' && !!supports.hdAudio;
    const artists = (release.artists || [])
      .map((a, i, all) => `<em>${a.name}</em>${a.join && i < all.length - 1 ? ` ${a.join} ` : ''}`)
      .join('') || '⚠️';
    const extraArtists = (release.extraartists || [])
      .map(a => `${a.role} – <em>${a.name}</em>`)
      .join('<br />');
    const formatLabel = (release.format || [])
      .map(f => `${f.name}, Qty: ${f.qty}`)
      .join(', ') || '⚠️';
    const formatSelectionHtml = release.format?.some(f => f.name === 'File')
      ? `, Type: ${availableFormats.map(f => `
          <input type="radio" id="ds[format][${f.toLowerCase()}]" name="ds[format]" tabindex="-1" value="${f}" class="is-format" ${selectedFormat === f ? 'checked' : ''} />
          <label for="ds[format][${f.toLowerCase()}]">${f}</label>
        `).join('')}
        <input type="checkbox" id="ds[format][hdAudio]" tabindex="-1" class="is-hdaudio" ${isHdAudio ? 'checked' : ''} ${!canHaveHdAudio ? 'disabled' : ''} />
        <label for="ds[format][hdAudio]">24-bit</label>`
      : '';

    return `
      <div class="discogs-submitter__results">
        ${Renderer.renderRow('Artist', artists)}
        ${Renderer.renderRow('Title', release.title || '⚠️')}
        ${Renderer.renderRow('Label', release.labels?.[0]?.name || '⚠️')}
        ${Renderer.renderRow('Catalog', release.labels?.[0]?.catno || '⚠️')}
        ${Renderer.renderRow('Released', release.released || '⚠️', 'is-half')}
        ${Renderer.renderRow('Country', release.country || '–', 'is-half')}
        ${Renderer.renderRow('Format', `${formatLabel}${formatSelectionHtml}`)}
        ${Renderer.renderTracklist(release.tracks || [])}
        ${extraArtists
          ? Renderer.renderRow('Credits', extraArtists, 'is-notes')
          : ''}
        ${Renderer.renderRow('Notes', (release.notes || '–').replace(/\n/g, '<br />'), 'is-notes')}
      </div>
    `;
  },
};

/**
 * Manages the main floating UI widget for release parsing and submission.
 * Handles DOM construction, event binding, and communication with store adapters.
 *
 * @example
 * ```typescript
 * const widget = new UiWidget();
 * widget.init();
 * ```
 */
export class UiWidget {
  private readonly WIDGET_ID: string;
  private readonly ui: Record<string, HTMLElement | null> = {};

  private state = {
    currentDigitalStore: null as StoreAdapter | null,
    currentPayload: null as DiscogsPayload | null,
    lastRawData: null as ReleaseData | null,
    selectedFormat: null as string | null,
    isHdAudio: false,
    isDragging: false,
    offset: { x: 0, y: 0 },
  };

  constructor() {
    this.WIDGET_ID = GM_info.script.namespace || 'discogs-submitter';

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  /**
   * Injects the styles for the widget.
   */
  public injectStyles(): void {
    if (!document.getElementById(`${this.WIDGET_ID}-styles`)) {
      const style = document.createElement('style');

      style.id = `${this.WIDGET_ID}-styles`;
      style.textContent = widgetCss;

      document.head.appendChild(style);
    }
  }

  /**
   * Builds the SVG sprite for the widget.
   */
  public buildSvgSprite(): void {
    if (document.getElementById(`${this.WIDGET_ID}-svg-sprite`)) {
      return;
    }

    const svgSprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    svgSprite.id = `${this.WIDGET_ID}-svg-sprite`;
    svgSprite.style.display = 'none';

    const rawIcons = {
      'icon-logo': iconMain,
    };
    let symbolsHtml = '';

    Object.entries(rawIcons).forEach(([iconId, svgString]) => {
      if (!svgString) {
        return;
      }

      const viewBoxMatch = svgString.match(/viewBox=["']([^"']+)["']/i);
      const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 1024 1024';
      const innerMatch = svgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);

      if (innerMatch && innerMatch[1]) {
        const innerContent = innerMatch[1].trim();

        symbolsHtml += `<symbol id="${iconId}" viewBox="${viewBox}">${innerContent}</symbol>`;
      }
    });

    svgSprite.innerHTML = symbolsHtml;

    document.body.appendChild(svgSprite);
  }

  /**
   * Builds the widget popup.
   */
  public buildPopup(): void {
    if (document.getElementById(this.WIDGET_ID)) {
      return;
    }

    const container = document.createElement('aside');
    const isWebArchive = window.location.href.includes('https://web.archive.org/web/');

    container.id = this.WIDGET_ID;
    container.className = `${container.id} ${isWebArchive ? 'is-webarchive' : ''}`;

    const template = getWidgetTemplate();

    container.appendChild(template.content.cloneNode(true));

    document.body.appendChild(container);

    this.ui.widget = container;
    this.ui.header = container.querySelector('.discogs-submitter__header');
    this.ui.headerDragBtn = container.querySelector('.discogs-submitter__header__drag-btn');
    this.ui.headerCloseBtn = container.querySelector('.discogs-submitter__header__close-btn');
    this.ui.statusContainer = container.querySelector('.discogs-submitter__status-container');
    this.ui.statusText = container.querySelector('.discogs-submitter__status-text');
    this.ui.statusDebugCopyBtn = container.querySelector('.discogs-submitter__status-debug-btn');
    this.ui.previewContainer = container.querySelector('.discogs-submitter__preview-container');
    this.ui.actionsSubmitBtn = container.querySelector('.discogs-submitter__actions__btn-submit');
    this.ui.loader = container.querySelector('.discogs-submitter__loader');
  }

  /**
   * Opens the widget and triggers the parsing process against the specified store.
   *
   * @param store - The digital store adapter used to extract release data.
   *
   * @example
   * ```typescript
   * const widget = new UiWidget();
   * widget.open(bandcampAdapter);
   * ```
   */
  public open(store: StoreAdapter): void {
    this.state.currentDigitalStore = store;

    if (this.ui.widget) {
      this.ui.widget.classList.add('is-open');

      this.executeParsing();
    }
  }

  /**
   * Resets the widget state and UI (useful on URL changes).
   */
  public reset(): void {
    if (this.ui.widget) {
      this.ui.widget.classList.remove('is-open');
    }

    this.state.currentPayload = null;
    this.state.lastRawData = null;

    if (this.ui.previewContainer) {
      this.ui.previewContainer.innerHTML = '';
    }

    this.setStatus('Ready to parse...', 'info');

    if (this.ui.actionsSubmitBtn) {
      this.ui.actionsSubmitBtn.hidden = true;
    }

    if (this.ui.statusDebugCopyBtn) {
      this.ui.statusDebugCopyBtn.hidden = true;
    }
  }

  private setLoader(isActive: boolean): void {
    this.ui.loader?.classList.toggle('is-loading', isActive);
  }

  /**
   * Updates the status message and visual state.
   */
  public setStatus(message: string, status: 'error' | 'success' | 'info' | 'warning' = 'info'): void {
    if (this.ui.statusText) {
      this.ui.statusText.innerHTML = message;
    }

    if (this.ui.statusContainer) {
      this.ui.statusContainer.classList.remove('is-error', 'is-success', 'is-info', 'is-warning');
      this.ui.statusContainer.classList.add(`is-${status}`);
    }
  }

  /**
   * Orchestrates the parsing process: extracts data from the store and prepares the preview.
   *
   * @returns A promise that resolves when the parsing and rendering are complete.
   */
  private async executeParsing(): Promise<void> {
    if (!this.state.currentDigitalStore) {
      return;
    }

    this.setStatus('Parsing current release...', 'info');
    this.setLoader(true);

    if (this.ui.statusDebugCopyBtn) {
      this.ui.statusDebugCopyBtn.hidden = true;
    }

    if (this.ui.actionsSubmitBtn) {
      this.ui.actionsSubmitBtn.hidden = true;
    }

    if (this.ui.previewContainer) {
      this.ui.previewContainer.innerHTML = '';
    }

    if (this.ui.statusContainer) {
      delete this.ui.statusContainer.dataset.rawJson;
    }

    try {
      this.state.lastRawData = await this.state.currentDigitalStore.parse();

      // Default selections
      this.state.selectedFormat = this.state.currentDigitalStore.supports?.formats?.[0] || 'WAV';
      this.state.isHdAudio = false;

      this.renderPayload();
      this.setStatus('Parsed successfully! Ready to submit.', 'success');
    }
    catch (error) {
      this.state.currentPayload = null;
      this.state.lastRawData = null;

      const errMsg = (error as Error).message || String(error);

      this.setStatus(errMsg, 'error');

      if (this.ui.statusContainer) {
        this.ui.statusContainer.dataset.rawJson = `URL: ${window.location.href}\nVersion: ${GM_info.script.version}\nError Trace:\n${(error as Error).stack || error}`;
      }

      if (this.ui.statusDebugCopyBtn) {
        this.ui.statusDebugCopyBtn.hidden = false;
      }
    }
    finally {
      this.setLoader(false);
    }
  }

  /**
   * Finalizes the Discogs payload and updates the preview container with the rendered data.
   */
  private renderPayload(): void {
    if (!this.state.lastRawData || !this.state.currentDigitalStore) {
      return;
    }

    // HD Audio is only allowed if the format is NOT MP3 and the store supports it
    const effectiveHdAudio = this.state.selectedFormat !== 'MP3' && this.state.isHdAudio && this.state.currentDigitalStore.supports?.hdAudio;

    this.state.currentPayload = DiscogsAdapter.buildPayload(this.state.lastRawData, window.location.href, {
      format: this.state.selectedFormat || 'WAV',
      isHdAudio: effectiveHdAudio,
    });

    const previewObj = this.state.currentPayload._previewObject;
    const rawJsonString = JSON.stringify(previewObj, null, 2);

    if (this.ui.previewContainer) {
      this.ui.previewContainer.innerHTML = Renderer.releasePreview(previewObj, {
        selectedFormat: this.state.selectedFormat || 'WAV',
        isHdAudio: effectiveHdAudio,
        supports: this.state.currentDigitalStore.supports || { formats: [], hdAudio: false },
      });
    }

    if (this.ui.statusContainer) {
      this.ui.statusContainer.dataset.rawJson = rawJsonString;
    }

    if (this.ui.actionsSubmitBtn) {
      this.ui.actionsSubmitBtn.hidden = false;
    }

    if (this.ui.statusDebugCopyBtn) {
      this.ui.statusDebugCopyBtn.hidden = false;
    }
  }

  /**
   * Copies the raw debug JSON data to the system clipboard.
   *
   * @returns A promise that resolves when the copy operation completes.
   */
  private async handleDebugCopy(): Promise<void> {
    const textToCopy = this.ui.statusContainer?.dataset.rawJson;

    if (!textToCopy) {
      return;
    }

    this.setLoader(true);

    const btnOriginalText = this.ui.statusDebugCopyBtn?.textContent || '';

    try {
      await GM_setClipboard(textToCopy, 'text');

      if (this.ui.statusDebugCopyBtn) {
        this.ui.statusDebugCopyBtn.textContent = '✅';
      }

      setTimeout(() => {
        if (this.ui.statusDebugCopyBtn) {
          this.ui.statusDebugCopyBtn.textContent = btnOriginalText;
        }

        this.setLoader(false);
      }, 2000);
    }
    catch {
      if (this.ui.statusDebugCopyBtn) {
        this.ui.statusDebugCopyBtn.textContent = '⛔';
      }

      setTimeout(() => {
        if (this.ui.statusDebugCopyBtn) {
          this.ui.statusDebugCopyBtn.textContent = btnOriginalText;
        }

        this.setLoader(false);
      }, 2000);
    }
  }

  /**
   * Submits the parsed release payload to Discogs and handles optional cover uploads.
   *
   * @returns A promise that resolves when the submission process (success or failure) concludes.
   */
  private async handleSubmit(): Promise<void> {
    if (!this.state.currentPayload) {
      return;
    }

    this.setLoader(true);
    this.setStatus('Sending to Discogs...', 'info');

    this.ui.actionsSubmitBtn?.classList.add('is-disabled');

    try {
      const formData = new FormData();

      formData.append('full_data', this.state.currentPayload.full_data);
      formData.append('sub_notes', this.state.currentPayload.sub_notes);

      const response = await networkRequest({
        method: 'POST',
        url: 'https://www.discogs.com/submission/release/create',
        data: formData,
      });
      const jsonData = JSON.parse(response as string);

      if (jsonData?.id) {
        if (this.state.lastRawData?.cover) {
          this.setStatus('Draft created. Uploading cover image...', 'info');

          try {
            const coverBlob = await networkRequest({
              url: this.state.lastRawData.cover,
              method: 'GET',
              responseType: 'blob',
            });
            const imageFormData = new FormData();

            imageFormData.append('image', coverBlob as Blob, 'cover.jpg');
            imageFormData.append('pos', '1');

            await networkRequest({
              method: 'POST',
              url: `https://www.discogs.com/release/${jsonData.id}/images/upload`,
              data: imageFormData,
            });

            this.setStatus('Draft and cover uploaded successfully!<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>', 'success');

            if (this.ui.actionsSubmitBtn) {
              this.ui.actionsSubmitBtn.hidden = true;
            }

            GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);

            setTimeout(() => this.ui.widget?.classList.remove('is-open'), 5000);
          }
          catch (imageError) {
            console.error('[Discogs Submitter] Cover upload failed:', imageError);

            this.setStatus(`Draft created, but cover upload failed!<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>`, 'warning');

            if (this.ui.actionsSubmitBtn) {
              this.ui.actionsSubmitBtn.hidden = true;
            }

            GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);
          }
        }
        else {
          this.setStatus(`Draft successfully created! ID: ${jsonData.id}.<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>`, 'success');

          if (this.ui.actionsSubmitBtn) {
            this.ui.actionsSubmitBtn.hidden = true;
          }

          GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);

          setTimeout(() => this.ui.widget?.classList.remove('is-open'), 5000);
        }
      }
      else {
        throw new Error('Response missing release ID');
      }
    }
    catch (error) {
      this.setStatus(`Failed to create Discogs draft:<br />${(error as Error).message || error}`, 'error');
    }
    finally {
      this.setLoader(false);

      this.ui.actionsSubmitBtn?.classList.remove('is-disabled');
    }
  }

  private bindEvents(): void {
    this.ui.headerCloseBtn?.addEventListener('click', () => this.ui.widget?.classList.remove('is-open'));

    this.ui.previewContainer?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;

      if (target.classList.contains('is-format')) {
        this.state.selectedFormat = target.value;

        this.renderPayload();
      }
      else if (target.classList.contains('is-hdaudio')) {
        this.state.isHdAudio = target.checked;

        this.renderPayload();
      }
    });

    this.ui.statusDebugCopyBtn?.addEventListener('click', () => this.handleDebugCopy());
    this.ui.actionsSubmitBtn?.addEventListener('click', () => this.handleSubmit());
  }

  private getCoords(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: (e as TouchEvent).touches[0].pageX,
        y: (e as TouchEvent).touches[0].pageY,
      };
    }

    return {
      x: (e as MouseEvent).pageX,
      y: (e as MouseEvent).pageY,
    };
  }

  private handleMouseMove(e: MouseEvent | TouchEvent): void {
    if (!this.state.isDragging || !this.ui.widget) {
      return;
    }

    const coords = this.getCoords(e);
    const rootRect = this.ui.widget.getBoundingClientRect();
    const left = Math.min(Math.max(0, coords.x - this.state.offset.x), window.innerWidth - rootRect.width);
    const top = Math.min(Math.max(0, coords.y - this.state.offset.y), window.innerHeight - rootRect.height);

    this.ui.widget.style.left = `${left}px`;
    this.ui.widget.style.top = `${top}px`;
  }

  private handleMouseUp(): void {
    if (!this.state.isDragging) {
      return;
    }

    this.state.isDragging = false;

    this.ui.headerDragBtn?.classList.remove('is-draggable');

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('touchmove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('touchend', this.handleMouseUp);
  }

  private bindDraggableEvent(): void {
    const handleDown = (e: MouseEvent | TouchEvent) => {
      // Ignore right-click
      if ('button' in e && e.button !== 0) {
        return;
      }

      if (!this.ui.widget || !this.ui.widget.classList.contains('is-open')) {
        return;
      }

      e.preventDefault();

      this.state.isDragging = true;

      const coords = this.getCoords(e);
      const rect = this.ui.widget.getBoundingClientRect();

      this.state.offset.x = coords.x - rect.left;
      this.state.offset.y = coords.y - rect.top;

      this.ui.headerDragBtn?.classList.add('is-draggable');

      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('touchmove', this.handleMouseMove, { passive: false });
      document.addEventListener('mouseup', this.handleMouseUp);
      document.addEventListener('touchend', this.handleMouseUp);
    };

    this.ui.headerDragBtn?.addEventListener('mousedown', e => handleDown(e));
    this.ui.headerDragBtn?.addEventListener('touchstart', e => handleDown(e), { passive: false });
  }

  public init(): void {
    this.injectStyles();
    this.buildSvgSprite();
    this.buildPopup();
    this.bindDraggableEvent();
    this.bindEvents();
  }
}
