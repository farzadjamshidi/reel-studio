import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, merge } from 'rxjs';
import { Icon } from '../../../ui/icon/icon';
import { MOD_KEY_LABEL } from '../../../ui/platform';

export type ClipMenuAction = 'split' | 'duplicate' | 'delete';

/** Keep in sync with the menu width in clip-context-menu.scss. */
/** Keep in sync with the menu width in clip-context-menu.scss. */
const MENU_WIDTH = 220;
const MENU_HEIGHT = 170;

@Component({
  selector: 'app-clip-context-menu',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clip-context-menu.html',
  styleUrl: './clip-context-menu.scss',
})
export class ClipContextMenu {
  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly canSplit = input(false);
  readonly action = output<ClipMenuAction>();
  readonly closed = output<void>();

  protected readonly mod = MOD_KEY_LABEL;

  /** Keeps the menu on screen, flipping above the pointer near the bottom edge. */
  protected readonly position = computed(() => ({
    x: Math.min(this.x(), window.innerWidth - MENU_WIDTH - 8),
    y: this.y() + MENU_HEIGHT > window.innerHeight - 8 ? this.y() - MENU_HEIGHT : this.y(),
  }));

  constructor() {
    merge(
      fromEvent(window, 'pointerdown'),
      fromEvent(window, 'resize'),
      fromEvent(window, 'blur'),
      fromEvent<KeyboardEvent>(window, 'keydown').pipe(filter((e) => e.key === 'Escape')),
    )
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.closed.emit());
  }

  protected choose(action: ClipMenuAction): void {
    this.action.emit(action);
    this.closed.emit();
  }
}
