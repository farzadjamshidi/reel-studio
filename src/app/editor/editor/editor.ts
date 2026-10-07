import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { filter, fromEvent } from 'rxjs';
import { EditorCommands } from '../../services/editor-commands.service';
import { PlaybackService } from '../../services/playback.service';
import { selectActivePanel, selectPxPerSecond } from '../../state/selectors';
import { UiActions } from '../../state/ui.state';
import { CanvasStage } from '../canvas-stage/canvas-stage';
import { SidePanel } from '../side-panel/side-panel';
import { Timeline } from '../timeline/timeline/timeline';
import { ToolRail } from '../tool-rail/tool-rail';
import { TopBar } from '../top-bar/top-bar';

@Component({
  selector: 'app-editor',
  imports: [TopBar, ToolRail, SidePanel, CanvasStage, Timeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
})
export class Editor {
  private readonly store = inject(Store);
  private readonly commands = inject(EditorCommands);
  private readonly playback = inject(PlaybackService);
  private readonly pps = this.store.selectSignal(selectPxPerSecond);
  protected readonly panel = this.store.selectSignal(selectActivePanel);

  constructor() {
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(
        filter((event) => !isTypingTarget(event.target)),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.onKey(event));
  }

  private onKey(event: KeyboardEvent): void {
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const handled = (() => {
      if (mod && key === 'z') return event.shiftKey ? this.commands.redo() : this.commands.undo(), true;
      if (mod && key === 'y') return this.commands.redo(), true;
      if (mod && key === 'd') return this.commands.duplicate(), true;
      if (mod) return false;
      switch (key) {
        case ' ':
          return this.playback.toggle(), true;
        case 's':
          return this.commands.splitAtPlayhead(), true;
        case 'delete':
        case 'backspace':
          return this.commands.remove(), true;
        case 'escape':
          return this.commands.select(null), true;
        case 'home':
          return this.playback.seek(0), true;
        case 'end':
          return this.playback.seek(this.playback.duration()), true;
        case '=':
        case '+':
          return this.store.dispatch(UiActions.setZoom({ pxPerSecond: this.pps() * 1.25 })), true;
        case '-':
          return this.store.dispatch(UiActions.setZoom({ pxPerSecond: this.pps() / 1.25 })), true;
        case 'arrowleft':
        case 'arrowright':
        case 'arrowup':
        case 'arrowdown':
          return this.onArrow(key, event.shiftKey), true;
      }
      return false;
    })();
    if (handled) event.preventDefault();
  }

  /** Arrows nudge the selected clip, or step the playhead when nothing is selected. */
  private onArrow(key: string, large: boolean): void {
    const step = large ? 20 : 2;
    const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
    const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
    if (this.commands.hasSelection()) {
      this.commands.nudge(dx, dy);
    } else if (dx) {
      this.playback.seek(this.playback.time() + Math.sign(dx) * (large ? 1 : 1 / 30));
    }
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button', 'color'].includes(target.type);
}
