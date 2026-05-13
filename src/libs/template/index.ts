import { getValueByPath } from '@/utils/object';

const EVENT_NAME_RE = /^[A-Z][\w-]*$/i;
const HANDLER_NAME_RE = /^[A-Z_$][\w$]*$/i;

/**
 * Event binding internal interface.
 */
interface EventBinding {
  /** Target element for the event. */
  element: HTMLElement;
  /** Name of the DOM event (e.g., 'click'). */
  eventName: string;
  /** Name of the handler function in the events map. */
  handlerName: string;
}

/**
 * Rendering options.
 */
export interface RenderOptions {
  /** If true, clears the target container before rendering. */
  replace?: boolean;
  /** Explicit event handler map for data-event. */
  events?: Record<string, EventListenerOrEventListenerObject>;
}

/**
 * Parses data-event declarations like "click:onSave|mouseenter:onEnter".
 *
 * @param declaration - The data-event string.
 * @returns Array of event bindings.
 */
function parseDataEventDeclaration(declaration: string): Array<{ eventName: string; handlerName: string }> {
  const source = declaration.trim();

  if (!source) {
    throw new TypeError('Invalid data-event declaration: empty value');
  }

  return source.split('|').map((rawBinding) => {
    const binding = rawBinding.trim();
    const parts = binding.split(':').map(part => part.trim());
    const [eventName, handlerName] = parts;

    if (
      parts.length !== 2
      || !EVENT_NAME_RE.test(eventName)
      || !HANDLER_NAME_RE.test(handlerName)
    ) {
      throw new TypeError(`Invalid data-event declaration: "${binding}"`);
    }

    return {
      eventName,
      handlerName,
    };
  });
}

/**
 * Registers event listeners collected during rendering.
 *
 * @param bindings - Collected event bindings.
 * @param events - Event handlers map.
 */
function bindCollectedEvents(bindings: EventBinding[], events: Record<string, EventListenerOrEventListenerObject>): void {
  if (!events || typeof events !== 'object') {
    throw new TypeError('options.events must be an object');
  }

  // Validate all handlers before mutating the rendered tree.
  for (const { handlerName } of bindings) {
    const handler = events[handlerName] as EventListenerOrEventListenerObject | undefined;

    if (typeof handler !== 'function' && typeof (handler as EventListenerObject | undefined)?.handleEvent !== 'function') {
      throw new TypeError(`Missing event handler: ${handlerName}`);
    }
  }

  const processedElements = new Set<HTMLElement>();

  for (const { element, eventName, handlerName } of bindings) {
    element.addEventListener(eventName, events[handlerName]);

    processedElements.add(element);
  }

  // Remove data-event only after successful listener registration.
  for (const element of processedElements) {
    element.removeAttribute('data-event');
  }
}

/**
 * Renders a <template> element into live DOM using declarative directives.
 *
 * Supported directives:
 *   • data-loop="items"   – repeats element for each entry in data.items or object maps
 *   • data-if="expr"      – conditionally render elements based on boolean expressions
 *   • data-attr="src:path"– sets HTML attributes (e.g., src, href, alt) from data.path
 *   • data-style="prop:path" – sets CSS style properties on elements from data.path
 *   • data-event="event:handler|..." – binds events from an explicit events map
 *   • <var>path</var>     – text placeholders resolved from data, including within loops
 *
 * @param template - The <template> node or HTML string to instantiate.
 * @param data - Arbitrary data object for binding.
 * @param domElement - Insertion point in the live DOM.
 * @param options - Optional parameters.
 * @param options.replace - If true, clears the target container before rendering.
 * @param options.events - Explicit event handler map for data-event.
 *
 * @example
 * ```typescript
 * const template = '<div>Hello <var>name</var>!</div>';
 * renderTemplate(template, { name: 'World' }, document.body);
 * ```
 */
export function renderTemplate(template: HTMLTemplateElement | string, data: any, domElement: HTMLElement, { replace = false, events }: RenderOptions = {}): void {
  // Optionally clear existing content
  if (replace) {
    domElement.textContent = '';
  }

  let templateElement: HTMLTemplateElement;

  if (typeof template === 'string') {
    templateElement = document.createElement('template');

    templateElement.innerHTML = template;
  }
  else {
    templateElement = template;
  }

  const fragment = templateElement.content.cloneNode(true) as DocumentFragment;
  const eventBindings = events == null ? null : [] as EventBinding[];

  walk(fragment, data, eventBindings);

  if (eventBindings && eventBindings.length > 0 && events) {
    bindCollectedEvents(eventBindings, events);
  }

  domElement.append(fragment);
}

