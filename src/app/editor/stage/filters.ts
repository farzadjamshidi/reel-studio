import { BlurFilter, ColorMatrixFilter, Filter } from 'pixi.js';
import { FilterPreset, FilterSettings } from '../../core/models';

export interface FilterPresetInfo {
  id: FilterPreset;
  label: string;
  /** CSS approximation used for the preview swatches in the filters panel. */
  css: string;
}

export const FILTER_PRESETS: FilterPresetInfo[] = [
  { id: 'none', label: 'Original', css: 'none' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.8) contrast(1.15)' },
  { id: 'mono', label: 'Mono', css: 'grayscale(1)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(1)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.5) contrast(0.9) brightness(1.05) saturate(0.8)' },
  { id: 'polaroid', label: 'Polaroid', css: 'contrast(1.2) brightness(1.05) saturate(1.1) hue-rotate(-8deg)' },
  { id: 'kodachrome', label: 'Kodachrome', css: 'contrast(1.25) saturate(1.3) sepia(0.15)' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(25deg) saturate(1.1)' },
  { id: 'blur', label: 'Blur', css: 'blur(2px)' },
];

/** Builds Pixi filters for a preset. Intensity is applied as a mix with the original. */
export function createFilters({ preset, intensity }: FilterSettings): Filter[] {
  if (preset === 'none') return [];
  if (preset === 'blur') return [new BlurFilter({ strength: 16 * intensity, quality: 4 })];

  const matrix = new ColorMatrixFilter();
  switch (preset) {
    case 'mono':
      matrix.desaturate();
      break;
    case 'sepia':
      matrix.sepia(false);
      break;
    case 'vintage':
      matrix.vintage(false);
      break;
    case 'polaroid':
      matrix.polaroid(false);
      break;
    case 'kodachrome':
      matrix.kodachrome(false);
      break;
    case 'vivid':
      matrix.saturate(0.8, false);
      matrix.contrast(0.2, true);
      break;
    case 'cool':
      matrix.hue(25, false);
      matrix.saturate(0.15, true);
      break;
  }
  matrix.alpha = intensity;
  return [matrix];
}

/** Updates filters in place when only the intensity changed, to avoid re-creating GPU programs. */
export function updateFilterIntensity(filters: Filter[], { preset, intensity }: FilterSettings): void {
  const [filter] = filters;
  if (!filter) return;
  if (preset === 'blur' && filter instanceof BlurFilter) filter.strength = 16 * intensity;
  else if (filter instanceof ColorMatrixFilter) filter.alpha = intensity;
}
