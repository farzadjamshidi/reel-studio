import { createActionGroup, createReducer, emptyProps, on, props } from '@ngrx/store';
import { HistoryActions, ProjectActions } from './project.actions';

export type PanelId = 'media' | 'text' | 'filters' | 'background';

export const UiActions = createActionGroup({
  source: 'UI',
  events: {
    Select: props<{ id: string | null }>(),
    'Set Zoom': props<{ pxPerSecond: number }>(),
    'Open Panel': props<{ panel: PanelId | null }>(),
    'Toggle Panel': props<{ panel: PanelId }>(),
    'Close Panel': emptyProps(),
  },
});

/** Editor UI state. Deliberately outside undo history. */
export interface UiState {
  selectedClipId: string | null;
  pxPerSecond: number;
  activePanel: PanelId | null;
}

export const MIN_ZOOM = 8;
export const MAX_ZOOM = 200;

const isNarrow = typeof window !== 'undefined' && window.innerWidth < 720;

export const initialUiState: UiState = {
  selectedClipId: null,
  pxPerSecond: isNarrow ? 28 : 48,
  // On phones the canvas needs the room; panels open from the tool rail.
  activePanel: isNarrow ? null : 'media',
};

export const uiReducer = createReducer(
  initialUiState,
  on(UiActions.select, (state, { id }) => ({ ...state, selectedClipId: id })),
  on(UiActions.setZoom, (state, { pxPerSecond }) => ({
    ...state,
    pxPerSecond: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pxPerSecond)),
  })),
  on(UiActions.openPanel, (state, { panel }) => ({ ...state, activePanel: panel })),
  on(UiActions.togglePanel, (state, { panel }) => ({
    ...state,
    activePanel: state.activePanel === panel ? null : panel,
  })),
  on(UiActions.closePanel, (state) => ({ ...state, activePanel: null })),
  on(ProjectActions.deleteClip, (state, { id }) =>
    state.selectedClipId === id ? { ...state, selectedClipId: null } : state,
  ),
  on(ProjectActions.addClip, (state, { clip }) => ({ ...state, selectedClipId: clip.id })),
  on(ProjectActions.duplicateClip, (state, { newId }) => ({ ...state, selectedClipId: newId })),
  on(HistoryActions.reset, (state) => ({ ...state, selectedClipId: null })),
);
