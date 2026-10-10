"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { spaceMono } from "../bento-fonts";
import { MultiRouteMapSection } from "../../multi-route-map-section";
import type { MultiRouteEntry } from "../../multi-route-map-client";

interface BentoTourMapProps {
  routes: MultiRouteEntry[];
  height?: number;
}

export function BentoTourMap({ routes, height = 420 }: BentoTourMapProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const routeCount = `${routes.length} ${routes.length === 1 ? "Route" : "Routen"}`;

  return (
    <section className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]">
      <header className="flex items-center justify-between gap-3 border-b border-[#2a2a2a] bg-[#0a0a0a] px-4 py-2">
        <div
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]`}
        >
          Karte
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`${spaceMono.className} text-[10px] uppercase tracking-[0.14em] text-[#666]`}
          >
            {routeCount}
          </div>
          {routes.length > 0 ? (
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              aria-label="Karte im Vollbild öffnen"
              className={`${spaceMono.className} cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] transition-colors hover:border-[#4a4a4a] hover:text-white`}
            >
              <Maximize2 className="h-3 w-3" />
              Vollbild
            </button>
          ) : null}
        </div>
      </header>
      {routes.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-[#a3a3a3]">
          Keine Aktivitäten mit Route-Daten in dieser Tour.
        </div>
      ) : (
        <div style={{ height: `${height}px` }}>
          <MultiRouteMapSection routes={routes} pageScroll />
        </div>
      )}
      {fullscreen ? (
        <TourMapFullscreen
          routes={routes}
          routeCount={routeCount}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </section>
  );
}

function TourMapFullscreen({
  routes,
  routeCount,
  onClose,
}: {
  routes: MultiRouteEntry[];
  routeCount: string;
  onClose: () => void;
}) {
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
          Karte <span className="font-normal text-[#666]">· {routeCount}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Vollbild schliessen"
          className="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0f0f0f] text-[#a3a3a3] transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <MultiRouteMapSection routes={routes} />
      </div>
    </div>,
    document.body,
  );
}
