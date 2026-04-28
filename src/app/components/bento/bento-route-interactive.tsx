"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Zap, Heart, Mountain } from "lucide-react";
import {
  computeSplits,
  type HrSample,
  type RoutePoint,
} from "@/lib/splits";
import { useHover } from "./hover-context";

const NEON = "var(--activity-color, #FF6A00)";
const NEON_ALPHA_1A = "color-mix(in srgb, var(--activity-color, #FF6A00) 10%, transparent)";
const NEON_ALPHA_22 = "color-mix(in srgb, var(--activity-color, #FF6A00) 13%, transparent)";
const NEON_ALPHA_55 = "color-mix(in srgb, var(--activity-color, #FF6A00) 33%, transparent)";

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

function formatPace(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "–";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSpeed(sec: number | null): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return "–";
  const kmh = 3600 / sec;
  return kmh.toFixed(1);
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
  const { hoverIdx } = useHover();

  const splits = useMemo(
    () =>
      computeSplits(
        routeData,
        heartRateData,
        totalDistance,
        totalAscent,
        totalDescent
      ),
    [routeData, heartRateData, totalDistance, totalAscent, totalDescent]
  );

  const highlights = useMemo(() => {
    if (splits.length < 3) return null;
    const fastest = splits.reduce<(typeof splits)[number] | null>((best, s) => {
      if (s.paceSecPerKm == null) return best;
      if (!best || s.paceSecPerKm < best.paceSecPerKm!) return s;
      return best;
    }, null);
    const hottest = splits.reduce<(typeof splits)[number] | null>((best, s) => {
      if (s.hrAvg == null) return best;
      if (!best || s.hrAvg > (best.hrAvg ?? 0)) return s;
      return best;
    }, null);
    const steepest = splits.reduce<(typeof splits)[number] | null>((best, s) => {
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
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #0f0f0f 0%, color-mix(in srgb, var(--activity-color, #FF6A00) 10%, #0f0f0f) 45%, color-mix(in srgb, var(--activity-color, #FF6A00) 22%, #0f0f0f) 100%)",
        borderColor:
          "color-mix(in srgb, var(--activity-color, #FF6A00) 40%, #2a2a2a)",
        boxShadow:
          "0 0 24px color-mix(in srgb, var(--activity-color, #FF6A00) 18%, transparent)",
      }}
    >
      <div className="grid md:grid-cols-[200px_1fr]">
        <aside
          className="border-b md:border-b-0 md:border-r border-[#2a2a2a] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ maxHeight: MAP_HEIGHT }}
        >
          <div className="[font-family:var(--bento-mono)] px-3 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] sticky top-0 z-10">
            Runden
          </div>
          {highlights && (
            <div className="flex flex-col gap-1 p-2 border-b border-[#2a2a2a]">
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
          <ul className="divide-y divide-[#2a2a2a]">
            {splits.map((s) => {
              const active = selectedKm === s.index;
              return (
                <li key={s.index}>
                  <button
                    type="button"
                    onClick={() => setSelectedKm(active ? null : s.index)}
                    className="w-full text-left px-3 py-2 transition-colors hover:bg-[#151515]"
                    style={
                      active
                        ? {
                            background: NEON_ALPHA_1A,
                            borderLeft: `3px solid ${NEON}`,
                          }
                        : undefined
                    }
                  >
                    <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]">
                      km {s.index}
                    </div>
                    <div className="[font-family:var(--bento-mono)] mt-0.5 text-[11px] tabular-nums text-white flex items-baseline gap-1.5">
                      <span>
                        {isRunning
                          ? formatPace(s.paceSecPerKm)
                          : formatSpeed(s.paceSecPerKm)}
                        <span className="ml-0.5 text-[9px] text-[#a3a3a3]">
                          {isRunning ? "min/km" : "km/h"}
                        </span>
                      </span>
                      <span className="text-[#3a3a3a]">|</span>
                      <span>
                        <span>+{s.ascent}</span>
                        <span className="text-[#a3a3a3] mx-1">·</span>
                        <span className="text-[#a3a3a3]">−{s.descent}</span>
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <div style={{ height: MAP_HEIGHT }}>
          <BentoMapClient
            routeData={routeData}
            photos={photos}
            highlightRange={highlightRange}
            hoverIdx={hoverIdx}
            color={color}
          />
        </div>
      </div>
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
      className="w-full text-left rounded-md px-2.5 py-1.5 transition-colors hover:bg-[#151515]"
      style={
        active
          ? { background: NEON_ALPHA_22, border: `1px solid ${NEON_ALPHA_55}` }
          : { border: "1px solid #2a2a2a" }
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 [font-family:var(--bento-mono)] text-[9px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
          <span style={{ color: NEON }}>{icon}</span>
          {label}
        </div>
        <div className="[font-family:var(--bento-mono)] text-[9px] text-[#a3a3a3]">
          km {kmIndex}
        </div>
      </div>
      <div className="[font-family:var(--bento-mono)] mt-0.5 text-sm font-bold tabular-nums text-white">
        {value}
        <span className="ml-1 text-[9px] text-[#a3a3a3]">{unit}</span>
      </div>
    </button>
  );
}
