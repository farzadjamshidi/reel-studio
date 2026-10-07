import { Injectable, inject, isDevMode, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  Application,
  Circle,
  Container,
  FederatedPointerEvent,
  Filter,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
  Ticker,
  VideoSource,
} from 'pixi.js';
import {
  Observable,
  Subscription,
  animationFrameScheduler,
  auditTime,
  combineLatest,
  finalize,
  fromEvent,
  map,
  merge,
  takeUntil,
} from 'rxjs';
import { uid } from '../../core/id';
import { Clip, MediaAsset, Project, TextClip, VideoClip, clipEnd } from '../../core/models';
import { clamp } from '../../core/time';
import { EditorCommands } from '../../services/editor-commands.service';
import { PlaybackService } from '../../services/playback.service';
import { selectAssets, selectProject, selectSelectedId } from '../../state/selectors';
import { createFilters, updateFilterIntensity } from './filters';

interface ClipView {
  clip: Clip;
  container: Container;
  sprite?: Sprite;
  text?: Text;
  pill?: Graphics;
  video?: HTMLVideoElement;
  playPending: boolean;
  destroyed: boolean;
}

type HandleId = 'nw' | 'ne' | 'se' | 'sw' | 'rotate';

const ACCENT = 0x22c55e;
const HANDLE_RADIUS_PX = 7;
const ROTATE_OFFSET_PX = 34;
const SNAP_PX = 8;
const VIEWPORT_PADDING_PX = 28;
const DRIFT_TOLERANCE_S = 0.25;
const TEXT_WRAP_WIDTH = 920;

/**
 * Renders the project with PixiJS.
 *
 * The NgRx store is the single source of truth and Pixi is a view of it:
 * - Store changes are reconciled per clip. Clips whose object reference did
 *   not change are skipped, so editing one clip touches one display object.
 * - The render loop drives playback and video sync without Angular change
 *   detection, and only calls `render()` when something changed or a video is
 *   playing. An idle editor costs almost nothing.
 */
@Injectable({ providedIn: 'root' })
export class StageRenderer {
  private readonly store = inject(Store);
  private readonly playback = inject(PlaybackService);
  private readonly commands = inject(EditorCommands);
  private readonly selectedId = this.store.selectSignal(selectSelectedId);

  /** True once the WebGL context is up and the first frame is drawn. */
  readonly ready = signal(false);

  private app?: Application;
  private readonly world = new Container();
  private readonly scene = new Container({ sortableChildren: true });
  private readonly background = new Graphics();
  private readonly frameMask = new Graphics();
  private readonly frameBorder = new Graphics();
  private readonly guides = new Graphics();
  private readonly gizmo = new Container();
  private readonly outline = new Graphics();
  private readonly handles = new Map<HandleId, Graphics>();

  private readonly views = new Map<string, ClipView>();
  private readonly imageTextures = new Map<string, Promise<Texture>>();
  private project?: Project;
  private assets: Record<string, MediaAsset> = {};
  private readonly subscriptions = new Subscription();

  private dirty = true;
  private lastTime = -1;
  private lastSelected: string | null = null;
  private lastClick = { id: '', at: 0 };
  private destroyed = false;

