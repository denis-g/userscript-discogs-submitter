import { cleanString } from '@/utils';

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
export function getManyTextFromTags(
  target: string,
  parent: HTMLElement | Document | Element | null = null,
  keepNewlines = false,
): string[] {
  const context = parent || document;
  const results = Array.from(context.querySelectorAll(target));

  return results
    .map((element) => {
      if (keepNewlines) {
        const clone = element.cloneNode(true) as HTMLElement;

        clone.querySelectorAll('br').forEach((breakElement) => {
          breakElement.replaceWith('\n');
        });

        return cleanString(clone.textContent, false);
      }

      return cleanString(element.textContent);
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
 * @param visible - Whether to only extract text from immediate child text nodes (default: false).
 * @returns The extracted and cleaned string, or null if the element is missing or empty.
 *
 * @example
 * ```typescript
 * const url = getTextFromTag('meta[property="og:image"]', document, 'content');
 * ```
 */
export function getTextFromTag(
  target: string,
  parent: HTMLElement | Document | Element | ShadowRoot | null = null,
  attribute = '',
  keepNewlines = false,
  visible = false,
): string | null {
  const context = parent || document;
  const result = context.querySelector(target);
  let output = null;

  if (!result) {
    return null;
  }

  if (attribute) {
    output = cleanString(result.getAttribute(attribute));

    return output;
  }

  let elementToProcess: Element = result;

  if (keepNewlines) {
    const clone = result.cloneNode(true) as HTMLElement;

    clone.querySelectorAll('br').forEach((breakElement) => {
      breakElement.replaceWith('\n');
    });

    elementToProcess = clone;
  }

  if (visible) {
    output = getVisibleText(elementToProcess);
  }
  else {
    output = elementToProcess.textContent;
  }

  return cleanString(output, !keepNewlines);
}

/**
 * Extracts text only from immediate text nodes of a DOM element, ignoring text within nested child elements.
 * Note: This includes text that might be hidden via CSS (display: none, etc.) as long as it is a direct child.
 *
 * @param element - The DOM element to extract text from.
 * @returns The joined text from direct text nodes, or null if the element is missing or contains no child nodes.
 *
 * @example
 * ```typescript
 * // HTML: <div id="container">Direct text<span>Nested text</span></div>
 * const text = getVisibleText(document.querySelector('#container'));
 * console.log(text); // 'Direct text'
 * ```
 */
export function getVisibleText(element: HTMLElement | Element | null): string | null {
  if (element && element.childNodes.length > 0) {
    const text = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent || '')
      .join('');

    return text;
  }

  return null;
}
