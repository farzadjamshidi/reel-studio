import { Injectable, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { createMediaClip, createTextClip } from '../core/clip-factory';
import { uid } from '../core/id';
import { MediaAsset, Transform, clipEnd } from '../core/models';
import { TEXT_PRESETS } from '../state/demo-project';
import { ImportPlacement, MediaActions } from '../state/media.state';
import { ClipChanges, HistoryActions, ProjectActions } from '../state/project.actions';
import { selectProject, selectSelectedClip } from '../state/selectors';
import { UiActions } from '../state/ui.state';
import { PlaybackService } from './playback.service';

/**
 * One place for editor commands, shared by keyboard shortcuts, the context
 * menu, toolbar buttons and canvas gestures.
 */
@Injectable({ providedIn: 'root' })
export class EditorCommands {
  private readonly store = inject(Store);
  private readonly playback = inject(PlaybackService);
  private readonly project = this.store.selectSignal(selectProject);
  private readonly selected = this.store.selectSignal(selectSelectedClip);

  /** Set to ask the text panel to focus its editor; the panel clears it. */
  readonly textFocusRequest = signal(false);

  hasSelection(): boolean {
    return !!this.selected();
  }

  undo(): void {
    this.store.dispatch(HistoryActions.undo());
  }

  redo(): void {
    this.store.dispatch(HistoryActions.redo());
  }

  select(id: string | null): void {
    this.store.dispatch(UiActions.select({ id }));
  }

  /** True when the selected clip spans the playhead and can be split there. */
  canSplit(id = this.selected()?.id): boolean {
    const clip = id ? this.project().clips[id] : undefined;
    const t = this.playback.time();
    return !!clip && t > clip.start + 0.1 && t < clipEnd(clip) - 0.1;
  }

  splitAtPlayhead(id = this.selected()?.id): void {
    if (!id || !this.canSplit(id)) return;
    this.store.dispatch(ProjectActions.splitClip({ id, at: this.playback.time(), newId: uid('clip') }));
  }

  duplicate(id = this.selected()?.id): void {
    if (id) this.store.dispatch(ProjectActions.duplicateClip({ id, newId: uid('clip'), newTrackId: uid('track') }));
  }

  remove(id = this.selected()?.id): void {
    if (id) this.store.dispatch(ProjectActions.deleteClip({ id }));
  }

  update(id: string, changes: ClipChanges, gestureId?: string): void {
    this.store.dispatch(ProjectActions.updateClip({ id, changes, gestureId }));
  }

  nudge(dx: number, dy: number): void {
    const clip = this.selected();
    if (!clip) return;
    const transform: Partial<Transform> = { x: clip.transform.x + dx, y: clip.transform.y + dy };
    // Consecutive nudges of the same clip collapse into one undo step.
    this.update(clip.id, { transform }, `nudge-${clip.id}`);
  }

  addText(preset: keyof typeof TEXT_PRESETS): void {
    const { text, style } = TEXT_PRESETS[preset];
    const clip = createTextClip(text, style, this.project(), this.playback.time());
    this.store.dispatch(ProjectActions.addClip({ clip, placement: 'at-start', newTrackId: uid('track') }));
    this.editText();
  }

  addAsset(asset: MediaAsset, asOverlay: boolean): void {
    const clip = createMediaClip(asset, this.project(), asOverlay ? this.playback.time() : 0, asOverlay);
    this.store.dispatch(
      ProjectActions.addClip({ clip, placement: asOverlay ? 'at-start' : 'append-main', newTrackId: uid('track') }),
    );
  }

  importFiles(files: FileList | File[], placement: ImportPlacement): void {
    for (const file of Array.from(files)) {
      this.store.dispatch(MediaActions.importRequested({ file, placement }));
    }
  }

  editText(id?: string): void {
    if (id) this.select(id);
    this.store.dispatch(UiActions.openPanel({ panel: 'text' }));
    this.textFocusRequest.set(true);
  }
}
