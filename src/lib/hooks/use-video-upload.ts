"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { VIDEO_CHUNK_BYTES, VIDEO_MAX_BYTES } from "@/lib/video-limits";

export interface PendingVideo {
  clientId: string;
  name: string;
  /** 0–1, Anteil der hochgeladenen Bytes. */
  progress: number;
  status: "uploading" | "failed";
}

/**
 * Video in Stücken hochladen (siehe /api/activities/[id]/videos). Nach dem
 * letzten Stück wandelt der Server im Hintergrund um; die Seite wird neu
 * geladen und zeigt das Video als "wird verarbeitet".
 */
export function useVideoUpload(activityId: string) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingVideo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const patch = (clientId: string, change: Partial<PendingVideo>) =>
    setPending((prev) =>
      prev.map((p) => (p.clientId === clientId ? { ...p, ...change } : p))
    );

  const upload = useCallback(
    async (file: File): Promise<boolean> => {
      setError(null);
      if (!file.type.startsWith("video/")) {
        setError("Nur Videodateien erlaubt.");
        return false;
      }
      if (file.size > VIDEO_MAX_BYTES) {
        setError(`Video zu gross (max ${Math.round(VIDEO_MAX_BYTES / 1e6)} MB).`);
        return false;
      }

      const uploadId = crypto.randomUUID();
      const total = Math.ceil(file.size / VIDEO_CHUNK_BYTES);
      setPending((prev) => [
        ...prev,
        { clientId: uploadId, name: file.name, progress: 0, status: "uploading" },
      ]);

      try {
        for (let index = 0; index < total; index++) {
          const start = index * VIDEO_CHUNK_BYTES;
          const params = new URLSearchParams({
            uploadId,
            index: String(index),
            total: String(total),
            size: String(file.size),
            name: file.name,
          });
          const res = await fetch(`/api/activities/${activityId}/videos?${params}`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: file.slice(start, start + VIDEO_CHUNK_BYTES),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error ?? "Upload fehlgeschlagen");
          }
          patch(uploadId, { progress: (index + 1) / total });
        }
        setPending((prev) => prev.filter((p) => p.clientId !== uploadId));
        router.refresh();
        return true;
      } catch (err) {
        patch(uploadId, { status: "failed" });
        setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
        return false;
      }
    },
    [activityId, router]
  );

  const remove = useCallback(
    async (videoId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        router.refresh();
        return true;
      } catch {
        setError("Video konnte nicht gelöscht werden.");
        return false;
      }
    },
    [router]
  );

  const dismissPending = useCallback((clientId: string) => {
    setPending((prev) => prev.filter((p) => p.clientId !== clientId));
  }, []);

  return { pending, upload, remove, error, setError, dismissPending };
}
