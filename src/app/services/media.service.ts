import { Injectable, Signal, signal } from '@angular/core';
import { MediaAsset } from '../core/models';
import { uid } from '../core/id';

const THUMB_HEIGHT = 72;

/** Reads media metadata and builds filmstrip thumbnails for the timeline. */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly thumbs = new Map<string, Signal<string[]>>();

  async loadFile(file: File): Promise<MediaAsset> {
    const src = URL.createObjectURL(file);
    try {
      if (file.type.startsWith('video/')) {
        const video = await this.loadVideo(src);
        return {
          id: uid('asset'),
          kind: 'video',
          name: file.name,
          src,
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
        };
      }
      if (file.type.startsWith('image/')) {
        const image = await this.loadImage(src);
        return { id: uid('asset'), kind: 'image', name: file.name, src, width: image.naturalWidth, height: image.naturalHeight };
      }
      throw new Error('unsupported file type');
    } catch (error) {
      URL.revokeObjectURL(src);
      throw error;
    }
  }

  /** One thumbnail per second of video. Generated once per asset, in the background. */
  thumbnails(asset: MediaAsset): Signal<string[]> {
    let result = this.thumbs.get(asset.id);
    if (!result) {
      const frames = signal<string[]>([]);
      result = frames.asReadonly();
      this.thumbs.set(asset.id, result);
      if (asset.kind === 'image') frames.set([asset.src]);
      else void this.captureFrames(asset, (list) => frames.set(list));
    }
    return result;
  }

  private async captureFrames(asset: MediaAsset, emit: (frames: string[]) => void): Promise<void> {
    const video = await this.loadVideo(asset.src);
    const canvas = document.createElement('canvas');
    canvas.height = THUMB_HEIGHT;
    canvas.width = Math.round((THUMB_HEIGHT * video.videoWidth) / video.videoHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const frames: string[] = [];
    const count = Math.max(1, Math.ceil(video.duration));
    for (let i = 0; i < count; i++) {
      await this.seek(video, Math.min(i + 0.05, video.duration - 0.05));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', 0.6));
      // Emit progressively so the filmstrip fills in while frames are captured.
      emit([...frames]);
    }
    video.removeAttribute('src');
    video.load();
  }

  private loadVideo(src: string): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.onloadeddata = () => resolve(video);
      video.onerror = () => reject(new Error('could not decode video'));
      video.src = src;
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('could not decode image'));
      image.src = src;
    });
  }

  private seek(video: HTMLVideoElement, time: number): Promise<void> {
    return new Promise((resolve) => {
      video.addEventListener('seeked', () => resolve(), { once: true });
      video.currentTime = time;
    });
  }
}
