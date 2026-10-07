import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { uid } from '../../../core/id';
import { FilterPreset, isMediaClip } from '../../../core/models';
import { EditorCommands } from '../../../services/editor-commands.service';
import { MediaService } from '../../../services/media.service';
import { selectAssets, selectSelectedClip } from '../../../state/selectors';
import { FILTER_PRESETS } from '../../stage/filters';

@Component({
  selector: 'app-filters-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filters-panel.html',
  styleUrls: ['../panel.scss', './filters-panel.scss'],
})
export class FiltersPanel {
  private readonly store = inject(Store);
  private readonly commands = inject(EditorCommands);
  private readonly media = inject(MediaService);
  private readonly assets = this.store.selectSignal(selectAssets);
  private readonly selected = this.store.selectSignal(selectSelectedClip);
  private gestureId = uid('gesture');

  protected readonly presets = FILTER_PRESETS;
  protected readonly clip = computed(() => {
    const clip = this.selected();
    return clip && isMediaClip(clip) ? clip : null;
  });

  protected readonly preview = computed(() => {
    const clip = this.clip();
    const asset = clip ? this.assets()[clip.assetId] : undefined;
    if (!asset) return 'none';
    const src = asset.kind === 'image' ? asset.src : this.media.thumbnails(asset)()[0];
    return src ? `url("${src}")` : 'none';
  });

  protected percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  protected setPreset(preset: FilterPreset): void {
    const clip = this.clip();
    if (clip) this.commands.update(clip.id, { filter: { preset } });
  }

  protected setIntensity(event: Event): void {
    const clip = this.clip();
    if (clip) this.commands.update(clip.id, { filter: { intensity: +(event.target as HTMLInputElement).value } }, this.gestureId);
  }

  protected setOpacity(event: Event): void {
    const clip = this.clip();
    if (clip) this.commands.update(clip.id, { opacity: +(event.target as HTMLInputElement).value }, this.gestureId);
  }

  protected endGesture(): void {
    this.gestureId = uid('gesture');
  }
}
