/**
 * Resolves a value from an object tree using a dot-notation path.
 *
 * @template T - The expected return type.
 * @param object - The source object.
 * @param path - Dot-separated path (e.g., 'tracks.0.title').
 * @returns The resolved value or undefined.
 *
 * @example
 * ```typescript
 * const data = { user: { name: 'John' } };
 * const name = getValueByPath<string>(data, 'user.name'); // 'John'
 * ```
 */
export function getValueByPath<T = any>(object: any, path: string): T | undefined {
  if (!path) {
    return object;
  }

  return path.split('.').reduce((accumulator, key) => accumulator?.[key], object) as T;
}

/**
 * Sets a value in an object tree using a dot-notation path.
 * Automatically creates missing intermediate objects or arrays.
 *
 * @param object - The root object to modify.
 * @param path - Dot-separated path (e.g., 'artists.0.name').
 * @param value - The value to set.
 *
 * @example
 * ```typescript
 * const data = {};
 * setValueByPath(data, 'user.name', 'John');
 * // data is now { user: { name: 'John' } }
 * ```
 */
export function setValueByPath(object: any, path: string, value: any): void {
  if (!path) {
    return;
  }

  const parts = path.split('.');
  const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);

  if (parts.some(part => forbiddenKeys.has(part))) {
    return;
  }

  let current = object;

  for (let index = 0; index < parts.length - 1; index++) {
    const key = parts[index];
    const nextKey = parts[index + 1];

    if (!(key in current)) {
      // If next key is a number, create an array, otherwise an object
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }

    current = current[key];
  }

  const lastKey = parts[parts.length - 1];

  current[lastKey] = value;
}
