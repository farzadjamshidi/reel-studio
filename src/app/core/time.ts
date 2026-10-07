/** Formats seconds as mm:ss.d, matching the editor's time display. */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe * 10) % 10);
  return `${pad(minutes)}:${pad(secs)}.${tenths}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
