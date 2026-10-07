import { Project } from '../core/models';
import { createDemoProject } from './demo-project';
import { undoable } from './history';
import { HistoryActions, ProjectActions } from './project.actions';
import { projectReducer } from './project.reducer';

describe('undoable', () => {
  const reducer = undoable<Project>(projectReducer, createDemoProject());
  const init = () => reducer(undefined, { type: '@@init' });
  const move = (x: number, gestureId?: string) =>
    ProjectActions.updateClip({ id: 'clip-title', changes: { transform: { x } }, gestureId });

  it('undoes and redoes a change', () => {
    const initial = init();
    const moved = reducer(initial, move(10));
    const undone = reducer(moved, HistoryActions.undo());
    expect(undone.present).toBe(initial.present);
    const redone = reducer(undone, HistoryActions.redo());
    expect(redone.present).toBe(moved.present);
  });

  it('collapses a whole gesture into one undo step', () => {
    let state = init();
    for (const x of [10, 20, 30, 40]) state = reducer(state, move(x, 'drag-1'));
    expect(state.past.length).toBe(1);
    expect(state.present.clips['clip-title'].transform.x).toBe(40);
    expect(reducer(state, HistoryActions.undo()).present).toBe(init().present);
  });

  it('starts a new step for a new gesture', () => {
    let state = reducer(init(), move(10, 'a'));
    state = reducer(state, move(20, 'b'));
    expect(state.past.length).toBe(2);
  });

  it('does not record actions that change nothing', () => {
    const initial = init();
    expect(reducer(initial, ProjectActions.deleteClip({ id: 'missing' }))).toBe(initial);
  });

  it('clears the redo stack after a new change', () => {
    let state = reducer(init(), move(10));
    state = reducer(state, HistoryActions.undo());
    state = reducer(state, move(50));
    expect(state.future.length).toBe(0);
  });

  it('caps history length', () => {
    const limited = undoable<Project>(projectReducer, createDemoProject(), 3);
    let state = limited(undefined, { type: '@@init' });
    for (let i = 1; i <= 10; i++) state = limited(state, move(i));
    expect(state.past.length).toBe(3);
  });

  it('a gesture continued after undo starts a fresh step', () => {
    let state = reducer(init(), move(10, 'g'));
    state = reducer(state, HistoryActions.undo());
    state = reducer(state, move(20, 'g'));
    expect(state.past.length).toBe(1);
    expect(state.future.length).toBe(0);
  });
});
