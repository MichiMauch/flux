"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateGroupCoverPosition } from "./actions";

interface Props {
  groupId: string;
  initialUrl: string | null;
  initialOffsetX: number;
  initialOffsetY: number;
}

export function GroupCoverUploader({
  groupId,
  initialUrl,
  initialOffsetX,
  initialOffsetY,
}: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [version, setVersion] = useState(0);
  const [offsetX, setOffsetX] = useState(initialOffsetX);
  const [offsetY, setOffsetY] = useState(initialOffsetY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startOffsetX: number;
    startOffsetY: number;
    overflowX: number; // px image hidden horizontally
    overflowY: number; // px image hidden vertically
  } | null>(null);
  const router = useRouter();

  const displayUrl = url
    ? `${url}${version ? `?v=${version}` : ""}`
    : null;

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/groups/${groupId}/cover`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload fehlgeschlagen");
      }
      const data = await res.json();
      setUrl(data.url);
      setVersion(Date.now());
      setOffsetX(50);
      setOffsetY(50);
      toast.success("Cover hochgeladen");
      startTransition(() => router.refresh());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload fehlgeschlagen";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Cover-Bild wirklich entfernen?")) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/cover`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Löschen fehlgeschlagen");
      }
      setUrl(null);
      setVersion(Date.now());
      toast.success("Cover entfernt");
      startTransition(() => router.refresh());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function persistPosition(x: number, y: number) {
    setSavingPosition(true);
    try {
      await updateGroupCoverPosition(groupId, x, y);
      toast.success("Position gespeichert");
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Position konnte nicht gespeichert werden"
      );
    } finally {
      setSavingPosition(false);
    }
  }

  function startDrag(clientX: number, clientY: number) {
    if (!containerRef.current || !imgRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const img = imgRef.current;
    const naturalRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = rect.width / rect.height;

    let renderedW: number;
    let renderedH: number;
    if (naturalRatio > containerRatio) {
      // Image wider — fills height, overflow horizontally
      renderedH = rect.height;
      renderedW = renderedH * naturalRatio;
    } else {
      renderedW = rect.width;
      renderedH = renderedW / naturalRatio;
    }
    const overflowX = Math.max(0, renderedW - rect.width);
    const overflowY = Math.max(0, renderedH - rect.height);

    dragRef.current = {
      startMouseX: clientX,
      startMouseY: clientY,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
      overflowX,
      overflowY,
    };
  }

  function moveDrag(clientX: number, clientY: number) {
    const d = dragRef.current;
    if (!d) return;
    const dx = clientX - d.startMouseX;
    const dy = clientY - d.startMouseY;
    // Drag right → image moves right → object-position X% decreases
    const newX = d.overflowX
      ? d.startOffsetX - (dx / d.overflowX) * 100
      : d.startOffsetX;
    const newY = d.overflowY
      ? d.startOffsetY - (dy / d.overflowY) * 100
      : d.startOffsetY;
    setOffsetX(Math.max(0, Math.min(100, newX)));
    setOffsetY(Math.max(0, Math.min(100, newY)));
  }

  function endDrag() {
    if (!dragRef.current) return;
    dragRef.current = null;
    void persistPosition(offsetX, offsetY);
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (dragRef.current) {
        e.preventDefault();
        moveDrag(e.clientX, e.clientY);
      }
    }
    function onUp() {
      if (dragRef.current) endDrag();
    }
    function onTouchMove(e: TouchEvent) {
      if (dragRef.current && e.touches[0]) {
        e.preventDefault();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }
    function onTouchEnd() {
      if (dragRef.current) endDrag();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetX, offsetY]);

  function resetPosition() {
    setOffsetX(50);
    setOffsetY(50);
    void persistPosition(50, 50);
  }

  return (
    <div className="space-y-3">
      {displayUrl ? (
        <div
          ref={containerRef}
          onMouseDown={(e) => {
            e.preventDefault();
            startDrag(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) startDrag(t.clientX, t.clientY);
          }}
          className="relative aspect-[16/9] w-full cursor-grab overflow-hidden rounded-md border border-[#2a2a2a] bg-[#1a1a1a] active:cursor-grabbing select-none touch-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- need direct access to naturalWidth/Height for drag math */}
          <img
            ref={imgRef}
            src={displayUrl}
            alt="Cover"
            draggable={false}
            className="pointer-events-none h-full w-full select-none object-cover"
            style={{ objectPosition: `${offsetX}% ${offsetY}%` }}
          />
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-2">
            <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white">
              {savingPosition ? "speichern …" : "ziehen zum verschieben"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-md border border-dashed border-[#2a2a2a] bg-[#1a1a1a] text-xs text-[#666]">
          Kein Cover-Bild
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
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
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white hover:border-[#4a4a4a] disabled:opacity-50"
        >
          {url ? "Cover ersetzen" : "Cover hochladen"}
        </button>
        {url ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={resetPosition}
              className="inline-flex items-center rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:border-[#4a4a4a] hover:text-white disabled:opacity-50"
            >
              Zentrieren
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="inline-flex items-center rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:border-[#4a4a4a] hover:text-white disabled:opacity-50"
            >
              Entfernen
            </button>
          </>
        ) : null}
        {busy ? (
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]">
            Lädt …
          </span>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
