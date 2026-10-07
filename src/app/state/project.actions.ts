import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Clip, FilterSettings, Project, TextStyleSettings, Transform } from '../core/models';

/**
 * Actions that carry a `gestureId` are coalesced by the history meta-reducer:
 * every update in one drag or one typing session becomes a single undo step.
 */
export interface ClipChanges {
  transform?: Partial<Transform>;
  opacity?: number;
  text?: string;
  style?: Partial<TextStyleSettings>;
  filter?: Partial<FilterSettings>;
}

export type Placement = 'append-main' | 'at-start';

export const ProjectActions = createActionGroup({
  source: 'Project',
  events: {
    'Add Clip': props<{ clip: Clip; placement: Placement; newTrackId: string }>(),
    'Update Clip': props<{ id: string; changes: ClipChanges; gestureId?: string }>(),
    'Move Clip': props<{ id: string; start: number; trackId: string; gestureId?: string }>(),
    'Trim Clip': props<{ id: string; edge: 'start' | 'end'; time: number; gestureId?: string }>(),
    'Split Clip': props<{ id: string; at: number; newId: string }>(),
    'Duplicate Clip': props<{ id: string; newId: string; newTrackId: string }>(),
    'Delete Clip': props<{ id: string }>(),
    'Set Background': props<{ color: string }>(),
    'Rename Project': props<{ name: string; gestureId?: string }>(),
  },
});

export const HistoryActions = createActionGroup({
  source: 'History',
  events: {
    Undo: emptyProps(),
    Redo: emptyProps(),
    /** Replaces the project and clears history, e.g. "reset demo". */
    Reset: props<{ project: Project }>(),
  },
});
