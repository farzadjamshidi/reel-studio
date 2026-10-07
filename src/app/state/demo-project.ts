import { MediaAsset, Project, TextStyleSettings } from '../core/models';

export const SAMPLE_ASSETS: MediaAsset[] = [
  { id: 'sample-video', kind: 'video', name: 'Test pattern.mp4', src: 'media/sample-video.mp4', width: 720, height: 1280, duration: 12 },
  { id: 'sample-video-2', kind: 'video', name: 'Fractal.mp4', src: 'media/sample-video-2.mp4', width: 720, height: 1280, duration: 8 },
  { id: 'sample-image', kind: 'image', name: 'Gradient.jpg', src: 'media/sample-image.jpg', width: 1080, height: 1920 },
  { id: 'live-badge', kind: 'image', name: 'Live badge.svg', src: 'media/live-badge.svg', width: 360, height: 140 },
];

export const TEXT_PRESETS: Record<'heading' | 'subtitle' | 'label', { text: string; style: TextStyleSettings }> = {
  heading: {
    text: 'Game day highlights',
    style: { fontFamily: 'Inter, Helvetica, Arial, sans-serif', fontSize: 92, fill: '#ffffff', fontWeight: 'bold', background: null, shadow: true },
  },
  subtitle: {
    text: 'Swipe up for the full match',
    style: { fontFamily: 'Inter, Helvetica, Arial, sans-serif', fontSize: 52, fill: '#ffffff', fontWeight: 'normal', background: null, shadow: true },
  },
  label: {
    text: 'FINAL SCORE 3 – 1',
    style: { fontFamily: 'Inter, Helvetica, Arial, sans-serif', fontSize: 48, fill: '#0b1f14', fontWeight: 'bold', background: '#34d399', shadow: false },
  },
};

const noFilter = { preset: 'none' as const, intensity: 1 };
const cover = (asset: MediaAsset, w: number, h: number) => Math.max(w / asset.width, h / asset.height);

export function createDemoProject(): Project {
  const [video, video2, image, badge] = SAMPLE_ASSETS;
  const W = 1080;
  const H = 1920;
  const centre = { x: W / 2, y: H / 2, rotation: 0 };
  return {
    name: 'Untitled 9:16 Portrait',
    width: W,
    height: H,
    background: '#111827',
    tracks: [
      { id: 'text-1', kind: 'text' },
      { id: 'overlay-1', kind: 'overlay' },
      { id: 'main', kind: 'main' },
    ],
    clips: {
      'clip-video-1': {
        id: 'clip-video-1', kind: 'video', trackId: 'main', assetId: video.id,
        start: 0, duration: 6, sourceOffset: 0, sourceDuration: video.duration!,
        transform: { ...centre, scale: cover(video, W, H) }, opacity: 1, filter: noFilter,
      },
      'clip-image-1': {
        id: 'clip-image-1', kind: 'image', trackId: 'main', assetId: image.id,
        start: 6, duration: 3, transform: { ...centre, scale: cover(image, W, H) }, opacity: 1, filter: noFilter,
      },
      'clip-video-2': {
        id: 'clip-video-2', kind: 'video', trackId: 'main', assetId: video2.id,
        start: 9, duration: 6, sourceOffset: 1, sourceDuration: video2.duration!,
        transform: { ...centre, scale: cover(video2, W, H) }, opacity: 1, filter: { preset: 'vivid', intensity: 1 },
      },
      'clip-badge': {
        id: 'clip-badge', kind: 'image', trackId: 'overlay-1', assetId: badge.id,
        start: 1, duration: 7, transform: { x: W - 200, y: 170, scale: 0.8, rotation: 0 }, opacity: 1, filter: noFilter,
      },
      'clip-title': {
        id: 'clip-title', kind: 'text', trackId: 'text-1', start: 0.5, duration: 5,
        text: TEXT_PRESETS.heading.text, style: TEXT_PRESETS.heading.style,
        transform: { x: W / 2, y: H * 0.72, scale: 1, rotation: 0 }, opacity: 1,
      },
      'clip-label': {
        id: 'clip-label', kind: 'text', trackId: 'text-1', start: 9.5, duration: 4.5,
        text: TEXT_PRESETS.label.text, style: TEXT_PRESETS.label.style,
        transform: { x: W / 2, y: H * 0.8, scale: 1, rotation: -0.05 }, opacity: 1,
      },
    },
  };
}
