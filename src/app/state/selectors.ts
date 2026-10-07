import { createFeatureSelector, createSelector } from '@ngrx/store';
import { Clip, Project } from '../core/models';
import { History } from './history';
import { MediaState } from './media.state';
import { projectDuration } from './placement';
import { UiState } from './ui.state';

export interface AppState {
  project: History<Project>;
  media: MediaState;
  ui: UiState;
}

export const selectHistory = createFeatureSelector<History<Project>>('project');
export const selectMedia = createFeatureSelector<MediaState>('media');
export const selectUi = createFeatureSelector<UiState>('ui');

export const selectProject = createSelector(selectHistory, (h) => h.present);
export const selectCanUndo = createSelector(selectHistory, (h) => h.past.length > 0);
export const selectCanRedo = createSelector(selectHistory, (h) => h.future.length > 0);

export const selectClips = createSelector(selectProject, (p) => p.clips);
export const selectTracks = createSelector(selectProject, (p) => p.tracks);
export const selectBackground = createSelector(selectProject, (p) => p.background);
export const selectProjectName = createSelector(selectProject, (p) => p.name);
export const selectProjectSize = createSelector(selectProject, (p) => ({ width: p.width, height: p.height }));
export const selectDuration = createSelector(selectProject, (p) => projectDuration(p));

/** Tracks with their clips, sorted by start time, ready for the timeline. */
export const selectTimelineRows = createSelector(selectTracks, selectClips, (tracks, clips) => {
  const byTrack = new Map<string, Clip[]>(tracks.map((t) => [t.id, []]));
  for (const clip of Object.values(clips)) byTrack.get(clip.trackId)?.push(clip);
  return tracks.map((track) => ({ track, clips: (byTrack.get(track.id) ?? []).sort((a, b) => a.start - b.start) }));
});

export const selectAssets = createSelector(selectMedia, (m) => m.assets);
export const selectAssetList = createSelector(selectMedia, (m) => m.order.map((id) => m.assets[id]));
export const selectMediaError = createSelector(selectMedia, (m) => m.lastError);

export const selectSelectedId = createSelector(selectUi, (ui) => ui.selectedClipId);
export const selectSelectedClip = createSelector(selectClips, selectSelectedId, (clips, id) =>
  id ? (clips[id] ?? null) : null,
);
export const selectPxPerSecond = createSelector(selectUi, (ui) => ui.pxPerSecond);
export const selectActivePanel = createSelector(selectUi, (ui) => ui.activePanel);
