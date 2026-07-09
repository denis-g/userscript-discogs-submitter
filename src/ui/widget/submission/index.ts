import type { LoaderController } from '../loader';
import type { StatusController } from '../status';
import type { WidgetState } from '../types';
import { networkRequest } from '@/libs/network';
import { renderTemplate } from '@/libs/template';
import { bindActivation } from '@/utils/dom';
import { escapeHtml } from '@/utils/string';
import { isHttpUrl } from '@/utils/url';
import template from './template.html?raw';

const MIN_STEP_DURATION_MS = 5000;

/**
 * Submits the parsed release payload to Discogs and optionally uploads the cover image.
 * Owns the submit button: renders the template into the slot and wires click/keyboard activation.
 * During submission the button stays visible while progress is shown in the loader; each network
 * step is held in the loader for at least `MIN_STEP_DURATION_MS` so messages don't flash past the
 * user when calls are fast.
 */
export class SubmissionController {
  private readonly state: WidgetState;
  private readonly slot: HTMLElement | null;
  private readonly loader: LoaderController;
  private readonly status: StatusController;
  private readonly onRestoreAll: () => void;

  private submitButton: HTMLElement | null = null;
  private restoreAllButton: HTMLElement | null = null;

  /**
   * @param state - Shared widget state (reads `currentPayload`, `editedData.cover`).
   * @param slot - The `.discogs-submitter__actions` slot in the widget shell.
   * @param loader - Loader controller used to display per-step progress labels.
   * @param status - Status controller used to set the terminal success/warning/error state.
   * @param onRestoreAll - Invoked when the user activates the "Restore all" button.
   */
  constructor(state: WidgetState, slot: HTMLElement | null, loader: LoaderController, status: StatusController, onRestoreAll: () => void) {
    this.state = state;
    this.slot = slot;
    this.loader = loader;
    this.status = status;
    this.onRestoreAll = onRestoreAll;

    if (!this.slot) {
      return;
    }

    renderTemplate(template, {}, this.slot, { replace: true });

    this.submitButton = this.slot.querySelector('.discogs-submitter__button.is-primary');
    this.restoreAllButton = this.slot.querySelector('.discogs-submitter__button.is-danger');
  }

  /**
   * Wires click + keyboard activation on the submit and restore-all buttons.
   * Must be called exactly once at widget mount; not safe to call repeatedly
   * (it adds listeners unconditionally with no deduplication).
   */
  public bindEvents(): void {
    bindActivation(this.submitButton, () => void this.submit());
    bindActivation(this.restoreAllButton, () => this.onRestoreAll());
  }

  /**
   * Shows or hides the action buttons (submit + restore-all). Used by the shell to reveal them
   * once parsing completes and to hide them again on reset/SPA navigation.
   *
   * @param hidden - Whether the buttons should be hidden.
   */
  public setHidden(hidden: boolean): void {
    for (const button of [this.submitButton, this.restoreAllButton]) {
      if (!button) {
        continue;
      }

      if (hidden) {
        button.setAttribute('hidden', 'true');
      }
      else {
        button.removeAttribute('hidden');
      }
    }
  }

  /**
   * Runs the full submission flow: create draft → optional cover upload → open Discogs editor tab.
   * Surfaces all outcomes via `status`/`loader`.
   *
   * @returns A promise that resolves when the submission flow (success, warning, or error) concludes.
   */
  public async submit(): Promise<void> {
    if (!this.state.currentPayload) {
      return;
    }

    this.loader.setActive(true, 'Sending to Discogs...');

    let coverUploadFailed = false;
    let releaseId: number | null = null;

    try {
      const formData = new FormData();

      formData.append('full_data', this.state.currentPayload.full_data);
      formData.append('sub_notes', this.state.currentPayload.sub_notes);

      const jsonData = await this.runStep('Sending to Discogs...', () =>
        networkRequest<{ id: number }>({
          method: 'POST',
          url: 'https://www.discogs.com/submission/release/create',
          data: formData,
          responseType: 'json',
        }));

      if (!jsonData?.id) {
        throw new Error('Response missing release ID');
      }

      releaseId = jsonData.id;

      const coverUrl = this.state.editedData?.cover;

      if (coverUrl && !isHttpUrl(coverUrl)) {
        // Refuse to fetch a non-http(s) cover (e.g. `file:`/`data:` smuggled by a hostile page);
        // flag it so the user is told to add the cover manually.
        console.warn('[Discogs Submitter] Skipping cover upload: unsupported URL scheme:', coverUrl);

        coverUploadFailed = true;
      }
      else if (coverUrl) {
        try {
          await this.runStep('Draft created. Uploading cover image...', async () => {
            const coverBlob = await networkRequest<Blob>({
              url: coverUrl,
              method: 'GET',
              responseType: 'blob',
            });
            const imageFormData = new FormData();

            imageFormData.append('image', coverBlob, 'cover.jpg');
            imageFormData.append('pos', '1');

            await networkRequest({
              method: 'POST',
              url: `https://www.discogs.com/release/${releaseId}/images/upload`,
              data: imageFormData,
            });
          });
        }
        catch (imageError) {
          console.error('[Discogs Submitter] Cover upload failed:', imageError);

          coverUploadFailed = true;
        }
      }

      GM_openInTab(`https://www.discogs.com/release/edit/${releaseId}`, true);

      if (coverUploadFailed) {
        this.status.set(
          'Draft created, but cover upload failed!<br /><strong><em>Please review your draft before publishing on Discogs!</em></strong>',
          'warning',
        );
      }
      else {
        this.status.restoreReady();
      }
    }
    catch (error) {
      let errorMessage = (error as Error).message || String(error);

      if (errorMessage.includes('404')) {
        errorMessage = 'This usually means you are not logged in or use Containers, Incognito, or strict tracking protection.';
      }

      this.status.set(
        `Failed to create Discogs draft:<br />${escapeHtml(errorMessage)}`,
        'error',
      );
    }
    finally {
      this.loader.setActive(false);
    }
  }

  /**
   * Runs a submission stage with its label shown in the loader for a guaranteed minimum duration.
   *
   * @template T - Return type of the awaited operation.
   * @param message - The label to display in the loader for the duration of this step.
   * @param operation - The async operation to execute.
   * @returns The resolved value of the operation.
   */
  private async runStep<T>(message: string, operation: () => Promise<T>): Promise<T> {
    this.loader.setLabel(message);

    const startTime = Date.now();
    const result = await operation();
    const elapsed = Date.now() - startTime;

    if (elapsed < MIN_STEP_DURATION_MS) {
      await new Promise<void>(resolve => setTimeout(resolve, MIN_STEP_DURATION_MS - elapsed));
    }

    return result;
  }
}
