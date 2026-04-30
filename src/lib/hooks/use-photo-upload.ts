"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { preparePhoto } from "@/lib/photo-compress";

export type PendingStatus = "preparing" | "uploading" | "failed";

export interface PendingUpload {
  clientId: string;
  name: string;
  status: PendingStatus;
}

export interface UploadedPhoto {
  id: string;
  lat?: number | null;
  lng?: number | null;
  location?: string | null;
}

export function usePhotoUpload(activityId: string) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (input: FileList | File[]): Promise<UploadedPhoto[]> => {
      const files = Array.from(input).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length === 0) return [];

      const results: UploadedPhoto[] = [];
      let didSucceed = false;

      for (const file of files) {
        const clientId = `tmp-${crypto.randomUUID()}`;
        setPending((prev) => [
          ...prev,
          { clientId, name: file.name, status: "preparing" },
        ]);
        try {
          const prepared = await preparePhoto(file);
          setPending((prev) =>
            prev.map((p) =>
              p.clientId === clientId ? { ...p, status: "uploading" } : p,
            ),
          );
          const fd = new FormData();
          fd.append("files", prepared.file);
          if (
            prepared.exif.lat != null ||
            prepared.exif.lng != null ||
            prepared.exif.takenAt != null
          ) {
            fd.append("exif", JSON.stringify([prepared.exif]));
          }
          const res = await fetch(`/api/activities/${activityId}/photos`, {
            method: "POST",
            body: fd,
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          const uploaded = (data?.uploaded?.[0] ?? null) as UploadedPhoto | null;
          if (uploaded?.id) {
            results.push(uploaded);
            didSucceed = true;
          }
          setPending((prev) => prev.filter((p) => p.clientId !== clientId));
        } catch (err) {
          setPending((prev) =>
            prev.map((p) =>
              p.clientId === clientId ? { ...p, status: "failed" } : p,
            ),
          );
          setError(
            err instanceof Error ? err.message : "Upload fehlgeschlagen",
          );
        }
      }

      if (didSucceed) router.refresh();
      return results;
    },
    [activityId, router],
  );

  const remove = useCallback(
    async (photoId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        router.refresh();
        return true;
      } catch {
        setError("Foto konnte nicht gelöscht werden.");
        return false;
      }
    },
    [router],
  );

  const dismissPending = useCallback((clientId: string) => {
    setPending((prev) => prev.filter((p) => p.clientId !== clientId));
  }, []);

  return { pending, upload, remove, error, setError, dismissPending };
}
