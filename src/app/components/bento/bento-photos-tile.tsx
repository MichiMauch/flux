"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Tile, TileLabel } from "@/app/activity/[id]/tiles";
import { usePhotoUpload } from "@/lib/hooks/use-photo-upload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NEON = "var(--activity-color, #FF6A00)";

interface PhotoItem {
  id: string;
  lat: number | null;
  lng: number | null;
  takenAt: Date | string | null;
}

interface Props {
  activityId: string;
  photos: PhotoItem[];
  isOwner: boolean;
}

export function BentoPhotosTile({ activityId, photos, isOwner }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pending, upload, remove, error, setError, dismissPending } =
    usePhotoUpload(activityId);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openPhoto = useCallback((id: string) => {
    if (typeof window !== "undefined") {
      window.location.hash = `photo=${id}`;
    }
  }, []);

  if (!isOwner && photos.length === 0) return null;

  const pickFiles = () => fileInputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await upload(e.target.files);
    }
    e.target.value = "";
  };

  const confirmDelete = async () => {
    if (!photoToDelete) return;
    setDeleting(true);
    const ok = await remove(photoToDelete);
    setDeleting(false);
    if (ok) setPhotoToDelete(null);
  };

  const showEmptyState =
    isOwner && photos.length === 0 && pending.length === 0;

  return (
    <Tile>
      <div className="flex items-center justify-between mb-3">
        <TileLabel>
          Fotos {photos.length > 0 ? `(${photos.length})` : ""}
        </TileLabel>
        {isOwner && (photos.length > 0 || pending.length > 0) && (
          <button
            type="button"
            onClick={pickFiles}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-[#1a1a1a] transition-colors"
            style={{ borderColor: NEON, color: NEON }}
          >
            <Plus className="h-4 w-4" />
            Foto
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onChange}
        />
      </div>

      {showEmptyState && (
        <button
          type="button"
          onClick={pickFiles}
          className="w-full py-8 rounded-md border-2 border-dashed text-center hover:bg-[#1a1a1a] transition-colors"
          style={{ borderColor: NEON }}
        >
          <Plus className="mx-auto h-6 w-6 mb-2" style={{ color: NEON }} />
          <p
            className="text-xs font-bold uppercase tracking-[0.12em]"
            style={{ color: NEON }}
          >
            Foto hinzufügen
          </p>
          <p className="text-[10px] text-[#a3a3a3] mt-1">
            Schnappschuss vom Aussichtspunkt
          </p>
        </button>
      )}

      {(photos.length > 0 || pending.length > 0) && (
        <div className="flex md:grid md:grid-cols-4 gap-2 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square rounded-md overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f] group flex-none basis-[42%] md:basis-auto md:flex-initial snap-start"
            >
              <button
                type="button"
                onClick={() => openPhoto(p.id)}
                className="block w-full h-full"
                aria-label="Foto öffnen"
              >
                <Image
                  src={`/api/photos/${p.id}?thumb=1`}
                  alt=""
                  width={200}
                  height={200}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPhotoToDelete(p.id);
                  }}
                  className="hidden md:block absolute top-1 right-1 p-1.5 rounded-full bg-black/60 text-white md:opacity-0 md:group-hover:opacity-100 hover:bg-black/80 transition-opacity"
                  aria-label="Foto löschen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {pending.map((p) => (
            <div
              key={p.clientId}
              className="relative aspect-square rounded-md overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f] flex items-center justify-center flex-none basis-[42%] md:basis-auto md:flex-initial snap-start"
            >
              {p.status === "failed" ? (
                <button
                  type="button"
                  onClick={() => dismissPending(p.clientId)}
                  className="text-[10px] text-destructive px-2 text-center"
                  title={`${p.name} — antippen zum Verwerfen`}
                >
                  <AlertCircle className="mx-auto h-4 w-4 mb-1" />
                  Fehler
                </button>
              ) : (
                <div className="text-center text-[#a3a3a3]">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  <p className="text-[9px] mt-1 truncate max-w-[90%] mx-auto px-1">
                    {p.status === "preparing"
                      ? "Verarbeiten…"
                      : "Hochladen…"}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <AlertDialog
        open={photoToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPhotoToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Foto löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Foto wird endgültig entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              variant="destructive"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tile>
  );
}
