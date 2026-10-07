import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, animationFrameScheduler, auditTime, fromEvent, merge, skipWhile, takeUntil } from 'rxjs';
import { uid } from '../../../core/id';
import { Clip, clipEnd, trackAccepts } from '../../../core/models';
import { formatTime } from '../../../core/time';
import { EditorCommands } from '../../../services/editor-commands.service';
import { PlaybackService } from '../../../services/playback.service';
import { ProjectActions } from '../../../state/project.actions';
import { selectAssets, selectPxPerSecond, selectSelectedId, selectTimelineRows } from '../../../state/selectors';
import { MAX_ZOOM, MIN_ZOOM, UiActions } from '../../../state/ui.state';
import { Icon } from '../../../ui/icon/icon';
import { MOD_KEY_LABEL } from '../../../ui/platform';
import { ClipContextMenu, ClipMenuAction } from '../clip-context-menu/clip-context-menu';
import { GrabMode, TimelineClip } from '../timeline-clip/timeline-clip';

/** Left padding so a clip at 0s is not flush against the edge. */
const PAD = 16;
const SNAP_PX = 8;
const DRAG_THRESHOLD_PX = 3;
const RULER_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120];
export const MAIN_TRACK_HEIGHT = 46;
export const TRACK_HEIGHT = 24;

