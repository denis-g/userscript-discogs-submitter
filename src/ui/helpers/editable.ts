/**
 * Utility for handling standard behaviors in EditableHelper elements.
 * Prevents rich-text formatting and standardizes keyboard interaction.
 */
export const EditableHelper = {
  /**
   * Handles the 'paste' event to ensure only plain text is inserted.
   *
   * @param event - The ClipboardEvent.
   */
  handlePaste: (event: ClipboardEvent): void => {
    event.preventDefault();

    const text = (event.clipboardData || (unsafeWindow as any).clipboardData).getData('text/plain');

    document.execCommand('insertText', false, text);
  },

  /**
   * Standardizes keyboard events for editable fields.
   * Prevents line breaks and handles propagation.
   *
   * @param event - The KeyboardEvent.
   */
  handleKeydown: (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    const isTextArea = target.classList.contains('discogs-submitter__textarea');

    // Prevent Enter key from creating new lines in single-line editable fields
    if (event.key === 'Enter' && !isTextArea) {
      event.preventDefault();
      target.blur();
    }

    // Stop propagation to prevent accidental widget closure or global shortcuts
    event.stopPropagation();
  },
};
