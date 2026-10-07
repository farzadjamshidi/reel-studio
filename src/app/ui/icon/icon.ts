import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const roundedSquare = 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z';
const speaker = 'M11 5 6 9H2v6h4l5 4V5z';

/** Stroke icons drawn on a 24px grid, in the style of Lucide. */
const ICONS = {
  media: [roundedSquare, circle(9, 9, 2), 'm21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21'],
  text: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16'],
  filters: [circle(9, 10, 6), circle(15, 10, 6), circle(12, 15, 6)],
  background: [roundedSquare, 'M3 15 15 3', 'M9 21 21 9', 'M3 9l6-6'],
  play: ['M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z'],
  pause: ['M7 4h3v16H7z', 'M14 4h3v16h-3z'],
  volume: [speaker, 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14'],
  mute: [speaker, 'm22 9-6 6', 'm16 9 6 6'],
  undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  redo: ['m15 14 5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
  split: ['M12 3v18', 'M5 7h4v10H5z', 'M15 7h4v10h-4z'],
  duplicate: ['M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', 'M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2'],
  delete: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
  zoomIn: [circle(11, 11, 8), 'm21 21-4.3-4.3', 'M11 8v6', 'M8 11h6'],
  zoomOut: [circle(11, 11, 8), 'm21 21-4.3-4.3', 'M8 11h6'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
  back: ['m15 18-6-6 6-6'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  reset: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
  layers: ['m12 2 10 5-10 5L2 7z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  film: [roundedSquare, 'M7 3v18', 'M17 3v18', 'M3 12h18', 'M3 7.5h4', 'M3 16.5h4', 'M17 7.5h4', 'M17 16.5h4'],
  portrait: ['M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z'],
} as const;

export type IconName = keyof typeof ICONS;
const FILLED: ReadonlySet<IconName> = new Set<IconName>(['play', 'pause']);

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  protected readonly paths = computed(() => ICONS[this.name()]);
  protected readonly filled = computed(() => FILLED.has(this.name()));
}
