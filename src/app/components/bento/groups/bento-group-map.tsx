import { spaceMono } from "../bento-fonts";
import { MultiRouteMapSection } from "../../multi-route-map-section";
import type { MultiRouteEntry } from "../../multi-route-map-client";

interface BentoGroupMapProps {
  routes: MultiRouteEntry[];
  height?: number;
}

export function BentoGroupMap({ routes, height = 420 }: BentoGroupMapProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]">
      <header className="flex items-center justify-between gap-3 border-b border-[#2a2a2a] bg-[#0a0a0a] px-4 py-2">
        <div
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]`}
        >
          Karte
        </div>
        <div
          className={`${spaceMono.className} text-[10px] uppercase tracking-[0.14em] text-[#666]`}
        >
          {routes.length} {routes.length === 1 ? "Route" : "Routen"}
        </div>
      </header>
      {routes.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-[#a3a3a3]">
          Keine Aktivitäten mit Route-Daten in dieser Gruppe.
        </div>
      ) : (
        <div style={{ height: `${height}px` }}>
          <MultiRouteMapSection routes={routes} />
        </div>
      )}
    </section>
  );
}
