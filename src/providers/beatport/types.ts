/**
 * Beatport API artist entry.
 */
export interface BeatportArtist {
  name: string;
}

/**
 * Beatport API label entry.
 */
export interface BeatportLabel {
  name: string;
}

/**
 * Beatport API image variants.
 * `dynamic_uri` accepts `{w}` and `{h}` placeholders for arbitrary size requests.
 */
export interface BeatportImage {
  dynamic_uri: string;
  uri: string;
}

/**
 * Beatport API track entry.
 */
export interface BeatportTrack {
  name: string;
  mix_name: string;
  artists: BeatportArtist[];
  length: string;
  bpm: number;
}

/**
 * Beatport API release metadata (without the separately-fetched track list).
 */
export interface BeatportRelease {
  image: BeatportImage;
  artists: BeatportArtist[];
  name: string;
  label: BeatportLabel;
  catalog_number: string;
  publish_date: string;
}

/**
 * Combined Beatport release payload (metadata merged with the track results array).
 */
export interface BeatportReleaseData extends BeatportRelease {
  tracks: BeatportTrack[];
}
