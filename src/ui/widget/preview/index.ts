import type { WidgetState } from '../types';
import type { ArtistCredit } from '@/types';
import { DiscogsMapper } from '@/domain/mapper';
import { EditableHelper } from '@/libs/editable';
import { Select } from '@/ui/select';
import { getValueByPath, setValueByPath } from '@/utils/object';
import { renderFragment } from './renderer';
import { resolveCollectionPath, resolveEntryRemoval, resolvePath } from './resolver';

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
  /** Artist/credit entries the user added this session; tracked by reference so they never show a restore button. */
  private readonly addedEntries = new WeakSet<ArtistCredit>();

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
        this.addedEntries,
      );

      Select.init(this.contentElement.querySelector('.is-format'));
      Select.init(this.contentElement.querySelector('.is-description'));
      Select.init(this.contentElement.querySelector('.is-country'));

      this.contentElement.querySelectorAll<HTMLTextAreaElement>('textarea.is-edit').forEach(textarea => this.autosizeTextarea(textarea));
    }

    this.hooks.onRendered(rawJsonString);
  }

  /**
   * Wires every preview-scoped DOM event to the `.discogs-submitter__content` container.
   * Must be called exactly once at widget mount; not safe to call repeatedly
   * (it adds listeners unconditionally with no deduplication).
   */
  public bindEvents(): void {
    if (!this.contentElement) {
      return;
    }

    this.contentElement.addEventListener('change', event => void this.handleChange(event));

    this.contentElement.addEventListener('click', async (event) => {
      const action = this.resolveActionButton(event.target as HTMLElement);

      if (action) {
        await this.runAction(action.kind, action.button);
      }
    });

    this.contentElement.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement;

      if (target.classList.contains('is-edit')) {
        EditableHelper.handleKeydown(event);

        return;
      }

      // Keyboard activation for action buttons (mirrors the delegated click handler above)
      if (event.key === 'Enter' || event.key === ' ') {
        const action = this.resolveActionButton(target);

        if (action) {
          event.preventDefault();
          void this.runAction(action.kind, action.button);
        }
      }
    });

    this.contentElement.addEventListener('keyup', (event) => {
      if ((event.target as HTMLElement).classList.contains('is-edit')) {
        event.stopPropagation();
      }
    });

    // Keep auto-height textareas sized to their content as the user types.
    this.contentElement.addEventListener('input', (event) => {
      const target = event.target;

      if (target instanceof HTMLTextAreaElement && target.classList.contains('is-edit')) {
        this.autosizeTextarea(target);
      }
    });
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
      const value = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;

      this.updateEditedData(target, value);
      await this.render();
    }
  }

  /**
   * Grows an editable `<textarea>` to fit its content: long values wrap and the field expands
   * vertically instead of overflowing. Resetting `height` to `auto` first lets the field also
   * shrink when content is removed. This is the cross-browser fallback for `field-sizing: content`.
   *
   * @param textarea - The editable textarea to size.
   */
  private autosizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  /**
   * Maps an event target to the preview action button it belongs to, matching add → remove →
   * restore in priority order. Shared by the click and keyboard handlers.
   *
   * @param target - The event target.
   * @returns The matched action kind and its button, or `null` when the target is not an action button.
   */
  private resolveActionButton(target: HTMLElement): { kind: 'add' | 'remove' | 'restore'; button: HTMLElement } | null {
    const addButton = target.closest('.discogs-submitter__button.is-add');

    if (addButton) {
      return { kind: 'add', button: addButton as HTMLElement };
    }

    const removeButton = target.closest('.discogs-submitter__button.is-remove');

    if (removeButton) {
      return { kind: 'remove', button: removeButton as HTMLElement };
    }

    const restoreButton = target.closest('.discogs-submitter__results__field .discogs-submitter__button');

    if (restoreButton) {
      return { kind: 'restore', button: restoreButton as HTMLElement };
    }

    return null;
  }

  /**
   * Dispatches a resolved preview action to its handler.
   *
   * @param kind - The action kind from `resolveActionButton`.
   * @param button - The button element carrying the action's metadata.
   * @returns A promise that resolves once the action's re-render completes.
   */
  private async runAction(kind: 'add' | 'remove' | 'restore', button: HTMLElement): Promise<void> {
    if (kind === 'add') {
      await this.handleAdd(button);
    }
    else if (kind === 'remove') {
      await this.handleRemove(button);
    }
    else {
      await this.handleRestore(button);
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

  /**
   * Appends a new blank entry to the artist/credit collection targeted by an "add" button and
   * re-renders. Credits get an empty `role`; artists get a default `,` join.
   *
   * @param element - The add button carrying the collection's `data-field` (and track `data-index`).
   */
  private async handleAdd(element: HTMLElement): Promise<void> {
    if (!this.state.editedData) {
      return;
    }

    const arrayPath = resolveCollectionPath(element);

    if (!arrayPath) {
      return;
    }

    const collection = getValueByPath<ArtistCredit[]>(this.state.editedData, arrayPath);

    if (!Array.isArray(collection)) {
      return;
    }

    const entry: ArtistCredit = arrayPath.endsWith('extraartists') ? { name: '', role: '' } : { name: '', join: ',' };

    this.addedEntries.add(entry);
    collection.push(entry);

    await this.render();
  }

  /**
   * Removes the artist/credit entry targeted by a "remove" button and re-renders.
   *
   * @param element - The remove button sharing its sibling field's `data-field`/index metadata.
   */
  private async handleRemove(element: HTMLElement): Promise<void> {
    if (!this.state.editedData) {
      return;
    }

    const removal = resolveEntryRemoval(element);

    if (!removal) {
      return;
    }

    const collection = getValueByPath<ArtistCredit[]>(this.state.editedData, removal.arrayPath);

    if (Array.isArray(collection)) {
      collection.splice(removal.index, 1);

      await this.render();
    }
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
