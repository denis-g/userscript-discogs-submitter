/**
 * Utility for standardizing keyboard interaction in editable form fields.
 */
export const EditableHelper = {
  /**
   * Standardizes keyboard events for editable fields.
   * Prevents line breaks and handles propagation.
   *
   * Every editable field is a `<textarea>` so long values wrap instead of overflowing.
   * Fields marked `is-multiline` (release/submission notes) keep native newline behavior;
   * every other field is single-line-with-wrap, so Enter commits the value (blurs) instead
   * of inserting a line break.
   *
   * @param event - The KeyboardEvent.
   */
  handleKeydown: (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    const isMultiline = target.classList.contains('is-multiline');

    // Enter commits single-line fields (blur); only multiline notes accept a real line break.
    if (event.key === 'Enter' && !isMultiline) {
      event.preventDefault();

      target.blur();
    }

    // Stop propagation to prevent accidental widget closure or global shortcuts
    event.stopPropagation();
  },
};
