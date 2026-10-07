import { createActionGroup, createReducer, on, props } from '@ngrx/store';
import { MediaAsset } from '../core/models';

export type ImportPlacement = 'append-main' | 'overlay' | 'library';

export const MediaActions = createActionGroup({
  source: 'Media',
  events: {
    'Import Requested': props<{ file: File; placement: ImportPlacement }>(),
    Imported: props<{ asset: MediaAsset; placement: ImportPlacement }>(),
    'Import Failed': props<{ name: string; error: string }>(),
  },
});

export interface MediaState {
  assets: Record<string, MediaAsset>;
  order: string[];
  lastError: string | null;
}

export function createMediaReducer(seed: MediaAsset[]) {
  const initial: MediaState = {
    assets: Object.fromEntries(seed.map((a) => [a.id, a])),
    order: seed.map((a) => a.id),
    lastError: null,
  };
  return createReducer(
    initial,
    on(MediaActions.imported, (state, { asset }) => ({
      assets: { ...state.assets, [asset.id]: asset },
      order: [asset.id, ...state.order.filter((id) => id !== asset.id)],
      lastError: null,
    })),
    on(MediaActions.importFailed, (state, { name, error }) => ({
      ...state,
      lastError: `Could not import ${name}: ${error}`,
    })),
  );
}