/**
 * Directive processor type definition.
 *
 * @param _element - The element being processed.
 * @param _context - Current data context.
 * @param _walk - The recursion function.
 * @param _eventBindings - Collected event bindings list.
 * @returns True if processing should stop for the current element.
 */
type DirectiveProcessor = (_element: HTMLElement, _context: any, _walk: (_node: Node, _context: any, _eventBindings: EventBinding[] | null) => void, _eventBindings: EventBinding[] | null) => boolean;

/**
 * Processes data-if directive.
 *
 * @param element - The element to check for data-if.
 * @param context - Current data context.
 * @param walk - The recursion function.
 * @param eventBindings - Collected event bindings.
 * @returns True if the element was removed or unwrapped.
 */
const processIf: DirectiveProcessor = (element, context, walk, eventBindings) => {
  if (!element.dataset.if) {
    return false;
  }

  let expression = element.dataset.if.trim();
  let invert = false;

  if (expression.startsWith('!')) {
    invert = true;
    expression = expression.slice(1).trim();
  }

  const rawValue = getValueByPath(context, expression);
  let condition = Boolean(rawValue);

  if (invert) {
    condition = !condition;
  }

  element.removeAttribute('data-if');

  if (!condition) {
    element.remove();

    return true;
  }

  // If it was a <var> wrapper or has data-unwrap, unwrap it and walk the children
  if (element.tagName === 'VAR' || 'unwrap' in element.dataset) {
    const children = Array.from(element.childNodes);
    const parent = element.parentElement;

    if (parent) {
      element.before(...children);
      element.remove();

      for (const childNode of children) {
        walk(childNode, context, eventBindings);
      }
    }
    else {
      for (const childNode of children) {
        walk(childNode, context, eventBindings);
      }
    }

    return true;
  }

  return false;
};
/**
 * Processes data-loop directive.
 *
 * @param element - The element to repeat.
 * @param context - Current data context.
 * @param walk - The recursion function.
 * @param eventBindings - Collected event bindings.
 * @returns Always true as the original element is removed.
 */
const processLoop: DirectiveProcessor = (element, context, walk, eventBindings) => {
  if (!element.dataset.loop) {
    return false;
  }

  const loopExpression = element.dataset.loop;
  const source = getValueByPath(context, loopExpression);
  const processItem = (itemContext: any) => {
    const clone = element.cloneNode(true) as HTMLElement;

    clone.removeAttribute('data-loop');

    walk(clone, itemContext, eventBindings);

    if (element.tagName === 'VAR' || 'unwrap' in element.dataset) {
      element.before(...Array.from(clone.childNodes));
    }
    else {
      element.before(clone);
    }
  };

  if (Array.isArray(source)) {
    const length = source.length;

    for (let index = 0; index < length; index++) {
      const item = source[index];
      const baseContext = (item && typeof item === 'object') ? { ...item } : { _value: item };
      const itemContext = {
        _value: item,
        ...baseContext,
        _index: index,
        _first: index === 0,
        _last: index === length - 1,
      };

      processItem(itemContext);
    }
  }
  else if (source && typeof source === 'object') {
    const entries = Object.entries(source);

    for (let index = 0; index < entries.length; index++) {
      const [key, value] = entries[index];
      const itemContext = Array.isArray(value)
        ? { _key: key, _value: value, _index: index }
        : (value && typeof value === 'object'
            ? { _value: value, ...value, _key: key, _index: index }
            : { _key: key, _value: value, _index: index });

      processItem(itemContext);
    }
  }
  else if (source != null) {
    throw new TypeError(`data for "${loopExpression}" must be array or object`);
  }

  element.remove();

  return true;
};
/**
 * Processes data-style directive.
 *
 * @param element - The element to apply styles to.
 * @param context - Current data context.
 * @returns Always false.
 */
