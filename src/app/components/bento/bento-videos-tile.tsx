"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Tile, TileLabel } from "@/app/activity/[id]/tiles";
import { useVideoUpload } from "@/lib/hooks/use-video-upload";
import { appendShareToken, useShareToken } from "@/lib/share-context";
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
// Solange ein Video verarbeitet wird, die Seite in diesem Takt neu laden.
const POLL_MS = 4000;

export interface VideoItem {
  id: string;
  status: string;
  width: number | null;
  height: number | null;
}

interface Props {
  activityId: string;
  videos: VideoItem[];
  isOwner: boolean;
}

export function BentoVideosTile({ activityId, videos, isOwner }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pending, upload, remove, error, setError, dismissPending } =
    useVideoUpload(activityId);
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const shareToken = useShareToken();

  const processing = videos.some((v) => v.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(() => router.refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [processing, router]);

  if (!isOwner && videos.length === 0) return null;

  const pickFile = () => fileInputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await upload(file);
  };

  const confirmDelete = async () => {
    if (!videoToDelete) return;
    setDeleting(true);
    const ok = await remove(videoToDelete);
    setDeleting(false);
    if (ok) setVideoToDelete(null);
  };

  const isEmpty = videos.length === 0 && pending.length === 0;

  return (
    <Tile>
      <div className="flex items-center justify-between mb-3">
        <TileLabel>Videos {videos.length > 0 ? `(${videos.length})` : ""}</TileLabel>
        {isOwner && !isEmpty && (
          <button
            type="button"
            onClick={pickFile}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
            style={{ borderColor: NEON, color: NEON }}
          >
            <Plus className="h-4 w-4" />
            Video
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onChange}
        />
      </div>

      {isOwner && isEmpty && (
        <button
          type="button"
          onClick={pickFile}
          className="w-full py-8 rounded-md border-2 border-dashed text-center hover:bg-[#1a1a1a] transition-colors cursor-pointer"
          style={{ borderColor: NEON }}
        >
          <Plus className="mx-auto h-6 w-6 mb-2" style={{ color: NEON }} />
          <p
            className="text-xs font-bold uppercase tracking-[0.12em]"
            style={{ color: NEON }}
          >
            Video hinzufügen
          </p>
          <p className="text-[10px] text-[#a3a3a3] mt-1">
            Bis 5 Minuten, wird fürs Web umgewandelt
          </p>
        </button>
      )}

      {!isEmpty && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {videos.map((v) => (
            <div
              key={v.id}
              className="relative rounded-md overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f] group"
            >
              {v.status === "ready" ? (
                <video
                  controls
                  playsInline
                  preload="none"
                  poster={appendShareToken(`/api/videos/${v.id}?poster=1`, shareToken)}
                  src={appendShareToken(`/api/videos/${v.id}`, shareToken)}
                  className="block w-full max-h-[70vh] bg-black"
                  style={
                    v.width && v.height
                      ? { aspectRatio: `${v.width} / ${v.height}` }
                      : undefined
                  }
                />
              ) : (
                <div className="aspect-video flex items-center justify-center text-center text-[#a3a3a3]">
                  {v.status === "failed" ? (
                    <div className="text-destructive text-[11px] px-3">
                      <AlertCircle className="mx-auto h-5 w-5 mb-1" />
                      Umwandlung fehlgeschlagen
                    </div>
                  ) : (
                    <div>
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      <p className="text-[10px] mt-2 uppercase tracking-[0.12em]">
                        Wird verarbeitet…
                      </p>
                    </div>
                  )}
                </div>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setVideoToDelete(v.id);
                  }}
                  className="absolute top-1 right-1 p-1.5 rounded-full bg-black/60 text-white md:opacity-0 md:group-hover:opacity-100 hover:bg-black/80 transition-opacity cursor-pointer"
                  aria-label="Video löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {pending.map((p) => (
            <div
              key={p.clientId}
              className="aspect-video rounded-md border border-[#2a2a2a] bg-[#0f0f0f] flex items-center justify-center px-4"
            >
              {p.status === "failed" ? (
                <button
                  type="button"
                  onClick={() => dismissPending(p.clientId)}
                  className="text-[11px] text-destructive text-center cursor-pointer"
                  title={`${p.name} — antippen zum Verwerfen`}
                >
                  <AlertCircle className="mx-auto h-5 w-5 mb-1" />
                  Fehler — antippen zum Verwerfen
                </button>
              ) : (
                <div className="w-full text-center text-[#a3a3a3]">
                  <p className="text-[10px] uppercase tracking-[0.12em] mb-2">
                    Hochladen… {Math.round(p.progress * 100)} %
                  </p>
                  <div className="h-1.5 w-full rounded-full bg-[#1f1f1f] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{ width: `${p.progress * 100}%`, background: NEON }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <AlertDialog
        open={videoToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setVideoToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Video löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Video und ein daraus erstelltes Story-Video werden endgültig
              entfernt.
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
