import { createReducer, on } from '@ngrx/store';
import { Clip, MIN_CLIP_DURATION, Project, clipEnd, trackAccepts } from '../core/models';
import { clamp } from '../core/time';
import { ClipChanges, ProjectActions } from './project.actions';
import { clipsOnTrack, isRangeFree, mainTrack, placeClip, trackEnd } from './placement';

/** True when applying `changes` would not alter the clip, so no history entry is needed. */
export function isNoopChange(clip: Clip, changes: ClipChanges): boolean {
  const same = <T extends object>(current: T, patch?: Partial<T>) =>
    !patch || (Object.keys(patch) as (keyof T)[]).every((key) => current[key] === patch[key]);
  if (!same(clip.transform, changes.transform)) return false;
  if (changes.opacity !== undefined && changes.opacity !== clip.opacity) return false;
  if (clip.kind === 'text') {
    return (changes.text === undefined || changes.text === clip.text) && same(clip.style, changes.style);
  }
  return same(clip.filter, changes.filter);
}

export function applyChanges(clip: Clip, changes: ClipChanges): Clip {
  const base = {
    ...clip,
    transform: changes.transform ? { ...clip.transform, ...changes.transform } : clip.transform,
    opacity: changes.opacity ?? clip.opacity,
  };
  if (base.kind === 'text') {
    return {
      ...base,
      text: changes.text ?? base.text,
      style: changes.style ? { ...base.style, ...changes.style } : base.style,
    };
  }
  return { ...base, filter: changes.filter ? { ...base.filter, ...changes.filter } : base.filter };
}

function withClip(project: Project, clip: Clip): Project {
  return { ...project, clips: { ...project.clips, [clip.id]: clip } };
}

/** Trims one edge, respecting neighbours, the minimum length and the source media length. */
export function trimClip(project: Project, clip: Clip, edge: 'start' | 'end', time: number): Clip {
  const others = clipsOnTrack(project, clip.trackId, clip.id);
  const end = clipEnd(clip);

  if (edge === 'start') {
    const prevEnd = others.filter((o) => clipEnd(o) <= clip.start + 1e-6).reduce((m, o) => Math.max(m, clipEnd(o)), 0);
    const sourceMin = clip.kind === 'video' ? clip.start - clip.sourceOffset : -Infinity;
    const start = clamp(time, Math.max(prevEnd, sourceMin, 0), end - MIN_CLIP_DURATION);
    const delta = start - clip.start;
    const trimmed = { ...clip, start, duration: end - start };
    return trimmed.kind === 'video' ? { ...trimmed, sourceOffset: trimmed.sourceOffset + delta } : trimmed;
  }

  const nextStart = others.filter((o) => o.start >= end - 1e-6).reduce((m, o) => Math.min(m, o.start), Infinity);
  const sourceMax = clip.kind === 'video' ? clip.start + clip.sourceDuration - clip.sourceOffset : Infinity;
  const newEnd = clamp(time, clip.start + MIN_CLIP_DURATION, Math.min(nextStart, sourceMax));
  return { ...clip, duration: newEnd - clip.start };
}

export const initialProjectState: Project = {
  name: 'Untitled 9:16 Portrait',
  width: 1080,
  height: 1920,
  background: '#111827',
  tracks: [{ id: 'main', kind: 'main' }],
  clips: {},
};

export const projectReducer = createReducer(
  initialProjectState,

  on(ProjectActions.addClip, (project, { clip, placement, newTrackId }) => {
    const main = mainTrack(project);
    if (placement === 'append-main' && main && clip.kind !== 'text') {
      return withClip(project, { ...clip, trackId: main.id, start: trackEnd(project, main.id) });
    }
    return placeClip(project, clip, null, newTrackId);
  }),

  on(ProjectActions.updateClip, (project, { id, changes }) => {
    const clip = project.clips[id];
    if (!clip || isNoopChange(clip, changes)) return project;
    return withClip(project, applyChanges(clip, changes));
  }),

  on(ProjectActions.moveClip, (project, { id, start, trackId }) => {
    const clip = project.clips[id];
    const track = project.tracks.find((t) => t.id === trackId);
    if (!clip || !track || !trackAccepts(track, clip)) return project;
    const safeStart = Math.max(0, start);
    if (safeStart === clip.start && trackId === clip.trackId) return project;
    if (!isRangeFree(project, trackId, safeStart, clip.duration, id)) return project;
    return withClip(project, { ...clip, start: safeStart, trackId });
  }),

  on(ProjectActions.trimClip, (project, { id, edge, time }) => {
    const clip = project.clips[id];
    if (!clip) return project;
    const trimmed = trimClip(project, clip, edge, time);
    if (trimmed.start === clip.start && trimmed.duration === clip.duration) return project;
    return withClip(project, trimmed);
  }),

  on(ProjectActions.splitClip, (project, { id, at, newId }) => {
    const clip = project.clips[id];
    if (!clip || at <= clip.start + MIN_CLIP_DURATION / 2 || at >= clipEnd(clip) - MIN_CLIP_DURATION / 2) {
      return project;
    }
    const leftDuration = at - clip.start;
    const left: Clip = { ...clip, duration: leftDuration };
    const rightBase = { ...clip, id: newId, start: at, duration: clip.duration - leftDuration };
    const right: Clip =
      rightBase.kind === 'video' ? { ...rightBase, sourceOffset: rightBase.sourceOffset + leftDuration } : rightBase;
    return { ...project, clips: { ...project.clips, [left.id]: left, [right.id]: right } };
  }),

  on(ProjectActions.duplicateClip, (project, { id, newId, newTrackId }) => {
    const clip = project.clips[id];
    if (!clip) return project;
    const copy: Clip = { ...clip, id: newId, start: clipEnd(clip) };
    return placeClip(project, copy, clip.trackId, newTrackId);
  }),

  on(ProjectActions.deleteClip, (project, { id }) => {
    if (!project.clips[id]) return project;
    const { [id]: _removed, ...clips } = project.clips;
    const used = new Set(Object.values(clips).map((c) => c.trackId));
    // Drop tracks that became empty, but always keep the main track.
    const tracks = project.tracks.filter((t) => t.kind === 'main' || used.has(t.id));
    return { ...project, clips, tracks };
  }),

  on(ProjectActions.setBackground, (project, { color }) =>
    project.background === color ? project : { ...project, background: color },
  ),

  on(ProjectActions.renameProject, (project, { name }) =>
    project.name === name ? project : { ...project, name },
  ),
);
