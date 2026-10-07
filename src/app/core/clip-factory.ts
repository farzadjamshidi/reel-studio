import { Clip, MediaAsset, TextStyleSettings } from './models';
import { uid } from './id';

interface Size {
  width: number;
  height: number;
}

const NO_FILTER = { preset: 'none' as const, intensity: 1 };

/** Main-track media fills the frame; overlays start at 60% of the frame width. */
export function createMediaClip(asset: MediaAsset, frame: Size, start: number, asOverlay: boolean): Clip {
  const scale = asOverlay
    ? Math.min((frame.width * 0.6) / asset.width, (frame.height * 0.6) / asset.height)
    : Math.max(frame.width / asset.width, frame.height / asset.height);
  const base = {
    id: uid('clip'),
    trackId: '',
    start,
    transform: { x: frame.width / 2, y: frame.height / 2, scale, rotation: 0 },
    opacity: 1,
    filter: NO_FILTER,
  };
  if (asset.kind === 'video') {
    const duration = asset.duration ?? 5;
    return { ...base, kind: 'video', assetId: asset.id, duration, sourceOffset: 0, sourceDuration: duration };
  }
  return { ...base, kind: 'image', assetId: asset.id, duration: asOverlay ? 4 : 3 };
}

export function createTextClip(text: string, style: TextStyleSettings, frame: Size, start: number): Clip {
  return {
    id: uid('clip'),
    kind: 'text',
    trackId: '',
    start,
    duration: 3,
    text,
    style,
    transform: { x: frame.width / 2, y: frame.height / 2, scale: 1, rotation: 0 },
    opacity: 1,
  };
}
