/**
 * Resolves the full dot-notation data path from an element's `data-field`, `data-index`,
 * and `data-subindex` attributes. Maps the template-level field shorthand to the actual
 * path in `editedData` (e.g. `tracks.artists` + indices → `tracks.<i>.artists.<j>.name`).
 *
 * @param element - The preview element carrying path metadata.
 * @returns The dot-notation path, or an empty string when the element has no `data-field`.
 */
export function resolvePath(element: HTMLElement): string {
  const field = element.dataset.field;

  if (!field) {
    return '';
  }

  const indexStr = element.dataset.index;
  const indices = indexStr
    ? indexStr.split('|').map(segment => Number.parseInt(segment, 10))
    : [];
  const subindex = element.dataset.subindex
    ? Number.parseInt(element.dataset.subindex, 10)
    : null;

  // Special case: formatText lives in widget state, not in editedData
  if (field === 'formatText') {
    return 'formatText';
  }

  // Map template field shorthand → actual data path
  if (field === 'artists.name') {
    return `artists.${indices[0]}.name`;
  }

  if (field === 'extraartists.name') {
    return `extraartists.${indices[0]}.name`;
  }

  if (field.startsWith('tracks.')) {
    const trackIdx = indices[0];
    const trackField = field.split('.')[1];

    if (trackField === 'artists' || trackField === 'extraartists') {
      return `tracks.${trackIdx}.${trackField}.${subindex}.name`;
    }

    return `tracks.${trackIdx}.${trackField}`;
  }

  return field;
}
