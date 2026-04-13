"use client";

import { useEffect, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, MapPin } from "lucide-react";

interface Photo {
  id: string;
  location?: string | null;
  takenAt?: Date | string | null;
}

interface PhotoLightboxProps {
  photos: Photo[];
}

export function PhotoLightbox({ photos }: PhotoLightboxProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpenId(null);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (!openId) return;
      const idx = photos.findIndex((p) => p.id === openId);
      if (idx === -1) return;
      const next = photos[(idx + dir + photos.length) % photos.length];
      setOpenId(next.id);
      window.location.hash = `photo=${next.id}`;
    },
    [openId, photos]
  );

  // Open on hash change
  useEffect(() => {
    function readHash() {
      const m = window.location.hash.match(/^#photo=([^&]+)/);
      setOpenId(m ? m[1] : null);
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  // Keyboard
  useEffect(() => {
    if (!openId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close, navigate]);

  // Lock body scroll when open
  useEffect(() => {
    if (openId) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [openId]);

  if (!openId) return null;

  const photo = photos.find((p) => p.id === openId);
  if (!photo) return null;

  const idx = photos.findIndex((p) => p.id === openId);
  const date = photo.takenAt
    ? new Date(photo.takenAt).toLocaleString("de-CH", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/95"
      onClick={close}
    >
      {/* Top bar — overlay */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 text-white bg-gradient-to-b from-black/70 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm">
          {idx + 1} / {photos.length}
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-full p-2 hover:bg-white/10 transition-colors"
          aria-label="Schliessen"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav buttons */}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(-1);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white transition-colors"
            aria-label="Vorheriges Bild"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(1);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white transition-colors"
            aria-label="Nächstes Bild"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Image — centered, leaves room for caption */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pb-24 pt-16">
        <img
          src={`/api/photos/${photo.id}`}
          alt={photo.location ?? ""}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Caption — overlay bottom */}
      {(photo.location || date) && (
        <div
          className="absolute bottom-0 left-0 right-0 z-10 p-4 text-white text-center bg-gradient-to-t from-black/80 to-transparent"
          onClick={(e) => e.stopPropagation()}
        >
          {photo.location && (
            <div className="flex items-center justify-center gap-1.5 text-base font-medium">
              <MapPin className="h-4 w-4" />
              {photo.location}
            </div>
          )}
          {date && (
            <div className="text-sm text-white/80 mt-1">{date}</div>
          )}
        </div>
      )}
    </div>
  );
}
