"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { LineChart, ListOrdered, X } from "lucide-react";
import {
  computeSplits,
  type HrSample,
  type RoutePoint,
  type Split,
} from "@/lib/splits";
import { HoverProvider, useHover } from "./hover-context";
import { BentoElevationChart } from "./bento-elevation-chart";
import { KilometerList } from "./kilometer-list";

const BentoMapClient = dynamic(() => import("./bento-map-client"), {
  ssr: false,
});

interface PhotoMarker {
  id: string;
  lat: number;
  lng: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  routeData: RoutePoint[];
  heartRateData: HrSample[];
  totalDistance?: number | null;
  totalAscent?: number | null;
  totalDescent?: number | null;
  isRunning?: boolean;
  photos?: PhotoMarker[];
  color?: string;
}

export function ActivityMapFullscreen({
  open,
  onClose,
  routeData,
  heartRateData,
  totalDistance,
  totalAscent,
  totalDescent,
  isRunning = false,
  photos = [],
  color,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // ESC closes the overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock background scroll while overlay is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <HoverProvider>
      <FullscreenContent
        onClose={onClose}
        routeData={routeData}
        heartRateData={heartRateData}
        totalDistance={totalDistance}
        totalAscent={totalAscent}
        totalDescent={totalDescent}
        isRunning={isRunning}
        photos={photos}
        color={color}
      />
    </HoverProvider>,
    document.body,
  );
}

function FullscreenContent({
  onClose,
  routeData,
  heartRateData,
  totalDistance,
  totalAscent,
  totalDescent,
  isRunning,
  photos,
  color,
}: Omit<Props, "open">) {
  const [showKm, setShowKm] = useState(false);
  const [showElev, setShowElev] = useState(false);
  const [selectedKm, setSelectedKm] = useState<number | null>(null);
  const { hoverIdx } = useHover();

  const splits = useMemo(
    () =>
      computeSplits(
        routeData,
        heartRateData ?? [],
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

  const handleSelectKm = useCallback((km: number | null) => {
    setSelectedKm(km);
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] bg-black">
      <div className="absolute inset-0">
        <BentoMapClient
          routeData={routeData}
          photos={photos}
          highlightRange={highlightRange}
          hoverIdx={hoverIdx}
          color={color}
          onRequestExitFullscreen={onClose}
        />
      </div>

      {/* Kilometer tab — left edge, vertically centered. Slides with the
          panel: when the panel is open the tab sits at its right edge. */}
      <button
        type="button"
        onClick={() => setShowKm((v) => !v)}
        aria-label="Kilometer-Liste umschalten"
        className={`absolute top-1/2 z-[1100] flex flex-col items-center gap-1.5 px-2 py-3 border-y border-r [font-family:var(--bento-mono)] text-[11px] uppercase tracking-[0.14em] transition-all duration-200 ${
          showKm
            ? "bg-white text-black border-transparent rounded-r-md"
            : "bg-[#0f0f0f] border-[#2a2a2a] text-[#a3a3a3] hover:text-white rounded-r-md"
        }`}
        style={{
          left: showKm ? 260 : 0,
          transform: "translateY(-50%)",
        }}
      >
        <ListOrdered className="h-3.5 w-3.5" />
        <span style={{ writingMode: "vertical-rl" }}>Kilometer</span>
      </button>

      {/* Höhenprofil tab — bottom edge, horizontally centered. Slides
          with the panel: when the panel is open the tab sits at its
          top edge. */}
      <button
        type="button"
        onClick={() => setShowElev((v) => !v)}
        aria-label="Höhenprofil umschalten"
        className={`absolute left-1/2 z-[1100] flex items-center gap-1.5 px-4 py-2 border-x border-t [font-family:var(--bento-mono)] text-[11px] uppercase tracking-[0.14em] transition-all duration-200 ${
          showElev
            ? "bg-white text-black border-transparent rounded-t-md"
            : "bg-[#0f0f0f] border-[#2a2a2a] text-[#a3a3a3] hover:text-white rounded-t-md"
        }`}
        style={{
          bottom: showElev ? 200 : 0,
          transform: "translateX(-50%)",
        }}
      >
        <LineChart className="h-3.5 w-3.5" />
        Höhenprofil
      </button>

      {/* Close button — top-right corner */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Vollbild schliessen"
        className="absolute top-2 right-2 z-[1200] inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] text-[#a3a3a3] hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Left panel — kilometer list */}
      <aside
        className={`absolute left-0 top-0 bottom-0 w-[260px] bg-black/85 backdrop-blur border-r border-[#2a2a2a] z-[1000] transform transition-transform duration-200 overflow-y-auto pt-12 ${
          showKm ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!showKm}
      >
        <KilometerList
          splits={splits}
          isRunning={isRunning ?? false}
          selectedKm={selectedKm}
          onSelectKm={handleSelectKm}
          highlights={highlights}
        />
      </aside>

      {/* Bottom panel — elevation chart */}
      <div
        className={`absolute right-0 bottom-0 h-[200px] bg-black/85 backdrop-blur border-t border-[#2a2a2a] z-[1000] transform transition-all duration-200 ${
          showElev ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          left: showKm ? 260 : 0,
        }}
        aria-hidden={!showElev}
      >
        <div className="h-full px-4 py-3">
          <BentoElevationChart route={routeData} />
        </div>
      </div>
    </div>
  );
}
