/**
 * Resolves a value from an object tree using a dot-notation path.
 *
 * @param obj - The source object.
 * @param path - Dot-separated path (e.g., 'tracks.0.title').
 * @returns The resolved value or undefined.
 */
export function getValueByPath(obj: any, path: string): any {
  if (!path) {
    return obj;
  }

  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Sets a value in an object tree using a dot-notation path.
 * Automatically creates missing intermediate objects or arrays.
 *
 * @param obj - The root object to modify.
 * @param path - Dot-separated path (e.g., 'artists.0.name').
 * @param value - The value to set.
 */
export function setValueByPath(obj: any, path: string, value: any): void {
  if (!path) {
    return;
  }

  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];

    if (!(key in current)) {
      // If next key is a number, create an array, otherwise an object
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }

    current = current[key];
  }

  const lastKey = parts[parts.length - 1];

  current[lastKey] = value;
}
