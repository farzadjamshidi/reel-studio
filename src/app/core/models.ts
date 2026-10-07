/** Seconds are the unit of time everywhere in the project model. */
export type ClipKind = 'video' | 'image' | 'text';
export type TrackKind = 'text' | 'overlay' | 'main';

export type FilterPreset =
  | 'none'
  | 'mono'
  | 'sepia'
  | 'vintage'
  | 'vivid'
  | 'polaroid'
  | 'kodachrome'
  | 'cool'
  | 'blur';

export interface FilterSettings {
  preset: FilterPreset;
  /** 0..1 mix between the original and the filtered image. */
  intensity: number;
}

export interface MediaAsset {
  id: string;
  kind: 'video' | 'image';
  src: string;
  name: string;
  width: number;
  height: number;
  /** Only for video. */
  duration?: number;
}

/** Position is the clip's centre in project pixels; rotation in radians. */
export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface ClipBase {
  id: string;
  trackId: string;
  start: number;
  duration: number;
  transform: Transform;
  opacity: number;
}

export interface VideoClip extends ClipBase {
  kind: 'video';
  assetId: string;
  /** Where in the source media this clip starts playing. */
  sourceOffset: number;
  /** Total length of the source media, used to clamp trims. */
  sourceDuration: number;
  filter: FilterSettings;
}

export interface ImageClip extends ClipBase {
  kind: 'image';
  assetId: string;
  filter: FilterSettings;
}

export interface TextStyleSettings {
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontWeight: 'normal' | 'bold';
  /** Optional pill behind the text. */
  background: string | null;
  shadow: boolean;
}

export interface TextClip extends ClipBase {
  kind: 'text';
  text: string;
  style: TextStyleSettings;
}

export type Clip = VideoClip | ImageClip | TextClip;
export type MediaClip = VideoClip | ImageClip;

export interface Track {
  id: string;
  kind: TrackKind;
}

export interface Project {
  name: string;
  width: number;
  height: number;
  background: string;
  /** Ordered top to bottom. The top track renders above the others. */
  tracks: Track[];
  clips: Record<string, Clip>;
}

export const MIN_CLIP_DURATION = 0.2;

export const isMediaClip = (clip: Clip): clip is MediaClip => clip.kind !== 'text';

export const clipEnd = (clip: Clip): number => clip.start + clip.duration;

export function trackAccepts(track: Track, clip: Pick<Clip, 'kind'>): boolean {
  return clip.kind === 'text' ? track.kind === 'text' : track.kind !== 'text';
}
