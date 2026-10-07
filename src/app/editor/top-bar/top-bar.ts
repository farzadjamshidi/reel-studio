import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { uid } from '../../core/id';
import { EditorCommands } from '../../services/editor-commands.service';
import { PlaybackService } from '../../services/playback.service';
import { createDemoProject } from '../../state/demo-project';
import { HistoryActions, ProjectActions } from '../../state/project.actions';
import { selectCanRedo, selectCanUndo, selectProjectName } from '../../state/selectors';
import { Icon } from '../../ui/icon/icon';
import { MOD_KEY_LABEL } from '../../ui/platform';
import { StageRenderer } from '../stage/stage-renderer.service';

@Component({
  selector: 'app-top-bar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  private readonly store = inject(Store);
  private readonly renderer = inject(StageRenderer);
  private readonly playback = inject(PlaybackService);
  protected readonly commands = inject(EditorCommands);

  protected readonly name = this.store.selectSignal(selectProjectName);
  protected readonly canUndo = this.store.selectSignal(selectCanUndo);
  protected readonly canRedo = this.store.selectSignal(selectCanRedo);
  protected readonly exporting = signal(false);
  protected readonly mod = MOD_KEY_LABEL;
  protected nameGesture = this.newGesture();

  protected newGesture(): string {
    return uid('gesture');
  }

  protected rename(event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.store.dispatch(ProjectActions.renameProject({ name, gestureId: this.nameGesture }));
  }

  protected resetDemo(): void {
    this.playback.pause();
    this.playback.seek(0);
    this.store.dispatch(HistoryActions.reset({ project: createDemoProject() }));
  }

  protected async download(): Promise<void> {
    this.exporting.set(true);
    try {
      const slug = this.name().trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'frame';
      await this.renderer.exportFrame(`${slug}-${this.playback.time().toFixed(1)}s.png`);
    } finally {
      this.exporting.set(false);
    }
  }
}
