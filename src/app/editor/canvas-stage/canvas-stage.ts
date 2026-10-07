import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { StageRenderer } from '../stage/stage-renderer.service';

/** Hosts the PixiJS canvas. All drawing lives in StageRenderer. */
@Component({
  selector: 'app-canvas-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './canvas-stage.html',
  styleUrl: './canvas-stage.scss',
})
export class CanvasStage {
  protected readonly renderer = inject(StageRenderer);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  constructor() {
    afterNextRender(() => void this.renderer.init(this.host().nativeElement));
    inject(DestroyRef).onDestroy(() => this.renderer.destroy());
  }
}
