"use client";

import { useMemo, useState } from "react";
import { MapSection } from "./map-section";
import { ActivityChart } from "./activity-chart";
import { Heart, Gauge, Zap, Mountain } from "lucide-react";
import { computeSplits } from "@/lib/splits";
import { getSunTimes } from "@/lib/sun";

interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number | null;
  time?: string;
}

interface PhotoMarker {
  id: string;
  lat: number;
  lng: number;
}

interface RouteAnalysisProps {
  routeData: RoutePoint[];
  heartRateData: { time: string; bpm: number }[];
  speedData: { time: string; speed: number }[];
  totalDistance?: number | null;
  totalAscent?: number | null;
  totalDescent?: number | null;
  isRunning?: boolean;
  photos?: PhotoMarker[];
  startTime?: Date | string | null;
  duration?: number | null;
}

export function RouteAnalysis({
  routeData,
  heartRateData,
  speedData,
  totalDistance,
  totalAscent,
  totalDescent,
  isRunning = false,
  photos = [],
  startTime,
  duration,
}: RouteAnalysisProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedKm, setSelectedKm] = useState<number | null>(null);
  const [showHr, setShowHr] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);

  const splits = useMemo(
    () => computeSplits(routeData, heartRateData, totalDistance, totalAscent, totalDescent),
    [routeData, heartRateData, totalDistance, totalAscent, totalDescent]
  );

  const sunTimes = useMemo(() => {
    if (!startTime || routeData.length === 0) return { sunrise: null, sunset: null };
    const first = routeData[0];
    if (first?.lat == null || first?.lng == null) return { sunrise: null, sunset: null };
    return getSunTimes(first.lat, first.lng, new Date(startTime));
  }, [startTime, routeData]);

  const hasElevation = routeData.some((p) => p.elevation != null);
  const hasHr = heartRateData.length > 0;
  const hasSpeed = speedData.length > 0;

  if (routeData.length === 0) return null;

  const highlightRange: [number, number] | null =
    selectedKm != null && splits[selectedKm - 1]
      ? [splits[selectedKm - 1].startIdx, splits[selectedKm - 1].endIdx]
      : null;

  // Lap highlights (only for ≥3 splits)
  const highlights = useMemo(() => {
    if (splits.length < 3) return null;
    const fastest = splits.reduce((best, s) => {
      if (s.paceSecPerKm == null) return best;
      if (!best || s.paceSecPerKm < best.paceSecPerKm!) return s;
      return best;
    }, null as (typeof splits)[number] | null);
    const hottest = splits.reduce((best, s) => {
      if (s.hrAvg == null) return best;
      if (!best || s.hrAvg > (best.hrAvg ?? 0)) return s;
      return best;
    }, null as (typeof splits)[number] | null);
    const steepest = splits.reduce((best, s) => {
      if (!best || s.ascent > best.ascent) return s;
      return best;
    }, null as (typeof splits)[number] | null);
    return { fastest, hottest, steepest };
  }, [splits]);

  const MAP_HEIGHT = 460;

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Top: sidebar + map (sidebar height = map height) */}
      <div className="grid md:grid-cols-[180px_1fr]">
        <aside
          className="border-b md:border-b-0 md:border-r border-border overflow-y-auto"
          style={{ maxHeight: MAP_HEIGHT }}
        >
          <div className="px-3 py-2 bg-surface border-b border-border text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sticky top-0 z-10">
            Runden
          </div>
          {highlights && (
            <div className="flex flex-col gap-1 p-2 border-b border-border">
              {highlights.fastest && (
                <HighlightChip
                  onClick={() => setSelectedKm(highlights.fastest!.index)}
                  active={selectedKm === highlights.fastest.index}
                  icon={<Zap className="h-3 w-3" />}
                  label="Schnellster"
                  kmIndex={highlights.fastest.index}
                  value={
                    isRunning
                      ? formatPace(highlights.fastest.paceSecPerKm)
                      : formatSpeed(highlights.fastest.paceSecPerKm)
                  }
                  unit={isRunning ? "min/km" : "km/h"}
                />
              )}
              {highlights.hottest?.hrAvg != null && (
                <HighlightChip
                  onClick={() => setSelectedKm(highlights.hottest!.index)}
                  active={selectedKm === highlights.hottest.index}
                  icon={<Heart className="h-3 w-3" />}
                  label="Höchster Puls"
                  kmIndex={highlights.hottest.index}
                  value={`${highlights.hottest.hrAvg}`}
                  unit="bpm"
                />
              )}
              {highlights.steepest && highlights.steepest.ascent > 0 && (
                <HighlightChip
                  onClick={() => setSelectedKm(highlights.steepest!.index)}
                  active={selectedKm === highlights.steepest.index}
                  icon={<Mountain className="h-3 w-3" />}
                  label="Grösster Anstieg"
                  kmIndex={highlights.steepest.index}
                  value={`+${highlights.steepest.ascent}`}
                  unit="m"
                />
              )}
            </div>
          )}
          <ul className="divide-y divide-border">
            {splits.map((s, i) => {
              const active = selectedKm === s.index;
              const zebra = i % 2 === 1;
              return (
                <li key={s.index}>
                  <button
                    type="button"
                    onClick={() => setSelectedKm(active ? null : s.index)}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      active
                        ? "bg-brand text-white"
                        : zebra
                          ? "bg-surface/40 hover:bg-surface"
                          : "hover:bg-surface"
                    }`}
                  >
                    <div
                      className={`text-xs font-semibold ${
                        active ? "text-white/80" : "text-muted-foreground"
                      }`}
                    >
                      km {s.index}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] font-mono tabular-nums flex items-baseline gap-1.5 ${
                        active ? "text-white" : ""
                      }`}
                    >
                      <span>
                        {isRunning
                          ? formatPace(s.paceSecPerKm)
                          : formatSpeed(s.paceSecPerKm)}
                        <span
                          className={`ml-0.5 text-[9px] ${
                            active ? "text-white/70" : "text-muted-foreground"
                          }`}
                        >
                          {isRunning ? "min/km" : "km/h"}
                        </span>
                      </span>
                      <span
                        className={
                          active ? "text-white/50" : "text-muted-foreground"
                        }
                      >
                        |
                      </span>
                      <span>
                        <span className={active ? "" : "text-foreground"}>
                          +{s.ascent}
                        </span>
                        <span
                          className={
                            active
                              ? "text-white/60 mx-1"
                              : "text-muted-foreground mx-1"
                          }
                        >
                          ·
                        </span>
                        <span className={active ? "" : "text-muted-foreground"}>
                          −{s.descent}
                        </span>
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div style={{ height: MAP_HEIGHT }}>
          <MapSection
            routeData={routeData}
            photos={photos}
            hoverIdx={hoverIdx}
            highlightRange={highlightRange}
          />
        </div>
      </div>

      {/* Bottom: elevation chart full width */}
      {hasElevation && (
        <div className="border-t border-border">
          {(hasHr || hasSpeed) && (
            <div className="flex items-center justify-end gap-4 px-4 pt-3">
              {hasHr && (
                <Toggle
                  checked={showHr}
                  onChange={setShowHr}
                  icon={<Heart className="h-3.5 w-3.5" />}
                  label="Herzfrequenz"
                  color="#e11d48"
                />
              )}
              {hasSpeed && (
                <Toggle
                  checked={showSpeed}
                  onChange={setShowSpeed}
                  icon={<Gauge className="h-3.5 w-3.5" />}
                  label={isRunning ? "Pace" : "Geschwindigkeit"}
                  color="#3b82f6"
                />
              )}
            </div>
          )}
          <div className="px-2 pb-3 pt-2" style={{ height: 260 }}>
            <ActivityChart
              routeData={routeData}
              heartRateData={heartRateData}
              speedData={speedData}
              totalDistance={totalDistance}
              isRunning={isRunning}
              startTime={startTime}
              duration={duration}
              showHr={showHr}
              showSpeed={showSpeed}
              onHoverIdx={setHoverIdx}
              sunrise={sunTimes.sunrise}
              sunset={sunTimes.sunset}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function HighlightChip({
  onClick,
  active,
  icon,
  label,
  kmIndex,
  value,
  unit,
}: {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  kmIndex: number;
  value: string;
  unit: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-2 py-1 rounded-sm text-left transition-colors ${
        active
          ? "bg-brand text-white"
          : "bg-background hover:bg-surface border border-border"
      }`}
    >
      <span className={active ? "text-white" : "text-brand"}>{icon}</span>
      <div className="flex-1 min-w-0 leading-tight">
        <div className={`text-[10px] font-semibold uppercase tracking-[0.05em] ${active ? "text-white/80" : "text-muted-foreground"}`}>
          {label} · km {kmIndex}
        </div>
        <div className="text-[11px] font-mono tabular-nums font-semibold">
          {value}
          <span className={`ml-1 text-[9px] font-normal ${active ? "text-white/70" : "text-muted-foreground"}`}>
            {unit}
          </span>
        </div>
      </div>
    </button>
  );
}

function formatPace(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "–";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSpeed(sec: number | null): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return "–";
  return (3600 / sec).toFixed(1);
}

function Toggle({
  checked,
  onChange,
  icon,
  label,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium">
      <span
        className="inline-flex items-center gap-1.5"
        style={{ color: checked ? color : "var(--muted-foreground)" }}
      >
        {icon}
        {label}
      </span>
      <span
        className="relative inline-block w-8 h-[18px] rounded-full transition-colors"
        style={{ background: checked ? color : "var(--input)" }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className="absolute top-[2px] left-[2px] w-[14px] h-[14px] bg-background rounded-full transition-transform"
          style={{ transform: checked ? "translateX(14px)" : "translateX(0)" }}
        />
      </span>
    </label>
  );
}
