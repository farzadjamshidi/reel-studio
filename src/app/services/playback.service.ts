import { Injectable, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectDuration } from '../state/selectors';

/**
 * The playback clock.
 *
 * Time changes up to 60 times a second, so it lives in signals rather than in
 * the NgRx store. Only the few bindings that read `time` update while playing,
 * and the undoable project history never sees playback.
 */
@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private readonly store = inject(Store);

  readonly duration = this.store.selectSignal(selectDuration);
  readonly time = signal(0);
  readonly playing = signal(false);
  readonly muted = signal(false);
  readonly atEnd = computed(() => this.time() >= this.duration() - 1e-3);

  play(): void {
    if (this.duration() <= 0) return;
    if (this.atEnd()) this.time.set(0);
    this.playing.set(true);
  }

  pause(): void {
    this.playing.set(false);
  }

  toggle(): void {
    this.playing() ? this.pause() : this.play();
  }

  seek(seconds: number): void {
    this.time.set(Math.min(Math.max(0, seconds), this.duration()));
  }

  toggleMute(): void {
    this.muted.update((m) => !m);
  }

  /** Called from the render loop with the frame delta. */
  advance(deltaMs: number): void {
    if (!this.playing()) return;
    const next = this.time() + deltaMs / 1000;
    if (next >= this.duration()) {
      this.time.set(this.duration());
      this.playing.set(false);
    } else {
      this.time.set(next);
    }
  }
}
