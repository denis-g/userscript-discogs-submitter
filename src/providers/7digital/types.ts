/**
 * 7digital API artist entry.
 */
export interface SevenDigitalArtist {
  name: string;
}

/**
 * 7digital API label entry.
 */
export interface SevenDigitalLabel {
  name: string;
}

/**
 * 7digital API release metadata embedded inside each track payload.
 */
export interface SevenDigitalRelease {
  image: string;
  title: string;
  artist: SevenDigitalArtist;
  label: SevenDigitalLabel;
}

/**
 * 7digital API track entry returned by `/release/tracks`. Each item embeds the parent release.
 */
export interface SevenDigitalTrack {
  release: SevenDigitalRelease;
  artist: SevenDigitalArtist;
  title: string;
  version: string;
  duration: string;
}
