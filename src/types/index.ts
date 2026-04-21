/**
 * Represents an individual artist credit for a track or release.
 */
export interface ArtistCredit {
  /** The normalized name of the artist. */
  name: string;
  /** The specific role the artist performed (e.g., "Remix", "Producer"). */
  role?: string;
  /** The joining string if this artist is listed alongside others (e.g., "feat.", "&", ","). */
  join?: string;
}

/**
 * Describes the audio formats supported by a specific digital store.
 */
export interface StoreFormatOptions {
  /** A list of available format names (e.g., ["MP3", "WAV", "FLAC"]). */
  formats: string[];
  /** Indicates whether the store provides hi-res/24-bit audio options. */
  hdAudio: boolean;
}

/**
 * An adapter interface for parsing release data from a specific digital store.
 */
export interface StoreAdapter {
  /** The unique identifier for the store (e.g., "bandcamp", "qobuz"). */
  id: string;
  /**
   * Tests if the adapter can handle the given URL.
   *
   * @param _url - The URL to evaluate.
   * @returns True if the URL belongs to this store.
   */
  test: (_url: string) => boolean;
  /** The CSS selector indicating where the widget button should be injected. */
  target: string;
  /**
   * Defines how to inject the parsing button into the store's DOM.
   *
   * @param _button - The button element to inject.
   * @param _target - The target element found via the target selector.
   */
  injectButton: (_button: HTMLElement, _target: HTMLElement) => void;
  /** The audio formats supported by this store. */
  supports: StoreFormatOptions;
  /**
   * Extracts the full release data from the store's current page.
   *
   * @returns A promise that resolves to the standardized release data.
   */
  parse: () => Promise<ReleaseData>;
}

/**
 * Represents the parsed data for an individual track.
 */
export interface TrackData {
  /** The track's position (e.g., "1", "A1"). */
  pos: string;
  /** The main artists credited for this track. */
  artists: ArtistCredit[];
  /** Additional contributors (e.g., remixers, producers). */
  extraartists: ArtistCredit[];
  /** The track title. */
  title: string;
  /** The track duration in MM:SS format. */
  duration: string;
  /** The track's Beats Per Minute, if available. */
  bpm?: number;
}

/**
 * Describes the physical or digital format of the Discogs release.
 */
export interface DiscogsFormat {
  /** The name of the format (e.g., "File", "Vinyl"). */
  name: string;
  /** The quantity of items in this format (e.g., "1", "2"). */
  qty: string;
  /** Additional format descriptions (e.g., ["MP3", "320 kbps"]). */
  desc: string[];
  /** Free-text description for the format. */
  text: string;
}

/**
 * Represents a label and catalog number combination in Discogs.
 */
export interface DiscogsLabel {
  /** The name of the record label. */
  name: string;
  /** The catalog number for this release. */
  catno: string;
}

/**
 * Represents a track formatted specifically for Discogs ingestion.
 */
export interface DiscogsTrack {
  /** The track's position code (e.g., "1", "A1"). */
  pos: string;
  /** The main artists credited for this track. */
  artists: ArtistCredit[];
  /** Additional contributors for this track. */
  extraartists: ArtistCredit[];
  /** The track title. */
  title: string;
  /** The track duration. */
  duration: string;
}

/**
 * Represents the structure expected by the Discogs submission payload and UI preview.
 */
export interface DiscogsPayloadData {
  /** The direct URL to the full-resolution cover image. */
  cover: string | null;
  /** The overall release title. */
  title: string;
  /** The main artists credited for the entire release. */
  artists: ArtistCredit[];
  /** Additional contributors credited for the entire release. */
  extraartists: ArtistCredit[];
  /** The release country. */
  country: string;
  /** The release date (YYYY-MM-DD or similar standard format). */
  released: string;
  /** List of labels and catalog numbers. */
  labels: DiscogsLabel[];
  /** List of formats. */
  format: DiscogsFormat[];
  /** The tracks included in the release. */
  tracks: DiscogsTrack[];
  /** Release notes (e.g., store URLs, context). */
  notes: string;
}

/**
 * The standardized raw release data parsed from a digital store.
 */
export interface ReleaseData {
  /** The direct URL to the full-resolution cover image. */
  cover: string | null;
  /** The overall release title. */
  title: string;
  /** The main artists credited for the entire release. */
  artists: ArtistCredit[];
  /** Additional contributors credited for the entire release. */
  extraartists: ArtistCredit[];
  /** The primary label name (if parsed directly). */
  label: string | null;
  /** The catalog number (if available). */
  number?: string | null;
  /** The release country. */
  country?: string | null;
  /** The release date. */
  released: string | null;
  /** The parsed tracks. */
  tracks: TrackData[];
  /** Derived labels for Discogs preview fallback. */
  labels?: Array<{ name: string; catno: string }>;
  /** Derived formats for Discogs preview fallback. */
  format?: Array<{ name: string; qty: string; desc: string[]; text: string }>;
  /** Derived notes for Discogs preview fallback. */
  notes?: string;
}

/**
 * Options configuring how the Discogs payload is built.
 */
export interface BuildPayloadOptions {
  /** The chosen audio format (e.g., "MP3", "WAV"). */
  format?: string;
  /** Whether the chosen format is high-definition (24-bit). */
  isHdAudio?: boolean;
}

/**
 * The final output required to submit a draft to Discogs.
 */
export interface DiscogsPayload {
  /** A strictly structured preview object. */
  _previewObject: DiscogsPayloadData;
  /** The JSON string representing the full submission data payload. */
  full_data: string;
  /** Additional submission notes injected into the submission flow. */
  sub_notes: string;
}
