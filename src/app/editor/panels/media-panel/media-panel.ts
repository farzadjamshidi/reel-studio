import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { MediaAsset } from '../../../core/models';
import { formatTime } from '../../../core/time';
import { EditorCommands } from '../../../services/editor-commands.service';
import { MediaService } from '../../../services/media.service';
import { selectAssetList, selectMediaError } from '../../../state/selectors';
import { Icon } from '../../../ui/icon/icon';

@Component({
  selector: 'app-media-panel',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-panel.html',
  styleUrls: ['../panel.scss', './media-panel.scss'],
})
export class MediaPanel {
  private readonly store = inject(Store);
  private readonly media = inject(MediaService);
  protected readonly commands = inject(EditorCommands);
  protected readonly assets = this.store.selectSignal(selectAssetList);
  protected readonly error = this.store.selectSignal(selectMediaError);
  protected readonly dragOver = signal(false);
  protected readonly format = formatTime;

  protected thumbFor(asset: MediaAsset): string {
    const src = asset.kind === 'image' ? asset.src : this.media.thumbnails(asset)()[0];
    return src ? `url("${src}")` : 'none';
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.commands.importFiles(input.files, 'library');
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (event.dataTransfer?.files.length) this.commands.importFiles(event.dataTransfer.files, 'library');
  }
}
