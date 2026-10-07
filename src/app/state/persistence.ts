import { MediaAsset, Project } from '../core/models';
import { createDemoProject } from './demo-project';

const KEY = 'reel-editor.project.v1';

/**
 * Restores the last project. Clips that point to uploaded files are dropped,
 * because their blob URLs do not survive a reload.
 */
export function loadProject(knownAssets: MediaAsset[]): Project {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createDemoProject();
    const project = JSON.parse(raw) as Project;
    if (!project?.tracks?.length || typeof project.clips !== 'object') return createDemoProject();
    const known = new Set(knownAssets.map((a) => a.id));
    const clips = Object.fromEntries(
      Object.entries(project.clips).filter(([, clip]) => clip.kind === 'text' || known.has(clip.assetId)),
    );
    return { ...project, clips };
  } catch {
    return createDemoProject();
  }
}

export function saveProject(project: Project): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    // Storage can be full or blocked; autosave is a convenience only.
  }
}
