import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Clip, MediaAsset } from '../../../core/models';
import { MediaService } from '../../../services/media.service';
import { Icon, IconName } from '../../../ui/icon/icon';

export type GrabMode = 'move' | 'start' | 'end';

interface Frame {
  src: string;
  left: number;
  width: number;
}

/** One clip block on the timeline. Pure presentation; drags are handled by the timeline. */
@Component({
  selector: 'app-timeline-clip',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'clip',
    '[class.text]': "clip().kind === 'text'",
    '[class.overlay]': "compact() && clip().kind !== 'text'",
    '[class.main]': '!compact()',
    '[class.selected]': 'selected()',
    '[style.transform]': "'translateX(' + left() + 'px)'",
    '[style.width.px]': 'width()',
    '[attr.title]': 'label()',
    '(pointerdown)': "onDown($event, 'move')",
    '(contextmenu)': 'onContextMenu($event)',
    '(dblclick)': 'edit.emit()',
  },
  templateUrl: './timeline-clip.html',
  styleUrl: './timeline-clip.scss',
})
export class TimelineClip {
  private readonly media = inject(MediaService);

  readonly clip = input.required<Clip>();
  readonly asset = input<MediaAsset | undefined>();
  readonly pps = input.required<number>();
  readonly offset = input(0);
  readonly selected = input(false);
  /** Compact clips (text and overlays) are coloured bars; main-track clips show a filmstrip. */
  readonly compact = input(false);
  readonly height = input(44);

  readonly grab = output<{ mode: GrabMode; event: PointerEvent }>();
  readonly menu = output<MouseEvent>();
  readonly edit = output<void>();

  protected readonly left = computed(() => this.offset() + this.clip().start * this.pps());
  protected readonly width = computed(() => Math.max(4, this.clip().duration * this.pps()));

  protected readonly icon = computed<IconName>(() => {
    const kind = this.clip().kind;
    return kind === 'text' ? 'text' : kind === 'video' ? 'film' : 'media';
  });

  protected readonly label = computed(() => {
    const clip = this.clip();
    return clip.kind === 'text' ? clip.text || 'Text' : (this.asset()?.name ?? 'Missing media');
  });

  protected readonly durationLabel = computed(() => {
    const d = this.clip().duration;
    return `${d >= 10 || Number.isInteger(d) ? Math.round(d) : d.toFixed(1)}s`;
  });

  private readonly thumbnails = computed(() => {
    const asset = this.asset();
    return asset?.kind === 'video' ? this.media.thumbnails(asset) : null;
  });

  protected readonly imageStrip = computed(() => {
    const asset = this.asset();
    return asset?.kind === 'image' ? `url("${asset.src}")` : null;
  });

  /** Picks the right source frame for every thumbnail slot across the clip's width. */
  protected readonly frames = computed<Frame[]>(() => {
    const clip = this.clip();
    const asset = this.asset();
    const thumbs = this.thumbnails()?.() ?? [];
    if (clip.kind !== 'video' || !asset || !thumbs.length) return [];
    const thumbWidth = Math.max(16, (asset.width / asset.height) * this.height());
    const width = this.width();
    const pps = this.pps();
    const frames: Frame[] = [];
    for (let left = 0; left < width; left += thumbWidth) {
      const sourceTime = clip.sourceOffset + (left + thumbWidth / 2) / pps;
      const index = Math.min(thumbs.length - 1, Math.max(0, Math.floor(sourceTime)));
      frames.push({ src: thumbs[index], left, width: thumbWidth });
    }
    return frames;
  });

  protected onDown(event: PointerEvent, mode: GrabMode): void {
    event.stopPropagation();
    if (event.button !== 0) return;
    this.grab.emit({ mode, event });
  }

  protected onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.menu.emit(event);
  }
}
