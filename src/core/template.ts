/**
 * Traverses an object via dot-notation path.
 *
 * @param obj - Base object that contains the data.
 * @param props - Dot-separated path (e.g. "user.address.city").
 * @returns The resolved value or `undefined` if any segment is missing.
 *
 * @example
 * ```typescript
 * const data = { user: { name: 'John' } };
 * const name = chainProps(data, 'user.name'); // 'John'
 * ```
 */
function chainProps(obj: any, props: string): any {
  return !props ? obj : props.split('.').reduce((o, k) => o?.[k], obj);
}

const EVENT_NAME_RE = /^[A-Z][\w-]*$/i;
const HANDLER_NAME_RE = /^[A-Z_$][\w$]*$/i;

/**
 * Event binding internal interface.
 */
interface EventBinding {
  el: HTMLElement;
  eventName: string;
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

    return { eventName, handlerName };
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
    if (typeof events[handlerName] !== 'function' && typeof (events[handlerName] as any)?.handleEvent !== 'function') {
      throw new TypeError(`Missing event handler: ${handlerName}`);
    }
  }

  const processedElements = new Set<HTMLElement>();

  for (const { el, eventName, handlerName } of bindings) {
    el.addEventListener(eventName, events[handlerName]);
    processedElements.add(el);
  }

  // Remove data-event only after successful listener registration.
  for (const el of processedElements) {
    el.removeAttribute('data-event');
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
 * @param domEl - Insertion point in the live DOM.
 * @param options - Optional parameters.
 * @param options.replace - If true, clears the target container before rendering.
 * @param options.events - Explicit event handler map for data-event.
 *
 * @example
 * ```typescript
 * const tpl = '<div>Hello <var>name</var>!</div>';
 * renderTemplate(tpl, { name: 'World' }, document.body);
 * ```
 */
export function renderTemplate(
  template: HTMLTemplateElement | string,
  data: any,
  domEl: HTMLElement,
  { replace = false, events }: RenderOptions = {},
): void {
  // Optionally clear existing content
  if (replace) {
    domEl.textContent = '';
  }

  let templateEl: HTMLTemplateElement;

  if (typeof template === 'string') {
    templateEl = document.createElement('template');
    templateEl.innerHTML = template;
  }
  else {
    templateEl = template;
  }

  const frag = templateEl.content.cloneNode(true) as DocumentFragment;
  const eventBindings = events == null ? null : [] as EventBinding[];

  walk(frag, data, eventBindings);

  if (eventBindings && eventBindings.length > 0 && events) {
    bindCollectedEvents(eventBindings, events);
  }

  domEl.append(frag);
}

/**
 * Recursively processes a node and its children in place using declarative directives.
 *
 * @param node - The node to walk.
 * @param ctx - Current data context.
 * @param eventBindings - Collected event bindings.
 */
function walk(node: Node, ctx: any, eventBindings: EventBinding[] | null = null): void {
  // 1. Handle DocumentFragment (initial call or loop/if results)
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    for (const child of Array.from(node.childNodes)) {
      walk(child, ctx, eventBindings);
    }

    return;
  }

  // 2. Handle HTML Comments (drop them)
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentElement?.removeChild(node);

    return;
  }

  // 3. Handle Element nodes
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;

    /* --- data-if -------------------------------------------------- */
    if (el.dataset.if) {
      let expr = el.dataset.if.trim();
      let invert = false;

      if (expr.startsWith('!')) {
        invert = true;
        expr = expr.slice(1).trim();
      }

      const raw = chainProps(ctx, expr);
      let cond = Boolean(raw);

      if (invert) {
        cond = !cond;
      }

      el.removeAttribute('data-if');

      if (!cond) {
        el.remove();

        return;
      }

      // If it was a <var> wrapper or has data-unwrap, unwrap it and walk the children
      if (el.tagName === 'VAR' || 'unwrap' in el.dataset) {
        const children = Array.from(el.childNodes);
        const parent = el.parentElement;

        if (parent) {
          el.before(...children);
          el.remove();
          for (const childNode of children) {
            walk(childNode, ctx, eventBindings);
          }
        }
        else {
          // Fragment or detached node
          for (const childNode of children) {
            walk(childNode, ctx, eventBindings);
          }
        }

        return;
      }
    }

    /* --- data-loop -------------------------------------------------- */
    if (el.dataset.loop) {
      const loopExpr = el.dataset.loop;
      const src = chainProps(ctx, loopExpr);
      const processItem = (itemCtx: any) => {
        const clone = el.cloneNode(true) as HTMLElement;

        clone.removeAttribute('data-loop');

        walk(clone, itemCtx, eventBindings);

        if (el.tagName === 'VAR' || 'unwrap' in el.dataset) {
          el.before(...Array.from(clone.childNodes));
        }
        else {
          el.before(clone);
        }
      };

      if (Array.isArray(src)) {
        const len = src.length;

        for (let idx = 0; idx < len; idx++) {
          const item = src[idx];
          const baseCtx = (item && typeof item === 'object') ? { ...item } : { _value: item };
          const itemCtx = {
            ...baseCtx,
            _index: idx,
            _first: idx === 0,
            _last: idx === len - 1,
          };

          processItem(itemCtx);
        }
      }
      else if (src && typeof src === 'object') {
        const entries = Object.entries(src);

        for (let idx = 0; idx < entries.length; idx++) {
          const [key, val] = entries[idx];
          const itemCtx = Array.isArray(val)
            ? { _key: key, _value: val, _index: idx }
            : (val && typeof val === 'object' ? { ...val, _key: key, _index: idx } : { _key: key, _value: val, _index: idx });

          processItem(itemCtx);
        }
      }
      else if (src != null) {
        throw new TypeError(`data for "${loopExpr}" must be array or object`);
      }

      el.remove();

      return;
    }

    /* --- data-style -------------------------------------------------- */
    if (el.dataset.style) {
      el.dataset.style.split('|').forEach((pair) => {
        const [prop, path] = pair.split(':');
        const value = chainProps(ctx, path);

        if (value != null) {
          el.style.setProperty(prop, String(value));
        }
      });
      el.removeAttribute('data-style');
    }

    /* --- data-attr -------------------------------------------------- */
    if (el.dataset.attr) {
      el.dataset.attr.split('|').forEach((binding) => {
        const [key, path] = binding.split(':');
        const val = chainProps(ctx, path);

        if (val != null) {
          if (key === 'class') {
            const classNames = String(val).trim().split(/\s+/).filter(Boolean);

            if (classNames.length) {
              el.classList.add(...classNames);
            }
          }
          else {
            el.setAttribute(key, String(val));
          }
        }
      });
      el.removeAttribute('data-attr');
    }

    /* --- data-text -------------------------------------------------- */
    if (el.dataset.text != null) {
      const path = el.dataset.text.trim();
      const value = path === ''
        ? (ctx && typeof ctx === 'object' && '_value' in ctx ? ctx._value : ctx)
        : chainProps(ctx, path);

      el.textContent = value != null ? String(value) : '';
      el.removeAttribute('data-text');
    }

    /* --- <var> placeholders (element version) ---------------------- */
    if (el.tagName === 'VAR') {
      if (!el.firstElementChild) {
        const path = el.textContent?.trim() || '';
        const value = path === ''
          ? (ctx && typeof ctx === 'object' && '_value' in ctx ? ctx._value : ctx)
          : chainProps(ctx, path);

        el.replaceWith(document.createTextNode(value != null ? String(value) : ''));

        return;
      }
    }

    if (el.tagName === 'VAR' || 'unwrap' in el.dataset) {
      // If it's a wrapper that reached here (no data-if/loop/placeholder), unwrap it
      const children = Array.from(el.childNodes);
      const parent = el.parentElement;

      if (parent) {
        el.before(...children);
        el.remove();

        for (const childNode of children) {
          walk(childNode, ctx, eventBindings);
        }
      }
      else {
        for (const childNode of children) {
          walk(childNode, ctx, eventBindings);
        }
      }

      return;
    }

    /* --- data-event ------------------------------------------------- */
    if (eventBindings && el.dataset.event) {
      const parsed = parseDataEventDeclaration(el.dataset.event);

      for (const { eventName, handlerName } of parsed) {
        eventBindings.push({ el, eventName, handlerName });
      }
    }

    // Normal element → recurse into its children
    for (const child of Array.from(el.childNodes)) {
      walk(child, ctx, eventBindings);
    }
  }
}
