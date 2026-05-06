import type {
  DiscogsPayload,
  DiscogsPayloadData,
  ReleaseData,
  StoreAdapter,
  StoreFormatOptions,
  TrackData,
} from '@/types';
import { FILE_FORMATS, RELEASE_TYPES, USERSCRIPT } from '@/config';
import { DiscogsAdapter, networkRequest, renderTemplate } from '@/core';
import { UiSelect } from '@/ui';
import previewTemplate from '@/ui/templates/preview.html?raw';
import widgetTemplate from '@/ui/templates/widget.html?raw';
import { ALLOWED_COUNTRIES, extractFormatFromTitle, normalizeCountry, normalizeLabel } from '@/utils';

interface RenderOptions {
  selectedFormat: string;
  selectedDescriptions: string[];
  formatText: string;
  supports: StoreFormatOptions;
}

/**
 * A shared utility for generating HTML fragments used in the widget UI.
 * Provides consistent rendering for rows, tracklists, and release previews.
 */
export const Renderer = {
  /**
   * Renders a structured HTML summary to preview the parsed release data inside the widget.
   *
   * @param release - The prepared preview data object (DiscogsPayloadData).
   * @param options - UI configuration (format, descriptions, etc.).
   * @param domEl - Container where the preview will be rendered.
   * @param editedData - The full release data (including user edits) used to populate fields.
   * @returns A promise that resolves when the rendering is complete.
   */
  releasePreview: async (release: DiscogsPayloadData, options: RenderOptions, domEl: HTMLElement, editedData: ReleaseData): Promise<void> => {
    const { selectedFormat, selectedDescriptions, formatText, supports } = options;
    const tracks = release.tracks || [];
    const hasTrackArtists = tracks.some(track => (track.artists || []).length > 0);
    const data = {
      ...release,
      releaseArtists: (editedData.artists || []).map((artist, index) => ({
        ...artist,
        _index: index,
        _last: index === (editedData.artists || []).length - 1,
      })),
      rawTitle: editedData.title,
      rawLabel: editedData.label || '',
      rawNumber: editedData.number || 'none',
      rawReleased: editedData.released || '',
      rawCountry: editedData.country || '',
      // Release-level credits (extraartists) from editedData
      rawExtraArtists: (editedData.extraartists || []).map((credit, index) => ({
        ...credit,
        _index: index,
      })),
      showExtraArtists: (editedData.extraartists || []).length > 0,
      rawNotes: editedData.notes,
      rawSubmissionNotes: editedData.submissionNotes,
      availableCountries: ALLOWED_COUNTRIES.map(country => ({
        _value: country,
        isSelected: country === editedData.country,
      })),
      selectedFormat,
      availableFormats: (supports.formats || FILE_FORMATS).map(format => ({
        _value: format,
        isSelected: format === selectedFormat,
      })),
      formatText,
      availableDescriptions: RELEASE_TYPES.map(type => ({
        _value: type,
        isSelected: selectedDescriptions.includes(type),
      })),
      // Prepared tracklist data
      hasTrackArtists,
      rowClass: `${hasTrackArtists ? '' : 'is-no-artist'}`,
      tracks: tracks.map((track, trackIndex) => {
        const rawTrack = editedData.tracks[trackIndex];

        return {
          ...track,
          // Track-level artists from editedData
          trackArtists: (rawTrack?.artists || []).map((artist, artistIndex) => ({
            ...artist,
            _trackIndex: trackIndex,
            _index: artistIndex,
            _last: artistIndex === (rawTrack?.artists || []).length - 1,
          })),
          // Track-level credits from editedData
          trackExtraartists: (rawTrack?.extraartists || []).map((credit, creditIndex) => ({
            ...credit,
            _trackIndex: trackIndex,
            _index: creditIndex,
          })),
          hasTrackArtists,
          rowClass: `${hasTrackArtists ? '' : 'is-no-artist'}`,
          _index: trackIndex,
        };
      }),
    };

    renderTemplate(previewTemplate, data, domEl, { replace: true });
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
  private readonly ui: Record<string, HTMLElement | null> = {};

  private state = {
    currentDigitalStore: null as StoreAdapter | null,
    currentPayload: null as DiscogsPayload | null,
    lastRawData: null as ReleaseData | null,
    editedData: null as ReleaseData | null,
    selectedFormat: null as string | null,
    selectedDescriptions: [] as string[],
    formatText: '',
    isDragging: false,
    offset: { x: 0, y: 0 },
  };

  constructor() {
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  /**
   * Builds the widget popup.
   */
  public async buildPopup(): Promise<void> {
    if (document.getElementById(USERSCRIPT.ID)) {
      return;
    }

    const container = document.createElement('aside');
    const currentUrl = new URL(window.location.href);
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

    renderTemplate(widgetTemplate, data, container);
    document.body.appendChild(container);

    this.ui.widget = container;
    this.ui.header = container.querySelector('.discogs-submitter__header');
    this.ui.headerButtonMove = container.querySelector('.discogs-submitter__header .discogs-submitter__button.is-move');
    this.ui.headerButtonClose = container.querySelector('.discogs-submitter__header .discogs-submitter__button.is-close');
    this.ui.status = container.querySelector('.discogs-submitter__status');
    this.ui.statusText = container.querySelector('.discogs-submitter__status__text');
    this.ui.statusButtonDebug = container.querySelector('.discogs-submitter__status .discogs-submitter__button.is-debug');
    this.ui.preview = container.querySelector('.discogs-submitter__preview');
    this.ui.actionsButtonSubmit = container.querySelector('.discogs-submitter__actions .discogs-submitter__button.is-primary');
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
    this.state.editedData = null;

    if (this.ui.preview) {
      this.ui.preview.innerHTML = '';
    }

    this.setStatus('Ready to parse...', 'info');

    if (this.ui.actionsButtonSubmit) {
      this.ui.actionsButtonSubmit.setAttribute('hidden', 'true');
    }
  }

  /**
   * Toggles the loading indicator state.
   *
   * @param isActive - Whether the loader should be visible.
   */
  private setLoader(isActive: boolean): void {
    if (this.ui.loader) {
      this.ui.loader.classList.toggle('is-loading', isActive);
    }
  }

  /**
   * Updates the status message and visual state.
   * Also manages the visibility of the debug button (shown only on success or error).
   *
   * @param message - The text message to display.
   * @param status - The semantic status type (info, success, error, warning).
   */
  public setStatus(message: string, status: 'error' | 'success' | 'info' | 'warning' = 'info'): void {
    if (this.ui.statusText) {
      this.ui.statusText.innerHTML = message;
    }

    if (this.ui.status) {
      this.ui.status.classList.remove('is-error', 'is-success', 'is-info', 'is-warning');
      this.ui.status.classList.add(`is-${status}`);
    }

    if (this.ui.statusButtonDebug) {
      if (status === 'error' || status === 'success') {
        this.ui.statusButtonDebug.removeAttribute('hidden');
      }
      else {
        this.ui.statusButtonDebug.setAttribute('hidden', 'true');
      }
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

    if (this.ui.actionsButtonSubmit) {
      this.ui.actionsButtonSubmit.setAttribute('hidden', 'true');
    }

    if (this.ui.preview) {
      this.ui.preview.innerHTML = '';
    }

    if (this.ui.status) {
      delete this.ui.status.dataset.rawJson;
    }

    try {
      const data = await this.state.currentDigitalStore.parse();

      this.state.lastRawData = JSON.parse(JSON.stringify(data));
      this.state.editedData = JSON.parse(JSON.stringify(data));

      // Normalize country and apply label heuristic once during initial parsing
      if (this.state.editedData) {
        if (!this.state.editedData.country) {
          this.state.editedData.country = 'Worldwide';
        }
        else {
          this.state.editedData.country = ALLOWED_COUNTRIES.includes(this.state.editedData.country)
            ? this.state.editedData.country
            : normalizeCountry(this.state.editedData.country);
        }

        const primaryArtistName = (this.state.editedData.artists?.[0]?.name || '').trim();

        this.state.editedData.label = normalizeLabel(this.state.editedData.label, primaryArtistName);
      }

      // Default selections
      this.state.selectedFormat = this.state.currentDigitalStore.supports?.formats?.[0] || 'WAV';
      this.state.selectedDescriptions = extractFormatFromTitle(this.state.lastRawData?.title);
      this.state.formatText = '';

      // Ensure notes and submission notes are initialized if DiscogsAdapter would generate them
      if (this.state.editedData && this.state.lastRawData) {
        const tempPayload = DiscogsAdapter.buildPayload(this.state.editedData, window.location.href, {
          format: this.state.selectedFormat || 'WAV',
          descriptions: this.state.selectedDescriptions,
        });

        if (!this.state.editedData.notes && tempPayload._previewObject.notes) {
          this.state.editedData.notes = tempPayload._previewObject.notes;
          this.state.lastRawData.notes = tempPayload._previewObject.notes;
        }

        if (!this.state.editedData.submissionNotes && tempPayload._previewObject.submissionNotes) {
          this.state.editedData.submissionNotes = tempPayload._previewObject.submissionNotes;
          this.state.lastRawData.submissionNotes = tempPayload._previewObject.submissionNotes;
        }
      }

      this.renderPayload();

      const storeWarning = this.getStoreWarning();
      const successMsg = storeWarning
        ? `Parsed successfully! Ready to submit.<br />${storeWarning}`
        : 'Parsed successfully! Ready to submit.';

      this.setStatus(successMsg, 'success');
    }
    catch (error) {
      this.state.currentPayload = null;
      this.state.lastRawData = null;
      this.state.editedData = null;

      const errMsg = (error as Error).message || String(error);

      this.setStatus(errMsg, 'error');

      if (this.ui.status) {
        this.ui.status.dataset.rawJson = `URL: ${window.location.href}\nVersion: ${USERSCRIPT.VERSION}\nError Trace:\n${(error as Error).stack || error}`;
      }
    }
    finally {
      this.setLoader(false);
    }
  }

  /**
   * Finalizes the Discogs payload and updates the preview container with the rendered data.
   */
  private async renderPayload(): Promise<void> {
    if (!this.state.editedData || !this.state.currentDigitalStore) {
      return;
    }

    // HD Audio logic is simplified: if we select MP3 and formatText is empty, set it to "320 kbps"
    if (this.state.selectedFormat === 'MP3' && !this.state.formatText) {
      this.state.formatText = '320 kbps';
    }
    else if (this.state.selectedFormat !== 'MP3' && this.state.formatText === '320 kbps') {
      this.state.formatText = '';
    }

    this.state.currentPayload = DiscogsAdapter.buildPayload(this.state.editedData, window.location.href, {
      format: this.state.selectedFormat || 'WAV',
      descriptions: this.state.selectedDescriptions,
      formatText: this.state.formatText,
      country: this.state.editedData.country || '',
    });

    const previewObj = this.state.currentPayload._previewObject;
    const rawJsonString = JSON.stringify(previewObj, null, 2);

    if (this.ui.preview) {
      await Renderer.releasePreview(previewObj, {
        selectedFormat: this.state.selectedFormat || 'WAV',
        selectedDescriptions: this.state.selectedDescriptions,
        formatText: this.state.formatText,
        supports: this.state.currentDigitalStore.supports || { formats: [] },
      }, this.ui.preview, this.state.editedData);

      // Initialize custom selects for Format, Description and Country
      UiSelect.init(this.ui.preview.querySelector('.is-format'));
      UiSelect.init(this.ui.preview.querySelector('.is-description'));
      UiSelect.init(this.ui.preview.querySelector('.is-country'));
    }

    if (this.ui.status) {
      this.ui.status.dataset.rawJson = rawJsonString;
    }

    if (this.ui.actionsButtonSubmit) {
      this.ui.actionsButtonSubmit.removeAttribute('hidden');
    }
  }

  /**
   * Copies the raw debug JSON data to the system clipboard.
   *
   * @returns A promise that resolves when the copy operation completes.
   */
  private async handleDebugCopy(): Promise<void> {
    const textToCopy = this.ui.status?.dataset.rawJson;

    if (!textToCopy) {
      return;
    }

    this.setLoader(true);

    try {
      await GM_setClipboard(textToCopy, 'text');

      if (this.ui.statusButtonDebug) {
        this.ui.statusButtonDebug.classList.add('is-success');
      }

      setTimeout(() => {
        if (this.ui.statusButtonDebug) {
          this.ui.statusButtonDebug.classList.remove('is-success');
        }

        this.setLoader(false);
      }, 2000);
    }
    catch {
      if (this.ui.statusButtonDebug) {
        this.ui.statusButtonDebug.classList.add('is-error');
      }

      setTimeout(() => {
        if (this.ui.statusButtonDebug) {
          this.ui.statusButtonDebug.classList.remove('is-error');
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

    this.ui.actionsButtonSubmit?.classList.add('is-disabled');

    try {
      const formData = new FormData();

      formData.append('full_data', this.state.currentPayload.full_data);
      formData.append('sub_notes', this.state.currentPayload.sub_notes);

      const jsonData = await networkRequest<{ id: number }>({
        method: 'POST',
        url: 'https://www.discogs.com/submission/release/create',
        data: formData,
        responseType: 'json',
      });

      if (jsonData?.id) {
        if (this.state.editedData?.cover) {
          this.setStatus('Draft created. Uploading cover image...', 'info');

          try {
            const coverBlob = await networkRequest<Blob>({
              url: this.state.editedData.cover,
              method: 'GET',
              responseType: 'blob',
            });
            const imageFormData = new FormData();

            imageFormData.append('image', coverBlob, 'cover.jpg');
            imageFormData.append('pos', '1');

            await networkRequest({
              method: 'POST',
              url: `https://www.discogs.com/release/${jsonData.id}/images/upload`,
              data: imageFormData,
            });

            this.setStatus('Draft and cover uploaded successfully!<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>', 'success');

            if (this.ui.actionsButtonSubmit) {
              this.ui.actionsButtonSubmit.setAttribute('hidden', 'true');
            }

            GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);

            setTimeout(() => this.ui.widget?.classList.remove('is-open'), 5000);
          }
          catch (imageError) {
            console.error('[Discogs Submitter] Cover upload failed:', imageError);

            this.setStatus(`Draft created, but cover upload failed!<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>`, 'warning');

            if (this.ui.actionsButtonSubmit) {
              this.ui.actionsButtonSubmit.setAttribute('hidden', 'true');
            }

            GM_openInTab(`https://www.discogs.com/release/edit/${jsonData.id}`, true);
          }
        }
        else {
          this.setStatus(`Draft successfully created! ID: ${jsonData.id}.<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>`, 'success');

          if (this.ui.actionsButtonSubmit) {
            this.ui.actionsButtonSubmit.setAttribute('hidden', 'true');
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
      let errMsg = (error as Error).message || String(error);

      if (errMsg.includes('404')) {
        errMsg = 'This usually means you are not logged in or use Containers, Incognito, or strict tracking protection.';
      }

      this.setStatus(`Failed to create Discogs draft:<br />${errMsg}`, 'error');
    }
    finally {
      this.setLoader(false);

      this.ui.actionsButtonSubmit?.classList.remove('is-disabled');
    }
  }

  /**
   * Returns a store-specific warning message if applicable.
   *
   * @returns The HTML warning string or null if no specific warning exists for the current store.
   */
  private getStoreWarning(): string | null {
    const storeId = this.state.currentDigitalStore?.id;

    if (storeId === 'bandcamp') {
      return '<small><strong>Be sure to check the metadata, as formatting can vary significantly between labels and artists.</strong></small>';
    }

    return '<small><strong>The list of artists is presented in random order, separated by commas (`,`), and may not exactly match the list of authors from the official release source.</strong></small>';
  }

  /**
   * Centralized handler for all interactive changes within the release preview.
   * Updates the internal state and triggers a payload re-render.
   *
   * @param event - The DOM change event.
   */
  private async handlePreviewChange(event: Event): Promise<void> {
    const target = event.target as HTMLElement;

    if (target.classList.contains('is-format')) {
      this.state.selectedFormat = (target as HTMLSelectElement).value;
      await this.renderPayload();
    }
    else if (target.classList.contains('is-description')) {
      const select = target as HTMLSelectElement;

      this.state.selectedDescriptions = Array.from(select.selectedOptions).map(option => option.value);
      await this.renderPayload();
    }
    else if (target.classList.contains('is-edit') && this.state.editedData) {
      const field = target.dataset.field;
      const indexStr = target.dataset.index;
      const indices = indexStr ? indexStr.split('|').map(v => Number.parseInt(v, 10)) : null;
      const subindex = target.dataset.subindex ? Number.parseInt(target.dataset.subindex, 10) : null;
      const value = (target.contentEditable === 'plaintext-only' || target.contentEditable === 'true')
        ? (target as HTMLElement).innerText.trim() // eslint-disable-line unicorn/prefer-dom-node-text-content
        : (target as HTMLInputElement | HTMLTextAreaElement).value;

      this.updateEditedData(field, value, indices ? indices[indices.length - 1] : null, subindex, indices);
      await this.renderPayload();
    }
  }

  /**
   * Updates the edited state based on the field path and value.
   *
   * @param field - Field path (e.g., 'artists', 'tracks.title').
   * @param value - New value.
   * @param index - Index for array fields.
   * @param subindex - Optional sub-index for nested array fields.
   * @param allIndices - All indices for deeply nested paths.
   */
  private updateEditedData(field: string | undefined, value: string, index: number | null, subindex: number | null, allIndices: number[] | null): void {
    if (!field || !this.state.editedData) {
      return;
    }

    if (field === 'artists.name' && index !== null) {
      const artist = this.state.editedData.artists[index];

      if (artist) {
        artist.name = value;
      }
    }
    else if (field === 'extraartists.name' && index !== null) {
      const credit = this.state.editedData.extraartists[index];

      if (credit) {
        credit.name = value;
      }
    }
    else if (field === 'formatText') {
      this.state.formatText = value;
    }
    else if (field === 'notes') {
      this.state.editedData.notes = value;
    }
    else if (field === 'submissionNotes') {
      this.state.editedData.submissionNotes = value;
    }
    else if (field.startsWith('tracks.')) {
      const parts = field.split('.');
      const trackField = parts[1] as keyof TrackData;
      // For tracks, index from data-index is usually the track index
      // If we have multiple indices, the first one is the track index (from ../_index in template)
      const trackIdx = allIndices ? allIndices[0] : index;
      const track = this.state.editedData.tracks[trackIdx!];

      if (track) {
        if (trackField === 'artists' && subindex !== null) {
          const artist = track.artists[subindex];

          if (artist) {
            artist.name = value;
          }
        }
        else if (trackField === 'extraartists' && subindex !== null) {
          const credit = track.extraartists[subindex];

          if (credit) {
            credit.name = value;
          }
        }
        else {
          (track[trackField] as any) = value;
        }
      }
    }
    else {
      (this.state.editedData as any)[field] = value;
    }
  }

  /**
   * Restores original parsed data for a specific field.
   *
   * @param field - The field identifier.
   * @param index - Optional index for array items.
   * @param subindex - Optional sub-index for nested array items.
   */
  private async handleRestore(field: string | undefined, index: number | null, subindex: number | null): Promise<void> {
    if (!field || !this.state.lastRawData || !this.state.editedData) {
      return;
    }

    if (field === 'artists.name' && index !== null) {
      this.state.editedData.artists[index].name = this.state.lastRawData.artists[index].name;
    }
    else if (field === 'tracks.artists.name' && index !== null && subindex !== null) {
      this.state.editedData.tracks[index].artists[subindex].name = this.state.lastRawData.tracks[index].artists[subindex].name;
    }
    else if (field === 'tracks.title' && index !== null) {
      this.state.editedData.tracks[index].title = this.state.lastRawData.tracks[index].title;
    }
    else if (field === 'tracks.extraartists.name' && index !== null && subindex !== null) {
      this.state.editedData.tracks[index].extraartists[subindex].name = this.state.lastRawData.tracks[index].extraartists[subindex].name;
    }
    else if (field === 'tracks' && index !== null) {
      this.state.editedData.tracks[index] = JSON.parse(JSON.stringify(this.state.lastRawData.tracks[index]));
    }
    else if (field === 'extraartists.name' && index !== null) {
      this.state.editedData.extraartists[index].name = this.state.lastRawData.extraartists[index].name;
    }
    else if (field === 'extraartists' && index !== null) {
      this.state.editedData.extraartists[index] = JSON.parse(JSON.stringify(this.state.lastRawData.extraartists[index]));
    }
    else if (field === 'formatText') {
      this.state.formatText = '';
    }
    else {
      (this.state.editedData as any)[field] = JSON.parse(JSON.stringify((this.state.lastRawData as any)[field]));
    }

    await this.renderPayload();
  }

  private bindEvents(): void {
    this.ui.headerButtonClose?.addEventListener('click', () => this.ui.widget?.classList.remove('is-open'));

    this.ui.preview?.addEventListener('change', event => void this.handlePreviewChange(event));

    this.ui.preview?.addEventListener('click', async (event) => {
      const target = event.target as HTMLElement;
      const fieldButton = target.closest('.discogs-submitter__results__field .discogs-submitter__button');

      if (fieldButton) {
        const btn = fieldButton as HTMLElement;
        const field = btn.dataset.field;
        const indexStr = btn.dataset.index;
        const indices = indexStr ? indexStr.split('|').map(v => Number.parseInt(v, 10)) : null;
        const subindex = btn.dataset.subindex ? Number.parseInt(btn.dataset.subindex, 10) : null;

        await this.handleRestore(field, indices ? indices[indices.length - 1] : null, subindex);
      }
    });

    // Contenteditable handlers
    this.ui.preview?.addEventListener('keydown', (event) => {
      if ((event.target as HTMLElement).classList.contains('is-edit')) {
        event.stopPropagation();
      }
    });

    this.ui.preview?.addEventListener('keyup', (event) => {
      if ((event.target as HTMLElement).classList.contains('is-edit')) {
        event.stopPropagation();
      }
    });

    this.ui.preview?.addEventListener('paste', (event) => {
      const target = event.target as HTMLElement;

      if (target.contentEditable === 'plaintext-only' || target.contentEditable === 'true') {
        event.preventDefault();

        const text = (event.clipboardData || (window as any).clipboardData).getData('text/plain');

        document.execCommand('insertText', false, text);
      }
    });

    this.ui.preview?.addEventListener('input', (event) => {
      const target = event.target as HTMLElement;

      if (target.contentEditable === 'plaintext-only' || target.contentEditable === 'true') {
        // Basic cleanup logic if needed
      }
    });

    // We need to trigger handlePreviewChange on blur for contenteditable
    this.ui.preview?.addEventListener('blur', (event) => {
      if ((event.target as HTMLElement).classList.contains('is-edit')) {
        void this.handlePreviewChange(event);
      }
    }, true);

    this.ui.statusButtonDebug?.addEventListener('click', () => this.handleDebugCopy());
    this.ui.actionsButtonSubmit?.addEventListener('click', () => this.handleSubmit());
  }

  private getCoords(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in event && event.touches.length > 0) {
      return {
        x: (event as TouchEvent).touches[0].pageX,
        y: (event as TouchEvent).touches[0].pageY,
      };
    }

    return {
      x: (event as MouseEvent).pageX,
      y: (event as MouseEvent).pageY,
    };
  }

  private handleMouseMove(event: MouseEvent | TouchEvent): void {
    if (!this.state.isDragging || !this.ui.widget) {
      return;
    }

    const coords = this.getCoords(event);
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

    this.ui.headerButtonMove?.classList.remove('is-draggable');

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('touchmove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('touchend', this.handleMouseUp);
  }

  private bindDraggableEvent(): void {
    const handleDown = (event: MouseEvent | TouchEvent) => {
      // Ignore right-click
      if ('button' in event && event.button !== 0) {
        return;
      }

      if (!this.ui.widget || !this.ui.widget.classList.contains('is-open')) {
        return;
      }

      event.preventDefault();

      this.state.isDragging = true;

      const coords = this.getCoords(event);
      const rect = this.ui.widget.getBoundingClientRect();

      this.state.offset.x = coords.x - rect.left;
      this.state.offset.y = coords.y - rect.top;

      this.ui.headerButtonMove?.classList.add('is-draggable');

      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('touchmove', this.handleMouseMove, { passive: false });
      document.addEventListener('mouseup', this.handleMouseUp);
      document.addEventListener('touchend', this.handleMouseUp);
    };

    this.ui.headerButtonMove?.addEventListener('mousedown', event => handleDown(event));
    this.ui.headerButtonMove?.addEventListener('touchstart', event => handleDown(event), { passive: false });
  }

  public async init(): Promise<void> {
    await this.buildPopup();
    this.bindDraggableEvent();
    this.bindEvents();
  }
}
