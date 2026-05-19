import type { WidgetState } from '../types';
import { DiscogsMapper } from '@/domain/mapper';
import { EditableHelper } from '@/libs/editable';
import { Select } from '@/ui/select';
import { getValueByPath, setValueByPath } from '@/utils/object';
import { renderFragment } from './renderer';
import { resolvePath } from './resolver';

/**
 * Side-effects performed after the preview renders. Allows the widget shell to update
 * sibling controllers (header, status, submit button) without coupling them to preview internals.
 */
export interface PreviewControllerHooks {
  /** Called after every successful preview render so the shell can update the header, status, and submit button. */
  onRendered: (_rawJson: string) => void;
}

/**
 * Owns the preview pane: maps `editedData` into the Discogs payload, renders the HTML,
 * wires field-level edit/restore handlers, and keeps track artists in sync with release artists.
 */
export class PreviewController {
  private readonly state: WidgetState;
  private readonly contentElement: HTMLElement | null;
  private readonly hooks: PreviewControllerHooks;

  /**
   * @param state - Shared widget state (read+write).
   * @param contentElement - The `.discogs-submitter__content` container hosting the preview.
   * @param hooks - Callbacks invoked after every render so the shell can react.
   */
  constructor(state: WidgetState, contentElement: HTMLElement | null, hooks: PreviewControllerHooks) {
    this.state = state;
    this.contentElement = contentElement;
    this.hooks = hooks;
  }

  /**
   * Finalizes the Discogs payload from the current `editedData` and renders the preview fragment.
   * Initializes the custom `<select>` widgets and notifies the shell via `hooks.onRendered`.
   *
   * @returns A promise that resolves when the DOM has been updated.
   */
  public async render(): Promise<void> {
    if (!this.state.editedData || !this.state.currentDigitalStore) {
      return;
    }

    // HD Audio convenience: when MP3 is selected, default the free-text to "320 kbps"
    if (this.state.selectedFormat === 'MP3' && !this.state.formatText) {
      this.state.formatText = '320 kbps';
    }
    else if (this.state.selectedFormat !== 'MP3' && this.state.formatText === '320 kbps') {
      this.state.formatText = '';
    }

    this.state.currentPayload = DiscogsMapper.mapToPayload(this.state.editedData, unsafeWindow.location.href, {
      format: this.state.selectedFormat || 'WAV',
      descriptions: this.state.selectedDescriptions,
      formatText: this.state.formatText,
      country: this.state.editedData.country || '',
    });

    const previewObject = this.state.currentPayload._previewObject;
    const rawJsonString = JSON.stringify(previewObject, null, 2);

    if (this.contentElement) {
      await renderFragment(
        previewObject,
        {
          selectedFormat: this.state.selectedFormat || 'WAV',
          selectedDescriptions: this.state.selectedDescriptions,
          formatText: this.state.formatText,
          supports: this.state.currentDigitalStore.supports || { formats: [] },
        },
        this.contentElement,
        this.state.editedData,
      );

      Select.init(this.contentElement.querySelector('.is-format'));
      Select.init(this.contentElement.querySelector('.is-description'));
      Select.init(this.contentElement.querySelector('.is-country'));
    }

    this.hooks.onRendered(rawJsonString);
  }

