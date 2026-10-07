import { Clip, Project, Track, TrackKind, clipEnd, trackAccepts } from '../core/models';

const EPSILON = 1e-6;

export function clipsOnTrack(project: Project, trackId: string, ignoreId?: string): Clip[] {
  return Object.values(project.clips)
    .filter((clip) => clip.trackId === trackId && clip.id !== ignoreId)
    .sort((a, b) => a.start - b.start);
}

export function isRangeFree(
  project: Project,
  trackId: string,
  start: number,
  duration: number,
  ignoreId?: string,
): boolean {
  if (start < -EPSILON) return false;
  const end = start + duration;
  return clipsOnTrack(project, trackId, ignoreId).every(
    (other) => end <= other.start + EPSILON || start >= clipEnd(other) - EPSILON,
  );
}

export function trackEnd(project: Project, trackId: string): number {
  return clipsOnTrack(project, trackId).reduce((max, clip) => Math.max(max, clipEnd(clip)), 0);
}

/** The kind of track a new clip of this type should get when no existing track has room. */
export function newTrackKindFor(clip: Pick<Clip, 'kind'>): TrackKind {
  return clip.kind === 'text' ? 'text' : 'overlay';
}

/**
 * Text tracks go to the very top. Overlay tracks go just above the topmost
 * overlay track, or directly above the main track if there are none.
 */
export function insertTrack(tracks: Track[], track: Track): Track[] {
  if (track.kind === 'text') return [track, ...tracks];
  const anchor = tracks.findIndex((t) => t.kind !== 'text');
  const index = anchor === -1 ? tracks.length : anchor;
  return [...tracks.slice(0, index), track, ...tracks.slice(index)];
}

/**
 * Puts the clip on the preferred track if it fits there, otherwise on the first
 * compatible track with room, otherwise on a new track.
 */
export function placeClip(
  project: Project,
  clip: Clip,
  preferredTrackId: string | null,
  newTrackId: string,
): Project {
  const candidates = [
    ...project.tracks.filter((t) => t.id === preferredTrackId),
    ...project.tracks.filter((t) => t.id !== preferredTrackId && t.kind !== 'main'),
  ].filter((t) => trackAccepts(t, clip));

  const fit = candidates.find((t) => isRangeFree(project, t.id, clip.start, clip.duration));
  if (fit) {
    return { ...project, clips: { ...project.clips, [clip.id]: { ...clip, trackId: fit.id } } };
  }

  const track: Track = { id: newTrackId, kind: newTrackKindFor(clip) };
  return {
    ...project,
    tracks: insertTrack(project.tracks, track),
    clips: { ...project.clips, [clip.id]: { ...clip, trackId: track.id } },
  };
}

export function mainTrack(project: Project): Track | undefined {
  return project.tracks.find((t) => t.kind === 'main');
}

export function projectDuration(project: Project): number {
  return Object.values(project.clips).reduce((max, clip) => Math.max(max, clipEnd(clip)), 0);
}
