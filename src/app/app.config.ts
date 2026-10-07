import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { SAMPLE_ASSETS } from './state/demo-project';
import { EditorEffects } from './state/editor.effects';
import { undoable } from './state/history';
import { createMediaReducer } from './state/media.state';
import { loadProject } from './state/persistence';
import { projectReducer } from './state/project.reducer';
import { uiReducer } from './state/ui.state';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideStore(
      {
        project: undoable(projectReducer, loadProject(SAMPLE_ASSETS)),
        media: createMediaReducer(SAMPLE_ASSETS),
        ui: uiReducer,
      },
      {
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: false, // actions may carry File objects
          strictStateSerializability: true,
        },
      },
    ),
    provideEffects(EditorEffects),
    provideStoreDevtools({ maxAge: 50, logOnly: !isDevMode(), connectInZone: false }),
  ],
};