  /**
   * Wires every preview-scoped DOM event to the `.discogs-submitter__content` container.
   * Idempotent only if called once at widget mount time.
   */
  public bindEvents(): void {
    if (!this.contentElement) {
      return;
    }

    this.contentElement.addEventListener('change', event => void this.handleChange(event));

    this.contentElement.addEventListener('click', async (event) => {
      const target = event.target as HTMLElement;
      const fieldButton = target.closest('.discogs-submitter__results__field .discogs-submitter__button');

      if (fieldButton) {
        await this.handleRestore(fieldButton as HTMLElement);
      }
    });

    this.contentElement.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement;

      if (target.classList.contains('is-edit')) {
        EditableHelper.handleKeydown(event);

        return;
      }

      // Keyboard activation for restore buttons (mirrors the delegated click handler above)
      if (event.key === 'Enter' || event.key === ' ') {
        const fieldButton = target.closest('.discogs-submitter__results__field .discogs-submitter__button');

        if (fieldButton) {
          event.preventDefault();

          this.handleRestore(fieldButton as HTMLElement);
        }
      }
    });

    this.contentElement.addEventListener('keyup', (event) => {
      if ((event.target as HTMLElement).classList.contains('is-edit')) {
        event.stopPropagation();
      }
    });

    this.contentElement.addEventListener('paste', (event) => {
      if ((event.target as HTMLElement).classList.contains('is-edit')) {
        EditableHelper.handlePaste(event);
      }
    });

    // Trigger handleChange on blur for contenteditable fields
    this.contentElement.addEventListener('blur', (event) => {
      if ((event.target as HTMLElement).classList.contains('is-edit')) {
        this.handleChange(event);
      }
    }, true);
  }

  /**
   * Clears the preview content so the next parse starts from a blank slate.
   */
  public clear(): void {
    if (this.contentElement) {
      this.contentElement.innerHTML = '';
    }
  }

  private async handleChange(event: Event): Promise<void> {
    const target = event.target as HTMLElement;

    if (target.classList.contains('is-format')) {
      this.state.selectedFormat = (target as HTMLSelectElement).value;

      await this.render();
    }
    else if (target.classList.contains('is-description')) {
      const select = target as HTMLSelectElement;

      this.state.selectedDescriptions = Array.from(select.selectedOptions).map(option => option.value);

      await this.render();
    }
    else if (target.classList.contains('is-edit') && this.state.editedData) {
      const value = target.contentEditable === 'plaintext-only' || target.contentEditable === 'true'
        ? target.textContent?.trim() || ''
        : (target as HTMLInputElement | HTMLTextAreaElement).value;

      this.updateEditedData(target, value);
      await this.render();
    }
  }

  private async handleRestore(element: HTMLElement): Promise<void> {
    const path = resolvePath(element);

    if (!path || !this.state.originalData || !this.state.editedData) {
      return;
    }

    if (path === 'formatText') {
      this.state.formatText = '';
    }
    else {
      const oldValue = getValueByPath(this.state.editedData, path);
      const originalValue = getValueByPath(this.state.originalData, path);
      // Deep copy for object values (e.g. an entire track) so subsequent edits don't mutate originalData
      const valueToRestore = typeof originalValue === 'object' && originalValue !== null
        ? JSON.parse(JSON.stringify(originalValue))
        : originalValue;

      setValueByPath(this.state.editedData, path, valueToRestore);

      // If a release-level artist name was restored, propagate to track artists that still match the pre-restore value
      const artistMatch = path.match(/^artists\.(\d+)\.name$/);

      if (artistMatch && typeof oldValue === 'string' && typeof valueToRestore === 'string') {
        this.syncTrackArtists(Number.parseInt(artistMatch[1], 10), oldValue, valueToRestore);
      }
    }

    await this.render();
  }

  private updateEditedData(element: HTMLElement, value: string): void {
    const path = resolvePath(element);

    if (!path || !this.state.editedData) {
      return;
    }

    if (path === 'formatText') {
      this.state.formatText = value;
    }
    else {
      const oldValue = getValueByPath(this.state.editedData, path);

      setValueByPath(this.state.editedData, path, value);

      // If a release-level artist name was edited, propagate to track artists with the same previous value
      const artistMatch = path.match(/^artists\.(\d+)\.name$/);

      if (artistMatch && typeof oldValue === 'string') {
        this.syncTrackArtists(Number.parseInt(artistMatch[1], 10), oldValue, value);
      }
    }
  }

  private syncTrackArtists(index: number, oldName: string, newName: string): void {
    if (!this.state.editedData) {
      return;
    }

    const trimmedOld = oldName.trim().toLowerCase();

    for (const track of this.state.editedData.tracks) {
      const trackArtist = track.artists?.[index];

      if (trackArtist && (trackArtist.name || '').trim().toLowerCase() === trimmedOld) {
        trackArtist.name = newName;
      }
    }
  }
}
