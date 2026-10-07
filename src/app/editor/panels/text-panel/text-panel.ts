import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, untracked, viewChild } from '@angular/core';
import { Store } from '@ngrx/store';
import { uid } from '../../../core/id';
import { TextClip, TextStyleSettings } from '../../../core/models';
import { EditorCommands } from '../../../services/editor-commands.service';
import { TEXT_PRESETS } from '../../../state/demo-project';
import { selectSelectedClip } from '../../../state/selectors';

const COLORS = ['#ffffff', '#111827', '#22c55e', '#facc15', '#f97316', '#ef4444', '#3b82f6', '#a855f7'];

@Component({
  selector: 'app-text-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-panel.html',
  styleUrls: ['../panel.scss', './text-panel.scss'],
})
export class TextPanel {
  private readonly store = inject(Store);
  protected readonly commands = inject(EditorCommands);
  protected readonly colors = COLORS;
  protected readonly presets = TEXT_PRESETS;

  private readonly selected = this.store.selectSignal(selectSelectedClip);
  protected readonly clip = computed(() => {
    const clip = this.selected();
    return clip?.kind === 'text' ? clip : null;
  });

  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  /** Typing and slider drags share one gesture id, so they undo as one step. */
  private gestureId = uid('gesture');

  constructor() {
    effect(() => {
      const element = this.editor()?.nativeElement;
      if (!this.commands.textFocusRequest() || !element) return;
      untracked(() => {
        this.commands.textFocusRequest.set(false);
        queueMicrotask(() => {
          element.focus();
          element.select();
        });
      });
    });
  }

  protected setText(clip: TextClip, event: Event): void {
    this.commands.update(clip.id, { text: (event.target as HTMLTextAreaElement).value }, this.gestureId);
  }

  protected setStyle(clip: TextClip, style: Partial<TextStyleSettings>, discrete = false): void {
    this.commands.update(clip.id, { style }, discrete ? undefined : this.gestureId);
  }

  protected endGesture(): void {
    this.gestureId = uid('gesture');
  }
}
