"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { spaceMono } from "../bento-fonts";

interface TourMapFullscreenProps {
  /** Rechts neben «Karte», z.B. «5 Routen». */
  meta?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Bildschirmfüllende Hülle für eine Karte: Kopfzeile mit Schliessen-Knopf. */
export function TourMapFullscreen({
  meta,
  onClose,
  children,
}: TourMapFullscreenProps) {
  // ESC closes the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock background scroll while overlay is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex flex-col bg-black">
      <header className="flex items-center justify-between gap-3 border-b border-[#2a2a2a] bg-[#0a0a0a] px-4 py-2">
        <div
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]`}
        >
          Karte
          {meta ? (
            <span className="font-normal text-[#666]"> · {meta}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Karte schliessen"
          className="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0f0f0f] text-[#a3a3a3] transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>,
    document.body,
  );
}
