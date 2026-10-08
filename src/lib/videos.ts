/**
 * Videos zu Aktivitäten: Ablage, Umwandlung und Story-Rendering über ffmpeg.
 *
 * ffmpeg und ffprobe müssen im PATH liegen (im Docker-Image per apk, lokal per
 * Homebrew). Aufgerufen wird immer mit Argument-Array, nie über eine Shell —
 * Dateinamen aus dem Upload landen so nicht in einer Kommandozeile.
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import { getPhotoDir } from "@/lib/photos";

import {
  STORY_MAX_DURATION_SEC,
  VIDEO_CHUNK_BYTES,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_SEC,
} from "@/lib/video-limits";

export {
  STORY_MAX_DURATION_SEC,
  VIDEO_CHUNK_BYTES,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_SEC,
};

// Videos liegen im selben Ordner wie die Fotos der Aktivität: ein Volume, eine
// Sicherung, und beim Löschen der Aktivität ein Ort zum Aufräumen.
export function getVideoDir(userId: string, activityId: string): string {
  return getPhotoDir(userId, activityId);
}

export function videoPaths(dir: string, videoId: string) {
  return {
    upload: join(dir, `${videoId}.upload`),
    file: join(dir, `${videoId}.mp4`),
    poster: join(dir, `${videoId}-poster.jpg`),
    story: join(dir, `${videoId}-story.mp4`),
    overlay: join(dir, `${videoId}-overlay.png`),
  };
}

/** Prod-Pfade (/data/…) lokal unter ./data/… suchen, wie bei den Fotos. */
export function localCandidates(path: string): string[] {
  return path.startsWith("/data/") ? [path, "." + path] : [path];
}

function run(
  cmd: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    // ffmpeg schreibt seinen Fortschritt nach stderr; nur das Ende behalten.
    child.stderr.on("data", (d) => {
      stderr = (stderr + d).slice(-4000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} Zeitüberschreitung nach ${timeoutMs / 1000}s`));
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} endete mit Code ${code}: ${stderr.slice(-600)}`));
    });
  });
}

export interface VideoInfo {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

/**
 * Datei mit ffprobe lesen. Wirft, wenn es kein Video ist — das ist zugleich
 * die Inhaltsprüfung des Uploads (nicht der MIME-Typ vom Client).
 */
export async function probeVideo(path: string): Promise<VideoInfo> {
  const { stdout } = await run(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
    30_000
  );
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: {
      codec_type?: string;
      width?: number;
      height?: number;
      duration?: string;
      tags?: { rotate?: string };
      side_data_list?: { rotation?: number }[];
    }[];
  };
  const video = data.streams?.find((s) => s.codec_type === "video");
  if (!video?.width || !video?.height) throw new Error("Keine Videospur gefunden");
  const durationSec = Number(data.format?.duration ?? video.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error("Videodauer nicht lesbar");
  }
  // Handyvideos im Hochformat sind oft quer gespeichert und per Metadaten
  // gedreht. ffmpeg dreht beim Umwandeln selbst; hier nur die Masse tauschen.
  const rotation = Math.abs(
    Number(video.side_data_list?.find((d) => d.rotation != null)?.rotation ?? video.tags?.rotate ?? 0)
  );
  const swapped = rotation === 90 || rotation === 270;
  return {
    durationSec,
    width: swapped ? video.height : video.width,
    height: swapped ? video.width : video.height,
    hasAudio: !!data.streams?.some((s) => s.codec_type === "audio"),
  };
}

/**
 * Upload in ein MP4 umwandeln, das jeder Browser abspielt: H.264, höchstens
 * 1920 px an der langen Kante, 30 fps, Metadaten vorne für sofortigen Start.
 */
export async function transcodeVideo(input: string, output: string): Promise<void> {
  await run(
    "ffmpeg",
    [
      "-y", "-i", input,
      "-vf", "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      "-r", "30",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      output,
    ],
    15 * 60_000
  );
}

export async function extractPoster(
  input: string,
  output: string,
  atSec: number
): Promise<void> {
  await run(
    "ffmpeg",
    [
      "-y", "-ss", atSec.toFixed(2), "-i", input,
      "-frames:v", "1",
      "-vf", "scale='min(960,iw)':-2",
      "-q:v", "4",
      output,
    ],
    60_000
  );
}

/**
 * Story-Video bauen: Video auf 1080×1920 füllend zuschneiden, das transparente
 * Overlay (Route, Werte, Titel) darüberlegen, nach 60 Sekunden abschneiden.
 *
 * Das Overlay ist ein einzelnes PNG; der overlay-Filter hält dessen letztes
 * Bild von sich aus bis zum Ende des Videos.
 */
export async function renderStoryVideo(
  input: string,
  overlayPng: string,
  output: string
): Promise<void> {
  await run(
    "ffmpeg",
    [
      "-y", "-i", input, "-i", overlayPng,
      "-filter_complex",
      "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];[bg][1:v]overlay=0:0[v]",
      "-map", "[v]", "-map", "0:a?",
      "-t", String(STORY_MAX_DURATION_SEC),
      "-r", "30",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      output,
    ],
    10 * 60_000
  );
}
