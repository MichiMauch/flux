/**
 * Hintergrundarbeiten für Videos: Upload umwandeln und Story-Video rendern.
 *
 * Beides läuft nach der Antwort an den Client weiter (next/server `after`) und
 * meldet seinen Stand über die Statusspalten in activity_videos. Ein Fehler
 * landet als "failed" in der Zeile, nie als hängendes "processing".
 */
import { stat, unlink, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityVideos } from "@/lib/db/schema";
import {
  VIDEO_MAX_DURATION_SEC,
  extractPoster,
  localCandidates,
  probeVideo,
  renderStoryVideo,
  transcodeVideo,
  videoPaths,
} from "@/lib/videos";
import { renderVideoOverlay } from "@/app/api/activities/[id]/share-card/story-overlay";

async function firstExisting(path: string): Promise<string | null> {
  for (const candidate of localCandidates(path)) {
    try {
      await stat(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

/** Den fertig hochgeladenen Rohfilm prüfen, umwandeln und freigeben. */
export async function processUploadedVideo(videoId: string, dir: string): Promise<void> {
  const p = videoPaths(dir, videoId);
  try {
    const source = await probeVideo(p.upload);
    if (source.durationSec > VIDEO_MAX_DURATION_SEC) {
      throw new Error(
        `Video zu lang (${Math.round(source.durationSec)} s, erlaubt ${VIDEO_MAX_DURATION_SEC} s)`
      );
    }
    await transcodeVideo(p.upload, p.file);
    const out = await probeVideo(p.file);
    await extractPoster(p.file, p.poster, Math.min(1, out.durationSec / 2));
    const { size } = await stat(p.file);
    await db
      .update(activityVideos)
      .set({
        status: "ready",
        filePath: p.file,
        posterPath: p.poster,
        durationSec: out.durationSec,
        width: out.width,
        height: out.height,
        sizeBytes: size,
      })
      .where(eq(activityVideos.id, videoId));
    console.info(
      `[videos] ${videoId} bereit: ${out.width}×${out.height}, ${out.durationSec.toFixed(1)} s, ${(size / 1e6).toFixed(1)} MB`
    );
  } catch (e) {
    console.error(`[videos] Umwandlung fehlgeschlagen (${videoId}):`, e);
    await db
      .update(activityVideos)
      .set({ status: "failed" })
      .where(eq(activityVideos.id, videoId));
    await unlink(p.file).catch(() => {});
  } finally {
    // Der Rohfilm wird nicht aufbewahrt — er ist oft ein Vielfaches grösser.
    await unlink(p.upload).catch(() => {});
  }
}

// Renderings, die in DIESEM Prozess laufen. Steht in der Zeile "processing",
// aber hier nichts, wurde der Server mittendrin neu gestartet (Deploy) — dann
// wird neu gerendert statt ewig gewartet.
const renderingNow = new Set<string>();

export type StoryState = { status: "ready" | "processing" | "failed" };

/**
 * Prüfen, ob das Story-Video zum aktuellen Stand der Aktivität passt, und es
 * sonst zum Rendern vormerken. Gibt den Stand zurück und, falls gerendert
 * werden muss, die Arbeit als Funktion — der Aufrufer reicht sie an `after`.
 */
export async function prepareStory(
  videoId: string,
  activityId: string
): Promise<{ state: StoryState; work: (() => Promise<void>) | null }> {
  const [video] = await db
    .select()
    .from(activityVideos)
    .where(eq(activityVideos.id, videoId))
    .limit(1);
  if (!video || video.status !== "ready" || !video.filePath) {
    return { state: { status: "failed" }, work: null };
  }
  const overlay = await renderVideoOverlay(activityId);
  if (!overlay) return { state: { status: "failed" }, work: null };

  const upToDate = video.storyKey === overlay.key;
  if (upToDate && video.storyStatus === "ready" && video.storyPath) {
    if (await firstExisting(video.storyPath)) {
      return { state: { status: "ready" }, work: null };
    }
  }
  // Läuft für genau diesen Stand schon ein Rendering, kein zweites starten.
  if (upToDate && video.storyStatus === "processing" && renderingNow.has(videoId)) {
    return { state: { status: "processing" }, work: null };
  }

  const input = await firstExisting(video.filePath);
  if (!input) return { state: { status: "failed" }, work: null };
  // Story und Overlay liegen neben dem Video, wo auch immer das gefunden wurde.
  const p = videoPaths(input.slice(0, input.lastIndexOf("/")), videoId);

  await db
    .update(activityVideos)
    .set({ storyStatus: "processing", storyKey: overlay.key })
    .where(eq(activityVideos.id, videoId));

  renderingNow.add(videoId);
  const work = async () => {
    try {
      await writeFile(p.overlay, overlay.png);
      await renderStoryVideo(input, p.overlay, p.story);
      await db
        .update(activityVideos)
        .set({ storyStatus: "ready", storyPath: p.story })
        .where(eq(activityVideos.id, videoId));
      console.info(`[videos] Story-Video ${videoId} bereit`);
    } catch (e) {
      console.error(`[videos] Story-Rendering fehlgeschlagen (${videoId}):`, e);
      await db
        .update(activityVideos)
        .set({ storyStatus: "failed" })
        .where(eq(activityVideos.id, videoId));
    } finally {
      renderingNow.delete(videoId);
      await unlink(p.overlay).catch(() => {});
    }
  };
  return { state: { status: "processing" }, work };
}
