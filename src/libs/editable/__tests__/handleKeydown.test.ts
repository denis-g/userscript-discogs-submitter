// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { EditableHelper } from '..';

/** Builds a fake KeyboardEvent whose target is a `<textarea>`, optionally marked multiline. */
function buildKeydownEvent(key: string, multiline: boolean) {
  const target = document.createElement('textarea');

  if (multiline) {
    target.classList.add('is-multiline');
  }

  const blur = vi.spyOn(target, 'blur');
  const event = {
    key,
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;

  return { event, blur };
}

describe('editableHelper.handleKeydown', () => {
  it('commits a single-line field on Enter (preventDefault + blur)', () => {
    const { event, blur } = buildKeydownEvent('Enter', false);

    EditableHelper.handleKeydown(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(blur).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('keeps the newline on Enter in a multiline field (no blur)', () => {
    const { event, blur } = buildKeydownEvent('Enter', true);

    EditableHelper.handleKeydown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(blur).not.toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('stops propagation but does not commit on non-Enter keys', () => {
    const { event, blur } = buildKeydownEvent('a', false);

    EditableHelper.handleKeydown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(blur).not.toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });
});
