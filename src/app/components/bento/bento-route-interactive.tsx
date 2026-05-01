"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  computeSplits,
  type HrSample,
  type RoutePoint,
  type Split,
} from "@/lib/splits";
import { useHover } from "./hover-context";
import { KilometerList } from "./kilometer-list";
import { ActivityMapFullscreen } from "./activity-map-fullscreen";

const BentoMapClient = dynamic(() => import("./bento-map-client"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#0a0a0a] flex items-center justify-center text-[#a3a3a3] text-xs uppercase tracking-[0.16em]">
      Lade Karte…
    </div>
  ),
});

interface PhotoMarker {
  id: string;
  lat: number;
  lng: number;
}

interface Props {
  routeData: RoutePoint[];
  heartRateData: HrSample[];
  totalDistance?: number | null;
  totalAscent?: number | null;
  totalDescent?: number | null;
  isRunning?: boolean;
  photos?: PhotoMarker[];
  color?: string;
}

export function BentoRouteInteractive({
  routeData,
  heartRateData,
  totalDistance,
  totalAscent,
  totalDescent,
  isRunning = false,
  photos = [],
  color,
}: Props) {
  const [selectedKm, setSelectedKm] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const { hoverIdx } = useHover();

  const splits = useMemo(
    () =>
      computeSplits(
        routeData,
        heartRateData,
        totalDistance,
        totalAscent,
        totalDescent,
      ),
    [routeData, heartRateData, totalDistance, totalAscent, totalDescent],
  );

  const highlights = useMemo(() => {
    if (splits.length < 3) return null;
    const fastest = splits.reduce<Split | null>((best, s) => {
      if (s.paceSecPerKm == null) return best;
      if (!best || s.paceSecPerKm < best.paceSecPerKm!) return s;
      return best;
    }, null);
    const hottest = splits.reduce<Split | null>((best, s) => {
      if (s.hrAvg == null) return best;
      if (!best || s.hrAvg > (best.hrAvg ?? 0)) return s;
      return best;
    }, null);
    const steepest = splits.reduce<Split | null>((best, s) => {
      if (!best || s.ascent > best.ascent) return s;
      return best;
    }, null);
    return { fastest, hottest, steepest };
  }, [splits]);

  const highlightRange: [number, number] | null =
    selectedKm != null && splits[selectedKm - 1]
      ? [splits[selectedKm - 1].startIdx, splits[selectedKm - 1].endIdx]
      : null;

  const MAP_HEIGHT = 520;

  return (
    <>
      <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] overflow-hidden">
        <div className="grid md:grid-cols-[200px_1fr]">
          <aside
            className="border-b md:border-b-0 md:border-r border-[#2a2a2a] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ maxHeight: MAP_HEIGHT }}
          >
            <KilometerList
              splits={splits}
              isRunning={isRunning}
              selectedKm={selectedKm}
              onSelectKm={setSelectedKm}
              highlights={highlights}
            />
          </aside>
          <div style={{ height: MAP_HEIGHT }}>
            <BentoMapClient
              routeData={routeData}
              photos={photos}
              highlightRange={highlightRange}
              hoverIdx={hoverIdx}
              color={color}
              onRequestFullscreen={() => setFullscreen(true)}
            />
          </div>
        </div>
      </div>
      <ActivityMapFullscreen
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        routeData={routeData}
        heartRateData={heartRateData}
        totalDistance={totalDistance}
        totalAscent={totalAscent}
        totalDescent={totalDescent}
        isRunning={isRunning}
        photos={photos}
        color={color}
      />
    </>
  );
}
