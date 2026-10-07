import { Action, ActionReducer } from '@ngrx/store';
import { HistoryActions } from './project.actions';

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Gesture of the last recorded change, used to merge continuous edits. */
  lastGestureId: string | null;
}

export const HISTORY_LIMIT = 100;

/**
 * Wraps a reducer with undo/redo.
 *
 * - Actions that leave the state unchanged are not recorded.
 * - Consecutive actions with the same `gestureId` (one drag, one typing
 *   session) collapse into one history entry.
 * - Snapshots are cheap because the inner reducer is immutable and shares
 *   structure between versions.
 */
export function undoable<T>(reducer: ActionReducer<T>, initialPresent?: T, limit = HISTORY_LIMIT): ActionReducer<History<T>> {
  const initial: History<T> = {
    past: [],
    present: initialPresent ?? reducer(undefined, { type: '@@history/init' }),
    future: [],
    lastGestureId: null,
  };

  return (state: History<T> | undefined = initial, action: Action): History<T> => {
    switch (action.type) {
      case HistoryActions.undo.type: {
        if (!state.past.length) return state;
        const previous = state.past[state.past.length - 1];
        return {
          past: state.past.slice(0, -1),
          present: previous,
          future: [state.present, ...state.future],
          lastGestureId: null,
        };
      }
      case HistoryActions.redo.type: {
        if (!state.future.length) return state;
        const [next, ...future] = state.future;
        return { past: [...state.past, state.present], present: next, future, lastGestureId: null };
      }
      case HistoryActions.reset.type:
        return { past: [], present: (action as ReturnType<typeof HistoryActions.reset>).project as T, future: [], lastGestureId: null };
    }

    const present = reducer(state.present, action);
    if (present === state.present) return state;

    const gestureId = (action as { gestureId?: string }).gestureId ?? null;
    if (gestureId !== null && gestureId === state.lastGestureId) {
      return { ...state, present, future: [] };
    }
    return {
      past: [...state.past, state.present].slice(-limit),
      present,
      future: [],
      lastGestureId: gestureId,
    };
  };
}
