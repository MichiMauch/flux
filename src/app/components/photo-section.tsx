"use client";

import { useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";

interface Photo {
  id: string;
  lat: number | null;
  lng: number | null;
}

interface PhotoSectionProps {
  activityId: string;
  initialPhotos: Photo[];
}

export function PhotoSection({ activityId, initialPhotos }: PhotoSectionProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }

    try {
      const res = await fetch(`/api/activities/${activityId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload fehlgeschlagen");
      const data = await res.json();
      setPhotos((prev) => [...prev, ...data.uploaded]);
      window.location.reload(); // refresh to show photos on map
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Foto wirklich löschen?")) return;
    const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      window.location.reload();
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Fotos {photos.length > 0 && `(${photos.length})`}
        </h2>
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-muted cursor-pointer transition-colors">
          <Upload className="h-4 w-4" />
          {uploading ? "Lädt..." : "Hochladen"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-2">{error}</p>
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Noch keine Fotos. Lade welche hoch — sie erscheinen automatisch auf
          der Karte (sofern GPS-Daten in EXIF).
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square">
              <a href={`#photo=${photo.id}`}>
                <img
                  src={`/api/photos/${photo.id}?thumb=1`}
                  alt=""
                  className="w-full h-full object-cover rounded"
                />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Löschen"
              >
                <X className="h-3 w-3 text-white" />
              </button>
              {photo.lat == null && (
                <div
                  className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded"
                  title="Kein GPS in EXIF"
                >
                  Kein GPS
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
