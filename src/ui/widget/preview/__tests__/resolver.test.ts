// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { resolveCollectionPath, resolveEntryRemoval, resolvePath } from '../resolver';

/**
 * Builds a detached element carrying the given `data-*` attributes, mirroring how the
 * preview template emits field/add/remove controls.
 *
 * @param dataset - The dataset values to assign.
 * @param dataset.field - The `data-field` shorthand.
 * @param dataset.index - The pipe-separated `data-index` value.
 * @param dataset.subindex - The `data-subindex` value.
 * @returns A configured `HTMLElement`.
 */
function createElement(dataset: { field?: string; index?: string; subindex?: string }): HTMLElement {
  const element = document.createElement('span');

  if (dataset.field !== undefined) {
    element.dataset.field = dataset.field;
  }

  if (dataset.index !== undefined) {
    element.dataset.index = dataset.index;
  }

  if (dataset.subindex !== undefined) {
    element.dataset.subindex = dataset.subindex;
  }

  return element;
}

describe('resolvePath', () => {
  it('returns an empty string when no field is present', () => {
    expect(resolvePath(createElement({}))).toBe('');
  });

  it('resolves the formatText special case', () => {
    expect(resolvePath(createElement({ field: 'formatText' }))).toBe('formatText');
  });

  it('resolves release artist names and joins', () => {
    expect(resolvePath(createElement({ field: 'artists.name', index: '0' }))).toBe('artists.0.name');
    expect(resolvePath(createElement({ field: 'artists.join', index: '0' }))).toBe('artists.0.join');
  });

  it('resolves release credit names and roles', () => {
    expect(resolvePath(createElement({ field: 'extraartists.name', index: '2' }))).toBe('extraartists.2.name');
    expect(resolvePath(createElement({ field: 'extraartists.role', index: '2' }))).toBe('extraartists.2.role');
  });

  it('resolves track artist names and joins', () => {
    expect(resolvePath(createElement({ field: 'tracks.artists.name', index: '3', subindex: '1' }))).toBe('tracks.3.artists.1.name');
    expect(resolvePath(createElement({ field: 'tracks.artists.join', index: '3', subindex: '1' }))).toBe('tracks.3.artists.1.join');
  });

  it('resolves track credit names and roles', () => {
    expect(resolvePath(createElement({ field: 'tracks.extraartists.name', index: '3', subindex: '1' }))).toBe('tracks.3.extraartists.1.name');
    expect(resolvePath(createElement({ field: 'tracks.extraartists.role', index: '3', subindex: '1' }))).toBe('tracks.3.extraartists.1.role');
  });

  it('resolves scalar track fields', () => {
    expect(resolvePath(createElement({ field: 'tracks.title', index: '4' }))).toBe('tracks.4.title');
  });
});

describe('resolveCollectionPath', () => {
  it('resolves release-level collections', () => {
    expect(resolveCollectionPath(createElement({ field: 'artists' }))).toBe('artists');
    expect(resolveCollectionPath(createElement({ field: 'extraartists' }))).toBe('extraartists');
  });

  it('resolves track-level collections using the track index', () => {
    expect(resolveCollectionPath(createElement({ field: 'tracks.artists', index: '2' }))).toBe('tracks.2.artists');
    expect(resolveCollectionPath(createElement({ field: 'tracks.extraartists', index: '5' }))).toBe('tracks.5.extraartists');
  });

  it('returns an empty string for unknown or leaf fields', () => {
    expect(resolveCollectionPath(createElement({ field: 'artists.name', index: '0' }))).toBe('');
    expect(resolveCollectionPath(createElement({}))).toBe('');
  });
});

describe('resolveEntryRemoval', () => {
  it('reduces a release artist leaf path to its array and index', () => {
    expect(resolveEntryRemoval(createElement({ field: 'artists.name', index: '1' }))).toEqual({ arrayPath: 'artists', index: 1 });
  });

  it('reduces a release credit leaf path to its array and index', () => {
    expect(resolveEntryRemoval(createElement({ field: 'extraartists.name', index: '3' }))).toEqual({ arrayPath: 'extraartists', index: 3 });
  });

  it('reduces a track artist leaf path to its nested array and index', () => {
    expect(resolveEntryRemoval(createElement({ field: 'tracks.artists.name', index: '2', subindex: '1' }))).toEqual({ arrayPath: 'tracks.2.artists', index: 1 });
  });

  it('reduces a track credit leaf path to its nested array and index', () => {
    expect(resolveEntryRemoval(createElement({ field: 'tracks.extraartists.name', index: '0', subindex: '4' }))).toEqual({ arrayPath: 'tracks.0.extraartists', index: 4 });
  });

  it('returns null when no field is present', () => {
    expect(resolveEntryRemoval(createElement({}))).toBeNull();
  });
});