@Component({
  selector: 'app-timeline',
  imports: [Icon, TimelineClip, ClipContextMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline.html',
  styleUrl: './timeline.scss',
})
export class Timeline {
  private readonly store = inject(Store);
  protected readonly playback = inject(PlaybackService);
  protected readonly commands = inject(EditorCommands);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = this.store.selectSignal(selectTimelineRows);
  protected readonly assets = this.store.selectSignal(selectAssets);
  protected readonly pps = this.store.selectSignal(selectPxPerSecond);
  protected readonly selectedId = this.store.selectSignal(selectSelectedId);
  protected readonly menu = signal<{ clipId: string; x: number; y: number } | null>(null);

  protected readonly PAD = PAD;
  protected readonly MAIN_TRACK_HEIGHT = MAIN_TRACK_HEIGHT;
  protected readonly TRACK_HEIGHT = TRACK_HEIGHT;
  protected readonly mod = MOD_KEY_LABEL;

  private readonly scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');
  private readonly viewportWidth = signal(800);

  protected readonly contentWidth = computed(() =>
    Math.max(this.viewportWidth(), PAD * 2 + (this.playback.duration() + 10) * this.pps()),
  );

  /** Major labelled ticks at a step that keeps labels at least 64px apart. */
  protected readonly ruler = computed(() => {
    const pps = this.pps();
    const step = RULER_STEPS.find((s) => s * pps >= 64) ?? RULER_STEPS[RULER_STEPS.length - 1];
    const minor = step / (step >= 5 ? 5 : 4);
    const seconds = (this.contentWidth() - PAD) / pps;
    const marks: { t: number; x: number; label: string }[] = [];
    for (let t = 0; t <= seconds; t += step) {
      marks.push({ t, x: PAD + t * pps, label: t === 0 ? '' : `${Number.isInteger(t) ? t : t.toFixed(1)}s` });
    }
    return { marks, minorPx: minor * pps };
  });

  protected readonly playheadX = computed(() => PAD + this.playback.time() * this.pps());
  protected readonly currentLabel = computed(() => formatTime(this.playback.time()));
  protected readonly totalLabel = computed(() => formatTime(this.playback.duration()));
  protected readonly canSplit = computed(() => this.commands.canSplit());
  protected readonly zoomSlider = computed(() => (100 * Math.log(this.pps() / MIN_ZOOM)) / Math.log(MAX_ZOOM / MIN_ZOOM));

  constructor() {
    afterNextRender(() => {
      const element = this.scroller().nativeElement;
      const observer = new ResizeObserver(([entry]) => this.viewportWidth.set(entry.contentRect.width));
      observer.observe(element);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    // Follow the playhead while playing, page by page like most editors.
    effect(() => {
      const x = this.playheadX();
      if (!this.playback.playing()) return;
      untracked(() => {
        const element = this.scroller().nativeElement;
        if (x > element.scrollLeft + element.clientWidth - 40 || x < element.scrollLeft) {
          element.scrollLeft = Math.max(0, x - 80);
        }
      });
    });
  }

  protected assetFor(clip: Clip) {
    return clip.kind === 'text' ? undefined : this.assets()[clip.assetId];
  }

  // ------------------------------------------------------------- scrubbing

  protected onBackgroundDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const onRuler = (event.target as Element).closest('.ruler, .playhead');
    if (!onRuler) this.commands.select(null);
    this.menu.set(null);
    this.scrubTo(event.clientX);
    this.pointerMoves(event).subscribe((move) => this.scrubTo(move.clientX));
  }

  private scrubTo(clientX: number): void {
    this.playback.seek(this.clientXToTime(clientX));
  }

  private clientXToTime(clientX: number): number {
    const element = this.scroller().nativeElement;
    const rect = element.getBoundingClientRect();
    return (clientX - rect.left + element.scrollLeft - PAD) / this.pps();
  }

  // ------------------------------------------------------- move and trim

  protected onClipGrab(clip: Clip, mode: GrabMode, event: PointerEvent): void {
    event.preventDefault();
    this.menu.set(null);
    if (this.selectedId() !== clip.id) this.commands.select(clip.id);

    const gestureId = uid('gesture');
    const pps = this.pps();
    const startX = event.clientX;
    const points = this.snapPoints(clip.id);
    const threshold = SNAP_PX / pps;

    if (mode === 'move') {
      let trackId = clip.trackId;
      this.pointerMoves(event, DRAG_THRESHOLD_PX).subscribe((move) => {
        const start = snapRange(clip.start + (move.clientX - startX) / pps, clip.duration, points, threshold);
        trackId = this.compatibleTrackAt(move.clientY, clip) ?? trackId;
        this.store.dispatch(ProjectActions.moveClip({ id: clip.id, start: Math.max(0, start), trackId, gestureId }));
      });
      return;
    }

    const edgeTime = mode === 'start' ? clip.start : clipEnd(clip);
    this.pointerMoves(event).subscribe((move) => {
      const time = snapPoint(edgeTime + (move.clientX - startX) / pps, points, threshold);
      this.store.dispatch(ProjectActions.trimClip({ id: clip.id, edge: mode, time, gestureId }));
    });
  }

  /** Clip edges snap to the playhead, to 0 and to the edges of every other clip. */
  private snapPoints(excludeId: string): number[] {
    const points = [0, this.playback.time()];
    for (const row of this.rows()) {
      for (const other of row.clips) {
        if (other.id !== excludeId) points.push(other.start, clipEnd(other));
      }
    }
    return points;
  }

  private compatibleTrackAt(clientY: number, clip: Clip): string | null {
    const rows = this.scroller().nativeElement.querySelectorAll<HTMLElement>('[data-track-id]');
    for (const element of Array.from(rows)) {
      const rect = element.getBoundingClientRect();
      if (clientY >= rect.top - 2 && clientY <= rect.bottom + 2) {
        const track = this.rows().find((row) => row.track.id === element.dataset['trackId'])?.track;
        return track && trackAccepts(track, clip) ? track.id : null;
      }
    }
    return null;
  }

  /**
   * Pointer moves until release, at most one per animation frame. With a
   * threshold, nothing is emitted until the pointer has really moved, so a
   * plain click never creates an undo step.
   */
  private pointerMoves(start: PointerEvent, threshold = 0): Observable<PointerEvent> {
    const end$ = merge(fromEvent(window, 'pointerup'), fromEvent(window, 'pointercancel'));
    return fromEvent<PointerEvent>(window, 'pointermove').pipe(
      skipWhile((e) => Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) < threshold),
      auditTime(0, animationFrameScheduler),
      takeUntil(end$),
    );
  }

  // ------------------------------------------------------------ zoom

  protected onZoomSlider(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.setZoom(MIN_ZOOM * Math.pow(MAX_ZOOM / MIN_ZOOM, value / 100));
  }

  protected zoomBy(factor: number): void {
    this.setZoom(this.pps() * factor);
  }

  protected fit(): void {
    const width = this.viewportWidth() - PAD * 2 - 24;
    this.setZoom(width / Math.max(1, this.playback.duration()));
    this.scroller().nativeElement.scrollLeft = 0;
  }

  /** Ctrl/⌘ + wheel zooms around the pointer, keeping the time under it fixed. */
  protected onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const element = this.scroller().nativeElement;
    const offsetX = event.clientX - element.getBoundingClientRect().left;
    const time = this.clientXToTime(event.clientX);
    this.setZoom(this.pps() * Math.exp(-event.deltaY * 0.01));
    element.scrollLeft = Math.max(0, PAD + time * this.pps() - offsetX);
  }

  private setZoom(pxPerSecond: number): void {
    this.store.dispatch(UiActions.setZoom({ pxPerSecond }));
  }

  // ------------------------------------------------------- context menu

  protected openMenu(clip: Clip, event: MouseEvent): void {
    this.commands.select(clip.id);
    this.menu.set({ clipId: clip.id, x: event.clientX, y: event.clientY });
  }

  protected onEdit(clip: Clip): void {
    if (clip.kind === 'text') this.commands.editText(clip.id);
  }

  protected onMenuAction(clipId: string, action: ClipMenuAction): void {
    if (action === 'split') this.commands.splitAtPlayhead(clipId);
    else if (action === 'duplicate') this.commands.duplicate(clipId);
    else this.commands.remove(clipId);
  }
}

function snapPoint(time: number, points: number[], threshold: number): number {
  let best = time;
  let distance = threshold;
  for (const point of points) {
    if (Math.abs(time - point) < distance) {
      distance = Math.abs(time - point);
      best = point;
    }
  }
  return best;
}

/** Snaps either edge of a range, whichever is closest. */
function snapRange(start: number, duration: number, points: number[], threshold: number): number {
  let best = start;
  let distance = threshold;
  for (const point of points) {
    if (Math.abs(start - point) < distance) {
      distance = Math.abs(start - point);
      best = point;
    }
    if (Math.abs(start + duration - point) < distance) {
      distance = Math.abs(start + duration - point);
      best = point - duration;
    }
  }
  return best;
}