const processStyle: DirectiveProcessor = (element, context) => {
  if (!element.dataset.style) {
    return false;
  }

  element.dataset.style.split('|').forEach((pair) => {
    const [property, path] = pair.split(':');
    const value = getValueByPath(context, path);

    if (value != null) {
      element.style.setProperty(property, String(value));
    }
  });

  element.removeAttribute('data-style');

  return false;
};
/**
 * Processes data-attr directive.
 *
 * @param element - The element to apply attributes to.
 * @param context - Current data context.
 * @returns Always false.
 */
const processAttr: DirectiveProcessor = (element, context) => {
  if (!element.dataset.attr) {
    return false;
  }

  element.dataset.attr.split('|').forEach((binding) => {
    const [key, path] = binding.split(':');
    const value = getValueByPath(context, path);

    if (value != null) {
      if (key === 'class') {
        const classNames = String(value).trim().split(/\s+/).filter(Boolean);

        if (classNames.length) {
          element.classList.add(...classNames);
        }
      }
      else {
        element.setAttribute(key, String(value));
      }
    }
  });

  element.removeAttribute('data-attr');

  return false;
};
/**
 * Processes data-text directive.
 *
 * @param element - The element to set text content for.
 * @param context - Current data context.
 * @returns Always false.
 */
const processText: DirectiveProcessor = (element, context) => {
  if (element.dataset.text == null) {
    return false;
  }

  const path = element.dataset.text.trim();
  const value = path === ''
    ? (context && typeof context === 'object' && '_value' in context ? context._value : context)
    : getValueByPath(context, path);

  element.textContent = value != null ? String(value) : '';

  element.removeAttribute('data-text');

  return false;
};
/**
 * Processes data-event directive.
 *
 * @param element - The element to collect events from.
 * @param context - Current data context.
 * @param walk - The recursion function.
 * @param eventBindings - Collected event bindings.
 * @returns Always false.
 */
const processEvent: DirectiveProcessor = (element, context, walk, eventBindings) => {
  if (!eventBindings || !element.dataset.event) {
    return false;
  }

  const parsed = parseDataEventDeclaration(element.dataset.event);

  for (const { eventName, handlerName } of parsed) {
    eventBindings.push({
      element,
      eventName,
      handlerName,
    });
  }

  return false;
};
/**
 * Processes <var> placeholders and data-unwrap.
 *
 * @param element - The element to process as a placeholder or unwrap.
 * @param context - Current data context.
 * @param walk - The recursion function.
 * @param eventBindings - Collected event bindings.
 * @returns True if the element was replaced or unwrapped.
 */
const processVar: DirectiveProcessor = (element, context, walk, eventBindings) => {
  if (element.tagName === 'VAR' && !element.firstElementChild) {
    const path = element.textContent?.trim() || '';
    const value = path === ''
      ? (context && typeof context === 'object' && '_value' in context ? context._value : context)
      : getValueByPath(context, path);

    element.replaceWith(document.createTextNode(value != null ? String(value) : ''));

    return true;
  }

  if (element.tagName === 'VAR' || 'unwrap' in element.dataset) {
    const children = Array.from(element.childNodes);
    const parent = element.parentElement;

    if (parent) {
      element.before(...children);
      element.remove();

      for (const childNode of children) {
        walk(childNode, context, eventBindings);
      }
    }
    else {
      for (const childNode of children) {
        walk(childNode, context, eventBindings);
      }
    }

    return true;
  }

  return false;
};

/**
 * Recursively processes a node and its children in place using declarative directives.
 *
 * @param node - The node to walk.
 * @param context - Current data context.
 * @param eventBindings - Collected event bindings.
 */
function walk(node: Node, context: any, eventBindings: EventBinding[] | null = null): void {
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    for (const child of Array.from(node.childNodes)) {
      walk(child, context, eventBindings);
    }

    return;
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentElement?.removeChild(node);

    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;

    // Ordered processors: Control flow first, then decorators, then placeholders/unwrapping
    if (processIf(element, context, walk, eventBindings)) {
      return;
    }

    if (processLoop(element, context, walk, eventBindings)) {
      return;
    }

    processStyle(element, context, walk, eventBindings);
    processAttr(element, context, walk, eventBindings);
    processText(element, context, walk, eventBindings);
    processEvent(element, context, walk, eventBindings);

    if (processVar(element, context, walk, eventBindings)) {
      return;
    }

    // Normal element -> recurse into its children
    for (const child of Array.from(element.childNodes)) {
      walk(child, context, eventBindings);
    }
  }
}
