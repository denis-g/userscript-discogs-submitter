import { cleanString } from './string';

/**
 * Extracts text from multiple DOM elements matching a specific CSS selector.
 *
 * @param target - The CSS selector to match elements against.
 * @param parent - The contextual node to query inside. Defaults to `document`.
 * @param keepNewlines - Preserves `<br>` tags by replacing them with `\n` before extracting (default: false).
 * @returns An array of cleaned strings from the matched elements.
 *
 * @example
 * ```typescript
 * const texts = getManyTextFromTags('.artist-name');
 * ```
 */
export function getManyTextFromTags(target: string, parent: HTMLElement | Document | Element | null = null, keepNewlines = false): string[] {
  const context = parent || document;
  const results = Array.from(context.querySelectorAll(target));

  return results
    .map((el) => {
      if (keepNewlines) {
        const clone = el.cloneNode(true) as HTMLElement;

        clone.querySelectorAll('br').forEach((br) => {
          br.replaceWith('\n');
        });

        return cleanString(clone.textContent, false);
      }

      return cleanString(el.textContent);
    })
    .filter((text): text is string => Boolean(text));
}

/**
 * Extracts the inner text or a specific attribute value from a single DOM element.
 *
 * @param target - The CSS selector to match the element.
 * @param parent - The contextual node to query inside. Defaults to `document`.
 * @param attribute - Specific attribute to extract instead of text content (e.g. `href`, `content`).
 * @param keepNewlines - Preserves `<br>` tags by replacing them with `\n` before extracting (default: false).
 * @returns The extracted and cleaned string, or null if the element is missing or empty.
 *
 * @example
 * ```typescript
 * const url = getTextFromTag('meta[property="og:image"]', document, 'content');
 * ```
 */
export function getTextFromTag(target: string, parent: HTMLElement | Document | Element | null = null, attribute = '', keepNewlines = false): string | null {
  const context = parent || document;
  const result = context.querySelector(target);

  if (!result) {
    return null;
  }

  if (attribute) {
    return cleanString(result.getAttribute(attribute));
  }

  if (keepNewlines) {
    const clone = result.cloneNode(true) as HTMLElement;

    clone.querySelectorAll('br').forEach((br) => {
      br.replaceWith('\n');
    });

    return cleanString(clone.textContent, false);
  }

  return cleanString(result.textContent);
}
