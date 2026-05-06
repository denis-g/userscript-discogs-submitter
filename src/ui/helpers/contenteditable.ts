/**
 * Utility for handling standard behaviors in ContentEditable elements.
 * Prevents rich-text formatting and standardizes keyboard interaction.
 */
export const ContentEditable = {
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
    // Prevent Enter key from creating new lines in single-line editable fields
    if (event.key === 'Enter') {
      event.preventDefault();

      (event.target as HTMLElement).blur();
    }

    // Stop propagation to prevent accidental widget closure or global shortcuts
    event.stopPropagation();
  },
};
