"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2, Trash2 } from "lucide-react";

interface PortraitUploadProps {
  userId: string;
  hasPortrait: boolean;
  initials: string;
}

export function PortraitUpload({
  userId,
  hasPortrait,
  initials,
}: PortraitUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState<number>(() =>
    hasPortrait ? Date.now() : 0
  );
  const [showPortrait, setShowPortrait] = useState(hasPortrait);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/portrait", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Upload fehlgeschlagen");
      }
      setCacheBust(Date.now());
      setShowPortrait(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Portrait löschen?")) return;
    setUploading(true);
    try {
      const res = await fetch("/api/profile/portrait", { method: "DELETE" });
      if (!res.ok) throw new Error("Löschen fehlgeschlagen");
      setShowPortrait(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-surface border border-border flex items-center justify-center">
          {showPortrait ? (
            <Image
              src={`/api/profile/portrait/${userId}?v=${cacheBust}`}
              alt="Portrait"
              width={96}
              height={96}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground">
              {initials}
            </span>
          )}
        </div>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-background/80 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5" />
          {showPortrait ? "Ändern" : "Portrait hochladen"}
        </button>
        {showPortrait && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-surface disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Entfernen
          </button>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    </div>
  );
}
