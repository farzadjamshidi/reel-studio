import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, debounceTime, filter, from, map, mergeMap, of, skip, tap, withLatestFrom } from 'rxjs';
import { createMediaClip } from '../core/clip-factory';
import { uid } from '../core/id';
import { MediaService } from '../services/media.service';
import { PlaybackService } from '../services/playback.service';
import { MediaActions } from './media.state';
import { saveProject } from './persistence';
import { ProjectActions } from './project.actions';
import { selectProject, selectProjectSize } from './selectors';

@Injectable()
export class EditorEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly media = inject(MediaService);
  private readonly playback = inject(PlaybackService);

  /** Reads file metadata off the main thread of the reducer, in parallel per file. */
  readonly importFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MediaActions.importRequested),
      mergeMap(({ file, placement }) =>
        from(this.media.loadFile(file)).pipe(
          map((asset) => MediaActions.imported({ asset, placement })),
          catchError((error: Error) => of(MediaActions.importFailed({ name: file.name, error: error.message }))),
        ),
      ),
    ),
  );

  /** Puts freshly imported media straight onto the timeline when asked to. */
  readonly placeImported$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MediaActions.imported),
      filter(({ placement }) => placement !== 'library'),
      withLatestFrom(this.store.select(selectProjectSize)),
      map(([{ asset, placement }, size]) => {
        const overlay = placement === 'overlay';
        const clip = createMediaClip(asset, size, overlay ? this.playback.time() : 0, overlay);
        return ProjectActions.addClip({ clip, placement: overlay ? 'at-start' : 'append-main', newTrackId: uid('track') });
      }),
    ),
  );

  /** Autosaves the project, at most a couple of times per second. */
  readonly autosave$ = createEffect(
    () =>
      this.store.select(selectProject).pipe(
        skip(1),
        debounceTime(400),
        tap((project) => saveProject(project)),
      ),
    { dispatch: false },
  );
}
