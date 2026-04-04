export interface ArtistCredit {
  name: string;
  role?: string;
  join?: string;
}

export interface StoreFormatOptions {
  formats: string[];
  hdAudio: boolean;
}

export interface StoreAdapter {
  id: string;
  test: (url: string) => boolean;
  target: string;
  injectButton: (button: HTMLElement, target: Element) => void;
  supports: StoreFormatOptions;
  parse: () => Promise<ReleaseData>;
}

export interface TrackData {
  position: string;
  artists: ArtistCredit[];
  extraartists: ArtistCredit[];
  title: string;
  duration: string;
  bpm?: number;
}

export interface DiscogsFormat {
  name: string;
  qty: string;
  desc: string[];
  text: string;
}

export interface DiscogsLabel {
  name: string;
  catno: string;
}

export interface DiscogsTrack {
  pos: string;
  artists: ArtistCredit[];
  extraartists: ArtistCredit[];
  title: string;
  duration: string;
}

export interface DiscogsPayloadData {
  cover: string | null;
  title: string;
  artists: ArtistCredit[];
  extraartists: ArtistCredit[];
  country: string;
  released: string;
  labels: DiscogsLabel[];
  format: DiscogsFormat[];
  tracks: DiscogsTrack[];
  notes: string;
}

export interface ReleaseData {
  cover: string | null;
  title: string;
  artists: ArtistCredit[];
  extraartists: ArtistCredit[];
  label: string | null;
  number?: string | null;
  country?: string | null;
  released: string | null;
  tracks: TrackData[];
  labels?: Array<{ name: string; catno: string }>; // For DiscogsPayload preview
  format?: Array<{ name: string; qty: string; desc: string[]; text: string }>; // For DiscogsPayload preview
  notes?: string; // For DiscogsPayload preview
}

export interface BuildPayloadOptions {
  format?: string;
  isHdAudio?: boolean;
}

export interface DiscogsPayload {
  _previewObject: DiscogsPayloadData;
  full_data: string;
  sub_notes: string;
}
