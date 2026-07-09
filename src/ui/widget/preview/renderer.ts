import type { PreviewRenderOptions } from './types';
import type { ArtistCredit, DiscogsPayloadData, ReleaseData } from '@/types';
import { FILE_FORMATS, RELEASE_TYPES } from '@/config';
import { ALLOWED_COUNTRIES } from '@/config/countries';
import { renderTemplate } from '@/libs/template';
import template from './template.html?raw';

/**
 * Builds the preview template's data object from the prepared payload and edit state,
 * then renders it into the container. Pure data-shaping — no controller state, no DOM
 * mutation outside the target container.
 *
 * @param release - The prepared preview payload from `DiscogsMapper`.
 * @param options - UI configuration (selected format/descriptions/free text, supported formats).
 * @param container - Target DOM node receiving the rendered fragment.
 * @param editedData - The current edited release data (used to populate editable fields).
 * @param addedEntries - Set of artist/credit entries the user added; they cannot be restored.
 */
export async function renderFragment(
  release: DiscogsPayloadData,
  options: PreviewRenderOptions,
  container: HTMLElement,
  editedData: ReleaseData,
  addedEntries: WeakSet<ArtistCredit>,
): Promise<void> {
  const { selectedFormat, selectedDescriptions, formatText, supports } = options;
  const tracks = release.tracks || [];
  const releaseArtists = editedData.artists || [];
  // The mapper empties track artists in the payload when they all match the release artists.
  // In that case we hide the duplicated name fields but still expose the per-track "add" button.
  const showTrackArtists = tracks.some(track => (track.artists || []).length > 0);
  const data = {
    ...release,
    releaseArtists: releaseArtists.map((artist, index) => ({
      ...artist,
      _index: index,
      _last: index === releaseArtists.length - 1,
      _canRestore: !addedEntries.has(artist),
      // A release must keep at least one artist, so the last remaining one cannot be removed.
      _canRemove: releaseArtists.length > 1,
    })),
    rawTitle: editedData.title,
    rawLabel: editedData.label || '',
    rawNumber: editedData.number || 'none',
    rawReleased: editedData.released || '',
    rawCountry: editedData.country || '',
    // Release-level credits (extraartists) from editedData
    rawExtraartists: (editedData.extraartists || []).map((credit, index) => ({
      ...credit,
      _index: index,
      _canRestore: !addedEntries.has(credit),
    })),
    rawNotes: editedData.notes,
    rawSubmissionNotes: editedData.submissionNotes,
    availableCountries: ALLOWED_COUNTRIES.map(country => ({
      _value: country,
      isSelected: country === editedData.country,
    })),
    selectedFormat,
    availableFormats: (supports.formats || FILE_FORMATS).map(format => ({
      _value: format,
      isSelected: format === selectedFormat,
    })),
    formatText,
    availableDescriptions: RELEASE_TYPES.map(type => ({
      _value: type,
      isSelected: selectedDescriptions.includes(type),
    })),
    // Prepared tracklist data
    tracks: tracks.map((track, trackIndex) => {
      const rawTrack = editedData.tracks[trackIndex];

      return {
        ...track,
        // Track-level artists from editedData
        trackArtists: (rawTrack?.artists || []).map((artist, artistIndex) => ({
          ...artist,
          _trackIndex: trackIndex,
          _index: artistIndex,
          _last: artistIndex === (rawTrack?.artists || []).length - 1,
          _canRestore: !addedEntries.has(artist),
        })),
        // Track-level credits from editedData
        trackExtraartists: (rawTrack?.extraartists || []).map((credit, creditIndex) => ({
          ...credit,
          _trackIndex: trackIndex,
          _index: creditIndex,
          _canRestore: !addedEntries.has(credit),
        })),
        showTrackArtists,
        _index: trackIndex,
      };
    }),
  };

  renderTemplate(template, data, container, { replace: true });
}
