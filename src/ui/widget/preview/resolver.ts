/**
 * Reads the `data-index` (pipe-separated) and `data-subindex` attributes from a preview element.
 *
 * @param element - The preview element carrying index metadata.
 * @returns The parsed primary indices and the optional subindex.
 */
function readIndices(element: HTMLElement): { indices: number[]; subindex: number | null } {
  const indexStr = element.dataset.index;
  const indices = indexStr
    ? indexStr.split('|').map(segment => Number.parseInt(segment, 10))
    : [];
  const subindex = element.dataset.subindex
    ? Number.parseInt(element.dataset.subindex, 10)
    : null;

  return { indices, subindex };
}

/**
 * Resolves the full dot-notation data path from an element's `data-field`, `data-index`,
 * and `data-subindex` attributes. Maps the template-level field shorthand to the actual
 * path in `editedData` (e.g. `tracks.artists.name` + indices → `tracks.<i>.artists.<j>.name`).
 * Both the `name` and `role` leaves are supported for credit entries.
 *
 * @param element - The preview element carrying path metadata.
 * @returns The dot-notation path, or an empty string when the element has no `data-field`.
 */
export function resolvePath(element: HTMLElement): string {
  const field = element.dataset.field;

  if (!field) {
    return '';
  }

  const { indices, subindex } = readIndices(element);

  // Special case: formatText lives in widget state, not in editedData
  if (field === 'formatText') {
    return 'formatText';
  }

  // Release-level collections: `artists.<leaf>`, `extraartists.<leaf>`
  if (field === 'artists.name' || field === 'artists.join' || field === 'extraartists.name' || field === 'extraartists.role') {
    const [collection, leaf] = field.split('.');

    return `${collection}.${indices[0]}.${leaf}`;
  }

  if (field.startsWith('tracks.')) {
    const [, collection, leaf] = field.split('.');

    if (collection === 'artists' || collection === 'extraartists') {
      return `tracks.${indices[0]}.${collection}.${subindex}.${leaf || 'name'}`;
    }

    return `tracks.${indices[0]}.${collection}`;
  }

  return field;
}

/**
 * Resolves the dot-notation path of the array an "add" button targets. The button carries the
 * collection shorthand in `data-field` (`artists`, `extraartists`, `tracks.artists`,
 * `tracks.extraartists`) and, for track-level collections, the track index in `data-index`.
 *
 * @param element - The add button carrying collection metadata.
 * @returns The dot-notation array path, or an empty string when the field is not a known collection.
 */
export function resolveCollectionPath(element: HTMLElement): string {
  const field = element.dataset.field;

  if (field === 'artists' || field === 'extraartists') {
    return field;
  }

  if (field === 'tracks.artists' || field === 'tracks.extraartists') {
    const { indices } = readIndices(element);
    const collection = field.split('.')[1];

    return `tracks.${indices[0]}.${collection}`;
  }

  return '';
}

/**
 * Resolves the array and entry index a "remove" button targets. The button shares the same
 * `data-field`/`data-index`/`data-subindex` as its sibling name field, so its resolved leaf path
 * (e.g. `tracks.2.artists.1.name`) is reduced to the parent array (`tracks.2.artists`) and index (`1`).
 *
 * @param element - The remove button carrying entry metadata.
 * @returns The array path and entry index, or `null` when the path cannot be resolved.
 */
export function resolveEntryRemoval(element: HTMLElement): { arrayPath: string; index: number } | null {
  const path = resolvePath(element);

  if (!path) {
    return null;
  }

  const parts = path.split('.');

  // Drop the leaf (name/role); the next-to-last segment is the entry index.
  parts.pop();

  const index = Number.parseInt(parts.pop() ?? '', 10);

  if (Number.isNaN(index) || parts.length === 0) {
    return null;
  }

  return { arrayPath: parts.join('.'), index };
}