  async init(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      preference: 'webgl',
      antialias: true,
      backgroundAlpha: 0,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
    });
    if (this.destroyed) {
      app.destroy(true);
      return;
    }
    this.app = app;
    host.appendChild(app.canvas);

    // Render on demand instead of on every tick.
    app.ticker.remove(app.render, app);

    this.buildSceneGraph(app);
    this.subscriptions.add(
      combineLatest([this.store.select(selectProject), this.store.select(selectAssets)]).subscribe(
        ([project, assets]) => this.reconcile(project, assets),
      ),
    );
    this.subscriptions.add(observeSize(host).subscribe(({ width, height }) => this.resize(width, height)));
    void this.reloadFonts();

    app.ticker.add(this.tick);
    this.ready.set(true);
    // Handy in the console and for automated browser checks.
    if (isDevMode()) (window as unknown as { reelStage: StageRenderer }).reelStage = this;
  }

  destroy(): void {
    this.destroyed = true;
    this.subscriptions.unsubscribe();
    for (const [id, view] of this.views) this.destroyView(id, view);
    this.app?.ticker.remove(this.tick);
    this.app?.destroy(true, { children: true });
    this.app = undefined;
  }

  /** Exports the current frame at full project resolution as a PNG download. */
  async exportFrame(fileName: string): Promise<void> {
    const app = this.app;
    const project = this.project;
    if (!app || !project) return;
    const gizmoVisible = this.gizmo.visible;
    this.scene.mask = null;
    const canvas = app.renderer.extract.canvas({
      target: this.scene,
      frame: new Rectangle(0, 0, project.width, project.height),
      resolution: 1,
    }) as HTMLCanvasElement;
    this.scene.mask = this.frameMask;
    this.gizmo.visible = gizmoVisible;
    this.dirty = true;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------------------------------------------------------------- setup

  private buildSceneGraph(app: Application): void {
    this.background.zIndex = -1;
    this.scene.addChild(this.background);
    this.scene.mask = this.frameMask;
    this.world.addChild(this.frameBorder, this.scene, this.frameMask, this.guides, this.gizmo);

    this.gizmo.addChild(this.outline);
    const cursors: Record<HandleId, string> = {
      nw: 'nwse-resize',
      se: 'nwse-resize',
      ne: 'nesw-resize',
      sw: 'nesw-resize',
      rotate: 'grab',
    };
    for (const id of Object.keys(cursors) as HandleId[]) {
      const handle = new Graphics()
        .circle(0, 0, HANDLE_RADIUS_PX)
        .fill(0xffffff)
        .stroke({ width: 2, color: ACCENT });
      handle.eventMode = 'static';
      handle.cursor = cursors[id];
      handle.hitArea = new Circle(0, 0, HANDLE_RADIUS_PX + 5);
      handle.on('pointerdown', (event) => this.onHandleDown(id, event));
      this.handles.set(id, handle);
      this.gizmo.addChild(handle);
    }

    app.stage.addChild(this.world);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', (event) => {
      if (event.target === app.stage) this.commands.select(null);
    });
  }

  private resize(width: number, height: number): void {
    const app = this.app;
    if (!app || width < 1 || height < 1) return;
    app.renderer.resize(width, height);
    this.fitWorld();
  }

  /** Fits the project frame into the viewport, like "zoom to fit". */
  private fitWorld(): void {
    const app = this.app;
    const project = this.project;
    if (!app || !project) return;
    const { width, height } = app.screen;
    const scale = Math.max(
      0.01,
      Math.min((width - VIEWPORT_PADDING_PX * 2) / project.width, (height - VIEWPORT_PADDING_PX * 2) / project.height),
    );
    this.world.scale.set(scale);
    this.world.position.set((width - project.width * scale) / 2, (height - project.height * scale) / 2);
    this.drawFrame(project);
    this.dirty = true;
  }

  private drawFrame(project: Project): void {
    const { width, height } = project;
    this.background.clear().rect(0, 0, width, height).fill(project.background);
    this.frameMask.clear().rect(0, 0, width, height).fill(0xffffff);
    const px = 1 / this.world.scale.x;
    this.frameBorder
      .clear()
      .rect(-px, -px, width + 2 * px, height + 2 * px)
      .fill({ color: 0x000000, alpha: 0.08 });
  }

  private async reloadFonts(): Promise<void> {
    if (!('fonts' in document)) return;
    try {
      await Promise.all([document.fonts.load('400 48px Inter'), document.fonts.load('700 48px Inter')]);
    } catch {
      return;
    }
    // Text measured before the web font loaded has the wrong metrics.
    for (const view of this.views.values()) {
      if (view.clip.kind === 'text') this.renderText(view, view.clip);
    }
    this.dirty = true;
  }

  // ------------------------------------------------------------ reconcile

  private reconcile(project: Project, assets: Record<string, MediaAsset>): void {
    const previous = this.project;
    this.project = project;
    this.assets = assets;

    if (
      !previous ||
      previous.width !== project.width ||
      previous.height !== project.height ||
      previous.background !== project.background
    ) {
      this.fitWorld();
    }

    const zByTrack = new Map(project.tracks.map((track, index) => [track.id, project.tracks.length - index]));
    for (const clip of Object.values(project.clips)) {
      const view = this.views.get(clip.id) ?? this.createView(clip);
      if (!view) continue;
      if (view.clip !== clip) this.applyClip(view, clip, view.clip);
      view.container.zIndex = zByTrack.get(clip.trackId) ?? 0;
    }
    for (const [id, view] of this.views) {
      if (!project.clips[id]) this.destroyView(id, view);
    }
    this.dirty = true;
  }

  private createView(clip: Clip): ClipView | undefined {
    const container = new Container();
    container.eventMode = 'static';
    container.cursor = 'move';
    container.visible = false;
    const view: ClipView = { clip, container, playPending: false, destroyed: false };
    container.on('pointerdown', (event) => this.onClipDown(clip.id, event));

    if (clip.kind === 'text') {
      view.pill = new Graphics();
      view.text = new Text({ text: '', resolution: 2 });
      view.text.anchor.set(0.5);
      view.pill.eventMode = 'static';
      view.text.eventMode = 'static';
      container.addChild(view.pill, view.text);
    } else {
      const asset = this.assets[clip.assetId];
      if (!asset) return undefined;
      view.sprite = new Sprite(Texture.EMPTY);
      view.sprite.anchor.set(0.5);
      view.sprite.eventMode = 'static';
      container.addChild(view.sprite);
      if (clip.kind === 'video') this.attachVideo(view, asset);
      else this.attachImage(view, asset);
    }

    this.views.set(clip.id, view);
    this.scene.addChild(container);
    this.applyClip(view, clip, undefined);
    return view;
  }

  /** Applies only what changed between `previous` and `clip`. */
  private applyClip(view: ClipView, clip: Clip, previous: Clip | undefined): void {
    view.clip = clip;
    const { container } = view;
    const { x, y, scale, rotation } = clip.transform;
    container.position.set(x, y);
    container.rotation = rotation;
    container.scale.set(scale);
    container.alpha = clip.opacity;

    if (clip.kind === 'text') {
      const prev = previous?.kind === 'text' ? previous : undefined;
      if (!prev || prev.text !== clip.text || prev.style !== clip.style) this.renderText(view, clip);
      return;
    }

    const prevFilter = previous && previous.kind !== 'text' ? previous.filter : undefined;
    if (!prevFilter || prevFilter.preset !== clip.filter.preset) {
      const old = container.filters as Filter[] | null;
      container.filters = createFilters(clip.filter);
      old?.forEach((filter) => filter.destroy());
    } else if (prevFilter.intensity !== clip.filter.intensity) {
      updateFilterIntensity(container.filters as Filter[], clip.filter);
    }
  }

  private renderText(view: ClipView, clip: TextClip): void {
    const { text, pill } = view;
    if (!text || !pill) return;
    const s = clip.style;
    text.style = new TextStyle({
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      fill: s.fill,
      align: 'center',
      lineHeight: s.fontSize * 1.15,
      wordWrap: true,
      wordWrapWidth: TEXT_WRAP_WIDTH,
      dropShadow: s.shadow ? { color: 0x000000, alpha: 0.55, blur: 12, distance: 4, angle: Math.PI / 2 } : false,
    });
    text.text = clip.text.trim() ? clip.text : ' ';

    pill.clear();
    if (s.background) {
      const padX = s.fontSize * 0.5;
      const padY = s.fontSize * 0.25;
      const w = text.width + padX * 2;
      const h = text.height + padY * 2;
      pill.roundRect(-w / 2, -h / 2, w, h, Math.min(h / 2, s.fontSize * 0.6)).fill(s.background);
    }
    this.dirty = true;
  }

  private attachImage(view: ClipView, asset: MediaAsset): void {
    let texture = this.imageTextures.get(asset.id);
    if (!texture) {
      texture = loadImageTexture(asset.src);
      this.imageTextures.set(asset.id, texture);
    }
    texture
      .then((loaded) => {
        if (view.destroyed || !view.sprite) return;
        view.sprite.texture = loaded;
        this.dirty = true;
      })
      .catch(() => this.imageTextures.delete(asset.id));
  }

  private attachVideo(view: ClipView, asset: MediaAsset): void {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = this.playback.muted();
    video.src = asset.src;
    video.addEventListener('seeked', () => (this.dirty = true));
    view.video = video;
    // Create the texture only once the frame size is known. A texture created
    // earlier is allocated at 1x1 on the GPU and later uploads overflow it.
    video.addEventListener(
      'loadeddata',
      () => {
        if (view.destroyed || !view.sprite) return;
        view.sprite.texture = new Texture({ source: new VideoSource({ resource: video, autoPlay: false }) });
        this.dirty = true;
      },
      { once: true },
    );
  }

  private destroyView(id: string, view: ClipView): void {
    view.destroyed = true;
    if (view.video) {
      view.video.pause();
      view.video.removeAttribute('src');
      view.video.load();
      if (view.sprite && view.sprite.texture !== Texture.EMPTY) view.sprite.texture.destroy(true);
    }
    (view.container.filters as Filter[] | null)?.forEach((filter) => filter.destroy());
    view.container.destroy({ children: true });
    this.views.delete(id);
    this.dirty = true;
  }

  // ---------------------------------------------------------- render loop

  private readonly tick = (ticker: Ticker): void => {
    this.playback.advance(ticker.deltaMS);
    const time = this.playback.time();
    const playing = this.playback.playing();
    const muted = this.playback.muted();
    const atEnd = this.playback.atEnd();

    if (time !== this.lastTime) {
      this.lastTime = time;
      this.dirty = true;
    }
    if (this.selectedId() !== this.lastSelected) {
      this.lastSelected = this.selectedId();
      this.dirty = true;
    }

    for (const view of this.views.values()) {
      const clip = view.clip;
      const end = clipEnd(clip);
      // At the very end of the project keep the last frame on screen.
      const active = time >= clip.start && (time < end || (atEnd && Math.abs(end - time) < 1e-3));
      if (view.container.visible !== active) {
        view.container.visible = active;
        this.dirty = true;
      }
      if (view.video) this.syncVideo(view, clip as VideoClip, view.video, active, time, playing, muted);
    }

    if (this.dirty || playing) {
      this.updateGizmo();
      this.app?.render();
      this.dirty = false;
    }
  };

  /** Keeps a video element in step with the timeline clock. */
  private syncVideo(
    view: ClipView,
    clip: VideoClip,
    video: HTMLVideoElement,
    active: boolean,
    time: number,
    playing: boolean,
    muted: boolean,
  ): void {
    video.muted = muted;
    if (!active) {
      if (!video.paused) video.pause();
      // Pre-roll: cue up clips that start within the next second.
      const lead = clip.start - time;
      if (lead > 0 && lead < 1 && !video.seeking && Math.abs(video.currentTime - clip.sourceOffset) > 0.05) {
        video.currentTime = clip.sourceOffset;
      }
      return;
    }

    const target = clamp(clip.sourceOffset + (time - clip.start), 0, Math.max(0, clip.sourceDuration - 0.04));
    if (playing) {
      if (video.paused && !view.playPending) {
        view.playPending = true;
        video.currentTime = target;
        video
          .play()
          .catch(() => undefined)
          .finally(() => (view.playPending = false));
      } else if (!video.paused && !video.seeking && Math.abs(video.currentTime - target) > DRIFT_TOLERANCE_S) {
        video.currentTime = target;
      }
    } else {
      if (!video.paused) video.pause();
      if (!video.seeking && Math.abs(video.currentTime - target) > 0.02) video.currentTime = target;
    }
  }

  // ---------------------------------------------------------------- gizmo

  private updateGizmo(): void {
    const id = this.selectedId();
    const view = id ? this.views.get(id) : undefined;
    const visible = !!view && view.container.visible;
    this.gizmo.visible = visible;
    if (!view || !visible) return;

    const k = 1 / this.world.scale.x;
    const bounds = view.container.getLocalBounds();
    const { x, y, scale, rotation } = view.clip.transform;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const toScene = (lx: number, ly: number) => ({
      x: x + (lx * cos - ly * sin) * scale,
      y: y + (lx * sin + ly * cos) * scale,
    });

    const left = bounds.x;
    const top = bounds.y;
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    const corners: Record<Exclude<HandleId, 'rotate'>, { x: number; y: number }> = {
      nw: toScene(left, top),
      ne: toScene(right, top),
      se: toScene(right, bottom),
      sw: toScene(left, bottom),
    };
    const topMid = toScene((left + right) / 2, top);
    const rotateAt = { x: topMid.x + sin * ROTATE_OFFSET_PX * k, y: topMid.y - cos * ROTATE_OFFSET_PX * k };

    this.outline
      .clear()
      .poly([corners.nw, corners.ne, corners.se, corners.sw].flatMap((p) => [p.x, p.y]), true)
      .stroke({ width: 2 * k, color: ACCENT })
      .moveTo(topMid.x, topMid.y)
      .lineTo(rotateAt.x, rotateAt.y)
      .stroke({ width: 2 * k, color: ACCENT });

    for (const [handleId, handle] of this.handles) {
      const p = handleId === 'rotate' ? rotateAt : corners[handleId];
      handle.position.set(p.x, p.y);
      handle.scale.set(k);
    }
  }

  // --------------------------------------------------------- interaction

  private onClipDown(id: string, event: FederatedPointerEvent): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    const view = this.views.get(id);
    if (!view) return;
    if (this.selectedId() !== id) this.commands.select(id);

    const now = performance.now();
    if (view.clip.kind === 'text' && this.lastClick.id === id && now - this.lastClick.at < 350) {
      this.commands.editText(id);
      return;
    }
    this.lastClick = { id, at: now };

    const start = this.scene.toLocal(event.global);
    const origin = { ...view.clip.transform };
    const project = this.project!;
    this.drag((point, gestureId) => {
      const threshold = SNAP_PX / this.world.scale.x;
      let x = origin.x + point.x - start.x;
      let y = origin.y + point.y - start.y;
      const snapX = Math.abs(x - project.width / 2) < threshold;
      const snapY = Math.abs(y - project.height / 2) < threshold;
      if (snapX) x = project.width / 2;
      if (snapY) y = project.height / 2;
      this.drawGuides(snapX, snapY);
      this.commands.update(id, { transform: { x, y } }, gestureId);
    });
  }

  private onHandleDown(handle: HandleId, event: FederatedPointerEvent): void {
    event.stopPropagation();
    const id = this.selectedId();
    const view = id ? this.views.get(id) : undefined;
    if (!id || !view) return;
    const origin = { ...view.clip.transform };
    const start = this.scene.toLocal(event.global);

    if (handle === 'rotate') {
      const startAngle = Math.atan2(start.y - origin.y, start.x - origin.x);
      this.drag((point, gestureId, pointer) => {
        let rotation = origin.rotation + Math.atan2(point.y - origin.y, point.x - origin.x) - startAngle;
        // Snap to 15° steps when close, or always while Shift is held.
        const step = Math.PI / 12;
        const snapped = Math.round(rotation / step) * step;
        if (pointer.shiftKey || Math.abs(rotation - snapped) < 0.04) rotation = snapped;
        this.commands.update(id, { transform: { rotation } }, gestureId);
      });
      return;
    }

    const startDistance = Math.max(1, Math.hypot(start.x - origin.x, start.y - origin.y));
    this.drag((point, gestureId) => {
      const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
      const scale = clamp((origin.scale * distance) / startDistance, 0.02, 40);
      this.commands.update(id, { transform: { scale } }, gestureId);
    });
  }

  /**
   * Runs a pointer drag as an RxJS stream. Moves are throttled to one per
   * animation frame and share one gesture id, so the whole drag becomes a
   * single undo step.
   */
  private drag(onMove: (point: Point, gestureId: string, event: PointerEvent) => void): void {
    const gestureId = uid('gesture');
    const end$ = merge(fromEvent(window, 'pointerup'), fromEvent(window, 'pointercancel'));
    fromEvent<PointerEvent>(window, 'pointermove')
      .pipe(
        auditTime(0, animationFrameScheduler),
        map((event) => ({ event, point: this.clientToScene(event.clientX, event.clientY) })),
        takeUntil(end$),
        finalize(() => {
          this.guides.clear();
          this.dirty = true;
        }),
      )
      .subscribe(({ event, point }) => onMove(point, gestureId, event));
  }

  private clientToScene(clientX: number, clientY: number): Point {
    const rect = this.app!.canvas.getBoundingClientRect();
    return this.scene.toLocal(new Point(clientX - rect.left, clientY - rect.top));
  }

  private drawGuides(vertical: boolean, horizontal: boolean): void {
    const project = this.project!;
    const width = 1.5 / this.world.scale.x;
    this.guides.clear();
    if (vertical) {
      this.guides.moveTo(project.width / 2, 0).lineTo(project.width / 2, project.height).stroke({ width, color: 0xec4899 });
    }
    if (horizontal) {
      this.guides.moveTo(0, project.height / 2).lineTo(project.width, project.height / 2).stroke({ width, color: 0xec4899 });
    }
  }
}

function loadImageTexture(src: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(Texture.from(image));
    image.onerror = () => reject(new Error(`could not load ${src}`));
    image.src = src;
  });
}

/** Emits the element's size whenever it changes, at most once per frame. */
function observeSize(element: HTMLElement): Observable<{ width: number; height: number }> {
  return new Observable<{ width: number; height: number }>((subscriber) => {
    const observer = new ResizeObserver(([entry]) => {
      subscriber.next({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }).pipe(auditTime(0, animationFrameScheduler));
}
