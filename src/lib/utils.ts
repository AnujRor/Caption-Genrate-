import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Per-browser UI preferences. Storage can be blocked (private mode), so failures fall back silently. */
export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`pref:${key}`);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return typeof value === typeof fallback ? value : fallback;
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: unknown) {
  try {
    localStorage.setItem(`pref:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Reads duration and grabs a small JPEG poster frame from a video file. */
export function readVideoInfo(file: Blob): Promise<{ duration?: number; thumbnail?: string; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    let done = false;
    const finish = (info: { duration?: number; thumbnail?: string; width?: number; height?: number }) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(info);
    };
    const timer = setTimeout(() => finish({ duration: Number.isFinite(video.duration) ? video.duration : undefined }), 8000);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 3);
    };
    video.onseeked = () => {
      clearTimeout(timer);
      let thumbnail: string | undefined;
      try {
        const w = 360;
        const h = Math.round((w * video.videoHeight) / (video.videoWidth || 1)) || 640;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
        thumbnail = canvas.toDataURL("image/jpeg", 0.72);
      } catch {
        thumbnail = undefined;
      }
      finish({ duration: video.duration, thumbnail, width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      clearTimeout(timer);
      finish({});
    };
    video.src = url;
  });
}
