"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { spaceMono } from "../bento-fonts";
import { MultiRouteMapSection } from "../../multi-route-map-section";
import type { MultiRouteEntry } from "../../multi-route-map-client";
import { TourMapFullscreen } from "./tour-map-fullscreen";

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
          meta={routeCount}
          onClose={() => setFullscreen(false)}
        >
          <MultiRouteMapSection routes={routes} />
        </TourMapFullscreen>
      ) : null}
    </section>
  );
}
