"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, X, Trash2, Loader2 } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";
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

interface PhotoItem {
  id: string;
  uploading?: boolean;
  failed?: boolean;
  tempFile?: File;
}

interface ActivityEditSheetProps {
  open: boolean;
  onClose: () => void;
  activity: {
    id: string;
    name: string;
    notes: string | null;
    ascent: number | null;
    descent: number | null;
  };
  initialPhotos: { id: string }[];
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-base focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft transition-colors";

export function ActivityEditSheet({
  open,
  onClose,
  activity,
  initialPhotos,
}: ActivityEditSheetProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(activity.name);
  const [notes, setNotes] = useState(activity.notes ?? "");
  const [ascent, setAscent] = useState(
    activity.ascent != null ? String(Math.round(activity.ascent)) : ""
  );
  const [descent, setDescent] = useState(
    activity.descent != null ? String(Math.round(activity.descent)) : ""
  );
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  // Reset when activity changes or sheet opens
  useEffect(() => {
    if (open) {
      setName(activity.name);
      setNotes(activity.notes ?? "");
      setAscent(activity.ascent != null ? String(Math.round(activity.ascent)) : "");
      setDescent(activity.descent != null ? String(Math.round(activity.descent)) : "");
      setPhotos(initialPhotos);
      setError(null);
    }
  }, [open, activity, initialPhotos]);

  const dirty =
    name.trim() !== activity.name ||
    notes.trim() !== (activity.notes ?? "") ||
    ascent !== (activity.ascent != null ? String(Math.round(activity.ascent)) : "") ||
    descent !== (activity.descent != null ? String(Math.round(activity.descent)) : "");

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const tempId = `tmp-${crypto.randomUUID()}`;
      setPhotos((prev) => [...prev, { id: tempId, uploading: true, tempFile: file }]);
      try {
        const fd = new FormData();
        fd.append("files", file);
        const res = await fetch(`/api/activities/${activity.id}/photos`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const newId = data.uploaded?.[0]?.id as string | undefined;
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === tempId
              ? newId
                ? { id: newId }
                : { id: tempId, failed: true, tempFile: file }
              : p
          )
        );
      } catch {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === tempId ? { id: tempId, failed: true, tempFile: file } : p
          )
        );
      }
    }
    router.refresh();
  }

  function handleDeletePhoto(id: string) {
    if (id.startsWith("tmp-")) {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      return;
    }
    setPhotoToDelete(id);
  }

  async function confirmDeletePhoto() {
    if (!photoToDelete) return;
    const id = photoToDelete;
    const prev = photos;
    setDeletingPhoto(true);
    setPhotos((list) => list.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setPhotoToDelete(null);
      router.refresh();
    } catch {
      setPhotos(prev);
      setError("Foto konnte nicht gelöscht werden.");
      setPhotoToDelete(null);
    } finally {
      setDeletingPhoto(false);
    }
  }

  async function handleSave() {
    if (!dirty) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (name.trim() !== activity.name) payload.name = name.trim();
      if (notes.trim() !== (activity.notes ?? "")) {
        payload.notes = notes.trim() || null;
      }
      const ascentNext = ascent.trim() === "" ? null : Number(ascent);
      const descentNext = descent.trim() === "" ? null : Number(descent);
      if (ascentNext !== activity.ascent) payload.ascent = ascentNext;
      if (descentNext !== activity.descent) payload.descent = descentNext;

      if (Object.keys(payload).length > 0) {
        const res = await fetch(`/api/activities/${activity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (dirty && !confirm("Ungespeicherte Änderungen verwerfen?")) return;
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title="Aktivität bearbeiten"
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 h-11 rounded-md border border-border text-sm font-semibold hover:bg-surface"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-11 rounded-md bg-foreground text-background text-sm font-semibold hover:bg-brand disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Speichern
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-5">
        {/* Titel */}
        <label className="block">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
            Titel
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            maxLength={200}
          />
        </label>

        {/* Notiz */}
        <label className="block">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
            Notiz
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
            rows={3}
            maxLength={2000}
            placeholder="Wie war's?"
          />
        </label>

        {/* Höhenmeter */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
              Aufstieg (m)
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={ascent}
              onChange={(e) => setAscent(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
              Abstieg (m)
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={descent}
              onChange={(e) => setDescent(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        {/* Fotos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Fotos {photos.length > 0 && `(${photos.length})`}
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-surface"
            >
              <Plus className="h-3.5 w-3.5" /> Hinzufügen
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {photos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
              Noch keine Fotos.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="relative aspect-square rounded-md overflow-hidden border border-border bg-surface"
                >
                  {p.uploading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : p.failed ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-destructive px-2 text-center">
                      Upload fehlgeschlagen
                    </div>
                  ) : (
                    <Image
                      src={`/api/photos/${p.id}?thumb=1`}
                      alt=""
                      width={120}
                      height={120}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(p.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Foto löschen"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
            <X className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <AlertDialog
        open={photoToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingPhoto) setPhotoToDelete(null);
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
            <AlertDialogCancel disabled={deletingPhoto}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeletePhoto();
              }}
              disabled={deletingPhoto}
              variant="destructive"
            >
              {deletingPhoto && <Loader2 className="h-4 w-4 animate-spin" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BottomSheet>
  );
}
