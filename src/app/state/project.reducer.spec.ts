import { Clip, Project, TextClip, VideoClip } from '../core/models';
import { createDemoProject } from './demo-project';
import { ProjectActions } from './project.actions';
import { projectReducer } from './project.reducer';

const video = (overrides: Partial<VideoClip> = {}): VideoClip => ({
  id: 'v1',
  kind: 'video',
  trackId: 'main',
  assetId: 'a',
  start: 0,
  duration: 5,
  sourceOffset: 0,
  sourceDuration: 10,
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  filter: { preset: 'none', intensity: 1 },
  ...overrides,
});

const text = (overrides: Partial<TextClip> = {}): TextClip => ({
  id: 't1',
  kind: 'text',
  trackId: 'text-1',
  start: 0,
  duration: 3,
  text: 'Hello',
  style: { fontFamily: 'Inter', fontSize: 40, fill: '#fff', fontWeight: 'bold', background: null, shadow: false },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  ...overrides,
});

function project(...clips: Clip[]): Project {
  return {
    name: 'Test',
    width: 1080,
    height: 1920,
    background: '#000',
    tracks: [
      { id: 'text-1', kind: 'text' },
      { id: 'main', kind: 'main' },
    ],
    clips: Object.fromEntries(clips.map((c) => [c.id, c])),
  };
}

describe('projectReducer', () => {
  describe('split', () => {
    it('splits a video clip and carries the source offset into the right half', () => {
      const state = projectReducer(project(video({ sourceOffset: 1 })), ProjectActions.splitClip({ id: 'v1', at: 2, newId: 'v2' }));
      expect(state.clips['v1']).toMatchObject({ start: 0, duration: 2, sourceOffset: 1 });
      expect(state.clips['v2']).toMatchObject({ start: 2, duration: 3, sourceOffset: 3, trackId: 'main' });
    });

    it('ignores a split outside the clip', () => {
      const before = project(video());
      expect(projectReducer(before, ProjectActions.splitClip({ id: 'v1', at: 7, newId: 'v2' }))).toBe(before);
    });
  });

  describe('move', () => {
    it('rejects a move that would overlap another clip on the same track', () => {
      const before = project(video(), video({ id: 'v2', start: 6, duration: 2 }));
      const after = projectReducer(before, ProjectActions.moveClip({ id: 'v2', start: 4, trackId: 'main' }));
      expect(after).toBe(before);
    });

    it('does not allow text onto the main track', () => {
      const before = project(text());
      expect(projectReducer(before, ProjectActions.moveClip({ id: 't1', start: 0, trackId: 'main' }))).toBe(before);
    });

    it('moves into free space', () => {
      const after = projectReducer(project(video()), ProjectActions.moveClip({ id: 'v1', start: 3, trackId: 'main' }));
      expect(after.clips['v1'].start).toBe(3);
    });
  });

  describe('trim', () => {
    it('trims the start and shifts the source offset by the same amount', () => {
      const after = projectReducer(project(video({ start: 2, sourceOffset: 1 })), ProjectActions.trimClip({ id: 'v1', edge: 'start', time: 3 }));
      expect(after.clips['v1']).toMatchObject({ start: 3, duration: 4, sourceOffset: 2 });
    });

    it('cannot extend a video before the start of its source media', () => {
      const after = projectReducer(project(video({ start: 2, sourceOffset: 1 })), ProjectActions.trimClip({ id: 'v1', edge: 'start', time: 0 }));
      expect(after.clips['v1']).toMatchObject({ start: 1, sourceOffset: 0, duration: 6 });
    });

    it('cannot extend a video past the end of its source media', () => {
      const after = projectReducer(project(video({ sourceOffset: 4 })), ProjectActions.trimClip({ id: 'v1', edge: 'end', time: 20 }));
      expect(after.clips['v1'].duration).toBe(6);
    });

    it('stops at the next clip on the track', () => {
      const before = project(video({ sourceDuration: 60 }), video({ id: 'v2', start: 7 }));
      const after = projectReducer(before, ProjectActions.trimClip({ id: 'v1', edge: 'end', time: 20 }));
      expect(after.clips['v1'].duration).toBe(7);
    });
  });

  describe('add and duplicate', () => {
    it('creates a new text track when the existing one is busy', () => {
      const after = projectReducer(
        project(text()),
        ProjectActions.addClip({ clip: text({ id: 't2', trackId: '' }), placement: 'at-start', newTrackId: 'text-2' }),
      );
      expect(after.tracks.map((t) => t.id)).toEqual(['text-2', 'text-1', 'main']);
      expect(after.clips['t2'].trackId).toBe('text-2');
    });

    it('appends main-track media after the last clip', () => {
      const after = projectReducer(
        project(video()),
        ProjectActions.addClip({ clip: video({ id: 'v2', trackId: '', start: 0 }), placement: 'append-main', newTrackId: 'x' }),
      );
      expect(after.clips['v2']).toMatchObject({ trackId: 'main', start: 5 });
    });

    it('places a duplicate right after the original when there is room', () => {
      const after = projectReducer(project(text()), ProjectActions.duplicateClip({ id: 't1', newId: 't2', newTrackId: 'x' }));
      expect(after.clips['t2']).toMatchObject({ trackId: 'text-1', start: 3, text: 'Hello' });
    });
  });

  it('removes tracks that become empty on delete but keeps the main track', () => {
    const after = projectReducer(project(text()), ProjectActions.deleteClip({ id: 't1' }));
    expect(after.tracks.map((t) => t.id)).toEqual(['main']);
  });

  it('returns the same state for an update that changes nothing', () => {
    const before = project(text());
    const after = projectReducer(before, ProjectActions.updateClip({ id: 't1', changes: { transform: { x: 0 }, text: 'Hello' } }));
    expect(after).toBe(before);
  });

  it('builds a valid demo project with no overlapping clips', () => {
    const demo = createDemoProject();
    for (const track of demo.tracks) {
      const clips = Object.values(demo.clips).filter((c) => c.trackId === track.id).sort((a, b) => a.start - b.start);
      clips.slice(1).forEach((clip, i) => expect(clip.start).toBeGreaterThanOrEqual(clips[i].start + clips[i].duration));
    }
  });
});
