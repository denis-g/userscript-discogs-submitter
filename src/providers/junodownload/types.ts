/**
 * Juno Download API artist entry (shared between release- and track-level credits).
 */
export interface JunoArtist {
  name: string;
}

/**
 * Juno Download API label entry.
 */
export interface JunoLabel {
  name: string;
}

/**
 * Juno Download API track entry. Each item carries release-wide fields (`releaseArtists`,
 * `releaseTitle`, `label`) alongside track-specific ones.
 */
export interface JunoTrackItem {
  releaseArtists: JunoArtist[];
  releaseTitle: string;
  label: JunoLabel;
  artists: JunoArtist[];
  title: string;
  version: string;
  length: string;
  bpm?: number;
}
